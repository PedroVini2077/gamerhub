import { FileText, Trash2 } from 'lucide-react';

export default function PostsPanel({ posts, handleDeletePost }) {
  if (posts.length === 0) return (
    <div className="card p-8 text-center">
      <p className="font-mono text-gray-500 text-sm">Nenhum post ainda</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {posts.map(p => (
        <div key={p.id} className="card p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white mb-1 truncate">{p.title}</p>
            <p className="text-xs text-gray-500 font-mono">
              {p.profiles?.username} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <button onClick={() => handleDeletePost(p.id)}
            className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
