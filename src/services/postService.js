import { supabase } from '../lib/supabase';
import { getEmbedInfo } from '../lib/embed';

import { ok, fail, from, fromCount } from './result';
import { compressMedias } from '../lib/image';

// Colunas explícitas em vez de `*`: cada coluna a mais viaja em TODA linha de
// TODO feed. `live_ended_at`, `ban_*` e afins não são usados pelo card.
const POST_COLUMNS = [
  'id', 'user_id', 'title', 'content', 'category', 'created_at',
  'media_url', 'media_type', 'edited_at',
  'audio_url', 'audio_type', 'audio_name',
  'embed_url', 'embed_type', 'expires_at',
  'is_live', 'was_live', 'live_kind', 'live_kind_label',
  'hidden_at', 'deleted_at',
].join(', ');

const AUTHOR_SELECT = 'profiles(id, username, avatar_url, role, bio, created_at)';

// `post_media` aninhado: o Postgrest já devolve as mídias junto com o post.
// Antes cada card fazia a própria query — 30 posts = 30 requests só de mídia.
const POST_SELECT = `${POST_COLUMNS}, ${AUTHOR_SELECT}, post_media(id, url, type, position)`;

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
async function attachEngagement(posts, viewerId) {
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

export async function fetchFeedPosts(limit = 30, viewerId = null) {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .is('live_kind', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return fail(error, []);
  return ok(await attachEngagement(data || [], viewerId));
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
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .not('embed_url', 'is', null)
    .order('created_at', { ascending: false });
  if (error) return fail(error, []);
  return ok(data || []);
}

// ─── Post CRUD ───────────────────────────────────────────────────────────────

export async function createPost({ userId, title, content, category, audioUrl, audioType, audioName, embedUrl, isLive, liveKind, liveKindLabel }) {
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
    was_live: isLive,
    expires_at: null,
    // Tipo de live de jogador (null = post/live comum). Rótulo só faz sentido
    // quando "outro".
    live_kind: liveKind || null,
    live_kind_label: liveKind === 'outro' ? (liveKindLabel?.trim() || null) : null,
  }).select().single());
}

export async function updatePost(postId, { content, isLive, wasLive }, userId, isAdmin) {
  let q = supabase.from('posts').update({
    content: content?.trim() || null,
    is_live: isLive,
    was_live: wasLive,
    edited_at: new Date().toISOString(),
  }).eq('id', postId);
  if (!isAdmin) q = q.eq('user_id', userId);
  return from(await q);
}

export async function softDeletePost(postId) {
  return from(await supabase.rpc('soft_delete_post', { p_post_id: postId }));
}



export async function endLivePost(postId) {
  return from(await supabase.from('posts').update({ is_live: false }).eq('id', postId));
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
  return from(await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId));
}

// ─── Media ───────────────────────────────────────────────────────────────────

export async function fetchPostMedia(postId) {
  const { data, error } = await supabase.from('post_media').select('*').eq('post_id', postId).order('position');
  if (error) return fail(error, []);
  return ok(data || []);
}

export async function uploadAudio(userId, audioFile) {
  const ext = audioFile.name.split('.').pop();
  const path = `${userId}/audio-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('post-media').upload(path, audioFile, { contentType: audioFile.type, cacheControl: '31536000' });
  if (error) return fail(error);
  const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
  return ok(publicUrl);
}

export async function uploadPostMediaFiles(userId, postId, medias) {
  const rows = [];
  const imageUrls = [];
  // Comprime ANTES de subir: o arquivo no bucket é o que o CDN serve a cada
  // view. Vídeo/áudio passam intactos.
  const prepared = await compressMedias(medias);
  let failed = 0;
  for (let i = 0; i < prepared.length; i++) {
    const { file, type } = prepared[i];
    const ext = file.name.split('.').pop();
    const path = `${userId}/${postId}-${i}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('post-media')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    // O erro do upload era ignorado: a linha ia pro banco mesmo assim e o post
    // ficava com uma imagem quebrada pra sempre, apontando pra um arquivo que
    // nunca existiu. Agora a mídia que falhou simplesmente não é registrada.
    if (uploadError) { failed++; continue; }
    const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
    rows.push({ post_id: postId, url: publicUrl, type, position: i });
    if (type === 'image') imageUrls.push(publicUrl);
  }
  const carga = { imageUrls, failed };
  if (!rows.length) {
    return failed ? { data: carga, error: { message: 'Falha ao enviar a mídia.' } } : ok(carga);
  }
  const { error } = await supabase.from('post_media').insert(rows);
  return error ? { data: carga, error } : ok(carga);
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) return fail(error, []);
  return ok(data || []);
}

export async function fetchCommentCount(postId) {
  const { count, error } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  if (error) return fail(error, 0);
  return ok(count || 0);
}

export async function addComment({ postId, userId, content, parentId = null }) {
  return from(await supabase.from('comments')
    .insert({ post_id: postId, user_id: userId, content, parent_id: parentId })
    .select('id').single());
}

export async function deleteComment(commentId, userId, isAdmin) {
  let q = supabase.from('comments').delete({ count: 'exact' }).eq('id', commentId);
  if (!isAdmin) q = q.eq('user_id', userId);
  return fromCount(await q, 'Você não tem permissão para deletar isto.');
}

// ─── Curtidas em comentários ───────────────────────────────────────────────────

export async function fetchCommentLikeStatus(commentId, userId) {
  const [{ count }, { data: liked }] = await Promise.all([
    supabase.from('comment_likes').select('*', { count: 'exact', head: true }).eq('comment_id', commentId),
    userId
      ? supabase.from('comment_likes').select('id').eq('comment_id', commentId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return ok({ count: count || 0, liked: !!liked });
}

export async function likeComment(commentId, userId) {
  return from(await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId }));
}

export async function unlikeComment(commentId, userId) {
  return from(await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId));
}
