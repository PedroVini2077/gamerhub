import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLog';
import toast from 'react-hot-toast';

/**
 * Logins travados por excesso de tentativas (aba Super Admin).
 *
 * O desbloqueio é registrado na auditoria com severidade `warning`: pode
 * estar liberando um invasor, então precisa ficar rastreável.
 */
export function useBlockedLogins({ actorUsername }) {
  const [blockedLogins, setBlockedLogins] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [unlockModal, setUnlockModal] = useState(null);

  const fetchBlockedLogins = useCallback(async () => {
    setBlockedLoading(true);
    const { data } = await supabase.rpc('get_blocked_logins');
    setBlockedLogins(data || []);
    setBlockedLoading(false);
  }, []);

  const confirmUnlock = useCallback(async () => {
    const entry = unlockModal;
    if (!entry) return;
    const { error } = await supabase.rpc('admin_unlock_login', { p_email: entry.email });
    if (error) { toast.error('Erro ao desbloquear'); return; }
    logAudit('admin_unlock_login',
      `@${actorUsername} desbloqueou o login de ${entry.email} (${entry.attempts} tentativas${entry.permanent ? ', bloqueio permanente' : ''})`,
      { category: 'security', severity: 'warning' });
    toast.success(`${entry.email} desbloqueado`);
    setUnlockModal(null);
    fetchBlockedLogins();
  }, [unlockModal, actorUsername, fetchBlockedLogins]);

  return {
    blockedLogins, blockedLoading, fetchBlockedLogins,
    unlockModal, setUnlockModal, confirmUnlock,
  };
}
