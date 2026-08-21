import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

const NOTIF_LIMIT = 50;

/**
 * Público das notificações de staff que este usuário deve enxergar.
 *
 * O `owner` também é destinatário de `notify_owner` (audience 'owner'), que
 * antes só aparecia no painel do fundador — quem abrisse /admin como dono não
 * via os alertas enviados pela equipe.
 */
export function notifAudience(isSuperAdmin, isOwner) {
  const list = ['all_admins'];
  if (isSuperAdmin) list.push('super_admin');
  if (isOwner) list.push('owner');
  return list;
}

/**
 * Notificações de staff do painel admin, com controle de lidas por admin.
 *
 * Abrir a aba marca tudo como lido — por isso `fetchNotifications` faz o
 * upsert em `admin_notification_reads` e `refreshUnread` existe separada, pra
 * o realtime atualizar o badge SEM marcar nada como lido.
 */
export function useAdminNotifications({ userId, isSuperAdmin, isOwner }) {
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [notifLoading, setNotifLoading] = useState(false);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    const { data: reads } = await supabase.from('admin_notification_reads')
      .select('notification_id').eq('admin_id', userId);
    setReadIds(new Set((reads || []).map(r => r.notification_id)));
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setNotifLoading(true);
    const audience = notifAudience(isSuperAdmin, isOwner);
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase.from('admin_notifications').select('*').in('audience', audience)
        .order('created_at', { ascending: false }).limit(NOTIF_LIMIT),
      supabase.from('admin_notification_reads').select('notification_id').eq('admin_id', userId),
    ]);
    const rIds = new Set((reads || []).map(r => r.notification_id));
    setNotifications(notifs || []);
    setReadIds(rIds);

    const unread = (notifs || []).filter(n => !rIds.has(n.id));
    if (unread.length > 0) {
      await supabase.from('admin_notification_reads').upsert(
        unread.map(n => ({ notification_id: n.id, admin_id: userId })),
        { onConflict: 'notification_id,admin_id' },
      );
      setReadIds(new Set((notifs || []).map(n => n.id)));
    }
    setNotifLoading(false);
  }, [userId, isSuperAdmin, isOwner]);

  return {
    notifications, setNotifications,
    readIds, setReadIds,
    notifLoading, fetchNotifications, refreshUnread,
  };
}
