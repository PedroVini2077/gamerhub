import { X, Mic, Music } from 'lucide-react';
import MediaPlayer from '../../ui/MediaPlayer';

/** Áudio anexado (gravado ou música), com campo de nome e prévia. */
export default function AudioAttachment({ audio, audioName, setAudioName, onRemove }) {
  const recorded = audio.type === 'recorded';

  return (
    <div className="mb-3 border border-neon-green/20 rounded-lg p-3 bg-dark-700 relative">
      <p className="text-xs font-mono text-neon-green mb-2 uppercase tracking-wider flex items-center gap-1.5">
        {recorded ? <><Mic size={12} />Áudio gravado</> : <><Music size={12} />Música</>}
      </p>
      <input aria-label="Nome do áudio" className="input-gamer mb-2 text-sm"
        placeholder="Nome do áudio / música..."
        value={audioName} onChange={e => setAudioName(e.target.value)} maxLength={80} />
      <MediaPlayer src={audio.preview} title={audioName || 'Áudio'} />
      <button aria-label="Remover áudio" onClick={onRemove}
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-gray-400 hover:text-white">
        <X size={12} />
      </button>
    </div>
  );
}
