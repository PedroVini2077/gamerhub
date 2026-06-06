import { supabase } from '../lib/supabase';

export async function fetchGameKeys(limit = null) {
  let q = supabase.from('game_keys').select('*').order('created_at', { ascending: false });
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return {
    keys: (data || []).filter(k => !k.is_promo && k.key_code),
    promos: (data || []).filter(k => k.is_promo),
  };
}

export async function fetchSiteStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [{ count: users }, { count: postsToday }, { count: keysCount }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('game_keys').select('*', { count: 'exact', head: true }).eq('is_promo', false),
  ]);

  return { users: users || 0, postsToday: postsToday || 0, keysCount: keysCount || 0 };
}
