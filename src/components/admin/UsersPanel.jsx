import { useState } from 'react';
import { Users, Ban, Shield, RotateCcw, Clock, Trash2, ChevronUp, ChevronDown, Search, UserPlus, ShieldAlert } from 'lucide-react';
import Avatar from '../ui/Avatar';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green', owner: 'tag-orange' };

function UserRow({ user, currentUserId, isSuperAdmin, onNominate, onDemote, onBanClick, onUnbanDirect, onRequestUnban, onDeletePosts, pendingUnbanIds }) {
  const [expanded, setExpanded] = useState(false);
  const isMe = user.id === currentUserId;
  const canEdit = !isMe && user.role !== 'owner' && (isSuperAdmin ? user.role !== 'super_admin' : user.role === 'user');
  const canBan  = !isMe && user.role !== 'owner' && (isSuperAdmin ? user.role !== 'super_admin' : user.role === 'user');
  const hasUnbanPending = pendingUnbanIds?.has(user.id);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Avatar profile={user} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{user.username}</p>
            {isMe && <span className="text-xs text-gray-500 font-mono shrink-0">(você)</span>}
            {user.banned && <span className="tag tag-pink shrink-0">banido</span>}
          </div>
          {user.banned && user.ban_reason && (
            <p className="text-xs text-red-400/60 font-mono truncate mt-0.5">{user.ban_reason}</p>
          )}
        </div>
        <span className={`tag ${roleColors[user.role] || 'tag-cyan'} shrink-0`}>{user.role}</span>
        {(canEdit || canBan) && (
          <button onClick={() => setExpanded(e => !e)}
            className="text-gray-500 hover:text-white transition-colors ml-1 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>
      {expanded && (canEdit || canBan) && (
        <div className="border-t border-dark-500 bg-dark-700 px-4 py-3 space-y-3">
          {user.banned && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-mono text-red-400 font-bold">{user.ban_reason}</p>
                {user.ban_count > 1 && (
                  <span className="tag tag-pink" style={{ fontSize: 9, padding: '1px 5px' }}>
                    reincidente · {user.ban_count}x
                  </span>
                )}
              </div>
              {user.ban_details && <p className="text-xs font-mono text-gray-400">{user.ban_details}</p>}
              <p className="text-xs font-mono text-gray-500">
                banido por @{user.banned_by_username || '?'}
                {user.banned_at && ` · ${new Date(user.banned_at).toLocaleDateString('pt-BR')}`}
              </p>
            </div>
          )}
          {canEdit && !user.banned && (
            <div>
              <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">Cargo:</p>
              <div className="flex gap-2 flex-wrap">
                {user.role === 'user' && (
                  <button onClick={() => { onNominate(user, 'admin'); setExpanded(false); }}
                    className="flex items-center gap-1.5 text-xs font-mono text-purple-300/80 hover:text-purple-300 border border-purple-400/30 hover:border-purple-400/60 px-3 py-1.5 rounded transition-all">
                    <UserPlus size={12} />Indicar para Staff
                  </button>
                )}
                {user.role === 'admin' && isSuperAdmin && (
                  <button onClick={() => { onNominate(user, 'super_admin'); setExpanded(false); }}
                    className="flex items-center gap-1.5 text-xs font-mono text-neon-green/80 hover:text-neon-green border border-neon-green/30 hover:border-neon-green/60 px-3 py-1.5 rounded transition-all">
                    <UserPlus size={12} />Indicar p/ Super Admin
                  </button>
                )}
                {(user.role === 'admin' || user.role === 'super_admin') && (
                  <button onClick={() => { onDemote(user); setExpanded(false); }}
                    className="flex items-center gap-1.5 text-xs font-mono text-red-400/70 hover:text-red-400 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded transition-all">
                    <ShieldAlert size={12} />Solicitar rebaixamento
                  </button>
                )}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">Ações:</p>
            <div className="flex gap-2 flex-wrap">
              {canBan && !user.banned && (
                <button onClick={() => { onBanClick(user); setExpanded(false); }}
                  className="flex items-center gap-1.5 text-xs font-mono text-red-400/80 hover:text-red-400 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded transition-all">
                  <Ban size={12} />Banir usuário
                </button>
              )}
              {user.banned && isSuperAdmin && (
                <button onClick={() => { onUnbanDirect(user); setExpanded(false); }}
                  className="flex items-center gap-1.5 text-xs font-mono text-neon-green border border-neon-green/30 hover:bg-neon-green/10 px-3 py-1.5 rounded transition-all">
                  <Shield size={12} />Desbanir
                </button>
              )}
              {user.banned && !isSuperAdmin && (
                hasUnbanPending ? (
                  <span className="flex items-center gap-1.5 text-xs font-mono text-gray-500 border border-dark-400 px-3 py-1.5 rounded cursor-default">
                    <Clock size={12} />Em análise...
                  </span>
                ) : (
                  <button onClick={() => { onRequestUnban(user); setExpanded(false); }}
                    className="flex items-center gap-1.5 text-xs font-mono text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/10 px-3 py-1.5 rounded transition-all">
                    <RotateCcw size={12} />Solicitar Desbanimento
                  </button>
                )
              )}
              {user.role === 'user' && !user.banned && (
                <button onClick={() => onDeletePosts(user.id, user.username)}
                  className="flex items-center gap-1.5 text-xs font-mono text-red-400/70 hover:text-red-400 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded transition-all">
                  <Trash2 size={12} />Deletar posts
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPanel({
  users, currentUserId, isSuperAdmin,
  userSearch, setUserSearch, filterRole, setFilterRole,
  onNominate, onDemote, setBanModal, setUnbanDirectModal, setUnbanReqModal,
  handleDeletePosts, pendingUnbanIds,
}) {
  const searchLower = userSearch.toLowerCase();
  const filteredUsers = users.filter(u => {
    const matchSearch = !searchLower || u.username.toLowerCase().includes(searchLower);
    const matchRole = filterRole === 'todos' ? true
      : filterRole === 'banidos' ? u.banned
      : u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          className="input-gamer w-full text-xs"
          style={{ paddingLeft: '2rem' }}
          placeholder="Buscar por username..."
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'todos',       label: `Todos (${users.length})`,                                   active: 'tag-green' },
          { id: 'user',        label: `User (${users.filter(u => u.role === 'user').length})`,       active: 'tag-cyan' },
          { id: 'admin',       label: `Admin (${users.filter(u => u.role === 'admin').length})`,     active: 'tag-purple' },
          { id: 'super_admin', label: `Super Admin (${users.filter(u => u.role === 'super_admin').length})`, active: 'tag-green' },
          { id: 'banidos',     label: `Banidos (${users.filter(u => u.banned).length})`,             active: 'tag-pink' },
        ].map(({ id, label, active }) => (
          <button key={id} onClick={() => setFilterRole(id)}
            className={`tag cursor-pointer transition-all ${
              filterRole === id ? active : 'opacity-40 hover:opacity-70 tag-cyan'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {filteredUsers.length === 0 ? (
        <div className="card p-8 text-center">
          <Users size={28} className="text-gray-600 mx-auto mb-2" />
          <p className="text-xs font-mono text-gray-500">Nenhum usuário encontrado</p>
        </div>
      ) : filteredUsers.map(u => (
        <UserRow key={u.id} user={u} currentUserId={currentUserId}
          isSuperAdmin={isSuperAdmin} onNominate={onNominate} onDemote={onDemote}
          onBanClick={u => setBanModal(u)}
          onUnbanDirect={u => setUnbanDirectModal(u)}
          onRequestUnban={u => setUnbanReqModal(u)}
          onDeletePosts={handleDeletePosts}
          pendingUnbanIds={pendingUnbanIds} />
      ))}
    </div>
  );
}
