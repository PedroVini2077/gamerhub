import { NavLink } from 'react-router-dom';
import { Home, Users, Key, User, Zap, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const nav = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/community', icon: Users, label: 'Comunidade' },
  { to: '/keys', icon: Key, label: 'Keys & Promos' },
  { to: '/profile', icon: User, label: 'Perfil' },
];

export default function Sidebar({ open, onClose }) {
  const { profile } = useAuth();

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
            <Zap size={20} className="text-neon" style={{ filter: 'drop-shadow(0 0 6px #39ff14)' }} />
            <span className="font-display font-bold text-lg text-neon tracking-wider">GAMER</span>
            <span className="font-display font-bold text-lg text-white tracking-wider">HUB</span>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 px-2 space-y-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition-all
                font-body tracking-wide
                ${isActive
                  ? 'bg-neon-green/10 border-l-2 border-neon-green text-neon-green'
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

        {/* User mini */}
        {profile && (
          <div className="px-4 py-4 border-t border-dark-500">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-dark-400 border border-neon-green/30 flex items-center justify-center">
                <span className="text-neon-green text-xs font-mono">
                  {profile.username?.[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs font-mono text-white">{profile.username}</p>
                <p className="text-xs text-gray-500">Online</p>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full bg-neon-green animate-pulse-neon" />
            </div>
          </div>
        )}

        {/* Version */}
        <div className="px-4 py-2">
          <p className="text-xs font-mono text-dark-400">v1.0.0 // BETA</p>
        </div>
      </aside>
    </>
  );
}
