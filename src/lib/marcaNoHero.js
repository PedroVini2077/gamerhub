/**
 * A POSIÇÃO COMBINADA da marca — o contrato entre a abertura e o hero.
 *
 * ── O problema que este arquivo resolve ─────────────────────────────────────
 *
 * `[11/09]` A ideia do dono é que a abertura não termine: *"a logo ir para o
 * centro da landing... uma transição da tela (intro) suave para a landing"*. Ou
 * seja, a marca que a abertura desenha é **a mesma** que fica no hero.
 *
 * O caminho óbvio seria a marca VOAR até onde o hero a quer, medindo aquele
 * ponto. **E ele não funciona aqui**, por um motivo conferido no código:
 * `AberturaDaMarca` é importado estaticamente no `App.jsx`, e a `Landing` é
 * `lazy`. Enquanto a abertura toca, o hero **pode ainda não existir** — medir
 * exige o hero montado, e esperar por ele traz de volta o defeito que a
 * separação consertou em 02/09 (o raio só aparecia depois de o chunk baixar:
 * 1.320 ms a 6× de CPU, tela preta o tempo todo).
 *
 * ── A saída, que é a mesma do cruzamento das artes da arena ─────────────────
 *
 * Os dois lados concordam **de antemão** sobre onde a marca fica. A abertura
 * termina com ela ali; o hero desenha a dele no mesmo ponto; a troca é um
 * cruzamento, não um voo. Sem medição, sem espera, e nada quebra se a landing
 * demorar a chegar.
 *
 * **Por isso os valores moram aqui e não nos dois componentes:** escritos duas
 * vezes, eles divergem na primeira vez que alguém afinar um. E a divergência
 * seria invisível em teste de unidade — só apareceria como um salto na tela, no
 * meio de uma transição, que é o tipo de defeito que ninguém consegue descrever
 * depois (§1.5). A trava está em `src/lib/__tests__/marca.test.js`.
 */

/**
 * O centro, em porcentagem da janela.
 *
 * 49% e não 50%: é onde o bloco de texto do hero se centra (sobrancelha,
 * título, parágrafo, botão e o link de conta bloqueada), e é o mesmo ponto para
 * onde os trajetos do `ConvergenciaDoHub` convergem. Com a marca aqui, eles
 * deixam de apontar para espaço vazio e passam a apontar para ela.
 */
export const CENTRO_DA_MARCA = { x: '50%', y: '49%' };

/**
 * O tamanho enquanto a abertura toca, e depois que ela assenta no hero.
 *
 * `vmin` e não `vw`: a marca é quadrada, e amarrá-la à menor dimensão da tela é
 * o que a mantém contida em pé e deitado sem um único `@media`. O teto em pixel
 * impede que ela fique gigante num monitor grande.
 */
export const TAMANHO_NA_ABERTURA = 'min(46vmin, 300px)';
export const TAMANHO_NO_HERO = 'min(64vmin, 460px)';

/**
 * A opacidade da marca depois que ela assenta.
 *
 * Baixa de propósito, e não é timidez: no hero ela fica **atrás do texto**, e o
 * parágrafo precisa continuar legível. O que dá presença a ela ali não é o
 * brilho — é o movimento próprio e a reação ao ponteiro.
 */
export const OPACIDADE_NO_HERO = 0.16;
