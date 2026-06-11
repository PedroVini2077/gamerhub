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
  Shield, X, Users, FileText, Key,
  RotateCcw, CheckCircle, XCircle, Crown,
  Bell, Activity, Trash2, Tv,
  ShieldAlert, LockOpen, UserPlus, Siren, Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import BanModal from '../components/ui/BanModal';
import ReasonModal from '../components/ui/ReasonModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import UsersPanel from '../components/admin/UsersPanel';
import PostsPanel from '../components/admin/PostsPanel';
import LivesPanel from '../components/admin/LivesPanel';
import KeysPanel from '../components/admin/KeysPanel';
import NotifsPanel from '../components/admin/NotifsPanel';
import LogsPanel from '../components/admin/LogsPanel';
import SuperAdminPanel from '../components/admin/SuperAdminPanel';
import CargosTab from '../components/admin/CargosTab';
import ModerationPanel from '../components/moderation/ModerationPanel';
import { nominateForRole, requestRoleDemotion, notifyOwner } from '../services/roleNominationService';

const REACTIVATE_REASONS = [
  'Encerrada por engano', 'Problema técnico', 'Live continuou', 'Pedido do criador', 'Outro',
];

// Posts/keys crescem sem limite com o uso do site — pagina em blocos pra não
// carregar tudo de uma vez (landmine de escalabilidade do `fetchAll` antigo).
// Usuários continuam carregados por inteiro: a busca/filtros/badges de role do
// UsersPanel dependem da lista completa, e a base de usuários cresce bem mais
// devagar que posts.
const PAGE_SIZE = 20;
const MAX_USERS = 1000;

const ROLE_LABEL = { owner: 'Fundador', super_admin: 'Super Admin', admin: 'Admin', user: 'Usuário' };

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
      {countdown > 0 ? `Aguarde ${countdown}s...` : <><LockOpen size={12} />Confirmar Desbloqueio</>}
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

