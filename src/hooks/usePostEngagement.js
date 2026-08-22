import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchLikeStatus, likePost, unlikePost, fetchPostMedia } from '../services/postService';
import { runLikeToggle } from '../lib/like';

// Mídia sobe DEPOIS do post (upload assíncrono). Enquanto o post é novo, vale
// tentar de novo algumas vezes antes de desistir.
const RETRY_DELAYS = [1000, 2000, 4000, 8000];
const RETRY_WINDOW_SECONDS = 60;

/**
 * Curtidas e mídia de um post.
 *
 * O feed e o perfil já trazem tudo em lote (`attachEngagement` no
 * postService). Quando vem em lote, este hook NÃO dispara query nenhuma —
 * antes eram 3 por card, ~90 num feed de 30 posts. O fallback de busca só
 * roda onde o post chega solto (painel admin, moderação).
 */
export function usePostEngagement({ post, userId }) {
  const batchedLikes = typeof post.like_count === 'number';
  const batchedMedia = Array.isArray(post.post_media) ? post.post_media : null;

  const [liked, setLiked] = useState(!!post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [postMedia, setPostMedia] = useState(batchedMedia ?? []);

  const retryRef = useRef(null);

  useEffect(() => {
    // Guarda de cancelamento: impede setState após desmontar ou troca de post,
    // evitando que uma resposta antiga sobrescreva a atual.
    let cancelled = false;
    const isCancelled = () => cancelled;

    function scheduleMediaRetry() {
      const age = (Date.now() - new Date(post.created_at).getTime()) / 1000;
      if (age >= RETRY_WINDOW_SECONDS) return;
      let attempt = 0;
      (function next() {
        if (attempt >= RETRY_DELAYS.length) return;
        retryRef.current = setTimeout(async () => {
          const { data: again } = await fetchPostMedia(post.id);
          if (isCancelled()) return;
          if (again.length > 0) setPostMedia(again);
          else { attempt++; next(); }
        }, RETRY_DELAYS[attempt]);
      })();
    }

    if (batchedLikes) {
      setLikeCount(post.like_count);
      setLiked(!!post.liked_by_me);
    } else {
      (async () => {
        const { data: { count, liked: isLiked } = {} } = await fetchLikeStatus(post.id, userId);
        if (isCancelled()) return;
        setLikeCount(count);
        setLiked(isLiked);
      })();
    }

    if (batchedMedia) {
      setPostMedia(batchedMedia);
      if (batchedMedia.length === 0) scheduleMediaRetry();
    } else {
      (async () => {
        const { data } = await fetchPostMedia(post.id);
        if (isCancelled()) return;
        setPostMedia(data);
        if (data.length === 0) scheduleMediaRetry();
      })();
    }

    return () => { cancelled = true; clearTimeout(retryRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, userId, post.like_count, post.liked_by_me, post.post_media]);

  async function toggleLike() {
    if (!userId) { toast.error('Faça login para curtir!'); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    await runLikeToggle({
      liked,
      like:   () => likePost(post.id, userId),
      unlike: () => unlikePost(post.id, userId),
      apply:  () => { setLiked(!liked); setLikeCount(c => (liked ? c - 1 : c + 1)); },
      revert: () => { setLiked(liked);  setLikeCount(c => (liked ? c + 1 : c - 1)); },
    });
    setLikeLoading(false);
  }

  return { liked, likeCount, likeLoading, toggleLike, postMedia };
}
