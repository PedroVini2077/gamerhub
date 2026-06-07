import { useState, useEffect } from 'react';
import { useAuth } from './useAuth.jsx';
import { fetchCommentLikeStatus, likeComment, unlikeComment } from '../services/postService';
import toast from 'react-hot-toast';

export function useCommentLike(commentId) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count: c, liked: isLiked } = await fetchCommentLikeStatus(commentId, user?.id);
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
    if (liked) {
      await unlikeComment(commentId, user.id);
      setLiked(false); setCount(c => c - 1);
    } else {
      await likeComment(commentId, user.id);
      setLiked(true); setCount(c => c + 1);
    }
    setLoading(false);
  }

  return { liked, count, loading, toggle };
}
