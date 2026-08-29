import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Quantas pessoas estão no site agora.
 *
 * Saiu do `useAuth.jsx` junto com o vigia de banimento, pelo mesmo motivo: é
 * vigilância de um sistema externo (um canal de presence), não estado de
 * autenticação. A separação é mecânica — nada mudou de comportamento.
 *
 * O canal é global (`gamerhub-presence`) e único de propósito. Revisitar isso
 * está no `BACKLOG.md` como item de escala, para quando "online agora" passar
 * de algumas centenas.
 *
 * @param {string|undefined} userId
 * @returns {number} quantos estão online
 */
export function usePresenca(userId) {
  const [online, setOnline] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;

    const canal = supabase.channel('gamerhub-presence');
    canal
      .on('presence', { event: 'sync' }, () => {
        setOnline(Object.keys(canal.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await canal.track({ user_id: userId });
      });

    return () => supabase.removeChannel(canal);
  }, [userId]);

  return online;
}
