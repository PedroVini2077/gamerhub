import { useState, useEffect, useCallback } from 'react';
import { fetchViolations } from '../../services/moderationService';
import { supabase } from '../../lib/supabase';
import { ShieldAlert } from 'lucide-react';

const ACTION_LABEL = {
  warn:       { label: 'Aviso',        cls: 'tag-cyan' },
  hide:       { label: 'Ocultado',     cls: 'tag-purple' },
  suspend_1d: { label: 'Suspenso 1d',  cls: 'tag-green' },
  suspend_7d: { label: 'Suspenso 7d',  cls: 'tag-green' },
  ban:        { label: 'Banido',       cls: 'text-red-400 border border-red-500/40 bg-red-500/10 px-2 py-0.5 rounded text-xs font-mono' },
};

const PAGE_SIZE = 20;

export default function ViolationsPanel() {
  const [items, setItems]     = useState([]);
  const [count, setCount]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');

  const load = useCallback(async (p = 0, username = '') => {
    setLoading(true);
    let userId = null;
    if (username.trim()) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', `%${username.trim()}%`)
        .limit(50);
      if (!profiles?.length) {
        setItems([]);
        setCount(0);
        setLoading(false);
        return;
      }
      // Se só um resultado, filtra direto; se vários, busca violations de todos
      userId = profiles.length === 1 ? profiles[0].id : profiles.map(p => p.id);
    }
    const { items: data, count: total } = await fetchViolations(userId, p, PAGE_SIZE);
    setItems(data);
    setCount(total);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { load(0, filter); }, 400);
    return () => clearTimeout(t);
  }, [filter, load]);

  return (
    <div className="space-y-4">
      <input className="input-gamer text-sm" placeholder="Filtrar por @username..."
        value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} />

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-dark-700 rounded animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <ShieldAlert size={28} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm font-mono text-gray-500">Nenhuma infração registrada.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-dark-500 text-gray-500 uppercase tracking-wider">
                <th className="text-left p-3">Usuário</th>
                <th className="text-left p-3">Ação</th>
                <th className="text-left p-3">Pontos</th>
                <th className="text-left p-3 hidden md:table-cell">Motivo</th>
                <th className="text-left p-3 hidden sm:table-cell">Revisor</th>
                <th className="text-left p-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {items.map(v => {
                const a = ACTION_LABEL[v.action_taken] || { label: v.action_taken, cls: 'tag-cyan' };
                return (
                  <tr key={v.id} className="border-b border-dark-600 hover:bg-dark-700/50 transition-colors">
                    <td className="p-3 text-white">
                      @{v.user_profile?.username || '?'}
                    </td>
                    <td className="p-3">
                      <span className={`tag ${a.cls}`}>{a.label}</span>
                    </td>
                    <td className="p-3 text-neon-green font-bold">+{v.points}</td>
                    <td className="p-3 text-gray-400 hidden md:table-cell max-w-[150px] truncate">{v.reason || '—'}</td>
                    <td className="p-3 text-gray-500 hidden sm:table-cell">
                      @{v.reviewer?.username || 'Sistema'}
                    </td>
                    <td className="p-3 text-gray-500">
                      {new Date(v.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(page > 0 || count > PAGE_SIZE) && (
        <div className="flex items-center justify-between text-xs font-mono text-gray-500 pt-1">
          <button disabled={page === 0} onClick={() => { const p = page - 1; setPage(p); load(p, filter); }}
            className="px-3 py-1.5 border border-dark-400 rounded hover:text-white disabled:opacity-40 transition-all">
            ← Anterior
          </button>
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} de {count}</span>
          <button disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => { const p = page + 1; setPage(p); load(p, filter); }}
            className="px-3 py-1.5 border border-dark-400 rounded hover:text-white disabled:opacity-40 transition-all">
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
