import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { gridContainer, gridCard } from '../../lib/motion';
import { Users, Shield, FileText, Key, RefreshCw, Wifi } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const OC = '#f97316';

export default function PainelTab({ onlineCount }) {
  const { data: stats, isPending: loading, refetch } = useQuery({
    queryKey: ['owner_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('owner_get_stats');
      if (error) { toast.error('Erro ao carregar stats: ' + error.message); return null; }
      return data;
    },
    retry: false,
  });

  if (loading) return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-dark-700 rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  if (!stats) return (
    <div className="card p-8 text-center">
      <p className="text-xs text-gray-500 font-mono">Erro ao carregar dados.</p>
    </div>
  );

  const row1 = [
    { label: 'Membros',  value: stats.total_users,  color: '#22d3ee', Icon: Users  },
    { label: 'Online',   value: onlineCount,         color: '#39ff14', Icon: Wifi   },
    { label: 'Admins',   value: stats.admins,        color: '#a855f7', Icon: Shield },
    { label: 'Banidos',  value: stats.banned_users,  color: '#ef4444', Icon: Users  },
  ];
  const row2 = [
    { label: 'Posts Hoje', value: stats.posts_today, color: '#fbbf24', Icon: FileText },
    { label: 'Posts 30d',  value: stats.posts_30d,   color: OC,        Icon: FileText },
    { label: 'Keys Hoje',  value: stats.keys_today,  color: '#22d3ee', Icon: Key     },
    { label: 'Keys Total', value: stats.total_keys,  color: '#39ff14', Icon: Key     },
  ];

  const daily  = stats.daily_signups || [];
  const maxCnt = Math.max(...daily.map(d => d.count), 1);

  return (
    <div className="space-y-4">
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3"
        variants={gridContainer} initial="initial" animate="animate">
        {row1.map(c => (
          <motion.div key={c.label} variants={gridCard} className="card p-4" style={{ borderColor: `${c.color}25` }}>
            <c.Icon size={13} style={{ color: c.color }} className="mb-2 opacity-60" />
            <p className="font-display text-2xl font-bold" style={{ color: c.color }}>{c.value ?? 0}</p>
            <p className="text-xs font-mono text-gray-500 mt-0.5">{c.label}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3"
        variants={gridContainer} initial="initial" animate="animate">
        {row2.map(c => (
          <motion.div key={c.label} variants={gridCard} className="card p-4" style={{ borderColor: `${c.color}25` }}>
            <c.Icon size={13} style={{ color: c.color }} className="mb-2 opacity-60" />
            <p className="font-display text-2xl font-bold" style={{ color: c.color }}>{c.value ?? 0}</p>
            <p className="text-xs font-mono text-gray-500 mt-0.5">{c.label}</p>
          </motion.div>
        ))}
      </motion.div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Novos membros — últimos 14 dias
          </p>
          {stats.users_today > 0 && (
            <span className="text-xs font-mono font-bold" style={{ color: OC }}>
              +{stats.users_today} hoje
            </span>
          )}
        </div>
        <div className="flex items-end gap-1 h-20">
          {daily.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full rounded-sm transition-all"
                style={{
                  height: `${d.count > 0 ? Math.max((d.count / maxCnt) * 64, 8) : 3}px`,
                  background: d.count > 0 ? OC : '#2e2e3e',
                  opacity: d.count > 0 ? 1 : 0.5,
                }} />
              <p className="font-mono text-gray-700 leading-none" style={{ fontSize: 8 }}>
                {new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => refetch()}
        className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-orange-400 transition-colors">
        <RefreshCw size={12} />Atualizar
      </button>
    </div>
  );
}
