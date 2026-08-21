import { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Mail, UserX, UserCheck, UserPlus, ShieldAlert } from 'lucide-react';
import { roleLabel, roleDotColor } from '../../../lib/roleLabels';
import RoleOverride from './RoleOverride';

const OWNER_COLOR = '#f97316';

function BanHistory({ user }) {
  return (
    <div className="space-y-1">
      {user.email && (
        <p className="flex items-center gap-1.5 text-xs font-mono text-gray-600">
          <Mail size={10} className="shrink-0" />{user.email}
        </p>
      )}
      {user.banned && user.ban_reason && (
        <p className="text-xs font-mono text-red-400/70">
          Motivo: {user.ban_reason}{user.ban_details ? ` — ${user.ban_details}` : ''}
        </p>
      )}
      {user.banned_by_username && (
        <p className="text-xs font-mono text-gray-600">
          Banido por @{user.banned_by_username}
          {user.banned_at ? ` em ${new Date(user.banned_at).toLocaleDateString('pt-BR')}` : ''}
        </p>
      )}
      {user.ban_count > 0 && (
        <p className="text-xs font-mono text-gray-700">{user.ban_count}× banido no histórico</p>
      )}
    </div>
  );
}

/** Linha de usuário no painel do fundador — recolhida, expande as ações. */
const UserRow = memo(function UserRow({ user, onNominate, onDemote, onBan, onOverride }) {
  const [open, setOpen] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const isOwnerUser = user.role === 'owner';

  return (
    <div className="card p-0 overflow-hidden">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/40 transition-colors text-left">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: roleDotColor(user.role) }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-mono text-white">{user.username}</span>
            {user.banned && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-400/15 text-red-400">banido</span>
            )}
            {isOwnerUser && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: '#f9731618', color: OWNER_COLOR }}>fundador</span>
            )}
            {user.ban_count > 0 && !user.banned && (
              <span className="text-xs font-mono text-gray-700">{user.ban_count}× ban</span>
            )}
          </div>
          <p className="text-xs font-mono text-gray-600 mt-0.5">
            {roleLabel(user.role)} · {user.xp ?? 0} XP · {user.post_count ?? 0} posts
          </p>
        </div>
        <ChevronDown size={14}
          className={`text-gray-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-3 pt-2 border-t border-dark-600 space-y-2">
          <BanHistory user={user} />

          <div className="flex flex-wrap gap-2 items-center">
            <Link to={`/u/${user.username}`}
              className="px-3 py-1.5 text-xs font-mono border border-dark-400 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-colors">
              Ver perfil
            </Link>

            {/* O fundador não é indicável, rebaixável nem banível pela própria UI. */}
            {!isOwnerUser && (
              <>
                {user.role === 'user' && (
                  <button type="button" onClick={() => onNominate(user, 'admin')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-dark-400 rounded text-gray-500 hover:border-purple-400/50 hover:text-purple-300 transition-colors">
                    <UserPlus size={12} /> Indicar para Admin
                  </button>
                )}
                {user.role === 'admin' && (
                  <button type="button" onClick={() => onNominate(user, 'super_admin')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-dark-400 rounded text-gray-500 hover:border-neon-green/50 hover:text-neon-green transition-colors">
                    <UserPlus size={12} /> Indicar p/ Super Admin
                  </button>
                )}
                {(user.role === 'admin' || user.role === 'super_admin') && (
                  <button type="button" onClick={() => onDemote(user)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-dark-400 rounded text-gray-500 hover:border-red-400/50 hover:text-red-400 transition-colors">
                    <ShieldAlert size={12} /> Solicitar rebaixamento
                  </button>
                )}
                <div className="flex-1" />
                <button type="button" onClick={() => onBan(user)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded transition-colors ${
                    user.banned
                      ? 'border-green-400/30 text-green-400 hover:bg-green-400/10'
                      : 'border-red-400/30 text-red-400 hover:bg-red-400/10'
                  }`}>
                  {user.banned ? <UserCheck size={12} /> : <UserX size={12} />}
                  {user.banned ? 'Desbanir' : 'Banir'}
                </button>
              </>
            )}
          </div>

          {!isOwnerUser && (
            <RoleOverride user={user} open={showOverride}
              onToggle={() => setShowOverride(o => !o)}
              onOverride={(u, r) => { onOverride(u, r); setShowOverride(false); }} />
          )}
        </div>
      )}
    </div>
  );
});

export default UserRow;
