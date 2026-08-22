import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Realtime do painel admin, dividido em DOIS canais por tempo de vida.
 *
 * Antes era um canal só, sempre ligado, assinando tudo — inclusive `posts` com
 * `event:'*'` global. Isso significava que todo admin com o painel aberto
 * recebia uma mensagem a cada post criado, editado ou curtido no site inteiro,
 * mesmo parado na aba de Usuários, e o handler só descartava DEPOIS de receber.
 *
 * Agora:
 *
 *   PERSISTENTE — o que precisa chegar em qualquer aba: notificações (o sino
 *   tem badge) e, para super admin, pedidos de desban.
 *
 *   SOB DEMANDA — o volumoso (`posts`, timeouts de chat, pedidos de
 *   reativação) só existe enquanto a aba de moderação de lives está aberta.
 *   Fora dela o cliente nem assina, então o tráfego é zero em vez de ser
 *   recebido e jogado fora.
 *
 * `admin_logs` não aparece aqui: saiu da publicação `supabase_realtime` e virou
 * `useVisiblePoll` na aba de Logs.
 */
export function useAdminRealtime({ tab, isSuperAdmin, handlers }) {
  // Os handlers mudam de identidade a cada render dos hooks de domínio; o ref
  // evita remontar canal por causa disso.
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  const on = name => (...args) => handlersRef.current[name]?.(...args);

  // ─── Canal persistente ─────────────────────────────────────────────────────
  useEffect(() => {
    const canal = supabase.channel('admin-persistente')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => {
        on('refreshUnread')();
        on('onNotification')();
      });

    if (isSuperAdmin) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: 'unban_requests' }, () => {
        on('onUnbanRequest')();
      });
    }

    canal.subscribe();
    return () => supabase.removeChannel(canal);
  }, [isSuperAdmin]);

  // ─── Canal de moderação de lives — só enquanto a aba está aberta ───────────
  const abaDeLives = tab === 'lives' || tab === 'super';

  useEffect(() => {
    if (!abaDeLives) return undefined;

    const recarregar = () => on('fetchLiveMod')();

    const canal = supabase.channel('admin-lives')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_timeouts' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, recarregar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_reactivation_requests' }, recarregar)
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, [abaDeLives]);
}
