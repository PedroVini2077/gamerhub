import { supabase } from '../lib/supabase';

const MURAL_SELECT = '*, profiles(id, username, avatar_url, role, bio, created_at)';

// ─── Posts ─────────────────────────────────────────────────────────────────

// Paginação por keyset (created_at < cursor) — escala melhor que offset em
// listas grandes. `before` = created_at do último item da página anterior.
export async function fetchMuralPage({ limit = 20, before = null }) {
  let q = supabase
    .from('community_posts')
    .select(MURAL_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) q = q.lt('created_at', before);
  const { data } = await q;
  return data || [];
}

export async function addMuralPost({ userId, message }) {
  return supabase
    .from('community_posts')
    .insert({ user_id: userId, message })
    .select()
    .single();
}

export async function deleteMuralPost(id, userId, isAdmin) {
  let q = supabase.from('community_posts').delete({ count: 'exact' }).eq('id', id);
  if (!isAdmin) q = q.eq('user_id', userId);
  const { error, count } = await q;
  if (error) return { error };
  // count 0 sem erro = RLS bloqueou (ex.: admin tentando moderar owner). Antes
  // virava "sucesso" falso.
  if (!count) return { error: { message: 'Você não tem permissão para deletar isto.' } };
  return { error: null };
}

// ─── Mídia ───────────────────────────────────────────────────────────────────

export async function fetchMuralMedia(postId) {
  const { data } = await supabase
    .from('community_post_media')
    .select('*')
    .eq('post_id', postId)
    .order('position');
  return data || [];
}

// Reaproveita o bucket público `post-media` (mesmo do feed), em path por
// usuário pra casar com as policies de storage já existentes.
export async function uploadMuralMediaFiles(userId, postId, medias) {
  const rows = [];
  const imageUrls = [];
  for (let i = 0; i < medias.length; i++) {
    const { file, type } = medias[i];
    const ext = file.name.split('.').pop();
    const path = `${userId}/community-${postId}-${i}.${ext}`;
    await supabase.storage.from('post-media').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
    rows.push({ post_id: postId, url: publicUrl, type, position: i });
    imageUrls.push(publicUrl);
  }
  const result = await supabase.from('community_post_media').insert(rows);
  return { ...result, imageUrls };
}

// ─── Reações (curtidas) ────────────────────────────────────────────────────────

export async function fetchMuralLikeStatus(postId, userId) {
  const [{ count }, { data: liked }] = await Promise.all([
    supabase.from('community_post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    userId
      ? supabase.from('community_post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { count: count || 0, liked: !!liked };
}

export async function likeMuralPost(postId, userId) {
  return supabase.from('community_post_likes').insert({ post_id: postId, user_id: userId });
}

export async function unlikeMuralPost(postId, userId) {
  return supabase.from('community_post_likes').delete().eq('post_id', postId).eq('user_id', userId);
}
