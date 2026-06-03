import { useState, useRef, useEffect } from 'react';
import { Maximize2, Film, Music, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import MediaPlayer from './MediaPlayer';
import MediaLightbox from './MediaLightbox';

function VideoPlayer({ src }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative bg-dark-900">
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center z-10 bg-dark-900">
          <Film size={28} className="text-neon-green/60" />
          <p className="text-neon-green font-mono text-sm">Vídeo não compatível</p>
          <p className="text-gray-500 font-mono text-xs">Seu navegador não conseguiu reproduzir este vídeo.</p>
          <a href={src} download className="btn-neon py-2 px-4 text-xs inline-flex items-center gap-1.5"><Download size={13} />Baixar vídeo</a>
        </div>
      )}
      <video
        key={src}
        className="w-full"
        style={{ maxHeight: 400, display: 'block', background: '#060608', opacity: failed ? 0 : 1 }}
        controls playsInline preload="metadata"
        onError={() => setFailed(true)}
      >
        <source src={src} type="video/mp4" />
        <source src={src} type="video/webm" />
        <source src={src} />
      </video>
    </div>
  );
}

export default function MediaCarousel({ items, postTitle }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  if (!items || items.length === 0) return null;

  const current = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 40 && dy < 60) {
      if (dx < 0 && hasNext) setIndex(i => i + 1);
      if (dx > 0 && hasPrev) setIndex(i => i - 1);
    }
    touchStartX.current = null;
  }

  const mouseStartX = useRef(null);
  function handleMouseDown(e) { mouseStartX.current = e.clientX; }
  function handleMouseUp(e) {
    if (mouseStartX.current === null) return;
    const dx = e.clientX - mouseStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && hasNext) setIndex(i => i + 1);
      if (dx > 0 && hasPrev) setIndex(i => i - 1);
    }
    mouseStartX.current = null;
  }

  return (
    <div className="mt-3">
      {lightbox && (current.type === 'image' || current.type === 'video') && (
        <MediaLightbox src={current.url} type={current.type} title={postTitle} onClose={() => setLightbox(false)} />
      )}

      <div
        className="relative rounded-lg overflow-hidden border border-dark-400 bg-dark-900 select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={!isMobile ? handleMouseDown : undefined}
        onMouseUp={!isMobile ? handleMouseUp : undefined}
        style={{ cursor: items.length > 1 && !isMobile ? 'grab' : 'default' }}
      >
        {current.type === 'image' && (
          <div
            className="relative group cursor-pointer bg-dark-900 flex items-center justify-center"
            style={{ minHeight: 200, maxHeight: 500 }}
            onClick={() => setLightbox(true)}
          >
            <img
              src={current.url}
              alt={postTitle}
              className="w-full h-auto object-contain"
              style={{ maxHeight: 500 }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <Maximize2 size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        {current.type === 'video' && (
          <VideoPlayer src={current.url} />
        )}

        {current.type === 'audio' && (
          <div className="bg-dark-800 p-1">
            <MediaPlayer src={current.url} title={postTitle} />
          </div>
        )}

        {/* Setas — só no desktop */}
        {!isMobile && hasPrev && (
          <button
            onClick={() => setIndex(i => i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark-800/90 border border-dark-400 flex items-center justify-center text-white hover:bg-dark-700 transition-colors z-10"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {!isMobile && hasNext && (
          <button
            onClick={() => setIndex(i => i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark-800/90 border border-dark-400 flex items-center justify-center text-white hover:bg-dark-700 transition-colors z-10"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* Indicadores */}
        {items.length > 1 && (
          <>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {items.map((_, i) => (
                <button key={i} onClick={() => setIndex(i)} className="rounded-full transition-all"
                  style={{ width: i === index ? 16 : 6, height: 6,
                    background: i === index ? '#39ff14' : 'rgba(255,255,255,0.4)' }} />
              ))}
            </div>
            <div className="absolute top-2 right-2 bg-dark-800/80 rounded px-2 py-0.5 z-10">
              <span className="text-xs font-mono text-gray-300">{index + 1}/{items.length}</span>
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {items.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {items.map((item, i) => (
            <button key={i} onClick={() => setIndex(i)}
              className="shrink-0 rounded overflow-hidden border transition-all"
              style={{ width: 48, height: 48,
                borderColor: i === index ? '#39ff14' : '#2e2e3e',
                boxShadow: i === index ? '0 0 8px #39ff1440' : 'none' }}>
              {item.type === 'image'
                ? <img src={item.url} className="w-full h-full object-cover" />
                : item.type === 'video'
                ? <div className="w-full h-full bg-dark-700 flex items-center justify-center"><Film size={16} className="text-neon-green" /></div>
                : <div className="w-full h-full bg-dark-700 flex items-center justify-center"><Music size={16} className="text-neon-green" /></div>
              }
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
