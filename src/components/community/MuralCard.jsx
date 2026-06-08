import { useState, useEffect, useRef } from 'react';
import { Trash2, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import {
  deleteMuralPost, fetchMuralMedia,
  fetchMuralLikeStatus, likeMuralPost, unlikeMuralPost,
} from '../../services/communityService';
import { logAudit } from '../../lib/auditLog';
import { timeAgo } from '../../lib/date';
import toast from 'react-hot-toast';
import AvatarPopup from '../ui/AvatarPopup';
import ConfirmModal from '../ui/ConfirmModal';
import MediaCarousel from '../ui/MediaCarousel';

export default function MuralCard({ item, onDelete }) {
  const { user, profile } = useAuth();
  const { isAdmin } = useRole();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [media, setMedia] = useState([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const retryRef = useRef(null);

  const canDelete = user && (isAdmin || user.id === item.user_id);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { count, liked: isLiked } = await fetchMuralLikeStatus(item.id, user?.id);
      if (cancelled) return;
      setLikeCount(count);
      setLiked(isLiked);
    })();

    // Mídia pode chegar logo após o post (upload assíncrono) — busca com
    // algumas tentativas espaçadas, igual ao feed.
    async function loadMedia() {
      const data = await fetchMuralMedia(item.id);
      if (cancelled) return;
      setMedia(data);
      const age = (Date.now() - new Date(item.created_at).getTime()) / 1000;
      if (data.length === 0 && age < 30) {
        const delays = [1000, 2000, 4000];
        let attempt = 0;
        function retry() {
          if (attempt >= delays.length) return;
          retryRef.current = setTimeout(async () => {
            const again = await fetchMuralMedia(item.id);
            if (cancelled) return;
            if (again.length > 0) setMedia(again);
            else { attempt++; retry(); }
          }, delays[attempt]);
        }
        retry();
      }
    }
    loadMedia();

    return () => { cancelled = true; clearTimeout(retryRef.current); };
  }, [item.id, item.created_at, user?.id]);

  async function handleLike() {
    if (!user) { toast.error('Faça login para curtir!'); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    if (liked) {
      await unlikeMuralPost(item.id, user.id);
      setLiked(false); setLikeCount(c => Math.max(0, c - 1));
    } else {
      await likeMuralPost(item.id, user.id);
      setLiked(true); setLikeCount(c => c + 1);
    }
    setLikeLoading(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await deleteMuralPost(item.id, user.id, isAdmin);
    if (error) {
      toast.error('Erro ao deletar');
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
    <div className="card p-4 animate-fade-up border-transparent hover:border-neon-purple/25 transition-colors">
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
        {canDelete && (
          <button
            onClick={() => setConfirming(true)}
            aria-label="Deletar mensagem"
            className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {media.length > 0 && (
        <div className="pl-12">
          <MediaCarousel items={media} postTitle={item.profiles?.username || 'Mural'} />
        </div>
      )}

      <div className="pl-12 mt-3">
        <button
          onClick={handleLike}
          disabled={likeLoading}
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
    </div>
  );
}
