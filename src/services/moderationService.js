import { supabase } from '../lib/supabase';
import { ok, fail, from, fromCount } from './result';
import { registrarErro } from '../lib/monitoring';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Reports ──────────────────────────────────────────────────────────────────

export async function createReport({ contentType, contentId, reason, details }) {
  return from(await supabase.from('reports').insert({
    reporter_id: (await supabase.auth.getUser()).data.user?.id,
    content_type: contentType,
    content_id: contentId,
    reason,
    details: details?.trim() || null,
  }));
}

export async function fetchReports({ status = null, contentType = null } = {}) {
  let q = supabase.from('reports').select('*, reporter:profiles!reporter_id(username, avatar_url)')
    .order('created_at', { ascending: false });
  if (status)      q = q.eq('status', status);
  if (contentType) q = q.eq('content_type', contentType);
  const { data, error } = await q;
  if (error) return fail(error, []);
  return ok(data || []);
}

export async function updateReportStatus(reportId, status) {
  return from(await supabase.from('reports').update({ status }).eq('id', reportId));
}

// ─── Moderation Queue ─────────────────────────────────────────────────────────

export async function fetchModerationQueue(status = 'pending', page = 0, pageSize = 20) {
  const { data, count, error } = await supabase
    .from('moderation_queue')
    .select('*, profiles!reviewed_by(username)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) return fail(error, { items: [], count: 0 });
  return ok({ items: data || [], count: count || 0 });
}

export async function resolveQueueItem(queueId, decision, contentType, contentId) {
  const userId = (await supabase.auth.getUser()).data.user?.id;

  if (decision === 'approved') {
    // confirm hide: already hidden by trigger, just mark reviewed
  } else if (decision === 'rejected' && contentType !== 'chat') {
    // Restaura o conteúdo — reaproveita o helper que checa 0 linhas, em vez de
    // repetir o update cru (que ignorava falha de RLS).
    //
    // `chat` fica de fora porque `live_chat` não tem `hidden_at`: nada foi
    // escondido, então não há o que restaurar. Sem esta guarda, `restoreContent`
    // devolvia erro e a recusa do item falhava por inteiro — o item ficava
    // preso na fila para sempre.
    const res = await restoreContent(contentType, contentId);
    if (res.error) return res;
  }

  return from(await supabase.from('moderation_queue').update({
    status: decision,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', queueId));
}

// Enfileira manualmente (ex: admin oculta via wordlist)

// ─── Blocked Words ────────────────────────────────────────────────────────────

export async function fetchBlockedWords() {
  const { data, error } = await supabase.from('blocked_words').select('*').order('word');
  if (error) return fail(error, []);
  return ok(data || []);
}

export async function addBlockedWord(word, severity = 'medium') {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  return from(await supabase.from('blocked_words').insert({ word: word.trim().toLowerCase(), severity, created_by: userId }));
}

export async function removeBlockedWord(wordId) {
  return from(await supabase.from('blocked_words').delete().eq('id', wordId));
}

// ─── Violations ───────────────────────────────────────────────────────────────

export async function fetchViolations(userId = null, page = 0, pageSize = 20) {
  let q = supabase
    .from('violations')
    .select('*, user_profile:profiles!user_id(username, avatar_url), reviewer:profiles!reviewed_by(username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (Array.isArray(userId)) q = q.in('user_id', userId);
  else if (userId) q = q.eq('user_id', userId);
  const { data, count, error } = await q;
  if (error) return fail(error, { items: [], count: 0 });
  return ok({ items: data || [], count: count || 0 });
}

// Suspensão temporária (1 ou 7 dias). Bloqueia criar conteúdo via RLS.
// O banco limita a 1–30 dias: sem teto, um admin suspendia até o ano 2126 e
// virava banimento permanente pulando a hierarquia do ban.
export async function applySuspension(userId, days) {
  return from(await supabase.rpc('apply_suspension', { p_user_id: userId, p_days: days }));
}

// A reversão que não existia. Sem ela a suspensão era irreversível: o
// trigger-guarda de `profiles` reverte UPDATE direto em silêncio, então nem o
// fundador conseguia desfazer um engano.
export async function liftSuspension(userId, note) {
  return from(await supabase.rpc('lift_suspension', {
    p_user_id: userId,
    p_note: note?.trim() || null,
  }));
}

export async function addViolation({ userId, contentType, contentId, reason, actionTaken, points, notes }) {
  const reviewerId = (await supabase.auth.getUser()).data.user?.id;
  return from(await supabase.from('violations').insert({
    user_id: userId,
    content_type: contentType || null,
    content_id: contentId || null,
    reason: reason || null,
    action_taken: actionTaken,
    points: points ?? 1,
    reviewed_by: reviewerId,
    notes: notes?.trim() || null,
  }));
}

// ─── Moderação IA (Fases 2 e 3 — OpenAI omni-moderation) ────────────────────

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

// Fire-and-forget: texto — não bloqueia o fluxo do usuário.
//
// O `text` NÃO vai mais no corpo: a Edge Function lê o texto direto da linha no
// banco. Mandar o texto daqui era um buraco — bastava enviar o `content_id` de
// um post alheio junto de uma frase ofensiva qualquer para derrubar o post de
// outra pessoa. O parâmetro continua aqui só como guarda de "não tem o que
// moderar" antes de gastar uma chamada.
export async function moderateText(contentType, contentId, text) {
  if (!text?.trim()) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId }),
  }).catch(() => {});
}

// Fire-and-forget: link — Google Safe Browsing (não bloqueia o fluxo).
export async function moderateLinks(contentType, contentId, url) {
  if (!url?.trim()) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId, url }),
  }).catch(() => {});
}

