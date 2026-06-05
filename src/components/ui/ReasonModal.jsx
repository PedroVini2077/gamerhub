import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Modal genérico para uma ação que pede um motivo/nota (opcional ou obrigatório).
 * Substitui window.prompt mantendo o estilo do site.
 *
 * Props:
 *  - title, icon (componente lucide), accent ('green' | 'red' | 'yellow')
 *  - subtitle (texto explicativo, opcional)
 *  - target (perfil para mostrar avatar/username, opcional)
 *  - label, placeholder
 *  - required (bool) — se true, o botão fica desabilitado sem texto
 *  - confirmLabel, confirmIcon
 *  - onConfirm(note) — note é string ('' se vazio)
 *  - onClose
 */
const ACCENTS = {
  green:  { border: 'border-neon-green/30', glow: '#22c55e15', text: 'text-neon-green',  btnBg: '#22c55e15', btnColor: '#22c55e', btnBorder: '#22c55e40' },
  red:    { border: 'border-red-500/30',    glow: '#ef444415', text: 'text-red-400',     btnBg: '#ef444415', btnColor: '#f87171', btnBorder: '#ef444440' },
  yellow: { border: 'border-yellow-400/30', glow: '#eab30815', text: 'text-yellow-400',  btnBg: '#eab30815', btnColor: '#fbbf24', btnBorder: '#eab30840' },
};

export default function ReasonModal({
  title, icon: Icon, accent = 'green', subtitle, target,
  label = 'Motivo', placeholder = 'Escreva aqui...', required = false,
  confirmLabel = 'Confirmar', confirmIcon: ConfirmIcon,
  onConfirm, onClose,
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const a = ACCENTS[accent] || ACCENTS.green;

  async function handleConfirm() {
    if (required && !note.trim()) return;
    setLoading(true);
    try {
      await onConfirm(note.trim());
    } finally {
      setLoading(false);
    }
  }

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

        {target && (
          <div className="flex items-center gap-3 bg-dark-700 rounded-lg p-3 border border-dark-500">
            <div className="min-w-0">
              <p className="text-sm font-mono text-white font-bold">@{target.username}</p>
              {target.ban_reason && <p className="text-xs text-red-400 font-mono truncate">{target.ban_reason}</p>}
            </div>
          </div>
        )}

        {subtitle && (
          <p className="text-xs font-mono text-gray-400 leading-relaxed">{subtitle}</p>
        )}

        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">
            {label} {required ? '*' : <span className="text-gray-600 normal-case">(opcional)</span>}
          </p>
          <textarea
            className="input-gamer resize-none w-full text-xs"
            rows={3}
            placeholder={placeholder}
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={500}
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading || (required && !note.trim())}
            className="flex-1 py-2 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: a.btnBg, color: a.btnColor, border: `1px solid ${a.btnBorder}` }}>
            {loading ? <span className="animate-pulse">...</span> : <>{ConfirmIcon && <ConfirmIcon size={12} />}{confirmLabel}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
