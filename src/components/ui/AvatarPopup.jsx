import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { X, ExternalLink } from 'lucide-react';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };
const roleLabels = { user: 'Player', admin: 'Admin', super_admin: 'Super Admin' };

export default function AvatarPopup({ profile: initialProfile, size = 36, className = '' }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [stats, setStats] = useState({ posts: 0, likes: 0 });
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleOpen() {
    setOpen(o => !o);
    if (!open && initialProfile?.id) {
      const [{ data: fullProfile }, { count: postsCount }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', initialProfile.id).single(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', initialProfile.id),
      ]);
      if (fullProfile) setProfile(fullProfile);
      setStats({ posts: postsCount || 0, likes: 0 });
    }
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      {/* Avatar clicável */}
      <button onClick={handleOpen} className="block rounded-full focus:outline-none">
        <Avatar profile={profile} size={size} className={`cursor-pointer hover:ring-2 hover:ring-neon-green/50 transition-all ${className}`} />
      </button>

      {/* Popup */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 animate-fade-up" style={{ width: 220 }}>
            <div className="bg-dark-700 border border-dark-400 rounded-xl overflow-hidden shadow-xl"
              style={{ boxShadow: '0 0 30px #39ff1415' }}>

              {/* Foto grande circular */}
              <div className="flex justify-center pt-5 pb-3 bg-dark-800 relative">
                <div className="absolute inset-0 grid-bg opacity-30" />
                <div className="relative">
                  <Avatar
                    profile={profile}
                    size={72}
                    className="ring-2 ring-neon-green/30"
                    style={{ boxShadow: '0 0 20px #39ff1420' }}
                  />
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-gray-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Info */}
              <div className="px-4 py-3 text-center border-b border-dark-500">
                <p className="font-display font-bold text-white text-base mb-1">
                  {profile?.username}
                </p>
                <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'}`}>
                  {roleLabels[profile?.role] || 'Player'}
                </span>
                {profile?.bio && (
                  <p className="text-xs text-gray-400 font-mono mt-2 leading-relaxed">
                    {profile.bio}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 divide-x divide-dark-500 border-b border-dark-500">
                {[
                  { label: 'Posts', value: stats.posts, color: 'text-neon-green' },
                  { label: 'Membro', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) : '—', color: 'text-neon-cyan' },
                ].map(s => (
                  <div key={s.label} className="py-2 text-center">
                    <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-600 font-mono">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Ver perfil */}
              <div className="p-3">
                <Link
                  to={`/u/${profile?.username}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center gap-2 w-full btn-neon py-2 text-xs"
                >
                  Ver perfil completo <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
