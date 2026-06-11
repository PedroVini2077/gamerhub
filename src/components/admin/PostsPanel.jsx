import { Trash2, RotateCcw, Clock } from 'lucide-react';

const TTL_DAYS = 30;

function daysLeft(deletedAt) {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TTL_DAYS - elapsed));
}

export default function PostsPanel({
  posts, handleDeletePost, handleRestorePost,
  handlePermanentDeletePost, handlePermanentDeleteAllDeleted,
  hasMore, loadingMore, onLoadMore,
}) {
  if (posts.length === 0) return (
    <div className="card p-8 text-center">
      <p className="font-mono text-gray-500 text-sm">Nenhum post ainda</p>
    </div>
  );

  const deletedPosts = posts.filter(p => p.deleted_at);

  return (
    <div className="space-y-3">
      {deletedPosts.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-mono text-gray-500">{deletedPosts.length} post(s) na lixeira</p>
          <button
            onClick={handlePermanentDeleteAllDeleted}
            className="flex items-center gap-1.5 text-xs font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded transition-all">
            <Trash2 size={12} /> Apagar todos da lixeira
          </button>
        </div>
      )}

      {posts.map(p => (
        <div key={p.id}
          className={`card p-4 flex items-start justify-between gap-3 ${p.deleted_at ? 'border-red-500/20 opacity-70' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
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
            {p.deleted_at && (
              <p className="text-xs font-mono text-gray-600 flex items-center gap-1 mt-1">
                <Clock size={10} />
                {daysLeft(p.deleted_at) === 0
                  ? 'Apagado permanentemente em breve'
                  : `Apagado permanentemente em ${daysLeft(p.deleted_at)} dia(s)`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {p.deleted_at ? (
              <>
                <button onClick={() => handleRestorePost?.(p.id)}
                  title="Restaurar post"
                  className="text-gray-600 hover:text-neon-green transition-colors">
                  <RotateCcw size={14} />
                </button>
                <button onClick={() => handlePermanentDeletePost?.(p.id, p.title)}
                  title="Apagar permanentemente"
                  className="text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </>
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
