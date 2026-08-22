// Contrato único de retorno da camada de services.
//
// Antes cada função devolvia o que dava na telha — o levantamento achou QUATRO
// formatos convivendo entre 73 funções:
//
//   30x dado puro          `const posts = await fetchPosts()`
//   26x promise crua do supabase  (vazava `count`, `status`, `statusText`...)
//   11x forma própria      `{ url, error }`, `{ id, error }`
//    6x nada               (fire-and-forget)
//
// O custo disso não é estética: quem chama precisa lembrar, função por função,
// se o erro vem no retorno, se foi engolido, ou se nem existe. Foi assim que
// erro de upload de mídia e de envio no chat passaram batido — o valor era
// descartado e ninguém percebia.
//
// A partir daqui é sempre `{ data, error }`:
//
//   data   o que a função produz. Em leitura que falha, mantém o vazio seguro
//          que ela já devolvia (`[]` para lista, `null` para item), então quem
//          chama pode ignorar o erro sem quebrar a tela.
//   error  `null` em sucesso; o objeto de erro do supabase (ou `{ message }`)
//          em falha. Nunca engolido silenciosamente — ver CLAUDE.md §4.

/** Sucesso. */
export const ok = (data = null) => ({ data, error: null });

/** Falha. `vazio` é o que `data` deve conter para a tela não quebrar. */
export const fail = (error, vazio = null) => ({ data: vazio, error });

/**
 * Normaliza a resposta crua do supabase-js para o contrato.
 *
 * O supabase devolve `{ data, error, count, status, statusText }`; deixar isso
 * vazar amarra o resto do app ao formato dele. Aqui só passam `data` e `error`.
 */
export function from(res, vazio = null) {
  if (res?.error) return fail(res.error, vazio);
  return ok(res?.data ?? vazio);
}

/**
 * Para escrita que precisa saber QUANTAS linhas mudaram.
 *
 * A RLS nega em silêncio: devolve 0 linhas e nenhum erro. Sem checar a
 * contagem, o app diz "sucesso" e nada aconteceu — foi exatamente o que
 * escondeu, por meses, a moderação de comentário e mural nunca ter funcionado.
 */
export function fromCount(res, mensagemSeZero) {
  if (res?.error) return fail(res.error);
  if (!res?.count) return fail({ message: mensagemSeZero });
  return ok(res.count);
}

// ─── Auxiliares para o React Query ───────────────────────────────────────────

/**
 * `queryFn` que PROPAGA o erro — o React Query passa a saber que falhou e a
 * tela pode mostrar estado de erro em vez de fingir lista vazia.
 */
export async function unwrap(promessa) {
  const { data, error } = await promessa;
  if (error) throw error;
  return data;
}

/**
 * `queryFn` que DESCARTA o erro e devolve o vazio seguro.
 *
 * Existe para os lugares onde esse já era o comportamento antes do contrato:
 * trocar para `unwrap` ali mudaria a tela (passaria a exibir erro onde hoje
 * exibe zero/lista vazia), e isso é decisão de UX, não de refactor.
 */
export async function apenasData(promessa) {
  return (await promessa).data;
}
