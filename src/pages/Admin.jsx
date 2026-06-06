import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeTab, gridContainer, gridCard } from '../lib/motion';
import { createPortal } from 'react-dom';
import { useRole } from '../hooks/useRole';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';
import {
  Shield, Clock, X, Users, FileText, Key,
  ChevronUp, ChevronDown, Ban, Trash2,
  RotateCcw, CheckCircle, XCircle, Crown, ScrollText, Bell,
  VolumeX, UserPlus, Radio, Tv, LogIn, LogOut,
  AlertTriangle, ShieldAlert, ShieldOff, Pencil, Activity,
  Lock, LockOpen, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import KeyEditor from '../components/keys/KeyEditor';
import Avatar from '../components/ui/Avatar';
import BanModal from '../components/ui/BanModal';
import ReasonModal from '../components/ui/ReasonModal';
import ConfirmModal from '../components/ui/ConfirmModal';

const ROLES = ['user', 'admin', 'super_admin']; // 'owner' nunca é atribuível pelo painel
const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green', owner: 'tag-orange' };
const REACTIVATE_REASONS = [
  'Encerrada por engano',
  'Problema técnico',
  'Live continuou',
  'Pedido do criador',
  'Outro',
];

// Botão de confirmação com contagem regressiva — força o super admin a parar e pensar
// antes de desbloquear um possível invasor.
function UnlockCountdownBtn({ onConfirm }) {
  const [countdown, setCountdown] = useState(10);
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);
  return (
    <button
      onClick={countdown > 0 ? undefined : onConfirm}
      disabled={countdown > 0}
      className="flex-1 py-2 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-1.5"
      style={countdown > 0
        ? { background: '#111', color: '#555', border: '1px solid #333', cursor: 'not-allowed' }
        : { background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e40' }}>
      {countdown > 0
        ? `Aguarde ${countdown}s...`
        : <><LockOpen size={12} />Confirmar Desbloqueio</>
      }
    </button>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <motion.div variants={gridCard} className="card p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-display font-bold text-white">{value}</p>
      </div>
    </motion.div>
  );
}

function UserRow({ user, currentUserId, isSuperAdmin, onRoleChange, onBanClick, onUnbanDirect, onRequestUnban, onDeletePosts, pendingUnbanIds }) {
  const [expanded, setExpanded] = useState(false);
  const isMe = user.id === currentUserId;
  const canEdit = !isMe && user.role !== 'owner' && (isSuperAdmin ? user.role !== 'super_admin' : user.role === 'user');
  const canBan  = !isMe && user.role !== 'owner' && (isSuperAdmin ? user.role !== 'super_admin' : user.role === 'user');
  const hasUnbanPending = pendingUnbanIds?.has(user.id);
  const availableRoles = ROLES.filter(r => r !== user.role).filter(r =>
    isSuperAdmin ? true : r !== 'super_admin'
  );

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
              <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">Mudar role para:</p>
              <div className="flex gap-2 flex-wrap">
                {availableRoles.map(r => (
                  <button key={r} onClick={() => { onRoleChange(user.id, r); setExpanded(false); }}
                    className={`tag cursor-pointer hover:opacity-100 transition-opacity ${roleColors[r]}`}>
                    → {r}
                  </button>
                ))}
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

function UnbanRequestModal({ target, onClose, onSent }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!reason.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc('request_unban', {
      p_user_id: target.id,
      p_reason: reason.trim(),
    });
    setLoading(false);
    if (error) {
      if (error.message?.includes('pending')) toast.error('Já existe uma solicitação pendente para este usuário');
      else toast.error('Erro ao enviar solicitação');
      return;
    }
    toast.success('Solicitação enviada ao super admin!');
    onSent?.();
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-yellow-400/30 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 0 40px #eab30815' }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-yellow-400" />
            <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">Solicitar Desbanimento</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-3 bg-dark-700 rounded-lg p-3 border border-dark-500">
          <Avatar profile={target} size={36} />
          <div className="min-w-0">
            <p className="text-sm font-mono text-white font-bold">@{target.username}</p>
            {target.ban_reason && <p className="text-xs text-red-400 font-mono">{target.ban_reason}</p>}
          </div>
        </div>

        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
          <p className="text-xs font-mono text-yellow-300 leading-relaxed">
            Esta solicitação será enviada ao super admin. Descreva por que o ban deve ser removido.
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Justificativa *</p>
          <textarea
            className="input-gamer resize-none w-full text-xs"
            rows={3}
            placeholder="Por que este usuário deve ser desbanido?"
            value={reason}
            onChange={e => setReason(e.target.value)}
            maxLength={500}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <button onClick={handleSend} disabled={!reason.trim() || loading}
            className="flex-1 py-2 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: '#eab30815', color: '#fbbf24', border: '1px solid #eab30840' }}>
            {loading ? <span className="animate-pulse">...</span> : <><CheckCircle size={12} />Enviar Solicitação</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function KeyForm({ onAdd }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    game_title: '', platform: 'Steam', key_code: '', is_promo: false, discount_percent: 0, promo_url: ''
  });
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!form.game_title) { toast.error('Coloca o nome do jogo'); return; }
    setLoading(true);
    const { error } = await supabase.from('game_keys').insert(form);
    if (error) toast.error('Erro ao adicionar');
    else {
      toast.success('Adicionado!');
      logAudit('admin_add_key',
        `Key "${form.game_title}" (${form.platform})${form.is_promo ? ' — Promoção' : ''} adicionada por @${profile?.username}`,
        { category: 'admin' });
      setForm({ game_title: '', platform: 'Steam', key_code: '', is_promo: false, discount_percent: 0, promo_url: '' });
      onAdd();
    }
    setLoading(false);
  }

  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-display text-xs text-neon-green tracking-widest uppercase">Adicionar Key / Promo</h3>
      <div className="grid grid-cols-2 gap-3">
        <input className="input-gamer" placeholder="Nome do jogo" value={form.game_title}
          onChange={e => setForm(f => ({ ...f, game_title: e.target.value }))} />
        <select className="input-gamer" value={form.platform}
          onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
          {['Steam', 'Epic', 'GOG', 'PlayStation', 'Xbox'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-400 font-mono cursor-pointer">
        <input type="checkbox" checked={form.is_promo}
          onChange={e => setForm(f => ({ ...f, is_promo: e.target.checked }))} />
        É promoção?
      </label>
      {!form.is_promo ? (
        <input className="input-gamer" placeholder="Código da key" value={form.key_code}
          onChange={e => setForm(f => ({ ...f, key_code: e.target.value }))} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <input className="input-gamer" type="number" placeholder="Desconto %"
            value={form.discount_percent}
            onChange={e => setForm(f => ({ ...f, discount_percent: +e.target.value }))} />
          <input className="input-gamer" placeholder="URL da promo" value={form.promo_url}
            onChange={e => setForm(f => ({ ...f, promo_url: e.target.value }))} />
        </div>
      )}
      <button onClick={handleAdd} disabled={loading} className="btn-solid py-2 px-5">
        {loading ? 'Salvando...' : 'Adicionar'}
      </button>
    </div>
  );
}

function ReactivationModal({ live, isSuperAdmin, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason) return;
    setSubmitting(true);
    await onSubmit(live, reason, details);
    setSubmitting(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-dark-400 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 0 40px #39ff1415' }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-neon-green" />
            <h3 className="font-display text-sm text-neon-green uppercase tracking-wider">
              {isSuperAdmin ? 'Reativar Live' : 'Solicitar Reativação'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
          <p className="text-xs font-mono text-white font-bold">{live.title}</p>
          <p className="text-xs font-mono text-gray-500">por {live.profiles?.username}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 font-mono mb-2 uppercase tracking-wider">Motivo:</p>
          <div className="space-y-1.5">
            {REACTIVATE_REASONS.map(r => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={`w-full text-left text-xs font-mono px-3 py-2 rounded border transition-all ${
                  reason === r
                    ? 'bg-neon-green/10 border-neon-green/40 text-neon-green'
                    : 'border-dark-500 text-gray-400 hover:border-dark-300 hover:text-gray-300'
                }`}>
                <span className={`w-2 h-2 rounded-full mr-2 border inline-block shrink-0 ${reason === r ? 'bg-neon-green border-neon-green' : 'border-gray-500'}`} />
                {r}
              </button>
            ))}
          </div>
        </div>

        <textarea className="input-gamer resize-none w-full text-xs" rows={2}
          placeholder="Detalhes adicionais (opcional)..."
          value={details} onChange={e => setDetails(e.target.value)} maxLength={300} />

        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={!reason || submitting}
            className="btn-solid flex-1 py-2 text-xs disabled:opacity-40 flex items-center justify-center gap-1.5">
            {submitting
              ? <span className="animate-pulse font-mono">...</span>
              : isSuperAdmin
                ? <><RotateCcw size={12} /> Reativar Agora</>
                : <><CheckCircle size={12} /> Enviar Solicitação</>
            }
          </button>
          <button onClick={onClose} className="btn-neon py-2 px-4 text-xs">Cancelar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Admin() {
  const { isAdmin, isSuperAdmin, role } = useRole();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState({ users: 0, posts: 0, keys: 0 });
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('todos');
  const [userSearch, setUserSearch] = useState('');
  const [banModal, setBanModal] = useState(null);
  const [unbanReqModal, setUnbanReqModal] = useState(null);
  const [unbanDirectModal, setUnbanDirectModal] = useState(null); // super admin desbane direto
  const [denyUnbanModal, setDenyUnbanModal] = useState(null);     // super admin nega solicitação
  const [unbanRequests, setUnbanRequests] = useState([]);
  const [unbanReqLoading, setUnbanReqLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [liveMod, setLiveMod] = useState({ silenced: [], lives: [], endedLives: [], requests: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [reactivateModal, setReactivateModal] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logCat, setLogCat] = useState('todos');
  const [logsLoading, setLogsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [notifLoading, setNotifLoading] = useState(false);
  const [blockedLogins, setBlockedLogins] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unlockModal, setUnlockModal] = useState(null);
  // Refs para evitar closure stale nos callbacks do realtime
  const tabRef = useRef(tab);
  const logCatRef = useRef(logCat);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { logCatRef.current = logCat; }, [logCat]);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    fetchAll();
  }, [isAdmin]);

  useEffect(() => {
    if (tab === 'lives' || tab === 'super') fetchLiveMod();
    if (tab === 'notifs') fetchNotifications();
    if (tab === 'logs') fetchLogs(logCat);
    if (tab === 'users') fetchUnbanRequests();
    if (tab === 'super' && isSuperAdmin) { fetchBlockedLogins(); fetchUnbanRequests(); }
  }, [tab]);


  useEffect(() => {
    if (tab === 'logs') fetchLogs(logCat);
  }, [logCat]);

  useEffect(() => {
    const channel = supabase.channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_timeouts' }, () => {
        if (tabRef.current === 'lives' || tabRef.current === 'super') fetchLiveMod();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        if (tabRef.current === 'lives' || tabRef.current === 'super') fetchLiveMod();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_reactivation_requests' }, () => {
        if (tabRef.current === 'lives' || tabRef.current === 'super') fetchLiveMod();
        if (isSuperAdmin) fetchLogs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unban_requests' }, () => {
        if (isSuperAdmin && tabRef.current === 'super') fetchUnbanRequests();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => {
        fetchNotificationsCount();
        if (tabRef.current === 'notifs') fetchNotifications();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_logs' }, () => {
        if (tabRef.current === 'logs') fetchLogs(logCatRef.current);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isSuperAdmin]);

  async function fetchAll() {
    setLoading(true);
    const audience = isSuperAdmin ? ['all_admins', 'super_admin'] : ['all_admins'];
    const [{ data: u }, { data: p }, { data: k }, { data: allNotifs }, { data: reads }] = await Promise.all([
      supabase.from('profiles').select('*').order('role').order('username'),
      supabase.from('posts').select('*, profiles(username)').order('created_at', { ascending: false }),
      supabase.from('game_keys').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_notifications').select('id').in('audience', audience),
      supabase.from('admin_notification_reads').select('notification_id').eq('admin_id', user.id),
    ]);
    setUsers(u || []);
    setPosts(p || []);
    setKeys(k || []);
    setStats({ users: u?.length || 0, posts: p?.length || 0, keys: k?.length || 0 });
    setReadIds(new Set((reads || []).map(r => r.notification_id)));
    setNotifications(allNotifs || []);
    setLoading(false);
    fetchUnbanRequests();
  }

  async function fetchLiveMod() {
    setRefreshing(true);
    const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const [{ data: silenced }, { data: lives }, { data: endedLives }, { data: requests }] = await Promise.all([
      supabase.from('live_chat_timeouts')
        .select('id, post_id, user_id, expires_at, profiles(username)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('posts')
        .select('id, title, user_id, profiles(username)')
        .eq('is_live', true)
        .not('embed_url', 'is', null),
      supabase.from('posts')
        .select('id, title, user_id, created_at, profiles(username)')
        .eq('was_live', true)
        .eq('is_live', false)
        .not('embed_url', 'is', null)
        .gte('created_at', since7d)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('live_reactivation_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);
    setLiveMod({
      silenced: silenced || [],
      lives: lives || [],
      endedLives: endedLives || [],
      requests: requests || [],
    });
    setRefreshing(false);
  }

  async function fetchLogs(cat = 'todos') {
    setLogsLoading(true);
    let q = supabase.from('admin_logs')
      .select('*').order('created_at', { ascending: false }).limit(100);
    if (cat !== 'todos') q = q.eq('category', cat);
    const { data } = await q;
    setLogs(data || []);
    setLogsLoading(false);
  }

  async function fetchNotificationsCount() {
    const audience = isSuperAdmin ? ['all_admins', 'super_admin'] : ['all_admins'];
    const { data: notifs } = await supabase.from('admin_notifications')
      .select('id').in('audience', audience);
    const { data: reads } = await supabase.from('admin_notification_reads')
      .select('notification_id').eq('admin_id', user.id);
    const rIds = new Set((reads || []).map(r => r.notification_id));
    setReadIds(rIds);
    setNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const newIds = (notifs || []).filter(n => !existingIds.has(n.id));
      return newIds.length > 0 ? prev : prev;
    });
  }

  async function fetchNotifications() {
    setNotifLoading(true);
    const audience = isSuperAdmin ? ['all_admins', 'super_admin'] : ['all_admins'];
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase.from('admin_notifications')
        .select('*').in('audience', audience)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('admin_notification_reads')
        .select('notification_id').eq('admin_id', user.id),
    ]);
    const rIds = new Set((reads || []).map(r => r.notification_id));
    setNotifications(notifs || []);
    setReadIds(rIds);
    // Mark all current as read
    const unread = (notifs || []).filter(n => !rIds.has(n.id));
    if (unread.length > 0) {
      await supabase.from('admin_notification_reads').upsert(
        unread.map(n => ({ notification_id: n.id, admin_id: user.id })),
        { onConflict: 'notification_id,admin_id' }
      );
      setReadIds(new Set((notifs || []).map(n => n.id)));
    }
    setNotifLoading(false);
  }

  async function fetchBlockedLogins() {
    setBlockedLoading(true);
    const { data } = await supabase.rpc('get_blocked_logins');
    setBlockedLogins(data || []);
    setBlockedLoading(false);
  }

  async function fetchUnbanRequests() {
    setUnbanReqLoading(true);
    // super_admin vê todas; admin vê apenas as próprias solicitações (para o estado "Em análise")
    let q = supabase.from('unban_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (!isSuperAdmin) q = q.eq('requesting_admin_id', user.id);
    const { data } = await q;
    setUnbanRequests(data || []);
    setUnbanReqLoading(false);
  }

  // Confirma o desbloqueio (chamado pelo modal de aviso de atividade suspeita)
  async function confirmUnlock() {
    const entry = unlockModal;
    if (!entry) return;
    const { error } = await supabase.rpc('admin_unlock_login', { p_email: entry.email });
    if (error) { toast.error('Erro ao desbloquear'); return; }
    logAudit('admin_unlock_login',
      `Super admin @${profile?.username} desbloqueou o login de ${entry.email} (${entry.attempts} tentativas registradas${entry.permanent ? ', bloqueio permanente' : ''})`,
      { category: 'security', severity: 'warning', metadata: { email: entry.email, attempts: entry.attempts, permanent: entry.permanent } }
    );
    toast.success(`${entry.email} desbloqueado`);
    setUnlockModal(null);
    fetchBlockedLogins();
  }

  async function logAction(action, details, category = 'admin', severity = 'info') {
    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      admin_username: profile?.username || 'Admin',
      actor_id: user.id,
      actor_username: profile?.username || 'Admin',
      action,
      details,
      category,
      severity,
    });
  }

  async function unsilenceUser(id) {
    await supabase.from('live_chat_timeouts').delete().eq('id', id);
    await logAction('admin_unsilence_chat', `Silêncio de chat removido por @${profile?.username}`, 'admin', 'info');
    fetchLiveMod();
  }

  function handleEndLive(postId, title) {
    setConfirmModal({
      title: 'Encerrar Live',
      icon: Tv,
      accent: 'red',
      message: `Encerrar a live "${title}"? O streamer não poderá retomá-la sem uma nova solicitação.`,
      confirmLabel: 'Encerrar',
      confirmIcon: X,
      onConfirm: async () => {
        const { error } = await supabase.from('posts').update({ is_live: false }).eq('id', postId);
        if (error) { toast.error('Erro ao encerrar live'); return; }
        toast.success('Live encerrada');
        await logAction('live_ended', `Live "${title}" encerrada pelo admin`);
        setConfirmModal(null);
        fetchLiveMod();
      },
    });
  }

  async function handleReactivateDirect(live, reason, details) {
    const { error } = await supabase.from('posts').update({ is_live: true }).eq('id', live.id);
    if (error) { toast.error('Erro ao reativar'); return; }
    toast.success('Live reativada!');
    await logAction('live_reactivated',
      `Live "${live.title}" reativada pelo super admin. Motivo: ${reason}${details ? ` — ${details}` : ''}`);
    setReactivateModal(null);
    fetchLiveMod();
  }

  async function handleSubmitRequest(live, reason, details) {
    const { error } = await supabase.from('live_reactivation_requests').insert({
      post_id: live.id,
      post_title: live.title,
      admin_id: user.id,
      admin_username: profile?.username || 'Admin',
      reason,
      details: details || null,
      status: 'pending',
    });
    if (error) { toast.error('Erro ao enviar solicitação'); return; }
    toast.success('Solicitação enviada ao super admin!');
    await logAction('reactivation_requested',
      `Admin solicitou reativação de "${live.title}". Motivo: ${reason}${details ? ` — ${details}` : ''}`);
    setReactivateModal(null);
    fetchLiveMod();
  }

  async function handleApproveRequest(req) {
    const { error } = await supabase.from('posts').update({ is_live: true }).eq('id', req.post_id);
    if (error) { toast.error('Erro ao reativar post'); return; }
    await supabase.from('live_reactivation_requests').update({
      status: 'approved',
      reviewed_by: user.id,
      reviewer_username: profile?.username,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.id);
    toast.success('Aprovado — live reativada!');
    await logAction('reactivation_approved',
      `Super admin aprovou reativação de "${req.post_title}" (solicitado por ${req.admin_username})`);
    fetchLiveMod();
    fetchLogs();
  }

  async function handleDenyRequest(req) {
    await supabase.from('live_reactivation_requests').update({
      status: 'denied',
      reviewed_by: user.id,
      reviewer_username: profile?.username,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.id);
    toast.success('Solicitação negada');
    await logAction('reactivation_denied',
      `Super admin negou reativação de "${req.post_title}" (solicitado por ${req.admin_username})`);
    fetchLiveMod();
    fetchLogs();
  }

  async function handleRoleChange(userId, newRole) {
    const target = users.find(u => u.id === userId);
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) toast.error('Sem permissão ou erro ao atualizar');
    else {
      toast.success(`Role → ${newRole}`);
      await logAction('admin_role_changed',
        `Role de @${target?.username || userId} alterada para "${newRole}" por @${profile?.username}`,
        'admin', 'info');
      fetchAll();
    }
  }

  async function confirmUnbanDirect(note) {
    const targetUser = unbanDirectModal;
    if (!targetUser) return;
    const { error } = await supabase.rpc('unban_user', {
      p_user_id: targetUser.id,
      p_note: note || null,
    });
    if (error) { toast.error('Erro ao desbanir'); return; }
    toast.success(`@${targetUser.username} desbanido`);
    setUnbanDirectModal(null);
    fetchAll();
  }

  function handleDeletePosts(userId, username) {
    setConfirmModal({
      title: 'Deletar Todos os Posts',
      icon: Trash2,
      accent: 'red',
      message: `Deletar todos os posts de @${username}? Esta ação é irreversível.`,
      confirmLabel: 'Deletar Tudo',
      confirmIcon: Trash2,
      onConfirm: async () => {
        const { error } = await supabase.from('posts').delete().eq('user_id', userId);
        if (error) { toast.error('Erro ao deletar posts'); return; }
        toast.success('Posts deletados');
        await logAction('admin_delete_posts',
          `Todos os posts de @${username} deletados por @${profile?.username}`,
          'admin', 'warning');
        setConfirmModal(null);
        fetchAll();
      },
    });
  }

  function handleDeletePost(postId) {
    setConfirmModal({
      title: 'Deletar Post',
      icon: Trash2,
      accent: 'red',
      message: 'Deletar este post permanentemente? Esta ação não pode ser desfeita.',
      confirmLabel: 'Deletar',
      confirmIcon: Trash2,
      onConfirm: async () => {
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) { toast.error('Erro ao deletar post'); return; }
        toast.success('Post deletado');
        await logAction('admin_delete_post', `Post deletado pelo admin @${profile?.username}`, 'admin', 'warning');
        setConfirmModal(null);
        fetchAll();
      },
    });
  }

  function handleDeleteKey(keyId) {
    setConfirmModal({
      title: 'Remover Key / Promo',
      icon: Key,
      accent: 'red',
      message: 'Remover este item permanentemente?',
      confirmLabel: 'Remover',
      confirmIcon: Trash2,
      onConfirm: async () => {
        const { error } = await supabase.from('game_keys').delete().eq('id', keyId);
        if (error) { toast.error('Erro ao remover item'); return; }
        toast.success('Removido');
        await logAction('admin_delete_key', `Key removida pelo admin @${profile?.username}`, 'admin', 'info');
        setConfirmModal(null);
        fetchAll();
      },
    });
  }

  async function handleApproveUnban(req) {
    const { error } = await supabase.rpc('approve_unban_request', { p_request_id: req.id });
    if (error) { toast.error('Erro ao aprovar'); return; }
    toast.success(`@${req.target_username} desbanido!`);
    fetchUnbanRequests();
    fetchAll();
  }

  async function confirmDenyUnban(note) {
    const req = denyUnbanModal;
    if (!req) return;
    const { error } = await supabase.rpc('deny_unban_request', {
      p_request_id: req.id,
      p_note: note || null,
    });
    if (error) { toast.error('Erro ao negar'); return; }
    toast.success('Solicitação negada');
    setDenyUnbanModal(null);
    fetchUnbanRequests();
  }

  if (!isAdmin) return null;

  const searchLower = userSearch.toLowerCase();
  const filteredUsers = users.filter(u => {
    const matchSearch = !searchLower || u.username.toLowerCase().includes(searchLower);
    const matchRole = filterRole === 'todos' ? true
      : filterRole === 'banidos' ? u.banned
      : u.role === filterRole;
    return matchSearch && matchRole;
  });
  const pendingUnbanCount = unbanRequests.length;
  const pendingCount = (liveMod.requests?.length || 0) + pendingUnbanCount;
  const pendingUnbanIds = new Set(unbanRequests.map(r => r.target_user_id));

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const tabs = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'lives', label: 'Mod de Lives', icon: Shield },
    { id: 'keys', label: 'Keys & Promos', icon: Key },
    { id: 'notifs', label: 'Notificações', icon: Bell, badge: unreadCount },
    { id: 'logs', label: 'Logs', icon: Activity },
    ...(isSuperAdmin ? [{ id: 'super', label: 'Super Admin', icon: Crown, badge: pendingCount }] : []),
  ];

  return (
    <div className="space-y-5">
      {reactivateModal && (
        <ReactivationModal
          live={reactivateModal}
          isSuperAdmin={isSuperAdmin}
          onSubmit={isSuperAdmin ? handleReactivateDirect : handleSubmitRequest}
          onClose={() => setReactivateModal(null)}
        />
      )}

      {banModal && (
        <BanModal
          target={banModal}
          onClose={() => setBanModal(null)}
          onBanned={() => fetchAll()}
        />
      )}

      {unbanReqModal && (
        <UnbanRequestModal
          target={unbanReqModal}
          onClose={() => setUnbanReqModal(null)}
          onSent={() => fetchAll()}
        />
      )}

      {unbanDirectModal && (
        <ReasonModal
          title="Desbanir Usuário"
          icon={Shield}
          accent="green"
          target={unbanDirectModal}
          subtitle="O usuário voltará a ter acesso ao site. Registre o motivo do desbanimento (vai para os logs)."
          label="Motivo do desbanimento"
          placeholder="Por que está desbanindo?"
          confirmLabel="Desbanir"
          confirmIcon={Shield}
          onConfirm={confirmUnbanDirect}
          onClose={() => setUnbanDirectModal(null)}
        />
      )}

      {denyUnbanModal && (
        <ReasonModal
          title="Negar Solicitação"
          icon={XCircle}
          accent="red"
          subtitle={`Negar o desbanimento de @${denyUnbanModal.target_username} solicitado por @${denyUnbanModal.requesting_admin_username}. O usuário continua banido.`}
          label="Nota para o admin"
          placeholder="Por que está negando? (visível nos logs)"
          confirmLabel="Negar"
          confirmIcon={XCircle}
          onConfirm={confirmDenyUnban}
          onClose={() => setDenyUnbanModal(null)}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          icon={confirmModal.icon}
          accent={confirmModal.accent}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          confirmIcon={confirmModal.confirmIcon}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Modal de aviso ao desbloquear um possível invasor — super admin */}
      {unlockModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setUnlockModal(null)}>
          <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-red-500/30 p-5 space-y-4 animate-fade-up"
            onClick={e => e.stopPropagation()}
            style={{ boxShadow: '0 0 40px #ef444425' }}>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-400" />
                <h3 className="font-display text-sm text-red-400 uppercase tracking-wider">Atenção</h3>
              </div>
              <button onClick={() => setUnlockModal(null)}
                className="text-gray-500 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm font-mono text-red-300 font-bold leading-relaxed">
                ⚠️ CUIDADO: Você está prestes a desbloquear um possível invasor.
              </p>
              <p className="text-xs font-mono text-gray-400 mt-2 leading-relaxed">
                Esta conta excedeu o limite de tentativas consecutivas. Pode ser um ataque ou alguém com dificuldade de acesso. Se não reconhece este email, não desbloqueie — oriente a redefinir a senha.
              </p>
            </div>

            <div className="bg-dark-700 rounded-lg px-3 py-2.5 border border-dark-500 space-y-1">
              <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Email</p>
              <p className="text-sm font-mono text-white break-all">{unlockModal.email}</p>
              {unlockModal.username && (
                <p className="text-xs text-gray-400 font-mono">@{unlockModal.username}</p>
              )}
              <p className="text-xs text-red-400 font-mono">
                {unlockModal.attempts} tentativas de login registradas
                {unlockModal.permanent && ' · bloqueio permanente'}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setUnlockModal(null)}
                className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all">
                Cancelar
              </button>
              <UnlockCountdownBtn key={unlockModal?.email} onConfirm={confirmUnlock} />
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="card p-5 border-neon-purple/20">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-neon-purple" />
          <h1 className="font-display text-sm text-neon-purple tracking-widest uppercase">
            Painel Admin — {role}
          </h1>
        </div>
        <p className="text-xs text-gray-500 font-mono">Área restrita. Acesso controlado por hierarquia.</p>
      </div>

      <motion.div className="grid grid-cols-3 gap-3"
        variants={gridContainer} initial="initial" animate="animate">
        <StatCard icon={Users} label="Usuários" value={stats.users} color="bg-neon-cyan/10 text-neon-cyan" />
        <StatCard icon={FileText} label="Posts" value={stats.posts} color="bg-neon-green/10 text-neon-green" />
        <StatCard icon={Key} label="Keys" value={stats.keys} color="bg-neon-purple/10 text-neon-purple" />
      </motion.div>

      <div className="flex gap-2 overflow-x-auto pb-1 pt-2">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`relative flex items-center gap-2 py-2 px-4 text-xs font-display tracking-wider uppercase rounded border transition-all shrink-0 ${
              tab === id
                ? id === 'super'
                  ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                  : 'border-neon-purple bg-neon-purple/10 text-neon-purple'
                : 'border-dark-400 text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={13} /> {label}
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center font-mono font-bold"
                style={{ fontSize: 9 }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="font-mono text-gray-500 text-sm animate-pulse">Carregando...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} variants={fadeTab} initial="initial" animate="animate" exit="exit">
          {tab === 'users' && (
            <div className="space-y-3">
              {/* Campo de busca */}
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
              {/* Filtros */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'todos', label: `Todos (${users.length})`, active: 'tag-green' },
                  { id: 'user', label: `User (${users.filter(u => u.role === 'user').length})`, active: roleColors.user },
                  { id: 'admin', label: `Admin (${users.filter(u => u.role === 'admin').length})`, active: roleColors.admin },
                  { id: 'super_admin', label: `Super Admin (${users.filter(u => u.role === 'super_admin').length})`, active: roleColors.super_admin },
                  { id: 'banidos', label: `Banidos (${users.filter(u => u.banned).length})`, active: 'tag-pink' },
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
                <UserRow key={u.id} user={u} currentUserId={user?.id}
                  isSuperAdmin={isSuperAdmin} onRoleChange={handleRoleChange}
                  onBanClick={u => setBanModal(u)}
                  onUnbanDirect={u => setUnbanDirectModal(u)}
                  onRequestUnban={u => setUnbanReqModal(u)}
                  onDeletePosts={handleDeletePosts}
                  pendingUnbanIds={pendingUnbanIds} />
              ))}
            </div>
          )}

          {tab === 'posts' && (
            <div className="space-y-3">
              {posts.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="font-mono text-gray-500 text-sm">Nenhum post ainda</p>
                </div>
              ) : posts.map(p => (
                <div key={p.id} className="card p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-1 truncate">{p.title}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {p.profiles?.username} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button onClick={() => handleDeletePost(p.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'lives' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-neon-green" />
                  <h3 className="font-display text-sm text-neon-green uppercase tracking-wider">Moderação de Lives</h3>
                </div>
                <button onClick={fetchLiveMod} disabled={refreshing}
                  className="text-xs font-mono text-gray-500 hover:text-neon-green transition-colors flex items-center gap-1">
                  <RotateCcw size={11} className={`inline mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={13} className="text-yellow-400" />
                  <p className="text-xs font-mono text-yellow-400 uppercase tracking-wider font-bold">
                    Usuários Silenciados ({liveMod.silenced?.length || 0})
                  </p>
                </div>
                {!liveMod.silenced?.length ? (
                  <p className="text-xs text-gray-600 font-mono">Nenhum usuário silenciado</p>
                ) : (
                  <div className="space-y-2">
                    {liveMod.silenced.map(t => {
                      const remaining = Math.ceil((new Date(t.expires_at) - new Date()) / 60000);
                      const live = liveMod.lives?.find(l => l.id === t.post_id);
                      if (remaining <= 0) return null;
                      return (
                        <div key={t.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2 border border-yellow-400/10">
                          <VolumeX size={15} className="text-yellow-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono font-bold text-yellow-400">{t.profiles?.username}</p>
                            <p className="text-xs font-mono text-gray-600">
                              {live ? `Live: ${live.title}` : 'Live desconhecida'} · {remaining} min restantes
                            </p>
                          </div>
                          <button onClick={() => unsilenceUser(t.id)}
                            className="text-xs font-mono text-gray-500 hover:text-neon-green border border-dark-400 hover:border-neon-green/40 px-2 py-0.5 rounded transition-all">
                            Remover
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-xs font-mono text-red-400 uppercase tracking-wider font-bold">
                    Lives Ativas ({liveMod.lives?.length || 0})
                  </p>
                </div>
                {!liveMod.lives?.length ? (
                  <p className="text-xs text-gray-600 font-mono">Nenhuma live ativa</p>
                ) : (
                  <div className="space-y-2">
                    {liveMod.lives.map(l => (
                      <div key={l.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2 border border-red-400/10">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-bold text-white">{l.title}</p>
                          <p className="text-xs font-mono text-gray-600">por {l.profiles?.username}</p>
                        </div>
                        <button onClick={() => handleEndLive(l.id, l.title)}
                          className="text-xs font-mono text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/50 px-2 py-0.5 rounded transition-all shrink-0">
                          Encerrar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RotateCcw size={13} className="text-neon-green/60" />
                  <p className="text-xs font-mono text-neon-green/60 uppercase tracking-wider font-bold">
                    Lives Encerradas — últimos 7 dias ({liveMod.endedLives?.length || 0})
                  </p>
                </div>
                {!liveMod.endedLives?.length ? (
                  <p className="text-xs text-gray-600 font-mono">Nenhuma live encerrada recentemente</p>
                ) : (
                  <div className="space-y-2">
                    {liveMod.endedLives.map(l => {
                      const hasPending = liveMod.requests?.some(r => r.post_id === l.id);
                      return (
                        <div key={l.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
                          <Tv size={14} className="text-gray-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono font-bold text-white truncate">{l.title}</p>
                            <p className="text-xs font-mono text-gray-600">
                              por {l.profiles?.username} · {new Date(l.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          {hasPending ? (
                            <span className="text-xs font-mono text-yellow-400/70 border border-yellow-400/20 px-2 py-0.5 rounded shrink-0 flex items-center gap-1">
                              <Clock size={10} />Aguardando
                            </span>
                          ) : (
                            <button onClick={() => setReactivateModal(l)}
                              className="flex items-center gap-1 text-xs font-mono text-neon-green/70 hover:text-neon-green border border-neon-green/20 hover:border-neon-green/50 px-2 py-0.5 rounded transition-all shrink-0">
                              <RotateCcw size={10} />
                              {isSuperAdmin ? 'Reativar' : 'Solicitar'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'keys' && (
            <div className="space-y-4">
              <KeyForm onAdd={fetchAll} />
              <div className="space-y-3">
                {keys.map(k => (
                  <div key={k.id} className="card p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{k.game_title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="tag tag-cyan">{k.platform}</span>
                        {k.is_promo
                          ? <span className="tag tag-purple">-{k.discount_percent}%</span>
                          : <span className="font-mono text-xs text-neon-green">{k.key_code || 'sem key'}</span>
                        }
                      </div>
                    </div>
                    <KeyEditor item={k} onUpdate={fetchAll} />
                    <button onClick={() => handleDeleteKey(k.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'notifs' && (
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
                <div className="card p-8 text-center">
                  <p className="text-xs font-mono text-gray-500 animate-pulse">Carregando notificações...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="card p-8 text-center">
                  <Bell size={28} className="text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-mono text-gray-500">Nenhuma notificação ainda</p>
                </div>
              ) : notifications.map(n => {
                const isRead = readIds.has(n.id);
                const notifIcon = n.type === 'new_user'
                  ? <UserPlus size={15} className="text-neon-cyan" />
                  : n.type === 'new_live'
                  ? <Radio size={15} className="text-red-400" />
                  : n.type === 'live_ended'
                  ? <Tv size={15} className="text-gray-500" />
                  : n.type === 'live_reactivated'
                  ? <RotateCcw size={15} className="text-neon-green" />
                  : n.type === 'reactivation_request'
                  ? <RotateCcw size={15} className="text-yellow-400" />
                  : n.type === 'security_alert'
                  ? <ShieldAlert size={15} className="text-red-400" />
                  : n.type === 'user_banned'
                  ? <Ban size={15} className="text-red-400" />
                  : n.type === 'unban_request'
                  ? <RotateCcw size={15} className="text-yellow-400" />
                  : n.type === 'unban_approved'
                  ? <Shield size={15} className="text-neon-green" />
                  : n.type === 'banned_login_attempt'
                  ? <ShieldAlert size={15} className="text-red-400" />
                  : <Bell size={15} className="text-gray-500" />;
                return (
                  <div key={n.id} className={`card p-4 flex items-start gap-3 transition-all ${
                    isRead ? 'opacity-60' : 'border-neon-cyan/20'
                  }`}>
                    <span className="shrink-0 mt-0.5">{notifIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-mono font-bold text-white">{n.title}</p>
                        {!isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan shrink-0" />
                        )}
                        {n.audience === 'super_admin' && (
                          <span className="tag tag-green shrink-0" style={{ fontSize: 9, padding: '1px 4px' }}>
                            super admin
                          </span>
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
          )}

          {tab === 'logs' && (
            <div className="space-y-3">
              {/* Cabeçalho */}
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

              {/* Filtro por categoria */}
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

              {/* Lista de logs */}
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
                // Ícone por tipo de ação
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
                const { Icon = ScrollText, cls = 'text-gray-500' } = iconMap[log.action] || {};

                // Cor do indicador de severidade
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
                        <span className="text-xs font-mono text-gray-600">
                          {log.actor_username || log.admin_username}
                        </span>
                        <span className="text-gray-700 text-xs">·</span>
                        <span className="text-xs font-mono text-gray-600">
                          {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <span className="tag opacity-50 shrink-0" style={{ fontSize: 9, padding: '1px 5px' }}>
                          {log.category}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'super' && isSuperAdmin && (
            <div className="space-y-4">
              <div className="card p-4 border-yellow-400/20" style={{ boxShadow: '0 0 20px #eab30810' }}>
                <div className="flex items-center gap-2">
                  <Crown size={14} className="text-yellow-400" />
                  <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">Área Super Admin</h3>
                </div>
                <p className="text-xs text-gray-600 font-mono mt-1">Acesso exclusivo — super admins only.</p>
              </div>

              {/* Usuários Bloqueados por tentativas de login */}
              <div className="card p-4 border-red-500/20" style={{ boxShadow: '0 0 20px #ef444415' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lock size={14} className="text-red-400" />
                    <h3 className="font-display text-sm text-red-400 uppercase tracking-wider">Usuários Bloqueados</h3>
                  </div>
                  <button onClick={fetchBlockedLogins} disabled={blockedLoading}
                    className="text-xs text-gray-500 hover:text-neon-green font-mono transition-colors flex items-center gap-1">
                    <RotateCcw size={11} className={blockedLoading ? 'animate-spin' : ''} />
                    {blockedLoading ? 'Carregando...' : 'Atualizar'}
                  </button>
                </div>
                {blockedLoading ? (
                  <p className="text-xs text-gray-500 font-mono py-2">Carregando...</p>
                ) : blockedLogins.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle size={24} className="text-neon-green/40 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-mono">Nenhum usuário bloqueado no momento</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blockedLogins.map(entry => (
                      <div key={entry.email}
                        className={`bg-dark-700 rounded-lg p-3 border flex items-center justify-between gap-2 ${
                          entry.permanent ? 'border-red-600/30' : 'border-red-500/10'
                        }`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-mono text-white truncate">{entry.email}</p>
                          <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                            {entry.username && (
                              <span className="text-xs text-gray-400 font-mono">@{entry.username}</span>
                            )}
                            <span className="text-xs text-red-400 font-mono">{entry.attempts} tentativas</span>
                            {entry.permanent ? (
                              <span className="tag tag-pink" style={{ fontSize: 9, padding: '1px 5px' }}>permanente</span>
                            ) : (
                              <span className="text-xs text-orange-400 font-mono">
                                bloqueado até {new Date(entry.blocked_until).toLocaleString('pt-BR', { timeStyle: 'short', dateStyle: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => setUnlockModal(entry)}
                          className="shrink-0 flex items-center gap-1.5 text-xs font-mono text-neon-green border border-neon-green/30 hover:bg-neon-green/10 px-3 py-1.5 rounded transition-all">
                          <LockOpen size={11} />Desbloquear
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Solicitações de desbanimento — admin → super admin */}
              <div className="card p-4 border-yellow-400/20" style={{ boxShadow: '0 0 20px #eab30810' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <RotateCcw size={14} className="text-yellow-400" />
                    <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">
                      Solicitações de Desbanimento
                    </h3>
                    {pendingUnbanCount > 0 && (
                      <span className="tag tag-pink" style={{ fontSize: 9, padding: '1px 5px' }}>
                        {pendingUnbanCount}
                      </span>
                    )}
                  </div>
                  <button onClick={fetchUnbanRequests} disabled={unbanReqLoading}
                    className="text-xs text-gray-500 hover:text-yellow-400 font-mono transition-colors flex items-center gap-1">
                    <RotateCcw size={11} className={unbanReqLoading ? 'animate-spin' : ''} />
                    Atualizar
                  </button>
                </div>
                {unbanReqLoading ? (
                  <p className="text-xs text-gray-500 font-mono py-2">Carregando...</p>
                ) : unbanRequests.length === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle size={24} className="text-neon-green/40 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-mono">Nenhuma solicitação pendente</p>
                  </div>
                ) : unbanRequests.map(req => (
                  <div key={req.id} className="bg-dark-700 rounded-lg p-3 border border-yellow-400/10 space-y-2 mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-white font-bold">@{req.target_username}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          solicitado por <span className="text-yellow-400">@{req.requesting_admin_username}</span>
                          {' · '}{new Date(req.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <span className="tag tag-purple shrink-0" style={{ fontSize: 9 }}>pendente</span>
                    </div>
                    <div className="bg-dark-600 rounded px-3 py-2 border border-dark-500">
                      <p className="text-xs font-mono text-gray-300 leading-relaxed">{req.reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveUnban(req)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono font-bold text-neon-green border border-neon-green/30 rounded hover:bg-neon-green/10 transition-all">
                        <CheckCircle size={12} /> Aprovar e Desbanir
                      </button>
                      <button onClick={() => setDenyUnbanModal(req)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-all">
                        <XCircle size={12} /> Negar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Solicitações de reativação de live — admin → super admin */}
              <div className="card p-4 border-yellow-400/20" style={{ boxShadow: '0 0 20px #eab30810' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-yellow-400" />
                    <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">
                      Solicitações de Live
                    </h3>
                    {(liveMod.requests?.length || 0) > 0 && (
                      <span className="tag tag-pink" style={{ fontSize: 9, padding: '1px 5px' }}>
                        {liveMod.requests.length}
                      </span>
                    )}
                  </div>
                  <button onClick={fetchLiveMod} disabled={refreshing}
                    className="text-xs text-gray-500 hover:text-yellow-400 font-mono transition-colors flex items-center gap-1">
                    <RotateCcw size={11} className={refreshing ? 'animate-spin' : ''} />
                    Atualizar
                  </button>
                </div>
                {!liveMod.requests?.length ? (
                  <div className="text-center py-4">
                    <CheckCircle size={24} className="text-neon-green/40 mx-auto mb-2" />
                    <p className="text-xs font-mono text-gray-500">Nenhuma solicitação de live pendente</p>
                  </div>
                ) : liveMod.requests.map(req => (
                  <div key={req.id} className="bg-dark-700 rounded-lg p-3 border border-yellow-400/10 space-y-3 mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white font-mono truncate">"{req.post_title}"</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          por <span className="text-yellow-400">{req.admin_username}</span>
                          {' · '}{new Date(req.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <span className="tag tag-purple shrink-0 text-xs">pendente</span>
                    </div>
                    <div className="bg-dark-600 rounded-lg px-3 py-2 border border-dark-500">
                      <p className="text-xs font-mono text-neon-green font-bold">{req.reason}</p>
                      {req.details && <p className="text-xs font-mono text-gray-400 mt-0.5">{req.details}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveRequest(req)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono font-bold text-neon-green border border-neon-green/30 rounded hover:bg-neon-green/10 transition-all">
                        <CheckCircle size={12} /> Aprovar e Reativar
                      </button>
                      <button onClick={() => handleDenyRequest(req)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-all">
                        <XCircle size={12} /> Negar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
