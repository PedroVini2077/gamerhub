import { Activity, RotateCcw, ScrollText, FileText, LogIn, LogOut, AlertTriangle, UserPlus, Ban, Clock, ShieldOff, LockOpen, Trash2, Pencil, Tv, CheckCircle, XCircle, Crown, Shield } from 'lucide-react';

const iconMap = {
  auth_login_success:   { Icon: LogIn,       cls: 'text-neon-green' },
  auth_login_failed:    { Icon: AlertTriangle,cls: 'text-yellow-400' },
  auth_logout:          { Icon: LogOut,       cls: 'text-gray-400' },
  auth_register:        { Icon: UserPlus,     cls: 'text-neon-cyan' },
  auth_banned_attempt:  { Icon: Ban,          cls: 'text-red-400' },
  auth_rate_limited:    { Icon: Clock,        cls: 'text-yellow-400' },
  auth_permanent_block: { Icon: ShieldOff,    cls: 'text-red-500' },
  admin_unlock_login:   { Icon: LockOpen,     cls: 'text-neon-green' },
  content_post_created: { Icon: FileText,     cls: 'text-neon-green' },
  content_post_deleted: { Icon: Trash2,       cls: 'text-red-400' },
  content_post_edited:  { Icon: Pencil,       cls: 'text-gray-400' },
  live_ended:           { Icon: Tv,           cls: 'text-gray-500' },
  live_reactivated:     { Icon: RotateCcw,    cls: 'text-neon-green' },
  reactivation_requested:{ Icon: RotateCcw,  cls: 'text-yellow-400' },
  reactivation_approved:{ Icon: CheckCircle,  cls: 'text-neon-green' },
  reactivation_denied:  { Icon: XCircle,      cls: 'text-red-400' },
  admin_ban:              { Icon: Ban,           cls: 'text-red-400' },
  admin_unban:            { Icon: Shield,        cls: 'text-neon-green' },
  admin_unban_requested:  { Icon: RotateCcw,    cls: 'text-yellow-400' },
  admin_unban_approved:   { Icon: CheckCircle,   cls: 'text-neon-green' },
  admin_unban_denied:     { Icon: XCircle,       cls: 'text-red-400' },
  admin_role_changed:     { Icon: Crown,         cls: 'text-yellow-400' },
  admin_delete_posts:     { Icon: Trash2,        cls: 'text-red-400' },
};

export default function LogsPanel({ logs, logCat, setLogCat, logsLoading, fetchLogs }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-neon-purple" />
          <h3 className="font-display text-sm text-neon-purple uppercase tracking-wider">Atividade do Site</h3>
        </div>
        <button onClick={() => fetchLogs(logCat)} disabled={logsLoading}
          className="text-xs font-mono text-gray-500 hover:text-neon-purple transition-colors flex items-center gap-1">
          <RotateCcw size={11} className={logsLoading ? 'animate-spin' : ''} />
          {logsLoading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'todos',    label: 'Todos' },
          { id: 'auth',     label: 'Auth' },
          { id: 'security', label: 'Segurança' },
          { id: 'content',  label: 'Conteúdo' },
          { id: 'admin',    label: 'Admin' },
        ].map(c => (
          <button key={c.id} onClick={() => setLogCat(c.id)}
            className={`tag cursor-pointer transition-all ${
              logCat === c.id ? 'tag-purple' : 'opacity-40 hover:opacity-70 tag-cyan'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {logsLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="card p-3 animate-pulse">
              <div className="h-3 bg-dark-500 rounded w-3/4 mb-2" />
              <div className="h-2 bg-dark-500 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : !logs.length ? (
        <div className="card p-8 text-center">
          <Activity size={28} className="text-gray-600 mx-auto mb-2" />
          <p className="text-xs font-mono text-gray-500">Nenhuma atividade registrada</p>
        </div>
      ) : logs.map(log => {
        const { Icon = ScrollText, cls = 'text-gray-500' } = iconMap[log.action] || {};
        const severityDot =
          log.severity === 'critical' ? 'bg-red-500 animate-pulse' :
          log.severity === 'warning'  ? 'bg-yellow-400' :
                                        'bg-gray-600';
        return (
          <div key={log.id} className={`card p-3 flex items-start gap-3 ${
            log.severity === 'critical' ? 'border-red-500/20 bg-red-500/5' :
            log.severity === 'warning'  ? 'border-yellow-400/10' : ''
          }`}>
            <Icon size={14} className={`${cls} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-gray-300 leading-relaxed">{log.details}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${severityDot}`} />
                <span className="text-xs font-mono text-gray-600">{log.actor_username || log.admin_username}</span>
                <span className="text-gray-700 text-xs">·</span>
                <span className="text-xs font-mono text-gray-600">
                  {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="tag opacity-50 shrink-0" style={{ fontSize: 9, padding: '1px 5px' }}>{log.category}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
