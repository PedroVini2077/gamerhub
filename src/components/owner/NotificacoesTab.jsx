import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '../../lib/motion';
import {
  RefreshCw, UserX, UserCheck, Key, AlertTriangle, Trash2,
  UserPlus, Tv, MonitorOff, Settings2, Bell, Siren, FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const KIND_CFG = {
  ban:          { Icon: UserX,         color: '#ef4444' },
  unban:        { Icon: UserCheck,     color: '#22c55e' },
  role_change:  { Icon: Key,           color: '#f97316' },
  alert:        { Icon: AlertTriangle, color: '#ef4444' },
  delete:       { Icon: Trash2,        color: '#6b7280' },
  new_user:     { Icon: UserPlus,      color: '#22d3ee' },
  new_live:     { Icon: Tv,            color: '#39ff14' },
  live_ended:   { Icon: MonitorOff,     color: '#6b7280' },
  activity:     { Icon: Settings2,     color: '#6b7280' },
  notification: { Icon: Bell,          color: '#a855f7' },
  user_banned:  { Icon: UserX,         color: '#ef4444' },
  staff_alert:  { Icon: Siren,         color: '#ef4444' },
};
const DEFAULT_KIND = { Icon: FileText, color: '#6b7280' };

export default function NotificacoesTab() {
  const [refreshing, setRefreshing] = useState(false);

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

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetch(), new Promise(r => setTimeout(r, 500))]);
    setRefreshing(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Últimas 50 notificações</p>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Atualizando...' : 'Atualizar'}
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
            const cfg = KIND_CFG[n.kind] || DEFAULT_KIND;
            const { Icon } = cfg;
            return (
              <motion.div key={n.id ?? i} variants={listItem}
                className="flex items-start gap-3 px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg">
                <Icon size={14} style={{ color: cfg.color }} className="shrink-0 mt-0.5" />
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
