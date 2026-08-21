import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

// Admin comum não desbane sozinho: ele PEDE, e um super admin decide.
// Este modal é o formulário desse pedido.
export default function UnbanRequestModal({ target, onClose, onSent }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!reason.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc('request_unban', { p_user_id: target.id, p_reason: reason.trim() });
    setLoading(false);
    if (error) {
      if (error.message?.includes('pending')) toast.error('Já existe uma solicitação pendente para este usuário');
      else toast.error('Erro ao enviar solicitação');
      return;
    }
    toast.success('Solicitação enviada ao super admin!');
    onSent?.();
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-yellow-400/30 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()} style={{ boxShadow: '0 0 40px #eab30815' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw size={14} className="text-yellow-400" />
            <h3 className="font-display text-sm text-yellow-400 uppercase tracking-wider">Solicitar Desbanimento</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={15} /></button>
        </div>
        <div className="flex items-center gap-3 bg-dark-700 rounded-lg p-3 border border-dark-500">
          <div className="min-w-0">
            <p className="text-sm font-mono text-white font-bold">@{target.username}</p>
            {target.ban_reason && <p className="text-xs text-red-400 font-mono">{target.ban_reason}</p>}
          </div>
        </div>
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-3">
          <p className="text-xs font-mono text-yellow-300 leading-relaxed">
            Esta solicitação será enviada ao super admin. Descreva por que o ban deve ser removido.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Justificativa *</p>
          <textarea className="input-gamer resize-none w-full text-xs" rows={3}
            placeholder="Por que este usuário deve ser desbanido?"
            value={reason} onChange={e => setReason(e.target.value)} maxLength={500} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <button onClick={handleSend} disabled={!reason.trim() || loading}
            className="flex-1 py-2 text-xs font-mono font-bold rounded transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            style={{ background: '#eab30815', color: '#fbbf24', border: '1px solid #eab30840' }}>
            {loading ? <span className="animate-pulse">...</span> : <><CheckCircle size={12} />Enviar Solicitação</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
