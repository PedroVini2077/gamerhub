import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth.jsx';
import { Tv, MessageSquare, Send, Trash2 } from 'lucide-react';
import EmbedPlayer from '../components/ui/EmbedPlayer';
import AvatarPopup from '../components/ui/AvatarPopup';

export default function Lives() {
  const { user, profile } = useAuth();
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLive, setSelectedLive] = useState(null);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchLives();
  }, []);

  useEffect(() => {
    if (!selectedLive) return;
    fetchComments();

    const channel = supabase.channel(`live-${selectedLive.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'comments',
        filter: `post_id=eq.${selectedLive.id}`
      }, () => fetchComments())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedLive]);

  async function fetchLives() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
      .eq('is_live', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false });
    setLives(data || []);
    if (data && data.length > 0 && !selectedLive) setSelectedLive(data[0]);
    setLoading(false);
  }

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
      .eq('post_id', selectedLive.id)
      .order('created_at', { ascending: true });
    setComments(data || []);
  }

  async function sendComment() {
    if (!comment.trim() || !user) return;
    setSending(true);
    await supabase.from('comments').insert({
      post_id: selectedLive.id,
      user_id: user.id,
      content: comment.trim(),
    });
    setComment('');
    setSending(false);
  }

  async function deleteComment(id) {
    await supabase.from('comments').delete().eq('id', id);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500 font-mono text-sm animate-pulse">Carregando lives...</p>
    </div>
  );

  if (lives.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Tv size={40} className="text-gray-600" />
      <p className="text-gray-500 font-mono text-sm">Nenhuma live no momento</p>
      <p className="text-gray-600 font-mono text-xs">Quando alguém estiver ao vivo, aparecerá aqui</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <h2 className="font-display text-sm text-neon-green tracking-widest uppercase">Lives</h2>
      </div>

      {/* Lista de lives */}
      {lives.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {lives.map(live => (
            <button
              key={live.id}
              onClick={() => setSelectedLive(live)}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
                selectedLive?.id === live.id
                  ? 'border-neon-green text-neon-green bg-neon-green/10'
                  : 'border-dark-400 text-gray-400 hover:border-gray-500'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {live.profiles?.username}
            </button>
          ))}
        </div>
      )}

      {selectedLive && (
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-dark-500 flex items-center gap-3">
            <AvatarPopup profile={selectedLive.profiles} size={32} />
            <div>
              <p className="text-sm font-bold text-white">{selectedLive.title}</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <p className="text-xs font-mono text-red-400">AO VIVO — {selectedLive.profiles?.username}</p>
              </div>
            </div>
          </div>

          {/* Player */}
          <EmbedPlayer url={selectedLive.embed_url} isLive={true} />

          {/* Chat */}
          <div className="border-t border-dark-500">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-600">
              <MessageSquare size={13} className="text-gray-500" />
              <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Chat ao vivo</p>
            </div>

            {/* Mensagens */}
            <div className="h-64 overflow-y-auto p-3 space-y-2 flex flex-col">
              {comments.length === 0 && (
                <p className="text-gray-600 font-mono text-xs text-center mt-8">
                  Seja o primeiro a comentar!
                </p>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-2 group">
                  <AvatarPopup profile={c.profiles} size={24} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-neon-green mr-1">{c.profiles?.username}</span>
                    <span className="text-xs text-gray-300">{c.content}</span>
                  </div>
                  {user && (user.id === c.user_id || profile?.role === 'admin' || profile?.role === 'super_admin') && (
                    <button onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Input */}
            {user ? (
              <div className="flex gap-2 p-3 border-t border-dark-600">
                <input
                  className="input-gamer flex-1 text-sm py-2"
                  placeholder="Comente ao vivo..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendComment()}
                  maxLength={200}
                />
                <button
                  onClick={sendComment}
                  disabled={sending || !comment.trim()}
                  className="btn-solid px-3 py-2"
                >
                  <Send size={13} />
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-gray-600 font-mono p-3">
                Faça login para comentar
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
