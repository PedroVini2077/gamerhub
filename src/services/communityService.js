import { supabase } from '../lib/supabase';
import { removeFilesFromStorage } from '../lib/storage';
import { compressMedias } from '../lib/image';
import { ok, fail, from, fromCount } from './result';

// Colunas explícitas + mídia aninhada: evita `*` e mata a query de mídia por
// card (20 posts = 20 requests a menos por página).
const MURAL_SELECT =
  'id, user_id, message, created_at, hidden_at, ' +
  'profiles(id, username, avatar_url, role, bio, created_at), ' +
  'community_post_media(id, url, type, position)';

// ─── Posts ─────────────────────────────────────────────────────────────────

// Curtidas do mural em lote — 1 query por página em vez de 2 por card.
async function attachMuralEngagement(items, viewerId) {
  const ids = items.map((i) => i.id);
  if (!ids.length) return items;

  const { data: likes } = await supabase
    .from('community_post_likes')
    .select('post_id, user_id')
    .in('post_id', ids);

  const count = new Map();
  const liked = new Set();
  for (const l of likes || []) {
    count.set(l.post_id, (count.get(l.post_id) || 0) + 1);
    if (viewerId && l.user_id === viewerId) liked.add(l.post_id);
  }

  return items.map((i) => ({
    ...i,
    community_post_media: [...(i.community_post_media || [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    like_count: count.get(i.id) || 0,
    liked_by_me: liked.has(i.id),
  }));
}

// Paginação por keyset (created_at < cursor) — escala melhor que offset em
// listas grandes. `before` = created_at do último item da página anterior.
export async function fetchMuralPage({ limit = 20, before = null, viewerId = null }) {
  let q = supabase
    .from('community_posts')
    .select(MURAL_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) return fail(error, []);
  return ok(await attachMuralEngagement(data || [], viewerId));
}

export async function addMuralPost({ userId, message }) {
  return from(await supabase
    .from('community_posts')
    .insert({ user_id: userId, message })
    .select()
    .single());
}

export async function deleteMuralPost(id, userId, isAdmin) {
  // Coleta as URLs de mídia ANTES do delete — somem no cascade e o arquivo
  // ficaria órfão eterno no Storage.
  const { data: media } = await supabase.from('community_post_media').select('url').eq('post_id', id);
  let q = supabase.from('community_posts').delete({ count: 'exact' }).eq('id', id);
  if (!isAdmin) q = q.eq('user_id', userId);
  // count 0 sem erro = RLS bloqueou (ex.: admin tentando moderar owner). Antes
  // virava "sucesso" falso.
  const res = fromCount(await q, 'Você não tem permissão para deletar isto.');
  if (res.error) return res;
  await removeFilesFromStorage((media || []).map((m) => m.url));
  return res;
}

// ─── Mídia ───────────────────────────────────────────────────────────────────

export async function fetchMuralMedia(postId) {
  const { data, error } = await supabase
    .from('community_post_media')
    .select('*')
    .eq('post_id', postId)
    .order('position');
  if (error) return fail(error, []);
  return ok(data || []);
}

// Reaproveita o bucket público `post-media` (mesmo do feed), em path por
// usuário pra casar com as policies de storage já existentes.
export async function uploadMuralMediaFiles(userId, postId, medias) {
  const rows = [];
  const imageUrls = [];
  // Mesma regra do feed: comprime antes de gravar no bucket.
  const prepared = await compressMedias(medias);
  let failed = 0;
  for (let i = 0; i < prepared.length; i++) {
    const { file, type } = prepared[i];
    const ext = file.name.split('.').pop();
    const path = `${userId}/community-${postId}-${i}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('post-media')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    // Mesma correção do feed: sem checar o erro, a linha entrava no banco e a
    // mensagem ficava com imagem quebrada apontando pra um arquivo inexistente.
    if (uploadError) { failed++; continue; }
    const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
    rows.push({ post_id: postId, url: publicUrl, type, position: i });
    imageUrls.push(publicUrl);
  }
  const carga = { imageUrls, failed };
  if (!rows.length) {
    return failed ? { data: carga, error: { message: 'Falha ao enviar a imagem.' } } : ok(carga);
  }
  const { error } = await supabase.from('community_post_media').insert(rows);
  return error ? { data: carga, error } : ok(carga);
}

// ─── Reações (curtidas) ────────────────────────────────────────────────────────

// Fallback por card — a listagem do mural já traz os contadores em lote.
export async function fetchMuralLikeStatus(postId, userId) {
  const [{ count }, { data: liked }] = await Promise.all([
    supabase.from('community_post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    userId
      ? supabase.from('community_post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return ok({ count: count || 0, liked: !!liked });
}

export async function likeMuralPost(postId, userId) {
  return from(await supabase.from('community_post_likes').insert({ post_id: postId, user_id: userId }));
}

export async function unlikeMuralPost(postId, userId) {
  return from(await supabase.from('community_post_likes')
    .delete().eq('post_id', postId).eq('user_id', userId));
}
