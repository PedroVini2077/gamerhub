import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import Avatar from './Avatar';

const BAN_REASONS = [
  'Spam / flood',
  'Discurso de ódio',
  'Comportamento abusivo',
  'Conteúdo impróprio',
  'Trapaça / exploits',
  'Outro',
];

export default function BanModal({ target, onClose, onBanned }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleBan() {
    if (!reason) return;
    setLoading(true);
    const { error } = await supabase.rpc('ban_user', {
      p_user_id: target.id,
      p_reason: reason,
      p_details: details.trim() || null,
    });
    setLoading(false);
    if (error) { toast.error('Sem permissão ou erro ao banir'); return; }
    toast.success(`@${target.username} banido`);
    onBanned?.();
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-red-500/30 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 0 40px #ef444420' }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban size={14} className="text-red-400" />
            <h3 className="font-display text-sm text-red-400 uppercase tracking-wider">Banir Usuário</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-3 bg-dark-700 rounded-lg p-3 border border-dark-500">
          <Avatar profile={target} size={36} />
          <div>
            <p className="text-sm font-mono text-white font-bold">@{target.username}</p>
            <p className="text-xs text-gray-500 font-mono">{target.role}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Motivo *</p>
          <div className="flex flex-wrap gap-2">
            {BAN_REASONS.map(r => (
              <button key={r} onClick={() => setReason(r)}
                className={`text-xs font-mono px-3 py-1.5 rounded border transition-all ${
                  reason === r
                    ? 'bg-red-500/20 border-red-500/60 text-red-300'
                    : 'border-dark-400 text-gray-400 hover:border-dark-300 hover:text-gray-300'
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="input-gamer resize-none w-full text-xs"
          rows={2}
          placeholder="Detalhes adicionais (opcional)..."
          value={details}
          onChange={e => setDetails(e.target.value)}
          maxLength={300}
        />

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <button onClick={handleBan} disabled={!reason || loading}
            className="flex-1 py-2 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: '#ef444415', color: '#f87171', border: '1px solid #ef444440' }}>
            {loading ? <span className="animate-pulse">...</span> : <><Ban size={12} />Confirmar Ban</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
