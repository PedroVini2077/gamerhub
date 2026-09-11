import verdeGuarda340 from '../assets/auth/verde-guarda-340.webp';
import verdeGuarda720 from '../assets/auth/verde-guarda-720.webp';
import roxoGuarda340 from '../assets/auth/roxo-guarda-340.webp';
import roxoGuarda720 from '../assets/auth/roxo-guarda-720.webp';
import verdeFrente340 from '../assets/auth/verde-frente-340.webp';
import verdeFrente720 from '../assets/auth/verde-frente-720.webp';
import roxoCostas340 from '../assets/auth/roxo-costas-340.webp';
import roxoCostas720 from '../assets/auth/roxo-costas-720.webp';

/**
 * As artes da tela de entrada, num lugar só.
 *
 * ── Por que elas saíram do componente ───────────────────────────────────────
 *
 * `[11/09]` Porque quem sabe que a arte vai ser necessária **não é a cena**: é
 * o botão de aba, que fica no formulário. A cena só descobre quando o modo já
 * mudou, e aí é tarde — o download começa depois do clique.
 *
 * Duas listas destas divergiriam em silêncio: a cena mostraria um arquivo e o
 * preparo buscaria outro, e o sintoma seria exatamente o que este módulo
 * existe para resolver, com o agravante de parecer resolvido (§4).
 */

/**
 * Qual par cada modo usa.
 *
 * Mapa EXPLÍCITO, e não um ternário: modo novo que ninguém mapeou devolve
 * `undefined` e estoura na hora, em vez de cair no par do login e mostrar a
 * cena errada sem nada acusar (§4, fallback silencioso).
 */
export const ARTES_POR_MODO = {
  login: {
    verde: { p: verdeGuarda340, g: verdeGuarda720 },
    roxo: { p: roxoGuarda340, g: roxoGuarda720 },
  },
  register: {
    verde: { p: verdeFrente340, g: verdeFrente720 },
    roxo: { p: roxoCostas340, g: roxoCostas720 },
  },
};

/**
 * O `sizes` do `srcset`, num lugar só — os dois lados usam o mesmo.
 *
 * Duas cópias divergindo fariam um lado escolher um arquivo e o outro escolher
 * outro, na mesma tela, sem nada acusar.
 */
export const TAMANHOS = '(max-width: 767px) 68vw, 620px';

/**
 * Começa a buscar o par de um modo **antes** de ele ser preciso.
 *
 * ── Por que na INTENÇÃO, e não no carregamento da página ────────────────────
 *
 * Buscar o outro par junto com a tela custa **215 KB** para todo mundo, e
 * metade das pessoas nunca abre a outra aba — medido em 04/09, e foi por isso
 * que a primeira versão disto foi descartada.
 *
 * Ponteiro em cima do botão, ou foco por teclado, é outra coisa: quem faz isso
 * está prestes a clicar. O custo passa a recair só sobre quem vai usar, e
 * compra os 100–300 ms entre o ponteiro chegar e o dedo apertar.
 *
 * ── O que ele NÃO faz ───────────────────────────────────────────────────────
 *
 * Ele não garante que a arte chegue a tempo — 218 KB a 1,5 Mbps levam ~1,2 s, e
 * nenhum adiantamento de 200 ms cobre isso. Quem garante que não aparece buraco
 * é o `Lutador`, que segura a arte velha até a nova estar pronta. Este aqui só
 * encurta a espera; os dois resolvem coisas diferentes e nenhum substitui o
 * outro.
 */
export function prepararArtesDe(modo) {
  const par = ARTES_POR_MODO[modo];
  if (!par || typeof Image === 'undefined') return;
  for (const lado of [par.verde, par.roxo]) {
    const img = new Image();
    img.sizes = TAMANHOS;
    // `srcset` e `sizes` iguais aos da cena: sem isso o navegador baixaria o
    // arquivo de 720 aqui e o de 340 lá, e o preparo não serviria para nada.
    img.srcset = `${lado.p} 340w, ${lado.g} 720w`;
    img.src = lado.g;
  }
}
