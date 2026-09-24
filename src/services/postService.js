import { supabase } from '../lib/supabase';
import { getEmbedInfo } from '../lib/embed';

import { ok, fail, from, fromCount } from './result';

import { POST_SELECT, attachEngagement } from './postSelect';

export const TAMANHO_DO_LOTE = 20;

/**
 * Uma página do feed, por CURSOR (keyset).
 *
 * ── Por que passa por RPC, com número ─────────────────────────────────────
 *
 * Keyset precisa comparar LINHA: `(created_at, id) < (cursor…)`. O PostgREST
 * não sabe expressar isso. Medido no banco com 300 linhas semeadas, página do
 * meio:
 *
 *   `ROW(created_at,id) < ROW(…)`        Index Cond,   0 filtradas,  20 heap
 *   `.or(lt, and(eq, id.lt))`            **Filter**, 100 filtradas, 239 heap
 *
 * A segunda forma varre o índice desde o topo e joga fora o que já passou —
 * é o custo do `OFFSET` com outro nome, e piora a cada página. O porquê
 * inteiro está na migration `feed_pagina_cursor_keyset`.
 *
 * ── Por que a RPC devolve só os IDS ───────────────────────────────────────
 *
 * Porque o `POST_SELECT` daqui já traz autor e mídia por embed. Reescrever o
 * embed em SQL criaria uma **segunda definição** do que é um post no feed — a
 * duplicação do §4 no lugar mais caro. A RPC entrega a ORDEM; esta função
 * busca as linhas e reordena.
 *
 * @param {object} p
 * @param {number} [p.limite]   quantos posts nesta página
 * @param {{created_at: string, id: string}|null} [p.cursor]  o último post já visto
 * @param {string|null} [p.viewerId]
 * @returns {Promise<{data: {posts: Array, proximoCursor: object|null, temMais: boolean}, error: object|null}>}
 */
export async function fetchFeedPosts({ limite = TAMANHO_DO_LOTE, cursor = null, viewerId = null } = {}) {
  const vazio = { posts: [], proximoCursor: null, temMais: false };

  // Pede UM a mais do que vai mostrar: se voltar o extra, existe próxima
  // página. Sem isso, "tem mais?" viraria uma segunda consulta ou um palpite —
  // e palpite aqui vira botão de "carregar mais" que não carrega nada.
  const { data: ordem, error } = await supabase.rpc('feed_pagina', {
    p_limite: limite + 1,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  });
  if (error) return fail(error, vazio);
  if (!ordem?.length) return ok(vazio);

  const temMais = ordem.length > limite;
  const daPagina = temMais ? ordem.slice(0, limite) : ordem;

  const { data: linhas, error: erroLinhas } = await supabase
    .from('posts').select(POST_SELECT).in('id', daPagina.map((o) => o.id));
  if (erroLinhas) return fail(erroLinhas, vazio);

  // Reordena pela ordem que veio do banco: o `.in()` não garante ordem nenhuma.
  const porId = new Map((linhas || []).map((l) => [l.id, l]));
  // `filter(Boolean)`: entre as duas consultas o post pode ter sido apagado ou
  // ocultado, e aí a RLS não o devolve. Sumir é o comportamento certo — o que
  // não pode é virar buraco `undefined` na lista.
  const posts = daPagina.map((o) => porId.get(o.id)).filter(Boolean);

  const ultimo = daPagina[daPagina.length - 1];
  return ok({
    posts: await attachEngagement(posts, viewerId),
    proximoCursor: { created_at: ultimo.created_at, id: ultimo.id },
    temMais,
  });
}

/**
 * Um post pelo id, para a página `/post/:id`.
 *
 * ── Por que NÃO filtra `deleted_at` nem `hidden_at` ─────────────────────────
 *
 * Porque quem decide isso é a RLS, e ela já faz melhor do que este arquivo
 * conseguiria: a policy `posts_select` libera conteúdo oculto **e** apagado
 * para `role_rank >= 2` (conferido em `pg_policies`). Filtrar aqui esconderia
 * do moderador exatamente o conteúdo que ele precisa julgar — que é o motivo
 * desta função existir.
 *
 * Para quem não é da equipe, a mesma consulta devolve vazio, e a página mostra
 * "não existe ou não está visível". As duas causas são indistinguíveis do lado
 * do cliente por construção, e é assim que deve ser: dizer "existe, mas você
 * não pode ver" já é vazar a existência.
 */
export async function fetchPostById(postId, viewerId = null) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .maybeSingle();
  if (error) return fail(error, null);
  if (!data) return ok(null);
  const [comEngajamento] = await attachEngagement([data], viewerId);
  return ok(comEngajamento);
}

export async function fetchUserPosts(userId, viewerId = null) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .is('live_kind', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) return fail(error, []);
  return ok(await attachEngagement(data || [], viewerId));
}

