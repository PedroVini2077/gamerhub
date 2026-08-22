import { supabase } from '../lib/supabase';
import { ok, fail } from './result';

const VAZIO = { keys: [], promos: [] };

export async function fetchGameKeys(limit = null) {
  let q = supabase.from('game_keys').select('*').order('created_at', { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) return fail(error, VAZIO);
  return ok({
    keys: (data || []).filter(k => !k.is_promo && k.key_code),
    promos: (data || []).filter(k => k.is_promo),
  });
}

// Chave única de cache pras estatísticas do site. Sidebar e RightPanel mostram
// os MESMOS três números — com chaves diferentes o React Query fazia as 6
// queries, duas vezes as mesmas contagens em toda página do app.
export const SITE_STATS_KEY = ['site_stats'];

const STATS_VAZIO = { users: 0, postsToday: 0, keysCount: 0 };

export async function fetchSiteStats() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [u, p, k] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', hoje.toISOString()),
    supabase.from('game_keys').select('*', { count: 'exact', head: true }).eq('is_promo', false),
  ]);

  const erro = u.error || p.error || k.error;
  if (erro) return fail(erro, STATS_VAZIO);
  return ok({ users: u.count || 0, postsToday: p.count || 0, keysCount: k.count || 0 });
}
