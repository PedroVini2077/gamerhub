import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Check, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../ui/ConfirmModal';
import { checkRoleEligibility, nominateForRole } from '../../services/roleNominationService';

const CRITERIA = [
  { key: 'account_age_ok', label: 'Conta com 60+ dias' },
  { key: 'rank_ok',        label: 'Rank Elite ou acima (1000+ XP)' },
  { key: 'ban_ok',         label: 'Sem restrição por histórico de banimento' },
];

const STATUS_LABEL = {
  pending:      { label: 'Indicação em análise pela equipe', color: '#fbbf24' },
  trial_active: { label: 'Em período de avaliação como Admin', color: '#39ff14' },
};

export default function AdminApplicationCard({ userId }) {
  const [confirming, setConfirming] = useState(false);

  const { data: nomination, isPending: loadingNom, refetch: refetchNom } = useQuery({
    queryKey: ['my_role_nomination', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_nominations')
        .select('id, target_role, status, trial_review_date')
        .eq('candidate_id', userId)
        .in('status', ['pending', 'trial_active'])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: eligibility, isPending: loadingElig } = useQuery({
    queryKey: ['my_role_eligibility', userId],
    queryFn: () => checkRoleEligibility(userId, 'admin'),
    enabled: !!userId && !nomination,
  });

  async function handleApply() {
    try {
      await nominateForRole(userId, 'admin');
      toast.success('Candidatura enviada! A equipe vai analisar em breve.');
      setConfirming(false);
      refetchNom();
    } catch (e) {
      toast.error(e.message);
      setConfirming(false);
    }
  }

  if (loadingNom) return null;

  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
        <ShieldCheck size={12} />Quero ser Admin
      </h3>

      {nomination ? (
        <div className="flex items-center gap-2 bg-dark-700 rounded-lg p-3 border border-dark-400">
          <Clock size={14} className="shrink-0" style={{ color: STATUS_LABEL[nomination.status]?.color }} />
          <div className="min-w-0">
            <p className="text-xs font-mono" style={{ color: STATUS_LABEL[nomination.status]?.color }}>
              {STATUS_LABEL[nomination.status]?.label}
            </p>
            {nomination.status === 'trial_active' && nomination.trial_review_date && (
              <p className="text-xs font-mono text-gray-600">
                Revisão prevista para {new Date(nomination.trial_review_date).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        </div>
      ) : loadingElig ? (
        <div className="h-16 bg-dark-700 rounded-lg animate-pulse" />
      ) : eligibility ? (
        <div className="space-y-3">
          <p className="text-xs font-mono text-gray-500 leading-relaxed">
            Critérios pra se candidatar ao cargo de Admin. Atendendo a todos, sua candidatura
            entra em análise pela equipe — se aprovada, você passa por um período de avaliação.
          </p>
          <div className="space-y-1.5">
            {CRITERIA.map(c => {
              const ok = !!eligibility[c.key];
              return (
                <div key={c.key} className="flex items-center gap-1.5 text-xs font-mono"
                  style={{ color: ok ? '#39ff14' : '#f87171' }}>
                  {ok ? <Check size={11} className="shrink-0" /> : <X size={11} className="shrink-0" />}
                  <span className="text-gray-400">{c.label}</span>
                </div>
              );
            })}
          </div>
          {eligibility.ban_reason && (
            <p className="text-xs font-mono text-red-400/70">
              {eligibility.ban_reason === 'cooldown_6_meses'
                ? 'Histórico de banimento: aguardando 6 meses desde o último.'
                : 'Histórico de múltiplos banimentos torna a candidatura indisponível.'}
            </p>
          )}
          <button
            onClick={() => setConfirming(true)}
            disabled={!eligibility.eligible}
            className="w-full py-2.5 text-xs font-mono font-bold rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: '#39ff1415', color: '#39ff14', border: '1px solid #39ff1440' }}>
            {eligibility.eligible ? 'Candidatar-se a Admin' : 'Critérios ainda não atendidos'}
          </button>
        </div>
      ) : null}

      {confirming && (
        <ConfirmModal
          title="Candidatar-se a Admin"
          icon={ShieldCheck}
          accent="green"
          message="Sua candidatura a Admin será enviada para análise da equipe. Se aprovada, você recebe o cargo imediatamente, mas em período de avaliação — com checagens periódicas até a confirmação definitiva."
          confirmLabel="Enviar candidatura"
          confirmIcon={ShieldCheck}
          onConfirm={handleApply}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
