import { useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from './Avatar';
import { X } from 'lucide-react';

export default function AvatarPopup({ profile, size = 36, className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="block rounded-full focus:outline-none shrink-0">
        <Avatar
          profile={profile}
          size={size}
          className={`cursor-pointer hover:ring-2 hover:ring-neon-green/50 transition-all ${className}`}
        />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', zIndex: 9999 }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-72 rounded-2xl overflow-hidden border border-dark-400 bg-dark-700 animate-fade-up"
            style={{ boxShadow: '0 0 40px #39ff1420' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="relative bg-dark-800 pt-8 pb-6 flex flex-col items-center">
              <div className="absolute inset-0 grid-bg opacity-40" />
              <Avatar profile={profile} size={88} className="relative ring-2 ring-neon-green/40" />
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-dark-600/90 border border-dark-400 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 text-center">
              <h3 className="font-display text-xl font-bold text-white">{profile?.username}</h3>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
