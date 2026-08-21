import { Check, ShieldAlert, ArrowRight } from 'lucide-react';
import { roleLabel } from '../../../lib/roleLabels';
import CandidateHeader from './CandidateHeader';
import DecisionButton from './DecisionButton';

/** Solicitação de rebaixamento aguardando decisão. */
export default function DemotionCard({ request: req, onDecide }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <CandidateHeader profile={req.target} extra={
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-400/15 text-red-300 shrink-0">
            {roleLabel(req.previous_role)} <ArrowRight size={11} className="inline align-[-1px]" /> {roleLabel(req.proposed_role)}
          </span>
        } />
        <span className="text-xs font-mono text-gray-600 ml-auto shrink-0">
          solicitado por @{req.requester?.username}
        </span>
      </div>
      <p className="text-xs font-mono text-gray-400 leading-relaxed">{req.reason}</p>
      <div className="flex flex-wrap gap-2">
        <DecisionButton icon={ShieldAlert} accent="red" onClick={() => onDecide(req, 'approve')}>
          Aprovar rebaixamento
        </DecisionButton>
        <DecisionButton icon={Check} accent="green" onClick={() => onDecide(req, 'reject')}>
          Rejeitar
        </DecisionButton>
      </div>
    </div>
  );
}
