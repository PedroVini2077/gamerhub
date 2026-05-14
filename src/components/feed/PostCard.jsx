import { Heart, Clock, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import CommentSection from './CommentSection';
import { Link } from 'react-router-dom';
import AvatarPopup from '../ui/AvatarPopup';

const categoryConfig = {
  dica: { label: 'Dica', cls: 'tag-green' },
  curiosidade: { label: 'Curiosidade', cls: 'tag-purple' },
  news: { label: 'News', cls: 'tag-cyan' },
};

export default function PostCard({ post, onDelete, registerRefresh, registerLikeRefresh }) {
  const { user, profile } = useAuth();
  const { isAdmin } = useRole();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const cat = categoryConfig[post.category] || categoryConfig.dica;
  const timeAgo = new Date(post.created_at).toLocaleDateString('pt-BR');
  const canDelete = user && (isAdmin || user.id === post.user_id);

  useEffect(() => {
    fetchLikes();
    if (registerLikeRefresh) registerLikeRefresh(fetchLikes);
  }, [post.id, user]);

  async function fetchLikes() {
    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    setLikeCount(count || 0);
    if (user) {
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setLiked(!!data);
    }
  }

  async function handleLike() {
    if (!user) { toast.error('Faça login para curtir!'); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    if (liked) {
      await supabase.from('post_likes').delete()
        .eq('post_id', post.id).eq('user_id', user.id);
      setLiked(false);
      setLikeCount(c => c - 1);
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
      setLiked(true);
      setLikeCount(c => c + 1);
      if (post.user_id && post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          type: 'like',
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
    else { toast.success('Post deletado'); onDelete?.(); }
  }

  return (
    <div className="card p-5 animate-fade-up">
      <div className="flex items-center gap-3 mb-3">
        <AvatarPopup profile={post.profiles} size={36} />
        <div>
          <p className="text-sm font-semibold text-white">
            <Link to={`/u/${post.profiles?.username}`} className="hover:text-neon-green transition-colors">{post.profiles?.username || 'GamerAnon'}</Link>
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
            <Clock size={10} />
            {timeAgo}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`tag ${cat.cls}`}>{cat.label}</span>
          {canDelete && (
            <button onClick={handleDelete} className="text-gray-600 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <h2 className="text-base font-bold text-white mb-2 font-body">{post.title}</h2>
      <p className="text-sm text-gray-400 leading-relaxed">{post.content}</p>

      <div className="mt-4 pt-3 border-t border-dark-500 flex items-center gap-4">
        <button
          onClick={handleLike}
          disabled={likeLoading}
          className={`flex items-center gap-1.5 text-xs font-mono transition-all ${
            liked ? 'text-neon-green' : 'text-gray-500 hover:text-neon-green'
          }`}
        >
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
      </div>

      <CommentSection
        postId={post.id}
        postOwnerId={post.user_id}
        registerRefresh={registerRefresh}
      />
    </div>
  );
}
