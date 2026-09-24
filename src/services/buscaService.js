import { supabase } from '../lib/supabase';
import { ok, fail } from './result';
import { POST_SELECT, attachEngagement } from './postSelect';

/**
 * `[24/09]` A BUSCA — consulta ao banco, não filtro do que já foi carregado.
 *
 * ── O que ela substitui ───────────────────────────────────────────────────
 *
 * Um `posts.filter(...)` no cliente, sobre a página que estava na tela. Com a
 * paginação isso ficou pior do que era: o campo dizia "Buscar posts" e
 * procurava nos 20 que a pessoa tinha rolado. Resposta errada apresentada como
 * completa — que é pior do que não ter busca.
 *
 * ── Por que as RPCs devolvem só IDS ───────────────────────────────────────
 *
 * Mesmo motivo da `feed_pagina`: o `POST_SELECT` já é a definição única do que
 * é um post na tela. Reescrevê-la em SQL criaria uma segunda, e é onde a
 * coluna errada vaza (§4).
 *
 * ── O teto, e por que ele é dito na tela ──────────────────────────────────
 *
 * A busca devolve no máximo 50. Ela **não pagina** — e isso é decisão, não
 * esquecimento: keyset por relevância não cabe no índice (o `ts_rank` é
 * calculado, não indexado), então paginar aqui seria `OFFSET` disfarçado, que
 * é exatamente o que a fase anterior tirou do feed.
 *
 * O preço é honesto e visível: quem chama recebe `noTeto`, e a tela diz que há
 * mais e pede para refinar. Busca que corta em silêncio é a mesma mentira do
 * filtro que ela substituiu.
 */

/** O teto das RPCs. Pedir mais devolve isto; pedir isto pode ter cortado. */
export const TETO_DA_BUSCA = 50;

/**
 * Posts que casam com o termo, por relevância.
 *
 * @returns {Promise<{data: {posts: Array, noTeto: boolean}, error: object|null}>}
 */
export async function buscarPosts(termo, viewerId = null) {
  const vazio = { posts: [], noTeto: false };
  if (!termo?.trim()) return ok(vazio);

  const { data: ordem, error } = await supabase.rpc('buscar_posts', {
    p_termo: termo,
    p_limite: TETO_DA_BUSCA,
  });
  if (error) return fail(error, vazio);
  if (!ordem?.length) return ok(vazio);

  const { data: linhas, error: erroLinhas } = await supabase
    .from('posts').select(POST_SELECT).in('id', ordem.map((o) => o.id));
  if (erroLinhas) return fail(erroLinhas, vazio);

  // Reordena pela relevância que veio do banco: `.in()` não garante ordem.
  const porId = new Map((linhas || []).map((l) => [l.id, l]));
  // `filter(Boolean)`: entre as duas consultas o post pode ter sido ocultado, e
  // aí a RLS não o devolve. Sumir é certo; virar buraco na lista, não.
  const posts = ordem.map((o) => porId.get(o.id)).filter(Boolean);

  return ok({
    posts: await attachEngagement(posts, viewerId),
    noTeto: ordem.length >= TETO_DA_BUSCA,
  });
}

/**
 * Pessoas cujo `username` casa com o termo.
 *
 * A RPC é `SECURITY DEFINER` porque as colunas pessoais de `profiles` são
 * revogadas de `authenticated` (SEC-025) — e a defesa é o recorte: ela devolve
 * `id`, `username`, `avatar_url` e `role`, e mais nada. Banido não aparece.
 */
export async function buscarPessoas(termo) {
  if (!termo?.trim()) return ok({ pessoas: [], noTeto: false });

  const { data, error } = await supabase.rpc('buscar_pessoas', {
    p_termo: termo,
    p_limite: TETO_DA_BUSCA,
  });
  if (error) return fail(error, { pessoas: [], noTeto: false });

  return ok({ pessoas: data || [], noTeto: (data?.length || 0) >= TETO_DA_BUSCA });
}