export async function fetchActiveLives() {
  const { data, error } = await supabase
    .from('posts')
    .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
    .eq('is_live', true)
    // `[18/09]` SEC-034: sem este filtro, uma live APAGADA continuava listada
    // como "AO VIVO" — para quem é da equipe. A `posts_select` libera conteúdo
    // apagado a partir de `role_rank >= 2`, então a RLS escondia o problema de
    // todo mundo menos de quem mais olha essa tela.
    //
    // O trigger `set_live_ended_at` agora encerra a live ao apagar o post, o
    // que já resolveria sozinho. Este filtro fica como segunda camada: a
    // primeira correção de segurança que dependeu de UM só mecanismo neste
    // projeto foi a do SEC-025, e a lição foi não repetir isso.
    .is('deleted_at', null)
    // `[19/09]` LIVE-051: o mesmo buraco, na coluna irmã. Ocultar era a outra
    // metade — e a mais usada pela moderação, que oculta bem mais do que apaga.
    // Medido: com a live oculta, o usuário comum via 0 e a EQUIPE via 1.
    .is('hidden_at', null)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .not('embed_url', 'is', null)
    .order('created_at', { ascending: false });
  if (error) return fail(error, []);
  return ok(data || []);
}

// ─── Post CRUD ───────────────────────────────────────────────────────────────

export async function createPost({ userId, title, content, category, audioUrl, audioType, audioName, embedUrl, isLive, liveKind, liveKindLabel, liveDuracaoMinutos }) {
  const embedInfo = embedUrl ? getEmbedInfo(embedUrl) : null;
  return from(await supabase.from('posts').insert({
    user_id: userId,
    title: title.trim(),
    content: content?.trim() || null,
    category,
    audio_url: audioUrl,
    audio_type: audioType,
    audio_name: audioName?.trim() || null,
    embed_url: embedUrl?.trim() || null,
    embed_type: embedInfo?.type || null,
    is_live: isLive,
    // `[18/09]` SEC-027: `was_live` e `expires_at` saíram do corpo.
    //
    // `was_live` é **derivado** agora — o trigger `guard_post_privileged_cols`
    // o define a partir de `is_live`. Mandá-lo daqui não fazia diferença
    // nenhuma para o site (o valor era sempre igual a `is_live`) e abria um
    // buraco que o pentest não chegou a testar: um POST direto na REST API
    // nascia com `was_live: true` e ganhava os 30 XP de live sem live alguma.
    //
    // `expires_at: null` era só o valor padrão escrito à mão. Mandá-lo obrigava
    // a manter o privilégio de escrita numa coluna que a `cleanup_expired_posts`
    // usa para **apagar de verdade** — era o caminho para destruir conteúdo sob
    // moderação pulando a janela de 30 dias.
    //
    // Tipo de live de jogador (null = post/live comum). Rótulo só faz sentido
    // quando "outro".
    live_kind: liveKind || null,
    live_kind_label: liveKind === 'outro' ? (liveKindLabel?.trim() || null) : null,
    // `[18/09]` LIVE-041: a DURAÇÃO é intenção, não valor. Quem calcula o
    // `expires_at` é o guard no banco — mandar o instante daqui reabriria o
    // achado do pentest, porque a `cleanup_expired_posts` APAGA de verdade por
    // essa coluna. `null` = sem prazo próprio, e aí vale o teto de 24h do cron.
    live_duracao_minutos: isLive ? (liveDuracaoMinutos ?? null) : null,
  }).select().single());
}

// `[18/09]` SEC-027: `wasLive` saiu da assinatura. Quem decide `was_live` é o
// banco, a partir de `is_live` — e de forma **monotônica**, então marcar o post
// como live continua acendendo o marcador, e desmarcar não o apaga (a live
// aconteceu). Antes o cliente mandava o valor, e quem chamasse a REST API
// direto mandava o que quisesse.
export async function updatePost(postId, { content, isLive }, userId, isAdmin) {
  let q = supabase.from('posts').update({
    content: content?.trim() || null,
    is_live: isLive,
    edited_at: new Date().toISOString(),
  }, { count: 'exact' }).eq('id', postId);
  if (!isAdmin) q = q.eq('user_id', userId);
  // `[10/09]` Sem a contagem, a RLS recusando virava "Post editado!" com o
  // texto antigo na tela até o próximo carregamento. E `isAdmin` vem do
  // CLIENTE: ele só tira o filtro `.eq('user_id')` — quem decide de verdade é a
  // policy `posts_update`, que desde o SEC-009 exige hierarquia estrita.
  return fromCount(await q, 'Não foi possível editar este post.');
}

export async function softDeletePost(postId) {
  return from(await supabase.rpc('soft_delete_post', { p_post_id: postId }));
}



export async function endLivePost(postId) {
  // count 0 sem erro = a RLS negou em silencio; sem isto a tela diz "encerrada"
  // e a live continua no ar.
  return fromCount(
    await supabase.from('posts').update({ is_live: false }, { count: 'exact' }).eq('id', postId),
    'Sem permissão para encerrar esta live.',
  );
}

// ─── Likes ───────────────────────────────────────────────────────────────────

// Fallback por card. O feed/mural já trazem os contadores em lote — isto só
// roda onde o post chega "solto" (painel admin, permalink, moderação).
export async function fetchLikeStatus(postId, userId) {
  const [{ count }, { data: liked }] = await Promise.all([
    supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    userId
      ? supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return ok({ count: count || 0, liked: !!liked });
}

export async function likePost(postId, userId) {
  return from(await supabase.from('post_likes').insert({ post_id: postId, user_id: userId }));
}

export async function unlikePost(postId, userId) {
  // 0-linhas-ok: descurtir o que já não está curtido é o objetivo atingido.
  return from(await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId));
}
