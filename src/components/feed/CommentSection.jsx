import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import toast from 'react-hot-toast';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import Avatar from '../ui/Avatar';

function CommentCard({ comment, onDelete }) {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const canDelete = user && (isAdmin || user.id === comment.user_id);

  async function handleDelete() {
    if (!confirm('Deletar comentário?')) return;
    const { error } = await supabase.from('comments').delete().eq('id', comment.id);
    if (error) toast.error('Erro ao deletar');
    else onDelete?.();
  }

  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-dark-600 last:border-0">
      <Avatar profile={comment.profiles} size={7} />
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
      </div>
      {canDelete && (
        <button onClick={handleDelete} className="text-gray-600 hover:text-red-400 transition-colors shrink-0 mt-0.5">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

export default function CommentSection({ postId, postOwnerId, registerRefresh }) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  async function fetchCount() {
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    setCount(count || 0);
  }

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setCount(data?.length || 0);
  }

  useEffect(() => {
    fetchCount();
    if (registerRefresh) registerRefresh(fetchComments);
  }, [postId]);

  useEffect(() => {
    if (open) fetchComments();
  }, [open]);

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: profile?.id,
      content: text.trim(),
    });
    if (error) {
      toast.error('Erro ao comentar');
    } else {
      setText('');
      fetchComments();
      if (postOwnerId && postOwnerId !== user?.id) {
        await supabase.from('notifications').insert({
          user_id: postOwnerId,
          type: 'comment',
          message: `${profile?.username || 'Alguém'} comentou no seu post`,
        });
      }
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-dark-500">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-neon-green transition-colors"
      >
        <MessageSquare size={13} />
        {count > 0 ? `${count} comentário${count !== 1 ? 's' : ''}` : 'Comentar'}
      </button>

      {open && (
        <div className="mt-3 space-y-1 animate-fade-up">
          {comments.length > 0 && (
            <div className="bg-dark-700 rounded-lg px-3 py-1 mb-3">
              {comments.map(c => (
                <CommentCard key={c.id} comment={c} onDelete={fetchComments} />
              ))}
            </div>
          )}

          {user ? (
            <div className="flex gap-2 items-end">
              <textarea
                className="input-gamer resize-none flex-1 text-sm"
                rows={2}
                placeholder="Escreva um comentário... (Enter para enviar)"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKey}
                maxLength={500}
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !text.trim()}
                className="btn-neon py-2 px-3 shrink-0 flex items-center gap-1"
              >
                <Send size={13} />
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500 font-mono">Faça login para comentar</p>
          )}
        </div>
      )}
    </div>
  );
}
