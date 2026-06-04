import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Zap, Mail, Lock, User, AlertTriangle, ShieldOff, ArrowLeft, Calendar, MapPin, Gamepad2 } from 'lucide-react';
import { logSecurity } from '../lib/auditLog';

const RATE_KEY = 'gh_login_attempts';
const LOCKOUT_MS     = [0, 0, 30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const PERMANENT_AFTER = 7;
const PERMANENT_MS    = 24 * 60 * 60_000;

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const PLATFORMS = ['PC','PlayStation','Xbox','Mobile','Switch','Multi'];

function loadState() {
  try { return JSON.parse(localStorage.getItem(RATE_KEY)) || {}; } catch { return {}; }
}
function saveState(s) {
  try { localStorage.setItem(RATE_KEY, JSON.stringify(s)); } catch {}
}
function clearRateLimit() {
  try { localStorage.removeItem(RATE_KEY); } catch {}
}
function recordFailedAttempt() {
  const s = loadState();
  const attempts = (s.attempts || 0) + 1;
  const permanent = attempts >= PERMANENT_AFTER;
  const delayMs = permanent ? PERMANENT_MS : (LOCKOUT_MS[attempts] ?? LOCKOUT_MS.at(-1));
  const blockedUntil = delayMs > 0 ? Date.now() + delayMs : null;
  saveState({ attempts, blockedUntil, permanent });
  return { attempts, blockedUntil, permanent };
}
function getBlockStatus() {
  const s = loadState();
  if (!s.blockedUntil || Date.now() >= s.blockedUntil) return { blocked: false, attempts: s.attempts || 0 };
  return { blocked: true, permanent: !!s.permanent, remainingMs: s.blockedUntil - Date.now(), attempts: s.attempts || 0 };
}
function formatCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min}min ${sec}s` : `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
function getPasswordStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];
const STRENGTH_COLORS = ['', '#ff4444', '#ffaa00', '#39ff14bb', '#39ff14'];

