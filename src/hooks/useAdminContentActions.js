import { Key, RotateCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';

/**
 * Ações destrutivas sobre posts e keys, todas atrás de um ConfirmModal.
 *
 * `setConfirmModal` vem de fora porque o mesmo modal é compartilhado com as
 * ações de live e de staff — dois modais empilháveis seriam pior.
 */
export function useAdminContentActions({ setConfirmModal, username, posts, refresh }) {
  const actor = `@${username}`;

  // Fecha o modal e recarrega só depois do sucesso: se a RLS recusar, a lista
  // não pode se mexer como se tivesse dado certo.
  const done = async (msg, action, details, severity = 'warning') => {
    toast.success(msg);
    await logAudit(action, details, { category: 'admin', severity });
    setConfirmModal(null);
    refresh();
  };

  function handleDeletePosts(userId, targetUsername) {
    setConfirmModal({
      title: 'Deletar Todos os Posts', icon: Trash2, accent: 'red',
      message: `Deletar todos os posts de @${targetUsername}? Esta ação é irreversível.`,
      confirmLabel: 'Deletar Tudo', confirmIcon: Trash2,
      onConfirm: async () => {
        const { error, count } = await supabase
          .from('posts').delete({ count: 'exact' }).eq('user_id', userId);
        if (error) { toast.error('Erro ao deletar posts'); return; }
        // count 0 sem erro = RLS bloqueou (sem hierarquia) ou não havia posts.
        if (!count) { toast.error('Nenhum post deletado (sem permissão ou nada a apagar)'); return; }
        await done(
          `${count} post${count > 1 ? 's' : ''} deletado${count > 1 ? 's' : ''}`,
          'admin_delete_posts',
          `Todos os posts de @${targetUsername} deletados por ${actor}`,
        );
      },
    });
  }

  function handleDeletePost(postId) {
    setConfirmModal({
      title: 'Excluir Post', icon: Trash2, accent: 'red',
      message: 'Excluir este post? O post ficará oculto mas pode ser restaurado pelo admin.',
      confirmLabel: 'Excluir', confirmIcon: Trash2,
      onConfirm: async () => {
        const { error } = await supabase.rpc('soft_delete_post', { p_post_id: postId });
        if (error) { toast.error('Erro ao excluir post: ' + error.message); return; }
        await done('Post excluído', 'admin_delete_post', `Post excluído (soft) pelo admin ${actor}`);
      },
    });
  }

  function handleRestorePost(postId) {
    setConfirmModal({
      title: 'Restaurar Post', icon: RotateCcw, accent: 'green',
      message: 'Restaurar este post? Ele voltará a aparecer no feed.',
      confirmLabel: 'Restaurar', confirmIcon: RotateCcw,
      onConfirm: async () => {
        const { error } = await supabase.rpc('restore_post', { p_post_id: postId });
        if (error) { toast.error('Erro ao restaurar post: ' + error.message); return; }
        await done('Post restaurado', 'admin_restore_post', `Post restaurado pelo admin ${actor}`, 'info');
      },
    });
  }

  function handlePermanentDeletePost(postId, title) {
    setConfirmModal({
      title: 'Apagar Permanentemente', icon: Trash2, accent: 'red',
      message: `Apagar o post "${title}" de forma permanente? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Apagar para sempre', confirmIcon: Trash2,
      onConfirm: async () => {
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) { toast.error('Erro ao apagar: ' + error.message); return; }
        await done(
          'Post apagado permanentemente', 'admin_permanent_delete_post',
          `Post "${title}" apagado permanentemente pelo admin ${actor}`,
        );
      },
    });
  }

  function handlePermanentDeleteAllDeleted() {
    const count = posts.filter(p => p.deleted_at).length;
    setConfirmModal({
      title: 'Apagar Todos os Excluídos', icon: Trash2, accent: 'red',
      message: `Apagar permanentemente ${count} post(s) na lixeira? Esta ação não pode ser desfeita.`,
      confirmLabel: `Apagar ${count} post(s)`, confirmIcon: Trash2,
      onConfirm: async () => {
        const { error } = await supabase.from('posts').delete().not('deleted_at', 'is', null);
        if (error) { toast.error('Erro ao apagar: ' + error.message); return; }
        await done(
          `${count} post(s) apagados permanentemente`, 'admin_permanent_delete_all',
          `${count} posts da lixeira apagados permanentemente pelo admin ${actor}`,
        );
      },
    });
  }

  function handleDeleteKey(keyId) {
    setConfirmModal({
      title: 'Remover Key / Promo', icon: Key, accent: 'red',
      message: 'Remover este item permanentemente?',
      confirmLabel: 'Remover', confirmIcon: Trash2,
      onConfirm: async () => {
        const { error } = await supabase.from('game_keys').delete().eq('id', keyId);
        if (error) { toast.error('Erro ao remover item'); return; }
        await done('Removido', 'admin_delete_key', `Key removida pelo admin ${actor}`, 'info');
      },
    });
  }

  return {
    handleDeletePosts, handleDeletePost, handleRestorePost,
    handlePermanentDeletePost, handlePermanentDeleteAllDeleted, handleDeleteKey,
  };
}
