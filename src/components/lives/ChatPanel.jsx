import { useState } from 'react';
import { MessageCircle, Send, VolumeX, Trash2, Flag } from 'lucide-react';
import AvatarPopup from '../ui/AvatarPopup';
import ReportModal from '../ui/ReportModal';
import SuspendedNotice from '../ui/SuspendedNotice';

const roleColors = { user: 'tag-cyan', admin: 'tag-purple', super_admin: 'tag-green' };
const roleLabels = { user: 'Player', admin: 'Admin', super_admin: 'Super Admin' };

export default function ChatPanel({
  messages, msg, setMsg, sendMessage, sending,
  isSilenced, canModerate, deleteMessage, isUserSilenced,
  user, suspended, bottomRef, chatInputRef,
}) {
  const [reportingId, setReportingId] = useState(null);
  return (
    <div className="card flex flex-col" style={{ height: 380 }}>
      <div className="flex items-center gap-2 p-3 border-b border-dark-500">
        <MessageCircle size={14} className="text-neon-green" />
        <span className="text-xs font-mono text-neon-green uppercase tracking-wider">Chat ao vivo</span>
        <span className="text-xs text-gray-600 font-mono ml-auto">{messages.length} msgs</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-600 font-mono text-center py-4">Seja o primeiro a comentar!</p>
        )}
        {messages.map(m => {
          const silenced = isUserSilenced(m.user_id);
          const canDelete = canModerate || (user && m.user_id === user.id);
          const canReport = user && m.user_id !== user.id;
          return (
            <div key={m.id} className="flex items-start gap-2 group">
              <AvatarPopup profile={m.profiles} size={24} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-bold font-mono ${silenced ? 'text-gray-600' : 'text-neon-green'}`}>
                    {m.profiles?.username}
                  </span>
                  {silenced && <VolumeX size={10} className="text-yellow-500" />}
                  {m.profiles?.role !== 'user' && (
                    <span className={`tag ${roleColors[m.profiles?.role]}`} style={{ fontSize: 9, padding: '1px 4px' }}>
                      {roleLabels[m.profiles?.role]}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-300 break-words">{m.message}</span>
              </div>
              <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                {canReport && (
                  <button onClick={() => setReportingId(m.id)} aria-label="Denunciar mensagem"
                    className="text-gray-600 hover:text-orange-400 transition-colors p-0.5">
                    <Flag size={11} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => deleteMessage(m.id)} aria-label="Deletar mensagem"
                    className="text-gray-600 hover:text-red-400 transition-colors p-0.5">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {user ? (
        suspended ? (
          <div className="p-3 border-t border-dark-500">
            <SuspendedNotice until={suspended} compact />
          </div>
        ) : isSilenced ? (
          <div className="p-3 border-t border-dark-500 text-center">
            <p className="text-xs font-mono text-yellow-500 flex items-center justify-center gap-1.5">
              <VolumeX size={12} />Você está silenciado neste chat
            </p>
          </div>
        ) : (
          <div className="p-3 border-t border-dark-500 flex gap-2">
            <input
              id="live-chat-input"
              ref={chatInputRef}
              aria-label="Mensagem de chat ao vivo"
              className="input-gamer flex-1 text-sm py-1.5"
              placeholder="Manda um comentário..."
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              maxLength={200} />
            <button onClick={sendMessage} disabled={sending} className="btn-solid py-1.5 px-3">
              <Send size={13} />
            </button>
          </div>
        )
      ) : (
        <p className="text-xs text-gray-600 font-mono text-center p-3">Faça login para comentar</p>
      )}

      {reportingId && (
        <ReportModal contentType="chat" contentId={reportingId} onClose={() => setReportingId(null)} />
      )}
    </div>
  );
}
