import { Heart, Clock, Trash2, Pencil, Check, X, Mic, Music, Tv } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { logAudit } from '../../lib/auditLog';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import CommentSection from './CommentSection';
import { Link } from 'react-router-dom';
import AvatarPopup from '../ui/AvatarPopup';
import MediaCarousel from '../ui/MediaCarousel';
import MediaPlayer from '../ui/MediaPlayer';
import EmbedPlayer from '../ui/EmbedPlayer';

const categoryConfig = {
  dica: { label: 'Dica', cls: 'tag-green' },
  curiosidade: { label: 'Curiosidade', cls: 'tag-purple' },
  news: { label: 'News', cls: 'tag-cyan' },
};

const EDIT_LIMIT_MINUTES = 30;

export default function PostCard({ post, onDelete, disablePopup = false }) {
  const { user, profile } = useAuth();
  const { isAdmin } = useRole();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [postMedia, setPostMedia] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editIsLive, setEditIsLive] = useState(post.is_live || false);
  const [saving, setSaving] = useState(false);

  const [countdown, setCountdown] = useState('');
  const mediaIntervalRef = useRef(null);

useEffect(() => {
  if (!editing) return;
  function updateCountdown() {
    const elapsed = (Date.now() - new Date(post.created_at).getTime()) / 1000;
    const remaining = (EDIT_LIMIT_MINUTES * 60) - elapsed;
    if (remaining <= 0) { setEditing(false); return; }
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = Math.floor(remaining % 60).toString().padStart(2, '0');
    setCountdown(`${m}:${s}`);
  }
  updateCountdown();
  const interval = setInterval(updateCountdown, 1000);
  return () => clearInterval(interval);
}, [editing]);

  const cat = categoryConfig[post.category] || categoryConfig.dica;
  const timeAgo = new Date(post.created_at).toLocaleDateString('pt-BR');
  const canDelete = user && (isAdmin || user.id === post.user_id);
  const isOwner = user && user.id === post.user_id;
  const minutesSince = (Date.now() - new Date(post.created_at).getTime()) / 60000;
  const canEdit = isOwner && minutesSince <= EDIT_LIMIT_MINUTES;

  useEffect(() => {
    fetchLikes();
    fetchMedia();
    return () => clearInterval(mediaIntervalRef.current);
  }, [post.id, user]);

  async function fetchMedia() {
  const { data } = await supabase.from('post_media').select('*')
    .eq('post_id', post.id).order('position');
  setPostMedia(data || []);

  const age = (Date.now() - new Date(post.created_at).getTime()) / 1000;
  if ((!data || data.length === 0) && age < 60) {
    let attempts = 0;
    mediaIntervalRef.current = setInterval(async () => {
      attempts++;
      const { data: retry } = await supabase.from('post_media').select('*')
        .eq('post_id', post.id).order('position');
      if ((retry && retry.length > 0) || attempts >= 5) {
        clearInterval(mediaIntervalRef.current);
        if (retry && retry.length > 0) setPostMedia(retry);
      }
    }, 2000);
  }
}

  async function fetchLikes() {
    const { count } = await supabase.from('post_likes')
      .select('*', { count: 'exact', head: true }).eq('post_id', post.id);
    setLikeCount(count || 0);
    if (user) {
      const { data } = await supabase.from('post_likes').select('id')
        .eq('post_id', post.id).eq('user_id', user.id).maybeSingle();
      setLiked(!!data);
    }
  }

  async function handleLike() {
    if (!user) { toast.error('Faça login para curtir!'); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    if (liked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      setLiked(false); setLikeCount(c => c - 1);
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
      setLiked(true); setLikeCount(c => c + 1);
      if (post.user_id && post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, type: 'like',
          message: `${profile?.username || 'Alguém'} curtiu seu post "${post.title}"`,
        });
      }
    }
    setLikeLoading(false);
  }

  async function handleDelete() {
    if (!confirm('Deletar este post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) toast.error('Erro ao deletar');
    else {
      toast.success('Post deletado');
      logAudit('post_deleted', `@${profile?.username} deletou o post "${post.title}"`, { category: 'content' });
      onDelete?.();
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    const { error } = await supabase.from('posts').update({
      content: editContent.trim() || null,
      is_live: editIsLive,
      was_live: post.was_live || editIsLive,
      edited_at: new Date().toISOString()
    }).eq('id', post.id);
    if (error) toast.error('Erro ao salvar');
    else {
      toast.success('Post editado!');
      logAudit('post_edited', `@${profile?.username} editou o post "${post.title}"`, { category: 'content' });
      setEditing(false);
    }
    setSaving(false);
  }

  return (
    <div className="card p-5 animate-fade-up">
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
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)}
              className="text-gray-600 hover:text-neon-green transition-colors">
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="text-gray-600 hover:text-red-400 transition-colors">
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
          <p className="text-xs font-mono flex items-center gap-1"
            style={{ color: countdown <= '05:00' ? '#ff4444' : '#6b7280' }}>
            ⏱ Tempo restante: <span className="font-bold ml-1">{countdown}</span>
          </p>
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
    </div>
  );
}
