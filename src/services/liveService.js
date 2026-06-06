import { supabase } from '../lib/supabase';

export async function fetchLiveMessages(postId) {
  const { data } = await supabase
    .from('live_chat')
    .select('id, message, created_at, user_id, profiles(id, username, avatar_url, role, bio, created_at)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  return data || [];
}

export async function fetchLiveTimeouts(postId) {
  const { data } = await supabase.from('live_chat_timeouts').select('*').eq('post_id', postId);
  const map = {};
  (data || []).forEach(t => { map[t.user_id] = t; });
  return map;
}

export async function sendChatMessage({ postId, userId, message }) {
  return supabase.from('live_chat').insert({ post_id: postId, user_id: userId, message });
}

export async function deleteChatMessage(messageId, isMod, userId) {
  let q = supabase.from('live_chat').delete().eq('id', messageId);
  if (!isMod) q = q.eq('user_id', userId);
  return q;
}

export async function silenceUser({ postId, userId, minutes, createdBy }) {
  const expires = new Date(Date.now() + minutes * 60000).toISOString();
  await supabase.from('live_chat_timeouts').delete().eq('post_id', postId).eq('user_id', userId);
  return supabase.from('live_chat_timeouts').insert({
    post_id: postId,
    user_id: userId,
    expires_at: expires,
    created_by: createdBy,
  });
}

export async function unsilenceUser({ postId, userId }) {
  return supabase.from('live_chat_timeouts').delete().eq('post_id', postId).eq('user_id', userId);
}
