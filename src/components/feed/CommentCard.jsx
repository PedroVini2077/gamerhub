import { useState } from 'react';
import { Trash2, Heart, Reply } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import { useCommentLike } from '../../hooks/useCommentLike';
import { deleteComment } from '../../services/postService';
import { logAudit } from '../../lib/auditLog';
import { canDeleteContent } from '../../lib/roles';
import toast from 'react-hot-toast';
import AvatarPopup from '../ui/AvatarPopup';
import CommentComposer from './CommentComposer';
import ConfirmModal from '../ui/ConfirmModal';

export default function CommentCard({ comment, replies = [], onDelete, onReply, isReply = false }) {
  const { user, profile } = useAuth();
  const { isAdmin, role } = useRole();
  const { liked, count, loading, toggle } = useCommentLike(comment.id);
  const [replying, setReplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canDelete = canDeleteContent(user?.id, role, comment.user_id, comment.profiles?.role);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await deleteComment(comment.id, user.id, isAdmin);
    if (error) {
      toast.error(error.message || 'Erro ao deletar');
      setDeleting(false);
      return;
    }
    logAudit('comment_deleted', `@${profile?.username} deletou um comentário de @${comment.profiles?.username}`, { category: 'content' });
    setConfirming(false);
    setDeleting(false);
    onDelete?.();
  }

  async function submitReply(text) {
    const ok = await onReply?.(comment.id, text);
    if (ok) setReplying(false);
    return ok;
  }

  return (
    <div className={`py-2.5 border-b border-dark-600 last:border-0 ${isReply ? 'pl-6' : ''}`}>
      <div className="flex items-start gap-2.5">
        <AvatarPopup profile={comment.profiles} size={isReply ? 24 : 28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-white">
              {comment.profiles?.username || 'Gamer'}
            </span>
            <span className="text-xs text-gray-600 font-mono">
              {new Date(comment.created_at).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed break-words">{comment.content}</p>
          <div className="flex items-center gap-4 mt-1.5">
            <button
              onClick={toggle}
              disabled={loading}
              className={`flex items-center gap-1 text-xs font-mono transition-colors ${
                liked ? 'text-red-400' : 'text-gray-600 hover:text-red-400'
              }`}
            >
              <Heart size={12} fill={liked ? 'currentColor' : 'none'} />
              {count > 0 && count}
            </button>
            {user && onReply && (
              <button
                onClick={() => setReplying(r => !r)}
                className="flex items-center gap-1 text-xs font-mono text-gray-600 hover:text-neon-green transition-colors"
              >
                <Reply size={12} /> Responder
              </button>
            )}
          </div>
        </div>
        {canDelete && (
          <button onClick={() => setConfirming(true)} aria-label="Deletar comentário"
            className="text-gray-600 hover:text-red-400 transition-colors shrink-0 mt-0.5">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {confirming && (
        <ConfirmModal
          title="Deletar comentário"
          icon={Trash2}
          accent="red"
          message="Tem certeza que quer deletar este comentário? Essa ação não pode ser desfeita."
          confirmLabel={deleting ? 'Deletando...' : 'Deletar'}
          confirmIcon={Trash2}
          onConfirm={handleDelete}
          onClose={() => !deleting && setConfirming(false)}
        />
      )}

      {replying && (
        <div className="mt-2 pl-6 animate-fade-up">
          <CommentComposer onSubmit={submitReply} placeholder="Escreva uma resposta..." autoFocus />
        </div>
      )}

      {replies.map(r => (
        <div key={r.id} className="mt-2">
          <CommentCard comment={r} onDelete={onDelete} onReply={onReply} isReply />
        </div>
      ))}
    </div>
  );
}
