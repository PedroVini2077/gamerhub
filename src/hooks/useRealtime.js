import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Assina mudanças de uma tabela via Realtime.
 *
 * @param {string} table
 * @param {(payload: object) => void} callback
 * @param {object}  [options]
 * @param {string|string[]} [options.events] 'INSERT' | 'UPDATE' | 'DELETE' ou
 *        lista. Default: todos (`*`).
 * @param {string}  [options.filter] filtro do Postgres Changes (ex.: `id=eq.x`).
 *
 * Assinar só os eventos que o handler realmente usa importa em custo: cada
 * mudança na tabela vira uma mensagem para CADA cliente conectado. O feed, por
 * exemplo, só reage a INSERT/DELETE — receber todo UPDATE de post seria tráfego
 * de realtime jogado fora, multiplicado pelo número de usuários online.
 */
export function useRealtime(table, callback, options = {}) {
  // O ref é atualizado num efeito, não durante o render: escrever em ref no
  // corpo do componente é inseguro com renderização concorrente (o React pode
  // descartar um render). Como o ref só é LIDO dentro do handler da
  // subscription — que nunca dispara antes da montagem — atualizar depois do
  // commit é suficiente e correto.
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; });

  const { events = '*', filter } = options;
  // Serializa pra dep estável: o objeto de options muda de identidade a cada
  // render e re-assinaria o canal sem necessidade.
  const eventsKey = Array.isArray(events) ? events.join(',') : events;

  useEffect(() => {
    const list = eventsKey.split(',');
    const channelName = `realtime-${table}-${Math.random().toString(36).slice(2)}`;
    let channel = supabase.channel(channelName);

    for (const event of list) {
      channel = channel.on(
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => callbackRef.current(payload),
      );
    }

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, eventsKey, filter]);
}
