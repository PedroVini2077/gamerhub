import { Heart, Clock } from 'lucide-react';
import { useState } from 'react';

const categoryConfig = {
  dica: { label: 'Dica', cls: 'tag-green' },
  curiosidade: { label: 'Curiosidade', cls: 'tag-purple' },
  news: { label: 'News', cls: 'tag-cyan' },
};

export default function PostCard({ post }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes || 0);
  const cat = categoryConfig[post.category] || categoryConfig.dica;
  const timeAgo = new Date(post.created_at).toLocaleDateString('pt-BR');

  function handleLike() {
    setLiked(l => !l);
    setLikes(l => liked ? l - 1 : l + 1);
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
        <div className="ml-auto">
          <span className={`tag ${cat.cls}`}>{cat.label}</span>
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
