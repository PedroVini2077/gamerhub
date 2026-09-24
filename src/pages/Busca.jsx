import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { listContainer, listItem } from '../lib/motion';
import { buscarPosts, buscarPessoas } from '../services/buscaService';
import { apenasData } from '../services/result';
import { ABAS_DA_BUSCA, abaValida } from '../lib/areasDaBusca';
import { useAuth } from '../hooks/useAuth.jsx';
import PostCard from '../components/feed/PostCard';
import Avatar from '../components/ui/Avatar';
import RightPanel from '../components/layout/RightPanel';

/**
 * `[24/09]` A busca, em rota própria — `/busca?q=`.
 *
 * O termo mora na URL de propósito: busca é resultado compartilhável e
 * recarregável. Estado só de componente perderia o resultado no F5 e tornaria
 * impossível mandar um link.
 */
export default function Busca() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const termo = params.get('q') ?? '';
  const abaPedida = params.get('aba') ?? 'tudo';
  const aba = abaValida(abaPedida) ? abaPedida : 'tudo';

  const habilitada = termo.trim().length > 0;

  const { data: emPosts, isPending: carregandoPosts } = useQuery({
    queryKey: ['busca_posts', termo, user?.id ?? null],
    queryFn: () => apenasData(buscarPosts(termo, user?.id ?? null)),
    enabled: habilitada && (aba === 'tudo' || aba === 'posts'),
  });

  const { data: emPessoas, isPending: carregandoPessoas } = useQuery({
    queryKey: ['busca_pessoas', termo],
    queryFn: () => apenasData(buscarPessoas(termo)),
    enabled: habilitada && (aba === 'tudo' || aba === 'pessoas'),
  });

  const posts = emPosts?.posts ?? [];
  const pessoas = emPessoas?.pessoas ?? [];
  const carregando = habilitada && (
    ((aba === 'tudo' || aba === 'posts') && carregandoPosts)
    || ((aba === 'tudo' || aba === 'pessoas') && carregandoPessoas)
  );

  const total = useMemo(() => {
    if (aba === 'posts') return posts.length;
    if (aba === 'pessoas') return pessoas.length;
    return posts.length + pessoas.length;
  }, [aba, posts.length, pessoas.length]);

  const trocar = (chave, valor) => {
    const proximo = new URLSearchParams(params);
    if (valor) proximo.set(chave, valor); else proximo.delete(chave);
    setParams(proximo, { replace: chave === 'q' });
  };

  const mostraPosts = aba === 'tudo' || aba === 'posts';
  const mostraPessoas = aba === 'tudo' || aba === 'pessoas';

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="card p-4 space-y-3">
          <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green transition-all">
            <span className="pl-3 text-gray-500 shrink-0"><Search size={14} /></span>
            <input
              autoFocus
              className="flex-1 bg-transparent py-2.5 px-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="Buscar no GamerHub..."
              aria-label="Buscar no GamerHub"
              value={termo}
              onChange={(e) => trocar('q', e.target.value)}
            />
            {termo && (
              <button onClick={() => trocar('q', '')} aria-label="Limpar busca"
                className="pr-3 text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {ABAS_DA_BUSCA.map((a) => (
              <button key={a.id} onClick={() => trocar('aba', a.id === 'tudo' ? '' : a.id)}
                aria-pressed={aba === a.id}
                className={`tag cursor-pointer transition-all ${
                  aba === a.id ? 'tag-green' : 'opacity-40 hover:opacity-70 tag-cyan'}`}>
                {a.rotulo}
              </button>
            ))}
          </div>
        </div>

        {!habilitada ? (
          <div className="card p-8 text-center">
            <p className="font-mono text-gray-500 text-sm">
              Escreva algo para buscar em posts e pessoas.
            </p>
          </div>
        ) : carregando ? (
          <div className="card p-8 text-center">
            <p className="font-mono text-gray-500 text-sm">Buscando...</p>
          </div>
        ) : total === 0 ? (
          <div className="card p-8 text-center space-y-1">
            <p className="font-mono text-gray-400 text-sm">
              Nada encontrado para "{termo}".
            </p>
            <p className="font-mono text-gray-600 text-xs">
              A busca procura palavras inteiras do título e do texto — acento não faz diferença.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {mostraPessoas && pessoas.length > 0 && (
              <div className="card p-4 space-y-2">
                <p className="font-mono text-xs text-gray-500 uppercase tracking-widest">
                  Pessoas ({pessoas.length})
                </p>
                {pessoas.map((p) => (
                  <a key={p.id} href={`/u/${p.username}`}
                    className="flex items-center gap-3 py-1.5 hover:opacity-80 transition-opacity">
                    <Avatar url={p.avatar_url} username={p.username} size={32} />
                    <span className="text-sm text-gray-200 font-body">@{p.username}</span>
                  </a>
                ))}
              </div>
            )}

            {mostraPosts && posts.length > 0 && (
              <>
                <p className="font-mono text-xs text-gray-500 uppercase tracking-widest px-1">
                  Posts ({posts.length})
                </p>
                <motion.div className="space-y-4"
                  variants={listContainer} initial="initial" animate="animate">
                  {posts.map((p) => (
                    <motion.div key={p.id} variants={listItem}>
                      <PostCard post={p} />
                    </motion.div>
                  ))}
                </motion.div>
              </>
            )}

            {/* O teto dito na tela: busca que corta em silêncio é a mesma
                mentira do filtro que ela substituiu. */}
            {(emPosts?.noTeto || emPessoas?.noTeto) && (
              <div className="card p-4 text-center">
                <p className="font-mono text-xs text-gray-500">
                  Mostrando os mais relevantes. Há mais resultados — tente um termo mais específico.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <RightPanel />
    </div>
  );
}
