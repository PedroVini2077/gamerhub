import { motion } from 'framer-motion';
import { Check, X, ChevronDown, ArrowRight } from 'lucide-react';
import { listItem } from '../../../lib/motion';
import { roleLabel } from '../../../lib/roleLabels';
import CandidateHeader from './CandidateHeader';
import EligibilityChecklist from './EligibilityChecklist';
import DecisionButton from './DecisionButton';

/** Indicação aguardando análise — recolhida por padrão, expande os critérios. */
export default function NominationCard({ nomination: nom, isOpen, onToggle, onDecide }) {
  const nominatedBy = nom.nominator ? `indicado por @${nom.nominator.username}` : 'auto-indicação';

  return (
    <motion.div variants={listItem} className="card p-0 overflow-hidden">
      <button type="button" onClick={onToggle} aria-expanded={isOpen}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/40 transition-colors text-left">
        <CandidateHeader profile={nom.candidate} extra={
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-400/15 text-purple-300 shrink-0">
            <ArrowRight size={11} className="inline align-[-1px]" /> {roleLabel(nom.target_role)}
          </span>
        } />
        <span className="text-xs font-mono text-gray-600 ml-auto shrink-0 hidden sm:inline">
          {nominatedBy}
        </span>
        <ChevronDown size={14} className={`text-gray-600 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-dark-600 space-y-3">
          {/* Em telas estreitas o "indicado por" do cabeçalho fica escondido. */}
          <p className="text-xs font-mono text-gray-600 sm:hidden">
            {nominatedBy.charAt(0).toUpperCase() + nominatedBy.slice(1)}
          </p>
          <EligibilityChecklist snapshot={nom.eligibility_snapshot} />
          <div className="flex flex-wrap gap-2">
            <DecisionButton icon={Check} accent="green" onClick={() => onDecide(nom, 'approve')}>
              Aprovar e iniciar avaliação
            </DecisionButton>
            <DecisionButton icon={X} accent="red" onClick={() => onDecide(nom, 'reject')}>
              Rejeitar
            </DecisionButton>
          </div>
        </div>
      )}
    </motion.div>
  );
}
