import { useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '../lib/motion';
import { fetchMuralPage } from '../services/communityService';
import MuralCard from '../components/community/MuralCard';
import MuralForm from '../components/community/MuralForm';
import { useRealtime } from '../hooks/useRealtime';
import { Users } from 'lucide-react';

const PAGE_SIZE = 20;

export default function Community() {
  const fetchDebounceRef = useRef(null);

  const {
    data, isPending: loading, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['mural_posts'],
    queryFn: ({ pageParam }) => fetchMuralPage({ limit: PAGE_SIZE, before: pageParam }),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1].created_at : undefined,
  });

  const items = data?.pages.flat() ?? [];

  const reload = useCallback(() => { refetch(); }, [refetch]);

  useRealtime('community_posts', () => {
    clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(reload, 300);
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} className="text-neon-purple" />
          <h1 className="font-display text-sm text-neon-purple tracking-widest uppercase">Mural da Comunidade</h1>
        </div>
        <p className="text-xs text-gray-500 font-mono">Fale com a galera — sem filtro, só respeito.</p>
      </div>

      <MuralForm onPost={reload} />

      {loading ? (
        <div className="card p-5 animate-pulse">
          <div className="h-4 bg-dark-500 rounded w-1/2 mb-2" />
          <div className="h-3 bg-dark-500 rounded" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-mono text-gray-500 text-sm">Mural vazio. Quebra o gelo!</p>
        </div>
      ) : (
        <>
          <motion.div className="space-y-3"
            variants={listContainer} initial="initial" animate="animate">
            {items.map(i => (
              <motion.div key={i.id} variants={listItem}>
                <MuralCard item={i} onDelete={reload} />
              </motion.div>
            ))}
          </motion.div>

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="btn-neon w-full py-2.5 text-xs disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
