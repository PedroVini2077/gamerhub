import { supabase } from '../lib/supabase';
import { getEmbedInfo } from '../lib/embed';

const POST_SELECT = '*, profiles(id, username, avatar_url, role, bio, created_at), user_id, audio_url, audio_type, audio_name, edited_at, embed_url, embed_type, is_live, expires_at';

// ─── Feed ────────────────────────────────────────────────────────────────────

export async function fetchFeedPosts(limit = 30) {
  const { data } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function fetchUserPosts(userId) {
  const { data } = await supabase
    .from('posts')
    .select('*, profiles(username, avatar_url), user_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function fetchActiveLives() {
  const { data } = await supabase
    .from('posts')
    .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
    .eq('is_live', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .not('embed_url', 'is', null)
    .order('created_at', { ascending: false });
  return data || [];
}

// ─── Post CRUD ───────────────────────────────────────────────────────────────

export async function createPost({ userId, title, content, category, audioUrl, audioType, audioName, embedUrl, isLive }) {
  const embedInfo = embedUrl ? getEmbedInfo(embedUrl) : null;
  return supabase.from('posts').insert({
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
  }).select().single();
}

export async function updatePost(postId, { content, isLive, wasLive }, userId, isAdmin) {
  let q = supabase.from('posts').update({
    content: content?.trim() || null,
    is_live: isLive,
    was_live: wasLive,
    edited_at: new Date().toISOString(),
  }).eq('id', postId);
  if (!isAdmin) q = q.eq('user_id', userId);
  return q;
}

export async function deletePost(postId, userId, isAdmin) {
  let q = supabase.from('posts').delete().eq('id', postId);
  if (!isAdmin) q = q.eq('user_id', userId);
  return q;
}

export async function endLivePost(postId) {
  return supabase.from('posts').update({ is_live: false }).eq('id', postId);
}

// ─── Likes ───────────────────────────────────────────────────────────────────

export async function fetchLikeStatus(postId, userId) {
  const [{ count }, { data: liked }] = await Promise.all([
    supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    userId
      ? supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { count: count || 0, liked: !!liked };
}

export async function likePost(postId, userId) {
  return supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
}

export async function unlikePost(postId, userId) {
  return supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
}

// ─── Media ───────────────────────────────────────────────────────────────────

export async function fetchPostMedia(postId) {
  const { data } = await supabase.from('post_media').select('*').eq('post_id', postId).order('position');
  return data || [];
}

export async function uploadAudio(userId, audioFile) {
  const ext = audioFile.name.split('.').pop();
  const path = `${userId}/audio-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('post-media').upload(path, audioFile, { contentType: audioFile.type });
  if (error) return { url: null, error };
  const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
  return { url: publicUrl, error: null };
}

export async function uploadPostMediaFiles(userId, postId, medias) {
  const rows = [];
  for (let i = 0; i < medias.length; i++) {
    const { file, type } = medias[i];
    const ext = file.name.split('.').pop();
    const path = `${userId}/${postId}-${i}.${ext}`;
    await supabase.storage.from('post-media').upload(path, file, { contentType: file.type });
    const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path);
    rows.push({ post_id: postId, url: publicUrl, type, position: i });
  }
  return supabase.from('post_media').insert(rows);
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function fetchComments(postId) {
  const { data } = await supabase
    .from('comments')
    .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function fetchCommentCount(postId) {
  const { count } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  return count || 0;
}

export async function addComment({ postId, userId, content }) {
  return supabase.from('comments').insert({ post_id: postId, user_id: userId, content });
}

export async function deleteComment(commentId, userId, isAdmin) {
  let q = supabase.from('comments').delete().eq('id', commentId);
  if (!isAdmin) q = q.eq('user_id', userId);
  return q;
}
