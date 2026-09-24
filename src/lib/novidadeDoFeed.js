/**
 * `[24/09]` O aviso de "novas publicações" — o que conta, e o que ele diz.
 *
 * ── Os dois defeitos que isto conserta ────────────────────────────────────
 *
 * **1. O contador prometia post que o clique não trazia.** O handler de
 * realtime contava TODO `INSERT` em `posts`; a consulta do feed exclui
 * `live_kind IS NOT NULL`. Alguém abrir uma live incrementava "1 nova
 * publicação" para todo mundo com a aba aberta — e a recarga não trazia nada.
 * Mesma coisa para post que nasce OCULTO: o `checar_palavras_bloqueadas`
 * escreve `hidden_at` no próprio INSERT (conferido no banco), e a RLS esconde
 * a linha de quem não é da equipe.
 *
 * Nada estourava. O aviso simplesmente mentia, e a pessoa concluía que o site
 * estava travado — §1.5 com as três respostas em "nada".
 *
 * **2. O número não era medido, era acumulado.** Quem ficava com a aba aberta
 * duas horas somava eventos até um número que não correspondia a nada no
 * banco; quem acabava de entrar via zero com 200 posts novos desde a última
 * visita. O dono decidiu o teto em 24/09: mostrar `"20+"` em vez de um número
 * grande que o sistema não sabe sustentar.
 *
 * ── Por que módulo puro, e não dentro do hook ─────────────────────────────
 *
 * Porque a regra do que "entra no feed" precisa concordar com a consulta do
 * `fetchFeedPosts`, e essa concordância é testável sem montar React nem abrir
 * navegador. É deriva entre dois lugares — a Fase 4 do §6 —, e o jeito de não
 * deixá-la voltar é um teste de contrato que lê os dois.
 */

/**
 * O teto do aviso. Acima disso a tela diz `"20+"`.
 *
 * Decisão do dono em 24/09, entre três saídas: número exato (exigiria uma
 * consulta periódica só para contar — custo por usuário por minuto), número
 * com teto, ou só *"há novidades"*. O teto entrega a informação útil sem
 * prometer precisão que o mecanismo não tem.
 */
export const TETO_DE_NOVOS = 20;

/**
 * As colunas que a consulta do feed filtra, e que o aviso precisa respeitar.
 *
 * Escrito como lista para o teste de contrato poder cruzar com o
 * `fetchFeedPosts` — se a consulta ganhar um filtro novo e este arquivo não,
 * o teste falha nomeando a coluna. Sem isso a deriva volta em silêncio, que é
 * exatamente como o `live_kind` ficou de fora.
 */
export const COLUNAS_QUE_O_FEED_FILTRA = ['live_kind', 'deleted_at'];

/**
 * Este post apareceria no feed de quem está olhando?
 *
 * @param {object|null|undefined} post a linha do `payload.new` do realtime
 */
export function entraNoFeed(post) {
  if (!post) return false;
  // Live não entra no feed: ela tem tela própria (`/lives`), e a consulta do
  // feed a exclui por `live_kind`.
  if (post.live_kind != null) return false;
  // Nasce apagado não existe na prática; nasce OCULTO existe — a wordlist
  // escreve `hidden_at` no próprio INSERT.
  if (post.deleted_at != null) return false;
  if (post.hidden_at != null) return false;
  return true;
}

/**
 * Soma um, sem passar do teto.
 *
 * O teto é o que torna o rótulo honesto: ao chegar em `TETO_DE_NOVOS` a tela
 * para de contar e passa a dizer "pelo menos isto", que é a única coisa que o
 * mecanismo sabe de verdade.
 */
export function somarNovo(atual) {
  return Math.min(atual + 1, TETO_DE_NOVOS);
}

/**
 * O texto do botão. Devolve `null` quando não há nada a anunciar — quem chama
 * usa isso para decidir se o botão existe, em vez de repetir a comparação.
 */
export function rotuloDeNovos(quantidade) {
  if (!quantidade || quantidade < 1) return null;
  const plural = quantidade > 1 ? 'novas publicações' : 'nova publicação';
  // No teto, o número deixa de ser exato e o rótulo diz isso.
  const numero = quantidade >= TETO_DE_NOVOS ? `${TETO_DE_NOVOS}+` : String(quantidade);
  return `${numero} ${plural} — clique para ver`;
}
