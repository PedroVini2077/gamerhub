import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { listContainer, listItem } from '../../lib/motion';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const SEV_COLOR = { info: '#6b7280', warning: '#f59e0b', critical: '#ef4444' };
const CAT_EMOJI = { auth: '🔐', security: '🛡️', content: '📝', admin: '⚙️', system: '🔧' };

export default function LogsTab() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [offset, setOffset]     = useState(0);
  const LIMIT = 30;

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('owner_get_audit_logs', {
      p_limit:    LIMIT,
      p_offset:   off,
      p_category: category || null,
      p_severity: severity || null,
    });
    if (error) toast.error('Erro ao carregar logs: ' + error.message);
    else setLogs(data || []);
    setLoading(false);
  }, [category, severity]);

  useEffect(() => { setOffset(0); load(0); }, [load]);

  function prev() { const o = Math.max(0, offset - LIMIT); setOffset(o); load(o); }
  function next() { const o = offset + LIMIT; setOffset(o); load(o); }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 focus:outline-none">
          <option value="">Todas as categorias</option>
          <option value="auth">Auth</option>
          <option value="security">Security</option>
          <option value="content">Content</option>
          <option value="admin">Admin</option>
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)}
          className="px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 focus:outline-none">
          <option value="">Todos os níveis</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <button onClick={() => load(offset)}
          className="p-2 bg-dark-700 border border-dark-400 rounded text-gray-500 hover:text-orange-400 transition-colors">
          <RefreshCw size={14} />
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
