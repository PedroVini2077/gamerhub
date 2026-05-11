import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Save, Camera, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ posts: 0, likes: 0 });
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [showFull, setShowFull] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (profile?.bio) setBio(profile.bio);
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    if (user) fetchStats();
  }, [profile, user]);

  async function fetchStats() {
    const { data } = await supabase
      .from('posts')
      .select('likes')
      .eq('user_id', user.id);
    if (data) {
      const totalLikes = data.reduce((sum, p) => sum + (p.likes || 0), 0);
      setStats({ posts: data.length, likes: totalLikes });
    }
  }

  async function compressImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
        else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.85);
      };
      img.src = url;
    });
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG, WEBP ou GIF.');
      return;
    }

    setUploading(true);
    toast.loading('Processando imagem...', { id: 'upload' });

    const compressed = await compressImage(file);
    const path = `${user.id}/avatar.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) {
      toast.error('Erro ao fazer upload', { id: 'upload' });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    const finalUrl = publicUrl + '?t=' + Date.now();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: finalUrl })
      .eq('id', user.id);

    if (updateError) {
      toast.error('Erro ao salvar avatar', { id: 'upload' });
    } else {
      setAvatarUrl(finalUrl);
      await refreshProfile();
      toast.success('Avatar atualizado! 🎮', { id: 'upload' });
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ bio }).eq('id', user.id);
    if (error) toast.error('Erro ao salvar');
    else { await refreshProfile(); toast.success('Perfil atualizado!'); }
    setSaving(false);
  }

  const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };

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
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFull(false)}
        >
          <div className="relative max-w-sm w-full">
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-full rounded-xl object-cover"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setShowFull(false)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-dark-800/90 flex items-center justify-center text-white hover:bg-dark-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative shrink-0">
            {/* Foto — clica pra ver em tamanho grande */}
            <div
              className="w-16 h-16 rounded-full border-2 border-neon-green/40 overflow-hidden bg-dark-400 flex items-center justify-center cursor-pointer"
              style={{ boxShadow: '0 0 20px #39ff1420' }}
              onClick={() => avatarUrl && setShowFull(true)}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-2xl text-neon-green font-bold">
                  {profile?.username?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>

            {/* Botão câmera separado */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Trocar foto"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-dark-600 border border-neon-green/40 flex items-center justify-center hover:bg-neon-green/10 transition-colors"
            >
              {uploading
                ? <span className="w-3 h-3 border border-neon-green border-t-transparent rounded-full animate-spin" />
                : <Camera size={11} className="text-neon-green" />
              }
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-white">
              {profile?.username || '...'}
            </h2>
            <p className="text-xs text-gray-500 font-mono">{user.email}</p>
            <span className={`tag ${roleColors[profile?.role] || 'tag-cyan'} mt-1 inline-block`}>
              {profile?.role || 'user'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">Bio</label>
            <textarea
              className="input-gamer resize-none"
              rows={3}
              placeholder="Fale um pouco sobre você..."
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={200}
            />
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-solid flex items-center gap-2">
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar Perfil'}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase mb-3">Stats do Jogador</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Posts', value: stats.posts },
            { label: 'Likes', value: stats.likes },
            { label: 'Rank', value: '#—' },
          ].map(s => (
            <div key={s.label} className="bg-dark-700 rounded p-3 border border-dark-400">
              <p className="font-display text-lg font-bold text-neon-green">{s.value}</p>
              <p className="text-xs text-gray-500 font-mono">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
