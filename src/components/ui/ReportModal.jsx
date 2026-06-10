import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createReport } from '../../services/moderationService';

const REASONS = [
  { value: 'spam',          label: 'Spam ou propaganda' },
  { value: 'hate',          label: 'Discurso de ódio' },
  { value: 'nsfw',          label: 'Conteúdo adulto/inapropriado' },
  { value: 'harassment',    label: 'Assédio ou bullying' },
  { value: 'misinformation',label: 'Desinformação' },
  { value: 'other',         label: 'Outro' },
];

export default function ReportModal({ contentType, contentId, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason) { toast.error('Selecione um motivo'); return; }
    setLoading(true);
    const { error } = await createReport({ contentType, contentId, reason, details });
    if (error) {
      if (error.code === '23505') toast.error('Você já denunciou este conteúdo.');
      else toast.error('Erro ao enviar denúncia.');
    } else {
      toast.success('Denúncia enviada. Nossa equipe vai revisar em breve.');
      onClose();
    }
    setLoading(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-orange-500/30 p-5 space-y-4 animate-fade-up"
        style={{ boxShadow: '0 0 40px #f9731615' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={14} className="text-orange-400" />
            <h3 className="font-display text-sm text-orange-400 uppercase tracking-wider">Denunciar</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        <p className="text-xs font-mono text-gray-400 leading-relaxed">
          Selecione o motivo da denúncia. Nossos admins revisarão o conteúdo.
        </p>

        <div className="space-y-2">
          {REASONS.map(r => (
            <label key={r.value}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                reason === r.value
                  ? 'border-orange-500/50 bg-orange-500/10'
                  : 'border-dark-500 hover:border-dark-400'
              }`}>
              <input type="radio" name="reason" value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-orange-400" />
              <span className="text-xs font-mono text-gray-300">{r.label}</span>
            </label>
          ))}
        </div>

        <textarea
          placeholder="Detalhes adicionais (opcional)..."
          value={details}
          onChange={e => setDetails(e.target.value)}
          maxLength={300}
          rows={2}
          className="input-gamer resize-none text-xs"
        />

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading || !reason}
            className="flex-1 py-2 text-xs font-mono font-bold rounded flex items-center justify-center gap-1.5 transition-all"
            style={{ background: '#f9731615', color: '#fb923c', border: '1px solid #f9731640',
              opacity: (!reason || loading) ? 0.5 : 1 }}>
            <Flag size={12} />{loading ? 'Enviando...' : 'Denunciar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
