import { useState } from 'react';
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
  const [subTab, setSubTab] = useState('active');

  const activePosts  = posts.filter(p => !p.deleted_at);
  const deletedPosts = posts.filter(p =>  p.deleted_at);
  const visible = subTab === 'active' ? activePosts : deletedPosts;

  return (
    <div className="space-y-3">
      {/* Sub-abas */}
      <div className="flex items-center gap-1 border-b border-dark-600 pb-2">
        <button
          onClick={() => setSubTab('active')}
          className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
            subTab === 'active'
              ? 'bg-dark-600 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}>
          Posts ativos
          {activePosts.length > 0 && (
            <span className="ml-1.5 bg-dark-500 text-gray-400 px-1.5 py-0.5 rounded text-xs">{activePosts.length}</span>
          )}
        </button>
        <button
          onClick={() => setSubTab('deleted')}
          className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
            subTab === 'deleted'
              ? 'bg-dark-600 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}>
          Lixeira
          {deletedPosts.length > 0 && (
            <span className="ml-1.5 bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-xs">{deletedPosts.length}</span>
          )}
        </button>

        {subTab === 'deleted' && deletedPosts.length > 0 && (
          <button
            onClick={handlePermanentDeleteAllDeleted}
            className="ml-auto flex items-center gap-1.5 text-xs font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 bg-red-500/5 hover:bg-red-500/10 px-3 py-1.5 rounded transition-all">
            <Trash2 size={12} /> Apagar tudo
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-mono text-gray-500 text-sm">
            {subTab === 'active' ? 'Nenhum post ativo' : 'Lixeira vazia'}
          </p>
        </div>
      ) : (
        visible.map(p => (
          // `data-post-row` é gancho de TESTE, e existe por um bug que passou
          // meses despercebido: o `e2e/painel-admin.mjs` contava as linhas com
          // `main tbody tr, main [data-post-row]` — e nenhum dos dois casava,
          // porque a lista é de `<div>`, não de tabela. O contador dava ZERO.
          //
          // O teste não acusava porque o outro ramo do `if` era o que rodava:
          // com menos de uma página de posts, o botão "Carregar mais" nem
          // aparece, e ele registrava "sem botão" como sucesso. Em 29/08 o banco
          // passou de 20 posts, o botão surgiu, e a asserção caiu na hora — com
          // `0 linhas antes, 0 depois`.
          //
          // Foi o teste passando pelo motivo errado (§1.5). Amarrar o teste à
          // classe de CSS seria trocar um acoplamento frágil por outro; um
          // atributo dedicado diz "isto é uma linha de post" e sobrevive a
          // qualquer mudança de layout.
          <div key={p.id} data-post-row
            className={`card p-4 flex items-start justify-between gap-3 ${p.hidden_at ? 'border-yellow-500/20' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {p.hidden_at && (
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
        ))
      )}

      {/* `[29/08]` O botão aparece nas DUAS sub-abas, e cada uma tem o seu
          `hasMore`. Antes ele só existia em "ativos" e paginava a lista
          misturada: o clique carregava de verdade e a tela não mudava, porque
          os 20 seguintes podiam ser todos da lixeira. */}
      {hasMore?.[subTab] && (
        <button onClick={() => onLoadMore(subTab)} disabled={loadingMore}
          className="btn-neon w-full py-2.5 text-xs disabled:opacity-40">
          {loadingMore ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
