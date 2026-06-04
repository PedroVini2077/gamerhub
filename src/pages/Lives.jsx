import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Tv, MessageCircle, Send, X, Trash2, Clock, Shield, Users, VolumeX } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import { logAudit } from '../lib/auditLog';
import { useRole } from '../hooks/useRole';
import AvatarPopup from '../components/ui/AvatarPopup';
import EmbedPlayer from '../components/ui/EmbedPlayer';
import toast from 'react-hot-toast';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };
const roleLabels = { user: 'Player', admin: 'Admin', super_admin: 'Super Admin' };

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

    // Check expires_at immediately on enter
    if (activeLive.expires_at && new Date() >= new Date(activeLive.expires_at)) {
      setLiveEnded(true);
    }

    // Timer preciso — dispara no exato momento que expires_at chega
    let expiryTimeout = null;
    if (activeLive.expires_at) {
      const remaining = new Date(activeLive.expires_at) - Date.now();
      if (remaining <= 0) setLiveEnded(true);
      else expiryTimeout = setTimeout(() => setLiveEnded(true), remaining);
    }

    // Presence — viewer counter
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
    const { data } = await supabase.from('posts')
      .select('*, profiles(id, username, avatar_url, role, bio, created_at)')
      .eq('is_live', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .not('embed_url', 'is', null)
      .order('created_at', { ascending: false });
    setLives(data || []);
    setLoading(false);
  }

  async function fetchMessages(postId) {
    if (!postId) return;
    const { data } = await supabase.from('live_chat')
      .select('id, message, created_at, user_id, profiles(id, username, avatar_url, role, bio, created_at)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
  }

  async function fetchTimeouts(postId) {
    if (!postId) return;
    const { data } = await supabase.from('live_chat_timeouts')
      .select('*').eq('post_id', postId);
    const map = {};
    (data || []).forEach(t => { map[t.user_id] = t; });
    setTimeouts(map);
    setIsSilenced(!!(user && map[user.id] && new Date(map[user.id].expires_at) > new Date()));
  }

  async function sendMessage() {
    if (!msg.trim() || !user || !activeLive || sending || isSilenced) return;
    setSending(true);
    await supabase.from('live_chat').insert({
      post_id: activeLive.id, user_id: user.id, message: msg.trim()
    });
    setMsg('');
    setSending(false);
  }

  async function deleteMessage(msgId) {
    const isMod = isAdmin || (activeLive && user && activeLive.user_id === user.id);
    let q = supabase.from('live_chat').delete().eq('id', msgId);
    if (!isMod) q = q.eq('user_id', user.id);
    await q;
    logAudit('live_chat_delete', `@${profile?.username} deletou uma mensagem no chat da live "${activeLive?.title}"`, { category: 'live' });
  }

  async function endLive() {
    if (!activeLive) return;
    await supabase.from('posts').update({ is_live: false }).eq('id', activeLive.id);
    logAudit('live_ended', `@${profile?.username} encerrou a live "${activeLive.title}"`, { category: 'live' });
    setLiveEnded(true);
  }

  async function silenceUser(userId, minutes) {
    if (!activeLive) return;
    setSilencingUser(userId);
    setSilenceMenu(null);
    const expires = new Date(Date.now() + minutes * 60000).toISOString();

    const { error: delError } = await supabase.from('live_chat_timeouts')
      .delete()
      .eq('post_id', activeLive.id)
      .eq('user_id', userId);
    if (delError) toast.error('DELETE falhou: ' + delError.message);

    const { error: insError } = await supabase.from('live_chat_timeouts').insert({
      post_id: activeLive.id,
      user_id: userId,
      expires_at: expires,
      created_by: user.id,
    });
    if (insError) {
      toast.error('INSERT falhou: ' + insError.message);
    } else {
      toast.success('Usuário silenciado por ' + minutes + ' min');
      logAudit('live_silence', `@${profile?.username} silenciou um usuário por ${minutes}min na live "${activeLive.title}"`, { category: 'live' });
    }

    setSilencingUser(null);
    await fetchTimeouts(activeLive.id);
  }

  async function unsilenceUser(userId) {
    if (!activeLive) return;
    await supabase.from('live_chat_timeouts').delete()
      .eq('post_id', activeLive.id).eq('user_id', userId);
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
          <button
            type="button"
            onClick={endLive}
            className="flex items-center gap-1 px-2 py-1 rounded border border-red-500/40 text-red-400 text-xs font-mono hover:bg-red-500/10 transition-all shrink-0 cursor-pointer">
            <X size={11} /><span>Encerrar</span>
          </button>
        )}
        {canModerate && !liveEnded && (
          <button
            type="button"
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
        <div className="rounded-xl border border-neon-green/20 bg-dark-800"
          style={{ boxShadow: '0 0 20px #39ff1410' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-600 bg-dark-900/50">
            <Shield size={14} className="text-neon-green" />
            <span className="text-xs font-mono text-neon-green uppercase tracking-widest font-bold">Painel de Moderação</span>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={12} className="text-yellow-400" />
                <span className="text-xs font-mono text-yellow-400 uppercase tracking-wider">
                  Silenciados ({silencedList.length})
                </span>
              </div>
              {silencedList.length === 0 ? (
                <p className="text-xs text-gray-600 font-mono pl-4">Nenhum usuário silenciado</p>
              ) : silencedList.map(t => {
                const msgProfile = messages.find(m => m.user_id === t.user_id)?.profiles;
                const remaining = Math.ceil((new Date(t.expires_at) - new Date()) / 60000);
                return (
                  <div key={t.user_id} className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2 border border-yellow-400/10">
                    <VolumeX size={15} className="text-yellow-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-bold text-yellow-400">{msgProfile?.username || 'Usuário'}</p>
                      <p className="text-xs font-mono text-gray-600">{remaining} min restantes</p>
                    </div>
                    <button onClick={() => unsilenceUser(t.user_id)}
                      className="text-xs font-mono text-gray-500 hover:text-neon-green border border-dark-400 hover:border-neon-green/40 px-2 py-0.5 rounded transition-all">
                      Remover
                    </button>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={12} className="text-neon-cyan" />
                <span className="text-xs font-mono text-neon-cyan uppercase tracking-wider">
                  No chat ({uniqueChatters.length})
                </span>
              </div>
              {uniqueChatters.length === 0 ? (
                <p className="text-xs text-gray-600 font-mono pl-4">Ninguém comentou ainda</p>
              ) : uniqueChatters.map(p => {
                if (!p || p.id === user?.id) return null;
                const silenced = isUserSilenced(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
                    <AvatarPopup profile={p} size={24} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-bold text-white">{p.username}</p>
                      <span className={`tag text-xs ${roleColors[p.role] || 'tag-cyan'}`}>
                        {roleLabels[p.role] || 'Player'}
                      </span>
                    </div>
                    {silenced ? (
                      <button onClick={() => unsilenceUser(p.id)}
                        className="text-xs font-mono text-yellow-400 border border-yellow-400/30 hover:border-yellow-400/60 hover:bg-yellow-400/5 px-2 py-0.5 rounded transition-all active:scale-95">
                        <VolumeX size={10} className="inline mr-1" />Remover
                      </button>
                    ) : (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setSilenceMenu(silenceMenu === p.id ? null : p.id)}
                          disabled={silencingUser === p.id}
                          className="text-xs font-mono text-gray-500 hover:text-yellow-400 border border-dark-400 hover:border-yellow-400/40 px-2 py-0.5 rounded transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                          {silencingUser === p.id
                            ? <span className="animate-pulse">...</span>
                            : <span className="flex items-center gap-1"><Clock size={10} /><span>Silenciar</span></span>
                          }
                        </button>
                        {silenceMenu === p.id && (
                          <div className="absolute right-0 top-7 bg-dark-700 border border-dark-400 rounded-lg p-1.5 z-20 flex flex-col gap-1"
                            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                            <p className="text-xs font-mono text-gray-500 px-2 pb-1 border-b border-dark-500">Silenciar por:</p>
                            {[5, 10, 30, 60].map(min => (
                              <button key={min} type="button" onClick={() => silenceUser(p.id, min)}
                                className="text-xs font-mono text-gray-400 hover:text-yellow-400 hover:bg-dark-600 px-3 py-1 rounded text-left transition-colors active:scale-95">
                                {min} min
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="card flex flex-col" style={{ height: 380 }}>
        <div className="flex items-center gap-2 p-3 border-b border-dark-500">
          <MessageCircle size={14} className="text-neon-green" />
          <span className="text-xs font-mono text-neon-green uppercase tracking-wider">Chat ao vivo</span>
          <span className="text-xs text-gray-600 font-mono ml-auto">{messages.length} msgs</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-xs text-gray-600 font-mono text-center py-4">Seja o primeiro a comentar!</p>
          )}
          {messages.map(m => {
            const silenced = isUserSilenced(m.user_id);
            const canDelete = canModerate || (user && m.user_id === user.id);
            return (
              <div key={m.id} className="flex items-start gap-2 group">
                <AvatarPopup profile={m.profiles} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold font-mono ${silenced ? 'text-gray-600' : 'text-neon-green'}`}>
                      {m.profiles?.username}
                    </span>
                    {silenced && <VolumeX size={10} className="text-yellow-500" />}
                    {m.profiles?.role !== 'user' && (
                      <span className={`tag ${roleColors[m.profiles?.role]}`} style={{ fontSize: 9, padding: '1px 4px' }}>
                        {roleLabels[m.profiles?.role]}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-300 break-words">{m.message}</span>
                </div>
                {canDelete && (
                  <button onClick={() => deleteMessage(m.id)}
                    className="hidden group-hover:flex text-gray-600 hover:text-red-400 transition-colors shrink-0 p-0.5">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {user ? (
          isSilenced ? (
            <div className="p-3 border-t border-dark-500 text-center">
              <p className="text-xs font-mono text-yellow-500 flex items-center justify-center gap-1.5"><VolumeX size={12} />Você está silenciado neste chat</p>
            </div>
          ) : (
            <div className="p-3 border-t border-dark-500 flex gap-2">
              <input
                id="live-chat-input"
                aria-label="Mensagem de chat ao vivo"
                className="input-gamer flex-1 text-sm py-1.5"
                placeholder="Manda um comentário..."
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                maxLength={200} />
              <button onClick={sendMessage} disabled={sending} className="btn-solid py-1.5 px-3">
                <Send size={13} />
              </button>
            </div>
          )
        ) : (
          <p className="text-xs text-gray-600 font-mono text-center p-3">Faça login para comentar</p>
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
          <div className="flex justify-center mb-5">
            <svg width="170" height="113" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg">

              {/* sombras de chão */}
              <ellipse cx="55" cy="115" rx="40" ry="4.5" fill="#39ff14" fillOpacity="0.07"/>
              <ellipse cx="148" cy="113" rx="14" ry="3" fill="#39ff14" fillOpacity="0.04"/>

              {/* ══ TRIPÉ ══ */}
              <line x1="49" y1="94" x2="21" y2="115" stroke="#39ff14" strokeWidth="1.7" strokeLinecap="round"/>
              <line x1="57" y1="95" x2="57" y2="115" stroke="#39ff14" strokeWidth="1.7" strokeLinecap="round"/>
              <line x1="65" y1="94" x2="89" y2="115" stroke="#39ff14" strokeWidth="1.7" strokeLinecap="round"/>
              <rect x="42" y="89" width="30" height="7" rx="3" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.3"/>

              {/* ══ CORPO DA CÂMERA ══ */}
              <rect x="16" y="48" width="78" height="44" rx="7" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.8"/>

              {/* ── bobina esquerda (menor) ── */}
              <circle cx="34" cy="36" r="13" fill="#09090f" stroke="#39ff14" strokeWidth="1.5"/>
              <circle cx="34" cy="36" r="8" fill="#0d0d14" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.28"/>
              <circle cx="34" cy="36" r="2.8" fill="#09090f" stroke="#39ff14" strokeWidth="1"/>
              <line x1="34" y1="28" x2="34" y2="33" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.45"/>
              <line x1="34" y1="39" x2="34" y2="44" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.45"/>
              <line x1="26" y1="36" x2="31" y2="36" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.45"/>
              <line x1="37" y1="36" x2="42" y2="36" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.45"/>

              {/* ── bobina direita (maior) ── */}
              <circle cx="67" cy="32" r="17" fill="#09090f" stroke="#39ff14" strokeWidth="1.7"/>
              <circle cx="67" cy="32" r="11" fill="#0d0d14" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.28"/>
              <circle cx="67" cy="32" r="3.6" fill="#09090f" stroke="#39ff14" strokeWidth="1.2"/>
              <line x1="67" y1="21" x2="67" y2="28" stroke="#39ff14" strokeWidth="1" strokeOpacity="0.45"/>
              <line x1="67" y1="36" x2="67" y2="43" stroke="#39ff14" strokeWidth="1" strokeOpacity="0.45"/>
              <line x1="56" y1="32" x2="63" y2="32" stroke="#39ff14" strokeWidth="1" strokeOpacity="0.45"/>
              <line x1="71" y1="32" x2="78" y2="32" stroke="#39ff14" strokeWidth="1" strokeOpacity="0.45"/>
              <line x1="59" y1="23" x2="64" y2="28" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.3"/>
              <line x1="70" y1="36" x2="75" y2="41" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.3"/>
              <line x1="75" y1="23" x2="70" y2="28" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.3"/>
              <line x1="59" y1="41" x2="64" y2="36" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.3"/>

              {/* ── lente principal ── */}
              <circle cx="37" cy="68" r="17" fill="#09090f" stroke="#39ff14" strokeWidth="1.8"/>
              <circle cx="37" cy="68" r="12" fill="#0d0d14" stroke="#39ff14" strokeWidth="0.8" strokeOpacity="0.25"/>
              <circle cx="37" cy="68" r="6.5" fill="#07070d"/>
              <circle cx="34" cy="65" r="2" fill="#39ff14" fillOpacity="0.1"/>

              {/* ── visor ── */}
              <rect x="66" y="50" width="16" height="11" rx="2" fill="#09090f" stroke="#39ff14" strokeWidth="1"/>

              {/* ── matte box ── */}
              <rect x="94" y="54" width="14" height="24" rx="2" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.3"/>
              <line x1="94" y1="61" x2="108" y2="61" stroke="#39ff14" strokeWidth="0.5" strokeOpacity="0.25"/>
              <line x1="94" y1="68" x2="108" y2="68" stroke="#39ff14" strokeWidth="0.5" strokeOpacity="0.25"/>

              {/* ── dials no corpo ── */}
              <circle cx="74" cy="66" r="3.5" fill="#09090f" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.4"/>
              <circle cx="74" cy="78" r="2.5" fill="#09090f" stroke="#39ff14" strokeWidth="0.8" strokeOpacity="0.3"/>
              <line x1="65" y1="74" x2="68" y2="74" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.25"/>

              {/* ══ PERSONAGEM CONFUSO (separado) ══ */}
              <ellipse cx="148" cy="78" rx="15" ry="16" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.4"/>
              {/* perninhas */}
              <line x1="141" y1="93" x2="138" y2="107" stroke="#39ff14" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="155" y1="93" x2="158" y2="107" stroke="#39ff14" strokeWidth="1.4" strokeLinecap="round"/>
              {/* braços erguidos */}
              <path d="M133 75 Q127 67 130 60" stroke="#39ff14" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
              <path d="M163 75 Q169 67 166 60" stroke="#39ff14" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
              {/* mãozinhas */}
              <circle cx="130" cy="59" r="3" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.1"/>
              <circle cx="166" cy="59" r="3" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.1"/>
              {/* olho esq — olhando pra cima-direita */}
              <ellipse cx="142" cy="75" rx="2.6" ry="3.1" fill="#39ff14"/>
              <ellipse cx="143" cy="74" rx="1.1" ry="1.1" fill="#09090f"/>
              {/* olho dir — olhando pra baixo-esquerda */}
              <ellipse cx="154" cy="75" rx="2.6" ry="3.1" fill="#39ff14"/>
              <ellipse cx="153" cy="76" rx="1.1" ry="1.1" fill="#09090f"/>
              {/* sobrancelha levantada */}
              <path d="M139 70 Q142 68 145 69" stroke="#39ff14" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              {/* boca confusa ondulada */}
              <path d="M141 84 Q144.5 82 148 84 Q151.5 86 155 84" stroke="#39ff14" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

              {/* ? grande acima do personagem */}
              <text x="143" y="56" fontSize="15" fill="#39ff14" fillOpacity="0.9" fontFamily="monospace" fontWeight="bold">?</text>
              {/* ?s menores flutuando */}
              <text x="170" y="50" fontSize="9" fill="#39ff14" fillOpacity="0.35" fontFamily="monospace">?</text>
              <text x="110" y="42" fontSize="7" fill="#39ff14" fillOpacity="0.2" fontFamily="monospace">?</text>

            </svg>
          </div>
          <p className="text-gray-400 font-mono text-sm">Nenhuma live acontecendo agora</p>
          <p className="text-gray-600 font-mono text-xs mt-1">Volte mais tarde!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lives.map(live => (
            <div key={live.id} className="card p-4 cursor-pointer hover:border-neon-green/30 transition-all"
              onClick={() => enterLive(live)}>
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
                  {live.embed_type === 'twitch' ? 'Twitch' : 'YouTube'}
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
