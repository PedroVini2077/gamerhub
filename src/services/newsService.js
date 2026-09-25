import { supabase } from '../lib/supabase';
import { from, ok } from './result';

/**
 * `[25/09]` O GAMERHUB NEWS — leitura.
 *
 * ── Por que não tem RPC aqui, ao contrário do feed e da busca ─────────────
 *
 * A policy de `news_articles` já diz tudo o que precisa ser dito:
 *
 *   (status = 'published' AND publicado_em <= now()) OR is_staff()
 *
 * Quem não é da equipe enxerga só o que está no ar, e o agendado **não vaza**
 * porque a data é comparada no banco, não na tela. Não há nada que a RLS não
 * expresse — então uma RPC aqui seria uma segunda definição de "artigo
 * visível", que é exatamente o que o §4 proíbe.
 *
 * O feed precisou de RPC por outro motivo (keyset, que o PostgREST não
 * expressa) e a busca por outro ainda (`ts_rank`). Aqui nenhum dos dois vale.
 *
 * ── O TETO, e por que ele é dito na tela ──────────────────────────────────
 *
 * A lista devolve no máximo `TETO_DA_LISTA` e **não pagina**. Isso é decisão,
 * não esquecimento: paginar por `publicado_em` sem desempate arrisca pular
 * artigo publicado no mesmo instante, e o desempate composto que o feed usa
 * exige RPC (o PostgREST não escreve `ROW(a,b) < ROW(x,y)`).
 *
 * Construir esse aparato para uma seção que hoje tem **zero** artigo seria
 * resolver um problema que ainda não existe. O que NÃO é aceitável é cortar em
 * silêncio — então quem chama recebe `noTeto` e a tela avisa. Quando o volume
 * pedir, a saída já está escrita no `BACKLOG.md`.
 */

/** O corte da lista. Bater nele significa que pode ter ficado artigo de fora. */
export const TETO_DA_LISTA = 30;

/**
 * As colunas da LISTA. `conteudo` fica FORA de propósito.
 *
 * Um artigo editorial tem corpo longo; trazer 30 corpos para desenhar 30
 * cartões é egress puro — a cota mais apertada do Supabase (§6.1). O corpo só
 * viaja quando alguém abre o artigo.
 */
const COLUNAS_DA_LISTA =
  'id, slug, titulo, subtitulo, resumo, capa_url, editoria, publicado_em, destaque, status';

/** O artigo inteiro, com o autor. `profiles` só entrega o que foi liberado. */
const COLUNAS_DO_ARTIGO =
  `${COLUNAS_DA_LISTA}, conteudo, fonte_url, created_at, updated_at,
   autor:profiles!news_articles_autor_id_fkey ( username, avatar_url, role )`;

/**
 * A lista de notícias.
 *
 * @param {{editoria?: string|null}} opcoes
 * @returns {Promise<{data: {artigos: Array, noTeto: boolean}, error: object|null}>}
 */
export async function fetchNoticias({ editoria = null } = {}) {
  const vazio = { artigos: [], noTeto: false };

  let q = supabase
    .from('news_articles')
    .select(COLUNAS_DA_LISTA)
    .eq('status', 'published')
    .order('publicado_em', { ascending: false })
    .limit(TETO_DA_LISTA + 1);

  // O filtro de editoria é conferido contra o vocabulário ANTES de virar
  // consulta: valor inventado vira lista vazia com cara de "não há nada",
  // e isso é mentira. Quem valida é a tela, que conhece o mapa.
  if (editoria) q = q.eq('editoria', editoria);

  const { data, error } = await q;
  if (error) return from({ error }, vazio);

  const artigos = (data ?? []).slice(0, TETO_DA_LISTA);
  return ok({ artigos, noTeto: (data ?? []).length > TETO_DA_LISTA });
}

/**
 * Um artigo pelo slug.
 *
 * `maybeSingle` e não `single`: slug que não existe é caminho NORMAL (link
 * velho, artigo despublicado, alguém digitando na barra). `single` devolveria
 * erro e a tela mostraria "algo deu errado" onde o certo é "não achamos isto".
 */
export async function fetchArtigo(slug) {
  if (!slug) return ok(null);
  return from(
    await supabase.from('news_articles').select(COLUNAS_DO_ARTIGO).eq('slug', slug).maybeSingle(),
    null,
  );
}

/**
 * As tags de um artigo.
 *
 * Separado da consulta do artigo de propósito: tag é enfeite, e um erro aqui
 * não pode impedir o texto de aparecer. Quem chama trata `[]` como "sem tag",
 * que é indistinguível de "deu erro" — e aqui isso é aceitável, porque a
 * alternativa é esconder a notícia por causa de uma etiqueta.
 */
export async function fetchTagsDoArtigo(articleId) {
  if (!articleId) return ok([]);
  const { data, error } = await supabase
    .from('news_article_tags')
    .select('tag:news_tags ( slug, nome )')
    .eq('article_id', articleId);

  if (error) return from({ error }, []);
  return ok((data ?? []).map((l) => l.tag).filter(Boolean));
}
