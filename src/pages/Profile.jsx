import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';
import toast from 'react-hot-toast';
import { Save, Camera, X, MapPin, Gamepad2, MessageSquare, Swords } from 'lucide-react';
import { FaTwitch, FaYoutube, FaDiscord } from 'react-icons/fa6';
import { Link } from 'react-router-dom';

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const PLATFORMS  = ['PC','PlayStation','Xbox','Mobile','Switch','Multi'];
const PLAYSTYLES = [
  { value: 'casual',      label: 'Casual',      desc: 'Jogo por diversão' },
  { value: 'competitivo', label: 'Competitivo',  desc: 'Foco em ranking' },
  { value: 'ambos',       label: 'Ambos',        desc: 'Depende do dia' },
];

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [bio, setBio]                     = useState('');
  const [birthDate, setBirthDate]         = useState('');
  const [state, setState]                 = useState('');
  const [platform, setPlatform]           = useState('');
  const [playstyle, setPlaystyle]         = useState('');
  const [favoriteGames, setFavoriteGames] = useState('');
  const [discord, setDiscord]             = useState('');
  const [twitch, setTwitch]            = useState('');
  const [youtube, setYoutube]          = useState('');
  const [saving, setSaving]               = useState(false);
  const [stats, setStats]                 = useState({ posts: 0, likes: 0 });
  const [uploading, setUploading]         = useState(false);
  const [avatarUrl, setAvatarUrl]         = useState(null);
  const [showFull, setShowFull]           = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setBirthDate(profile.birth_date || '');
      setState(profile.state || '');
      setPlatform(profile.platform || '');
      setPlaystyle(profile.playstyle || '');
      setFavoriteGames(profile.favorite_games || '');
      setDiscord(profile.discord || '');
      setTwitch(profile.twitch || '');
      setYoutube(profile.youtube || '');
      setAvatarUrl(profile.avatar_url);
    }
    if (user) fetchStats();
  }, [profile, user]);

  async function fetchStats() {
    const { data } = await supabase.from('posts').select('likes').eq('user_id', user.id);
    if (data) {
      setStats({ posts: data.length, likes: data.reduce((s, p) => s + (p.likes || 0), 0) });
    }
  }

  async function compressImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
        else       { if (h > MAX) { w = w * MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => { URL.revokeObjectURL(url); resolve(new File([blob], file.name, { type: 'image/jpeg' })); }, 'image/jpeg', 0.85);
      };
      img.src = url;
    });
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) { toast.error('Formato inválido. Use JPG, PNG, WEBP ou GIF.'); return; }
    setUploading(true);
    toast.loading('Processando imagem...', { id: 'upload' });
    const compressed = await compressImage(file);
    const path = `${user.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) { toast.error('Erro ao fazer upload', { id: 'upload' }); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const finalUrl = publicUrl + '?t=' + Date.now();
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: finalUrl }).eq('id', user.id);
    if (updateError) { toast.error('Erro ao salvar avatar', { id: 'upload' }); }
    else {
      setAvatarUrl(finalUrl);
      await refreshProfile();
      toast.success('Avatar atualizado!', { id: 'upload' });
      logAudit('profile_avatar_updated', `@${profile?.username} atualizou o avatar`, { category: 'profile' });
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    const updates = {
      bio:            bio,
      birth_date:     birthDate || null,
      state:          state || null,
      platform:       platform || null,
      playstyle:      playstyle || null,
      favorite_games: favoriteGames.trim() || null,
      discord:        discord.trim() || null,
      twitch:         twitch.trim() || null,
      youtube:        youtube.trim() || null,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else {
      await refreshProfile();
      toast.success('Perfil atualizado!');
      logAudit('profile_updated', `@${profile?.username} atualizou o perfil`, { category: 'profile' });
    }
    setSaving(false);
  }

  const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };

  const maxBirthDate = new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
            <div className="w-16 h-16 rounded-full border-2 border-neon-green/40 overflow-hidden bg-dark-400 flex items-center justify-center cursor-pointer"
              style={{ boxShadow: '0 0 20px #39ff1420' }} onClick={() => avatarUrl && setShowFull(true)}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <span className="font-display text-2xl text-neon-green font-bold">{profile?.username?.[0]?.toUpperCase() || '?'}</span>
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
          <div>
            <h2 className="font-display text-lg font-bold text-white">{profile?.username || '...'}</h2>
            <p className="text-xs text-gray-500 font-mono">{user.email}</p>
            <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'} mt-1 inline-block`}>{profile?.role || 'user'}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">Bio</label>
          <textarea id="bio" aria-label="Bio do perfil" className="input-gamer resize-none w-full" rows={3}
            placeholder="Fale um pouco sobre você..." value={bio}
            onChange={e => setBio(e.target.value)} maxLength={200} />
          <p className="text-xs text-gray-600 font-mono mt-1 text-right">{bio.length}/200</p>
        </div>
      </div>

      {/* Stats */}
      <div className="card p-4">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase mb-3">Stats do Jogador</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[{ label: 'Posts', value: stats.posts }, { label: 'Likes', value: stats.likes }, { label: 'Rank', value: '#—' }].map(s => (
            <div key={s.label} className="bg-dark-700 rounded p-3 border border-dark-400">
              <p className="font-display text-lg font-bold text-neon-green">{s.value}</p>
              <p className="text-xs text-gray-500 font-mono">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Informações pessoais */}
      <div className="card p-5 space-y-4">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
          <MapPin size={12} />Informações
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Nascimento</label>
            <input aria-label="Data de nascimento" type="date"
              className="input-gamer w-full text-sm" value={birthDate}
              onChange={e => setBirthDate(e.target.value)} max={maxBirthDate} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Estado</label>
            <select aria-label="Estado" className="input-gamer w-full text-sm appearance-none"
              value={state} onChange={e => setState(e.target.value)}>
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
              <button key={p} type="button" onClick={() => setPlatform(platform === p ? '' : p)}
                className={`tag cursor-pointer transition-all flex items-center gap-1 ${platform === p ? 'tag-green' : 'tag-purple opacity-50 hover:opacity-100'}`}>
                <Gamepad2 size={10} />{p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">Estilo de Jogo</label>
          <div className="grid grid-cols-3 gap-2">
            {PLAYSTYLES.map(ps => (
              <button key={ps.value} type="button" onClick={() => setPlaystyle(playstyle === ps.value ? '' : ps.value)}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  playstyle === ps.value
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
              rows={2} placeholder="Ex: CS2, Valorant, Minecraft..." value={favoriteGames}
              onChange={e => setFavoriteGames(e.target.value)} maxLength={200} />
          </div>
        </div>
      </div>

      {/* Redes Sociais */}
      <div className="card p-5 space-y-3">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
          <MessageSquare size={12} />Redes Sociais
        </h3>

        {[
          { icon: FaDiscord, label: 'Discord', placeholder: 'usuario#0000 ou usuario', value: discord, set: setDiscord },
          { icon: FaTwitch,  label: 'Twitch',  placeholder: 'seu canal da Twitch',      value: twitch,   set: setTwitch },
          { icon: FaYoutube, label: 'YouTube', placeholder: 'seu canal do YouTube',      value: youtube,  set: setYoutube },
        ].map(({ icon: Icon, label, placeholder, value, set }) => (
          <div key={label}>
            <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">{label}</label>
            <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
              <span className="pl-3 pr-2 text-gray-500 shrink-0"><Icon size={14} /></span>
              <input aria-label={label} className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
                placeholder={placeholder} value={value} onChange={e => set(e.target.value)} maxLength={100} />
            </div>
          </div>
        ))}
      </div>

      {/* Botão salvar tudo */}
      <div className="pb-4">
        <button onClick={handleSave} disabled={saving} className="btn-solid w-full flex items-center justify-center gap-2 py-3">
          <Save size={14} />
          {saving ? 'Salvando...' : 'Salvar Perfil'}
        </button>
      </div>
    </div>
  );
}
