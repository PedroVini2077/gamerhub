import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Avatar from './Avatar';
import { X, ExternalLink } from 'lucide-react';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };
const roleLabels = { user: 'Player', admin: 'Admin', super_admin: 'Super Admin' };

export default function AvatarPopup({ profile, size = 36, className = '' }) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState(null);

  async function handleOpen() {
    setOpen(true);
    if (extra || !profile?.id) return;

    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id);

    setExtra({ posts: count || 0 });
  }

  return (
    <>
      <button onClick={handleOpen} className="block rounded-full focus:outline-none shrink-0">
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

            <div className="px-5 py-4 text-center border-b border-dark-500">
              <h3 className="font-display text-xl font-bold text-white mb-2">{profile?.username}</h3>
              <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'}`}>
                {roleLabels[profile?.role] || 'Player'}
              </span>
              {profile?.bio && (
                <p className="text-xs text-gray-400 font-mono mt-3 leading-relaxed">{profile.bio}</p>
              )}
            </div>

            <div className="grid grid-cols-2 divide-x divide-dark-500 border-b border-dark-500">
              <div className="py-3 text-center">
                <p className="text-xs text-gray-500 font-mono mb-1">Posts</p>
                <p className="text-lg font-bold font-mono text-neon-green">
                  {extra ? extra.posts : '...'}
                </p>
              </div>
              <div className="py-3 text-center">
                <p className="text-xs text-gray-500 font-mono mb-1">Membro desde</p>
                <p className="text-sm font-bold font-mono text-neon-cyan">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
                    : '—'}
                </p>
              </div>
            </div>

            <div className="p-4">
              <Link
                to={`/u/${profile?.username}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 w-full btn-neon py-2.5 text-xs"
              >
                Ver perfil completo <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
