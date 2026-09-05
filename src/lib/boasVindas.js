/**
 * Quem acabou de entrar, e se é a primeira vez neste navegador.
 *
 * ── Por que existe um módulo só para isto ───────────────────────────────────
 *
 * A tela de boas-vindas precisa de duas respostas, e as duas são fáceis de
 * responder errado:
 *
 * 1. **"a pessoa acabou de entrar AGORA?"** — e não "está logada", que é o que
 *    acontece em todo recarregamento de página. Sem essa distinção, a tela
 *    apareceria a cada F5, que é o oposto de boas-vindas.
 * 2. **"é a primeira vez?"** — para a frase mudar.
 *
 * Ficam aqui, e não dentro do componente, porque assim dá para testar sem
 * navegador: são as duas coisas que quebram em silêncio se alguém trocar a
 * chave de armazenamento ou o tempo de vida dela.
 *
 * ── As duas escolhas de armazenamento, e elas são diferentes de propósito ───
 *
 * | | onde | por quê |
 * | --- | --- | --- |
 * | "acabou de entrar" | `sessionStorage` | morre ao fechar a aba. Recarregar a página NÃO deve reabrir a tela, e é isso que a diferencia do `localStorage` |
 * | "já entrou antes" | `localStorage` | precisa sobreviver ao fechamento do navegador, senão todo dia seria "primeira vez" |
 *
 * ── O que "primeira vez" NÃO é ──────────────────────────────────────────────
 *
 * É primeira vez **neste navegador**, não primeira vez na vida. Quem entrar de
 * outro aparelho vai ver a saudação de estreia de novo.
 *
 * Isso é escolha, não limitação esquecida: a alternativa seria um contador de
 * login no banco — mais uma escrita por login, mais uma coluna, e o §0.2 deste
 * projeto já registra que contador de login foi justamente o que não deu para
 * fazer direito no plano Free. Para escolher entre duas frases de saudação, o
 * preço não se paga.
 *
 * ── Armazenamento pode LANÇAR, e não só falhar ──────────────────────────────
 *
 * Em aba anônima de alguns navegadores, e com cookies de site bloqueados,
 * `sessionStorage`/`localStorage` lançam ao serem acessados — não devolvem
 * `null`. Por isso todo acesso aqui está em `try`. O pior caso é a tela não
 * aparecer; nunca é a pessoa não conseguir entrar.
 */

const CHAVE_ENTRANDO = 'gh_entrando';

/**
 * O aviso de que a marca acabou de ser escrita.
 *
 * ── Por que um evento, e não só a chave ─────────────────────────────────────
 *
 * Sem ele existe uma CORRIDA, e ela derrubou o e2e na primeira execução: o
 * `onAuthStateChange` do Supabase preenche o `user` **antes** de
 * `signInWithPassword` devolver, então a tela de boas-vindas conferia o
 * `sessionStorage` num instante em que a marca ainda não existia — e, como o
 * `user` não muda de novo, ela nunca mais reconferia.
 *
 * O evento tira o resultado do acaso da ordem: quem marca AVISA. Se o aviso
 * chegar antes de o `user` existir, a conferência acontece de novo quando ele
 * chega; se chegar depois, o aviso reconfere na hora. As duas ordens funcionam.
 */
export const EVENTO_ENTROU = 'gh:entrou';

/**
 * O aviso de que a entrada NÃO vai acontecer.
 *
 * ── Por que ele existe, e é §1.3 puro ───────────────────────────────────────
 *
 * Com a marca escrita ANTES do login, existe uma janela: o `onAuthStateChange`
 * preenche o `user` assim que a senha é aceita — **antes** de a checagem de ban
 * terminar. Nessa janela o portão consome a marca e sobe; quando
 * `cancelarEntradaAgora()` roda, já não há marca para apagar.
 *
 * Hoje isso não aparece na tela porque a `BannedScreen` tem `z-[9999]` e o
 * portão tem `z-index: 80`. Só que isso é **proteção acidental**, que este
 * projeto já registrou como a pior espécie: basta alguém mexer num `z-index`
 * para o portão passar a dar as boas-vindas a quem acabou de ser barrado.
 *
 * O aviso fecha a classe em vez do caso: quem cancela AVISA, e o portão sai
 * na hora — não importa quem esteja por cima.
 */
