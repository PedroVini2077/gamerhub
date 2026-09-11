/**
 * O orçamento de tempo da abertura, numa fonte só.
 *
 * ── Por que isto existe, e não é excesso de zelo ────────────────────────────
 *
 * `[11/09]` A abertura tem **três animações de CSS e um temporizador de
 * JavaScript** que precisam concordar. Se o temporizador disparar antes de o
 * brilho terminar, a landing abre por cima de uma animação pela metade; se
 * disparar muito depois, sobra tela parada. Nenhum dos dois estoura erro —
 * é §1.5 puro.
 *
 * Com os números escritos em dois lugares, eles divergem na primeira vez que
 * alguém afinar a duração de um deles. Aqui eles saem do mesmo lugar: o
 * JavaScript lê estas constantes, e o CSS lê as variáveis que
 * `variaveisDaAbertura()` escreve no próprio elemento.
 *
 * ── O orçamento, aprovado pelo dono em 11/09 ────────────────────────────────
 *
 * Ele topou ~2,15 s contra os 0,75 s da abertura anterior. O argumento que
 * sustentou o aumento: com a abertura virando o hero em vez de sumir, esse
 * tempo deixa de ser "tela preta antes do site" e passa a ser a chegada.
 */

/**
 * As fases, em milissegundos, na ordem em que acontecem.
 *
 * Cada uma é a DURAÇÃO da fase, não o instante em que ela começa — somar é
 * trabalho de `iniciosDaAbertura()`. Escrever instantes à mão foi considerado e
 * descartado: mexer numa duração obrigaria a recalcular todas as seguintes, que
 * é exatamente o tipo de conta que alguém erra em silêncio.
 */
export const FASES = {
  /** A luz atravessa a marca e ela fica pintada por onde a luz passou. */
  pinta: 550,
  /** Respiro. Sem ele a frase entra em cima do fim da pintura. */
  respiro: 150,
  /** A mesma luz segue e revela a frase. */
  escreve: 350,
  /** Tempo para ler. "Aqui o jogo continua." tem 21 caracteres. */
  leitura: 450,
  /** O reflexo de superfície polida, estreito e rápido. */
  brilho: 350,
  /** O véu abre e a landing aparece por trás. */
  abre: 300,
};

/** Quando cada fase COMEÇA, somando as anteriores. */
export function iniciosDaAbertura() {
  const inicios = {};
  let acumulado = 0;
  for (const [nome, duracao] of Object.entries(FASES)) {
    inicios[nome] = acumulado;
    acumulado += duracao;
  }
  return inicios;
}

/**
 * Quanto a abertura inteira dura.
 *
 * É este número que o temporizador usa como **teto absoluto** (§0.3, regra 3).
 * Ele não espera `animationend`: animação cortada — aba em segundo plano,
 * elemento removido, `prefers-reduced-motion` no meio — não dispara evento, e a
 * abertura ficaria na tela para sempre segurando a landing.
 */
export const DURACAO_TOTAL_MS = Object.values(FASES).reduce((a, b) => a + b, 0);

/**
 * As variáveis de CSS que o elemento da abertura carrega.
 *
 * O CSS lê `var(--t-pinta)` e companhia em vez de ter os números escritos nas
 * regras. É o que faz o arquivo de estilo e este módulo não poderem divergir.
 */
export function variaveisDaAbertura() {
  const inicios = iniciosDaAbertura();
  const vars = {};
  for (const [nome, duracao] of Object.entries(FASES)) {
    vars[`--dur-${nome}`] = `${duracao}ms`;
    vars[`--em-${nome}`] = `${inicios[nome]}ms`;
  }
  return vars;
}
