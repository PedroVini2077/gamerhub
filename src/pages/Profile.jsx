import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { User, Save } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.bio) setBio(profile.bio);
  }, [profile]);

  if (!user) return (
    <div className="max-w-md mx-auto card p-10 text-center mt-10">
      <User size={32} className="text-gray-600 mx-auto mb-4" />
      <p className="text-gray-400 mb-4 font-mono text-sm">Você precisa estar logado para ver seu perfil.</p>
      <Link to="/login" className="btn-solid">Fazer Login</Link>
    </div>
  );

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ bio }).eq('id', user.id);
    if (error) toast.error('Erro ao salvar');
    else {
      await refreshProfile();
      toast.success('Perfil atualizado!');
    }
    setSaving(false);
  }

  const roleColors = {
    user: 'tag-cyan',
    admin: 'tag-purple',
    super_admin: 'tag-green',
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-dark-400 border-2 border-neon-green/40 flex items-center justify-center"
            style={{ boxShadow: '0 0 20px #39ff1420' }}>
            <span className="font-display text-2xl text-neon-green font-bold">
              {profile?.username?.[0]?.toUpperCase() || '?'}
            </span>
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
            { label: 'Posts', value: '0' },
            { label: 'Likes', value: '0' },
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
