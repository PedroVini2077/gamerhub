import { createPortal } from 'react-dom';
import { X, ShieldAlert, AlertTriangle } from 'lucide-react';
import UnlockCountdownBtn from './UnlockCountdownBtn';

/**
 * Confirmação de desbloqueio de login. O tom é deliberadamente pesado: liberar
 * uma conta que estourou o limite de tentativas pode estar liberando um ataque,
 * por isso o botão de confirmar tem contagem regressiva.
 */
export default function UnlockLoginModal({ target, onConfirm, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-800 rounded-2xl border border-red-500/30 p-5 space-y-4 animate-fade-up"
        onClick={e => e.stopPropagation()} style={{ boxShadow: '0 0 40px #ef444425' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-red-400" />
            <h3 className="font-display text-sm text-red-400 uppercase tracking-wider">Atenção</h3>
          </div>
          <button aria-label="Fechar" onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm font-mono text-red-300 font-bold leading-relaxed flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            CUIDADO: Você está prestes a desbloquear um possível invasor.
          </p>
          <p className="text-xs font-mono text-gray-400 mt-2 leading-relaxed">
            Esta conta excedeu o limite de tentativas consecutivas. Pode ser um ataque ou alguém
            com dificuldade de acesso. Se não reconhece este email, não desbloqueie — oriente a
            redefinir a senha.
          </p>
        </div>

        <div className="bg-dark-700 rounded-lg px-3 py-2.5 border border-dark-500 space-y-1">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Email</p>
          <p className="text-sm font-mono text-white break-all">{target.email}</p>
          {target.username && <p className="text-xs text-gray-400 font-mono">@{target.username}</p>}
          <p className="text-xs text-red-400 font-mono">
            {target.attempts} tentativas de login registradas
            {target.permanent && ' · bloqueio permanente'}
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2 text-xs font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all">
            Cancelar
          </button>
          <UnlockCountdownBtn key={target.email} onConfirm={onConfirm} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
