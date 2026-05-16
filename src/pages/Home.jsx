import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import PostForm from '../components/feed/PostForm';
import RightPanel from '../components/layout/RightPanel';
import { useRealtime } from '../hooks/useRealtime';
import { useAuth } from '../hooks/useAuth.jsx';
import { Zap, Search, X } from 'lucide-react';

const CATEGORIES = ['todos', 'dica', 'curiosidade', 'news'];

export default function Home() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPosts, setNewPosts] = useState(0);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('todos');
  const loadedRef = useRef(false);
  const userRef = useRef(user);
  const refreshCommentsRef = useRef({});
  const refreshLikesRef = useRef({});
  userRef.current = user;

  async function fetchPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(id, username, avatar_url, role, bio), user_id')
      .order('created_at', { ascending: false })
      .limit(30);
    setPosts(data || []);
    setLoading(false);
    setNewPosts(0);
  }

  useEffect(() => {
    fetchPosts().then(() => { loadedRef.current = true; });
  }, []);

  useRealtime('posts', (payload) => {
    if (!loadedRef.current) return;
    if (payload.eventType === 'INSERT') {
      if (payload.new?.user_id === userRef.current?.id) fetchPosts();
      else setNewPosts(n => n + 1);
    }
    if (payload.eventType === 'DELETE') fetchPosts();
  });

  useRealtime('comments', (payload) => {
    const postId = payload.new?.post_id || payload.old?.post_id;
    if (postId && refreshCommentsRef.current[postId]) {
      refreshCommentsRef.current[postId]();
    }
  });

  useRealtime('post_likes', (payload) => {
    const postId = payload.new?.post_id || payload.old?.post_id;
    if (postId && refreshLikesRef.current[postId]) {
      refreshLikesRef.current[postId]();
    }
  });

  // Filtragem local
  const filtered = posts.filter(p => {
    const matchCat = filterCat === 'todos' || p.category === filterCat;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

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
            onClick={fetchPosts}
            className="w-full card p-3 text-center text-xs font-mono text-neon-green border-neon-green/30 hover:bg-neon-green/5 transition-colors animate-fade-up"
          >
            ↑ {newPosts} novo{newPosts > 1 ? 's' : ''} post{newPosts > 1 ? 's' : ''} — clique para ver
          </button>
        )}

        <PostForm onPost={fetchPosts} />

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
              {search || filterCat !== 'todos' ? 'Nenhum post encontrado.' : 'Nenhum post ainda. Seja o primeiro! 🎮'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(p => (
              <PostCard
                key={p.id}
                post={p}
                onDelete={fetchPosts}
                registerRefresh={(fn) => { refreshCommentsRef.current[p.id] = fn; }}
                registerLikeRefresh={(fn) => { refreshLikesRef.current[p.id] = fn; }}
              />
            ))}
          </div>
        )}
      </div>
      <RightPanel />
    </div>
  );
}
