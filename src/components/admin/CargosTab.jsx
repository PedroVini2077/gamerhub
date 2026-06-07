import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '../../lib/motion';
import { UserPlus, Clock, ShieldAlert, Check, X, RotateCcw, RefreshCw, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import ReasonModal from '../ui/ReasonModal';
import {
  fetchRoleNominations, fetchDemotionRequests,
  reviewRoleNomination, decideRoleTrial, decideRoleDemotion,
} from '../../services/roleNominationService';

const ROLE_LABEL = { owner: 'Fundador', super_admin: 'Super Admin', admin: 'Admin', user: 'Usuário' };

const CRITERIA = [
  { key: 'account_age_ok',  label: 'Conta com 60+ dias' },
  { key: 'rank_ok',         label: 'Rank Elite ou acima (1000+ XP)' },
  { key: 'ban_ok',          label: 'Sem restrição por histórico de banimento' },
  { key: 'tenure_ok',       label: 'Tempo mínimo como admin (1 ano, p/ super admin)', onlyFor: 'super_admin' },
];

function EligibilityChecklist({ snapshot }) {
  if (!snapshot) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {CRITERIA.filter(c => !c.onlyFor || c.onlyFor === snapshot.target_role).map(c => {
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
          Restrição de banimento: {snapshot.ban_reason === 'cooldown_6_meses'
            ? 'aguardando 6 meses desde o último banimento'
            : 'múltiplos banimentos no histórico — inelegível'}
        </p>
      )}
    </div>
  );
}

function CandidateHeader({ profile, extra }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Link to={`/u/${profile?.username}`} className="text-sm font-mono text-white font-bold hover:text-orange-400 transition-colors truncate">
        @{profile?.username}
      </Link>
      <span className="text-xs font-mono text-gray-600 shrink-0">{ROLE_LABEL[profile?.role] || profile?.role}</span>
      {extra}
    </div>
  );
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

export default function CargosTab() {
  const [open, setOpen]     = useState(null); // id da linha expandida
  const [modal, setModal]   = useState(null);

  const { data: nominations = [], isPending: loadingNom, refetch: refetchNom } = useQuery({
    queryKey: ['role_nominations', 'pending_trial'],
    queryFn: () => fetchRoleNominations(['pending', 'trial_active']),
  });

  const { data: demotions = [], isPending: loadingDem, refetch: refetchDem } = useQuery({
    queryKey: ['role_change_requests', 'pending'],
    queryFn: () => fetchDemotionRequests(['pending']),
  });

  const pending = nominations.filter(n => n.status === 'pending');
  const trials  = nominations.filter(n => n.status === 'trial_active');

  function refetchAll() { refetchNom(); refetchDem(); }

  function openNominationDecision(nomination, decision) {
    const isReject = decision === 'reject';
    setModal({
      title: isReject ? 'Rejeitar Indicação' : 'Aprovar Indicação',
      icon: isReject ? X : Check,
      accent: isReject ? 'red' : 'green',
      subtitle: isReject
        ? `Rejeitar a indicação de @${nomination.candidate?.username} para ${ROLE_LABEL[nomination.target_role]}?`
        : `Aprovar inicia um período de avaliação de 45 dias — @${nomination.candidate?.username} já recebe o cargo de ${ROLE_LABEL[nomination.target_role]}, mas fica "em avaliação" até a decisão final.`,
      label: 'Observações',
      required: isReject,
      confirmLabel: isReject ? 'Rejeitar' : 'Aprovar e iniciar avaliação',
      confirmIcon: isReject ? X : Check,
      onConfirm: async (notes) => {
        try {
          await reviewRoleNomination(nomination.id, decision, notes);
          toast.success(isReject ? 'Indicação rejeitada.' : 'Indicação aprovada — avaliação iniciada.');
          setModal(null);
          refetchAll();
        } catch (e) { toast.error(e.message); }
      },
    });
  }

  function openTrialDecision(nomination, decision) {
    const cfg = {
      confirm: { title: 'Confirmar Cargo', icon: Check, accent: 'green', required: false,
        subtitle: `Efetivar @${nomination.candidate?.username} como ${ROLE_LABEL[nomination.target_role]} permanentemente?`,
        confirmLabel: 'Confirmar cargo' },
      extend:  { title: 'Estender Avaliação', icon: Clock, accent: 'yellow', required: false,
        subtitle: `Estender o período de avaliação de @${nomination.candidate?.username} em mais 15 dias.`,
        confirmLabel: 'Estender +15 dias' },
      revert:  { title: 'Reverter Avaliação', icon: RotateCcw, accent: 'red', required: true,
        subtitle: `@${nomination.candidate?.username} perde o cargo de ${ROLE_LABEL[nomination.target_role]} e volta a Usuário. Explique o motivo.`,
        confirmLabel: 'Reverter cargo' },
    }[decision];

    setModal({
      ...cfg,
      label: 'Observações',
      onConfirm: async (notes) => {
        try {
          await decideRoleTrial(nomination.id, decision, notes);
          toast.success({ confirm: 'Cargo confirmado.', extend: 'Avaliação estendida.', revert: 'Avaliação revertida.' }[decision]);
          setModal(null);
          refetchAll();
        } catch (e) { toast.error(e.message); }
      },
    });
  }

  function openDemotionDecision(request, decision) {
    const isApprove = decision === 'approve';
    setModal({
      title: isApprove ? 'Aprovar Rebaixamento' : 'Rejeitar Rebaixamento',
      icon: isApprove ? ShieldAlert : X,
      accent: isApprove ? 'red' : 'green',
      subtitle: isApprove
        ? `@${request.target?.username} passa de ${ROLE_LABEL[request.previous_role]} para ${ROLE_LABEL[request.proposed_role]}. Motivo da solicitação: "${request.reason}"`
        : `Rejeitar a solicitação de rebaixamento de @${request.target?.username}?`,
      label: 'Observações',
      required: false,
      confirmLabel: isApprove ? 'Aprovar rebaixamento' : 'Rejeitar solicitação',
      confirmIcon: isApprove ? ShieldAlert : X,
      onConfirm: async (notes) => {
        try {
          await decideRoleDemotion(request.id, decision, notes);
          toast.success(isApprove ? 'Rebaixamento aprovado.' : 'Solicitação rejeitada.');
          setModal(null);
          refetchAll();
        } catch (e) { toast.error(e.message); }
      },
    });
  }

  const loading = loadingNom || loadingDem;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          Indicações, avaliações e rebaixamentos de cargo
        </p>
        <button onClick={refetchAll}
          className="p-2 bg-dark-700 border border-dark-400 rounded text-gray-500 hover:text-orange-400 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-dark-700 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Indicações pendentes */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
              <UserPlus size={12} /> Indicações pendentes ({pending.length})
            </h3>
            {pending.length === 0 ? (
              <p className="text-xs font-mono text-gray-600 px-1">Nenhuma indicação aguardando análise.</p>
            ) : (
              <motion.div variants={listContainer} initial="hidden" animate="visible" className="space-y-2">
                {pending.map(nom => {
                  const isOpen = open === nom.id;
                  return (
                    <motion.div key={nom.id} variants={listItem} className="card p-0 overflow-hidden">
                      <button onClick={() => setOpen(isOpen ? null : nom.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700/40 transition-colors text-left">
                        <CandidateHeader profile={nom.candidate} extra={
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-400/15 text-purple-300 shrink-0">
                            → {ROLE_LABEL[nom.target_role]}
                          </span>
                        } />
                        <span className="text-xs font-mono text-gray-600 ml-auto shrink-0 hidden sm:inline">
                          {nom.nominator ? `indicado por @${nom.nominator.username}` : 'auto-indicação'}
                        </span>
                        <ChevronDown size={14} className={`text-gray-600 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 border-t border-dark-600 space-y-3">
                          <p className="text-xs font-mono text-gray-600 sm:hidden">
                            {nom.nominator ? `Indicado por @${nom.nominator.username}` : 'Auto-indicação'}
                          </p>
                          <EligibilityChecklist snapshot={nom.eligibility_snapshot} />
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => openNominationDecision(nom, 'approve')}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-neon-green/30 text-neon-green rounded hover:bg-neon-green/10 transition-colors">
                              <Check size={12} /> Aprovar e iniciar avaliação
                            </button>
                            <button onClick={() => openNominationDecision(nom, 'reject')}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-red-400/30 text-red-400 rounded hover:bg-red-400/10 transition-colors">
                              <X size={12} /> Rejeitar
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </section>

          {/* Em avaliação */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
              <Clock size={12} /> Em avaliação ({trials.length})
            </h3>
            {trials.length === 0 ? (
              <p className="text-xs font-mono text-gray-600 px-1">Nenhuma avaliação em andamento.</p>
            ) : (
              <motion.div variants={listContainer} initial="hidden" animate="visible" className="space-y-2">
                {trials.map(nom => {
                  const remaining = daysUntil(nom.trial_review_date);
                  return (
                    <div key={nom.id} className="card p-4 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <CandidateHeader profile={nom.candidate} extra={
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-purple-400/15 text-purple-300 shrink-0">
                            {ROLE_LABEL[nom.target_role]}
                          </span>
                        } />
                        <span className={`text-xs font-mono ml-auto ${remaining <= 5 ? 'text-yellow-400' : 'text-gray-500'}`}>
                          {remaining > 0 ? `revisão em ${remaining} dia${remaining === 1 ? '' : 's'}` : 'revisão atrasada'}
                          {' · '}{new Date(nom.trial_review_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openTrialDecision(nom, 'confirm')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-neon-green/30 text-neon-green rounded hover:bg-neon-green/10 transition-colors">
                          <Check size={12} /> Confirmar cargo
                        </button>
                        <button onClick={() => openTrialDecision(nom, 'extend')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-yellow-400/30 text-yellow-400 rounded hover:bg-yellow-400/10 transition-colors">
                          <Clock size={12} /> Estender +15 dias
                        </button>
                        <button onClick={() => openTrialDecision(nom, 'revert')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-red-400/30 text-red-400 rounded hover:bg-red-400/10 transition-colors">
                          <RotateCcw size={12} /> Reverter
                        </button>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </section>

          {/* Solicitações de rebaixamento */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
              <ShieldAlert size={12} /> Solicitações de rebaixamento ({demotions.length})
            </h3>
            {demotions.length === 0 ? (
              <p className="text-xs font-mono text-gray-600 px-1">Nenhuma solicitação pendente.</p>
            ) : (
              <motion.div variants={listContainer} initial="hidden" animate="visible" className="space-y-2">
                {demotions.map(req => (
                  <div key={req.id} className="card p-4 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CandidateHeader profile={req.target} extra={
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-400/15 text-red-300 shrink-0">
                          {ROLE_LABEL[req.previous_role]} → {ROLE_LABEL[req.proposed_role]}
                        </span>
                      } />
                      <span className="text-xs font-mono text-gray-600 ml-auto shrink-0">
                        solicitado por @{req.requester?.username}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-gray-400 leading-relaxed">{req.reason}</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openDemotionDecision(req, 'approve')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-red-400/30 text-red-400 rounded hover:bg-red-400/10 transition-colors">
                        <ShieldAlert size={12} /> Aprovar rebaixamento
                      </button>
                      <button onClick={() => openDemotionDecision(req, 'reject')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-neon-green/30 text-neon-green rounded hover:bg-neon-green/10 transition-colors">
                        <Check size={12} /> Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </section>
        </>
      )}

      {modal && <ReasonModal {...modal} onClose={() => setModal(null)} />}
    </div>
  );
}
