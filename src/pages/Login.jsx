import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Zap, Mail, Lock, User, AlertTriangle, ShieldOff } from 'lucide-react';
import { logSecurity } from '../lib/auditLog';

const RATE_KEY = 'gh_login_attempts';

// Delay progressivo por tentativa (índice = nº de erros acumulados)
// 1 erro → sem espera, 2 → 30s, 3 → 1min, 4 → 5min, 5 → 15min, 6 → 1h, 7+ → 24h (bloqueio permanente)
const LOCKOUT_MS = [0, 0, 30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const PERMANENT_AFTER = 7;
const PERMANENT_MS    = 24 * 60 * 60_000;

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
  if (!s.blockedUntil || Date.now() >= s.blockedUntil) {
    return { blocked: false, attempts: s.attempts || 0 };
  }
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

export default function Login() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockStatus, setBlockStatus] = useState(() => getBlockStatus());
  const timerRef = useRef(null);

  // Countdown em tempo real — atualiza a cada segundo enquanto bloqueado
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

  const passwordStrength = mode === 'register' ? getPasswordStrength(password) : 0;

  async function handleSubmit() {
    const current = getBlockStatus();
    if (current.blocked) { setBlockStatus(current); return; }

    if (!email || !password) { toast.error('Preencha email e senha'); return; }
    if (mode === 'register' && !username) { toast.error('Escolha um username'); return; }

    setLoading(true);

    if (mode === 'login') {
      const { error } = await signInWithEmail(email, password);
      if (error) {
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
              : `Rate limiting ativado para "${email}" (${next.attempts} tentativas — bloqueio de ${formatCountdown(next.blockedUntil - Date.now())})`,
            email, next.attempts
          );
        } else {
          const attemptsLeft = LOCKOUT_MS.length - 1 - next.attempts;
          const warn = attemptsLeft > 0
            ? ` (${attemptsLeft} tentativa${attemptsLeft > 1 ? 's' : ''} até bloqueio)`
            : '';
          toast.error(error.message + warn);
          logSecurity(
            'auth_login_failed',
            `Tentativa ${next.attempts} de login falhou para "${email}"`,
            email, next.attempts
          );
        }
      } else {
        clearRateLimit();
        navigate('/');
      }
    } else {
      if (password.length < 8) { toast.error('Senha precisa ter pelo menos 8 caracteres'); setLoading(false); return; }
      const { error } = await signUpWithEmail(email, password, username);
      if (error) toast.error(error.message);
      else toast.success('Conta criada! Verifique seu email.');
    }

    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleSubmit();
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
          <div className="flex border border-dark-400 rounded overflow-hidden mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-xs font-display tracking-widest uppercase transition-all ${
                  mode === m ? 'bg-neon-green/10 text-neon-green' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Registrar'}
              </button>
            ))}
          </div>

          {blockStatus.blocked && (
            <div className={`mb-4 flex items-start gap-2 p-3 rounded-lg border ${
              blockStatus.permanent
                ? 'border-red-600/40 bg-red-600/10'
                : 'border-red-400/30 bg-red-400/5'
            }`}>
              {blockStatus.permanent
                ? <ShieldOff size={14} className="text-red-500 shrink-0 mt-0.5" />
                : <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              }
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
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Username</label>
                <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
                  <span className="pl-3 pr-2 text-gray-500 shrink-0"><User size={14} /></span>
                  <input
                    className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                    placeholder="seu_nick_aqui"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    onKeyDown={handleKey}
                    maxLength={20}
                  />
                </div>
                <p className="text-xs text-gray-600 font-mono mt-1">3-20 chars · letras minúsculas, números e _</p>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Email</label>
              <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
                <span className="pl-3 pr-2 text-gray-500 shrink-0"><Mail size={14} /></span>
                <input
                  className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                  type="email"
                  placeholder="gamer@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKey}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Senha</label>
              <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
                <span className="pl-3 pr-2 text-gray-500 shrink-0"><Lock size={14} /></span>
                <input
                  className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKey}
                />
              </div>

              {mode === 'register' && password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map(n => (
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

            <button
              onClick={handleSubmit}
              disabled={loading || blockStatus.blocked}
              className="btn-solid w-full py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Aguarde...' : blockStatus.blocked ? `// BLOQUEADO (${formatCountdown(blockStatus.remainingMs)})` : mode === 'login' ? '// ENTRAR' : '// CRIAR CONTA'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 font-mono mt-4">
          // GamerHub v1.0 — Powered by Supabase
        </p>
      </div>
    </div>
  );
}
