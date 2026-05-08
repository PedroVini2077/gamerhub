import { useEffect, useState } from 'react';
import { useRole } from '../hooks/useRole';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Shield, Users, Key, FileText, Trash2, Ban, ChevronDown } from 'lucide-react';

const ROLES = ['user', 'admin', 'super_admin'];

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

function UserRow({ user, currentRole, isSuperAdmin, onRoleChange, onBan, onDeletePosts }) {
  const [open, setOpen] = useState(false);
  const roleColors = {
    user: 'tag-cyan',
    admin: 'tag-purple',
    super_admin: 'tag-green',
  };

  const canEdit = isSuperAdmin
    ? user.role !== 'super_admin' || user.isCurrentUser
    : user.role === 'user';

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-full bg-dark-400 border border-dark-300 flex items-center justify-center shrink-0">
          <span className="text-sm font-mono text-gray-300">
            {user.username?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{user.username}</p>
          <p className="text-xs text-gray-500 font-mono truncate">{user.email}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`tag ${roleColors[user.role] || 'tag-cyan'}`}>{user.role}</span>

          {user.banned && <span className="tag tag-pink">banido</span>}

          {canEdit && (
            <div className="relative">
              <button
                onClick={() => setOpen(o => !o)}
                className="btn-neon py-1 px-3 text-xs flex items-center gap-1"
              >
                Role <ChevronDown size={12} />
              </button>
              {open && (
                <div className="absolute right-0 top-8 bg-dark-700 border border-dark-400 rounded shadow-lg z-10 min-w-32">
                  {ROLES.filter(r => {
                    if (!isSuperAdmin) return r === 'user' || r === 'admin';
                    return r !== 'super_admin';
                  }).map(r => (
                    <button
                      key={r}
                      onClick={() => { onRoleChange(user.id, r); setOpen(false); }}
                      className={`block w-full text-left px-4 py-2 text-xs font-mono hover:bg-dark-500 transition-colors ${
                        user.role === r ? 'text-neon-green' : 'text-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {canEdit && (
            <button
              onClick={() => onBan(user.id, !user.banned)}
              className="btn-purple py-1 px-3 text-xs flex items-center gap-1"
              title={user.banned ? 'Desbanir' : 'Banir'}
            >
              <Ban size={12} />
              {user.banned ? 'Desbanir' : 'Banir'}
            </button>
          )}

          {(isSuperAdmin || currentRole === 'admin') && user.role === 'user' && (
            <button
              onClick={() => onDeletePosts(user.id, user.username)}
              className="text-gray-600 hover:text-red-400 transition-colors p-1"
              title="Deletar posts"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KeyForm({ onAdd }) {
  const [form, setForm] = useState({
    game_title: '', platform: 'Steam', key_code: '', is_promo: false, discount_percent: 0, promo_url: ''
  });
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!form.game_title) { toast.error('Coloca o nome do jogo'); return; }
    setLoading(true);
    const { error } = await supabase.from('game_keys').insert(form);
    if (error) toast.error('Erro ao adicionar');
    else { toast.success('Adicionado!'); setForm({ game_title: '', platform: 'Steam', key_code: '', is_promo: false, discount_percent: 0, promo_url: '' }); onAdd(); }
    setLoading(false);
  }

  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-display text-xs text-neon-green tracking-widest uppercase">Adicionar Key / Promo</h3>
      <div className="grid grid-cols-2 gap-3">
        <input className="input-gamer" placeholder="Nome do jogo" value={form.game_title} onChange={e => setForm(f => ({ ...f, game_title: e.target.value }))} />
        <select className="input-gamer" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
          {['Steam', 'Epic', 'GOG', 'PlayStation', 'Xbox'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-400 font-mono cursor-pointer">
          <input type="checkbox" checked={form.is_promo} onChange={e => setForm(f => ({ ...f, is_promo: e.target.checked }))} />
          É promoção?
        </label>
      </div>
      {!form.is_promo ? (
        <input className="input-gamer" placeholder="Código da key" value={form.key_code} onChange={e => setForm(f => ({ ...f, key_code: e.target.value }))} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <input className="input-gamer" type="number" placeholder="Desconto %" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: +e.target.value }))} />
          <input className="input-gamer" placeholder="URL da promo" value={form.promo_url} onChange={e => setForm(f => ({ ...f, promo_url: e.target.value }))} />
        </div>
      )}
      <button onClick={handleAdd} disabled={loading} className="btn-solid py-2 px-5">
        {loading ? 'Salvando...' : 'Adicionar'}
      </button>
    </div>
  );
}

export default function Admin() {
  const { isAdmin, isSuperAdmin, role } = useRole();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState({ users: 0, posts: 0, keys: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    fetchAll();
  }, [isAdmin]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: u }, { data: p }, { data: k }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('posts').select('*, profiles(username)').order('created_at', { ascending: false }),
      supabase.from('game_keys').select('*').order('created_at', { ascending: false }),
    ]);
    setUsers(u || []);
    setPosts(p || []);
    setKeys(k || []);
    setStats({ users: u?.length || 0, posts: p?.length || 0, keys: k?.length || 0 });
    setLoading(false);
  }

  async function handleRoleChange(userId, newRole) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) toast.error('Erro ao atualizar role');
    else { toast.success(`Role atualizado para ${newRole}`); fetchAll(); }
  }

  async function handleBan(userId, banned) {
    const { error } = await supabase.from('profiles').update({ banned }).eq('id', userId);
    if (error) toast.error('Erro');
    else { toast.success(banned ? 'Usuário banido' : 'Usuário desbanido'); fetchAll(); }
  }

  async function handleDeletePosts(userId, username) {
    if (!confirm(`Deletar todos os posts de ${username}?`)) return;
    const { error } = await supabase.from('posts').delete().eq('user_id', userId);
    if (error) toast.error('Erro ao deletar posts');
    else { toast.success('Posts deletados'); fetchAll(); }
  }

  async function handleDeletePost(postId) {
    if (!confirm('Deletar este post?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) toast.error('Erro');
    else { toast.success('Post deletado'); fetchAll(); }
  }

  async function handleDeleteKey(keyId) {
    const { error } = await supabase.from('game_keys').delete().eq('id', keyId);
    if (error) toast.error('Erro');
    else { toast.success('Removido'); fetchAll(); }
  }

  if (!isAdmin) return null;

  const tabs = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'keys', label: 'Keys & Promos', icon: Key },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5 border-neon-purple/20">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={16} className="text-neon-purple" />
          <h1 className="font-display text-sm text-neon-purple tracking-widest uppercase">
            Painel Admin — {role}
          </h1>
        </div>
        <p className="text-xs text-gray-500 font-mono">Área restrita. Acesso controlado por hierarquia.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Users} label="Usuários" value={stats.users} color="bg-neon-cyan/10 text-neon-cyan" />
        <StatCard icon={FileText} label="Posts" value={stats.posts} color="bg-neon-green/10 text-neon-green" />
        <StatCard icon={Key} label="Keys" value={stats.keys} color="bg-neon-purple/10 text-neon-purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-display tracking-wider uppercase rounded border transition-all ${
              tab === id
                ? 'border-neon-purple bg-neon-purple/10 text-neon-purple'
                : 'border-dark-400 text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={13} /> {label}
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
              {users.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  currentRole={role}
                  isSuperAdmin={isSuperAdmin}
                  onRoleChange={handleRoleChange}
                  onBan={handleBan}
                  onDeletePosts={handleDeletePosts}
                />
              ))}
            </div>
          )}

          {tab === 'posts' && (
            <div className="space-y-3">
              {posts.map(p => (
                <div key={p.id} className="card p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-1">{p.title}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {p.profiles?.username} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button onClick={() => handleDeletePost(p.id)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'keys' && (
            <div className="space-y-4">
              <KeyForm onAdd={fetchAll} />
              <div className="space-y-3">
                {keys.map(k => (
                  <div key={k.id} className="card p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{k.game_title}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {k.platform} · {k.is_promo ? `Promo -${k.discount_percent}%` : k.key_code || 'sem key'}
                      </p>
                    </div>
                    <button onClick={() => handleDeleteKey(k.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
