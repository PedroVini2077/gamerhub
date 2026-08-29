import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifAudience } from './useAdminNotifications';
import { faixaDaPagina, TAMANHO_DA_PAGINA } from '../lib/paginacaoDePosts';

// Posts/keys crescem sem limite com o uso do site — pagina em blocos pra não
// carregar tudo de uma vez (landmine de escalabilidade do `fetchAll` antigo).
// Usuários continuam carregados por inteiro: a busca/filtros/badges de role do
// UsersPanel dependem da lista completa, e a base de usuários cresce bem mais
// devagar que posts.
const PAGE_SIZE = TAMANHO_DA_PAGINA;
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
  // `[29/08]` Um `hasMore` POR SUB-ABA, e não um só. A aba Posts mostra
  // "ativos" ou "lixeira", uma por vez, e as duas se esgotam em momentos
  // diferentes — um booleano só fazia o botão sumir de uma sub-aba por causa
  // do fim da outra. Ver `lib/paginacaoDePosts.js`.
  const [postsHasMore, setPostsHasMore] = useState({ active: false, deleted: false });
  const [keysHasMore, setKeysHasMore] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loadingMoreKeys, setLoadingMoreKeys] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── `[29/08]` As três funções são MEMOIZADAS, e isso não é estilo ──────────
  //
  // Elas eram funções soltas, recriadas a cada render. O `Admin.jsx` as usa
  // dentro de `useEffect`, e incluí-las nas dependências — que é o que o
  // `exhaustive-deps` pede — faria o painel recarregar em laço infinito. A
  // saída na época foi suprimir a regra em três lugares.
  //
  // Supressão é dívida com juros: ela cala o aviso e deixa a dependência
  // DESONESTA, então a próxima pessoa que acrescentar uma dep de verdade não
  // recebe ajuda nenhuma do lint. Memoizar resolve a causa — as deps ficam
  // completas e o efeito para de mentir.
  //
  // `loadMorePosts` e `loadMoreKeys` dependem de `posts.length`/`keys.length`
  // para saber de onde continuar, então entram nas deps. Elas trocam de
  // identidade quando a lista cresce, que é exatamente quando devem trocar.
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const audience = notifAudience(isSuperAdmin, isOwner);
    const [
      { data: u }, { data: ativos }, { data: apagados }, { data: k },
      { count: postsCount }, { count: activePostsCount }, { count: keysCount },
      { data: allNotifs }, { data: reads },
    ] = await Promise.all([
      supabase.rpc('admin_list_users', { p_limit: MAX_USERS }),
      // Duas consultas de posts, uma por sub-aba, em vez de uma misturada. A
      // mistura era o bug: os 20 mais recentes podiam ser quase todos da
      // lixeira, e a sub-aba "ativos" abria com dois itens e um botão que não
      // mudava nada. Custo: uma ida a mais no MESMO `Promise.all` — nenhum
      // round-trip extra.
      supabase.from('posts').select('*, profiles(username)').is('deleted_at', null)
        .order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
      supabase.from('posts').select('*, profiles(username)').not('deleted_at', 'is', null)
        .order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
      supabase.from('game_keys').select('*').order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('game_keys').select('id', { count: 'exact', head: true }),
      supabase.from('admin_notifications').select('id').in('audience', audience),
      supabase.from('admin_notification_reads').select('notification_id').eq('admin_id', userId),
    ]);
    setUsers(u || []);
    // Uma lista só na saída, como antes: o `PostsPanel` já separa por
    // `deleted_at`, e mudar o contrato dele não faz parte deste conserto.
    setPosts([...(ativos || []), ...(apagados || [])]);
    setKeys(k || []);
    setPostsHasMore({
      active: (ativos?.length || 0) < (activePostsCount ?? 0),
      deleted: (apagados?.length || 0) < Math.max(0, (postsCount ?? 0) - (activePostsCount ?? 0)),
    });
    setKeysHasMore((k?.length || 0) < (keysCount ?? 0));
    setStats({ users: u?.length || 0, posts: activePostsCount ?? 0, keys: keysCount ?? k?.length ?? 0 });
    setReadIds(new Set((reads || []).map(r => r.notification_id)));
    setNotifications(allNotifs || []);
    setLoading(false);
  }, [userId, isSuperAdmin, isOwner, setNotifications, setReadIds]);

  // Recebe a sub-aba VISÍVEL. Sem isso ela continuava do tamanho da lista
  // inteira numa consulta que agora é filtrada — offset errado não estoura,
  // ele pula linhas em silêncio. A conta está em `lib/paginacaoDePosts.js`,
  // isolada porque é onde o erro mora.
  const loadMorePosts = useCallback(async (subAba = 'active') => {
    const jaCarregados = posts.filter(
      p => (subAba === 'deleted' ? !!p.deleted_at : !p.deleted_at),
    ).length;
    const { apagados, de, ate } = faixaDaPagina(subAba, jaCarregados);

    setLoadingMorePosts(true);
    let consulta = supabase
      .from('posts').select('*, profiles(username)', { count: 'exact' })
      .order('created_at', { ascending: false });
    consulta = apagados
      ? consulta.not('deleted_at', 'is', null)
      : consulta.is('deleted_at', null);
    const { data, count } = await consulta.range(de, ate);

    setPosts(atuais => [...atuais, ...(data || [])]);
    setPostsHasMore(atual => ({
      ...atual,
      [subAba]: jaCarregados + (data?.length || 0) < (count ?? 0),
    }));
    setLoadingMorePosts(false);
  }, [posts]);

  const loadMoreKeys = useCallback(async () => {
    setLoadingMoreKeys(true);
    const { data, count } = await supabase
      .from('game_keys').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(keys.length, keys.length + PAGE_SIZE - 1);
    const next = [...keys, ...(data || [])];
    setKeys(next);
    setKeysHasMore(next.length < (count ?? next.length));
    setLoadingMoreKeys(false);
  }, [keys]);

  return {
    users, posts, keys, stats, loading,
    postsHasMore, keysHasMore, loadingMorePosts, loadingMoreKeys,
    fetchAll, loadMorePosts, loadMoreKeys,
  };
}
