import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import MuralCard from '../components/community/MuralCard';
import MuralForm from '../components/community/MuralForm';
import { useRealtime } from '../hooks/useRealtime';
import { Users } from 'lucide-react';

export default function Community() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetch() {
    const { data } = await supabase
      .from('community_posts')
      .select('*, profiles(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, []);

  useRealtime('community_posts', () => fetch());

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} className="text-neon-purple" />
          <h1 className="font-display text-sm text-neon-purple tracking-widest uppercase">Mural da Comunidade</h1>
        </div>
        <p className="text-xs text-gray-500 font-mono">Fale com a galera — sem filtro, só respeito.</p>
      </div>

      <MuralForm onPost={fetch} />

      {loading ? (
        <div className="card p-5 animate-pulse">
          <div className="h-4 bg-dark-500 rounded w-1/2 mb-2" />
          <div className="h-3 bg-dark-500 rounded" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-mono text-gray-500 text-sm">Mural vazio. Quebra o gelo! 💬</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(i => <MuralCard key={i.id} item={i} onDelete={fetch} />)}
        </div>
      )}
    </div>
  );
}
