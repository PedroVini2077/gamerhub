import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Zap } from 'lucide-react';
import { calcAge, MIN_SIGNUP_AGE } from '../lib/date';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import ForgotForm from '../components/auth/ForgotForm';

export default function Login() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername]             = useState('');
  const [birthDate, setBirthDate]           = useState('');
  const [uf, setUf]                         = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [loading, setLoading]               = useState(false);
  const [block, setBlock]                   = useState(null); // { permanent, blocked_until } | null

  const isBlocked = !!block && (block.permanent || (block.blocked_until && new Date(block.blocked_until).getTime() > Date.now()));

  // Enquanto bloqueado, consulta o servidor periodicamente para refletir
  // desbloqueio feito pelo admin sem precisar recarregar a página.
  useEffect(() => {
    if (!isBlocked || !email.trim()) return;
    const t = setInterval(async () => {
      const { data } = await supabase.rpc('check_login_status', { p_email: email.trim() });
      if (!data?.blocked) setBlock(null);
      else setBlock({ permanent: data.permanent, blocked_until: data.blocked_until });
    }, 8000);
    return () => clearInterval(t);
  }, [isBlocked, email]);

  function switchMode(m) {
    setMode(m);
    setConfirmPassword('');
    setBirthDate('');
    setUf('');
    setSelectedPlatform('');
  }

  async function handleSubmit() {
    if (!email) { toast.error('Preencha seu email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Informe um email válido'); return; }
    if (mode !== 'forgot' && !password) { toast.error('Preencha sua senha'); return; }
    if (mode === 'register' && !username) { toast.error('Escolha um username'); return; }

    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/auth/confirm',
      });
      if (error) toast.error(error.message);
      else { toast.success('Link de recuperação enviado! Verifique seu email.'); switchMode('login'); }
      setLoading(false);
      return;
    }

    if (mode === 'login') {
      const { data: status } = await supabase.rpc('check_login_status', { p_email: email.trim() });
      if (status?.blocked) {
        setBlock({ permanent: status.permanent, blocked_until: status.blocked_until });
        toast.error(status.permanent
          ? 'Conta bloqueada por excesso de tentativas. Contate o suporte ou redefina sua senha.'
          : 'Muitas tentativas falhas. Aguarde para tentar novamente.');
        setLoading(false);
        return;
      }

      const { error, banned } = await signInWithEmail(email, password);
      if (banned) {
        toast.error('Sua conta foi banida. Entre em contato com o suporte.');
        setLoading(false);
        return;
      }
      if (error) {
        const { data: after } = await supabase.rpc('register_login_attempt', { p_email: email.trim() });
        if (after?.blocked) {
          setBlock({ permanent: after.permanent, blocked_until: after.blocked_until });
          toast.error(after.permanent
            ? 'Conta bloqueada por excesso de tentativas. Contate o suporte ou redefina sua senha.'
            : 'Muitas tentativas falhas. Conta bloqueada por 15 minutos.');
        } else {
          const left = 5 - (after?.attempts || 0);
          const aviso = left > 0 ? ` (${left} tentativa${left > 1 ? 's' : ''} até o bloqueio)` : '';
          toast.error(error.message + aviso);
        }
      } else {
        // await obrigatório: o builder do supabase-js é lazy — sem await o reset nunca é enviado.
        await supabase.rpc('reset_login_attempts');
        setBlock(null);
        navigate('/');
      }
    }

    if (mode === 'register') {
      if (password.length < 8) { toast.error('Senha precisa ter pelo menos 8 caracteres'); setLoading(false); return; }
      if (password !== confirmPassword) { toast.error('Senhas não coincidem'); setLoading(false); return; }
      if (!birthDate) { toast.error('Informe sua data de nascimento'); setLoading(false); return; }
      const age = calcAge(birthDate);
      if (age < MIN_SIGNUP_AGE) { toast.error(`Você precisa ter pelo menos ${MIN_SIGNUP_AGE} anos para se cadastrar`); setLoading(false); return; }

      const extraFields = {};
      if (birthDate)        extraFields.birth_date = birthDate;
      if (uf)               extraFields.state = uf;
      if (selectedPlatform) extraFields.platform = selectedPlatform;

      const { error } = await signUpWithEmail(email, password, username, extraFields);
      if (error) toast.error(error.message);
      else toast.success('Conta criada! Verifique seu email.');
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap size={28} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 10px #39ff14)' }} />
            <span className="font-display font-bold text-3xl text-neon-green tracking-wider">GAMER</span>
            <span className="font-display font-bold text-3xl text-white tracking-wider">HUB</span>
          </div>
          <p className="text-gray-500 font-mono text-xs">Sua base de operações gamer</p>
        </div>

        <div className="card p-7">
          {mode === 'login' && (
            <LoginForm
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              loading={loading} block={block} setBlock={setBlock}
              onSubmit={handleSubmit}
              onForgot={() => switchMode('forgot')}
              onSwitchToRegister={() => switchMode('register')}
            />
          )}
          {mode === 'register' && (
            <RegisterForm
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
              username={username} setUsername={setUsername}
              birthDate={birthDate} setBirthDate={setBirthDate}
              uf={uf} setUf={setUf}
              selectedPlatform={selectedPlatform} setSelectedPlatform={setSelectedPlatform}
              loading={loading}
              onSubmit={handleSubmit}
              onSwitchToLogin={() => switchMode('login')}
            />
          )}
          {mode === 'forgot' && (
            <ForgotForm
              email={email} setEmail={setEmail}
              loading={loading}
              onSubmit={handleSubmit}
              onBack={() => switchMode('login')}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-600 font-mono mt-4">
          // GamerHub v1.0 — Powered by Supabase
        </p>
      </div>
    </div>
  );
}
