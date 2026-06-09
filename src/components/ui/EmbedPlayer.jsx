import { useState, useEffect } from 'react';
import { ExternalLink, Tv, Music, Camera } from 'lucide-react';
import { getEmbedInfo } from '../../lib/embed';

// Marca o player como encerrado quando passa de expires_at — compartilhado
// entre Twitch e YouTube ao vivo (antes só a Twitch tinha esse tratamento).
function useExpired(expiresAt) {
  const [expired, setExpired] = useState(() => !!expiresAt && new Date(expiresAt) < new Date());
  useEffect(() => {
    if (!expiresAt) return;
    const remaining = new Date(expiresAt) - Date.now();
    if (remaining <= 0) { setExpired(true); return; }
    const timer = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return expired;
}

function LiveEnded() {
  return (
    <div className="mt-3 rounded-lg border border-dark-400 bg-dark-900 p-8 text-center">
      <Tv size={32} className="text-gray-600 mx-auto mb-3" />
      <p className="text-neon-green font-mono text-sm">Live encerrada</p>
      <p className="text-gray-500 font-mono text-xs mt-1">O streamer ficou offline</p>
    </div>
  );
}

// Player padronizado pra embeds de vídeo (Twitch e YouTube): cabeçalho com
// selo AO VIVO (quando isLive), link pra plataforma e, se houver expires_at,
// troca pra tela de "Live encerrada". O mesmo layout serve VOD/clip (isLive
// false, sem expiração).
function VideoPlayer({ isLive, expiresAt, accent, brand, channel, url, openLabel, iframeSrc, allow }) {
  const expired = useExpired(expiresAt);
  if (expired) return <LiveEnded />;

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-dark-400 bg-dark-900">
      <div className="flex items-center justify-between px-3 py-2 bg-dark-800 border-b border-dark-600">
        <div className="flex items-center gap-2">
          {isLive && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          <Tv size={13} style={{ color: accent }} />
          <span className="text-xs font-mono font-bold" style={{ color: accent }}>
            {isLive ? 'AO VIVO' : brand}{channel ? ` — ${channel}` : ''}
          </span>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors">
          {openLabel} <ExternalLink size={11} />
        </a>
      </div>
      <div style={{ aspectRatio: '16/9', position: 'relative' }}>
        <iframe src={iframeSrc} className="w-full h-full" allow={allow} allowFullScreen
          title={brand} style={{ border: 'none' }} />
      </div>
    </div>
  );
}

export default function EmbedPlayer({ url, isLive, expiresAt }) {
  const info = getEmbedInfo(url);
  if (!info) return null;

  const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  if (info.type === 'youtube') return (
    <VideoPlayer
      isLive={isLive} expiresAt={expiresAt} accent="#ff4d4d" brand="YOUTUBE"
      url={url} openLabel="Abrir no YouTube"
      iframeSrc={`https://www.youtube.com/embed/${info.id}?autoplay=0`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    />
  );

  if (info.type === 'twitch') return (
    <VideoPlayer
      isLive={isLive} expiresAt={expiresAt} accent="#c084fc" brand="TWITCH" channel={info.id}
      url={url} openLabel="Abrir na Twitch"
      iframeSrc={`https://player.twitch.tv/?channel=${info.id}&parent=${domain}&autoplay=false`}
    />
  );

  if (info.type === 'twitch-vod' || info.type === 'twitch-clip') {
    const isClip = info.type === 'twitch-clip';
    const iframeSrc = isClip
      ? `https://clips.twitch.tv/embed?clip=${info.id}&parent=${domain}&autoplay=false`
      : `https://player.twitch.tv/?video=${info.id}&parent=${domain}&autoplay=false`;
    return (
      <VideoPlayer
        isLive={false} accent="#c084fc" brand={isClip ? 'TWITCH CLIP' : 'TWITCH VOD'}
        url={url} openLabel="Abrir na Twitch" iframeSrc={iframeSrc}
      />
    );
  }

  const platformIcon = info.type === 'tiktok'
    ? <Music size={18} style={{ color: info.color }} />
    : info.type === 'instagram'
    ? <Camera size={18} style={{ color: info.color }} />
    : <ExternalLink size={18} style={{ color: info.color }} />;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="mt-3 flex items-center gap-3 p-4 rounded-lg border border-dark-400 bg-dark-700 hover:border-neon-green/40 transition-all group">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ background: info.color + '22', border: `1px solid ${info.color}44` }}>
        {platformIcon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-bold" style={{ color: info.color }}>{info.label}</p>
        <p className="text-xs text-gray-500 font-mono truncate">{url}</p>
      </div>
      <ExternalLink size={14} className="text-gray-500 group-hover:text-neon-green transition-colors shrink-0" />
    </a>
  );
}
