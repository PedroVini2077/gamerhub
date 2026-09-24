import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '../lib/motion';
import PostCard from '../components/feed/PostCard';
import PostForm from '../components/feed/PostForm';
import RightPanel from '../components/layout/RightPanel';
import { useFeed } from '../hooks/useFeed';
import { useAuth } from '../hooks/useAuth.jsx';
import { Search, X, ArrowUp, ChevronDown } from 'lucide-react';
import MarcaGH from '../components/ui/MarcaGH';
import { rotuloDeNovos } from '../lib/novidadeDoFeed';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // `[24/09]` Buscar dado, assinar realtime e contar novidade saíram para o
  // `useFeed`. O corte foi MECÂNICO — nada de comportamento mudou —, e o
  // motivo está lá: a paginação do bloco do Feed entra nesse hook, e ela não
  // cabe numa tela que também desenha (§4, "mistura responsabilidades").
  const {
    posts, carregando: loading, novos: newPosts, recarregar: reloadPosts,
    carregarMais, temMais, carregandoMais,
  } = useFeed(user?.id);

  // `[24/09]` A busca DEIXOU de filtrar o que está carregado e virou porta para
  // `/busca`, que consulta o banco. O filtro antigo dizia "Buscar posts" e
  // procurava nos 20 da página — resposta errada apresentada como completa, e
  // a paginação só piorou isso.
  const irParaBusca = (e) => {
    e.preventDefault();
    const termo = search.trim();
    if (termo) navigate(`/busca?q=${encodeURIComponent(termo)}`);
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="card p-6 border-neon-green/20 relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <MarcaGH tamanho={18} />
              <span className="font-display text-xs text-neon-green tracking-widest uppercase">GamerHub // Feed</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-white mb-1">
              Bem-vindo ao <span className="text-neon">Hub</span>
            </h1>
            <p className="text-sm text-gray-400 font-body">
              O que a comunidade gamer brasileira está publicando agora.
            </p>
          </div>
        </div>

        {/* Porta para `/busca` — o Enter leva; aqui não se filtra mais nada. */}
        <form className="card p-4" onSubmit={irParaBusca}>
          <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green transition-all">
            <span className="pl-3 text-gray-500 shrink-0"><Search size={14} /></span>
            <input
              className="flex-1 bg-transparent py-2.5 px-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="Buscar no GamerHub..."
              aria-label="Buscar no GamerHub"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca"
                className="pr-3 text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </form>

        {rotuloDeNovos(newPosts) && (
          <button
            // `() => reloadPosts()` e não `reloadPosts`: passar a função direto
            // entregaria o EVENTO de clique como `idEsperado`, e a recarga
            // ficaria procurando um post cujo id é um objeto de evento —
            // insistindo quatro vezes à toa em todo clique.
            onClick={() => reloadPosts()}
            className="w-full card p-3 flex items-center justify-center gap-1.5 text-xs font-mono text-neon-green border-neon-green/30 hover:bg-neon-green/5 transition-colors animate-fade-up"
          >
            <ArrowUp size={13} />
            {rotuloDeNovos(newPosts)}
          </button>
        )}

        <PostForm onPost={reloadPosts} />

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-dark-500 rounded mb-3 w-1/3" />
                <div className="h-3 bg-dark-500 rounded mb-2" />
                <div className="h-3 bg-dark-500 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-mono text-gray-500 text-sm">
              Nenhum post ainda. Seja o primeiro!
            </p>
          </div>
        ) : (
          <motion.div className="space-y-4"
            variants={listContainer} initial="initial" animate="animate">
            {posts.map(p => (
              <motion.div key={p.id} variants={listItem}>
                <PostCard post={p} onDelete={reloadPosts} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* `[24/09]` Carregar mais é ATO DA PESSOA, não rolagem infinita: o
            pedido do dono é "indicador discreto -> usuário decide -> atualiza".
            Só aparece quando o banco disse que existe próxima página. */}
        {temMais && (
          <button
            onClick={() => carregarMais()}
            disabled={carregandoMais}
            className="w-full card p-3 flex items-center justify-center gap-1.5 text-xs font-mono text-gray-400 border-dark-400 hover:text-neon-green hover:border-neon-green/30 transition-colors disabled:opacity-50"
          >
            <ChevronDown size={13} className={carregandoMais ? 'animate-bounce' : ''} />
            {carregandoMais ? 'Carregando...' : 'Carregar mais'}
          </button>
        )}
      </div>
      <RightPanel />
    </div>
  );
}
