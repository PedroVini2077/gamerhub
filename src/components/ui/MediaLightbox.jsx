import { createPortal } from 'react-dom';
import { X, ZoomIn } from 'lucide-react';

export default function MediaLightbox({ src, type, title, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.95)', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm font-mono text-gray-400 truncate">{title}</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-dark-600 border border-dark-400 flex items-center justify-center text-gray-400 hover:text-white shrink-0 ml-3"
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="rounded-xl overflow-hidden border border-dark-400" style={{ boxShadow: '0 0 40px #39ff1415' }}>
          {type === 'image' && (
            <img
              src={src}
              alt={title}
              className="w-full h-auto max-h-screen object-contain"
              style={{ maxHeight: '80vh' }}
            />
          )}
          {type === 'video' && (
            <video
              src={src}
              controls
              autoPlay
              playsInline
              className="w-full"
              style={{ maxHeight: '80vh' }}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-600 font-mono mt-3">
          Clique fora para fechar
        </p>
      </div>
    </div>,
    document.body
  );
}
