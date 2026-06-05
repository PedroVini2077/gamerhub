import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PostCard from '../components/feed/PostCard';
import Avatar from '../components/ui/Avatar';
import { ArrowLeft, Calendar, MapPin, Gamepad2, Swords } from 'lucide-react';
import { FaTwitch, FaYoutube, FaDiscord } from 'react-icons/fa6';
import { getRankFromXP, getRankLabel, getSubRankProgress } from '../lib/ranks';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };

const PLAYSTYLE_LABELS = { casual: 'Casual', competitivo: 'Competitivo', ambos: 'Casual & Competitivo' };

function calcAge(birthDate) {
  if (!birthDate) return null;
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export default function UserProfile() {
  const { username } = useParams();
  const [profile, setProfile]   = useState(null);
  const [posts, setPosts]       = useState([]);
  const [stats, setStats]       = useState({ posts: 0, likes: 0 });
  const [xpData, setXpData]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchProfile(); }, [username]);

  async function fetchProfile() {
    setLoading(true);
    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('username', username).single();

    if (!profileData) { setNotFound(true); setLoading(false); return; }
    setProfile(profileData);

    const [{ data: postsData }, { count: likesCount }, { data: xp }] = await Promise.all([
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
      supabase.rpc('get_user_xp', { p_user_id: profileData.id }),
    ]);

    setPosts(postsData || []);
    setStats({ posts: postsData?.length || 0, likes: likesCount || 0 });
    if (xp) setXpData(xp);
    setLoading(false);
  }

  if (showPhoto && profile?.avatar_url) return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', zIndex: 9999 }} onClick={() => setShowPhoto(false)}>
      <img src={profile.avatar_url} alt={profile.username}
        className="max-w-sm w-full rounded-full border-2 border-neon-green/40"
        style={{ boxShadow: '0 0 40px #39ff1420' }} onClick={e => e.stopPropagation()} />
    </div>
  );

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

  const age = calcAge(profile.birth_date);
  const hasSocials = profile.discord || profile.twitch || profile.youtube;
  const rank     = xpData ? getRankFromXP(xpData.xp) : null;
  const progress = xpData ? getSubRankProgress(xpData.xp) : null;
  const RankIcon = rank?.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-neon-green transition-colors font-mono">
        <ArrowLeft size={14} />Voltar
      </button>

      {/* Card principal */}
      <div className="card p-6">
        <div className="flex items-start gap-4 mb-4">
          <button onClick={() => profile?.avatar_url && setShowPhoto(true)} className="shrink-0">
            <Avatar
              profile={profile}
              size={64}
              className={profile?.avatar_url ? 'cursor-pointer' : ''}
              rankBorder={rank}
            />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-display text-xl font-bold text-white">{profile.username}</h1>
              <span className={`tag ${roleColors[profile.role] || 'tag-cyan'}`}>{profile.role}</span>
              {rank && (
                <span className="flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded border"
                  style={{ color: rank.color, borderColor: `${rank.color}40`, background: `${rank.color}10` }}>
                  {RankIcon && <RankIcon size={10} />}
                  {getRankLabel(rank)}
                </span>
              )}
              {profile.playstyle && (
                <span className="tag tag-purple text-xs">{PLAYSTYLE_LABELS[profile.playstyle]}</span>
              )}
            </div>

            {profile.bio && <p className="text-sm text-gray-400 font-mono mb-2">{profile.bio}</p>}

            {/* Metadados inline */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 font-mono">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                Membro desde {new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              {age && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} />{age} anos
                </span>
              )}
              {profile.state && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} />{profile.state}
                </span>
              )}
              {profile.platform && (
                <span className="flex items-center gap-1">
                  <Gamepad2 size={11} />{profile.platform}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Jogos favoritos */}
        {profile.favorite_games && (
          <div className="mt-3 pt-3 border-t border-dark-500">
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Swords size={11} />Jogos Favoritos
            </p>
            <p className="text-sm text-gray-300 font-mono">{profile.favorite_games}</p>
          </div>
        )}

        {/* Redes sociais */}
        {hasSocials && (
          <div className="mt-3 pt-3 border-t border-dark-500 flex flex-wrap gap-3">
            {profile.discord && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
                <FaDiscord className="text-indigo-400" size={13} />{profile.discord}
              </span>
            )}
            {profile.twitch && (
              <a href={`https://twitch.tv/${profile.twitch}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono text-purple-400 hover:text-purple-300 transition-colors">
                <FaTwitch size={13} />{profile.twitch}
              </a>
            )}
            {profile.youtube && (
              <a href={`https://youtube.com/@${profile.youtube}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono text-red-400 hover:text-red-300 transition-colors">
                <FaYoutube size={13} />{profile.youtube}
              </a>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-dark-500">
          {[
            { label: 'Posts',  value: stats.posts, color: 'text-neon-green' },
            { label: 'Likes',  value: stats.likes, color: 'text-neon-purple' },
            { label: 'XP',     value: xpData?.xp ?? '—', color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className="bg-dark-700 rounded p-3 text-center border border-dark-400">
              <p className={`font-display text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 font-mono">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rank progress */}
        {rank && progress && (
          <div className="mt-3 pt-3 border-t border-dark-500 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {RankIcon && <RankIcon size={12} style={{ color: rank.color }} />}
                <span className="text-xs font-display font-bold" style={{ color: rank.color }}>
                  {getRankLabel(rank)}
                </span>
              </div>
              {progress.needed != null && (
                <span className="text-xs font-mono text-gray-500">{progress.current}/{progress.needed} XP</span>
              )}
            </div>
            {progress.needed != null ? (
              <div className="w-full h-1 bg-dark-500 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progress.pct}%`, background: rank.color, boxShadow: `0 0 4px ${rank.glow}` }}
                />
              </div>
            ) : (
              <p className="text-xs font-mono" style={{ color: rank.color }}>Rank máximo 👑</p>
            )}
          </div>
        )}
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
            {posts.map(p => <PostCard key={p.id} post={p} onDelete={fetchProfile} disablePopup />)}
          </div>
        )}
      </div>
    </div>
  );
}
