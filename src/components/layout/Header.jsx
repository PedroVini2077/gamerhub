import { Menu, LogIn, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Header({ onMenuClick }) {
  const { user, profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    toast.success('Até mais, gamer!');
  }

  return (
    <header className="fixed top-0 left-0 right-0 md:left-60 h-14 bg-dark-800/95 backdrop-blur border-b border-dark-500 z-10 flex items-center px-4 gap-4">
      <button
        onClick={onMenuClick}
        className="md:hidden text-gray-400 hover:text-white transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      {/* Notificações */}
      <button className="text-gray-500 hover:text-neon-green transition-colors relative">
        <Bell size={18} />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-neon-green rounded-full text-dark-900 text-[8px] flex items-center justify-center font-bold">3</span>
      </button>

      {user ? (
        <div className="flex items-center gap-3">
          <Link to="/profile" className="text-sm font-mono text-gray-300 hover:text-neon-green transition-colors">
            {profile?.username || user.email?.split('@')[0]}
          </Link>
          <button onClick={handleSignOut} className="btn-neon flex items-center gap-2 py-2 px-3">
            <LogOut size={14} />
            Sair
          </button>
        </div>
      ) : (
        <Link to="/login" className="btn-solid flex items-center gap-2 py-2 px-4">
          <LogIn size={14} />
          Login
        </Link>
      )}
    </header>
  );
}
