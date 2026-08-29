/**
 * De onde continuar ao clicar "Carregar mais" na aba Posts do painel admin.
 *
 * ── O bug que isto conserta ─────────────────────────────────────────────────
 *
 * A aba Posts tem duas sub-abas — "Posts ativos" e "Lixeira" — e mostra uma por
 * vez. A paginação, porém, **não era por sub-aba**: a consulta trazia os 20
 * posts mais recentes MISTURADOS, e o botão só aparecia em "ativos".
 *
 * O resultado era um no-op visível: se os 20 seguintes estivessem todos na
 * lixeira — provável, porque post antigo costuma estar apagado — o admin
 * clicava, o painel carregava de verdade, e **a lista na frente dele não
 * mudava**. Foi o CI que mostrou, ao consertar outro teste: 8 ativos antes,
 * 8 depois, com a paginação funcionando.
 *
 * Botão que carrega e não muda nada é indistinguível de botão quebrado, do
 * lado de quem clica (`CLAUDE.md` §1.5).
 *
 * ── Por que uma função pura, e não um `if` dentro do hook ───────────────────
 *
 * Porque o erro mora no OFFSET, e offset errado não estoura: ele pula ou repete
 * linhas em silêncio. A versão antiga usava `posts.length` — o tamanho da lista
 * INTEIRA — para continuar uma consulta que agora é filtrada. Com 8 ativos
 * dentro de 20 carregados, continuar do 20 pularia 12 posts ativos que nunca
 * apareceriam. Isolada, a conta tem teste.
 */

/** Quantos posts por página. Um bloco só, para as duas sub-abas. */
export const TAMANHO_DA_PAGINA = 20;

/** As duas sub-abas, e o que cada uma significa em `deleted_at`. */
export const SUB_ABAS = ['active', 'deleted'];

/**
 * @param {'active'|'deleted'} subAba
 * @param {number} jaCarregados quantos posts DAQUELA sub-aba já estão na tela
 * @returns {{apagados: boolean, de: number, ate: number}}
 * @throws quando a sub-aba não é conhecida — em vez de escolher uma por conta
 *   própria, que é o fallback silencioso proibido pelo §4.
 */
export function faixaDaPagina(subAba, jaCarregados) {
  if (!SUB_ABAS.includes(subAba)) {
    throw new Error(`sub-aba desconhecida na paginação de posts: ${subAba}`);
  }
  const de = Math.max(0, jaCarregados);
  return { apagados: subAba === 'deleted', de, ate: de + TAMANHO_DA_PAGINA - 1 };
}
