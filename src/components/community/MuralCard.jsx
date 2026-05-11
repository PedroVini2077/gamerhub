import { MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function MuralCard({ item, onDelete }) {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const canDelete = user && (isAdmin || user.id === item.user_id);

  async function handleDelete() {
    if (!confirm('Deletar esta mensagem?')) return;
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', item.id);
    if (error) toast.error('Erro ao deletar');
    else { toast.success('Mensagem deletada'); onDelete?.(); }
  }

  return (
    <div className="card p-4 animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-dark-400 border border-neon-purple/30 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs font-mono text-neon-purple">
            {item.profiles?.username?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">
              {item.profiles?.username || 'Gamer'}
            </span>
            <span className="text-xs text-gray-600 font-mono">
              {new Date(item.created_at).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed break-words">{item.message}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canDelete ? (
            <button
              onClick={handleDelete}
              className="text-gray-600 hover:text-red-400 transition-colors"
              title="Deletar mensagem"
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <MessageSquare size={14} className="text-dark-400" />
          )}
        </div>
      </div>
    </div>
  );
}
