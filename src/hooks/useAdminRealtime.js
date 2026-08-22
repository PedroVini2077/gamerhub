import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Canal único do painel admin.
 *
 * Os handlers despacham pela aba ATIVA, lida por ref: o canal é montado uma vez
 * só, então uma closure sobre `tab` congelaria o valor da primeira render.
 *
 * `admin_logs` NÃO é assinado aqui de propósito: era o pior custo/benefício do
 * projeto — tabela de auditoria de alto volume transmitida para todo admin com
 * o painel aberto, mesmo com a aba de logs fechada. Foi tirada da publicação
 * `supabase_realtime` e trocada por `useVisiblePoll` na aba de logs.
 *
 * `posts` ainda é assinado com `event:'*'` global. Fica registrado no BACKLOG:
 * o ideal é assinar sob demanda por aba, mas o público é pequeno (só admins) e
 * a mudança mexe na moderação de lives, que pede janela própria.
 */
export function useAdminRealtime({ tab, logCat, isSuperAdmin, handlers }) {
  const tabRef = useRef(tab);
  const logCatRef = useRef(logCat);
  const handlersRef = useRef(handlers);

  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { logCatRef.current = logCat; }, [logCat]);
  useEffect(() => { handlersRef.current = handlers; });

  useEffect(() => {
    const on = name => (...args) => handlersRef.current[name]?.(...args);
    const isLiveTab = () => tabRef.current === 'lives' || tabRef.current === 'super';

    const channel = supabase.channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_timeouts' }, () => {
        if (isLiveTab()) on('fetchLiveMod')();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        if (isLiveTab()) on('fetchLiveMod')();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_reactivation_requests' }, () => {
        if (isLiveTab()) on('fetchLiveMod')();
        if (isSuperAdmin) on('fetchLogs')();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unban_requests' }, () => {
        if (isSuperAdmin && tabRef.current === 'super') on('fetchUnbanRequests')();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => {
        on('refreshUnread')();
        if (tabRef.current === 'notifs') on('fetchNotifications')();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [isSuperAdmin]);
}
