import { CheckCircle, XCircle, Clock, ShieldAlert, UserX, Loader2, Flag, Trash2 } from 'lucide-react';
import QueueContentPreview from './QueueContentPreview';
import { CONTENT_LABEL, TRIGGER_LABEL, TRIGGER_COLOR, podeSerOcultado } from './queueLabels';

function ActionSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      aria-label="Ação de moderação"
      className="bg-dark-700 border border-dark-500 text-xs font-mono text-gray-300 rounded px-2 py-1.5 w-full">
      <option value="">Selecionar ação...</option>
      {/* "Sem punição" é uma escolha EXPLÍCITA, não o padrão. Antes, aprovar
          sem marcar nada gerava zero ponto em silêncio — e a escalação
          automática (8 pontos suspende, 15 bane) nunca disparava. */}
      <option value="none">Sem punição — só ocultar (0 pt)</option>
      <option value="warn">Aviso (+1pt)</option>
      <option value="hide">Ocultar conteúdo (+2pt)</option>
      <option value="suspend_1d">Suspender 1 dia (+5pt)</option>
      <option value="suspend_7d">Suspender 7 dias (+10pt)</option>
    </select>
  );
}

/** Um item da fila: origem, prévia do conteúdo, denúncias e as três decisões. */
export default function QueueItemCard({
  item, reports, action, onActionChange, isResolving, onResolve, onBan,
}) {
  const ocultavel = podeSerOcultado(item.content_type);

  return (
    <div className="card p-4 border-orange-500/20 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={13} className={TRIGGER_COLOR[item.trigger_type] || 'text-gray-400'} />
          <span className={`text-xs font-mono font-bold ${TRIGGER_COLOR[item.trigger_type]}`}>
            {TRIGGER_LABEL[item.trigger_type]}
          </span>
          <span className="tag tag-cyan text-xs">{CONTENT_LABEL[item.content_type]}</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono text-gray-500">
          <Clock size={10} />
          {new Date(item.created_at).toLocaleString('pt-BR')}
        </div>
      </div>

      <QueueContentPreview contentType={item.content_type} contentId={item.content_id} />

      {reports.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-mono text-gray-500">{reports.length} denúncia(s):</p>
          {reports.slice(0, 3).map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <Flag size={11} className="text-orange-400 shrink-0" />
              {r.reason}
              {r.details && <span className="text-gray-600">— {r.details}</span>}
            </div>
          ))}
        </div>
      )}

      <ActionSelect value={action} onChange={onActionChange} />

      <div className="flex gap-2">
        {/* Chat não se oculta: o botão apaga a mensagem, e o rótulo diz isso.
            Antes ele prometia "Confirmar ocultação" e não acontecia nada com a
            mensagem — só o item saía da fila. */}
        <button onClick={() => onResolve('approved')}
          disabled={isResolving}
          className="flex-1 py-2 text-xs font-mono font-bold rounded flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#ef444415', color: '#f87171', border: '1px solid #ef444440' }}>
          {isResolving
            ? <><Loader2 size={12} className="animate-spin" /> Processando...</>
            : ocultavel
              ? <><CheckCircle size={12} /> Confirmar ocultação</>
              : <><Trash2 size={12} /> Apagar mensagem</>}
        </button>
        <button onClick={() => onResolve('rejected')}
          disabled={isResolving}
          className="flex-1 py-2 text-xs font-mono rounded flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#22c55e15', color: '#4ade80', border: '1px solid #22c55e40' }}>
          {/* "Restaurar" só faz sentido onde houve ocultação. No chat nada foi
              escondido, então a recusa é simplesmente dispensar o item. */}
          <XCircle size={12} /> {ocultavel ? 'Restaurar' : 'Dispensar'}
        </button>
        <button onClick={onBan}
          disabled={isResolving}
          className="px-3 py-2 text-xs font-mono rounded flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#7c3aed15', color: '#a78bfa', border: '1px solid #7c3aed40' }}>
          <UserX size={12} /> Banir
        </button>
      </div>
    </div>
  );
}
