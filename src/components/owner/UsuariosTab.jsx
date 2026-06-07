import { useState, useMemo, memo } from 'react';
import { useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Mail, UserX, UserCheck, Search, RefreshCw, UserPlus, ShieldAlert, Siren } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ConfirmModal from '../ui/ConfirmModal';
import ReasonModal from '../ui/ReasonModal';
import { nominateForRole, requestRoleDemotion } from '../../services/roleNominationService';

const OC = '#f97316';
const ROLE_COLOR = { owner: OC, super_admin: '#39ff14', admin: '#a855f7', user: '#6b7280' };
const ROLE_LABEL = { owner: 'Fundador', super_admin: 'Super Admin', admin: 'Admin', user: 'Usuário' };

const UserRow = memo(function UserRow({ user, onNominate, onDemote, onBan, onOverride }) {
  const [open, setOpen] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
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
                {user.role === 'user' && (
                  <button onClick={() => onNominate(user, 'admin')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-dark-400 rounded text-gray-500 hover:border-purple-400/50 hover:text-purple-300 transition-colors">
                    <UserPlus size={12} /> Indicar para Admin
                  </button>
                )}
                {user.role === 'admin' && (
                  <button onClick={() => onNominate(user, 'super_admin')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-dark-400 rounded text-gray-500 hover:border-neon-green/50 hover:text-neon-green transition-colors">
                    <UserPlus size={12} /> Indicar p/ Super Admin
                  </button>
                )}
                {(user.role === 'admin' || user.role === 'super_admin') && (
                  <button onClick={() => onDemote(user)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-dark-400 rounded text-gray-500 hover:border-red-400/50 hover:text-red-400 transition-colors">
                    <ShieldAlert size={12} /> Solicitar rebaixamento
                  </button>
                )}
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

          {!isOwnerUser && (
            <div>
              <button onClick={() => setShowOverride(o => !o)}
                className="flex items-center gap-1.5 text-xs font-mono text-gray-700 hover:text-yellow-500 transition-colors">
                <Siren size={11} />
                {showOverride ? 'Ocultar override de emergência' : 'Override de emergência'}
              </button>
              {showOverride && (
                <div className="mt-2 p-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 space-y-2">
                  <p className="text-xs font-mono text-yellow-500/70 leading-relaxed">
                    Define o cargo na hora, ignorando indicação e avaliação. Use só em situações
                    excepcionais (bugs, comportamento inesperado do sistema, etc) — fica registrado
                    nos logs de auditoria como ação manual do fundador.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['user', 'admin', 'super_admin'].filter(r => r !== user.role).map(r => (
                      <button key={r} onClick={() => { onOverride(user, r); setShowOverride(false); }}
                        className="px-2.5 py-1 text-xs font-mono border border-yellow-500/30 rounded text-yellow-500/80 hover:bg-yellow-500/10 transition-colors">
                        → {ROLE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function UsuariosTab() {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason]   = useState(null);
  const deferredSearch        = useDeferredValue(search);

  const { data: users = [], isPending: loading, refetch } = useQuery({
    queryKey: ['owner_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('owner_get_users');
      if (error) { toast.error('Erro ao carregar usuários: ' + error.message); return []; }
      return data || [];
    },
  });

  function handleNominate(user, targetRole) {
    setConfirm({
      title: `Indicar para ${ROLE_LABEL[targetRole]}`,
      message: `Indicar "${user.username}" para o cargo de ${ROLE_LABEL[targetRole]}? A candidatura passa por análise da equipe e, se aprovada, inicia um período de avaliação.`,
      accent: 'purple',
      confirmLabel: 'Indicar',
      icon: UserPlus,
      onConfirm: async () => {
        try {
          await nominateForRole(user.id, targetRole);
          setConfirm(null);
          toast.success(`Indicação de ${user.username} enviada para análise.`);
        } catch (e) { toast.error(e.message); setConfirm(null); }
      },
    });
  }

  function handleDemote(user) {
    setReason({
      title: 'Solicitar Rebaixamento',
      icon: ShieldAlert,
      accent: 'red',
      target: user,
      subtitle: `"${user.username}" passaria de ${ROLE_LABEL[user.role]} para Usuário. A solicitação é enviada para análise — só vira realidade após aprovação do fundador ou de um super admin, com motivo registrado.`,
      label: 'Motivo do rebaixamento',
      placeholder: 'Descreva o que motivou essa solicitação (mínimo 10 caracteres)...',
      required: true,
      confirmLabel: 'Enviar solicitação',
      confirmIcon: ShieldAlert,
      onConfirm: async (notes) => {
        try {
          await requestRoleDemotion(user.id, 'user', notes);
          setReason(null);
          toast.success(`Solicitação de rebaixamento de ${user.username} enviada para análise.`);
        } catch (e) { toast.error(e.message); }
      },
    });
  }

  function handleOverride(user, newRole) {
    setConfirm({
      title: 'Override de Emergência',
      message: `Definir o cargo de "${user.username}" diretamente para ${ROLE_LABEL[newRole]}? Isso IGNORA todo o processo de indicação e avaliação — use apenas em situações excepcionais (bugs, comportamento inesperado do sistema, etc). A ação fica registrada nos logs de auditoria.`,
      accent: 'red',
      confirmLabel: 'Definir cargo',
      icon: Siren,
      onConfirm: async () => {
        const { error } = await supabase.rpc('owner_set_role', { p_target_user_id: user.id, p_new_role: newRole });
        setConfirm(null);
        if (error) toast.error(error.message);
        else { toast.success(`Cargo de ${user.username} definido para ${ROLE_LABEL[newRole]}.`); refetch(); }
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
          else { toast.success(`${user.username} desbanido!`); refetch(); }
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
          else { toast.success(`${user.username} banido!`); refetch(); }
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
        <button onClick={() => refetch()}
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
            <UserRow key={u.id} user={u} onNominate={handleNominate} onDemote={handleDemote}
              onBan={handleBan} onOverride={handleOverride} />
          ))}
        </div>
      )}

      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
      {reason && <ReasonModal {...reason} onClose={() => setReason(null)} />}
    </div>
  );
}
