/**
 * Este erro é queda de REDE, ou é defeito do site?
 *
 * ── O bug que isto conserta ─────────────────────────────────────────────────
 *
 * Relato do dono em 03/09: *"quando o dispositivo que eu tava usando ficava
 * off, aparecia a msg que o banco tava fora do ar por alguns segundos, depois a
 * msg que algo deu errado no site e depois a msg genérica do navegador"*.
 *
 * As três, em sequência, contando três histórias diferentes sobre o mesmo
 * fato — e só a primeira era verdade:
 *
 * | O que aparecia | Quem mostrava | Era verdade? |
 * | --- | --- | --- |
 * | "sem acesso ao banco" | `AvisoSemBanco`, via `dbHealth` | **sim** |
 * | "Algo deu errado" | `ErrorBoundary` | **não** — nada deu errado no site |
 * | página de offline | o navegador | sim, mas é outro assunto |
 *
 * A segunda é a que dói, e é o §1.5 na letra: *"toda mensagem de erro tem que
 * ser verdadeira"*. Ela manda a pessoa achar que o site quebrou — e manda quem
 * for investigar procurar bug onde não há nenhum. O Wi-Fi caiu.
 *
 * ── Por que um módulo separado, e não um `if` dentro do boundary ────────────
 *
 * Porque a pergunta é **lógica pura** — recebe um erro, devolve booleano — e
 * assim ela tem teste próprio. O `ErrorBoundary` é class component e só é
 * exercitável montando árvore que estoura; a decisão de classificação não
 * precisa desse custo para ser provada.
 */

/**
 * As assinaturas de falha de rede, por navegador.
 *
 * Não existe tipo de erro padronizado para "o fetch não saiu": cada motor
 * escreve a própria frase. A lista vem das mensagens reais que os três motores
 * produzem quando o `fetch` falha por falta de conexão.
 *
 * `TypeError` é o que o `fetch` lança nesse caso — mas ele **também** é o que
 * um `undefined.map()` lança, então o tipo sozinho não decide nada. É a
 * combinação (tipo + frase) que separa os dois.
 */
const FRASES_DE_REDE = [
  'failed to fetch',          // Chrome / Edge
  'networkerror',             // Firefox: "NetworkError when attempting to fetch"
  'network request failed',   // React Native / alguns wrappers
  'load failed',              // Safari
  'the internet connection appears to be offline', // Safari, em iOS
  'err_internet_disconnected',
  'err_network_changed',
  'err_name_not_resolved',
];

/**
 * @param {unknown} erro o que o `ErrorBoundary` capturou
 * @returns {boolean} `true` só quando é queda de rede
 *
 * ── Por que ele NÃO usa `navigator.onLine` como resposta ───────────────────
 *
 * `navigator.onLine === false` prova que está offline, mas o contrário não
 * prova nada: `true` significa apenas "existe interface de rede", e ele
 * continua `true` com Wi-Fi conectado a um roteador sem internet. Usar só ele
 * daria falso negativo justamente no caso mais comum de queda.
 *
 * Então ele entra como **reforço**: se o navegador já admite que está offline,
 * qualquer erro naquele instante é rede. Se ele diz que está online, a decisão
 * volta para a frase do erro.
 */
export function ehFalhaDeRede(erro) {
  const texto = String(erro?.message ?? erro ?? '').toLowerCase();
  if (!texto) return false;

  if (FRASES_DE_REDE.some(f => texto.includes(f))) return true;

  // O reforço: offline declarado + qualquer erro = rede.
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  } catch { /* ambiente sem navigator */ }

  return false;
}