export const EVENTO_CANCELADO = 'gh:entrada-cancelada';
const PREFIXO_JA_ENTROU = 'gh_ja_entrou:';

/**
 * Chamado ANTES de pedir o login ao servidor.
 *
 * ── `[05/09]` Por que "antes", e não "quando deu certo" ─────────────────────
 *
 * Marcar no sucesso parece o certo e produziu o defeito que o dono relatou:
 * *"assim que eu logava, eu via o site por alguns segundos, depois aparecia o
 * portão"*. A ordem real é essa:
 *
 *     signInWithPassword ... o onAuthStateChange preenche o `user` AQUI,
 *                            antes de a promessa voltar
 *     -> o App troca de rota e o site PINTA
 *     get_own_profile ...... mais uma ida ao servidor
 *     logAudit ............. mais uma
 *     marcarEntradaAgora ... só agora o portão fica sabendo
 *
 * Entre a pintura e a marca cabem duas viagens de rede — os "alguns segundos".
 * Marcando antes, a marca já existe no instante em que o `user` aparece, e o
 * portão sobe no MESMO quadro (ver o `useLayoutEffect` em
 * `PortaoDeBoasVindas.jsx`). O site nunca chega a ser visto.
 *
 * O preço é que a marca passa a significar *"entrada em andamento"* e pode
 * sobrar se a entrada não se completar — daí `cancelarEntradaAgora()`.
 */
export function marcarEntradaAgora() {
  try {
    sessionStorage.setItem(CHAVE_ENTRANDO, '1');
  } catch {
    // Sem armazenamento, a tela de boas-vindas simplesmente não aparece.
  }
  // O aviso vai FORA do try: mesmo sem armazenamento, avisar não custa nada e
  // mantém o comportamento previsível.
  try {
    window.dispatchEvent(new Event(EVENTO_ENTROU));
  } catch {
    // Ambiente sem `window` (teste de nó puro): nada a avisar.
  }
}

/**
 * Desfaz a marca quando a entrada NÃO se completou.
 *
 * Três caminhos precisam disto, e cada um por um motivo diferente:
 * senha errada (não houve entrada), conta banida (houve, mas quem foi barrado
 * não é recebido com festa) e erro de rede (não se sabe). Sem isto, a marca
 * ficaria na aba esperando o próximo `user` para abrir um portão sem causa.
 */
export function cancelarEntradaAgora() {
  try {
    sessionStorage.removeItem(CHAVE_ENTRANDO);
  } catch {
    // Sem armazenamento não havia marca para desfazer.
  }
  // FORA do try: se o portão já tiver consumido a marca, apagá-la não basta —
  // é o aviso que o tira da tela. Ver `EVENTO_CANCELADO`.
  try {
    window.dispatchEvent(new Event(EVENTO_CANCELADO));
  } catch {
    // Ambiente sem `window` (teste de nó puro): nada a avisar.
  }
}

/**
 * Consome a marca: responde uma vez e apaga.
 *
 * Consumir em vez de só ler é o que impede a tela de voltar quando o React
 * remontar o componente por qualquer motivo.
 */
export function consumirEntradaAgora() {
  try {
    const tem = sessionStorage.getItem(CHAVE_ENTRANDO) === '1';
    if (tem) sessionStorage.removeItem(CHAVE_ENTRANDO);
    return tem;
  } catch {
    return false;
  }
}

/** É a primeira entrada DESTE usuário NESTE navegador? */
export function ehPrimeiraVez(idDoUsuario) {
  if (!idDoUsuario) return false;
  try {
    return localStorage.getItem(PREFIXO_JA_ENTROU + idDoUsuario) !== '1';
  } catch {
    // Sem armazenamento, trata como "já entrou": errar para "bem-vindo de
    // volta" é menos estranho do que dar as boas-vindas de estreia a alguém
    // que usa o site há meses.
    return false;
  }
}

/** Registra que este usuário já entrou uma vez neste navegador. */
export function registrarQueJaEntrou(idDoUsuario) {
  if (!idDoUsuario) return;
  try {
    localStorage.setItem(PREFIXO_JA_ENTROU + idDoUsuario, '1');
  } catch {
    // idem
  }
}
