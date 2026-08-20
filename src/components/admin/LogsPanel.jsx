import { useState } from 'react';
import { Activity, RotateCcw, Archive } from 'lucide-react';
import {
  LOG_CATEGORIES, actionMeta, LOG_RETENTION_DAYS,
} from '../../lib/logMeta';

// Ícones e rótulos de categoria vêm de `lib/logMeta` — antes este arquivo tinha
// o próprio mapa, que cobria menos da metade das actions que o site grava e não
// oferecia as categorias `live`, `profile` e `system` no filtro.
const FILTERS = [{ id: 'todos', label: 'Todos' }, ...LOG_CATEGORIES];

export default function LogsPanel({ logs, logCat, setLogCat, logsLoading, fetchLogs }) {
  const [spinning, setSpinning] = useState(false);
  async function handleRefresh() {
    setSpinning(true);
    await Promise.all([fetchLogs(logCat), new Promise(r => setTimeout(r, 500))]);
    setSpinning(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-neon-purple" />
          <h3 className="font-display text-sm text-neon-purple uppercase tracking-wider">Atividade do Site</h3>
        </div>
        <button onClick={handleRefresh} disabled={spinning || logsLoading}
          className="text-xs font-mono text-gray-500 hover:text-neon-purple transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
          <RotateCcw size={11} className={spinning || logsLoading ? 'animate-spin' : ''} />
          {spinning || logsLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(c => (
          <button key={c.id} onClick={() => setLogCat(c.id)}
            className={`tag cursor-pointer transition-all ${
              logCat === c.id ? 'tag-purple' : 'opacity-40 hover:opacity-70 tag-cyan'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs font-mono text-gray-600">
        <Archive size={11} className="shrink-0" />
        Registros com mais de {LOG_RETENTION_DAYS} dias são removidos automaticamente.
      </p>

      {logsLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="card p-3 animate-pulse">
              <div className="h-3 bg-dark-500 rounded w-3/4 mb-2" />
              <div className="h-2 bg-dark-500 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : !logs.length ? (
        <div className="card p-8 text-center">
          <Activity size={28} className="text-gray-600 mx-auto mb-2" />
          <p className="text-xs font-mono text-gray-500">Nenhuma atividade registrada</p>
        </div>
      ) : logs.map(log => {
        const { Icon, cls } = actionMeta(log.action);
        const severityDot =
          log.severity === 'critical' ? 'bg-red-500 animate-pulse' :
          log.severity === 'warning'  ? 'bg-yellow-400' :
                                        'bg-gray-600';
        return (
          <div key={log.id} className={`card p-3 flex items-start gap-3 ${
            log.severity === 'critical' ? 'border-red-500/20 bg-red-500/5' :
            log.severity === 'warning'  ? 'border-yellow-400/10' : ''
          }`}>
            <Icon size={14} className={`${cls} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-gray-300 leading-relaxed">{log.details}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${severityDot}`} />
                <span className="text-xs font-mono text-gray-600">{log.actor_username || log.admin_username}</span>
                <span className="text-gray-700 text-xs">·</span>
                <span className="text-xs font-mono text-gray-600">
                  {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="tag opacity-50 shrink-0" style={{ fontSize: 9, padding: '1px 5px' }}>{log.category}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
