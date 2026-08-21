import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfileForm } from '../hooks/useProfileForm';
import { useProfileStats } from '../hooks/useProfileStats';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { getSubRankProgress, RANK_TIERS, getBorderForProfile } from '../lib/ranks';
import AdminApplicationCard from '../components/profile/AdminApplicationCard';
import AvatarModal from '../components/profile/AvatarModal';
import ProfileIdentityCard from '../components/profile/ProfileIdentityCard';
import PlayerStatsCard from '../components/profile/PlayerStatsCard';
import PersonalInfoCard from '../components/profile/PersonalInfoCard';
import GamingCard from '../components/profile/GamingCard';
import SocialLinksCard from '../components/profile/SocialLinksCard';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [showFull, setShowFull] = useState(false);

  const { form, setField, saving, save, maxBirthDate } =
    useProfileForm({ user, profile, refreshProfile });
  const { stats, xpData } = useProfileStats(user?.id);
  const { avatarUrl, uploading, fileRef, handleAvatarUpload } =
    useAvatarUpload({ user, profile, refreshProfile });

  const isOwner  = profile?.role === 'owner';
  const rank     = getBorderForProfile(profile, xpData?.xp ?? null);
  const progress = (!isOwner && xpData) ? getSubRankProgress(xpData.xp) : null;
  const nextTier = (!isOwner && rank) ? RANK_TIERS.find(t => t.minXP > rank.minXP) : null;

  if (!user) return (
    <div className="max-w-md mx-auto card p-10 text-center mt-10">
      <p className="text-gray-400 mb-4 font-mono text-sm">Você precisa estar logado.</p>
      <Link to="/login" className="btn-solid">Fazer Login</Link>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {showFull && avatarUrl && (
        <AvatarModal avatarUrl={avatarUrl} profile={profile} onClose={() => setShowFull(false)} />
      )}

      <ProfileIdentityCard
        user={user} profile={profile} rank={rank} isOwner={isOwner}
        avatarUrl={avatarUrl} uploading={uploading} fileRef={fileRef}
        onAvatarChange={handleAvatarUpload} onOpenAvatar={() => setShowFull(true)}
        form={form} setField={setField}
      />

      <PlayerStatsCard
        stats={stats} xpData={xpData} rank={rank}
        progress={progress} nextTier={nextTier} isOwner={isOwner}
      />

      {/* Candidatura a admin — só faz sentido pra quem ainda é usuário comum */}
      {profile?.role === 'user' && <AdminApplicationCard userId={user.id} />}

      <PersonalInfoCard form={form} setField={setField} maxBirthDate={maxBirthDate} />
      <GamingCard form={form} setField={setField} />
      <SocialLinksCard form={form} setField={setField} />

      <div className="pb-4">
        <button onClick={save} disabled={saving} className="btn-solid w-full flex items-center justify-center gap-2 py-3">
          <Save size={14} />
          {saving ? 'Salvando...' : 'Salvar Perfil'}
        </button>
      </div>
    </div>
  );
}
