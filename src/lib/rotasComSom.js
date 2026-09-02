/**
 * Onde o som ambiente toca — e onde ele tem que PARAR.
 *
 * ── O pedido ────────────────────────────────────────────────────────────────
 *
 * Do dono, em 02/09: *"essa música deve funcionar em toda landing page, então
 * no sobre deve funcionar, regras e tals, até mesmo no login, chegando no site
 * em si que não é mais pra reproduzir"*.
 *
 * ── Por que uma lista fechada, e não "tudo que não é o site logado" ─────────
 *
 * Porque a regra invertida erra sozinha. `!ehRotaPrivada(x)` faria toda rota
 * NOVA nascer com música — inclusive uma futura `/checkout` ou `/painel-x` —
 * sem ninguém ter decidido. É o fallback silencioso do §4, na versão que
 * escolhe **a favor** de fazer barulho.
 *
 * Aqui o desconhecido é silêncio, que é o padrão seguro: uma rota nova que
 * devesse ter música aparece muda, alguém nota e acrescenta. O contrário — uma
 * rota nova tocando música sem querer — ninguém reporta como bug; a pessoa só
 * acha o site estranho.
 *
 * ── E o teste de contrato ──────────────────────────────────────────────────
 *
 * `rotasComSom.test.js` cruza esta lista com os `path=` do `App.jsx` e falha se
 * alguma rota daqui deixar de existir. Sem isso, renomear `/regras` deixaria
 * uma entrada morta que ninguém percebe.
 */

/**
 * As páginas da "camada de fora" — antes de entrar no site.
 *
 * `/` está aqui porque para o VISITANTE ela é a landing. Para quem está
 * logado ela é o feed, e aí a música não pode tocar — quem resolve isso é
 * `deveTocarSom`, que também recebe se há sessão.
 */
export const ROTAS_COM_SOM = [
  '/',
  '/sobre',
  '/regras',
  '/privacidade',
  '/termos',
  '/contato',
  '/login',
];

/**
 * @param {string} caminho `location.pathname`
 * @param {boolean} logado se existe sessão
 * @returns {boolean}
 *
 * A raiz é o único caso ambíguo do site: mesma URL, duas telas. Com sessão ela
 * é o feed, e o feed é "o site em si" — onde o dono pediu silêncio.
 */
export function deveTocarSom(caminho, logado) {
  if (caminho === '/') return !logado;
  return ROTAS_COM_SOM.includes(caminho);
}
