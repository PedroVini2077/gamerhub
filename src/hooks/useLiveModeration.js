import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

const ENDED_LIVES_WINDOW_DAYS = 7;
const ENDED_LIVES_LIMIT = 20;

const EMPTY = { silenced: [], lives: [], endedLives: [], requests: [] };

/**
 * Dados de moderação de lives: silenciamentos ativos, lives no ar, lives
 * encerradas recentemente e pedidos de reativação pendentes.
 *
 * `fetchLiveMod` é estável (`useCallback` sem deps) porque o canal de realtime
 * do Admin a chama — identidade nova a cada render re-assinaria o canal.
 */
export function useLiveModeration() {
  const [liveMod, setLiveMod] = useState(EMPTY);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLiveMod = useCallback(async () => {
    setRefreshing(true);
    const since = new Date(Date.now() - ENDED_LIVES_WINDOW_DAYS * 24 * 3600_000).toISOString();
    const [{ data: silenced }, { data: lives }, { data: endedLives }, { data: requests }] = await Promise.all([
      supabase.from('live_chat_timeouts').select('id, post_id, user_id, expires_at, profiles(username)')
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
      supabase.from('posts').select('id, title, user_id, profiles(username)')
        .eq('is_live', true).not('embed_url', 'is', null),
      supabase.from('posts').select('id, title, user_id, created_at, profiles(username)')
        .eq('was_live', true).eq('is_live', false).not('embed_url', 'is', null)
        .gte('created_at', since).order('created_at', { ascending: false }).limit(ENDED_LIVES_LIMIT),
      supabase.from('live_reactivation_requests').select('*')
        .eq('status', 'pending').order('created_at', { ascending: false }),
    ]);
    setLiveMod({
      silenced: silenced || [], lives: lives || [],
      endedLives: endedLives || [], requests: requests || [],
    });
    setRefreshing(false);
  }, []);

  return { liveMod, refreshing, fetchLiveMod };
}
