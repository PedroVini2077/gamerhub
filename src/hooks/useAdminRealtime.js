import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Canal único do painel admin.
 *
 * Os handlers despacham pela aba ATIVA, lida por ref: o canal é montado uma vez
 * só, então uma closure sobre `tab` congelaria o valor da primeira render.
 *
 * Conhecido e registrado no BACKLOG: este canal assina `posts` e `admin_logs`
 * com `event:'*'` global, então todo admin com o painel aberto recebe evento de
 * cada post e cada log do site. Público pequeno (só admins); o ideal é assinar
 * sob demanda por aba. Não foi mexido aqui pra não misturar escopo com o split.
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_logs' }, () => {
        if (tabRef.current === 'logs') on('fetchLogs')(logCatRef.current);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [isSuperAdmin]);
}
