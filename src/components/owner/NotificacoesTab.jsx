import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '../../lib/motion';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const KIND_CFG = {
  ban:          { emoji: '🚫', color: '#ef4444' },
  unban:        { emoji: '✅', color: '#22c55e' },
  role_change:  { emoji: '🔑', color: '#f97316' },
  alert:        { emoji: '⚠️', color: '#ef4444' },
  delete:       { emoji: '🗑️', color: '#6b7280' },
  new_user:     { emoji: '👤', color: '#22d3ee' },
  new_live:     { emoji: '📡', color: '#39ff14' },
  live_ended:   { emoji: '📴', color: '#6b7280' },
  activity:     { emoji: '⚙️', color: '#6b7280' },
  notification: { emoji: '🔔', color: '#a855f7' },
  user_banned:  { emoji: '🚫', color: '#ef4444' },
  staff_alert:  { emoji: '🚨', color: '#ef4444' },
};

export default function NotificacoesTab() {
  const { data: notifs = [], isPending: loading, refetch } = useQuery({
    queryKey: ['owner_notifications'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('owner_get_notifications', { p_limit: 50 });
      if (error) { toast.error('Erro: ' + error.message); return []; }
      return data || [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel('owner-notif-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => refetch())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_logs' }, () => refetch())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Últimas 50 notificações</p>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-orange-400 transition-colors">
          <RefreshCw size={12} />Atualizar
        </button>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />)}
        </div>
      ) : notifs.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-xs text-gray-500 font-mono">Nenhuma notificação.</p>
        </div>
      ) : (
        <motion.div className="space-y-1"
          variants={listContainer} initial="initial" animate="animate">
          {notifs.map((n, i) => {
            const cfg = KIND_CFG[n.kind] || { emoji: '📋', color: '#6b7280' };
            return (
              <motion.div key={n.id ?? i} variants={listItem}
                className="flex items-start gap-3 px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg">
                <span className="text-sm shrink-0 leading-none mt-0.5">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono break-words" style={{ color: cfg.color }}>
                    {n.body || n.action}
                  </p>
                  <p className="text-xs font-mono text-gray-600 mt-0.5 break-words">
                    {n.actor && n.actor !== 'sistema' ? `@${n.actor} · ` : ''}{n.action}
                  </p>
                </div>
                <p className="text-xs font-mono text-gray-700 shrink-0 whitespace-nowrap">
                  {new Date(n.created_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
