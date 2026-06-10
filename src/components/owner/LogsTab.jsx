import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '../../lib/motion';
import { RefreshCw, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toCSV, downloadCSV } from '../../lib/csv';
import toast from 'react-hot-toast';

const CSV_COLUMNS = [
  { key: 'created_at', label: 'data', format: v => new Date(v).toISOString() },
  { key: 'actor_username', label: 'autor' },
  { key: 'action', label: 'acao' },
  { key: 'category', label: 'categoria' },
  { key: 'severity', label: 'severidade' },
  { key: 'details', label: 'detalhes' },
  { key: 'metadata', label: 'metadata' },
];

const SEV_COLOR = { info: '#6b7280', warning: '#f59e0b', critical: '#ef4444' };
const CAT_EMOJI = { auth: '🔐', security: '🛡️', content: '📝', admin: '⚙️', system: '🔧' };

export default function LogsTab() {
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [offset, setOffset]     = useState(0);
  const [exporting, setExporting] = useState(false);
  const LIMIT = 30;
  const EXPORT_MAX = 5000;

  async function exportCSV() {
    setExporting(true);
    const { data, error } = await supabase.rpc('owner_get_audit_logs', {
      p_limit: EXPORT_MAX, p_offset: 0,
      p_category: category || null, p_severity: severity || null,
    });
    setExporting(false);
    if (error) { toast.error('Erro ao exportar: ' + error.message); return; }
    if (!data?.length) { toast.error('Nenhum log para exportar.'); return; }
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadCSV(`gamerhub-logs-${stamp}.csv`, toCSV(data, CSV_COLUMNS));
    toast.success(`${data.length} log(s) exportado(s).`);
  }

  const { data: logs = [], isPending: loading, refetch } = useQuery({
    queryKey: ['owner_audit_logs', category, severity, offset],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('owner_get_audit_logs', {
        p_limit:    LIMIT,
        p_offset:   offset,
        p_category: category || null,
        p_severity: severity || null,
      });
      if (error) { toast.error('Erro ao carregar logs: ' + error.message); return []; }
      return data || [];
    },
  });

  function changeCategory(v) { setCategory(v); setOffset(0); }
  function changeSeverity(v) { setSeverity(v); setOffset(0); }
  function prev() { setOffset(o => Math.max(0, o - LIMIT)); }
  function next() { setOffset(o => o + LIMIT); }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select value={category} onChange={e => changeCategory(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 focus:outline-none">
          <option value="">Todas as categorias</option>
          <option value="auth">Auth</option>
          <option value="security">Security</option>
          <option value="content">Content</option>
          <option value="admin">Admin</option>
        </select>
        <select value={severity} onChange={e => changeSeverity(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 focus:outline-none">
          <option value="">Todos os níveis</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <button onClick={() => refetch()}
          className="p-2 bg-dark-700 border border-dark-400 rounded text-gray-500 hover:text-orange-400 transition-colors">
          <RefreshCw size={14} />
        </button>
        <button onClick={exportCSV} disabled={exporting}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 hover:text-orange-400 hover:border-orange-400/50 disabled:opacity-40 transition-colors">
          <Download size={14} />
          {exporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <motion.div className="space-y-1"
          variants={listContainer} initial="initial" animate="animate">
          {logs.map(log => (
            <motion.div key={log.id} variants={listItem}
              className="flex items-start gap-3 px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg">
              <span className="shrink-0 text-sm leading-none mt-0.5">
                {CAT_EMOJI[log.category] || '📋'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-gray-200">
                    {log.actor_username || 'sistema'}
                  </span>
                  <span className="text-xs font-mono text-gray-400 break-all">{log.action}</span>
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color:      SEV_COLOR[log.severity] || '#6b7280',
                      background: `${SEV_COLOR[log.severity] || '#6b7280'}18`,
                    }}>
                    {log.severity}
                  </span>
                </div>
                {log.details && (
                  <p className="text-xs text-gray-600 font-mono mt-0.5 break-words">{log.details}</p>
                )}
              </div>
              <p className="text-xs font-mono text-gray-700 shrink-0 whitespace-nowrap">
                {new Date(log.created_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </motion.div>
          ))}
          {logs.length === 0 && (
            <div className="card p-8 text-center">
              <p className="text-xs text-gray-500 font-mono">Nenhum log encontrado.</p>
            </div>
          )}
        </motion.div>
      )}

      <div className="flex gap-2 justify-center">
        <button disabled={offset === 0} onClick={prev}
          className="px-4 py-2 text-xs font-mono border border-dark-400 rounded text-gray-400 hover:border-orange-400/50 hover:text-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ← Anterior
        </button>
        <button disabled={logs.length < LIMIT} onClick={next}
          className="px-4 py-2 text-xs font-mono border border-dark-400 rounded text-gray-400 hover:border-orange-400/50 hover:text-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Próximo →
        </button>
      </div>
    </div>
  );
}
