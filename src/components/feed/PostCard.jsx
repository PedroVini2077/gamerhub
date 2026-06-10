import { Heart, Clock, Trash2, Pencil, Check, X, Mic, Music, Tv, Flag, EyeOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { logAudit } from '../../lib/auditLog';
import { useRole } from '../../hooks/useRole';
import { fetchLikeStatus, likePost, unlikePost, fetchPostMedia, softDeletePost, updatePost } from '../../services/postService';
import { canDeleteContent } from '../../lib/roles';
import toast from 'react-hot-toast';
import CommentSection from './CommentSection';
import { Link } from 'react-router-dom';
import AvatarPopup from '../ui/AvatarPopup';
import MediaCarousel from '../ui/MediaCarousel';
import MediaPlayer from '../ui/MediaPlayer';
import EmbedPlayer from '../ui/EmbedPlayer';
import ConfirmModal from '../ui/ConfirmModal';
import ReportModal from '../ui/ReportModal';

function EditCountdown({ createdAt }) {
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    function update() {
      const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
      const remaining = (EDIT_LIMIT_MINUTES * 60) - elapsed;
      if (remaining <= 0) { setCountdown('00:00'); return; }
      const m = Math.floor(remaining / 60).toString().padStart(2, '0');
      const s = Math.floor(remaining % 60).toString().padStart(2, '0');
      setCountdown(`${m}:${s}`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <p className="text-xs font-mono flex items-center gap-1"
      style={{ color: countdown <= '05:00' ? '#ff4444' : '#6b7280' }}>
      ⏱ Tempo restante: <span className="font-bold ml-1">{countdown}</span>
    </p>
  );
}

const categoryConfig = {
  dica: { label: 'Dica', cls: 'tag-green' },
  curiosidade: { label: 'Curiosidade', cls: 'tag-purple' },
  news: { label: 'News', cls: 'tag-cyan' },
};

const EDIT_LIMIT_MINUTES = 30;

export default function PostCard({ post, onDelete, disablePopup = false }) {
  const { user, profile } = useAuth();
  const { isAdmin, role } = useRole();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [postMedia, setPostMedia] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editIsLive, setEditIsLive] = useState(post.is_live || false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);

  const mediaIntervalRef = useRef(null);

  const cat = categoryConfig[post.category] || categoryConfig.dica;
  const timeAgo = new Date(post.created_at).toLocaleDateString('pt-BR');
  const canDelete = canDeleteContent(user?.id, role, post.user_id, post.profiles?.role);
  const isOwner = user && user.id === post.user_id;
  const minutesSince = (Date.now() - new Date(post.created_at).getTime()) / 60000;
  const canEdit = isOwner && minutesSince <= EDIT_LIMIT_MINUTES;

  useEffect(() => {
    // Guarda de cancelamento: impede setState após desmontar ou troca de post,
    // evitando que uma resposta antiga sobrescreva a atual.
    let cancelled = false;
    fetchLikes(() => cancelled);
    fetchMedia(() => cancelled);
    return () => { cancelled = true; clearTimeout(mediaIntervalRef.current); };
  }, [post.id, user]);

  async function fetchMedia(isCancelled) {
    const data = await fetchPostMedia(post.id);
    if (isCancelled()) return;
    setPostMedia(data);

    const age = (Date.now() - new Date(post.created_at).getTime()) / 1000;
    if (data.length === 0 && age < 60) {
      const delays = [1000, 2000, 4000, 8000];
      let attempt = 0;
      function scheduleRetry() {
        if (attempt >= delays.length) return;
        mediaIntervalRef.current = setTimeout(async () => {
          const retryData = await fetchPostMedia(post.id);
          if (isCancelled()) return;
          if (retryData.length > 0) {
            setPostMedia(retryData);
          } else {
            attempt++;
            scheduleRetry();
          }
        }, delays[attempt]);
      }
      scheduleRetry();
    }
  }

  async function fetchLikes(isCancelled) {
    const { count, liked: isLiked } = await fetchLikeStatus(post.id, user?.id);
    if (isCancelled()) return;
    setLikeCount(count);
    setLiked(isLiked);
  }

  async function handleLike() {
    if (!user) { toast.error('Faça login para curtir!'); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    if (liked) {
      await unlikePost(post.id, user.id);
      setLiked(false); setLikeCount(c => c - 1);
    } else {
      await likePost(post.id, user.id);
      setLiked(true); setLikeCount(c => c + 1);
    }
    setLikeLoading(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await softDeletePost(post.id);
    if (error) {
      toast.error(error.message || 'Erro ao excluir');
      setDeleting(false);
      return;
    }
    toast.success('Post excluído');
    logAudit('post_deleted', `@${profile?.username} excluiu o post "${post.title}"`, { category: 'content' });
    setConfirming(false);
    setDeleting(false);
    onDelete?.();
  }

  async function handleSaveEdit() {
    setSaving(true);
    const { error } = await updatePost(
      post.id,
      { content: editContent, isLive: editIsLive, wasLive: post.was_live || editIsLive },
      user.id,
      isAdmin
    );
    if (error) toast.error('Erro ao salvar');
    else {
      toast.success('Post editado!');
      logAudit('post_edited', `@${profile?.username} editou o post "${post.title}"`, { category: 'content' });
      setEditing(false);
    }
    setSaving(false);
  }

  const canReport = user && user.id !== post.user_id;

  return (
    <div className={`card p-5 animate-fade-up ${post.hidden_at ? 'border-yellow-500/30' : ''}`}>
      {post.deleted_at && (
        <div className="flex items-center gap-2 text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          <Trash2 size={12} />
          <span>Post excluído — visível apenas para admins. Use o painel admin para restaurar.</span>
        </div>
      )}
      {post.hidden_at && (
        <div className="flex items-center gap-2 text-xs font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3">
          <EyeOff size={12} />
          <span>Conteúdo oculto pela moderação — visível apenas para admins.</span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <AvatarPopup profile={post.profiles} size={36} disablePopup={disablePopup} />
        <div>
          <Link to={`/u/${post.profiles?.username}`}
            className="text-sm font-semibold text-white hover:text-neon-green transition-colors">
            {post.profiles?.username || 'GamerAnon'}
          </Link>
          <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
            <Clock size={10} />
            {timeAgo}
            {post.edited_at && <span className="text-gray-600 ml-1">(editado)</span>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`tag ${cat.cls}`}>{cat.label}</span>
          {canReport && (
            <button onClick={() => setReporting(true)} aria-label="Denunciar post"
              className="text-gray-600 hover:text-orange-400 transition-colors">
              <Flag size={13} />
            </button>
          )}
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)}
              className="text-gray-600 hover:text-neon-green transition-colors">
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => setConfirming(true)} aria-label="Deletar post"
              className="text-gray-600 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <h2 className="text-base font-bold text-white mb-2 font-body">{post.title}</h2>

      {/* Áudio principal */}
      {post.audio_url && (
        <div className="mb-2">
          <p className="text-xs font-mono text-gray-500 mb-1 flex items-center gap-1">
            {post.audio_type === 'recorded' ? <><Mic size={11} />Áudio</> : <><Music size={11} />Música</>}
          </p>
          <MediaPlayer src={post.audio_url} title={post.audio_name || post.title} />
        </div>
      )}

      {/* Conteúdo texto — editável */}
      {editing ? (
        <div className="space-y-2 mb-2">
          <textarea className="input-gamer resize-none w-full" rows={3}
            placeholder="Legenda (opcional)..."
            value={editContent} onChange={e => setEditContent(e.target.value)} maxLength={1000} />
          {post.embed_type === 'twitch' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editIsLive} onChange={e => setEditIsLive(e.target.checked)}
                className="w-4 h-4 accent-neon-green" />
              <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Marcar como Live
              </span>
            </label>
          )}
          <div className="flex gap-2">
            <button onClick={handleSaveEdit} disabled={saving}
              className="btn-solid py-1.5 px-3 text-xs flex items-center gap-1">
              <Check size={12} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => { setEditing(false); setEditContent(post.content || ''); setEditIsLive(post.is_live || false); }}
              className="btn-neon py-1.5 px-3 text-xs flex items-center gap-1">
              <X size={12} /> Cancelar
            </button>
          </div>
          <EditCountdown createdAt={post.created_at} />
        </div>
      ) : (
        post.content && <p className="text-sm text-gray-400 leading-relaxed mb-2">{post.content}</p>
      )}

      {post.embed_url && (
        post.was_live && !post.is_live
          ? (
            <div className="mt-3 rounded-lg border border-dark-400 bg-dark-900 p-8 text-center">
              <Tv size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-neon-green font-mono text-sm font-bold">Live encerrada</p>
              <p className="text-gray-500 font-mono text-xs mt-1">O streamer ficou offline</p>
            </div>
          )
          : <EmbedPlayer url={post.embed_url} isLive={post.is_live} expiresAt={post.expires_at} />
      )}

      {/* Carrossel */}
      {postMedia.length > 0 && <MediaCarousel items={postMedia} postTitle={post.title} />}

      <div className="mt-4 pt-3 border-t border-dark-500 flex items-center gap-4">
        <button onClick={handleLike} disabled={likeLoading}
          className={`flex items-center gap-1.5 text-xs font-mono transition-all ${
            liked ? 'text-neon-green' : 'text-gray-500 hover:text-neon-green'
          }`}>
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
      </div>

{post.is_live && (!post.expires_at || new Date(post.expires_at) > new Date()) ? (
        <div className="mt-4 pt-3 border-t border-dark-500">
          <a href="/lives"
            className="flex items-center justify-center gap-2 w-full btn-neon py-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Entrar na live para comentar
          </a>
        </div>
      ) : (
        <CommentSection postId={post.id} postOwnerId={post.user_id} />
      )}

      {confirming && (
        <ConfirmModal
          title="Deletar post"
          icon={Trash2}
          accent="red"
          message="Tem certeza que quer deletar este post? Essa ação não pode ser desfeita."
          confirmLabel={deleting ? 'Deletando...' : 'Deletar'}
          confirmIcon={Trash2}
          onConfirm={handleDelete}
          onClose={() => !deleting && setConfirming(false)}
        />
      )}
      {reporting && (
        <ReportModal contentType="post" contentId={post.id} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}