/**
 * Fire-and-forget: vídeos, por amostragem de quadros.
 *
 * Vídeo era o único tipo de mídia que subia sem nenhuma checagem. Aqui alguns
 * quadros são extraídos no navegador e mandados **embutidos** para a mesma
 * Edge Function que analisa imagem — reaproveitando a cobertura que ela já tem
 * de nudez, gore e automutilação, por custo de imagem e não de vídeo.
 *
 * `extrairQuadros` é importado sob demanda: ele só existe para quem publica
 * vídeo, e não tem por que pesar no carregamento de quem só lê o feed (§0.3).
 *
 * **Lista vazia é "não analisado", nunca "analisado e limpo".** Por isso o
 * `registrarErro`: sem ele, um vídeo que a extração não conseguisse abrir
 * passaria em silêncio absoluto — nada na tela, nada no log, nenhum teste
 * quebrando (§1.5). É exatamente a forma de falha que manteve a moderação por
 * IA quebrada em 26 de 26 chamadas por semanas.
 */
export async function moderateVideos(contentType, contentId, videoFiles) {
  // `[28/08]` DEVOLVE ESTADO, e o motivo é um buraco real.
  //
  // O dono postou um vídeo às 22:20 e a moderação **não rodou**. A prova está
  // no log da Supabase: `moderate-text` foi chamada para aquele post e
  // `moderate-image` não foi chamada nenhuma vez — ou seja, a falha aconteceu
  // no navegador, antes da rede, e não deixou rastro em lugar nenhum que a
  // gente olhe.
  //
  // A causa mais provável é `extrairQuadros` devolver lista vazia (codec que o
  // `<canvas>` não abre). Mas "mais provável" não basta: o `registrarErro`
  // manda para o Sentry, que é onde ninguém olhou, enquanto TODO o resto da
  // moderação grita em `admin_logs`. Falha silenciosa clássica (§1.5).
  //
  // Não dá para gritar em `admin_logs` daqui: a RPC que registra é
  // `service_role`, e abrir um canal de log chamável pelo cliente seria repetir
  // o erro do `register_login_attempt` — qualquer um forjaria entradas. Então a
  // saída é o outro canal do §1.5: **quem publicou fica sabendo**, e o
  // resultado passa a ser inspecionável por quem chama.
  const resumo = { videos: videoFiles?.length ?? 0, analisados: 0, semQuadros: 0 };
  if (!videoFiles?.length) return resumo;

  const auth = await getAuthHeader();
  if (!auth) return { ...resumo, erro: 'sem_sessao' };

  const { extrairQuadros } = await import('../lib/framesDeVideo');

  for (const arquivo of videoFiles) {
    const { quadros, motivo } = await extrairQuadros(arquivo);
    if (!quadros.length) {
      resumo.semQuadros++;
      // O motivo entra no texto do erro, e não só nos metadados: o Sentry
      // agrupa por mensagem, então "não consegui extrair quadros" jogava
      // causas diferentes na mesma pilha. Separadas, dá para ver qual delas
      // acontece de verdade — que é a pergunta que ficou aberta em 28/08.
      resumo.motivos = [...(resumo.motivos ?? []), motivo];
      registrarErro(new Error(`nao consegui extrair quadros de um video: ${motivo}`), {
        content_type: contentType, content_id: contentId,
        tipo_do_arquivo: arquivo?.type, tamanho: arquivo?.size, motivo,
      });
      continue;
    }
    resumo.analisados++;
    fetch(`${SUPABASE_URL}/functions/v1/moderate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
      body: JSON.stringify({ content_type: contentType, content_id: contentId, image_urls: quadros }),
    }).catch(() => {});
  }
  return resumo;
}

// Fire-and-forget: imagens (apenas URLs de imagem; vídeo vai por `moderateVideos`).
export async function moderateImages(contentType, contentId, imageUrls) {
  if (!imageUrls?.length) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId, image_urls: imageUrls }),
  }).catch(() => {});
}

// ─── Hide / Restore (ação direta do admin) ───────────────────────────────────

// `count: 'exact'` + checagem de 0 linhas: sem isso o RLS negando a operação
// virava "sucesso" silencioso. Foi exatamente o que escondeu, por muito tempo,
// o fato de `comments` e `community_posts` não terem policy de UPDATE nenhuma —
// o painel dizia "ocultado" e nada acontecia.
// Mapa explícito em vez de `else → community_posts`: a fila recebe itens de
// `chat` (o trigger da lista de palavras enfileira mensagem de live), e o
// fallback silencioso mandava esse item para `community_posts`, onde o id nunca
// existe — o painel respondia "sem permissão" para um caso que é, na verdade,
// "esta tabela não tem como ocultar".
const TABELA_POR_TIPO = { post: 'posts', comment: 'comments', mural: 'community_posts' };

async function setHiddenAt(contentType, contentId, value) {
  const table = TABELA_POR_TIPO[contentType];
  if (!table) {
    return fail({ message: 'Mensagem de chat não pode ser ocultada — apague pela própria live.' });
  }
  const { error, count } = await supabase
    .from(table)
    .update({ hidden_at: value }, { count: 'exact' })
    .eq('id', contentId);
  return fromCount({ error, count }, 'Você não tem permissão para moderar este conteúdo.');
}

export function hideContent(contentType, contentId) {
  return setHiddenAt(contentType, contentId, new Date().toISOString());
}

export function restoreContent(contentType, contentId) {
  return setHiddenAt(contentType, contentId, null);
}
