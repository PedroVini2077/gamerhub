import { Heart, Clock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const categoryConfig = {
  dica: { label: 'Dica', cls: 'tag-green' },
  curiosidade: { label: 'Curiosidade', cls: 'tag-purple' },
  news: { label: 'News', cls: 'tag-cyan' },
};

export default function PostCard({ post, onDelete }) {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const cat = categoryConfig[post.category] || categoryConfig.dica;
  const timeAgo = new Date(post.created_at).toLocaleDateString('pt-BR');

  const canDelete = user && (isAdmin || user.id === post.user_id);

  async function handleLike() {
    const newLiked = !liked;
    const newLikes = newLiked ? likes + 1 : likes - 1;
    setLiked(newLiked);
    setLikes(newLikes);
    await supabase.from('posts').update({ likes: newLikes }).eq('id', post.id);
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
        <div className="w-9 h-9 rounded-full bg-dark-400 border border-dark-300 flex items-center justify-center shrink-0">
          <span className="text-sm font-mono text-gray-300">
            {post.profiles?.username?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            {post.profiles?.username || 'GamerAnon'}
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
            <Clock size={10} />
            {timeAgo}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`tag ${cat.cls}`}>{cat.label}</span>
          {canDelete && (
            <button
              onClick={handleDelete}
              className="text-gray-600 hover:text-red-400 transition-colors"
              title="Deletar post"
            >
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
          className={`flex items-center gap-1.5 text-xs font-mono transition-all ${
            liked ? 'text-neon-green' : 'text-gray-500 hover:text-neon-green'
          }`}
        >
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
          {likes}
        </button>
      </div>
    </div>
  );
}
