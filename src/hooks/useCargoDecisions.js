import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, Clock, RotateCcw, ShieldAlert } from 'lucide-react';
import {
  reviewRoleNomination, decideRoleTrial, decideRoleDemotion,
} from '../services/roleNominationService';
import { roleLabel } from '../lib/roleLabels';

const TRIAL = {
  confirm: {
    title: 'Confirmar Cargo', icon: Check, accent: 'green', required: false,
    confirmLabel: 'Confirmar cargo', done: 'Cargo confirmado.',
    subtitle: n => `Efetivar @${n.candidate?.username} como ${roleLabel(n.target_role)} permanentemente?`,
  },
  extend: {
    title: 'Estender Avaliação', icon: Clock, accent: 'yellow', required: false,
    confirmLabel: 'Estender +15 dias', done: 'Avaliação estendida.',
    subtitle: n => `Estender o período de avaliação de @${n.candidate?.username} em mais 15 dias.`,
  },
  revert: {
    title: 'Reverter Avaliação', icon: RotateCcw, accent: 'red', required: true,
    confirmLabel: 'Reverter cargo', done: 'Avaliação revertida.',
    subtitle: n => `@${n.candidate?.username} perde o cargo de ${roleLabel(n.target_role)} e volta a Usuário. Explique o motivo.`,
  },
};

/**
 * Monta os modais de decisão da aba Cargos e executa a RPC escolhida.
 *
 * `refetchAll` é chamado só depois do sucesso: se a RPC recusar (o banco é quem
 * decide de fato quem pode mexer em cargo), a lista não deve se mexer.
 */
export function useCargoDecisions(refetchAll) {
  const [modal, setModal] = useState(null);

  // Fecha o modal e recarrega só quando a RPC passou; erro fica no modal aberto
  // para a pessoa ver a mensagem e decidir o que fazer.
  const run = (fn, successMsg) => async (notes) => {
    try {
      await fn(notes);
      toast.success(successMsg);
      setModal(null);
      refetchAll();
    } catch (e) {
      toast.error(e.message);
    }
  };

  function openNominationDecision(nom, decision) {
    const isReject = decision === 'reject';
    setModal({
      title: isReject ? 'Rejeitar Indicação' : 'Aprovar Indicação',
      icon: isReject ? X : Check,
      accent: isReject ? 'red' : 'green',
      subtitle: isReject
        ? `Rejeitar a indicação de @${nom.candidate?.username} para ${roleLabel(nom.target_role)}?`
        : `Aprovar inicia um período de avaliação de 45 dias — @${nom.candidate?.username} já recebe o cargo de ${roleLabel(nom.target_role)}, mas fica "em avaliação" até a decisão final.`,
      label: 'Observações',
      required: isReject,
      confirmLabel: isReject ? 'Rejeitar' : 'Aprovar e iniciar avaliação',
      confirmIcon: isReject ? X : Check,
      onConfirm: run(
        notes => reviewRoleNomination(nom.id, decision, notes),
        isReject ? 'Indicação rejeitada.' : 'Indicação aprovada — avaliação iniciada.',
      ),
    });
  }

  function openTrialDecision(nom, decision) {
    const cfg = TRIAL[decision];
    setModal({
      title: cfg.title,
      icon: cfg.icon,
      accent: cfg.accent,
      required: cfg.required,
      confirmLabel: cfg.confirmLabel,
      subtitle: cfg.subtitle(nom),
      label: 'Observações',
      onConfirm: run(notes => decideRoleTrial(nom.id, decision, notes), cfg.done),
    });
  }

  function openDemotionDecision(req, decision) {
    const isApprove = decision === 'approve';
    setModal({
      title: isApprove ? 'Aprovar Rebaixamento' : 'Rejeitar Rebaixamento',
      icon: isApprove ? ShieldAlert : X,
      accent: isApprove ? 'red' : 'green',
      subtitle: isApprove
        ? `@${req.target?.username} passa de ${roleLabel(req.previous_role)} para ${roleLabel(req.proposed_role)}. Motivo da solicitação: "${req.reason}"`
        : `Rejeitar a solicitação de rebaixamento de @${req.target?.username}?`,
      label: 'Observações',
      required: false,
      confirmLabel: isApprove ? 'Aprovar rebaixamento' : 'Rejeitar solicitação',
      confirmIcon: isApprove ? ShieldAlert : X,
      onConfirm: run(
        notes => decideRoleDemotion(req.id, decision, notes),
        isApprove ? 'Rebaixamento aprovado.' : 'Solicitação rejeitada.',
      ),
    });
  }

  return {
    modal, closeModal: () => setModal(null),
    openNominationDecision, openTrialDecision, openDemotionDecision,
  };
}
