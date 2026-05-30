import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Tv, MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import AvatarPopup from '../components/ui/AvatarPopup';
import EmbedPlayer from '../components/ui/EmbedPlayer';

export default function Lives() {
  const { user, profile } = useAuth();
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLive, setActiveLive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { fetchLives(); }, []);

  useEffect(() => {
    if (!activeLive) return;
    fetchMessages();

    const channel = supabase.channel(`live-chat-${activeLive.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_chat',
        filter: `post_id=eq.${activeLive.id}`
      }, (payload) => {
        fetchMessages();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeLive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchLives() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
      .eq('is_live', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .not('embed_url', 'is', null)
      .order('created_at', { ascending: false });

    setLives(data || []);
    setLoading(false);
  }

  async function fetchMessages() {
    if (!activeLive) return;
    const { data } = await supabase
      .from('live_chat')
      .select('*, profiles(id, username, avatar_url, role)')
      .eq('post_id', activeLive.id)
      .order('created_at', { ascending: true })
      .limit(100);

    setMessages(data || []);
  }

  async function sendMessage() {
    if (!msg.trim() || !user || !activeLive || sending) return;
    setSending(true);
    await supabase.from('live_chat').insert({
      post_id: activeLive.id,
      user_id: user.id,
      message: msg.trim()
    });
    setMsg('');
    setSending(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500 font-mono text-sm animate-pulse">Carregando lives...</p>
    </div>
  );

  if (activeLive) return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => { setActiveLive(null); setMessages([]); }}
          className="text-gray-500 hover:text-neon-green transition-colors">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-red-400 font-bold">AO VIVO</span>
        </div>
        <h2 className="font-display text-sm text-white truncate">{activeLive.title}</h2>
      </div>

      <EmbedPlayer url={activeLive.embed_url} isLive={true} />

      <div className="card flex flex-col" style={{ height: 350 }}>
        <div className="flex items-center gap-2 p-3 border-b border-dark-500">
          <MessageCircle size={14} className="text-neon-green" />
          <span className="text-xs font-mono text-neon-green uppercase tracking-wider">Chat ao vivo</span>
          <span className="text-xs text-gray-600 font-mono ml-auto">{messages.length} msgs</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-xs text-gray-600 font-mono text-center py-4">
              Seja o primeiro a comentar! 🎮
            </p>
          )}
          {messages.map(m => (
            <div key={m.id} className="flex items-start gap-2">
              <AvatarPopup profile={m.profiles} size={24} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-neon-green font-mono">
                  {m.profiles?.username}
                </span>
                <span className="text-xs text-gray-300 ml-2 break-words">{m.message}</span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {user ? (
          <div className="p-3 border-t border-dark-500 flex gap-2">
            <input
              className="input-gamer flex-1 text-sm py-1.5"
              placeholder="Manda um comentário..."
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              maxLength={200}
            />
            <button onClick={sendMessage} disabled={sending}
              className="btn-solid py-1.5 px-3">
              <Send size={13} />
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-600 font-mono text-center p-3">
            Faça login para comentar
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Tv size={18} className="text-neon-green" />
        <h1 className="font-display text-lg text-white uppercase tracking-wider">Lives</h1>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-red-400">{lives.length} ao vivo</span>
        </div>
      </div>

      {lives.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-3">📺</p>
          <p className="text-gray-500 font-mono text-sm">Nenhuma live acontecendo agora</p>
          <p className="text-gray-600 font-mono text-xs mt-1">Volte mais tarde!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lives.map(live => (
            <div key={live.id} className="card p-4 cursor-pointer hover:border-neon-green/30 transition-all"
              onClick={() => setActiveLive(live)}>
              <div className="flex items-center gap-3 mb-3">
                <AvatarPopup profile={live.profiles} size={36} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{live.profiles?.username}</p>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-mono text-red-400">AO VIVO</span>
                  </div>
                </div>
                {live.expires_at && (
                  <span className="text-xs font-mono text-gray-600">
                    até {new Date(live.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-white mb-1">{live.title}</h3>
              {live.content && <p className="text-sm text-gray-400">{live.content}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="tag tag-purple text-xs">
                  {live.embed_type === 'twitch' ? '🎮 Twitch' : '▶️ YouTube'}
                </span>
                <span className="text-xs font-mono text-neon-green">Entrar na live →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
