import { ExternalLink } from 'lucide-react';

export function getEmbedInfo(url) {
  if (!url) return null;

  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', id: yt[1], label: 'YouTube', color: '#ff0000' };

  // Twitch clip
  const twClip = url.match(/twitch\.tv\/\w+\/clip\/(\w+)/);
  if (twClip) return { type: 'twitch-clip', id: twClip[1], label: 'Twitch', color: '#9147ff' };

  // Twitch channel
  const tw = url.match(/twitch\.tv\/(\w+)/);
  if (tw) return { type: 'twitch', id: tw[1], label: 'Twitch', color: '#9147ff' };

  // TikTok
  const tt = url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/);
  if (tt) return { type: 'tiktok', id: tt[1], label: 'TikTok', color: '#ff0050', icon: '🎵' };

  // Instagram
  const ig = url.match(/instagram\.com\/(p|reel|tv)\/([\w-]+)/);
  if (ig) return { type: 'instagram', id: ig[2], label: 'Instagram', color: '#e1306c', icon: '📸' };

  // Link genérico
  return { type: 'link', label: 'Link externo', color: '#39ff14' };
}

export default function EmbedPlayer({ url }) {
  const info = getEmbedInfo(url);
  if (!info) return null;

  const domain = window.location.hostname;

  if (info.type === 'youtube') return (
    <div className="mt-3 rounded-lg overflow-hidden border border-dark-400" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={`https://www.youtube.com/embed/${info.id}`}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  );

  if (info.type === 'twitch') return (
    <div className="mt-3 rounded-lg overflow-hidden border border-dark-400" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={`https://player.twitch.tv/?channel=${info.id}&parent=${domain}`}
        className="w-full h-full"
        allowFullScreen
        title="Twitch stream"
      />
    </div>
  );

  if (info.type === 'twitch-clip') return (
    <div className="mt-3 rounded-lg overflow-hidden border border-dark-400" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={`https://clips.twitch.tv/embed?clip=${info.id}&parent=${domain}`}
        className="w-full h-full"
        allowFullScreen
        title="Twitch clip"
      />
    </div>
  );

  // TikTok, Instagram e links genéricos — card com botão
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center gap-3 p-4 rounded-lg border border-dark-400 bg-dark-700 hover:border-neon-green/40 transition-all group"
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
        style={{ background: info.color + '22', border: `1px solid ${info.color}44` }}>
        {info.icon || '🎬'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-bold" style={{ color: info.color }}>{info.label}</p>
        <p className="text-xs text-gray-500 font-mono truncate">{url}</p>
      </div>
      <ExternalLink size={14} className="text-gray-500 group-hover:text-neon-green transition-colors shrink-0" />
    </a>
  );
}
