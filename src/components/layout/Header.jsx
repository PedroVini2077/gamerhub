import { Menu, LogIn, LogOut, Bell, X, Heart, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function Header({ onMenuClick }) {
  const { user, profile, signOut } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) fetchNotifs();
  }, [user]);

  async function fetchNotifs() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifs(data || []);
  }

  async function markAllRead() {
    await supabase.from('notifications')
      .update({ read: true })
      .eq('user_id', user.id);
    setNotifs(n => n.map(x => ({ ...x, read: true })));
  }

  async function handleSignOut() {
    await signOut();
    toast.success('Até mais, gamer!');
  }

  const unread = notifs.filter(n => !n.read).length;

  return (
    <header className="fixed top-0 left-0 right-0 md:left-60 h-14 bg-dark-800/95 backdrop-blur border-b border-dark-500 z-10 flex items-center px-4 gap-4">
      <button onClick={onMenuClick} className="md:hidden text-gray-400 hover:text-white transition-colors">
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      {user && (
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="text-gray-500 hover:text-neon-green transition-colors relative p-2"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-neon-green rounded-full text-dark-900 text-[9px] flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {open && (
            <>
              {/* Overlay pra fechar */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 top-10 w-80 bg-dark-700 border border-dark-400 rounded shadow-xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500">
                  <span className="text-xs font-display text-gray-300 uppercase tracking-wider">
                    Notificações
                  </span>
                  <div className="flex items-center gap-3">
                    {unread > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-neon-green font-mono hover:underline"
                      >
                        Marcar tudo lido
                      </button>
                    )}
                    <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-xs text-gray-500 font-mono">Nenhuma notificação ainda</p>
                    </div>
                  ) : notifs.map(n => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-dark-600 ${
                        !n.read ? 'bg-neon-green/5' : ''
                      }`}
                    >
                      <div className={`mt-0.5 shrink-0 ${n.type === 'like' ? 'text-neon-green' : 'text-neon-purple'}`}>
                        {n.type === 'like' ? <Heart size={13} /> : <Users size={13} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 leading-relaxed">{n.message}</p>
                        <p className="text-xs text-gray-600 font-mono mt-0.5">
                          {new Date(n.created_at).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-neon-green shrink-0 mt-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

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
