import { Trash2, RotateCcw } from 'lucide-react';

export default function PostsPanel({ posts, handleDeletePost, handleRestorePost, hasMore, loadingMore, onLoadMore }) {
  if (posts.length === 0) return (
    <div className="card p-8 text-center">
      <p className="font-mono text-gray-500 text-sm">Nenhum post ainda</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {posts.map(p => (
        <div key={p.id}
          className={`card p-4 flex items-start justify-between gap-3 ${p.deleted_at ? 'border-red-500/20 opacity-60' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {p.deleted_at && (
                <span className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded shrink-0">
                  Excluído
                </span>
              )}
              {p.hidden_at && !p.deleted_at && (
                <span className="text-xs font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded shrink-0">
                  Oculto
                </span>
              )}
              <p className="text-sm font-semibold text-white truncate">{p.title}</p>
            </div>
            <p className="text-xs text-gray-500 font-mono">
              {p.profiles?.username} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {p.deleted_at ? (
              <button onClick={() => handleRestorePost?.(p.id)}
                title="Restaurar post"
                className="text-gray-600 hover:text-neon-green transition-colors">
                <RotateCcw size={14} />
              </button>
            ) : (
              <button onClick={() => handleDeletePost(p.id)}
                title="Excluir post"
                className="text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      ))}
      {hasMore && (
        <button onClick={onLoadMore} disabled={loadingMore}
          className="btn-neon w-full py-2.5 text-xs disabled:opacity-40">
          {loadingMore ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
