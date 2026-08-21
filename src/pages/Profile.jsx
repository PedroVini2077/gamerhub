import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.jsx';
import { useProfileForm } from '../hooks/useProfileForm';
import { useProfileStats } from '../hooks/useProfileStats';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { Save, Camera, X, MapPin, Gamepad2, MessageSquare, Swords, Trophy, Crown, ArrowRight } from 'lucide-react';
import { FaTwitch, FaYoutube, FaDiscord } from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import { getRankLabel, getSubRankProgress, RANK_TIERS, getBorderForProfile } from '../lib/ranks';
import AdminApplicationCard from '../components/profile/AdminApplicationCard';

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const PLATFORMS  = ['PC','PlayStation','Xbox','Mobile','Switch','Multi'];
const PLAYSTYLES = [
  { value: 'casual',      label: 'Casual',      desc: 'Jogo por diversão' },
  { value: 'competitivo', label: 'Competitivo',  desc: 'Foco em ranking' },
  { value: 'ambos',       label: 'Ambos',        desc: 'Depende do dia' },
];

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [showFull, setShowFull] = useState(false);

  const { form, setField, saving, save, maxBirthDate } =
    useProfileForm({ user, profile, refreshProfile });
  const { stats, xpData } = useProfileStats(user?.id);
  const { avatarUrl, uploading, fileRef, handleAvatarUpload } =
    useAvatarUpload({ user, profile, refreshProfile });

  const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };

  const isOwner  = profile?.role === 'owner';
  const rank     = getBorderForProfile(profile, xpData?.xp ?? null);
  const progress = (!isOwner && xpData) ? getSubRankProgress(xpData.xp) : null;
  const RankIcon = rank?.icon;
  const nextTier = (!isOwner && rank) ? RANK_TIERS.find(t => t.minXP > rank.minXP) : null;

  if (!user) return (
    <div className="max-w-md mx-auto card p-10 text-center mt-10">
      <p className="text-gray-400 mb-4 font-mono text-sm">Você precisa estar logado.</p>
      <Link to="/login" className="btn-solid">Fazer Login</Link>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Modal foto grande */}
      {showFull && avatarUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowFull(false)}>
          <div className="relative w-72 rounded-2xl overflow-hidden border border-neon-green/20 animate-fade-up"
            style={{ boxShadow: "0 0 40px #39ff1420" }} onClick={e => e.stopPropagation()}>
            <div className="relative">
              <div className="absolute inset-0 grid-bg opacity-60" />
              <img src={avatarUrl} alt="avatar" className="w-full h-64 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-800 via-transparent to-transparent" />
            </div>
            <div className="bg-dark-800 px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-lg font-bold text-white">{profile?.username}</h3>
                <span className={`tag ${profile?.role === "super_admin" ? "tag-green" : profile?.role === "admin" ? "tag-purple" : "tag-cyan"}`}>{profile?.role || "user"}</span>
              </div>
              {profile?.bio && <p className="text-xs text-gray-400 font-mono">{profile.bio}</p>}
            </div>
            <button onClick={() => setShowFull(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-dark-800/80 flex items-center justify-center text-white hover:bg-dark-700 border border-dark-400">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Card do perfil — avatar + bio */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative shrink-0">
            <div
              className="w-16 h-16 rounded-full overflow-hidden bg-dark-400 flex items-center justify-center cursor-pointer"
              style={{
                border: rank ? `${rank.borderWidth ?? 2}px solid ${rank.color}` : '2px solid #39ff1440',
                boxShadow: rank ? `0 0 18px ${rank.glow}` : '0 0 18px #39ff1420',
              }}
              onClick={() => avatarUrl && setShowFull(true)}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <span className="font-display text-2xl font-bold" style={{ color: rank?.color || '#39ff14' }}>{profile?.username?.[0]?.toUpperCase() || '?'}</span>
              }
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Trocar foto"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-dark-600 border border-neon-green/40 flex items-center justify-center hover:bg-neon-green/10 transition-colors">
              {uploading
                ? <span className="w-3 h-3 border border-neon-green border-t-transparent rounded-full animate-spin" />
                : <Camera size={11} className="text-neon-green" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold text-white">{profile?.username || '...'}</h2>
            <p className="text-xs text-gray-500 font-mono truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'}`}>{profile?.role || 'user'}</span>
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
          <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">Bio</label>
          <textarea id="bio" aria-label="Bio do perfil" className="input-gamer resize-none w-full" rows={3}
            placeholder="Fale um pouco sobre você..." value={form.bio}
            onChange={e => setField('bio', e.target.value)} maxLength={200} />
          <p className="text-xs text-gray-600 font-mono mt-1 text-right">{form.bio.length}/200</p>
        </div>
      </div>

      {/* Stats + Rank */}
      <div className="card p-4 space-y-3">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
          <Trophy size={12} />Stats do Jogador
        </h3>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Posts',  value: stats.posts, color: 'text-neon-green' },
            { label: 'Likes',  value: stats.likes, color: 'text-neon-purple' },
            { label: 'XP',     value: xpData?.xp ?? '—', color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-dark-700 rounded p-3 border border-dark-400">
              <p className={`font-display text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 font-mono">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rank / Fundador + barra de progresso */}
        {rank && (
          <div className="bg-dark-700 rounded-lg p-3 border border-dark-400 space-y-2"
            style={isOwner ? { borderColor: `${rank.color}30`, boxShadow: `0 0 12px ${rank.glow}` } : {}}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {RankIcon && <RankIcon size={13} style={{ color: rank.color }} />}
                <span className="text-sm font-display font-bold" style={{ color: rank.color }}>
                  {isOwner ? 'Fundador — Criador da plataforma' : getRankLabel(rank)}
                </span>
              </div>
              {!isOwner && (
                <Link to="/ranks" className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors">
                  ver todos <ArrowRight size={11} className="inline align-[-1px]" />
                </Link>
              )}
            </div>

            {!isOwner && progress && (
              progress.needed != null ? (
                <>
                  <div className="w-full h-1.5 bg-dark-500 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                      style={{ background: rank.color, boxShadow: `0 0 6px ${rank.glow}` }}
                    />
                  </div>
                  <p className="text-xs font-mono text-gray-500">
                    {progress.current} / {progress.needed} XP
                    {nextTier && rank.subRank === rank.subRanks && (
                      <span className="text-gray-600"> · próximo: {nextTier.label}</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-xs font-mono flex items-center gap-1" style={{ color: rank.color }}>
                  <Crown size={11} /> Rank máximo atingido!
                </p>
              )
            )}
          </div>
        )}
      </div>

      {/* Candidatura a admin — só faz sentido pra quem ainda é usuário comum */}
      {profile?.role === 'user' && <AdminApplicationCard userId={user.id} />}

      {/* Informações pessoais */}
      <div className="card p-5 space-y-4">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
          <MapPin size={12} />Informações
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Nascimento</label>
            <input aria-label="Data de nascimento" type="date"
              className="input-gamer w-full text-sm" value={form.birth_date}
              onChange={e => setField('birth_date', e.target.value)} max={maxBirthDate} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Estado</label>
            <select aria-label="Estado" className="input-gamer w-full text-sm appearance-none"
              value={form.state} onChange={e => setField('state', e.target.value)}>
              <option value="" className="bg-dark-800">— UF —</option>
              {BR_STATES.map(s => <option key={s} value={s} className="bg-dark-800">{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Gaming */}
      <div className="card p-5 space-y-4">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
          <Gamepad2 size={12} />Gaming
        </h3>

        <div>
          <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">Plataforma Principal</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button key={p} type="button" onClick={() => setField('platform', form.platform === p ? '' : p)}
                className={`tag cursor-pointer transition-all flex items-center gap-1 ${form.platform === p ? 'tag-green' : 'tag-purple opacity-50 hover:opacity-100'}`}>
                <Gamepad2 size={10} />{p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">Estilo de Jogo</label>
          <div className="grid grid-cols-3 gap-2">
            {PLAYSTYLES.map(ps => (
              <button key={ps.value} type="button" onClick={() => setField('playstyle', form.playstyle === ps.value ? '' : ps.value)}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  form.playstyle === ps.value
                    ? 'border-neon-green/50 bg-neon-green/10 text-neon-green'
                    : 'border-dark-400 text-gray-500 hover:border-dark-300'
                }`}>
                <p className="text-xs font-display font-bold">{ps.label}</p>
                <p className="text-xs font-mono text-gray-600 mt-0.5" style={{ fontSize: 10 }}>{ps.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">
            Jogos Favoritos
          </label>
          <div className="flex items-start bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
            <span className="pl-3 pr-2 pt-2.5 text-gray-500 shrink-0"><Swords size={14} /></span>
            <textarea aria-label="Jogos favoritos" className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body resize-none"
              rows={2} placeholder="Ex: CS2, Valorant, Minecraft..." value={form.favorite_games}
              onChange={e => setField('favorite_games', e.target.value)} maxLength={200} />
          </div>
        </div>
      </div>

      {/* Redes Sociais */}
      <div className="card p-5 space-y-3">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
          <MessageSquare size={12} />Redes Sociais
        </h3>

        {[
          { icon: FaDiscord, label: 'Discord', placeholder: 'usuario#0000 ou usuario', name: 'discord' },
          { icon: FaTwitch,  label: 'Twitch',  placeholder: 'seu canal da Twitch',      name: 'twitch' },
          { icon: FaYoutube, label: 'YouTube', placeholder: 'seu canal do YouTube',      name: 'youtube' },
        ].map(({ icon: Icon, label, placeholder, name }) => (
          <div key={label}>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">{label}</label>
            <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
              <span className="pl-3 pr-2 text-gray-500 shrink-0"><Icon size={14} /></span>
              <input aria-label={label} className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                placeholder={placeholder} value={form[name]} onChange={e => setField(name, e.target.value)} maxLength={100} />
            </div>
          </div>
        ))}
      </div>

      {/* Botão salvar tudo */}
      <div className="pb-4">
        <button onClick={save} disabled={saving} className="btn-solid w-full flex items-center justify-center gap-2 py-3">
          <Save size={14} />
          {saving ? 'Salvando...' : 'Salvar Perfil'}
        </button>
      </div>
    </div>
  );
}
