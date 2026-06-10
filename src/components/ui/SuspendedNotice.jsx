import { Ban } from 'lucide-react';

// Aviso de suspensão temporária: mostrado no lugar do campo de criar conteúdo
// (post, comentário, chat) quando o usuário está suspenso. A suspensão real é
// imposta pelo RLS; isto só explica ao usuário até quando ele não pode postar.
export default function SuspendedNotice({ until, compact = false }) {
  const fmt = until.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className={`flex items-center gap-2 text-xs font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <Ban size={compact ? 12 : 14} className="shrink-0" />
      <span>Você está suspenso e não pode publicar até <span className="text-yellow-300 font-bold">{fmt}</span>.</span>
    </div>
  );
}
