/**
 * Comentários e curtidas de comentário.
 *
 * ── Por que saiu do `postService.js` ────────────────────────────────────────
 *
 * O `postService` passou de 300 linhas ao ganhar o `fetchPostById` (§4), e o
 * corte já estava desenhado: comentário é um domínio próprio, com tabelas
 * próprias (`comments`, `comment_likes`) e ciclo de vida próprio. O que sobra
 * no `postService` é o post em si — feed, CRUD, curtidas e mídia.
 *
 * Movimentação mecânica: nenhum comportamento mudou.
 */
import { supabase } from '../lib/supabase';
import { ok, fail, from, fromCount } from './result';

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
