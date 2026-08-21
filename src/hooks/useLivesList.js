import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchActiveLives } from '../services/postService';

// Um post virando live dispara INSERT e UPDATE quase juntos; sem debounce
// cada um faria um fetch completo da lista.
const RELOAD_DEBOUNCE_MS = 400;

/** Lista de lives ativas, mantida em dia por realtime. */
export function useLivesList() {
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  // Serve tanto de carga inicial quanto do `reload` exposto.
  async function load() {
    const data = await fetchActiveLives();
    setLives(data);
    setLoading(false);
  }

  useEffect(() => {
    // set-state-in-effect é falso positivo aqui: a regra não enxerga através do
    // `await` de `load`, então lê o setState pós-fetch como se fosse síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();

    const reload = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(load, RELOAD_DEBOUNCE_MS);
    };

    const channel = supabase.channel('lives-list')
      // INSERT filtrado: sem isso, QUALQUER post criado no site (a esmagadora
      // maioria não é live) recarregava a lista de todo mundo em /lives.
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'posts', filter: 'is_live=eq.true',
      }, reload)
      // UPDATE fica sem filtro: é assim que a live ENCERRADA (is_live -> false)
      // sai da lista — um filtro `is_live=eq.true` justamente não entregaria
      // esse evento.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, reload)
      .subscribe();

    return () => { clearTimeout(debounceRef.current); supabase.removeChannel(channel); };
    // Deps vazias de propósito: o canal de realtime é montado UMA vez. Incluir
    // `load` aqui recriaria a subscription a cada render.
  }, []);

  // `reload` é a recarga IMEDIATA (sem debounce): quem acabou de criar a live
  // precisa vê-la na lista na hora, não depender do evento de realtime chegar.
  return { lives, loading, reload: load };
}
