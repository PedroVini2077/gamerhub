import { useEffect, useState } from 'react';
import { LockOpen } from 'lucide-react';

// Botão de confirmação com espera forçada de 10s.
//
// Desbloquear um login travado por excesso de tentativas pode estar liberando
// um invasor — a contagem existe pra obrigar o admin a ler o aviso antes de
// clicar, em vez de confirmar no automático.
export default function UnlockCountdownBtn({ onConfirm }) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <button
      onClick={countdown > 0 ? undefined : onConfirm}
      disabled={countdown > 0}
      className="flex-1 py-2 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-1.5"
      style={countdown > 0
        ? { background: '#111', color: '#555', border: '1px solid #333', cursor: 'not-allowed' }
        : { background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e40' }}>
      {countdown > 0 ? `Aguarde ${countdown}s...` : <><LockOpen size={12} />Confirmar Desbloqueio</>}
    </button>
  );
}
