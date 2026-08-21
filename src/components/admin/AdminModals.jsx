import { Shield, XCircle, Siren, Send } from 'lucide-react';
import BanModal from '../ui/BanModal';
import ReasonModal from '../ui/ReasonModal';
import ConfirmModal from '../ui/ConfirmModal';
import UnbanRequestModal from './UnbanRequestModal';
import ReactivationModal from './ReactivationModal';
import UnlockLoginModal from './UnlockLoginModal';

/**
 * Pilha de modais do painel admin.
 *
 * Fica num componente só porque são oito diálogos mutuamente exclusivos: no
 * `Admin.jsx` eles ocupavam 80 linhas antes de qualquer conteúdo aparecer,
 * empurrando a página de verdade pra fora da tela de quem lê o arquivo.
 */
export default function AdminModals({ modals, actions, isSuperAdmin }) {
  const {
    reactivateModal, banModal, unbanReqModal, unbanDirectModal,
    denyUnbanModal, confirmModal, demoteModal, alertOwnerModal, unlockModal,
  } = modals;

  const {
    setReactivateModal, setBanModal, setUnbanReqModal, setUnbanDirectModal,
    setDenyUnbanModal, setConfirmModal, setDemoteModal, setAlertOwnerModal,
    setUnlockModal, refresh,
    handleReactivateDirect, handleSubmitRequest, confirmUnbanDirect,
    confirmDenyUnban, handleAlertOwner, confirmUnlock,
  } = actions;

  return (
    <>
      {reactivateModal && (
        <ReactivationModal live={reactivateModal} isSuperAdmin={isSuperAdmin}
          onSubmit={isSuperAdmin ? handleReactivateDirect : handleSubmitRequest}
          onClose={() => setReactivateModal(null)} />
      )}

      {banModal && (
        <BanModal target={banModal} onClose={() => setBanModal(null)} onBanned={refresh} />
      )}

      {unbanReqModal && (
        <UnbanRequestModal target={unbanReqModal} onClose={() => setUnbanReqModal(null)} onSent={refresh} />
      )}

      {unbanDirectModal && (
        <ReasonModal title="Desbanir Usuário" icon={Shield} accent="green"
          target={unbanDirectModal}
          subtitle="O usuário voltará a ter acesso ao site. Registre o motivo do desbanimento."
          label="Motivo do desbanimento" placeholder="Por que está desbanindo?"
          confirmLabel="Desbanir" confirmIcon={Shield}
          onConfirm={confirmUnbanDirect} onClose={() => setUnbanDirectModal(null)} />
      )}

      {denyUnbanModal && (
        <ReasonModal title="Negar Solicitação" icon={XCircle} accent="red"
          subtitle={`Negar o desbanimento de @${denyUnbanModal.target_username} solicitado por @${denyUnbanModal.requesting_admin_username}.`}
          label="Nota para o admin" placeholder="Por que está negando? (visível nos logs)"
          confirmLabel="Negar" confirmIcon={XCircle}
          onConfirm={confirmDenyUnban} onClose={() => setDenyUnbanModal(null)} />
      )}

      {confirmModal && <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />}

      {demoteModal && <ReasonModal {...demoteModal} onClose={() => setDemoteModal(null)} />}

      {alertOwnerModal && (
        <ReasonModal title="Alertar o Fundador" icon={Siren} accent="red"
          subtitle="Use isso pra avisar o fundador sobre instabilidades no site ou problemas no painel administrativo. A mensagem chega como notificação direta, com seu nome e cargo."
          label="Descreva o problema" placeholder="O que está acontecendo? (mínimo 10 caracteres)"
          required confirmLabel="Enviar alerta" confirmIcon={Send}
          onConfirm={handleAlertOwner} onClose={() => setAlertOwnerModal(false)} />
      )}

      {unlockModal && (
        <UnlockLoginModal target={unlockModal} onConfirm={confirmUnlock}
          onClose={() => setUnlockModal(null)} />
      )}
    </>
  );
}
