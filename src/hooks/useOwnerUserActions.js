import { useState } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, ShieldAlert, Siren } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { nominateForRole, requestRoleDemotion } from '../services/roleNominationService';
import { roleLabel } from '../lib/roleLabels';

/**
 * Ações do fundador sobre um usuário: indicar, rebaixar, banir e override.
 *
 * Toda ação passa por um modal de confirmação — nenhuma delas é reversível
 * sozinha e todas ficam nos logs de auditoria. `refetch` só roda no sucesso.
 */
export function useOwnerUserActions(refetch) {
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState(null);

  // As RPCs de banimento e override devolvem { error } em vez de lançar.
  async function runRpc(name, params, successMsg) {
    const { error } = await supabase.rpc(name, params);
    setConfirm(null);
    if (error) { toast.error(error.message); return; }
    toast.success(successMsg);
    refetch();
  }

  function handleNominate(user, targetRole) {
    setConfirm({
      title: `Indicar para ${roleLabel(targetRole)}`,
      message: `Indicar "${user.username}" para o cargo de ${roleLabel(targetRole)}? A candidatura passa por análise da equipe e, se aprovada, inicia um período de avaliação.`,
      accent: 'purple',
      confirmLabel: 'Indicar',
      icon: UserPlus,
      onConfirm: async () => {
        try {
          await nominateForRole(user.id, targetRole);
          setConfirm(null);
          toast.success(`Indicação de ${user.username} enviada para análise.`);
        } catch (e) { toast.error(e.message); setConfirm(null); }
      },
    });
  }

  function handleDemote(user) {
    setReason({
      title: 'Solicitar Rebaixamento',
      icon: ShieldAlert,
      accent: 'red',
      target: user,
      subtitle: `"${user.username}" passaria de ${roleLabel(user.role)} para Usuário. A solicitação é enviada para análise — só vira realidade após aprovação do fundador ou de um super admin, com motivo registrado.`,
      label: 'Motivo do rebaixamento',
      placeholder: 'Descreva o que motivou essa solicitação (mínimo 10 caracteres)...',
      required: true,
      confirmLabel: 'Enviar solicitação',
      confirmIcon: ShieldAlert,
      onConfirm: async (notes) => {
        try {
          await requestRoleDemotion(user.id, 'user', notes);
          setReason(null);
          toast.success(`Solicitação de rebaixamento de ${user.username} enviada para análise.`);
        } catch (e) { toast.error(e.message); }
      },
    });
  }

  function handleOverride(user, newRole) {
    setConfirm({
      title: 'Override de Emergência',
      message: `Definir o cargo de "${user.username}" diretamente para ${roleLabel(newRole)}? Isso IGNORA todo o processo de indicação e avaliação — use apenas em situações excepcionais (bugs, comportamento inesperado do sistema, etc). A ação fica registrada nos logs de auditoria.`,
      accent: 'red',
      confirmLabel: 'Definir cargo',
      icon: Siren,
      onConfirm: () => runRpc(
        'owner_set_role',
        { p_target_user_id: user.id, p_new_role: newRole },
        `Cargo de ${user.username} definido para ${roleLabel(newRole)}.`,
      ),
    });
  }

  function handleBan(user) {
    if (user.banned) {
      setConfirm({
        title: 'Desbanir Usuário',
        message: `Desbanir "${user.username}"?`,
        accent: 'green',
        confirmLabel: 'Desbanir',
        onConfirm: () => runRpc('unban_user', { p_user_id: user.id }, `${user.username} desbanido!`),
      });
    } else {
      setConfirm({
        title: 'Banir Usuário',
        message: `Banir "${user.username}"? O conteúdo deste usuário será removido.`,
        accent: 'red',
        confirmLabel: 'Banir',
        onConfirm: () => runRpc(
          'ban_user',
          { p_user_id: user.id, p_reason: 'Banido pelo fundador', p_details: null },
          `${user.username} banido!`,
        ),
      });
    }
  }

  return {
    confirm, closeConfirm: () => setConfirm(null),
    reason, closeReason: () => setReason(null),
    handleNominate, handleDemote, handleBan, handleOverride,
  };
}
