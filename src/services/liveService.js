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

// Devolve o `id` da mensagem criada porque a moderação de IA precisa dele para
// enfileirar a mensagem para revisão. O `error` é devolvido junto de propósito:
// antes esta função descartava a resposta inteira e uma recusa da RLS (usuário
// suspenso, live encerrada) sumia em silêncio — o campo limpava e a pessoa
// achava que tinha enviado.
export async function sendChatMessage({ postId, userId, message }) {
  const { data, error } = await supabase
    .from('live_chat')
    .insert({ post_id: postId, user_id: userId, message })
    .select('id')
    .single();
  return { id: data?.id ?? null, error };
}

export async function deleteChatMessage(messageId, isMod, userId) {
  let q = supabase.from('live_chat').delete({ count: 'exact' }).eq('id', messageId);
  if (!isMod) q = q.eq('user_id', userId);
  const { error, count } = await q;
  if (error) return { error };
  if (!count) return { error: { message: 'Você não tem permissão para deletar isto.' } };
  return { error: null };
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
