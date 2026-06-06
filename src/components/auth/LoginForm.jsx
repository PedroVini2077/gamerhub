import { useState, useEffect } from 'react';
import { Mail, Lock, AlertTriangle, ShieldOff } from 'lucide-react';
import { InputWrap } from './InputWrap';

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}min ${sec}s` : `${min}min`;
}

function LiveCountdown({ until, onExpire }) {
  const [ms, setMs] = useState(() => until - Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const left = until - Date.now();
      setMs(left);
      if (left <= 0) { clearInterval(t); onExpire?.(); }
    }, 500);
    return () => clearInterval(t);
  }, [until, onExpire]);
  return <span translate="no" className="notranslate font-bold tabular-nums">{formatCountdown(ms)}</span>;
}

export default function LoginForm({ email, setEmail, password, setPassword, loading, block, setBlock, onSubmit, onForgot, onSwitchToRegister }) {
  const isBlocked = !!block && (block.permanent || (block.blocked_until && new Date(block.blocked_until).getTime() > Date.now()));

  return (
    <>
      <div className="flex border border-dark-400 rounded overflow-hidden mb-6">
        <button type="button" className="flex-1 py-2.5 text-xs font-display tracking-widest uppercase bg-neon-green/10 text-neon-green">
          Entrar
        </button>
        <button type="button" onClick={onSwitchToRegister}
          className="flex-1 py-2.5 text-xs font-display tracking-widest uppercase text-gray-500 hover:text-gray-300">
          Registrar
        </button>
      </div>

      {isBlocked && (
        <div className={`mb-4 flex items-start gap-2 p-3 rounded-lg border ${
          block.permanent ? 'border-red-600/40 bg-red-600/10' : 'border-red-400/30 bg-red-400/5'
        }`}>
          {block.permanent
            ? <ShieldOff size={14} className="text-red-500 shrink-0 mt-0.5" />
            : <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />}
          <div className="text-xs font-mono">
            {block.permanent ? (
              <p className="text-red-500">
                Conta bloqueada por <span className="font-bold">excesso de tentativas</span>.
                Redefina sua senha ou contate o suporte.
              </p>
            ) : (
              <p className="text-red-400">
                Muitas tentativas falhas. Aguarde{' '}
                <LiveCountdown until={new Date(block.blocked_until).getTime()} onExpire={() => setBlock(null)} />{' '}
                para tentar novamente.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Email</label>
          <InputWrap>
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Mail size={14} /></span>
            <input id="email" aria-label="Email" type="email"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="gamer@email.com" value={email}
              onChange={e => { setEmail(e.target.value); if (block) setBlock(null); }}
              onKeyDown={e => e.key === 'Enter' && onSubmit()} />
          </InputWrap>
        </div>

        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Senha</label>
          <InputWrap>
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Lock size={14} /></span>
            <input id="password" aria-label="Senha" type="password"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSubmit()} />
          </InputWrap>
        </div>

        <button onClick={onSubmit} disabled={loading || isBlocked}
          className="btn-solid w-full py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Aguarde...'
            : isBlocked
              ? (block.permanent
                  ? '// BLOQUEADO'
                  : <>// BLOQUEADO (<LiveCountdown until={new Date(block.blocked_until).getTime()} onExpire={() => setBlock(null)} />)</>)
              : '// ENTRAR'}
        </button>

        <button type="button" onClick={onForgot}
          className="w-full text-center text-xs text-gray-600 hover:text-gray-400 font-mono transition-colors">
          Esqueci minha senha
        </button>
      </div>
    </>
  );
}
