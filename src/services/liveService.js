import { supabase } from '../lib/supabase';
import { ok, fail, from } from './result';

export async function fetchLiveMessages(postId) {
  const { data, error } = await supabase
    .from('live_chat')
    .select('id, message, created_at, user_id, profiles(id, username, avatar_url, role, bio, created_at)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return fail(error, []);
  return ok(data || []);
}

export async function fetchLiveTimeouts(postId) {
  const { data, error } = await supabase.from('live_chat_timeouts').select('*').eq('post_id', postId);
  if (error) return fail(error, {});
  const map = {};
  (data || []).forEach(t => { map[t.user_id] = t; });
  return ok(map);
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
  if (error) return fail(error);
  return ok(data?.id ?? null);
}

export async function deleteChatMessage(messageId, isMod, userId) {
  let q = supabase.from('live_chat').delete({ count: 'exact' }).eq('id', messageId);
  if (!isMod) q = q.eq('user_id', userId);
  const { error, count } = await q;
  if (error) return fail(error);
  if (count) return ok(count);

  // 0 linhas sem erro pode ser DUAS coisas muito diferentes: a RLS negou, ou a
  // mensagem já não existe — outro moderador apagou, ou a lista da tela está
  // velha. Dizer "sem permissão" nos dois casos é mentira metade das vezes, e
  // foi exatamente o que apareceu ao apagar pelo painel uma mensagem que já
  // tinha sido apagada: parecia falta de permissão do próprio autor.
  //
  // O SELECT de `live_chat` é público, então esta checagem é confiável.
  const { data } = await supabase.from('live_chat').select('id').eq('id', messageId).maybeSingle();
  if (!data) return ok(0); // já não existe: o objetivo do moderador foi atingido
  return fail({ message: 'Você não tem permissão para deletar esta mensagem.' });
}

export async function silenceUser({ postId, userId, minutes, createdBy }) {
  const expires = new Date(Date.now() + minutes * 60000).toISOString();
  await supabase.from('live_chat_timeouts').delete().eq('post_id', postId).eq('user_id', userId);
  return from(await supabase.from('live_chat_timeouts').insert({
    post_id: postId,
    user_id: userId,
    expires_at: expires,
    created_by: createdBy,
  }));
}

export async function unsilenceUser({ postId, userId }) {
  return from(await supabase.from('live_chat_timeouts').delete().eq('post_id', postId).eq('user_id', userId));
}
