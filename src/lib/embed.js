import { isSafeExternalUrl } from './url';

// Detecção de provedor de embed a partir da URL (YouTube, Twitch, TikTok, etc.).
// Fica em lib/ (e não no componente EmbedPlayer) para poder ser usado também
// por services sem acoplar acesso a dados a um componente de UI.
//
// Retorna `null` para qualquer coisa que não seja http(s) — o PostForm já
// tratava `null` como "link não suportado", mas antes esta função NUNCA
// devolvia null (caía sempre em `{type:'link'}`), o que tornava aquela
// validação letra morta e deixava `javascript:` chegar até um href.
export function getEmbedInfo(url) {
  if (!url || !isSafeExternalUrl(url)) return null;

  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', id: yt[1], label: 'YouTube', color: '#ff0000' };

  const twVod = url.match(/twitch\.tv\/videos\/(\d+)/);
  if (twVod) return { type: 'twitch-vod', id: twVod[1], label: 'Twitch VOD', color: '#9147ff' };

  const twClip = url.match(/twitch\.tv\/\w+\/clip\/(\w+)/);
  if (twClip) return { type: 'twitch-clip', id: twClip[1], label: 'Twitch Clip', color: '#9147ff' };

  const tw = url.match(/twitch\.tv\/(\w+)/);
  if (tw) return { type: 'twitch', id: tw[1], label: 'Twitch', color: '#9147ff' };

  const tt = url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/);
  if (tt) return { type: 'tiktok', id: tt[1], label: 'TikTok', color: '#ff0050' };

  const ig = url.match(/instagram\.com\/(p|reel|tv)\/([\w-]+)/);
  if (ig) return { type: 'instagram', id: ig[2], label: 'Instagram', color: '#e1306c' };

  return { type: 'link', label: 'Link externo', color: '#39ff14' };
}
