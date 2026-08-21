import { Siren, ArrowRight } from 'lucide-react';
import { ROLES, roleLabel } from '../../../lib/roleLabels';

// `owner` fica de fora: o cargo de fundador não se atribui por override.
const ASSIGNABLE = ROLES.filter(r => r !== 'owner');

/** Atalho do fundador para definir cargo ignorando indicação e avaliação. */
export default function RoleOverride({ user, open, onToggle, onOverride }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex items-center gap-1.5 text-xs font-mono text-gray-700 hover:text-yellow-500 transition-colors">
        <Siren size={11} />
        {open ? 'Ocultar override de emergência' : 'Override de emergência'}
      </button>

      {open && (
        <div className="mt-2 p-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 space-y-2">
          <p className="text-xs font-mono text-yellow-500/70 leading-relaxed">
            Define o cargo na hora, ignorando indicação e avaliação. Use só em situações
            excepcionais (bugs, comportamento inesperado do sistema, etc) — fica registrado
            nos logs de auditoria como ação manual do fundador.
          </p>
          <div className="flex flex-wrap gap-2">
            {ASSIGNABLE.filter(r => r !== user.role).map(r => (
              <button key={r} type="button" onClick={() => onOverride(user, r)}
                className="px-2.5 py-1 text-xs font-mono border border-yellow-500/30 rounded text-yellow-500/80 hover:bg-yellow-500/10 transition-colors">
                <ArrowRight size={11} className="inline align-[-1px]" /> {roleLabel(r)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
