import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { X, ExternalLink } from 'lucide-react';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };
const roleLabels = { user: 'Player', admin: 'Admin', super_admin: 'Super Admin' };

export default function AvatarPopup({ profile: initialProfile, size = 36, className = '' }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [stats, setStats] = useState({ posts: 0 });
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (initialProfile?.id) {
      setLoading(true);
      const [{ data: fullProfile }, { count: postsCount }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', initialProfile.id).single(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', initialProfile.id),
      ]);
      if (fullProfile) setProfile(fullProfile);
      setStats({ posts: postsCount || 0 });
      setLoading(false);
    }
  }

  return (
    <>
      {/* Avatar clicável */}
      <button onClick={handleOpen} className="block rounded-full focus:outline-none shrink-0">
        <Avatar
          profile={initialProfile}
          size={size}
          className={`cursor-pointer hover:ring-2 hover:ring-neon-green/50 transition-all ${className}`}
        />
      </button>

      {/* Modal centralizado via Portal */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-72 rounded-2xl overflow-hidden border border-dark-400 animate-fade-up"
            style={{ boxShadow: '0 0 40px #39ff1420' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header com foto */}
            <div className="relative bg-dark-800 pt-8 pb-6 flex flex-col items-center">
              <div className="absolute inset-0 grid-bg opacity-40" />
              <div className="relative">
                <Avatar
                  profile={profile}
                  size={88}
                  className="ring-2 ring-neon-green/40"
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-dark-600/90 border border-dark-400 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Info */}
            <div className="bg-dark-700 px-5 py-4 text-center border-b border-dark-500">
              {loading ? (
                <div className="h-4 bg-dark-500 rounded w-1/2 mx-auto animate-pulse mb-2" />
              ) : (
                <>
                  <h3 className="font-display text-xl font-bold text-white mb-2">
                    {profile?.username}
                  </h3>
                  <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'}`}>
                    {roleLabels[profile?.role] || 'Player'}
                  </span>
                  {profile?.bio && (
                    <p className="text-xs text-gray-400 font-mono mt-3 leading-relaxed">
                      {profile.bio}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Stats */}
            <div className="bg-dark-700 grid grid-cols-2 divide-x divide-dark-500 border-b border-dark-500">
              <div className="py-3 text-center">
                <p className="text-lg font-bold font-mono text-neon-green">{stats.posts}</p>
                <p className="text-xs text-gray-500 font-mono">Posts</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-sm font-bold font-mono text-neon-cyan">
                  {loading ? '...' : profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
                    : '—'}
                </p>
                <p className="text-xs text-gray-500 font-mono">Membro desde</p>
              </div>
            </div>

            {/* Botão ver perfil */}
            <div className="bg-dark-700 p-4">
              <Link
                to={`/u/${profile?.username}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 w-full btn-neon py-2.5 text-xs"
              >
                Ver perfil completo <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
