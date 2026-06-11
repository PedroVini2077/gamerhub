import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';

const ACCENTS = {
  green:  { border: 'border-neon-green/30', glow: '#22c55e15', text: 'text-neon-green',  btnBg: '#22c55e15', btnColor: '#22c55e', btnBorder: '#22c55e40' },
  red:    { border: 'border-red-500/30',    glow: '#ef444415', text: 'text-red-400',     btnBg: '#ef444415', btnColor: '#f87171', btnBorder: '#ef444440' },
  yellow: { border: 'border-yellow-400/30', glow: '#eab30815', text: 'text-yellow-400',  btnBg: '#eab30815', btnColor: '#fbbf24', btnBorder: '#eab30840' },
  orange: { border: 'border-orange-400/30', glow: '#f9731615', text: 'text-orange-400',  btnBg: '#f9731615', btnColor: '#f97316', btnBorder: '#f9731640' },
  purple: { border: 'border-purple-500/30', glow: '#a855f715', text: 'text-purple-400',  btnBg: '#a855f715', btnColor: '#c084fc', btnBorder: '#a855f740' },
};

export default function ConfirmModal({
  title, icon: Icon, accent = 'red', message,
  confirmLabel = 'Confirmar', confirmIcon: ConfirmIcon,
  onConfirm, onClose,
}) {
  const [loading, setLoading] = useState(false);
  const a = ACCENTS[accent] || ACCENTS.red;

  async function handleConfirm() {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={loading ? undefined : onClose}>
      <div className={`w-full max-w-sm bg-dark-800 rounded-2xl border ${a.border} p-5 space-y-4 animate-fade-up`}
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: `0 0 40px ${a.glow}` }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} className={a.text} />}
            <h3 className={`font-display text-sm ${a.text} uppercase tracking-wider`}>{title}</h3>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-500 hover:text-white transition-colors disabled:opacity-40">
            <X size={15} />
          </button>
        </div>

        {message && (
          <p className="text-xs font-mono text-gray-300 leading-relaxed">{message}</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: a.btnBg, color: a.btnColor, border: `1px solid ${a.btnBorder}` }}>
            {loading
              ? <><Loader2 size={12} className="animate-spin" /> Aguarde...</>
              : <>{ConfirmIcon && <ConfirmIcon size={12} />}{confirmLabel}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
