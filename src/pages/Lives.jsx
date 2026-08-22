import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tv, X, Users, Shield, Radio } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useRole } from '../hooks/useRole';
import { useLivesList } from '../hooks/useLivesList';
import { useLiveChat } from '../hooks/useLiveChat';
import { suspendedUntil, canModerateLive } from '../lib/roles';
import EmbedPlayer from '../components/ui/EmbedPlayer';
import ChatPanel from '../components/lives/ChatPanel';
import ModPanel from '../components/lives/ModPanel';
import LivesList from '../components/lives/LivesList';
import LiveGoModal from '../components/lives/LiveGoModal';

// Sub-seções da aba Lives: lives comuns (de posts) vs lives de jogadores.
const LIVE_TABS = [
  { id: 'comunidade', label: 'Da comunidade', match: l => !l.live_kind },
  { id: 'gameplay',   label: 'Gameplays',     match: l => l.live_kind === 'gameplay' },
  { id: 'react',      label: 'Reacts',        match: l => l.live_kind === 'react' },
  { id: 'outro',      label: 'Outros',        match: l => l.live_kind === 'outro' },
];

export default function Lives() {
  const { user, profile, loading: authLoading } = useAuth();
  const { isAdmin } = useRole();
  const { lives, loading, reload: reloadLives } = useLivesList();
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeLive, setActiveLive] = useState(null);
  const [showModPanel, setShowModPanel] = useState(false);
  const [liveTab, setLiveTab] = useState('comunidade');
  const [showGoLive, setShowGoLive] = useState(false);

  const {
    messages, msg, setMsg, sending, isSilenced, liveEnded, viewerCount,
    silenceMenu, setSilenceMenu, silencingUser,
    bottomRef, chatInputRef,
    sendMessage, deleteMessage, endLive, handleSilenceUser, handleUnsilenceUser,
    isUserSilenced, silencedList, uniqueChatters,
  } = useLiveChat({ activeLive, user, profile, isAdmin });

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (id && lives.length > 0 && !activeLive) {
      const live = lives.find(l => l.id === id);
      if (live) setActiveLive(live);
    }
  }, [id, lives]);

  // Entrar/sair só troca a live e a rota: zerar chat, presença e estado de
  // encerrada é responsabilidade do useLiveChat, que reage a `activeLive`.
  function enterLive(live) {
    setActiveLive(live);
    navigate('/lives/' + live.id);
  }

  function exitLive() {
    setActiveLive(null);
    setShowModPanel(false);
    navigate('/lives');
  }

  const isLiveOwner = !!(activeLive && user && activeLive.user_id === user.id);
  const canModerate = canModerateLive(isAdmin, activeLive, user);

  if (loading) return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-dark-700 rounded-xl animate-pulse" />)}
    </div>
  );

  if (activeLive) return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pr-1">
        <button aria-label="Sair da live" onClick={exitLive}
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
        suspended={suspendedUntil(profile)}
        bottomRef={bottomRef}
        chatInputRef={chatInputRef}
      />
    </div>
  );

  const visibleLives = lives.filter(LIVE_TABS.find(t => t.id === liveTab).match);

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Tv size={18} className="text-neon-green" />
        <h1 className="font-display text-lg text-white uppercase tracking-wider">Lives</h1>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-red-400">{lives.length} ao vivo</span>
        </div>
        <button onClick={() => setShowGoLive(true)}
          className="btn-solid flex items-center gap-1.5 py-1.5 px-3 text-xs ml-auto">
          <Radio size={12} />Ficar ao vivo
        </button>
      </div>

      <div className="flex border-b border-dark-500 overflow-x-auto overflow-y-hidden mb-5">
        {LIVE_TABS.map(({ id, label, match }) => {
          const count = lives.filter(match).length;
          return (
            <button key={id} onClick={() => setLiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap transition-colors ${
                liveTab === id
                  ? 'border-neon-green text-neon-green'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {label}
              {count > 0 && <span className="text-[10px] text-gray-600">({count})</span>}
            </button>
          );
        })}
      </div>

      <LivesList lives={visibleLives} enterLive={enterLive} />

      {showGoLive && (
        <LiveGoModal profile={profile} onClose={() => setShowGoLive(false)} onCreated={reloadLives} />
      )}
    </div>
  );
}
