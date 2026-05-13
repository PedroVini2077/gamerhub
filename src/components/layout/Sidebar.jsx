import { NavLink } from 'react-router-dom';
import { Home, Users, Key, User, Zap, X, Shield, Settings, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';
import Avatar from '../ui/Avatar';
import { useEffect, useState } from 'react';
import { formatNumber } from '../../lib/format';
import { supabase } from '../../lib/supabase';

export default function Sidebar({ open, onClose }) {
  const { profile } = useAuth();
  const { isAdmin, role } = useRole();
  const [stats, setStats] = useState({ users: 0, postsToday: 0, keys: 0 });

  useEffect(() => {
    async function fetchStats() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [{ count: users }, { count: postsToday }, { count: keys }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('game_keys').select('*', { count: 'exact', head: true }).eq('is_promo', false),
      ]);
      setStats({ users: users || 0, postsToday: postsToday || 0, keys: keys || 0 });
    }
    fetchStats();
  }, []);

  const nav = [
    { to: '/', icon: Home, label: 'Feed' },
    { to: '/community', icon: Users, label: 'Comunidade' },
    { to: '/keys', icon: Key, label: 'Keys & Promos' },
    { to: '/profile', icon: User, label: 'Perfil' },
    { to: '/settings', icon: Settings, label: 'Configurações' },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin', highlight: true }] : []),
  ];

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={onClose} />}
      <aside className={`
        fixed top-0 left-0 h-full w-60 bg-dark-800 border-r border-dark-500 z-30
        flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-dark-500">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 6px #39ff14)' }} />
            <span className="font-display font-bold text-lg text-neon-green tracking-wider">GAMER</span>
            <span className="font-display font-bold text-lg text-white tracking-wider">HUB</span>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 px-2 space-y-1">
          {nav.map(({ to, icon: Icon, label, highlight }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition-all font-body tracking-wide
                ${isActive
                  ? highlight
                    ? 'bg-neon-purple/10 border-l-2 border-neon-purple text-neon-purple'
                    : 'bg-neon-green/10 border-l-2 border-neon-green text-neon-green'
                  : highlight
                    ? 'text-neon-purple/60 hover:text-neon-purple hover:bg-dark-600 border-l-2 border-transparent'
                    : 'text-gray-400 hover:text-white hover:bg-dark-600 border-l-2 border-transparent'
                }
              `}
              onClick={onClose}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Stats compactos */}
        <div className="px-4 py-3 border-t border-dark-500">
          <p className="text-xs font-mono text-dark-400 uppercase tracking-wider mb-2">Status</p>
          <div className="space-y-1">
            {[
              { label: 'Membros', value: stats.users, color: 'text-neon-cyan' },
              { label: 'Posts/dia', value: stats.postsToday, color: 'text-neon-green' },
              { label: 'Keys', value: stats.keys, color: 'text-neon-purple' },
            ].map(s => (
              <div key={s.label} className="flex justify-between items-center px-2 py-1.5 bg-dark-700 rounded border border-dark-500">
                <p className="text-xs text-gray-500 font-mono">{s.label}</p>
                <p className={`text-sm font-bold font-mono ${s.color}`}>{formatNumber(s.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* User info */}
        {profile && (
          <div className="px-4 py-4 border-t border-dark-500">
            <div className="flex items-center gap-3">
              <Avatar profile={profile} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-white truncate">{profile.username}</p>
                <p className="text-xs text-gray-500 font-mono">{role}</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse shrink-0" />
            </div>
          </div>
        )}

        <div className="px-4 py-2">
          <p className="text-xs font-mono text-dark-400">v1.0.0 // BETA</p>
        </div>
      </aside>
    </>
  );
}
