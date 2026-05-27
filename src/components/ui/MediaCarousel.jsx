import { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Film, Music } from 'lucide-react';
import MediaPlayer from './MediaPlayer';
import MediaLightbox from './MediaLightbox';

export default function MediaCarousel({ items, postTitle }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (!items || items.length === 0) return null;

  const current = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  return (
    <div className="mt-3">
      {lightbox && (current.type === 'image' || current.type === 'video') && (
        <MediaLightbox
          src={current.url}
          type={current.type}
          title={postTitle}
          onClose={() => setLightbox(false)}
        />
      )}

      <div className="relative rounded-lg overflow-hidden border border-dark-400 bg-dark-900">

        {current.type === 'image' && (
          <div className="relative group cursor-pointer" onClick={() => setLightbox(true)}>
            <img
              src={current.url}
              alt={postTitle}
              className="w-full object-contain"
              style={{ maxHeight: '400px', background: '#060608' }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <Maximize2 size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {current.type === 'video' && (
          <div className="relative bg-dark-900">
            <video
              key={current.url}
              className="w-full"
              style={{ maxHeight: '400px', display: 'block', background: '#060608' }}
              controls
              playsInline
              preload="metadata"
              controlsList="nodownload"
            >
              <source src={current.url} type="video/mp4" />
              <source src={current.url} type="video/webm" />
              <source src={current.url} type="video/ogg" />
              <source src={current.url} />
            </video>
          </div>
        )}

        {current.type === 'audio' && (
          <div className="bg-dark-800 p-1">
            <MediaPlayer src={current.url} title={postTitle} />
          </div>
        )}

        {/* Navegação */}
        {hasPrev && (
          <button
            onClick={() => setIndex(i => i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark-800/90 border border-dark-400 flex items-center justify-center text-white hover:bg-dark-700 transition-colors z-10"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => setIndex(i => i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark-800/90 border border-dark-400 flex items-center justify-center text-white hover:bg-dark-700 transition-colors z-10"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* Indicadores */}
        {items.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 16 : 6,
                  height: 6,
                  background: i === index ? '#39ff14' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </div>
        )}

        {/* Contador */}
        {items.length > 1 && (
          <div className="absolute top-2 right-2 bg-dark-800/80 rounded px-2 py-0.5 z-10">
            <span className="text-xs font-mono text-gray-300">{index + 1}/{items.length}</span>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {items.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="shrink-0 rounded overflow-hidden border transition-all"
              style={{
                width: 48, height: 48,
                borderColor: i === index ? '#39ff14' : '#2e2e3e',
                boxShadow: i === index ? '0 0 8px #39ff1440' : 'none',
              }}
            >
              {item.type === 'image' && (
                <img src={item.url} className="w-full h-full object-cover" />
              )}
              {item.type === 'video' && (
                <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                  <Film size={16} className="text-neon-green" />
                </div>
              )}
              {item.type === 'audio' && (
                <div className="w-full h-full bg-dark-700 flex items-center justify-center">
                  <Music size={16} className="text-neon-green" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
