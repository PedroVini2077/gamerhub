import { useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from './Avatar';
import { X } from 'lucide-react';

export default function AvatarPopup({ profile, userId, size = 36, className = '' }) {
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
            className="relative w-64 rounded-2xl overflow-hidden border border-dark-400 p-8 text-center bg-dark-700"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-dark-600 border border-dark-400 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
            <p className="font-display text-neon-green text-sm tracking-widest">COMING SOON</p>
            <p className="text-xs text-gray-500 font-mono mt-2">{profile?.username}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
