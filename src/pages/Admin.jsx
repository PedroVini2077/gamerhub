import { useEffect, useState } from 'react';
import { useRole } from '../hooks/useRole';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Shield, Users, Key, FileText, Trash2, Ban, ChevronDown, ChevronUp, Check } from 'lucide-react';

const ROLES = ['user', 'admin', 'super_admin'];
const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };

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

  const canEdit = !isMe && (
    isSuperAdmin ? user.role !== 'super_admin' : user.role === 'user'
  );

  const availableRoles = ROLES.filter(r => r !== user.role).filter(r =>
    isSuperAdmin ? true : r !== 'super_admin'
  );

  return (
    <div className="card overflow-hidden">
      {/* Linha principal */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-full bg-dark-400 border border-dark-300 flex items-center justify-center shrink-0">
          <span className="text-sm font-mono text-gray-300">
            {user.username?.[0]?.toUpperCase() || '?'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{user.username}</p>
            {isMe && <span className="text-xs text-gray-500 font-mono shrink-0">(você)</span>}
            {user.banned && <span className="tag tag-pink shrink-0">banido</span>}
          </div>
        </div>

        {/* Role sempre à direita */}
        <span className={`tag ${roleColors[user.role] || 'tag-cyan'} shrink-0`}>
          {user.role}
        </span>

        {/* Expandir ações */}
        {canEdit && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-gray-500 hover:text-white transition-colors ml-1 shrink-0"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {/* Painel de ações expandido */}
      {expanded && canEdit && (
        <div className="border-t border-dark-500 bg-dark-700 px-4 py-3 space-y-3">
          {/* Mudar role */}
          <div>
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">Mudar role para:</p>
            <div className="flex gap-2 flex-wrap">
              {availableRoles.map(r => (
                <button
                  key={r}
                  onClick={() => { onRoleChange(user.id, r); setExpanded(false); }}
                  className={`tag cursor-pointer hover:opacity-100 transition-opacity ${roleColors[r]}`}
                >
                  → {r}
                </button>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div>
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">Ações:</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { onBan(user.id, !user.banned); setExpanded(false); }}
                className="btn-purple py-1.5 px-3 text-xs flex items-center gap-1.5"
              >
                <Ban size={12} />
                {user.banned ? 'Desbanir' : 'Banir usuário'}
              </button>

              {user.role === 'user' && (
                <button
                  onClick={() => { onDeletePosts(user.id, user.username); }}
                  className="flex items-center gap-1.5 text-xs font-mono text-red-400/70 hover:text-red-400 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded transition-all"
                >
                  <Trash2 size={12} />
                  Deletar posts
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

export default function Admin() {
  const { isAdmin, isSuperAdmin, role } = useRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState({ users: 0, posts: 0, keys: 0 });
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('todos');

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    fetchAll();
  }, [isAdmin]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: u }, { data: p }, { data: k }] = await Promise.all([
      supabase.from('profiles').select('*').order('role').order('username'),
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
    if (error) toast.error('Sem permissão ou erro ao atualizar');
    else { toast.success(`Role → ${newRole}`); fetchAll(); }
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
    if (!confirm('Remover este item?')) return;
    const { error } = await supabase.from('game_keys').delete().eq('id', keyId);
    if (error) toast.error('Erro');
    else { toast.success('Removido'); fetchAll(); }
  }

  if (!isAdmin) return null;

  const filteredUsers = filterRole === 'todos'
    ? users
    : users.filter(u => u.role === filterRole);

  const tabs = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'keys', label: 'Keys & Promos', icon: Key },
  ];

  return (
    <div className="space-y-5">
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

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-display tracking-wider uppercase rounded border transition-all shrink-0 ${
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
              {/* Filtro por role */}
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
                <UserRow
                  key={u.id}
                  user={u}
                  currentUserId={user?.id}
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
                    <button onClick={() => handleDeleteKey(k.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
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
