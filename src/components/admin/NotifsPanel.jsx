import { Bell, RotateCcw, UserPlus, Radio, Tv, ShieldAlert, Ban, Shield } from 'lucide-react';

function getNotifIcon(type) {
  if (type === 'new_user')             return <UserPlus size={15} className="text-neon-cyan" />;
  if (type === 'new_live')             return <Radio size={15} className="text-red-400" />;
  if (type === 'live_ended')           return <Tv size={15} className="text-gray-500" />;
  if (type === 'live_reactivated')     return <RotateCcw size={15} className="text-neon-green" />;
  if (type === 'reactivation_request') return <RotateCcw size={15} className="text-yellow-400" />;
  if (type === 'security_alert')       return <ShieldAlert size={15} className="text-red-400" />;
  if (type === 'user_banned')          return <Ban size={15} className="text-red-400" />;
  if (type === 'unban_request')        return <RotateCcw size={15} className="text-yellow-400" />;
  if (type === 'unban_approved')       return <Shield size={15} className="text-neon-green" />;
  if (type === 'banned_login_attempt') return <ShieldAlert size={15} className="text-red-400" />;
  return <Bell size={15} className="text-gray-500" />;
}

export default function NotifsPanel({ notifications, readIds, notifLoading, fetchNotifications }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-neon-cyan" />
          <h3 className="font-display text-sm text-neon-cyan uppercase tracking-wider">Notificações</h3>
        </div>
        <button onClick={fetchNotifications} disabled={notifLoading}
          className="text-xs font-mono text-gray-500 hover:text-neon-cyan transition-colors">
          <RotateCcw size={11} className={`inline mr-1 ${notifLoading ? 'animate-spin' : ''}`} />
          {notifLoading ? 'Carregando...' : 'Atualizar'}
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
            <span className="shrink-0 mt-0.5">{getNotifIcon(n.type)}</span>
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
