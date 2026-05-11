import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Settings, Lock, Mail, Bell, Shield, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  const { user, profile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);

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
          <span className="tag tag-green text-xs">verificado</span>
        </SettingRow>

        <SettingRow icon={Shield} label="Role" description="Seu nível de acesso">
          <span className={`tag ${
            profile?.role === 'super_admin' ? 'tag-green' :
            profile?.role === 'admin' ? 'tag-purple' : 'tag-cyan'
          }`}>{profile?.role || 'user'}</span>
        </SettingRow>

        <SettingRow icon={Lock} label="Senha" description="Troque sua senha de acesso">
          <button
            onClick={() => setShowPasswordForm(o => !o)}
            className="text-gray-500 hover:text-neon-green transition-colors"
          >
            <ChevronRight size={16} className={`transition-transform ${showPasswordForm ? 'rotate-90' : ''}`} />
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
          <button
            onClick={() => setNotifLikes(o => !o)}
            className={`w-10 h-5 rounded-full transition-colors relative ${notifLikes ? 'bg-neon-green' : 'bg-dark-400'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${notifLikes ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </SettingRow>

        <SettingRow icon={Bell} label="Comentários" description="Avisar quando comentarem no seu post">
          <button
            onClick={() => setNotifComments(o => !o)}
            className={`w-10 h-5 rounded-full transition-colors relative ${notifComments ? 'bg-neon-green' : 'bg-dark-400'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${notifComments ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </SettingRow>
      </div>

      {/* Zona de perigo */}
      <div className="card p-5 border-red-500/20">
        <h2 className="font-display text-xs text-red-400 tracking-widest uppercase mb-2">Zona de Perigo</h2>
        <p className="text-xs text-gray-500 font-mono mb-3">
          Ações irreversíveis. Pense bem antes de continuar.
        </p>
        <button
          onClick={() => toast.error('Entre em contato com o suporte para deletar sua conta.')}
          className="text-xs font-mono text-red-400/70 hover:text-red-400 border border-red-400/30 hover:border-red-400/60 px-4 py-2 rounded transition-all"
        >
          Deletar minha conta
        </button>
      </div>
    </div>
  );
}
