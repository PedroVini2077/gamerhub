import { Tv, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

// A RLS nega devolvendo ZERO LINHAS e nenhum erro. Checar so `error` fazia o
// painel cantar "Live encerrada" enquanto a live seguia no ar — foi exatamente
// o que o dono relatou. `count: 'exact'` transforma o silencio em resposta.
async function mudarLive(postId, isLive) {
  const { error, count } = await supabase
    .from('posts').update({ is_live: isLive }, { count: 'exact' }).eq('id', postId);
  if (error) return error;
  if (!count) return { message: 'Sem permissão para alterar esta live.' };
  return null;
}

/** Moderação de lives: encerrar, reativar, e o fluxo de solicitação/aprovação. */
export function useAdminLiveActions({
  setConfirmModal, setReactivateModal, user, username, fetchLiveMod, fetchLogs,
}) {
  const log = (action, details, severity = 'info') =>
    logAudit(action, details, { category: 'admin', severity });

  async function unsilenceUser(id) {
    await supabase.from('live_chat_timeouts').delete().eq('id', id);
    await log('admin_unsilence_chat', `Silêncio de chat removido por @${username}`);
    fetchLiveMod();
  }

  function handleEndLive(postId, title) {
    setConfirmModal({
      title: 'Encerrar Live', icon: Tv, accent: 'red',
      message: `Encerrar a live "${title}"? O streamer não poderá retomá-la sem uma nova solicitação.`,
      confirmLabel: 'Encerrar', confirmIcon: X,
      onConfirm: async () => {
        const err = await mudarLive(postId, false);
        if (err) { toast.error('Erro ao encerrar live: ' + err.message); return; }
        toast.success('Live encerrada');
        await log('live_ended', `Live "${title}" encerrada pelo admin`);
        setConfirmModal(null);
        fetchLiveMod();
      },
    });
  }

  const motivo = (reason, details) => `${reason}${details ? ` — ${details}` : ''}`;

  async function handleReactivateDirect(live, reason, details) {
    const err = await mudarLive(live.id, true);
    if (err) { toast.error('Erro ao reativar: ' + err.message); return; }
    toast.success('Live reativada!');
    await log('live_reactivated', `Live "${live.title}" reativada. Motivo: ${motivo(reason, details)}`);
    setReactivateModal(null);
    fetchLiveMod();
  }

  async function handleSubmitRequest(live, reason, details) {
    const { error } = await supabase.from('live_reactivation_requests').insert({
      post_id: live.id, post_title: live.title,
      admin_id: user.id, admin_username: username || 'Admin',
      reason, details: details || null, status: 'pending',
    });
    if (error) { toast.error('Erro ao enviar solicitação'); return; }
    toast.success('Solicitação enviada ao super admin!');
    await log('reactivation_requested',
      `Admin solicitou reativação de "${live.title}". Motivo: ${motivo(reason, details)}`);
    setReactivateModal(null);
    fetchLiveMod();
  }

  const reviewFields = () => ({
    reviewed_by: user.id,
    reviewer_username: username,
    reviewed_at: new Date().toISOString(),
  });

  async function handleApproveRequest(req) {
    const err = await mudarLive(req.post_id, true);
    if (err) { toast.error('Erro ao reativar post: ' + err.message); return; }
    await supabase.from('live_reactivation_requests')
      .update({ status: 'approved', ...reviewFields() }).eq('id', req.id);
    toast.success('Aprovado — live reativada!');
    await log('reactivation_approved',
      `Super admin aprovou reativação de "${req.post_title}" (solicitado por ${req.admin_username})`);
    fetchLiveMod();
    fetchLogs();
  }

  async function handleDenyRequest(req) {
    await supabase.from('live_reactivation_requests')
      .update({ status: 'denied', ...reviewFields() }).eq('id', req.id);
    toast.success('Solicitação negada');
    await log('reactivation_denied',
      `Super admin negou reativação de "${req.post_title}" (solicitado por ${req.admin_username})`);
    fetchLiveMod();
    fetchLogs();
  }

  return {
    unsilenceUser, handleEndLive, handleReactivateDirect,
    handleSubmitRequest, handleApproveRequest, handleDenyRequest,
  };
}
