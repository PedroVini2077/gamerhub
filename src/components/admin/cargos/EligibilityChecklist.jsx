import { Check, X } from 'lucide-react';

const CRITERIA = [
  { key: 'account_age_ok', label: 'Conta com 60+ dias' },
  { key: 'rank_ok',        label: 'Rank Elite ou acima (1000+ XP)' },
  { key: 'ban_ok',         label: 'Sem restrição por histórico de banimento' },
  { key: 'tenure_ok',      label: 'Tempo mínimo como admin (1 ano, p/ super admin)', onlyFor: 'super_admin' },
];

const BAN_REASON = {
  cooldown_6_meses: 'aguardando 6 meses desde o último banimento',
};

/** Critérios de elegibilidade congelados no momento da indicação. */
export default function EligibilityChecklist({ snapshot }) {
  if (!snapshot) return null;
  const criteria = CRITERIA.filter(c => !c.onlyFor || c.onlyFor === snapshot.target_role);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {criteria.map(c => {
        const ok = !!snapshot[c.key];
        return (
          <div key={c.key} className="flex items-center gap-1.5 text-xs font-mono"
            style={{ color: ok ? '#39ff14' : '#f87171' }}>
            {ok ? <Check size={11} className="shrink-0" /> : <X size={11} className="shrink-0" />}
            <span className="text-gray-400">{c.label}</span>
          </div>
        );
      })}
      {snapshot.ban_reason && (
        <p className="col-span-full text-xs font-mono text-red-400/70">
          Restrição de banimento: {BAN_REASON[snapshot.ban_reason]
            || 'múltiplos banimentos no histórico — inelegível'}
        </p>
      )}
    </div>
  );
}
