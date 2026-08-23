import { ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { nominateForRole, requestRoleDemotion, notifyOwner } from '../services/roleNominationService';
import { liftSuspension } from '../services/moderationService';
import { roleLabel } from '../lib/roleLabels';

/** Ações do admin sobre pessoas: indicar, rebaixar, desbanir e alertar o dono. */
export function useAdminStaffActions({
  setConfirmModal, setDemoteModal, setUnbanDirectModal, setDenyUnbanModal,
  setAlertOwnerModal, unbanDirectModal, denyUnbanModal,
  refresh, fetchUnbanRequests,
}) {
  function handleNominate(targetUser, targetRole) {
    setConfirmModal({
      title: `Indicar para ${roleLabel(targetRole)}`,
      message: `Indicar "${targetUser.username}" para o cargo de ${roleLabel(targetRole)}? A candidatura passa por análise da equipe e, se aprovada, inicia um período de avaliação.`,
      accent: 'purple', confirmLabel: 'Indicar', icon: UserPlus,
      onConfirm: async () => {
        const { error } = await nominateForRole(targetUser.id, targetRole);
        setConfirmModal(null);
        if (error) { toast.error(error.message); return; }
        toast.success(`Indicação de ${targetUser.username} enviada para análise.`);
      },
    });
  }

  function handleDemote(targetUser) {
    setDemoteModal({
      title: 'Solicitar Rebaixamento',
      icon: ShieldAlert,
      accent: 'red',
      target: targetUser,
      subtitle: `"${targetUser.username}" passaria de ${roleLabel(targetUser.role)} para Usuário. A solicitação é enviada para análise — só vira realidade após aprovação do fundador ou de um super admin, com motivo registrado.`,
      label: 'Motivo do rebaixamento',
      placeholder: 'Descreva o que motivou essa solicitação (mínimo 10 caracteres)...',
      required: true,
      confirmLabel: 'Enviar solicitação',
      confirmIcon: ShieldAlert,
      onConfirm: async (notes) => {
        const { error } = await requestRoleDemotion(targetUser.id, 'user', notes);
        if (error) { toast.error(error.message); return; }
        setDemoteModal(null);
        toast.success(`Solicitação de rebaixamento de ${targetUser.username} enviada para análise.`);
      },
    });
  }

  async function confirmUnbanDirect(note) {
    const targetUser = unbanDirectModal;
    if (!targetUser) return;
    const { error } = await supabase.rpc('unban_user', { p_user_id: targetUser.id, p_note: note || null });
    if (error) { toast.error('Erro ao desbanir'); return; }
    toast.success(`@${targetUser.username} desbanido`);
    setUnbanDirectModal(null);
    refresh();
  }

  async function handleApproveUnban(req) {
    const { error } = await supabase.rpc('approve_unban_request', { p_request_id: req.id });
    if (error) { toast.error('Erro ao aprovar'); return; }
    toast.success(`@${req.target_username} desbanido!`);
    fetchUnbanRequests();
    refresh();
  }

  async function confirmDenyUnban(note) {
    const req = denyUnbanModal;
    if (!req) return;
    const { error } = await supabase.rpc('deny_unban_request', { p_request_id: req.id, p_note: note || null });
    if (error) { toast.error('Erro ao negar'); return; }
    toast.success('Solicitação negada');
    setDenyUnbanModal(null);
    fetchUnbanRequests();
  }

  function handleLiftSuspension(targetUser) {
    setConfirmModal({
      title: 'Remover suspensão',
      message: `"${targetUser.username}" volta a poder publicar imediatamente. A pessoa é notificada e a ação fica registrada na trilha de auditoria.`,
      accent: 'green', confirmLabel: 'Remover suspensão', icon: ShieldCheck,
      onConfirm: async () => {
        const { error } = await liftSuspension(targetUser.id);
        setConfirmModal(null);
        if (error) { toast.error(error.message || 'Não foi possível remover a suspensão.'); return; }
        toast.success(`Suspensão de @${targetUser.username} removida.`);
        refresh();
      },
    });
  }

  async function handleAlertOwner(message) {
    const { error } = await notifyOwner(message);
    if (error) { toast.error(error.message); return; }
    setAlertOwnerModal(false);
    toast.success('Alerta enviado ao fundador.');
  }

  return {
    handleNominate, handleDemote, confirmUnbanDirect,
    handleApproveUnban, confirmDenyUnban, handleAlertOwner,
    handleLiftSuspension,
  };
}
