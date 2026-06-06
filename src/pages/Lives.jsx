import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fetchActiveLives, endLivePost } from '../services/postService';
import { fetchLiveMessages, fetchLiveTimeouts, sendChatMessage, deleteChatMessage, silenceUser, unsilenceUser } from '../services/liveService';
import { Tv, X, Users, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import { logAudit } from '../lib/auditLog';
import { useRole } from '../hooks/useRole';
import EmbedPlayer from '../components/ui/EmbedPlayer';
import ChatPanel from '../components/lives/ChatPanel';
import ModPanel from '../components/lives/ModPanel';
import LivesList from '../components/lives/LivesList';
import toast from 'react-hot-toast';

export default function Lives() {
  const { user, profile, loading: authLoading } = useAuth();
  const { isAdmin } = useRole();
  const { id } = useParams();
  const navigate = useNavigate();
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLive, setActiveLive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [timeouts, setTimeouts] = useState({});
  const [isSilenced, setIsSilenced] = useState(false);
  const [showModPanel, setShowModPanel] = useState(false);
  const [silenceMenu, setSilenceMenu] = useState(null);
  const [silencingUser, setSilencingUser] = useState(null);
  const [liveEnded, setLiveEnded] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const bottomRef = useRef(null);
  const activeLiveRef = useRef(null);
  const chatInputRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    fetchLives();
    const listChannel = supabase.channel('lives-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, fetchLives)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => { if (payload.new.is_live !== payload.old.is_live) fetchLives(); })
      .subscribe();
    return () => supabase.removeChannel(listChannel);
  }, []);

  useEffect(() => {
    activeLiveRef.current = activeLive;
  }, [activeLive]);

  useEffect(() => {
    if (id && lives.length > 0 && !activeLive) {
      const live = lives.find(l => l.id === id);
      if (live) setActiveLive(live);
    }
  }, [id, lives]);

  useEffect(() => {
    if (!activeLive) return;
    fetchMessages(activeLive.id);
    fetchTimeouts(activeLive.id);

    if (activeLive.expires_at && new Date() >= new Date(activeLive.expires_at)) {
      setLiveEnded(true);
    }

    let expiryTimeout = null;
    if (activeLive.expires_at) {
      const remaining = new Date(activeLive.expires_at) - Date.now();
      if (remaining <= 0) setLiveEnded(true);
      else expiryTimeout = setTimeout(() => setLiveEnded(true), remaining);
    }

    const presenceChannel = supabase.channel(`presence-${activeLive.id}`, {
      config: { presence: { key: user?.id || 'anon' } },
    });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        setViewerCount(Object.keys(presenceChannel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user?.id, at: Date.now() });
        }
      });

    const channel = supabase.channel(`live-${activeLive.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat' },
        (payload) => {
          const postId = payload.new?.post_id || payload.old?.post_id;
          if (postId === activeLiveRef.current?.id) {
            fetchMessages(activeLiveRef.current.id);
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_timeouts' },
        () => fetchTimeouts(activeLiveRef.current?.id))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'posts',
        filter: `id=eq.${activeLive.id}`
      }, (payload) => {
        if (!payload.new?.is_live) setLiveEnded(true);
      })
      .subscribe();

    return () => {
      if (expiryTimeout) clearTimeout(expiryTimeout);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(channel);
    };
  }, [activeLive]);

  useEffect(() => {
    if (document.activeElement === chatInputRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function enterLive(live) {
    setLiveEnded(false);
    setViewerCount(0);
    setActiveLive(live);
    navigate('/lives/' + live.id);
  }

  function exitLive() {
    setActiveLive(null);
    setMessages([]);
    setShowModPanel(false);
    setLiveEnded(false);
    setViewerCount(0);
    navigate('/lives');
  }

  async function fetchLives() {
    const data = await fetchActiveLives();
    setLives(data);
    setLoading(false);
  }

  async function fetchMessages(postId) {
    if (!postId) return;
    const data = await fetchLiveMessages(postId);
    setMessages(data);
  }

  async function fetchTimeouts(postId) {
    if (!postId) return;
    const map = await fetchLiveTimeouts(postId);
    setTimeouts(map);
    setIsSilenced(!!(user && map[user.id] && new Date(map[user.id].expires_at) > new Date()));
  }

  async function sendMessage() {
    if (!msg.trim() || !user || !activeLive || sending || isSilenced) return;
    setSending(true);
    await sendChatMessage({ postId: activeLive.id, userId: user.id, message: msg.trim() });
    setMsg('');
    setSending(false);
  }

  async function deleteMessage(msgId) {
    const isMod = isAdmin || (activeLive && user && activeLive.user_id === user.id);
    await deleteChatMessage(msgId, isMod, user.id);
    logAudit('live_chat_delete', `@${profile?.username} deletou uma mensagem no chat da live "${activeLive?.title}"`, { category: 'live' });
  }

  async function endLive() {
    if (!activeLive) return;
    await endLivePost(activeLive.id);
    logAudit('live_ended', `@${profile?.username} encerrou a live "${activeLive.title}"`, { category: 'live' });
    setLiveEnded(true);
  }

  async function handleSilenceUser(userId, minutes) {
    if (!activeLive) return;
    setSilencingUser(userId);
    setSilenceMenu(null);
    const { error } = await silenceUser({ postId: activeLive.id, userId, minutes, createdBy: user.id });
    if (error) {
      toast.error('Erro ao silenciar');
    } else {
      toast.success('Usuário silenciado por ' + minutes + ' min');
      logAudit('live_silence', `@${profile?.username} silenciou um usuário por ${minutes}min na live "${activeLive.title}"`, { category: 'live' });
    }
    setSilencingUser(null);
    await fetchTimeouts(activeLive.id);
  }

  async function handleUnsilenceUser(userId) {
    if (!activeLive) return;
    await unsilenceUser({ postId: activeLive.id, userId });
    logAudit('live_unsilence', `@${profile?.username} removeu silêncio na live "${activeLive.title}"`, { category: 'live' });
    await fetchTimeouts(activeLive.id);
  }

  const isLiveOwner = activeLive && user && activeLive.user_id === user.id;
  const canModerate = isAdmin || isLiveOwner;
  const isUserSilenced = (uid) => timeouts[uid] && new Date(timeouts[uid].expires_at) > new Date();
  const silencedList = Object.values(timeouts).filter(t => new Date(t.expires_at) > new Date());
  const uniqueChatters = [...new Map(messages.map(m => [m.user_id, m.profiles])).values()];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-500 font-mono text-sm animate-pulse">Carregando lives...</p>
    </div>
  );

  if (activeLive) return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pr-1">
        <button onClick={exitLive}
          className="text-gray-500 hover:text-neon-green transition-colors shrink-0 p-1">
          <X size={18} />
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-red-400 font-bold">AO VIVO</span>
          {viewerCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs font-mono text-gray-600">
              <Users size={10} />{viewerCount}
            </span>
          )}
        </div>
        <h2 className="font-display text-sm text-white truncate flex-1 min-w-0">{activeLive.title}</h2>
        {isLiveOwner && !liveEnded && (
          <button type="button" onClick={endLive}
            className="flex items-center gap-1 px-2 py-1 rounded border border-red-500/40 text-red-400 text-xs font-mono hover:bg-red-500/10 transition-all shrink-0 cursor-pointer">
            <X size={11} /><span>Encerrar</span>
          </button>
        )}
        {canModerate && !liveEnded && (
          <button type="button"
            onClick={() => { setSilenceMenu(null); setShowModPanel(p => !p); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition-all shrink-0 cursor-pointer ${
              showModPanel
                ? 'border-neon-green text-neon-green bg-neon-green/10'
                : 'border-dark-400 text-gray-500 hover:border-neon-green/50 hover:text-neon-green'
            }`}>
            <Shield size={12} /><span>Mod</span>
          </button>
        )}
      </div>

      {liveEnded ? (
        <div className="mt-1 rounded-lg border border-dark-400 bg-dark-900 p-10 text-center">
          <Tv size={36} className="text-gray-600 mx-auto mb-3" />
          <p className="text-neon-green font-mono text-sm font-bold">Live encerrada</p>
          <p className="text-gray-500 font-mono text-xs mt-1">O streamer ficou offline</p>
        </div>
      ) : (
        <EmbedPlayer url={activeLive.embed_url} isLive={true} expiresAt={activeLive.expires_at} />
      )}

      {canModerate && showModPanel && (
        <ModPanel
          silencedList={silencedList}
          messages={messages}
          uniqueChatters={uniqueChatters}
          handleSilenceUser={handleSilenceUser}
          handleUnsilenceUser={handleUnsilenceUser}
          silenceMenu={silenceMenu}
          setSilenceMenu={setSilenceMenu}
          silencingUser={silencingUser}
          isUserSilenced={isUserSilenced}
          user={user}
        />
      )}

      <ChatPanel
        messages={messages}
        msg={msg}
        setMsg={setMsg}
        sendMessage={sendMessage}
        sending={sending}
        isSilenced={isSilenced}
        canModerate={canModerate}
        deleteMessage={deleteMessage}
        isUserSilenced={isUserSilenced}
        user={user}
        bottomRef={bottomRef}
        chatInputRef={chatInputRef}
      />
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

      <LivesList lives={lives} enterLive={enterLive} />
    </div>
  );
}
