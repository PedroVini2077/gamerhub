import { X } from 'lucide-react';

const ROLE_TAG = { super_admin: 'tag-green', admin: 'tag-purple' };

/** Foto de perfil ampliada, com nome, cargo e bio. */
export default function AvatarModal({ avatarUrl, profile, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-72 rounded-2xl overflow-hidden border border-neon-green/20 animate-fade-up"
        style={{ boxShadow: '0 0 40px #39ff1420' }} onClick={e => e.stopPropagation()}>
        <div className="relative">
          <div className="absolute inset-0 grid-bg opacity-60" />
          <img src={avatarUrl} alt="avatar" className="w-full h-64 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-dark-800 via-transparent to-transparent" />
        </div>
        <div className="bg-dark-800 px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-lg font-bold text-white">{profile?.username}</h3>
            <span className={`tag ${ROLE_TAG[profile?.role] || 'tag-cyan'}`}>{profile?.role || 'user'}</span>
          </div>
          {profile?.bio && <p className="text-xs text-gray-400 font-mono">{profile.bio}</p>}
        </div>
        <button aria-label="Fechar foto" onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-dark-800/80 flex items-center justify-center text-white hover:bg-dark-700 border border-dark-400">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
