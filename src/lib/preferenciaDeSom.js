/**
 * A decisão da pessoa sobre o som ambiente — e ela tem TRÊS estados, não dois.
 *
 * ── O bug que isto conserta ─────────────────────────────────────────────────
 *
 * A versão anterior gravava `'ligado'` ao ligar e fazia `removeItem` ao
 * desligar. Ou seja, "desliguei de propósito" e "nunca cheguei a escolher"
 * viravam **exatamente a mesma ausência de chave** — dois estados diferentes
 * colapsados num valor só, que é a família do fallback silencioso (§4).
 *
 * Enquanto nada tocava sozinho, isso não fazia diferença. **Passa a fazer no
 * mesmo instante em que existe autoplay:** quem desligou o som receberia ele
 * de volta na próxima visita, porque o site não teria como distinguir essa
 * pessoa de alguém que acabou de chegar. Um site que religa um som que você
 * desligou é um site que não te escuta.
 *
 * Por isso o desligar agora **grava**, e a ausência de chave passa a significar
 * uma coisa só: ninguém decidiu ainda.
 *
 * ── Por que `localStorage` e não `sessionStorage` ───────────────────────────
 *
 * É preferência, não estado de sessão: ela deve sobreviver a fechar o
 * navegador. É o contrário da intro do raio (`introJaVista.js`), que é
 * deliberadamente por sessão.
 */

const CHAVE = 'gh_som_ambiente';

export const LIGADO = 'ligado';
export const DESLIGADO = 'desligado';
/** Ninguém escolheu ainda. É o estado de quem chega pela primeira vez. */
export const SEM_DECISAO = 'sem-decisao';

/**
 * Os valores que este módulo aceita ler do armazenamento.
 *
 * Mapa fechado de propósito: um valor estranho na chave — lixo de uma versão
 * antiga, extensão do navegador, alguém editando à mão — precisa cair em
 * `SEM_DECISAO`, e não ser tratado como "ligado" por acidente. Ligar som
 * sozinho por causa de um valor que ninguém reconhece seria o pior desfecho
 * possível dos três.
 */
const CONHECIDOS = new Set([LIGADO, DESLIGADO]);

/**
 * @returns {'ligado'|'desligado'|'sem-decisao'}
 *
 * Nunca lança: `localStorage` estoura em modo privado e com armazenamento
 * cheio, e a landing não pode cair por causa de um enfeite. Não conseguir
 * lembrar é o mesmo que ainda não ter decidido.
 */
export function preferenciaDeSom() {
  try {
    const valor = window.localStorage.getItem(CHAVE);
    return CONHECIDOS.has(valor) ? valor : SEM_DECISAO;
  } catch {
    return SEM_DECISAO;
  }
}

/**
 * Grava a decisão. `escolha` precisa ser `LIGADO` ou `DESLIGADO`.
 *
 * @returns {boolean} se conseguiu gravar. Falhar aqui só faz a pessoa ter que
 *   escolher de novo na próxima visita — nunca quebra nada.
 */
export function gravarPreferenciaDeSom(escolha) {
  if (!CONHECIDOS.has(escolha)) return false;
  try {
    window.localStorage.setItem(CHAVE, escolha);
    return true;
  } catch {
    return false;
  }
}

/**
 * Se o site pode TENTAR tocar sozinho depois da intro.
 *
 * As três respostas, e cada uma tem razão própria:
 *
 * | Estado | Tenta? | Por quê |
 * | --- | --- | --- |
 * | `LIGADO` | sim | a pessoa já disse que quer; retomar é cumprir a escolha |
 * | `SEM_DECISAO` | sim, **uma vez** | é a "tentativa" que o dono pediu. O navegador quase sempre barra, e barrado significa que ninguém ouviu nada — custo zero para quem não queria |
 * | `DESLIGADO` | **nunca** | ela desligou. Tentar de novo é ignorar a única coisa que ela disse |
 *
 * A linha do `DESLIGADO` é a que justifica este arquivo inteiro existir.
 */
export function podeTentarSozinho(estado) {
  return estado === LIGADO || estado === SEM_DECISAO;
}
