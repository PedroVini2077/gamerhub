import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useUserXP } from '../../hooks/useUserXP';
import Avatar from './Avatar';
import BanModal from './BanModal';
import { X, ExternalLink, Ban } from 'lucide-react';
import { getRankLabel, getBorderForProfile } from '../../lib/ranks';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green', owner: 'tag-orange' };
const roleLabels = { user: 'Player', admin: 'Admin', super_admin: 'Super Admin', owner: 'Fundador' };
const ROLE_RANK  = { user: 1, admin: 2, super_admin: 3, owner: 4 };

export default function AvatarPopup({ profile, size = 36, className = '', postsCount, disablePopup = false, onBanned }) {
  const { profile: viewer } = useAuth();
  const xp = useUserXP(profile?.id);
  const [open, setOpen]       = useState(false);
  const [posts, setPosts]     = useState(postsCount);
  const [banModal, setBanModal] = useState(false);

  const canBan = viewer && profile &&
    viewer.id !== profile.id &&
    !profile.banned &&
    (ROLE_RANK[viewer.role] || 0) > (ROLE_RANK[profile.role] || 0);

  async function handleOpen() {
    setOpen(true);
    if (posts !== undefined || !profile?.id) return;
    const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', profile.id);
    setPosts(count || 0);
  }

  const rank = getBorderForProfile(profile, xp);
  const isOwner = profile?.role === 'owner';
  const RankIcon = rank?.icon;

  return (
    <>
      <button
        onClick={disablePopup ? undefined : handleOpen}
        className="block rounded-full focus:outline-none shrink-0"
        style={disablePopup ? { cursor: 'default' } : {}}
      >
        <Avatar
          profile={profile}
          size={size}
          className={`${!disablePopup ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
          rankBorder={rank}
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
            style={{ boxShadow: rank ? `0 0 40px ${rank.glow}` : '0 0 40px #39ff1420' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header com avatar */}
            <div className="relative bg-dark-800 pt-8 pb-6 flex flex-col items-center gap-2">
              <div className="absolute inset-0 grid-bg opacity-40" />
              <Avatar profile={profile} size={88} className="relative" rankBorder={rank} />
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-dark-600/90 border border-dark-400 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>

              {/* Badge de rank / Fundador */}
              {rank && (
                <div
                  className="relative flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold"
                  style={{ borderColor: `${rank.color}40`, color: rank.color, background: `${rank.color}12` }}
                >
                  {RankIcon && <RankIcon size={11} />}
                  {isOwner ? 'Fundador' : getRankLabel(rank)}
                  {!isOwner && xp != null && (
                    <span className="text-gray-500 font-normal ml-1">{xp} XP</span>
                  )}
                </div>
              )}
            </div>

            {/* Nome e role */}
            <div className="px-5 py-4 text-center border-b border-dark-500">
              <h3 className="font-display text-xl font-bold text-white mb-2">{profile?.username}</h3>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'}`}>
                  {roleLabels[profile?.role] || 'Player'}
                </span>
                {profile?.banned && <span className="tag tag-pink">banido</span>}
              </div>
              {profile?.bio && (
                <p className="text-xs text-gray-400 font-mono mt-3 leading-relaxed">{profile.bio}</p>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 divide-x divide-dark-500 border-b border-dark-500">
              <div className="py-3 text-center">
                <p className="text-xs text-gray-500 font-mono mb-1">Posts</p>
                <p className="text-lg font-bold font-mono text-neon-green">
                  {posts !== undefined ? posts : '...'}
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

            {/* Ações */}
            <div className="p-4 space-y-2">
              <Link
                to={`/u/${profile?.username}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 w-full btn-neon py-2.5 text-xs"
              >
                Ver perfil completo <ExternalLink size={12} />
              </Link>
              {canBan && (
                <button
                  onClick={() => { setOpen(false); setBanModal(true); }}
                  className="flex items-center justify-center gap-2 w-full py-2 text-xs font-mono text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-all"
                >
                  <Ban size={12} /> Banir usuário
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {banModal && (
        <BanModal
          target={profile}
          onClose={() => setBanModal(false)}
          onBanned={() => { onBanned?.(); }}
        />
      )}
    </>
  );
}
