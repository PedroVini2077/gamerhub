import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/auditLog';
import toast from 'react-hot-toast';
import AvatarPopup from '../ui/AvatarPopup';

export default function MuralCard({ item, onDelete }) {
  const { user, profile } = useAuth();
  const { isAdmin } = useRole();
  const canDelete = user && (isAdmin || user.id === item.user_id);

  async function handleDelete() {
    if (!confirm('Deletar esta mensagem?')) return;
    let q = supabase.from('community_posts').delete().eq('id', item.id);
    if (!isAdmin) q = q.eq('user_id', user.id);
    const { error } = await q;
    if (error) toast.error('Erro ao deletar');
    else {
      toast.success('Mensagem deletada');
      logAudit('mural_delete', `@${profile?.username} deletou uma mensagem de @${item.profiles?.username} no mural`, { category: 'content' });
      onDelete?.();
    }
  }

  return (
    <div className="card p-4 animate-fade-up">
      <div className="flex items-start gap-3">
        <AvatarPopup profile={item.profiles} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/u/${item.profiles?.username}`}
              className="text-sm font-semibold text-white hover:text-neon-green transition-colors"
            >
              {item.profiles?.username || 'Gamer'}
            </Link>
            <span className="text-xs text-gray-600 font-mono">
              {new Date(item.created_at).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed break-words">{item.message}</p>
        </div>
        {canDelete && (
          <button onClick={handleDelete} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
