import { MessageSquare } from 'lucide-react';

export default function MuralCard({ item }) {
  return (
    <div className="card p-4 animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-dark-400 border border-neon-purple/30 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs font-mono text-neon-purple">
            {item.profiles?.username?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">
              {item.profiles?.username || 'Gamer'}
            </span>
            <span className="text-xs text-gray-600 font-mono">
              {new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed break-words">{item.message}</p>
        </div>
        <MessageSquare size={14} className="text-dark-400 shrink-0 mt-1" />
      </div>
    </div>
  );
}
