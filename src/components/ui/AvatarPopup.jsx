import { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { X, ExternalLink } from 'lucide-react';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };
const roleLabels = { user: 'Player', admin: 'Admin', super_admin: 'Super Admin' };

export default function AvatarPopup({ profile: initialProfile, userId, size = 36, className = '' }) {
  const [open, setOpen] = useState(false);
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (fullData) return; // já carregou antes
    setLoading(true);

    // tenta por userId primeiro, depois por username
    const id = userId || initialProfile?.id;
    const username = initialProfile?.username;

    let profileData = null;
    let postsCount = 0;

    if (id) {
      const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      profileData = data;
    }

    if (!profileData && username) {
      const { data } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
      profileData = data;
    }

    if (profileData) {
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileData.id);
      postsCount = count || 0;
      setFullData({ ...profileData, postsCount });
    }

    setLoading(false);
  }

  const display = fullData || initialProfile;

  return (
    <>
      <button onClick={handleOpen} className="block rounded-full focus:outline-none shrink-0">
        <Avatar
          profile={initialProfile}
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
            className="relative w-72 rounded-2xl overflow-hidden border border-dark-400 animate-fade-up"
            style={{ boxShadow: '0 0 40px #39ff1420' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="relative bg-dark-800 pt-8 pb-6 flex flex-col items-center">
              <div className="absolute inset-0 grid-bg opacity-40" />
              <div className="relative">
                <Avatar profile={display} size={88} className="ring-2 ring-neon-green/40" />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-dark-600/90 border border-dark-400 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <div className="bg-dark-700 px-5 py-4 text-center border-b border-dark-500">
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-5 bg-dark-500 rounded w-1/2 mx-auto" />
                  <div className="h-4 bg-dark-500 rounded w-1/3 mx-auto" />
                </div>
              ) : (
                <>
                  <h3 className="font-display text-xl font-bold text-white mb-2">{display?.username}</h3>
                  <span className={`tag ${roleColors[display?.role] || 'tag-cyan'}`}>
                    {roleLabels[display?.role] || 'Player'}
                  </span>
                  {fullData?.bio && (
                    <p className="text-xs text-gray-400 font-mono mt-3 leading-relaxed">{fullData.bio}</p>
                  )}
                </>
              )}
            </div>

            <div className="bg-dark-700 grid grid-cols-2 divide-x divide-dark-500 border-b border-dark-500">
              <div className="py-3 text-center">
                <p className="text-lg font-bold font-mono text-neon-green">
                  {loading ? '...' : (fullData?.postsCount ?? '—')}
                </p>
                <p className="text-xs text-gray-500 font-mono">Posts</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-sm font-bold font-mono text-neon-cyan">
                  {loading ? '...' : fullData?.created_at
                    ? new Date(fullData.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
                    : '—'}
                </p>
                <p className="text-xs text-gray-500 font-mono">Membro desde</p>
              </div>
            </div>

            <div className="bg-dark-700 p-4">
              <Link
                to={`/u/${display?.username}`}
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
