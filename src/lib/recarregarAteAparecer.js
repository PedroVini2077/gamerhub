/**
 * Recarrega uma lista até o item recém-criado aparecer nela.
 *
 * ── O bug que originou isto (02/09) ─────────────────────────────────────────
 *
 * Publicar e o post não aparecer no feed. Ficou dias no backlog como
 * intermitente ("uma vez em sete") até o CI deixar evidência no banco:
 *
 *   post criado ....... 10:18:03, `deleted_at` nulo — existia mesmo
 *   feed capturado .... 10:18:33, TRINTA segundos depois, sem ele
 *   e mostrando ....... um post que já tinha sido apagado às 10:18:10
 *
 * A leitura trouxe dado **anterior à escrita**, e o `createPost` já havia
 * retornado com sucesso. É leitura logo após escrita caindo numa conexão do
 * pool que ainda não enxergava a linha.
 *
 * ── Por que um `refetch()` sozinho nunca resolveria ─────────────────────────
 *
 * Ele recebeu uma resposta **válida** — só que velha. Não existe erro para
 * tratar, não existe nada para logar, e como ninguém tentava de novo, o feed
 * ficava mentindo até a pessoa navegar. Do lado dela: o site comeu o que ela
 * escreveu. Falha silenciosa clássica (§1.5).
 *
 * ── Por que isto é uma função separada, e testável ──────────────────────────
 *
 * A corrida acontece dentro do pool de conexões do Supabase e **não se
 * reproduz num navegador de teste**. Uma trava de e2e aqui seria decoração —
 * padrão de falha catalogado meu. Extraindo a decisão para uma função pura, o
 * comportamento vira testável de verdade: dá para simular a resposta velha.
 */

/** Esperas entre as tentativas. Crescentes, e curtas de propósito. */
const ESPERAS_MS = [200, 400, 800];

/**
 * @param {() => Promise<any[]>} recarregar  devolve a lista atual
 * @param {string} idEsperado                o que precisa estar nela
 * @param {object} [opcoes]
 * @param {(ms: number) => Promise<void>} [opcoes.esperar]  injetável no teste
 * @returns {Promise<boolean>} se o item apareceu
 *
 * O atraso do pool é de milissegundos. Se em ~1,4 s ainda não apareceu, o
 * problema é outro — e insistir mais só faria a tela parecer travada, que é
 * trocar um defeito por outro.
 */
export async function recarregarAteAparecer(recarregar, idEsperado, {
  esperar = (ms) => new Promise(r => setTimeout(r, ms)),
} = {}) {
  const temOItem = (lista) => Array.isArray(lista) && lista.some(i => i?.id === idEsperado);

  if (temOItem(await recarregar())) return true;
  // Sem id não há o que conferir: quem chamou só queria recarregar.
  if (!idEsperado) return true;

  for (const ms of ESPERAS_MS) {
    await esperar(ms);
    if (temOItem(await recarregar())) return true;
  }
  return false;
}
