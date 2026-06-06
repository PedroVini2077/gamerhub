import { useState, useEffect, useCallback } from 'react';
import {
  Gem, Activity, Users, FileText, Settings, Shield,
  Zap, Key, ChevronDown, Search, RefreshCw,
  ToggleLeft, ToggleRight, AlertTriangle, UserX, UserCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useRole } from '../hooks/useRole';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ui/ConfirmModal';

const OC = '#f97316'; // owner color
const OG = 'rgba(249,115,22,0.15)'; // owner glow

// ─── Painel Tab ──────────────────────────────────────────────────────────────

function PainelTab() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('owner_get_stats');
    if (error) toast.error('Erro ao carregar stats: ' + error.message);
    else setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-dark-700 rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  if (!stats) return (
    <div className="card p-8 text-center">
      <p className="text-xs text-gray-500 font-mono">Erro ao carregar dados.</p>
    </div>
  );

  const row1 = [
    { label: 'Membros',      value: stats.total_users,  color: '#22d3ee', Icon: Users   },
    { label: 'Admins',       value: stats.admins,        color: '#a855f7', Icon: Shield  },
    { label: 'Banidos',      value: stats.banned_users,  color: '#ef4444', Icon: UserX   },
    { label: 'Lives Ativas', value: stats.active_lives,  color: '#39ff14', Icon: Zap     },
  ];
  const row2 = [
    { label: 'Posts Hoje',   value: stats.posts_today,  color: '#fbbf24', Icon: FileText },
    { label: 'Posts Semana', value: stats.posts_week,   color: OC,        Icon: FileText },
    { label: 'Total Posts',  value: stats.total_posts,  color: '#d1d5db', Icon: FileText },
    { label: 'Keys',         value: stats.total_keys,   color: '#39ff14', Icon: Key      },
  ];

  const daily   = stats.daily_signups || [];
  const maxCnt  = Math.max(...daily.map(d => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {row1.map(c => (
          <div key={c.label} className="card p-4" style={{ borderColor: `${c.color}25` }}>
            <c.Icon size={13} style={{ color: c.color }} className="mb-2 opacity-60" />
            <p className="font-display text-2xl font-bold" style={{ color: c.color }}>
              {c.value ?? 0}
            </p>
            <p className="text-xs font-mono text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {row2.map(c => (
          <div key={c.label} className="card p-4" style={{ borderColor: `${c.color}25` }}>
            <c.Icon size={13} style={{ color: c.color }} className="mb-2 opacity-60" />
            <p className="font-display text-2xl font-bold" style={{ color: c.color }}>
              {c.value ?? 0}
            </p>
            <p className="text-xs font-mono text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de novos membros */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Novos membros — últimos 14 dias
          </p>
          {stats.users_today > 0 && (
            <span className="text-xs font-mono font-bold" style={{ color: OC }}>
              +{stats.users_today} hoje
            </span>
          )}
        </div>
        <div className="flex items-end gap-1 h-20">
          {daily.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${d.count > 0 ? Math.max((d.count / maxCnt) * 64, 8) : 3}px`,
                  background: d.count > 0 ? OC : '#2e2e3e',
                  opacity: d.count > 0 ? 1 : 0.5,
                }}
              />
              <p className="font-mono text-gray-700 leading-none" style={{ fontSize: 8 }}>
                {new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit', month: '2-digit',
                })}
              </p>
            </div>
          ))}
        </div>
      </div>

      <button onClick={load}
        className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-orange-400 transition-colors">
        <RefreshCw size={12} />Atualizar
      </button>
    </div>
  );
}

// ─── Usuários Tab ─────────────────────────────────────────────────────────────

const ROLE_COLOR = { owner: OC, super_admin: '#39ff14', admin: '#a855f7', user: '#6b7280' };
const ROLE_LABEL = { owner: 'Fundador', super_admin: 'Super Admin', admin: 'Admin', user: 'Usuário' };

function UserRow({ user, onSetRole, onBan }) {
  const [open, setOpen] = useState(false);
  const isOwnerUser     = user.role === 'owner';

  return (
    <div className="card p-0 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/40 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-2 h-2 rounded-full shrink-0"
          style={{ background: ROLE_COLOR[user.role] || '#6b7280' }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-mono text-white">{user.username}</span>
            {user.banned && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-400/15 text-red-400">
                banido
              </span>
            )}
            {isOwnerUser && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: '#f9731618', color: OC }}>
                fundador
              </span>
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
        <div className="px-4 pb-3 pt-2 border-t border-dark-600 flex flex-wrap gap-2 items-center">
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
      )}
    </div>
  );
}

function UsuariosTab() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [confirm, setConfirm] = useState(null);

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

  const filtered = users.filter(u => {
    if (search && !u.username?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'admin'       && u.role !== 'admin')       return false;
    if (filter === 'super_admin' && u.role !== 'super_admin') return false;
    if (filter === 'banned'      && !u.banned)                return false;
    return true;
  });

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

// ─── Logs Tab ────────────────────────────────────────────────────────────────

const SEV_COLOR = { info: '#6b7280', warning: '#f59e0b', critical: '#ef4444' };
const CAT_EMOJI = { auth: '🔐', security: '🛡️', content: '📝', admin: '⚙️', system: '🔧' };

function LogsTab() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [offset, setOffset]     = useState(0);
  const LIMIT = 30;

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('owner_get_audit_logs', {
      p_limit:    LIMIT,
      p_offset:   off,
      p_category: category || null,
      p_severity: severity || null,
    });
    if (error) toast.error('Erro ao carregar logs: ' + error.message);
    else setLogs(data || []);
    setLoading(false);
  }, [category, severity]);

  useEffect(() => { setOffset(0); load(0); }, [load]);

  function prev() { const o = Math.max(0, offset - LIMIT); setOffset(o); load(o); }
  function next() { const o = offset + LIMIT;               setOffset(o); load(o); }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 focus:outline-none">
          <option value="">Todas as categorias</option>
          <option value="auth">Auth</option>
          <option value="security">Security</option>
          <option value="content">Content</option>
          <option value="admin">Admin</option>
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 focus:outline-none">
          <option value="">Todos os níveis</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <button onClick={() => load(offset)}
          className="p-2 bg-dark-700 border border-dark-400 rounded text-gray-500 hover:text-orange-400 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map(log => (
            <div key={log.id}
              className="flex items-start gap-3 px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg">
              <span className="shrink-0 text-sm leading-none mt-0.5">
                {CAT_EMOJI[log.category] || '📋'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-gray-200">
                    {log.actor_username || 'sistema'}
                  </span>
                  <span className="text-xs font-mono text-gray-400 truncate">{log.action}</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color:      SEV_COLOR[log.severity] || '#6b7280',
                      background: `${SEV_COLOR[log.severity] || '#6b7280'}18`,
                    }}>
                    {log.severity}
                  </span>
                </div>
                {log.details && (
                  <p className="text-xs text-gray-600 font-mono mt-0.5 truncate">{log.details}</p>
                )}
              </div>
              <p className="text-xs font-mono text-gray-700 shrink-0 whitespace-nowrap">
                {new Date(log.created_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-xs text-gray-500 font-mono">Nenhum log encontrado.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-center">
        <button disabled={offset === 0} onClick={prev}
          className="px-4 py-2 text-xs font-mono border border-dark-400 rounded text-gray-400 hover:border-orange-400/50 hover:text-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ← Anterior
        </button>
        <button disabled={logs.length < LIMIT} onClick={next}
          className="px-4 py-2 text-xs font-mono border border-dark-400 rounded text-gray-400 hover:border-orange-400/50 hover:text-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Próximo →
        </button>
      </div>
    </div>
  );
}

// ─── Site Tab ────────────────────────────────────────────────────────────────

const BANNER_COLORS = [
  { label: 'Laranja', value: 'orange', hex: '#f97316' },
  { label: 'Vermelho', value: 'red',    hex: '#ef4444' },
  { label: 'Amarelo',  value: 'yellow', hex: '#eab308' },
  { label: 'Verde',    value: 'green',  hex: '#39ff14' },
  { label: 'Ciano',    value: 'cyan',   hex: '#22d3ee' },
  { label: 'Roxo',     value: 'purple', hex: '#a855f7' },
];

function SiteTab() {
  const [config, setConfig]   = useState({
    banner_enabled: 'false', banner_text: '', banner_color: 'orange', maintenance_mode: 'false',
  });
  const [saving, setSaving]   = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    supabase.from('site_config').select('key, value').then(({ data }) => {
      if (data) setConfig(prev => ({ ...prev, ...Object.fromEntries(data.map(r => [r.key, r.value])) }));
      setLoaded(true);
    });
  }, []);

  async function saveKey(key, value) {
    setSaving(true);
    const { error } = await supabase.rpc('owner_set_site_config', {
      p_key: key, p_value: String(value),
    });
    setSaving(false);
    if (error) toast.error('Erro ao salvar: ' + error.message);
  }

  function toggle(key) {
    const next = config[key] !== 'true' ? 'true' : 'false';
    setConfig(c => ({ ...c, [key]: next }));
    saveKey(key, next);
  }

  const bannerEnabled      = config.banner_enabled   === 'true';
  const maintenanceEnabled = config.maintenance_mode === 'true';
  const currentColor       = BANNER_COLORS.find(c => c.value === config.banner_color) || BANNER_COLORS[0];

  if (!loaded) return (
    <div className="space-y-3">
      <div className="h-52 bg-dark-700 rounded-xl animate-pulse" />
      <div className="h-24 bg-dark-700 rounded-xl animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Banner Global</p>
          <button onClick={() => toggle('banner_enabled')}
            className="flex items-center gap-1.5 text-xs font-mono transition-colors"
            style={{ color: bannerEnabled ? '#39ff14' : '#6b7280' }}>
            {bannerEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {bannerEnabled ? 'Ativo' : 'Inativo'}
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-gray-500">Texto do aviso</label>
          <input
            value={config.banner_text}
            onChange={e => setConfig(c => ({ ...c, banner_text: e.target.value }))}
            onBlur={e  => saveKey('banner_text', e.target.value)}
            placeholder="ex: Manutenção programada às 22h"
            className="w-full px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-300 focus:border-orange-400/50 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-gray-500">Cor</label>
          <div className="flex gap-2 flex-wrap">
            {BANNER_COLORS.map(c => (
              <button key={c.value}
                onClick={() => {
                  setConfig(prev => ({ ...prev, banner_color: c.value }));
                  saveKey('banner_color', c.value);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-mono transition-all"
                style={{
                  borderColor: config.banner_color === c.value ? c.hex : '#2e2e3e',
                  color:       config.banner_color === c.value ? c.hex : '#6b7280',
                  background:  config.banner_color === c.value ? `${c.hex}15` : 'transparent',
                }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.hex }} />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {config.banner_text?.trim() && (
          <div className="rounded-lg px-4 py-2.5 text-xs font-mono text-center"
            style={{
              background: `${currentColor.hex}18`,
              border:     `1px solid ${currentColor.hex}35`,
              color:      currentColor.hex,
            }}>
            📢 {config.banner_text}
          </div>
        )}
      </div>

      {/* Manutenção */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-mono text-gray-200">Modo Manutenção</p>
            <p className="text-xs font-mono text-gray-600 mt-0.5">
              Bloqueia o site para todos — exceto o fundador
            </p>
          </div>
          <button onClick={() => toggle('maintenance_mode')}
            className="flex items-center gap-1.5 text-xs font-mono transition-colors"
            style={{ color: maintenanceEnabled ? '#ef4444' : '#6b7280' }}>
            {maintenanceEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {maintenanceEnabled ? 'ATIVO' : 'Desligado'}
          </button>
        </div>
        {maintenanceEnabled && (
          <div className="flex items-center gap-2 mt-2 text-xs font-mono text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
            <AlertTriangle size={12} />
            Modo manutenção ativo — apenas o fundador tem acesso.
          </div>
        )}
      </div>

      {saving && (
        <p className="text-xs font-mono text-center animate-pulse" style={{ color: OC }}>
          Salvando...
        </p>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'painel',   label: 'Painel',     Icon: Activity  },
  { id: 'usuarios', label: 'Usuários',   Icon: Users     },
  { id: 'logs',     label: 'Audit Logs', Icon: FileText  },
  { id: 'site',     label: 'Site',       Icon: Settings  },
];

export default function Owner() {
  const { isOwner } = useRole();
  const navigate    = useNavigate();
  const [tab, setTab] = useState('painel');

  useEffect(() => {
    if (isOwner === false) navigate('/');
  }, [isOwner, navigate]);

  if (!isOwner) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="card p-5" style={{ borderColor: '#f9731635', boxShadow: `0 0 30px ${OG}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Gem size={15} style={{ color: OC }} />
          <h1 className="font-display text-sm tracking-widest uppercase" style={{ color: OC }}>
            Painel do Fundador
          </h1>
        </div>
        <p className="text-xs font-mono text-gray-500">
          Visão completa · controle total · acesso exclusivo
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-500 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-orange-400 text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={11} />{label}
          </button>
        ))}
      </div>

      {tab === 'painel'   && <PainelTab />}
      {tab === 'usuarios' && <UsuariosTab />}
      {tab === 'logs'     && <LogsTab />}
      {tab === 'site'     && <SiteTab />}
    </div>
  );
}
