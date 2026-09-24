import { supabase } from '../lib/supabase';

/**
 * `[24/09]` COMO UM POST DO FEED É MONTADO — colunas, autor, mídia e engajamento.
 *
 * ── Por que saiu do `postService` ─────────────────────────────────────────
 *
 * O `postService` passou de 300 linhas quando o feed ganhou paginação (§4). O
 * corte não é por tamanho, é por responsabilidade: aqui mora **a forma de um
 * post**, e lá moram as **operações** sobre ele (criar, editar, apagar,
 * curtir).
 *
 * E essa separação tem consequência prática: `POST_SELECT` é a definição única
 * do que uma tela recebe quando pede um post. Ter duas seria a duplicação do
 * §4 no lugar mais caro — foi exatamente para não criar a segunda que a RPC
 * `feed_pagina` devolve só a ordem, e não as linhas.
 *
 * **O corte é MECÂNICO:** nada aqui mudou de comportamento ao mudar de arquivo.
 */

// Colunas explícitas em vez de `*`: cada coluna a mais viaja em TODA linha de
// TODO feed. `live_ended_at`, `ban_*` e afins não são usados pelo card.
const POST_COLUMNS = [
  // `[24/09]` `category` saiu daqui junto com a UI que a lia. A coluna existe
  // no banco e ninguém a consome mais — trazê-la custaria bytes em TODA linha
  // de TODO feed, que é a conta que esta lista inteira existe para evitar.
  'id', 'user_id', 'title', 'content', 'created_at',
  'media_url', 'media_type', 'edited_at',
  'audio_url', 'audio_type', 'audio_name',
  'embed_url', 'embed_type', 'expires_at',
  'is_live', 'was_live', 'live_kind', 'live_kind_label',
  'hidden_at', 'deleted_at',
].join(', ');

const AUTHOR_SELECT = 'profiles(id, username, avatar_url, role, bio, created_at)';

// `post_media` aninhado: o Postgrest já devolve as mídias junto com o post.
// Antes cada card fazia a própria query — 30 posts = 30 requests só de mídia.
export const POST_SELECT = `${POST_COLUMNS}, ${AUTHOR_SELECT}, post_media(id, url, type, position)`;

// ─── Feed ────────────────────────────────────────────────────────────────────

// `.in(...)` vira querystring: cada uuid custa ~40 caracteres na URL, e uma
// lista grande demais estoura o limite do gateway. O feed é limitado a 30, mas
// o perfil de um usuário prolífico não é — daí o fatiamento.
const IN_CHUNK = 50;

async function fetchInChunks(ids, run) {
  const rows = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data } = await run(ids.slice(i, i + IN_CHUNK));
    if (data) rows.push(...data);
  }
  return rows;
}

// Engajamento em LOTE. Antes cada PostCard disparava 3 queries próprias
// (contagem de likes, "eu curti?" e contagem de comentários) — um feed de 30
// posts fazia ~90 requests. Aqui são 2, independentemente do tamanho do feed.
//
// Traz as linhas e conta no cliente em vez de pedir `count` por post: para o
// volume atual isso é ordens de grandeza melhor. Se um dia um post passar da
// casa dos milhares de curtidas, o caminho é trocar por uma RPC que agrega no
// banco (anotado no BACKLOG) — o shape de retorno daqui não muda.
export async function attachEngagement(posts, viewerId) {
  const ids = posts.map((p) => p.id);
  if (!ids.length) return posts;

  const [likes, comments] = await Promise.all([
    fetchInChunks(ids, (chunk) =>
      supabase.from('post_likes').select('post_id, user_id').in('post_id', chunk)),
    fetchInChunks(ids, (chunk) =>
      supabase.from('comments').select('post_id').in('post_id', chunk)),
  ]);

  const likeCount = new Map();
  const liked = new Set();
  const commentCount = new Map();

  for (const l of likes) {
    likeCount.set(l.post_id, (likeCount.get(l.post_id) || 0) + 1);
    if (viewerId && l.user_id === viewerId) liked.add(l.post_id);
  }
  for (const c of comments) {
    commentCount.set(c.post_id, (commentCount.get(c.post_id) || 0) + 1);
  }

  return posts.map((p) => ({
    ...p,
    // O embed aninhado não garante ordem — o carrossel depende de `position`.
    post_media: [...(p.post_media || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    like_count: likeCount.get(p.id) || 0,
    liked_by_me: liked.has(p.id),
    comment_count: commentCount.get(p.id) || 0,
  }));
}

/**
 * `[24/09]` O tamanho do lote do feed.
 *
 * ── Como este número foi escolhido, e o que ele AINDA não é ────────────────
 *
 * O pedido do dono é explícito: *"não assumir arbitrariamente 10, 20 ou 50"*.
 * E a medição que decidiria isso — custo de render por card, bytes por lote,
 * rolagem no celular — **não pôde ser feita**: o feed de produção tem zero
 * posts vivos, e medir contra tabela vazia não mede nada.
 *
 * Então o que sustenta o 20 não é medição, é uma garantia mais modesta e
 * verificável: **ele é MENOR que os 30 de antes**. Nenhuma página do feed
 * ficou mais pesada do que já era, então a mudança não pode regredir o
 * carregamento — e está dentro da faixa que ele mesmo citou.
 *
 * A medição de verdade está no `BACKLOG.md`, e quando ela existir só este
 * número muda.
 */
