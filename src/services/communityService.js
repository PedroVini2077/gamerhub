import { supabase } from '../lib/supabase';

export async function fetchMuralPosts(limit = 50) {
  const { data } = await supabase
    .from('community_posts')
    .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function addMuralPost({ userId, message }) {
  return supabase.from('community_posts').insert({ user_id: userId, message });
}

export async function deleteMuralPost(id, userId, isAdmin) {
  let q = supabase.from('community_posts').delete().eq('id', id);
  if (!isAdmin) q = q.eq('user_id', userId);
  return q;
}
