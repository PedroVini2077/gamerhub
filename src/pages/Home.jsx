import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '../lib/motion';
import { recarregarAteAparecer } from '../lib/recarregarAteAparecer';
import { fetchFeedPosts } from '../services/postService';
import PostCard from '../components/feed/PostCard';
import PostForm from '../components/feed/PostForm';
import RightPanel from '../components/layout/RightPanel';
import { useRealtime } from '../hooks/useRealtime';
import { useAuth } from '../hooks/useAuth.jsx';
import { Zap, Search, X, ArrowUp } from 'lucide-react';
import { apenasData } from '../services/result';

const CATEGORIES = ['todos', 'dica', 'curiosidade', 'news'];

export default function Home() {
  const { user } = useAuth();
  const [newPosts, setNewPosts] = useState(0);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('todos');
  // O handler de realtime precisa do usuário ATUAL sem re-assinar o canal a
  // cada render. O ref é atualizado num efeito (escrever em ref durante o
  // render é inseguro com renderização concorrente).
  const userRef = useRef(user);
  const fetchDebounceRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // O viewer entra na queryKey: "eu curti" faz parte do resultado em lote, então
  // o cache não pode ser compartilhado entre usuários diferentes.
  const { data: posts = [], isPending: loading, isSuccess, refetch } = useQuery({
    queryKey: ['feed_posts', user?.id ?? null],
    queryFn: () => apenasData(fetchFeedPosts(30, user?.id ?? null)),
  });

  /**
   * Recarrega o feed e zera o contador de "novos posts".
   *
   * ── `[02/09]` Por que ele CONFERE em vez de só recarregar ─────────────────
   *
   * O bug que estava no backlog há dias: publicar e o post não aparecer.
   * Aconteceu de novo no CI, e desta vez sobrou evidência no banco:
   *
   *   post criado ....... 10:18:03, `deleted_at` nulo (existia mesmo)
   *   feed capturado .... 10:18:33, TRINTA segundos depois, sem ele
   *   e mostrando ....... um post que já tinha sido apagado às 10:18:10
   *
   * Ou seja: a leitura trouxe dado ANTERIOR à escrita. É leitura logo após
   * escrita caindo numa conexão do pool que ainda não enxergava a linha — o
   * `createPost` já tinha retornado com sucesso.
   *
   * O `refetch()` sozinho não tem como saber disso: ele recebeu uma resposta
   * válida, só que velha. E como nada tentava de novo, o feed ficava mentindo
   * até a pessoa navegar — do lado dela, o site comeu o que ela escreveu.
   *
   * Com o id em mãos dá para PERGUNTAR se a resposta já contém o post, e
   * insistir por alguns instantes se não contiver. Sem id (deletar, botão de
   * novos posts), o comportamento é o de antes.
   */
  const reloadPosts = useCallback(async (idEsperado) => {
    setNewPosts(0);
    // A decisão de insistir mora em `lib/recarregarAteAparecer.js`, separada
    // de propósito: a corrida acontece no pool do Supabase e não se reproduz
    // num navegador de teste. Como função pura ela é testável de verdade.
    await recarregarAteAparecer(
      async () => (await refetch()).data,
      idEsperado,
    );
  }, [refetch]);

  // Só INSERT e DELETE: o handler não faz nada com UPDATE, e cada UPDATE de
  // post (edição, contadores) viraria uma mensagem de realtime pra todo mundo
  // que está com o feed aberto.
  useRealtime('posts', (payload) => {
    if (!isSuccess) return;
    if (payload.eventType === 'INSERT') {
      if (payload.new?.user_id === userRef.current?.id) {
        setTimeout(() => reloadPosts(), 5000);
      } else setNewPosts(n => n + 1);
    }
    if (payload.eventType === 'DELETE') {
      clearTimeout(fetchDebounceRef.current);
      fetchDebounceRef.current = setTimeout(() => reloadPosts(), 500);
    }
  }, { events: ['INSERT', 'DELETE'] });

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
              <Zap size={18} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 6px #39ff14)' }} />
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

        {newPosts > 0 && (
          <button
            // `() => reloadPosts()` e não `reloadPosts`: passar a função direto
            // entregaria o EVENTO de clique como `idEsperado`, e a recarga
            // ficaria procurando um post cujo id é um objeto de evento —
            // insistindo quatro vezes à toa em todo clique.
            onClick={() => reloadPosts()}
            className="w-full card p-3 flex items-center justify-center gap-1.5 text-xs font-mono text-neon-green border-neon-green/30 hover:bg-neon-green/5 transition-colors animate-fade-up"
          >
            <ArrowUp size={13} />
            {newPosts} novo{newPosts > 1 ? 's' : ''} post{newPosts > 1 ? 's' : ''} — clique para ver
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
      </div>
      <RightPanel />
    </div>
  );
}
