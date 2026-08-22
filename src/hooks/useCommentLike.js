import { useState, useEffect } from 'react';
import { useAuth } from './useAuth.jsx';
import { fetchCommentLikeStatus, likeComment, unlikeComment } from '../services/postService';
import { runLikeToggle } from '../lib/like';
import toast from 'react-hot-toast';

export function useCommentLike(commentId) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { count: c, liked: isLiked } = {} } = await fetchCommentLikeStatus(commentId, user?.id);
      if (cancelled) return;
      setCount(c);
      setLiked(isLiked);
    })();
    return () => { cancelled = true; };
  }, [commentId, user?.id]);

  async function toggle() {
    if (!user) { toast.error('Faça login para curtir!'); return; }
    if (loading) return;
    setLoading(true);
    await runLikeToggle({
      liked,
      like:   () => likeComment(commentId, user.id),
      unlike: () => unlikeComment(commentId, user.id),
      apply:  () => { setLiked(!liked); setCount(c => (liked ? Math.max(0, c - 1) : c + 1)); },
      revert: () => { setLiked(liked);  setCount(c => (liked ? c + 1 : Math.max(0, c - 1))); },
    });
    setLoading(false);
  }

  return { liked, count, loading, toggle };
}
