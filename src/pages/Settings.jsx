import { useState, useEffect } from 'react';
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
        position: 'relative', width: 44, height: 24, borderRadius: 12,
        background: value ? '#39ff14' : '#2e2e3e', border: 'none',
        cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: 'white', transition: 'left 0.2s', display: 'block',
      }} />
    </button>
  );
}

export default function Settings_() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [notifLikes, setNotifLikes] = useState(null);
  const [notifComments, setNotifComments] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (profile) {
      setNotifLikes(profile.notif_likes ?? true);
      setNotifComments(profile.notif_comments ?? true);
    }
  }, [profile]);

  async function handleToggleNotif(field, value) {
    if (field === 'likes') setNotifLikes(value);
    else setNotifComments(value);

    const { error } = await supabase.from('profiles').update({
      [field === 'likes' ? 'notif_likes' : 'notif_comments']: value
    }).eq('id', user.id);

    if (error) toast.error('Erro ao salvar preferência');
    else toast.success('Preferência salva!');
  }

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

  async function handleChangeEmail() {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Email inválido');
      return;
    }
    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) toast.error('Erro ao alterar email');
    else {
      toast.success('Confirmação enviada para o novo email!');
      setNewEmail('');
      setShowEmailForm(false);
    }
    setChangingEmail(false);
  }

  async function handleDeleteAccount() {
    const confirmed = confirm('Tem certeza? Essa ação é IRREVERSÍVEL.\nTodos os seus dados serão deletados.');
    if (!confirmed) return;
    const doubleConfirm = confirm('Última chance. Confirmar exclusão da conta?');
    if (!doubleConfirm) return;

    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) toast.error('Erro ao deletar conta.');
      else { await signOut(); toast.success('Conta deletada.'); }
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    }
    setDeletingAccount(false);
  }

  const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };

  if (!user) return (
    <div className="max-w-md mx-auto card p-10 text-center mt-10">
      <p className="text-gray-400 mb-4 font-mono text-sm">Você precisa estar logado.</p>
      <Link to="/login" className="btn-solid">Fazer Login</Link>
    </div>
  );

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

        {/* Email */}
        <div className="flex items-start gap-4 py-4 border-b border-dark-500">
          <div className="w-8 h-8 rounded bg-dark-500 flex items-center justify-center shrink-0 mt-0.5">
            <Mail size={15} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Email</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">{user.email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="tag tag-green text-xs">verificado</span>
            <button
              onClick={() => setShowEmailForm(o => !o)}
              className="text-gray-500 hover:text-neon-green transition-colors"
            >
              <ChevronRight size={16} style={{ transform: showEmailForm ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
          </div>
        </div>

        {showEmailForm && (
          <div className="py-3 space-y-3 border-b border-dark-500 animate-fade-up">
            <input
              className="input-gamer"
              type="email"
              placeholder="Novo email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
            <p className="text-xs text-gray-500 font-mono">Um link de confirmação será enviado para o novo email.</p>
            <button onClick={handleChangeEmail} disabled={changingEmail} className="btn-solid py-2 px-4">
              {changingEmail ? 'Enviando...' : 'Alterar email'}
            </button>
          </div>
        )}

        {/* Role */}
        <div className="flex items-center gap-4 py-4 border-b border-dark-500">
          <div className="w-8 h-8 rounded bg-dark-500 flex items-center justify-center shrink-0">
            <Shield size={15} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Role</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">Seu nível de acesso</p>
          </div>
          <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'} shrink-0`}>
            {profile?.role || 'user'}
          </span>
        </div>

        {/* Senha */}
        <div className="flex items-center gap-4 py-4">
          <div className="w-8 h-8 rounded bg-dark-500 flex items-center justify-center shrink-0">
            <Lock size={15} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Senha</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">Troque sua senha de acesso</p>
          </div>
          <button
            onClick={() => setShowPasswordForm(o => !o)}
            className="text-gray-500 hover:text-neon-green transition-colors"
          >
            <ChevronRight size={16} style={{ transform: showPasswordForm ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {showPasswordForm && (
          <div className="space-y-3 animate-fade-up pb-2">
            <input className="input-gamer" type="password" placeholder="Nova senha (mín. 6 caracteres)"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <input className="input-gamer" type="password" placeholder="Confirmar nova senha"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <button onClick={handleChangePassword} disabled={changingPassword} className="btn-solid py-2 px-4">
              {changingPassword ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </div>
        )}
      </div>

      {/* Notificações */}
      <div className="card p-5">
        <h2 className="font-display text-xs text-gray-500 tracking-widest uppercase mb-2">Notificações</h2>
        <div className="flex items-center gap-4 py-4 border-b border-dark-500">
          <div className="w-8 h-8 rounded bg-dark-500 flex items-center justify-center shrink-0">
            <Bell size={15} className="text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Likes nos posts</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">Avisar quando curtirem seu post</p>
          </div>
          {notifLikes !== null && <Toggle value={notifLikes} onChange={v => handleToggleNotif('likes', v)} />}
        </div>
        <div className="flex items-center gap-4 py-4">
          <div className="w-8 h-8 rounded bg-dark-500 flex items-center justify-center shrink-0">
            <Bell size={15} className="text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Comentários</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">Avisar quando comentarem no seu post</p>
          </div>
          {notifComments !== null && <Toggle value={notifComments} onChange={v => handleToggleNotif('comments', v)} />}
        </div>
      </div>

      {/* Zona de perigo */}
      <div className="card p-5 border-red-500/20">
        <h2 className="font-display text-xs text-red-400 tracking-widest uppercase mb-2">Zona de Perigo</h2>
        <p className="text-xs text-gray-500 font-mono mb-3">Ações irreversíveis. Pense bem antes de continuar.</p>
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
