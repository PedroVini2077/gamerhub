import { X, AlertTriangle } from 'lucide-react';
import EmbedPlayer from '../../ui/EmbedPlayer';
import { getEmbedInfo } from '../../../lib/embed';

// Só estes transmitem ao vivo de verdade dentro do embed.
const LIVE_CAPABLE = ['twitch', 'youtube'];

const isHttpUrl = url => /^https?:\/\//.test(url);

/** Campo de link externo com prévia e a opção de marcar como live. */
export default function EmbedComposer({ embedUrl, setEmbedUrl, isLive, setIsLive, onClose }) {
  const valid = !!embedUrl && isHttpUrl(embedUrl);
  const canBeLive = valid && LIVE_CAPABLE.includes(getEmbedInfo(embedUrl)?.type);

  return (
    <div className="mb-3 border border-dark-400 rounded-lg p-3 bg-dark-700">
      <div className="flex gap-2 mb-2">
        <input aria-label="Link externo" className="input-gamer flex-1 text-sm"
          placeholder="Cole o link do YouTube, Twitch, TikTok..."
          value={embedUrl} onChange={e => setEmbedUrl(e.target.value)} />
        <button aria-label="Remover link" onClick={onClose}
          className="text-gray-500 hover:text-red-400 transition-colors p-2">
          <X size={16} />
        </button>
      </div>

      {embedUrl && !valid && (
        <p className="text-xs font-mono text-red-400/80 mb-2 flex items-center gap-1">
          <AlertTriangle size={11} />Cole um link válido começando com https://
        </p>
      )}

      {canBeLive && (
        <div className="mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isLive} onChange={e => setIsLive(e.target.checked)}
              className="w-4 h-4 accent-neon-green" />
            <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Marcar como Live
            </span>
          </label>
        </div>
      )}

      {valid && <EmbedPlayer url={embedUrl} isLive={isLive} />}
    </div>
  );
}
