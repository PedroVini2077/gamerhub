import { useState, useEffect, useRef } from 'react';
import { Trash2, Heart, Flag, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import {
  deleteMuralPost, fetchMuralMedia,
  fetchMuralLikeStatus, likeMuralPost, unlikeMuralPost,
} from '../../services/communityService';
import { logAudit } from '../../lib/auditLog';
import { canDeleteContent } from '../../lib/roles';
import { runLikeToggle } from '../../lib/like';
import { timeAgo } from '../../lib/date';
import toast from 'react-hot-toast';
import AvatarPopup from '../ui/AvatarPopup';
import ConfirmModal from '../ui/ConfirmModal';
import ReportModal from '../ui/ReportModal';
import MediaCarousel from '../ui/MediaCarousel';
import LazyVisible from '../ui/LazyVisible';

export default function MuralCard({ item, onDelete }) {
  const { user, profile } = useAuth();
  const { isAdmin, role } = useRole();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const canReport = user && user.id !== item.user_id;
  // A listagem do mural já traz curtidas e mídia em lote — o card só busca
  // sozinho quando o item chega solto (ex.: painel de moderação).
  const batchedLikes = typeof item.like_count === 'number';
  const batchedMedia = Array.isArray(item.community_post_media) ? item.community_post_media : null;

  const [media, setMedia] = useState(batchedMedia ?? []);
  const [liked, setLiked] = useState(!!item.liked_by_me);
  const [likeCount, setLikeCount] = useState(item.like_count ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);
  const retryRef = useRef(null);

  const canDelete = canDeleteContent(user?.id, role, item.user_id, item.profiles?.role);

  useEffect(() => {
    let cancelled = false;

    if (batchedLikes) {
      setLikeCount(item.like_count);
      setLiked(!!item.liked_by_me);
    } else {
      (async () => {
        const { data: { count, liked: isLiked } = {} } = await fetchMuralLikeStatus(item.id, user?.id);
        if (cancelled) return;
        setLikeCount(count);
        setLiked(isLiked);
      })();
    }

    // Mídia pode chegar logo após o post (upload assíncrono) — tenta de novo
    // por alguns segundos enquanto o item é novo.
    function scheduleRetry() {
      const age = (Date.now() - new Date(item.created_at).getTime()) / 1000;
      if (age >= 30) return;
      const delays = [1000, 2000, 4000];
      let attempt = 0;
      (function next() {
        if (attempt >= delays.length) return;
        retryRef.current = setTimeout(async () => {
          const { data: again } = await fetchMuralMedia(item.id);
          if (cancelled) return;
          if (again.length > 0) setMedia(again);
          else { attempt++; next(); }
        }, delays[attempt]);
      })();
    }

    if (batchedMedia) {
      setMedia(batchedMedia);
      if (batchedMedia.length === 0) scheduleRetry();
    } else {
      (async () => {
        const { data } = await fetchMuralMedia(item.id);
        if (cancelled) return;
        setMedia(data);
        if (data.length === 0) scheduleRetry();
      })();
    }

    return () => { cancelled = true; clearTimeout(retryRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.created_at, user?.id, item.like_count, item.liked_by_me, item.community_post_media]);

  async function handleLike() {
    if (!user) { toast.error('Faça login para curtir!'); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    await runLikeToggle({
      liked,
      like:   () => likeMuralPost(item.id, user.id),
      unlike: () => unlikeMuralPost(item.id, user.id),
      apply:  () => { setLiked(!liked); setLikeCount(c => (liked ? Math.max(0, c - 1) : c + 1)); },
      revert: () => { setLiked(liked);  setLikeCount(c => (liked ? c + 1 : Math.max(0, c - 1))); },
    });
    setLikeLoading(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await deleteMuralPost(item.id, user.id, isAdmin);
    if (error) {
      toast.error(error.message || 'Erro ao deletar');
      setDeleting(false);
      return;
    }
    toast.success('Mensagem deletada');
    logAudit('mural_delete', `@${profile?.username} deletou uma mensagem de @${item.profiles?.username} no mural`, { category: 'content' });
    setConfirming(false);
    setDeleting(false);
    onDelete?.();
  }

  return (
    <div className={`card p-4 animate-fade-up border-transparent hover:border-neon-purple/25 transition-colors ${item.hidden_at ? 'border-yellow-500/30' : ''}`}>
      {item.hidden_at && (
        <div className="flex items-center gap-2 text-xs font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3">
          <EyeOff size={12} />
          <span>Conteúdo oculto por denúncias — visível apenas para admins.</span>
        </div>
      )}
      <div className="flex items-start gap-3">
        <AvatarPopup profile={item.profiles} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/u/${item.profiles?.username}`}
              className="text-sm font-semibold text-white hover:text-neon-purple transition-colors truncate"
            >
              {item.profiles?.username || 'Gamer'}
            </Link>
            <span className="text-xs text-gray-600 font-mono shrink-0">{timeAgo(item.created_at)}</span>
          </div>
          {item.message && (
            <p className="text-sm text-gray-300 leading-relaxed break-words whitespace-pre-wrap">{item.message}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canReport && (
            <button onClick={() => setReporting(true)} aria-label="Denunciar mensagem"
              className="text-gray-600 hover:text-orange-400 transition-colors">
              <Flag size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setConfirming(true)}
              aria-label="Deletar mensagem"
              className="text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {media.length > 0 && (
        <div className="pl-12">
          <LazyVisible minHeight={220}>
            <MediaCarousel items={media} postTitle={item.profiles?.username || 'Mural'} />
          </LazyVisible>
        </div>
      )}

      <div className="pl-12 mt-3">
        <button
          onClick={handleLike}
          disabled={likeLoading}
          aria-label={`${liked ? 'Descurtir' : 'Curtir'} — ${likeCount} curtida(s)`}
          aria-pressed={liked}
          className={`flex items-center gap-1.5 text-xs font-mono transition-all ${
            liked ? 'text-neon-purple' : 'text-gray-500 hover:text-neon-purple'
          }`}
        >
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
      </div>

      {confirming && (
        <ConfirmModal
          title="Deletar mensagem"
          icon={Trash2}
          accent="red"
          message="Tem certeza que quer deletar esta mensagem do mural? Essa ação não pode ser desfeita."
          confirmLabel={deleting ? 'Deletando...' : 'Deletar'}
          confirmIcon={Trash2}
          onConfirm={handleDelete}
          onClose={() => !deleting && setConfirming(false)}
        />
      )}
      {reporting && (
        <ReportModal contentType="mural" contentId={item.id} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}
