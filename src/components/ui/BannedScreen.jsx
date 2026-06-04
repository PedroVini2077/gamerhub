import { useEffect, useRef, useState } from 'react';
import { ShieldOff, LogOut } from 'lucide-react';

export default function BannedScreen({ reason, details, onSignOut }) {
  const [countdown, setCountdown] = useState(6);
  const firedRef = useRef(false);

  function doSignOut() {
    if (firedRef.current) return;
    firedRef.current = true;
    onSignOut();
  }

  useEffect(() => {
    if (countdown <= 0) { doSignOut(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{ background: 'rgba(6,6,8,0.97)' }}
    >
      {/* glow de fundo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full bg-red-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm space-y-5 animate-fade-up">
        {/* Ícone */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <ShieldOff size={28} className="text-red-400" />
          </div>
        </div>

        {/* Título */}
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-red-400 uppercase tracking-widest">
            Conta Banida
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Sua conta foi suspensa pelo time de moderação.
          </p>
        </div>

        {/* Motivo */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1.5">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Motivo</p>
          <p className="text-sm font-mono text-red-300 font-bold">{reason}</p>
          {details && (
            <p className="text-xs font-mono text-gray-400 leading-relaxed">{details}</p>
          )}
        </div>

        {/* Countdown */}
        <div className="text-center space-y-3">
          <p className="text-xs font-mono text-gray-500">
            Fazendo logout em{' '}
            <span translate="no" className="notranslate text-red-400 font-bold tabular-nums">
              {countdown}s
            </span>
            ...
          </p>
          <button
            onClick={doSignOut}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-mono font-bold rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={13} /> Sair agora
          </button>
        </div>
      </div>
    </div>
  );
}