function UnbanRequestModal({ target, onClose, onSent }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!reason.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc('request_unban', { p_user_id: target.id, p_reason: reason.trim() });
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
      style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-yellow-400/30 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()} style={{ boxShadow: '0 0 40px #eab30815' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-yellow-400" />
            <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">Solicitar Desbanimento</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={15} /></button>
        </div>
        <div className="flex items-center gap-3 bg-dark-700 rounded-lg p-3 border border-dark-500">
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
          <textarea className="input-gamer resize-none w-full text-xs" rows={3}
            placeholder="Por que este usuário deve ser desbanido?"
            value={reason} onChange={e => setReason(e.target.value)} maxLength={500} />
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
      style={{ background: 'rgba(0,0,0,0.9)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-dark-400 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()} style={{ boxShadow: '0 0 40px #39ff1415' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-neon-green" />
            <h3 className="font-display text-sm text-neon-green uppercase tracking-wider">
              {isSuperAdmin ? 'Reativar Live' : 'Solicitar Reativação'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={15} /></button>
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
              : isSuperAdmin ? <><RotateCcw size={12} /> Reativar Agora</> : <><CheckCircle size={12} /> Enviar Solicitação</>
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
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [keysHasMore, setKeysHasMore] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loadingMoreKeys, setLoadingMoreKeys] = useState(false);
  const [stats, setStats] = useState({ users: 0, posts: 0, keys: 0 });
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('todos');
  const [userSearch, setUserSearch] = useState('');
  const [banModal, setBanModal] = useState(null);
  const [unbanReqModal, setUnbanReqModal] = useState(null);
  const [unbanDirectModal, setUnbanDirectModal] = useState(null);
  const [denyUnbanModal, setDenyUnbanModal] = useState(null);
  const [unbanRequests, setUnbanRequests] = useState([]);
  const [unbanReqLoading, setUnbanReqLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [demoteModal, setDemoteModal] = useState(null);
  const [alertOwnerModal, setAlertOwnerModal] = useState(false);
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
    const [
      { data: u }, { data: p }, { data: k },
      { count: postsCount }, { count: activePostsCount }, { count: keysCount },
      { data: allNotifs }, { data: reads },
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('role').order('username').limit(MAX_USERS),
      supabase.from('posts').select('*, profiles(username)').order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
      supabase.from('game_keys').select('*').order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('game_keys').select('id', { count: 'exact', head: true }),
      supabase.from('admin_notifications').select('id').in('audience', audience),
      supabase.from('admin_notification_reads').select('notification_id').eq('admin_id', user.id),
    ]);
    setUsers(u || []);
    setPosts(p || []);
    setKeys(k || []);
    setPostsHasMore((p?.length || 0) < (postsCount ?? 0));
    setKeysHasMore((k?.length || 0) < (keysCount ?? 0));
    setStats({ users: u?.length || 0, posts: activePostsCount ?? 0, keys: keysCount ?? k?.length ?? 0 });
    setReadIds(new Set((reads || []).map(r => r.notification_id)));
    setNotifications(allNotifs || []);
    setLoading(false);
    fetchUnbanRequests();
  }

  async function loadMorePosts() {
    setLoadingMorePosts(true);
    const { data, count } = await supabase
      .from('posts').select('*, profiles(username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(posts.length, posts.length + PAGE_SIZE - 1);
    const next = [...posts, ...(data || [])];
    setPosts(next);
    setPostsHasMore(next.length < (count ?? next.length));
    setLoadingMorePosts(false);
  }

  async function loadMoreKeys() {
    setLoadingMoreKeys(true);
    const { data, count } = await supabase
      .from('game_keys').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(keys.length, keys.length + PAGE_SIZE - 1);
    const next = [...keys, ...(data || [])];
    setKeys(next);
    setKeysHasMore(next.length < (count ?? next.length));
    setLoadingMoreKeys(false);
  }

  async function fetchLiveMod() {
    setRefreshing(true);
    const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const [{ data: silenced }, { data: lives }, { data: endedLives }, { data: requests }] = await Promise.all([
      supabase.from('live_chat_timeouts').select('id, post_id, user_id, expires_at, profiles(username)')
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
      supabase.from('posts').select('id, title, user_id, profiles(username)')
        .eq('is_live', true).not('embed_url', 'is', null),
      supabase.from('posts').select('id, title, user_id, created_at, profiles(username)')
        .eq('was_live', true).eq('is_live', false).not('embed_url', 'is', null)
        .gte('created_at', since7d).order('created_at', { ascending: false }).limit(20),
      supabase.from('live_reactivation_requests').select('*')
        .eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    setLiveMod({ silenced: silenced || [], lives: lives || [], endedLives: endedLives || [], requests: requests || [] });
    setRefreshing(false);
  }

  async function fetchLogs(cat = 'todos') {
    setLogsLoading(true);
    let q = supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (cat !== 'todos') q = q.eq('category', cat);
    const { data } = await q;
    setLogs(data || []);
    setLogsLoading(false);
  }

  async function fetchNotificationsCount() {
    const audience = isSuperAdmin ? ['all_admins', 'super_admin'] : ['all_admins'];
    const { data: notifs } = await supabase.from('admin_notifications').select('id').in('audience', audience);
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
      supabase.from('admin_notifications').select('*').in('audience', audience)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('admin_notification_reads').select('notification_id').eq('admin_id', user.id),
    ]);
    const rIds = new Set((reads || []).map(r => r.notification_id));
    setNotifications(notifs || []);
    setReadIds(rIds);
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
    let q = supabase.from('unban_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (!isSuperAdmin) q = q.eq('requesting_admin_id', user.id);
    const { data } = await q;
    setUnbanRequests(data || []);
    setUnbanReqLoading(false);
  }

  async function confirmUnlock() {
    const entry = unlockModal;
    if (!entry) return;
    const { error } = await supabase.rpc('admin_unlock_login', { p_email: entry.email });
    if (error) { toast.error('Erro ao desbloquear'); return; }
    logAudit('admin_unlock_login',
      `Super admin @${profile?.username} desbloqueou o login de ${entry.email} (${entry.attempts} tentativas${entry.permanent ? ', bloqueio permanente' : ''})`,
      { category: 'security', severity: 'warning' }
    );
    toast.success(`${entry.email} desbloqueado`);
    setUnlockModal(null);
    fetchBlockedLogins();
  }

  async function logAction(action, details, category = 'admin', severity = 'info') {
    await supabase.from('admin_logs').insert({
      admin_id: user.id, admin_username: profile?.username || 'Admin',
      actor_id: user.id, actor_username: profile?.username || 'Admin',
      action, details, category, severity,
    });
  }

  async function unsilenceUser(id) {
    await supabase.from('live_chat_timeouts').delete().eq('id', id);
    await logAction('admin_unsilence_chat', `Silêncio de chat removido por @${profile?.username}`, 'admin', 'info');
    fetchLiveMod();
  }

  function handleEndLive(postId, title) {
    setConfirmModal({
      title: 'Encerrar Live', icon: Tv, accent: 'red',
      message: `Encerrar a live "${title}"? O streamer não poderá retomá-la sem uma nova solicitação.`,
      confirmLabel: 'Encerrar', confirmIcon: X,
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
    await logAction('live_reactivated', `Live "${live.title}" reativada. Motivo: ${reason}${details ? ` — ${details}` : ''}`);
    setReactivateModal(null);
    fetchLiveMod();
  }

  async function handleSubmitRequest(live, reason, details) {
    const { error } = await supabase.from('live_reactivation_requests').insert({
      post_id: live.id, post_title: live.title,
      admin_id: user.id, admin_username: profile?.username || 'Admin',
      reason, details: details || null, status: 'pending',
    });
    if (error) { toast.error('Erro ao enviar solicitação'); return; }
    toast.success('Solicitação enviada ao super admin!');
    await logAction('reactivation_requested', `Admin solicitou reativação de "${live.title}". Motivo: ${reason}${details ? ` — ${details}` : ''}`);
    setReactivateModal(null);
    fetchLiveMod();
  }

  async function handleApproveRequest(req) {
    const { error } = await supabase.from('posts').update({ is_live: true }).eq('id', req.post_id);
    if (error) { toast.error('Erro ao reativar post'); return; }
    await supabase.from('live_reactivation_requests').update({
      status: 'approved', reviewed_by: user.id,
      reviewer_username: profile?.username, reviewed_at: new Date().toISOString(),
    }).eq('id', req.id);
    toast.success('Aprovado — live reativada!');
    await logAction('reactivation_approved', `Super admin aprovou reativação de "${req.post_title}" (solicitado por ${req.admin_username})`);
    fetchLiveMod();
    fetchLogs();
  }

  async function handleDenyRequest(req) {
    await supabase.from('live_reactivation_requests').update({
      status: 'denied', reviewed_by: user.id,
      reviewer_username: profile?.username, reviewed_at: new Date().toISOString(),
    }).eq('id', req.id);
    toast.success('Solicitação negada');
    await logAction('reactivation_denied', `Super admin negou reativação de "${req.post_title}" (solicitado por ${req.admin_username})`);
    fetchLiveMod();
    fetchLogs();
  }

  async function handleAlertOwner(message) {
    try {
      await notifyOwner(message);
      setAlertOwnerModal(false);
      toast.success('Alerta enviado ao fundador.');
    } catch (e) { toast.error(e.message); }
  }

  function handleNominate(targetUser, targetRole) {
    setConfirmModal({
      title: `Indicar para ${ROLE_LABEL[targetRole]}`,
      message: `Indicar "${targetUser.username}" para o cargo de ${ROLE_LABEL[targetRole]}? A candidatura passa por análise da equipe e, se aprovada, inicia um período de avaliação.`,
      accent: 'purple', confirmLabel: 'Indicar', icon: UserPlus,
      onConfirm: async () => {
        try {
          await nominateForRole(targetUser.id, targetRole);
          setConfirmModal(null);
          toast.success(`Indicação de ${targetUser.username} enviada para análise.`);
        } catch (e) { toast.error(e.message); setConfirmModal(null); }
      },
    });
  }

  function handleDemote(targetUser) {
    setDemoteModal({
      title: 'Solicitar Rebaixamento',
      icon: ShieldAlert,
      accent: 'red',
      target: targetUser,
      subtitle: `"${targetUser.username}" passaria de ${ROLE_LABEL[targetUser.role]} para Usuário. A solicitação é enviada para análise — só vira realidade após aprovação do fundador ou de um super admin, com motivo registrado.`,
      label: 'Motivo do rebaixamento',
      placeholder: 'Descreva o que motivou essa solicitação (mínimo 10 caracteres)...',
      required: true,
      confirmLabel: 'Enviar solicitação',
      confirmIcon: ShieldAlert,
      onConfirm: async (notes) => {
        try {
          await requestRoleDemotion(targetUser.id, 'user', notes);
          setDemoteModal(null);
          toast.success(`Solicitação de rebaixamento de ${targetUser.username} enviada para análise.`);
        } catch (e) { toast.error(e.message); }
      },
    });
  }

  async function confirmUnbanDirect(note) {
    const targetUser = unbanDirectModal;
    if (!targetUser) return;
    const { error } = await supabase.rpc('unban_user', { p_user_id: targetUser.id, p_note: note || null });
    if (error) { toast.error('Erro ao desbanir'); return; }
    toast.success(`@${targetUser.username} desbanido`);
    setUnbanDirectModal(null);
    fetchAll();
  }

  function handleDeletePosts(userId, username) {
    setConfirmModal({
      title: 'Deletar Todos os Posts', icon: Trash2, accent: 'red',
      message: `Deletar todos os posts de @${username}? Esta ação é irreversível.`,
      confirmLabel: 'Deletar Tudo', confirmIcon: Trash2,
      onConfirm: async () => {
        const { error, count } = await supabase.from('posts').delete({ count: 'exact' }).eq('user_id', userId);
        if (error) { toast.error('Erro ao deletar posts'); return; }
        // count 0 sem erro = RLS bloqueou (sem hierarquia) ou não havia posts.
        if (!count) { toast.error('Nenhum post deletado (sem permissão ou nada a apagar)'); return; }
        toast.success(`${count} post${count > 1 ? 's' : ''} deletado${count > 1 ? 's' : ''}`);
        await logAction('admin_delete_posts', `Todos os posts de @${username} deletados por @${profile?.username}`, 'admin', 'warning');
        setConfirmModal(null);
        fetchAll();
      },
    });
  }

  function handleDeletePost(postId) {
    setConfirmModal({
      title: 'Excluir Post', icon: Trash2, accent: 'red',
      message: 'Excluir este post? O post ficará oculto mas pode ser restaurado pelo admin.',
      confirmLabel: 'Excluir', confirmIcon: Trash2,
      onConfirm: async () => {
        const { error } = await supabase.rpc('soft_delete_post', { p_post_id: postId });
        if (error) { toast.error('Erro ao excluir post: ' + error.message); return; }
        toast.success('Post excluído');
        await logAction('admin_delete_post', `Post excluído (soft) pelo admin @${profile?.username}`, 'admin', 'warning');
        setConfirmModal(null);
        fetchAll();
      },
    });
  }

  function handleRestorePost(postId) {
    setConfirmModal({
      title: 'Restaurar Post', icon: RotateCcw, accent: 'green',
      message: 'Restaurar este post? Ele voltará a aparecer no feed.',
      confirmLabel: 'Restaurar', confirmIcon: RotateCcw,
      onConfirm: async () => {
        const { error } = await supabase.rpc('restore_post', { p_post_id: postId });
        if (error) { toast.error('Erro ao restaurar post: ' + error.message); return; }
        toast.success('Post restaurado');
        await logAction('admin_restore_post', `Post restaurado pelo admin @${profile?.username}`, 'admin', 'info');
        setConfirmModal(null);
        fetchAll();
      },
    });
  }

  function handleDeleteKey(keyId) {
    setConfirmModal({
      title: 'Remover Key / Promo', icon: Key, accent: 'red',
      message: 'Remover este item permanentemente?',
      confirmLabel: 'Remover', confirmIcon: Trash2,
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
    const { error } = await supabase.rpc('deny_unban_request', { p_request_id: req.id, p_note: note || null });
    if (error) { toast.error('Erro ao negar'); return; }
    toast.success('Solicitação negada');
    setDenyUnbanModal(null);
    fetchUnbanRequests();
  }

  if (!isAdmin) return null;

  const pendingUnbanCount = unbanRequests.length;
  const pendingCount = (liveMod.requests?.length || 0) + pendingUnbanCount;
  const pendingUnbanIds = new Set(unbanRequests.map(r => r.target_user_id));
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const tabs = [
    { id: 'users',      label: 'Usuários',     icon: Users       },
    { id: 'posts',      label: 'Posts',         icon: FileText    },
    { id: 'moderation', label: 'Moderação',     icon: ShieldAlert },
    { id: 'lives',      label: 'Mod de Lives',  icon: Shield      },
    { id: 'keys',       label: 'Keys & Promos', icon: Key         },
    { id: 'notifs',     label: 'Notificações',  icon: Bell, badge: unreadCount },
    { id: 'logs',       label: 'Logs',          icon: Activity    },
    ...(isSuperAdmin ? [{ id: 'cargos', label: 'Cargos',       icon: UserPlus }] : []),
    ...(isSuperAdmin ? [{ id: 'super',  label: 'Super Admin', icon: Crown, badge: pendingCount }] : []),
  ];

  return (
    <div className="space-y-5">
      {reactivateModal && (
        <ReactivationModal live={reactivateModal} isSuperAdmin={isSuperAdmin}
          onSubmit={isSuperAdmin ? handleReactivateDirect : handleSubmitRequest}
          onClose={() => setReactivateModal(null)} />
      )}
      {banModal && (
        <BanModal target={banModal} onClose={() => setBanModal(null)} onBanned={() => fetchAll()} />
      )}
      {unbanReqModal && (
        <UnbanRequestModal target={unbanReqModal} onClose={() => setUnbanReqModal(null)} onSent={() => fetchAll()} />
      )}
      {unbanDirectModal && (
        <ReasonModal title="Desbanir Usuário" icon={Shield} accent="green"
          target={unbanDirectModal}
          subtitle="O usuário voltará a ter acesso ao site. Registre o motivo do desbanimento."
          label="Motivo do desbanimento" placeholder="Por que está desbanindo?"
          confirmLabel="Desbanir" confirmIcon={Shield}
          onConfirm={confirmUnbanDirect} onClose={() => setUnbanDirectModal(null)} />
      )}
      {denyUnbanModal && (
        <ReasonModal title="Negar Solicitação" icon={XCircle} accent="red"
          subtitle={`Negar o desbanimento de @${denyUnbanModal.target_username} solicitado por @${denyUnbanModal.requesting_admin_username}.`}
          label="Nota para o admin" placeholder="Por que está negando? (visível nos logs)"
          confirmLabel="Negar" confirmIcon={XCircle}
          onConfirm={confirmDenyUnban} onClose={() => setDenyUnbanModal(null)} />
      )}
      {confirmModal && (
        <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />
      )}
      {demoteModal && (
        <ReasonModal {...demoteModal} onClose={() => setDemoteModal(null)} />
      )}
      {alertOwnerModal && (
        <ReasonModal title="Alertar o Fundador" icon={Siren} accent="red"
          subtitle="Use isso pra avisar o fundador sobre instabilidades no site ou problemas no painel administrativo. A mensagem chega como notificação direta, com seu nome e cargo."
          label="Descreva o problema" placeholder="O que está acontecendo? (mínimo 10 caracteres)"
          required confirmLabel="Enviar alerta" confirmIcon={Send}
          onConfirm={handleAlertOwner} onClose={() => setAlertOwnerModal(false)} />
      )}
      {unlockModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.92)' }} onClick={() => setUnlockModal(null)}>
          <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-red-500/30 p-5 space-y-4 animate-fade-up"
            onClick={e => e.stopPropagation()} style={{ boxShadow: '0 0 40px #ef444425' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-400" />
                <h3 className="font-display text-sm text-red-400 uppercase tracking-wider">Atenção</h3>
              </div>
              <button onClick={() => setUnlockModal(null)} className="text-gray-500 hover:text-white transition-colors">
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
              {unlockModal.username && <p className="text-xs text-gray-400 font-mono">@{unlockModal.username}</p>}
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={16} className="text-neon-purple" />
              <h1 className="font-display text-sm text-neon-purple tracking-widest uppercase">
                Painel Admin — {role}
              </h1>
            </div>
            <p className="text-xs text-gray-500 font-mono">Área restrita. Acesso controlado por hierarquia.</p>
          </div>
          <button onClick={() => setAlertOwnerModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-red-400/80 hover:text-red-400 border border-red-400/30 hover:border-red-400/60 rounded transition-all shrink-0">
            <Siren size={12} />Alertar o Fundador
          </button>
        </div>
      </div>

      <motion.div className="grid grid-cols-3 gap-3"
        variants={gridContainer} initial="initial" animate="animate">
        <StatCard icon={Users} label="Usuários" value={stats.users} color="bg-neon-cyan/10 text-neon-cyan" />
        <StatCard icon={FileText} label="Posts" value={stats.posts} color="bg-neon-green/10 text-neon-green" />
        <StatCard icon={Key} label="Keys" value={stats.keys} color="bg-neon-purple/10 text-neon-purple" />
      </motion.div>

      <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 pt-2">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`relative flex items-center gap-2 py-2 px-4 text-xs font-display tracking-wider uppercase rounded border transition-all shrink-0 ${
              tab === id
                ? id === 'super' ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400' : 'border-neon-purple bg-neon-purple/10 text-neon-purple'
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
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-dark-700 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} variants={fadeTab} initial="initial" animate="animate" exit="exit">
            {tab === 'users' && (
              <UsersPanel
                users={users} currentUserId={user?.id} isSuperAdmin={isSuperAdmin}
                userSearch={userSearch} setUserSearch={setUserSearch}
                filterRole={filterRole} setFilterRole={setFilterRole}
                onNominate={handleNominate} onDemote={handleDemote}
                setBanModal={setBanModal} setUnbanDirectModal={setUnbanDirectModal}
                setUnbanReqModal={setUnbanReqModal} handleDeletePosts={handleDeletePosts}
                pendingUnbanIds={pendingUnbanIds}
              />
            )}
            {tab === 'posts' && (
              <PostsPanel
                posts={posts} handleDeletePost={handleDeletePost} handleRestorePost={handleRestorePost}
                hasMore={postsHasMore} loadingMore={loadingMorePosts} onLoadMore={loadMorePosts}
              />
            )}
            {tab === 'moderation' && <ModerationPanel />}
            {tab === 'lives' && (
              <LivesPanel
                liveMod={liveMod} refreshing={refreshing} fetchLiveMod={fetchLiveMod}
                unsilenceUser={unsilenceUser} handleEndLive={handleEndLive}
                setReactivateModal={setReactivateModal} isSuperAdmin={isSuperAdmin}
              />
            )}
            {tab === 'keys' && (
              <KeysPanel
                keys={keys} fetchAll={fetchAll} handleDeleteKey={handleDeleteKey}
                hasMore={keysHasMore} loadingMore={loadingMoreKeys} onLoadMore={loadMoreKeys}
              />
            )}
            {tab === 'notifs' && (
              <NotifsPanel
                notifications={notifications} readIds={readIds}
                notifLoading={notifLoading} fetchNotifications={fetchNotifications}
              />
            )}
            {tab === 'logs' && (
              <LogsPanel
                logs={logs} logCat={logCat} setLogCat={setLogCat}
                logsLoading={logsLoading} fetchLogs={fetchLogs}
              />
            )}
            {tab === 'cargos' && isSuperAdmin && <CargosTab />}
            {tab === 'super' && isSuperAdmin && (
              <SuperAdminPanel
                blockedLogins={blockedLogins} blockedLoading={blockedLoading}
                fetchBlockedLogins={fetchBlockedLogins} setUnlockModal={setUnlockModal}
                unbanRequests={unbanRequests} unbanReqLoading={unbanReqLoading}
                fetchUnbanRequests={fetchUnbanRequests} setDenyUnbanModal={setDenyUnbanModal}
                handleApproveUnban={handleApproveUnban} pendingUnbanCount={pendingUnbanCount}
                liveMod={liveMod} refreshing={refreshing} fetchLiveMod={fetchLiveMod}
                handleApproveRequest={handleApproveRequest} handleDenyRequest={handleDenyRequest}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
