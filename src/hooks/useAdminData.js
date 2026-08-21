import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifAudience } from './useAdminNotifications';

// Posts/keys crescem sem limite com o uso do site — pagina em blocos pra não
// carregar tudo de uma vez (landmine de escalabilidade do `fetchAll` antigo).
// Usuários continuam carregados por inteiro: a busca/filtros/badges de role do
// UsersPanel dependem da lista completa, e a base de usuários cresce bem mais
// devagar que posts.
const PAGE_SIZE = 20;
const MAX_USERS = 1000;

/**
 * Carga principal do painel admin: usuários, posts, keys e contadores.
 *
 * Recebe `setNotifications`/`setReadIds` de fora de propósito. Eles pertencem
 * ao `useAdminNotifications`, mas as duas consultas entram no MESMO
 * `Promise.all` da carga inicial — separar viraria uma segunda ida ao servidor
 * a cada refresh, sem ganho nenhum.
 */
export function useAdminData({ userId, isSuperAdmin, isOwner, setNotifications, setReadIds }) {
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState({ users: 0, posts: 0, keys: 0 });
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [keysHasMore, setKeysHasMore] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loadingMoreKeys, setLoadingMoreKeys] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    const audience = notifAudience(isSuperAdmin, isOwner);
    const [
      { data: u }, { data: p }, { data: k },
      { count: postsCount }, { count: activePostsCount }, { count: keysCount },
      { data: allNotifs }, { data: reads },
    ] = await Promise.all([
      supabase.rpc('admin_list_users', { p_limit: MAX_USERS }),
      supabase.from('posts').select('*, profiles(username)').order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
      supabase.from('game_keys').select('*').order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('game_keys').select('id', { count: 'exact', head: true }),
      supabase.from('admin_notifications').select('id').in('audience', audience),
      supabase.from('admin_notification_reads').select('notification_id').eq('admin_id', userId),
    ]);
    setUsers(u || []);
    setPosts(p || []);
    setKeys(k || []);
    setPostsHasMore((p?.length || 0) < (postsCount ?? 0));
    setKeysHasMore((k?.length || 0) < (keysCount ?? 0));
    setStats({ users: u?.length || 0, posts: activePostsCount ?? 0, keys: keysCount ?? k?.length ?? 0 });
    setReadIds(new Set((reads || []).map(r => r.notification_id)));
    setNotifications(allNotifs || []);
    setLoading(false);
  }

  async function loadMorePosts() {
    setLoadingMorePosts(true);
    const { data, count } = await supabase
      .from('posts').select('*, profiles(username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(posts.length, posts.length + PAGE_SIZE - 1);
    const next = [...posts, ...(data || [])];
    setPosts(next);
    setPostsHasMore(next.length < (count ?? next.length));
    setLoadingMorePosts(false);
  }

  async function loadMoreKeys() {
    setLoadingMoreKeys(true);
    const { data, count } = await supabase
      .from('game_keys').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(keys.length, keys.length + PAGE_SIZE - 1);
    const next = [...keys, ...(data || [])];
    setKeys(next);
    setKeysHasMore(next.length < (count ?? next.length));
    setLoadingMoreKeys(false);
  }

  return {
    users, posts, keys, stats, loading,
    postsHasMore, keysHasMore, loadingMorePosts, loadingMoreKeys,
    fetchAll, loadMorePosts, loadMoreKeys,
  };
}
