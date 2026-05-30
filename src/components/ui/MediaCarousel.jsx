import { useState, useRef, useEffect } from 'react';
import { Maximize2, Film, Music } from 'lucide-react';
import MediaPlayer from './MediaPlayer';
import MediaLightbox from './MediaLightbox';

function VideoPlayer({ src }) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const v = videoRef.current;
      if (v && v.readyState === 0) setFailed(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [src]);

  if (failed) return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center bg-dark-900" style={{ minHeight: 200 }}>
      <p className="text-2xl">⚠️</p>
      <p className="text-neon-green font-mono text-sm">Codec não suportado</p>
      <p className="text-gray-500 font-mono text-xs">Este vídeo não é compatível com seu navegador.</p>
      <a href={src} download className="btn-neon py-2 px-4 text-xs mt-1 inline-block">Baixar vídeo</a>
    </div>
  );

  return (
    <div className="relative bg-dark-900">
      <video
        ref={videoRef}
        key={src}
        className="w-full"
        style={{ maxHeight: 400, display: 'block', background: '#060608' }}
        controls playsInline preload="auto" controlsList="nodownload"
        onError={() => setFailed(true)}
        onCanPlay={() => setFailed(false)}
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

  if (!items || items.length === 0) return null;

  const current = items[index];

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 40 && dy < 60) {
      if (dx < 0 && index < items.length - 1) setIndex(i => i + 1);
      if (dx > 0 && index > 0) setIndex(i => i - 1);
    }
    touchStartX.current = null;
  }

  // Mouse drag (desktop)
  const mouseStartX = useRef(null);
  function handleMouseDown(e) { mouseStartX.current = e.clientX; }
  function handleMouseUp(e) {
    if (mouseStartX.current === null) return;
    const dx = e.clientX - mouseStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && index < items.length - 1) setIndex(i => i + 1);
      if (dx > 0 && index > 0) setIndex(i => i - 1);
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
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{ cursor: items.length > 1 ? 'grab' : 'default' }}
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
  <VideoPlayer src={current.url} onExpand={() => setLightbox(true)} />
)}

        {current.type === 'audio' && (
          <div className="bg-dark-800 p-1">
            <MediaPlayer src={current.url} title={postTitle} />
          </div>
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
