import { useState } from 'react';
import { Bell, RotateCcw } from 'lucide-react';
import { notifMeta } from '../../lib/logMeta';

// Os ícones vêm de `lib/logMeta` — a lista local anterior tinha um branch morto
// (`security_alert`, tipo que o banco nunca gera) e não cobria suspensão,
// banimento automático nem alerta de staff.
function NotifIcon({ type }) {
  const { Icon, cls } = notifMeta(type);
  return <Icon size={15} className={cls} />;
}

export default function NotifsPanel({ notifications, readIds, notifLoading, fetchNotifications }) {
  const [spinning, setSpinning] = useState(false);
  async function handleRefresh() {
    setSpinning(true);
    await Promise.all([fetchNotifications(), new Promise(r => setTimeout(r, 500))]);
    setSpinning(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-neon-cyan" />
          <h3 className="font-display text-sm text-neon-cyan uppercase tracking-wider">Notificações</h3>
        </div>
        <button onClick={handleRefresh} disabled={spinning || notifLoading}
          className="text-xs font-mono text-gray-500 hover:text-neon-cyan transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
          <RotateCcw size={11} className={spinning || notifLoading ? 'animate-spin' : ''} />
          {spinning || notifLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {notifLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-dark-700 rounded-xl animate-pulse" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-8 text-center">
          <Bell size={28} className="text-gray-600 mx-auto mb-2" />
          <p className="text-xs font-mono text-gray-500">Nenhuma notificação ainda</p>
        </div>
      ) : notifications.map(n => {
        const isRead = readIds.has(n.id);
        return (
          <div key={n.id} className={`card p-4 flex items-start gap-3 transition-all ${
            isRead ? 'opacity-60' : 'border-neon-cyan/20'
          }`}>
            <span className="shrink-0 mt-0.5"><NotifIcon type={n.type} /></span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono font-bold text-white">{n.title}</p>
                {!isRead && <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan shrink-0" />}
                {n.audience === 'super_admin' && (
                  <span className="tag tag-green shrink-0" style={{ fontSize: 9, padding: '1px 4px' }}>super admin</span>
                )}
              </div>
              <p className="text-xs font-mono text-gray-400 mt-0.5">{n.message}</p>
              <p className="text-xs font-mono text-gray-600 mt-1">
                {new Date(n.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
