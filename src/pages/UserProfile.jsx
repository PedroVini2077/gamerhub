import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import AvatarPopup from '../components/ui/AvatarPopup';
import { ArrowLeft, Calendar } from 'lucide-react';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };

export default function UserProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ posts: 0, likes: 0 });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, [username]);

  async function fetchProfile() {
    setLoading(true);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (!profileData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const [{ data: postsData }, { count: likesCount }] = await Promise.all([
      supabase.from('posts')
        .select('*, profiles(username, avatar_url), user_id')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false }),
      supabase.from('post_likes')
        .select('*', { count: 'exact', head: true })
        .in('post_id',
          (await supabase.from('posts').select('id').eq('user_id', profileData.id))
            .data?.map(p => p.id) || []
        ),
    ]);

    setPosts(postsData || []);
    setStats({ posts: postsData?.length || 0, likes: likesCount || 0 });
    setLoading(false);
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-dark-500" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-dark-500 rounded w-1/3" />
            <div className="h-3 bg-dark-500 rounded w-1/4" />
          </div>
        </div>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="max-w-md mx-auto card p-10 text-center mt-10">
      <p className="font-display text-4xl text-neon-green mb-2">404</p>
      <p className="text-gray-400 font-mono text-sm mb-4">Usuário não encontrado</p>
      <Link to="/" className="btn-solid">Voltar ao Feed</Link>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Voltar */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-neon-green transition-colors font-mono">
        <ArrowLeft size={14} />
        Voltar
      </button>

      {/* Card do perfil */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-4">
          <AvatarPopup profile={profile} size={64} postsCount={stats.posts} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-display text-xl font-bold text-white">{profile.username}</h1>
              <span className={`tag ${roleColors[profile.role] || 'tag-cyan'}`}>{profile.role}</span>
            </div>
            {profile.bio && (
              <p className="text-sm text-gray-400 font-mono">{profile.bio}</p>
            )}
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-600 font-mono">
              <Calendar size={11} />
              Membro desde {new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-dark-500">
          {[
            { label: 'Posts', value: stats.posts, color: 'text-neon-green' },
            { label: 'Likes recebidos', value: stats.likes, color: 'text-neon-purple' },
          ].map(s => (
            <div key={s.label} className="bg-dark-700 rounded p-3 text-center border border-dark-400">
              <p className={`font-display text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 font-mono">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Posts do usuário */}
      <div>
        <h2 className="font-display text-xs text-gray-500 tracking-widest uppercase mb-3">
          Posts de {profile.username}
        </h2>
        {posts.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-gray-500 font-mono">Nenhum post ainda.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(p => (
              <PostCard key={p.id} post={p} onDelete={fetchProfile} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
