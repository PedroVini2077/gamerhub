import { supabase } from '../lib/supabase';

export async function fetchProfileByUsername(username) {
  const { data } = await supabase.from('profiles').select('*').eq('username', username).single();
  return data || null;
}

export async function fetchUserXP(userId) {
  const { data } = await supabase.rpc('get_user_xp', { p_user_id: userId });
  return data || null;
}

export async function fetchUserLikesCount(userId) {
  const { data: posts } = await supabase.from('posts').select('id').eq('user_id', userId);
  const ids = posts?.map(p => p.id) || [];
  if (ids.length === 0) return 0;
  const { count } = await supabase
    .from('post_likes')
    .select('*', { count: 'exact', head: true })
    .in('post_id', ids);
  return count || 0;
}

export async function fetchProfileStats(userId) {
  const [{ data: postsData }, { data: xp }] = await Promise.all([
    supabase.from('posts').select('likes').eq('user_id', userId),
    supabase.rpc('get_user_xp', { p_user_id: userId }),
  ]);
  const likes = (postsData || []).reduce((s, p) => s + (p.likes || 0), 0);
  return { posts: postsData?.length || 0, likes, xp: xp || null };
}

export async function updateProfile(userId, fields) {
  return supabase.from('profiles').update(fields).eq('id', userId);
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { url: null, error };
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  return { url: publicUrl + `?t=${Date.now()}`, error: null };
}

export async function updateNotifPrefs(userId, { notifLikes, notifComments }) {
  return supabase.from('profiles').update({
    notif_likes: notifLikes,
    notif_comments: notifComments,
  }).eq('id', userId);
}
