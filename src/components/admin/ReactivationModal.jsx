import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, CheckCircle } from 'lucide-react';

const REACTIVATE_REASONS = [
  'Encerrada por engano', 'Problema técnico', 'Live continuou', 'Pedido do criador', 'Outro',
];

// Reativar uma live encerrada. Super admin reativa direto; admin comum só
// consegue ABRIR uma solicitação — daí o mesmo modal mudar de título e de
// botão conforme o cargo de quem abriu.
export default function ReactivationModal({ live, isSuperAdmin, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason) return;
    setSubmitting(true);
    await onSubmit(live, reason, details);
    setSubmitting(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-dark-400 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()} style={{ boxShadow: '0 0 40px #39ff1415' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-neon-green" />
            <h3 className="font-display text-sm text-neon-green uppercase tracking-wider">
              {isSuperAdmin ? 'Reativar Live' : 'Solicitar Reativação'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={15} /></button>
        </div>
        <div className="bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
          <p className="text-xs font-mono text-white font-bold">{live.title}</p>
          <p className="text-xs font-mono text-gray-500">por {live.profiles?.username}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-mono mb-2 uppercase tracking-wider">Motivo:</p>
          <div className="space-y-1.5">
            {REACTIVATE_REASONS.map(r => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={`w-full text-left text-xs font-mono px-3 py-2 rounded border transition-all ${
                  reason === r
                    ? 'bg-neon-green/10 border-neon-green/40 text-neon-green'
                    : 'border-dark-500 text-gray-400 hover:border-dark-300 hover:text-gray-300'
                }`}>
                <span className={`w-2 h-2 rounded-full mr-2 border inline-block shrink-0 ${reason === r ? 'bg-neon-green border-neon-green' : 'border-gray-500'}`} />
                {r}
              </button>
            ))}
          </div>
        </div>
        <textarea className="input-gamer resize-none w-full text-xs" rows={2}
          placeholder="Detalhes adicionais (opcional)..."
          value={details} onChange={e => setDetails(e.target.value)} maxLength={300} />
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={!reason || submitting}
            className="btn-solid flex-1 py-2 text-xs disabled:opacity-40 flex items-center justify-center gap-1.5">
            {submitting
              ? <span className="animate-pulse font-mono">...</span>
              : isSuperAdmin ? <><RotateCcw size={12} /> Reativar Agora</> : <><CheckCircle size={12} /> Enviar Solicitação</>
            }
          </button>
          <button onClick={onClose} className="btn-neon py-2 px-4 text-xs">Cancelar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
