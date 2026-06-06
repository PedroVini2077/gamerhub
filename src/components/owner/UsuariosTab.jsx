import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useDeferredValue } from 'react';
import { ChevronDown, Mail, UserX, UserCheck, Search, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ConfirmModal from '../ui/ConfirmModal';

const OC = '#f97316';
const ROLE_COLOR = { owner: OC, super_admin: '#39ff14', admin: '#a855f7', user: '#6b7280' };
const ROLE_LABEL = { owner: 'Fundador', super_admin: 'Super Admin', admin: 'Admin', user: 'Usuário' };

const UserRow = memo(function UserRow({ user, onSetRole, onBan }) {
  const [open, setOpen] = useState(false);
  const isOwnerUser = user.role === 'owner';

  return (
    <div className="card p-0 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/40 transition-colors text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="w-2 h-2 rounded-full shrink-0"
          style={{ background: ROLE_COLOR[user.role] || '#6b7280' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-mono text-white">{user.username}</span>
            {user.banned && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-400/15 text-red-400">banido</span>
            )}
            {isOwnerUser && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: '#f9731618', color: OC }}>fundador</span>
            )}
            {user.ban_count > 0 && !user.banned && (
              <span className="text-xs font-mono text-gray-700">{user.ban_count}× ban</span>
            )}
          </div>
          <p className="text-xs font-mono text-gray-600 mt-0.5">
            {ROLE_LABEL[user.role] || user.role} · {user.xp ?? 0} XP · {user.post_count ?? 0} posts
          </p>
        </div>
        <ChevronDown size={14}
          className={`text-gray-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-3 pt-2 border-t border-dark-600 space-y-2">
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

          <div className="flex flex-wrap gap-2 items-center">
            <Link to={`/u/${user.username}`}
              className="px-3 py-1.5 text-xs font-mono border border-dark-400 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-colors">
              Ver perfil
            </Link>

            {!isOwnerUser && (
              <>
                {['user', 'admin', 'super_admin'].map(r => (
                  <button key={r}
                    disabled={user.role === r}
                    onClick={() => onSetRole(user.id, user.username, r)}
                    className={`px-3 py-1.5 text-xs font-mono border rounded transition-colors ${
                      user.role === r
                        ? 'border-dark-500 text-dark-400 cursor-default'
                        : 'border-dark-400 text-gray-500 hover:border-orange-400/50 hover:text-orange-400'
                    }`}>
                    → {ROLE_LABEL[r]}
                  </button>
                ))}
                <div className="flex-1" />
                <button onClick={() => onBan(user)}
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
        </div>
      )}
    </div>
  );
});

export default function UsuariosTab() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [confirm, setConfirm] = useState(null);
  const deferredSearch        = useDeferredValue(search);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('owner_get_users');
    if (error) toast.error('Erro ao carregar usuários: ' + error.message);
    else setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSetRole(userId, username, newRole) {
    setConfirm({
      title: 'Alterar Role',
      message: `Alterar a role de "${username}" para "${ROLE_LABEL[newRole]}"?`,
      accent: 'orange',
      confirmLabel: 'Confirmar',
      onConfirm: async () => {
        const { error } = await supabase.rpc('owner_set_role', {
          p_target_user_id: userId,
          p_new_role: newRole,
        });
        setConfirm(null);
        if (error) toast.error(error.message);
        else { toast.success(`Role de ${username} → ${newRole}`); load(); }
      },
    });
  }

  async function handleBan(user) {
    if (user.banned) {
      setConfirm({
        title: 'Desbanir Usuário',
        message: `Desbanir "${user.username}"?`,
        accent: 'green',
        confirmLabel: 'Desbanir',
        onConfirm: async () => {
          const { error } = await supabase.rpc('unban_user', { p_user_id: user.id });
          setConfirm(null);
          if (error) toast.error(error.message);
          else { toast.success(`${user.username} desbanido!`); load(); }
        },
      });
    } else {
      setConfirm({
        title: 'Banir Usuário',
        message: `Banir "${user.username}"? O conteúdo deste usuário será removido.`,
        accent: 'red',
        confirmLabel: 'Banir',
        onConfirm: async () => {
          const { error } = await supabase.rpc('ban_user', {
            p_user_id: user.id,
            p_reason:  'Banido pelo fundador',
            p_details: null,
          });
          setConfirm(null);
          if (error) toast.error(error.message);
          else { toast.success(`${user.username} banido!`); load(); }
        },
      });
    }
  }

  const filtered = useMemo(() => users.filter(u => {
    if (deferredSearch && !u.username?.toLowerCase().includes(deferredSearch.toLowerCase())) return false;
    if (filter === 'admin'       && u.role !== 'admin')       return false;
    if (filter === 'super_admin' && u.role !== 'super_admin') return false;
    if (filter === 'banned'      && !u.banned)                return false;
    return true;
  }), [users, deferredSearch, filter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar usuário..."
            className="w-full pl-8 pr-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-300 focus:border-orange-400/50 focus:outline-none" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 focus:outline-none">
          <option value="all">Todos ({users.length})</option>
          <option value="admin">Admins</option>
          <option value="super_admin">Super Admins</option>
          <option value="banned">Banidos</option>
        </select>
        <button onClick={load}
          className="p-2 bg-dark-700 border border-dark-400 rounded text-gray-500 hover:text-orange-400 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-dark-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-xs text-gray-500 font-mono">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <UserRow key={u.id} user={u} onSetRole={handleSetRole} onBan={handleBan} />
          ))}
        </div>
      )}

      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}
