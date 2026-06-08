import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import { deleteMuralPost } from '../../services/communityService';
import { logAudit } from '../../lib/auditLog';
import { timeAgo } from '../../lib/date';
import toast from 'react-hot-toast';
import AvatarPopup from '../ui/AvatarPopup';
import ConfirmModal from '../ui/ConfirmModal';

export default function MuralCard({ item, onDelete }) {
  const { user, profile } = useAuth();
  const { isAdmin } = useRole();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canDelete = user && (isAdmin || user.id === item.user_id);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await deleteMuralPost(item.id, user.id, isAdmin);
    if (error) {
      toast.error('Erro ao deletar');
      setDeleting(false);
      return;
    }
    toast.success('Mensagem deletada');
    logAudit('mural_delete', `@${profile?.username} deletou uma mensagem de @${item.profiles?.username} no mural`, { category: 'content' });
    setConfirming(false);
    setDeleting(false);
    onDelete?.();
  }

  return (
    <div className="card p-4 animate-fade-up border-transparent hover:border-neon-purple/25 transition-colors">
      <div className="flex items-start gap-3">
        <AvatarPopup profile={item.profiles} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/u/${item.profiles?.username}`}
              className="text-sm font-semibold text-white hover:text-neon-purple transition-colors truncate"
            >
              {item.profiles?.username || 'Gamer'}
            </Link>
            <span className="text-xs text-gray-600 font-mono shrink-0">{timeAgo(item.created_at)}</span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed break-words whitespace-pre-wrap">{item.message}</p>
        </div>
        {canDelete && (
          <button
            onClick={() => setConfirming(true)}
            aria-label="Deletar mensagem"
            className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {confirming && (
        <ConfirmModal
          title="Deletar mensagem"
          icon={Trash2}
          accent="red"
          message="Tem certeza que quer deletar esta mensagem do mural? Essa ação não pode ser desfeita."
          confirmLabel={deleting ? 'Deletando...' : 'Deletar'}
          confirmIcon={Trash2}
          onConfirm={handleDelete}
          onClose={() => !deleting && setConfirming(false)}
        />
      )}
    </div>
  );
}
