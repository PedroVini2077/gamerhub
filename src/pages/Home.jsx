import { useState, useMemo } from 'react';
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

const CATEGORIES = ['todos', 'dica', 'curiosidade', 'news'];

export default function Home() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('todos');

  // `[24/09]` Buscar dado, assinar realtime e contar novidade saíram para o
  // `useFeed`. O corte foi MECÂNICO — nada de comportamento mudou —, e o
  // motivo está lá: a paginação do bloco do Feed entra nesse hook, e ela não
  // cabe numa tela que também desenha (§4, "mistura responsabilidades").
  const {
    posts, carregando: loading, novos: newPosts, recarregar: reloadPosts,
    carregarMais, temMais, carregandoMais,
  } = useFeed(user?.id);

  // Filtragem memoizada — não recalcula se posts/search/filterCat não mudarem
  const filtered = useMemo(() => posts.filter(p => {
    const matchCat = filterCat === 'todos' || p.category === filterCat;
    const q = search.toLowerCase();
    const matchSearch = !search ||
      p.title?.toLowerCase().includes(q) ||
      p.content?.toLowerCase().includes(q);
    return matchCat && matchSearch;
  }), [posts, search, filterCat]);

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
              Dicas, curiosidades, news e a melhor comunidade gamer do Brasil.
            </p>
          </div>
        </div>

        {/* Busca e filtros */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green transition-all">
            <span className="pl-3 text-gray-500 shrink-0"><Search size={14} /></span>
            <input
              className="flex-1 bg-transparent py-2.5 px-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="Buscar posts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="pr-3 text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={`tag cursor-pointer transition-all ${
                  filterCat === c
                    ? c === 'todos' ? 'tag-green' : c === 'dica' ? 'tag-green' : c === 'curiosidade' ? 'tag-purple' : 'tag-cyan'
                    : 'opacity-40 hover:opacity-70 tag-cyan'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

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
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-mono text-gray-500 text-sm">
              {search || filterCat !== 'todos' ? 'Nenhum post encontrado.' : 'Nenhum post ainda. Seja o primeiro!'}
            </p>
          </div>
        ) : (
          <motion.div className="space-y-4"
            variants={listContainer} initial="initial" animate="animate">
            {filtered.map(p => (
              <motion.div key={p.id} variants={listItem}>
                <PostCard post={p} onDelete={reloadPosts} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* `[24/09]` Carregar mais é ATO DA PESSOA, não rolagem infinita: o
            pedido do dono é "indicador discreto -> usuário decide -> atualiza".
            Só aparece quando o banco disse que existe próxima página. */}
        {temMais && !search && filterCat === 'todos' && (
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
