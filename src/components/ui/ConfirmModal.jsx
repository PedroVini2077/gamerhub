import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ACCENTS = {
  green:  { border: 'border-neon-green/30', glow: '#22c55e15', text: 'text-neon-green',  btnBg: '#22c55e15', btnColor: '#22c55e', btnBorder: '#22c55e40' },
  red:    { border: 'border-red-500/30',    glow: '#ef444415', text: 'text-red-400',     btnBg: '#ef444415', btnColor: '#f87171', btnBorder: '#ef444440' },
  yellow: { border: 'border-yellow-400/30', glow: '#eab30815', text: 'text-yellow-400',  btnBg: '#eab30815', btnColor: '#fbbf24', btnBorder: '#eab30840' },
};

export default function ConfirmModal({
  title, icon: Icon, accent = 'red', message,
  confirmLabel = 'Confirmar', confirmIcon: ConfirmIcon,
  onConfirm, onClose,
}) {
  const a = ACCENTS[accent] || ACCENTS.red;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}>
      <div className={`w-full max-w-sm bg-dark-800 rounded-2xl border ${a.border} p-5 space-y-4 animate-fade-up`}
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: `0 0 40px ${a.glow}` }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={14} className={a.text} />}
            <h3 className={`font-display text-sm ${a.text} uppercase tracking-wider`}>{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {message && (
          <p className="text-xs font-mono text-gray-300 leading-relaxed">{message}</p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-1.5"
            style={{ background: a.btnBg, color: a.btnColor, border: `1px solid ${a.btnBorder}` }}>
            {ConfirmIcon && <ConfirmIcon size={12} />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