const maxBirthDate = new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
  const [blockStatus, setBlockStatus]       = useState(() => getBlockStatus());
  const timerRef = useRef(null);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!blockStatus.blocked) return;
    timerRef.current = setInterval(() => {
      const s = getBlockStatus();
      setBlockStatus(s);
      if (!s.blocked) clearInterval(timerRef.current);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [blockStatus.blocked]);

  function switchMode(m) {
    setMode(m);
    setConfirmPassword('');
    setBirthDate('');
    setUf('');
    setSelectedPlatform('');
  }

  const passwordStrength = mode === 'register' ? getPasswordStrength(password) : 0;

  async function handleSubmit() {
    const current = getBlockStatus();
    if (current.blocked) { setBlockStatus(current); return; }

    if (!email) { toast.error('Preencha seu email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Informe um email válido'); return; }
    if (mode !== 'forgot' && !password) { toast.error('Preencha sua senha'); return; }
    if (mode === 'register' && !username) { toast.error('Escolha um username'); return; }

    setLoading(true);

    // ── Esqueci minha senha ──
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/login',
      });
      if (error) toast.error(error.message);
      else { toast.success('Link de recuperação enviado! Verifique seu email.'); switchMode('login'); }
      setLoading(false);
      return;
    }

    // ── Login ──
    if (mode === 'login') {
      const { data: blockData } = await supabase.rpc('check_login_block', { p_email: email.trim() });
      if (blockData?.blocked) {
        const blockedUntilMs = blockData.blocked_until
          ? new Date(blockData.blocked_until).getTime()
          : Date.now() + PERMANENT_MS;
        saveState({ attempts: blockData.attempts, blockedUntil: blockedUntilMs, permanent: !!blockData.permanent });
        setBlockStatus(getBlockStatus());
        setLoading(false);
        return;
      }

      const { error } = await signInWithEmail(email, password);
      if (error) {
        supabase.rpc('record_login_failure', { p_email: email.trim() });
        const next = recordFailedAttempt();
        setBlockStatus(getBlockStatus());
        if (next.blocked) {
          const msg = next.permanent
            ? 'Conta bloqueada por 24h por excesso de tentativas.'
            : `Muitas tentativas. Aguarde ${formatCountdown(next.blockedUntil - Date.now())}.`;
          toast.error(msg);
          logSecurity(
            next.permanent ? 'auth_permanent_block' : 'auth_rate_limited',
            next.permanent
              ? `Bloqueio permanente (24h) ativado para "${email}" após ${next.attempts} tentativas`
              : `Rate limiting ativado para "${email}" (${next.attempts} tentativas)`,
            email, next.attempts
          );
        } else {
          const attemptsLeft = LOCKOUT_MS.length - 1 - next.attempts;
          const warn = attemptsLeft > 0 ? ` (${attemptsLeft} tentativa${attemptsLeft > 1 ? 's' : ''} até bloqueio)` : '';
          toast.error(error.message + warn);
          logSecurity('auth_login_failed', `Tentativa ${next.attempts} de login falhou para "${email}"`, email, next.attempts);
        }
      } else {
        supabase.rpc('clear_login_rate_limit', { p_email: email.trim() });
        clearRateLimit();
        navigate('/');
      }
    }

    // ── Cadastro ──
    if (mode === 'register') {
      if (password.length < 8) { toast.error('Senha precisa ter pelo menos 8 caracteres'); setLoading(false); return; }
      if (password !== confirmPassword) { toast.error('Senhas não coincidem'); setLoading(false); return; }
      if (!birthDate) { toast.error('Informe sua data de nascimento'); setLoading(false); return; }
      const age = (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 13) { toast.error('Você precisa ter pelo menos 13 anos para se cadastrar'); setLoading(false); return; }

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

  function handleKey(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  const InputWrap = ({ children }) => (
    <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
      {children}
    </div>
  );

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
          {/* Header — tabs ou voltar */}
          {mode === 'forgot' ? (
            <div className="flex items-center gap-3 mb-6">
              <button type="button" onClick={() => switchMode('login')}
                className="text-gray-500 hover:text-neon-green transition-colors">
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs font-display text-gray-300 tracking-widest uppercase">Recuperar Senha</span>
            </div>
          ) : (
            <div className="flex border border-dark-400 rounded overflow-hidden mb-6">
              {['login', 'register'].map(m => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  className={`flex-1 py-2.5 text-xs font-display tracking-widest uppercase transition-all ${
                    mode === m ? 'bg-neon-green/10 text-neon-green' : 'text-gray-500 hover:text-gray-300'
                  }`}>
                  {m === 'login' ? 'Entrar' : 'Registrar'}
                </button>
              ))}
            </div>
          )}

          {/* Banner de bloqueio */}
          {blockStatus.blocked && (
            <div className={`mb-4 flex items-start gap-2 p-3 rounded-lg border ${
              blockStatus.permanent ? 'border-red-600/40 bg-red-600/10' : 'border-red-400/30 bg-red-400/5'
            }`}>
              {blockStatus.permanent
                ? <ShieldOff size={14} className="text-red-500 shrink-0 mt-0.5" />
                : <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />}
              <div className="text-xs font-mono">
                {blockStatus.permanent ? (
                  <p className="text-red-500">
                    Conta bloqueada por <span className="font-bold">excesso de tentativas</span>.
                    Aguarde <span className="font-bold">{formatCountdown(blockStatus.remainingMs)}</span> ou redefina sua senha.
                  </p>
                ) : (
                  <p className="text-red-400">
                    Muitas tentativas falhas. Aguarde{' '}
                    <span className="font-bold tabular-nums">{formatCountdown(blockStatus.remainingMs)}</span>{' '}
                    para tentar novamente.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Descrição modo forgot */}
            {mode === 'forgot' && (
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                Informe seu email cadastrado e enviaremos um link para redefinir sua senha.
              </p>
            )}

            {/* Username — só no cadastro */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Username</label>
                <InputWrap>
                  <span className="pl-3 pr-2 text-gray-500 shrink-0"><User size={14} /></span>
                  <input id="username" aria-label="Nome de usuário"
                    className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                    placeholder="seu_nick_aqui" value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    onKeyDown={handleKey} maxLength={20} />
                </InputWrap>
                <p className="text-xs text-gray-600 font-mono mt-1">3-20 chars · letras minúsculas, números e _</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Email</label>
              <InputWrap>
                <span className="pl-3 pr-2 text-gray-500 shrink-0"><Mail size={14} /></span>
                <input id="email" aria-label="Email" type="email"
                  className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                  placeholder="gamer@email.com" value={email}
                  onChange={e => setEmail(e.target.value)} onKeyDown={handleKey} />
              </InputWrap>
            </div>

            {/* Senha — oculta no forgot */}
            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Senha</label>
                <InputWrap>
                  <span className="pl-3 pr-2 text-gray-500 shrink-0"><Lock size={14} /></span>
                  <input id="password" aria-label="Senha" type="password"
                    className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                    placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} onKeyDown={handleKey} />
                </InputWrap>
                {mode === 'register' && password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1,2,3,4].map(n => (
                        <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ background: n <= passwordStrength ? STRENGTH_COLORS[passwordStrength] : '#2e2e3e' }} />
                      ))}
                    </div>
                    <span className="text-xs font-mono w-16 text-right"
                      style={{ color: STRENGTH_COLORS[passwordStrength] || '#6b7280' }}>
                      {STRENGTH_LABELS[passwordStrength]}
                    </span>
                  </div>
                )}
                {mode === 'register' && (
                  <p className="text-xs text-gray-600 font-mono mt-1">mínimo 8 caracteres</p>
                )}
              </div>
            )}

            {/* Confirmar Senha — só no cadastro */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Confirmar Senha</label>
                <div className={`flex items-center bg-dark-700 border rounded-md transition-all ${
                  confirmPassword && confirmPassword !== password
                    ? 'border-red-400/60'
                    : 'border-dark-400 focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420]'
                }`}>
                  <span className="pl-3 pr-2 text-gray-500 shrink-0"><Lock size={14} /></span>
                  <input aria-label="Confirmar senha" type="password"
                    className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                    placeholder="••••••••" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} onKeyDown={handleKey} />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-400 font-mono mt-1">Senhas não coincidem</p>
                )}
              </div>
            )}

            {/* Data de Nascimento — só no cadastro */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">
                  Data de Nascimento <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
                  <span className="pl-3 pr-2 text-gray-500 shrink-0"><Calendar size={14} /></span>
                  <input aria-label="Data de nascimento" type="date"
                    className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white outline-none font-body"
                    value={birthDate} onChange={e => setBirthDate(e.target.value)}
                    max={maxBirthDate} />
                </div>
                <p className="text-xs text-gray-600 font-mono mt-1">Exigido pela LGPD · mínimo 13 anos</p>
              </div>
            )}

            {/* Estado — só no cadastro, opcional */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">
                  Estado <span className="text-gray-600 normal-case">(opcional)</span>
                </label>
                <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
                  <span className="pl-3 pr-2 text-gray-500 shrink-0"><MapPin size={14} /></span>
                  <select aria-label="Estado" value={uf} onChange={e => setUf(e.target.value)}
                    className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white outline-none font-body appearance-none">
                    <option value="" className="bg-dark-800">Selecione seu estado...</option>
                    {BR_STATES.map(s => <option key={s} value={s} className="bg-dark-800">{s}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Plataforma — só no cadastro, opcional */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">
                  Plataforma Principal <span className="text-gray-600 normal-case">(opcional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <button key={p} type="button" onClick={() => setSelectedPlatform(selectedPlatform === p ? '' : p)}
                      className={`tag cursor-pointer transition-all flex items-center gap-1 ${
                        selectedPlatform === p ? 'tag-green' : 'tag-purple opacity-50 hover:opacity-100'
                      }`}>
                      <Gamepad2 size={10} />{p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Botão principal */}
            <button onClick={handleSubmit} disabled={loading || blockStatus.blocked}
              className="btn-solid w-full py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Aguarde...'
                : blockStatus.blocked ? `// BLOQUEADO (${formatCountdown(blockStatus.remainingMs)})`
                : mode === 'login'    ? '// ENTRAR'
                : mode === 'register' ? '// CRIAR CONTA'
                : '// ENVIAR LINK DE RECUPERAÇÃO'}
            </button>

            {/* Link esqueci senha — só no login */}
            {mode === 'login' && !blockStatus.blocked && (
              <button type="button" onClick={() => switchMode('forgot')}
                className="w-full text-center text-xs text-gray-600 hover:text-gray-400 font-mono transition-colors">
                Esqueci minha senha
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 font-mono mt-4">
          // GamerHub v1.0 — Powered by Supabase
        </p>
      </div>
    </div>
  );
}
