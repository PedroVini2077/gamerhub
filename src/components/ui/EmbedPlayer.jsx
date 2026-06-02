import { useState, useEffect } from 'react';
import { ExternalLink, Tv } from 'lucide-react';

export function getEmbedInfo(url) {
  if (!url) return null;

  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', id: yt[1], label: 'YouTube', color: '#ff0000', icon: '▶️' };

  const twClip = url.match(/twitch\.tv\/\w+\/clip\/(\w+)/);
  if (twClip) return { type: 'twitch-clip', id: twClip[1], label: 'Twitch Clip', color: '#9147ff', icon: '🎮' };

  const tw = url.match(/twitch\.tv\/(\w+)/);
  if (tw) return { type: 'twitch', id: tw[1], label: 'Twitch', color: '#9147ff', icon: '🎮' };

  const tt = url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/);
  if (tt) return { type: 'tiktok', id: tt[1], label: 'TikTok', color: '#ff0050', icon: '🎵' };

  const ig = url.match(/instagram\.com\/(p|reel|tv)\/([\w-]+)/);
  if (ig) return { type: 'instagram', id: ig[2], label: 'Instagram', color: '#e1306c', icon: '📸' };

  return { type: 'link', label: 'Link externo', color: '#39ff14', icon: '🔗' };
}

  function TwitchPlayer({ id, url, isLive, expiresAt }) {
  const [expired, setExpired] = useState(() => expiresAt && new Date(expiresAt) < new Date());
  const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  useEffect(() => {
    if (!expiresAt) return;
    const remaining = new Date(expiresAt) - Date.now();
    if (remaining <= 0) { setExpired(true); return; }
    const timer = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  if (expired) return (
    <div className="mt-3 rounded-lg border border-dark-400 bg-dark-900 p-8 text-center">
      <p className="text-3xl mb-3">📴</p>
      <p className="text-neon-green font-mono text-sm">Live encerrada</p>
      <p className="text-gray-500 font-mono text-xs mt-1">O streamer ficou offline</p>
    </div>
  );

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-dark-400 bg-dark-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-dark-800 border-b border-dark-600">
        <div className="flex items-center gap-2">
          {isLive && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          <Tv size={13} className="text-purple-400" />
          <span className="text-xs font-mono text-purple-400 font-bold">
            {isLive ? 'AO VIVO' : 'TWITCH'} — {id}
          </span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-purple-400 transition-colors"
        >
          Abrir na Twitch <ExternalLink size={11} />
        </a>
      </div>

      {/* Player sem botões de sub/follow */}
      <div style={{ aspectRatio: '16/9', position: 'relative' }}>
        <iframe
          src={`https://player.twitch.tv/?channel=${id}&parent=${domain}&autoplay=false`}
          className="w-full h-full"
          allowFullScreen
          title="Twitch"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
}

export default function EmbedPlayer({ url, isLive, expiresAt }) {
  const info = getEmbedInfo(url);
  if (!info) return null;

  const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  if (info.type === 'youtube') return (
    <div className="mt-3 rounded-lg overflow-hidden border border-dark-400" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={`https://www.youtube.com/embed/${info.id}?autoplay=0`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube"
        style={{ border: 'none' }}
      />
    </div>
  );

  if (info.type === 'twitch') return (
    <TwitchPlayer id={info.id} url={url} isLive={isLive} expiresAt={expiresAt} />
  );

  if (info.type === 'twitch-clip') return (
    <div className="mt-3 rounded-lg overflow-hidden border border-dark-400 bg-dark-900">
      <div className="flex items-center justify-between px-3 py-2 bg-dark-800 border-b border-dark-600">
        <div className="flex items-center gap-2">
          <Tv size={13} className="text-purple-400" />
          <span className="text-xs font-mono text-purple-400 font-bold">TWITCH CLIP</span>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-purple-400 transition-colors">
          Abrir na Twitch <ExternalLink size={11} />
        </a>
      </div>
      <div style={{ aspectRatio: '16/9' }}>
        <iframe
          src={`https://clips.twitch.tv/embed?clip=${info.id}&parent=${domain}&autoplay=false`}
          className="w-full h-full"
          allowFullScreen
          title="Twitch Clip"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="mt-3 flex items-center gap-3 p-4 rounded-lg border border-dark-400 bg-dark-700 hover:border-neon-green/40 transition-all group">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
        style={{ background: info.color + '22', border: `1px solid ${info.color}44` }}>
        {info.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-bold" style={{ color: info.color }}>{info.label}</p>
        <p className="text-xs text-gray-500 font-mono truncate">{url}</p>
      </div>
      <ExternalLink size={14} className="text-gray-500 group-hover:text-neon-green transition-colors shrink-0" />
    </a>
  );
}
