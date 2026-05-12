import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Settings, Lock, Mail, Bell, Shield, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        background: value ? '#39ff14' : '#2e2e3e',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.2s',
          display: 'block',
        }}
      />
    </button>
  );
}

function SettingRow({ icon: Icon, label, description, children }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-dark-500 last:border-0">
      <div className="w-8 h-8 rounded bg-dark-500 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {description && <p className="text-xs text-gray-500 font-mono mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Settings_() {
  const { user, profile, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);

  if (!user) return (
    <div className="max-w-md mx-auto card p-10 text-center mt-10">
      <p className="text-gray-400 mb-4 font-mono text-sm">Você precisa estar logado.</p>
      <Link to="/login" className="btn-solid">Fazer Login</Link>
    </div>
  );

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Senha precisa ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Senhas não coincidem');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error('Erro ao trocar senha');
    else {
      toast.success('Senha atualizada!');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    }
    setChangingPassword(false);
  }

  async function handleDeleteAccount() {
    const confirmed = confirm(
      'Tem certeza? Essa ação é IRREVERSÍVEL.\nTodos os seus posts, comentários e dados serão deletados.'
    );
    if (!confirmed) return;

    const doubleConfirm = confirm('Última chance. Confirmar exclusão da conta?');
    if (!doubleConfirm) return;

    setDeletingAccount(true);
    const { error } = await supabase.from('profiles').delete().eq('id', user.id);
    if (error) {
      toast.error('Erro ao deletar conta. Entre em contato com o suporte.');
    } else {
      await signOut();
      toast.success('Conta deletada.');
    }
    setDeletingAccount(false);
  }

  const roleColors = {
    user: 'tag-cyan',
    admin: 'tag-purple',
    super_admin: 'tag-green',
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={16} className="text-neon-green" />
          <h1 className="font-display text-sm text-neon-green tracking-widest uppercase">Configurações</h1>
        </div>
        <p className="text-xs text-gray-500 font-mono">Gerencie sua conta e preferências.</p>
      </div>

      {/* Conta */}
      <div className="card p-5">
        <h2 className="font-display text-xs text-gray-500 tracking-widest uppercase mb-2">Conta</h2>

        <SettingRow icon={Mail} label="Email" description={user.email}>
          <span className="tag tag-green text-xs shrink-0">verificado</span>
        </SettingRow>

        <SettingRow icon={Shield} label="Role" description="Seu nível de acesso">
          <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'} shrink-0`}>
            {profile?.role || 'user'}
          </span>
        </SettingRow>

        <SettingRow icon={Lock} label="Senha" description="Troque sua senha de acesso">
          <button
            onClick={() => setShowPasswordForm(o => !o)}
            className="text-gray-500 hover:text-neon-green transition-colors"
          >
            <ChevronRight
              size={16}
              className="transition-transform duration-200"
              style={{ transform: showPasswordForm ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </button>
        </SettingRow>

        {showPasswordForm && (
          <div className="mt-3 space-y-3 animate-fade-up">
            <input
              className="input-gamer"
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <input
              className="input-gamer"
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
            <button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="btn-solid py-2 px-4"
            >
              {changingPassword ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </div>
        )}
      </div>

      {/* Notificações */}
      <div className="card p-5">
        <h2 className="font-display text-xs text-gray-500 tracking-widest uppercase mb-2">Notificações</h2>
        <SettingRow icon={Bell} label="Likes nos posts" description="Avisar quando curtirem seu post">
          <Toggle value={notifLikes} onChange={setNotifLikes} />
        </SettingRow>
        <SettingRow icon={Bell} label="Comentários" description="Avisar quando comentarem no seu post">
          <Toggle value={notifComments} onChange={setNotifComments} />
        </SettingRow>
      </div>

      {/* Zona de perigo */}
      <div className="card p-5 border-red-500/20">
        <h2 className="font-display text-xs text-red-400 tracking-widest uppercase mb-2">Zona de Perigo</h2>
        <p className="text-xs text-gray-500 font-mono mb-3">
          Ações irreversíveis. Pense bem antes de continuar.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          className="text-xs font-mono text-red-400/70 hover:text-red-400 border border-red-400/30 hover:border-red-400/60 px-4 py-2 rounded transition-all"
        >
          {deletingAccount ? 'Deletando...' : 'Deletar minha conta'}
        </button>
      </div>
    </div>
  );
}
