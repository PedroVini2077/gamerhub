import { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import KeyEditor from '../components/keys/KeyEditor';
import Avatar from '../components/ui/Avatar';

const ROLES = ['user', 'admin', 'super_admin'];
const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };
const REACTIVATE_REASONS = [
  'Encerrada por engano',
  'Problema técnico',
  'Live continuou',
  'Pedido do criador',
  'Outro',
];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-display font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function UserRow({ user, currentUserId, isSuperAdmin, onRoleChange, onBan, onDeletePosts }) {
  const [expanded, setExpanded] = useState(false);
  const isMe = user.id === currentUserId;
  const canEdit = !isMe && (isSuperAdmin ? user.role !== 'super_admin' : user.role === 'user');
  const availableRoles = ROLES.filter(r => r !== user.role).filter(r =>
    isSuperAdmin ? true : r !== 'super_admin'
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Avatar profile={user} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{user.username}</p>
            {isMe && <span className="text-xs text-gray-500 font-mono shrink-0">(você)</span>}
            {user.banned && <span className="tag tag-pink shrink-0">banido</span>}
          </div>
        </div>
        <span className={`tag ${roleColors[user.role] || 'tag-cyan'} shrink-0`}>{user.role}</span>
        {canEdit && (
          <button onClick={() => setExpanded(e => !e)}
            className="text-gray-500 hover:text-white transition-colors ml-1 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>
      {expanded && canEdit && (
        <div className="border-t border-dark-500 bg-dark-700 px-4 py-3 space-y-3">
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
          <div>
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">Ações:</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { onBan(user.id, !user.banned); setExpanded(false); }}
                className="btn-purple py-1.5 px-3 text-xs flex items-center gap-1.5">
                <Ban size={12} />{user.banned ? 'Desbanir' : 'Banir usuário'}
              </button>
              {user.role === 'user' && (
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
  const [liveMod, setLiveMod] = useState({ silenced: [], lives: [], endedLives: [], requests: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [reactivateModal, setReactivateModal] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logCat, setLogCat] = useState('todos');
  const [logsLoading, setLogsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [notifLoading, setNotifLoading] = useState(false);
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

  async function handleEndLive(postId, title) {
    if (!confirm('Encerrar esta live?')) return;
    const { error } = await supabase.from('posts').update({ is_live: false }).eq('id', postId);
    if (error) { toast.error('Erro ao encerrar live'); return; }
    toast.success('Live encerrada');
    await logAction('live_ended', `Live "${title}" encerrada pelo admin`);
    fetchLiveMod();
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

  async function handleBan(userId, banned) {
    const target = users.find(u => u.id === userId);
    const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
    if (error) toast.error('Erro');
    else {
      toast.success(banned ? 'Usuário banido' : 'Usuário desbanido');
      await logAction(
        banned ? 'admin_ban' : 'admin_unban',
        `@${target?.username || userId} foi ${banned ? 'banido' : 'desbanido'} por @${profile?.username}`,
        'security', banned ? 'warning' : 'info'
      );
      if (banned) {
        await supabase.from('admin_notifications').insert({
          type: 'user_banned',
          title: 'Usuário banido',
          message: `@${target?.username || userId} foi banido por @${profile?.username}`,
          audience: 'all_admins',
        });
      }
      fetchAll();
    }
  }

  async function handleDeletePosts(userId, username) {
    if (!confirm(`Deletar todos os posts de ${username}?`)) return;
    const { error } = await supabase.from('posts').delete().eq('user_id', userId);
    if (error) toast.error('Erro ao deletar posts');
    else {
      toast.success('Posts deletados');
      await logAction('admin_delete_posts',
        `Todos os posts de @${username} deletados por @${profile?.username}`,
        'admin', 'warning');
      fetchAll();
    }
  }

  async function handleDeletePost(postId) {
    if (!confirm('Deletar este post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) toast.error('Erro');
    else {
      toast.success('Post deletado');
      await logAction('admin_delete_post', `Post deletado pelo admin @${profile?.username}`, 'admin', 'warning');
      fetchAll();
    }
  }

  async function handleDeleteKey(keyId) {
    if (!confirm('Remover este item?')) return;
    const { error } = await supabase.from('game_keys').delete().eq('id', keyId);
    if (error) toast.error('Erro');
    else {
      toast.success('Removido');
      await logAction('admin_delete_key', `Key removida pelo admin @${profile?.username}`, 'admin', 'info');
      fetchAll();
    }
  }

  if (!isAdmin) return null;

  const filteredUsers = filterRole === 'todos' ? users : users.filter(u => u.role === filterRole);
  const pendingCount = liveMod.requests?.length || 0;

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

      <div className="card p-5 border-neon-purple/20">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-neon-purple" />
          <h1 className="font-display text-sm text-neon-purple tracking-widest uppercase">
            Painel Admin — {role}
          </h1>
        </div>
        <p className="text-xs text-gray-500 font-mono">Área restrita. Acesso controlado por hierarquia.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Users} label="Usuários" value={stats.users} color="bg-neon-cyan/10 text-neon-cyan" />
        <StatCard icon={FileText} label="Posts" value={stats.posts} color="bg-neon-green/10 text-neon-green" />
        <StatCard icon={Key} label="Keys" value={stats.keys} color="bg-neon-purple/10 text-neon-purple" />
      </div>

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
        <>
          {tab === 'users' && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {['todos', 'user', 'admin', 'super_admin'].map(r => (
                  <button key={r} onClick={() => setFilterRole(r)}
                    className={`tag cursor-pointer transition-all ${
                      filterRole === r
                        ? r === 'todos' ? 'tag-green' : roleColors[r]
                        : 'opacity-40 hover:opacity-70 tag-cyan'
                    }`}>
                    {r} {r === 'todos' ? `(${users.length})` : `(${users.filter(u => u.role === r).length})`}
                  </button>
                ))}
              </div>
              {filteredUsers.map(u => (
                <UserRow key={u.id} user={u} currentUserId={user?.id}
                  isSuperAdmin={isSuperAdmin} onRoleChange={handleRoleChange}
                  onBan={handleBan} onDeletePosts={handleDeletePosts} />
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
                  content_post_created: { Icon: FileText,     cls: 'text-neon-green' },
                  content_post_deleted: { Icon: Trash2,       cls: 'text-red-400' },
                  content_post_edited:  { Icon: Pencil,       cls: 'text-gray-400' },
                  live_ended:           { Icon: Tv,           cls: 'text-gray-500' },
                  live_reactivated:     { Icon: RotateCcw,    cls: 'text-neon-green' },
                  reactivation_requested:{ Icon: RotateCcw,  cls: 'text-yellow-400' },
                  reactivation_approved:{ Icon: CheckCircle,  cls: 'text-neon-green' },
                  reactivation_denied:  { Icon: XCircle,      cls: 'text-red-400' },
                  admin_ban:            { Icon: Ban,          cls: 'text-red-400' },
                  admin_unban:          { Icon: Shield,       cls: 'text-neon-green' },
                  admin_role_changed:   { Icon: Crown,        cls: 'text-yellow-400' },
                  admin_delete_posts:   { Icon: Trash2,       cls: 'text-red-400' },
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

              {!liveMod.requests?.length ? (
                <div className="card p-8 text-center">
                  <CheckCircle size={28} className="text-neon-green/40 mx-auto mb-2" />
                  <p className="text-xs font-mono text-gray-500">Nenhuma solicitação pendente</p>
                </div>
              ) : liveMod.requests.map(req => (
                <div key={req.id} className="card p-4 border-yellow-400/10 space-y-3">
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
                  <div className="bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
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
          )}
        </>
      )}
    </div>
  );
}
