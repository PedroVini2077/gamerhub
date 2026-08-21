import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Pedidos de desbanimento pendentes.
 *
 * Escopo por cargo: super admin/fundador vê todos os pedidos (é quem decide);
 * admin comum vê só os que ele mesmo abriu. O filtro está aqui E no RLS —
 * o cliente usa a anon key, então filtro só no frontend não protegeria nada.
 */
export function useUnbanRequests({ userId, isSuperAdmin }) {
  const [unbanRequests, setUnbanRequests] = useState([]);
  const [unbanReqLoading, setUnbanReqLoading] = useState(false);

  const fetchUnbanRequests = useCallback(async () => {
    if (!userId) return;
    setUnbanReqLoading(true);
    let q = supabase.from('unban_requests').select('*')
      .eq('status', 'pending').order('created_at', { ascending: false });
    if (!isSuperAdmin) q = q.eq('requesting_admin_id', userId);
    const { data } = await q;
    setUnbanRequests(data || []);
    setUnbanReqLoading(false);
  }, [userId, isSuperAdmin]);

  return { unbanRequests, unbanReqLoading, fetchUnbanRequests };
}
