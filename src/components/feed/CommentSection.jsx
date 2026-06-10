import { useState, useEffect, useMemo, memo } from 'react';
import { fetchComments, fetchCommentCount, addComment } from '../../services/postService';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useBlockedWords } from '../../hooks/useBlockedWords';
import { logAudit } from '../../lib/auditLog';
import toast from 'react-hot-toast';
import { MessageSquare } from 'lucide-react';
import CommentCard from './CommentCard';
import CommentComposer from './CommentComposer';

const CommentSection = memo(function CommentSection({ postId, registerRefresh }) {
  const { user, profile } = useAuth();
  const { checkContent } = useBlockedWords();
  const [comments, setComments] = useState([]);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  async function fetchCount() {
    const c = await fetchCommentCount(postId);
    setCount(c);
  }

  async function fetchCommentList() {
    const data = await fetchComments(postId);
    setComments(data);
    setCount(data.length);
  }

  useEffect(() => {
    fetchCount();
    if (registerRefresh) registerRefresh(fetchCommentList);
  }, [postId]);

  useEffect(() => {
    if (open) fetchCommentList();
  }, [open]);

  // Agrupa em árvore de 1 nível: raízes + respostas achatadas sob o ancestral raiz.
  const { roots, repliesByRoot } = useMemo(() => {
    const byId = Object.fromEntries(comments.map(c => [c.id, c]));
    const rootIdOf = (c) => {
      let cur = c;
      while (cur.parent_id && byId[cur.parent_id]) cur = byId[cur.parent_id];
      return cur.id;
    };
    const rootList = comments.filter(c => !c.parent_id);
    const byRoot = {};
    for (const c of comments) {
      if (!c.parent_id) continue;
      const rid = rootIdOf(c);
      (byRoot[rid] ||= []).push(c);
    }
    return { roots: rootList, repliesByRoot: byRoot };
  }, [comments]);

  async function submitComment(content, parentId = null) {
    const check = checkContent(content);
    if (check.blocked) { toast.error('Comentário contém termo bloqueado.'); return false; }
    const { error } = await addComment({ postId, userId: profile?.id, content, parentId });
    if (error) {
      toast.error('Erro ao comentar');
      return false;
    }
    logAudit('comment_added', `@${profile?.username} ${parentId ? 'respondeu um comentário' : 'comentou em um post'}`, { category: 'content' });
    await fetchCommentList();
    return true;
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
          {roots.length > 0 && (
            <div className="bg-dark-700 rounded-lg px-3 py-1 mb-3">
              {roots.map(c => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  replies={repliesByRoot[c.id] || []}
                  onDelete={fetchCommentList}
                  onReply={(parentId, text) => submitComment(text, parentId)}
                />
              ))}
            </div>
          )}

          {user ? (
            <CommentComposer onSubmit={(text) => submitComment(text)} />
          ) : (
            <p className="text-xs text-gray-500 font-mono">Faça login para comentar</p>
          )}
        </div>
      )}
    </div>
  );
});

export default CommentSection;
