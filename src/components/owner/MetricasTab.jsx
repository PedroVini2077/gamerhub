import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const OC = '#f97316';

export default function MetricasTab() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('owner_get_metrics');
    if (error) toast.error('Erro: ' + error.message);
    else setMetrics(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-dark-700 rounded-xl animate-pulse" />)}
    </div>
  );

  if (!metrics) return (
    <div className="card p-8 text-center">
      <p className="text-xs text-gray-500 font-mono">Erro ao carregar métricas.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Ativos 7d',    value: metrics.active_7d,    color: '#39ff14', Icon: Activity   },
          { label: 'Inativos 30d', value: metrics.inactive_30d, color: '#ef4444', Icon: Activity   },
          { label: 'XP Total',     value: metrics.total_xp,     color: OC,        Icon: TrendingUp },
        ].map(c => (
          <div key={c.label} className="card p-4" style={{ borderColor: `${c.color}25` }}>
            <c.Icon size={13} style={{ color: c.color }} className="mb-2 opacity-60" />
            <p className="font-display text-2xl font-bold" style={{ color: c.color }}>{c.value ?? 0}</p>
            <p className="text-xs font-mono text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {metrics.top_users?.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Top usuários por XP</p>
          <div className="space-y-2">
            {metrics.top_users.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2 bg-dark-700 rounded-lg">
                <span className="text-xs font-mono font-bold w-5 text-center"
                  style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : i === 2 ? OC : '#6b7280' }}>
                  {i + 1}
                </span>
                <Link to={`/u/${u.username}`}
                  className="flex-1 text-xs font-mono text-gray-200 hover:text-orange-400 transition-colors">
                  @{u.username}
                </Link>
                <span className="text-xs font-mono font-bold" style={{ color: OC }}>{u.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics.top_posts?.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Posts mais curtidos</p>
          <div className="space-y-2">
            {metrics.top_posts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-dark-700 rounded-lg">
                <span className="text-xs font-mono font-bold w-5 text-center"
                  style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#d1d5db' : i === 2 ? OC : '#6b7280' }}>
                  {i + 1}
                </span>
                <p className="flex-1 text-xs font-mono text-gray-400 truncate">{p.content}</p>
                <span className="text-xs font-mono font-bold" style={{ color: '#22d3ee' }}>{p.likes} ♥</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={load}
        className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-orange-400 transition-colors">
        <RefreshCw size={12} />Atualizar
      </button>
    </div>
  );
}
