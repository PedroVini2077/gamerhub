import { Check, Clock, RotateCcw } from 'lucide-react';
import { roleLabel } from '../../../lib/roleLabels';
import CandidateHeader from './CandidateHeader';
import DecisionButton from './DecisionButton';

const DAY_MS = 86400000;
// A partir daqui a data de revisão vira alerta amarelo.
const WARN_DAYS = 5;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / DAY_MS);
}

/** Cargo em período de avaliação: confirmar, estender ou reverter. */
export default function TrialCard({ nomination: nom, onDecide }) {
  const remaining = daysUntil(nom.trial_review_date);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <CandidateHeader profile={nom.candidate} extra={
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-400/15 text-purple-300 shrink-0">
            {roleLabel(nom.target_role)}
          </span>
        } />
        <span className={`text-xs font-mono ml-auto ${remaining <= WARN_DAYS ? 'text-yellow-400' : 'text-gray-500'}`}>
          {remaining > 0 ? `revisão em ${remaining} dia${remaining === 1 ? '' : 's'}` : 'revisão atrasada'}
          {' · '}{new Date(nom.trial_review_date).toLocaleDateString('pt-BR')}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <DecisionButton icon={Check} accent="green" onClick={() => onDecide(nom, 'confirm')}>
          Confirmar cargo
        </DecisionButton>
        <DecisionButton icon={Clock} accent="yellow" onClick={() => onDecide(nom, 'extend')}>
          Estender +15 dias
        </DecisionButton>
        <DecisionButton icon={RotateCcw} accent="red" onClick={() => onDecide(nom, 'revert')}>
          Reverter
        </DecisionButton>
      </div>
    </div>
  );
}
