import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const LOG_LIMIT = 100;

/**
 * Estado e busca dos logs de auditoria do painel admin.
 *
 * `fetchLogs` é estável (`useCallback` sem deps) de propósito: o canal de
 * realtime do Admin depende dela, e uma identidade nova a cada render
 * re-assinaria o canal sem necessidade.
 */
export function useAdminLogs() {
  const [logs, setLogs] = useState([]);
  const [logCat, setLogCat] = useState('todos');
  const [logsLoading, setLogsLoading] = useState(false);

  // Contador de requisição: trocar de categoria rápido disparava vários
  // fetches e o que chegasse por ÚLTIMO vencia — podendo pintar a tela com os
  // logs de uma categoria que o admin já tinha abandonado.
  const reqRef = useRef(0);

  const fetchLogs = useCallback(async (cat = 'todos') => {
    const reqId = ++reqRef.current;
    setLogsLoading(true);
    let q = supabase.from('admin_logs').select('*')
      .order('created_at', { ascending: false }).limit(LOG_LIMIT);
    if (cat !== 'todos') q = q.eq('category', cat);
    const { data } = await q;
    if (reqId !== reqRef.current) return; // resposta obsoleta: descarta
    setLogs(data || []);
    setLogsLoading(false);
  }, []);

  return { logs, logCat, setLogCat, logsLoading, fetchLogs };
}
