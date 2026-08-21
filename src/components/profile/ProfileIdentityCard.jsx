import { Camera } from 'lucide-react';
import { getRankLabel } from '../../lib/ranks';
import { roleTag } from '../../lib/roleLabels';

/** Avatar (com troca de foto), nome, cargo, rank e o campo de bio. */
export default function ProfileIdentityCard({
  user, profile, rank, isOwner,
  avatarUrl, uploading, fileRef, onAvatarChange, onOpenAvatar,
  form, setField,
}) {
  const RankIcon = rank?.icon;

  return (
    <div className="card p-6">
      <div className="flex items-center gap-4 mb-5">
        <div className="relative shrink-0">
          <div
            className="w-16 h-16 rounded-full overflow-hidden bg-dark-400 flex items-center justify-center cursor-pointer"
            style={{
              border: rank ? `${rank.borderWidth ?? 2}px solid ${rank.color}` : '2px solid #39ff1440',
              boxShadow: rank ? `0 0 18px ${rank.glow}` : '0 0 18px #39ff1420',
            }}
            onClick={() => avatarUrl && onOpenAvatar()}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : <span className="font-display text-2xl font-bold" style={{ color: rank?.color || '#39ff14' }}>{profile?.username?.[0]?.toUpperCase() || '?'}</span>
            }
          </div>
          <button aria-label="Trocar foto de perfil" title="Trocar foto"
            onClick={() => fileRef.current?.click()} disabled={uploading}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-dark-600 border border-neon-green/40 flex items-center justify-center hover:bg-neon-green/10 transition-colors">
            {uploading
              ? <span className="w-3 h-3 border border-neon-green border-t-transparent rounded-full animate-spin" />
              : <Camera size={11} className="text-neon-green" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-bold text-white">{profile?.username || '...'}</h2>
          <p className="text-xs text-gray-500 font-mono truncate">{user.email}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`tag ${roleTag(profile?.role)}`}>{profile?.role || 'user'}</span>
            {rank && (
              <span className="flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded border"
                style={{ color: rank.color, borderColor: `${rank.color}40`, background: `${rank.color}10` }}>
                {RankIcon && <RankIcon size={10} />}
                {isOwner ? 'Fundador' : getRankLabel(rank)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider" htmlFor="bio">Bio</label>
        <textarea id="bio" aria-label="Bio do perfil" className="input-gamer resize-none w-full" rows={3}
          placeholder="Fale um pouco sobre você..." value={form.bio}
          onChange={e => setField('bio', e.target.value)} maxLength={200} />
        <p className="text-xs text-gray-600 font-mono mt-1 text-right">{form.bio.length}/200</p>
      </div>
    </div>
  );
}
