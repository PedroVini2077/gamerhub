import { X, Film } from 'lucide-react';

/** Miniaturas das mídias anexadas, com remoção individual. */
export default function MediaPreviewGrid({ medias, max, onRemove }) {
  return (
    <div className="mb-3 flex gap-2 flex-wrap">
      {medias.map((m, i) => (
        <div key={m.preview} className="relative rounded-lg overflow-hidden border border-dark-400 bg-dark-700"
          style={{ width: 72, height: 72 }}>
          {m.type === 'image'
            ? <img src={m.preview} alt={`Prévia da mídia ${i + 1}`} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <Film size={20} className="text-neon-green" />
                <span className="text-xs text-gray-500 font-mono">vídeo</span>
              </div>
          }
          <button aria-label={`Remover mídia ${i + 1}`} onClick={() => onRemove(i)}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-dark-800/90 flex items-center justify-center text-gray-400 hover:text-white">
            <X size={10} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-dark-800/80 text-center py-0.5">
            <span className="text-xs font-mono text-gray-400">{i + 1}</span>
          </div>
        </div>
      ))}
      <span className="text-xs text-gray-600 font-mono self-end pb-1">{medias.length}/{max}</span>
    </div>
  );
}
