import { Shield, Clock, Users, VolumeX } from 'lucide-react';
import AvatarPopup from '../ui/AvatarPopup';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };
const roleLabels = { user: 'Player', admin: 'Admin', super_admin: 'Super Admin' };

export default function ModPanel({
  silencedList, messages, uniqueChatters,
  handleSilenceUser, handleUnsilenceUser,
  silenceMenu, setSilenceMenu, silencingUser,
  isUserSilenced, user,
}) {
  return (
    <div className="rounded-xl border border-neon-green/20 bg-dark-800"
      style={{ boxShadow: '0 0 20px #39ff1410' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-600 bg-dark-900/50">
        <Shield size={14} className="text-neon-green" />
        <span className="text-xs font-mono text-neon-green uppercase tracking-widest font-bold">Painel de Moderação</span>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-yellow-400" />
            <span className="text-xs font-mono text-yellow-400 uppercase tracking-wider">
              Silenciados ({silencedList.length})
            </span>
          </div>
          {silencedList.length === 0 ? (
            <p className="text-xs text-gray-600 font-mono pl-4">Nenhum usuário silenciado</p>
          ) : silencedList.map(t => {
            const msgProfile = messages.find(m => m.user_id === t.user_id)?.profiles;
            const remaining = Math.ceil((new Date(t.expires_at) - new Date()) / 60000);
            return (
              <div key={t.user_id} className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2 border border-yellow-400/10">
                <VolumeX size={15} className="text-yellow-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-bold text-yellow-400">{msgProfile?.username || 'Usuário'}</p>
                  <p className="text-xs font-mono text-gray-600">{remaining} min restantes</p>
                </div>
                <button onClick={() => handleUnsilenceUser(t.user_id)}
                  className="text-xs font-mono text-gray-500 hover:text-neon-green border border-dark-400 hover:border-neon-green/40 px-2 py-0.5 rounded transition-all">
                  Remover
                </button>
              </div>
            );
          })}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={12} className="text-neon-cyan" />
            <span className="text-xs font-mono text-neon-cyan uppercase tracking-wider">
              No chat ({uniqueChatters.length})
            </span>
          </div>
          {uniqueChatters.length === 0 ? (
            <p className="text-xs text-gray-600 font-mono pl-4">Ninguém comentou ainda</p>
          ) : uniqueChatters.map(p => {
            if (!p || p.id === user?.id) return null;
            const silenced = isUserSilenced(p.id);
            return (
              <div key={p.id} className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
                <AvatarPopup profile={p} size={24} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-bold text-white">{p.username}</p>
                  <span className={`tag text-xs ${roleColors[p.role] || 'tag-cyan'}`}>
                    {roleLabels[p.role] || 'Player'}
                  </span>
                </div>
                {silenced ? (
                  <button onClick={() => handleUnsilenceUser(p.id)}
                    className="text-xs font-mono text-yellow-400 border border-yellow-400/30 hover:border-yellow-400/60 hover:bg-yellow-400/5 px-2 py-0.5 rounded transition-all active:scale-95">
                    <VolumeX size={10} className="inline mr-1" />Remover
                  </button>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSilenceMenu(silenceMenu === p.id ? null : p.id)}
                      disabled={silencingUser === p.id}
                      className="text-xs font-mono text-gray-500 hover:text-yellow-400 border border-dark-400 hover:border-yellow-400/40 px-2 py-0.5 rounded transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                      {silencingUser === p.id
                        ? <span className="animate-pulse">...</span>
                        : <span className="flex items-center gap-1"><Clock size={10} /><span>Silenciar</span></span>
                      }
                    </button>
                    {silenceMenu === p.id && (
                      <div className="absolute right-0 top-7 bg-dark-700 border border-dark-400 rounded-lg p-1.5 z-20 flex flex-col gap-1"
                        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                        <p className="text-xs font-mono text-gray-500 px-2 pb-1 border-b border-dark-500">Silenciar por:</p>
                        {[5, 10, 30, 60].map(min => (
                          <button key={min} type="button" onClick={() => handleSilenceUser(p.id, min)}
                            className="text-xs font-mono text-gray-400 hover:text-yellow-400 hover:bg-dark-600 px-3 py-1 rounded text-left transition-colors active:scale-95">
                            {min} min
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
