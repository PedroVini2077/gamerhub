import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Tag, ExternalLink, Gift, Users, FileText, Key } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { useRealtime } from '../../hooks/useRealtime';

export default function RightPanel() {
  const [keys, setKeys] = useState([]);
  const [promos, setPromos] = useState([]);
  const [stats, setStats] = useState({ users: 0, postsToday: 0, keysCount: 0 });

  async function fetchKeys() {
    const { data } = await supabase.from('game_keys').select('*').order('created_at', { ascending: false }).limit(10);
    if (data) {
      setKeys(data.filter(k => !k.is_promo && k.key_code));
      setPromos(data.filter(k => k.is_promo));
    }
  }

  async function fetchStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ count: users }, { count: postsToday }, { count: keysCount }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('game_keys').select('*', { count: 'exact', head: true }).eq('is_promo', false),
    ]);

    setStats({ users: users || 0, postsToday: postsToday || 0, keysCount: keysCount || 0 });
  }

  useEffect(() => {
    fetchKeys();
    fetchStats();
  }, []);

  useRealtime('posts', () => fetchStats());
  useRealtime('game_keys', () => { fetchKeys(); fetchStats(); });
  useRealtime('profiles', () => fetchStats());

  return (
    <aside className="hidden xl:flex flex-col w-72 shrink-0 gap-4">
      {/* Keys grátis */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Gift size={15} className="text-neon-green" />
          <h3 className="font-display text-xs text-neon-green tracking-widest uppercase">Keys Grátis</h3>
        </div>
        {keys.length === 0 ? (
          <p className="text-xs text-gray-500 font-mono">Sem keys no momento</p>
        ) : (
          <div className="space-y-3">
            {keys.map(k => (
              <div key={k.id} className="border border-dark-400 rounded p-3 hover:border-neon-green/30 transition-colors">
                <p className="text-sm font-semibold text-white mb-1">{k.game_title}</p>
                <span className="tag tag-green">{k.platform}</span>
                {k.key_code && (
                  <p className="mt-2 font-mono text-xs text-neon-green bg-dark-700 px-2 py-1 rounded break-all">
                    {k.key_code}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promoções */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Tag size={15} className="text-neon-purple" />
          <h3 className="font-display text-xs text-neon-purple tracking-widest uppercase">Promoções</h3>
        </div>
        {promos.length === 0 ? (
          <p className="text-xs text-gray-500 font-mono">Sem promoções no momento</p>
        ) : (
          <div className="space-y-3">
            {promos.map(p => (
              <div key={p.id} className="border border-dark-400 rounded p-3 hover:border-neon-purple/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{p.game_title}</p>
                  {p.discount_percent > 0 && (
                    <span className="tag tag-purple shrink-0">-{p.discount_percent}%</span>
                  )}
                </div>
                <span className="tag tag-cyan mt-1">{p.platform}</span>
                {p.promo_url && (
                  <a href={p.promo_url} target="_blank" rel="noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs text-neon-cyan hover:underline">
                    Ver oferta <ExternalLink size={11} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats reais */}
      <div className="card p-4">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase mb-3">Status</h3>
        <div className="space-y-2">
          {[
            { label: 'Membros', value: stats.users, icon: Users, color: 'text-neon-cyan' },
            { label: 'Posts hoje', value: stats.postsToday, icon: FileText, color: 'text-neon-green' },
            { label: 'Keys ativas', value: stats.keysCount, icon: Key, color: 'text-neon-purple' },
          ].map(s => (
            <div key={s.label} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <s.icon size={12} className={s.color} />
                <span className="text-xs text-gray-400 font-mono">{s.label}</span>
              </div>
              <span className={`text-sm font-bold font-mono ${s.color}`}>{formatNumber(s.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
