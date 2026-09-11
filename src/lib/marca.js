/**
 * O caminho da marca — FONTE ÚNICA, derivada da arte por medição.
 *
 * `[11/09]` Ele mora sozinho num arquivo porque três lugares precisam dele e
 * nenhum deles pode ter a própria cópia: o componente React (`MarcaGH.jsx`), o
 * favicon estático (`public/favicon.svg`) e o gerador de ícones do PWA
 * (`scripts/gerar-icones.mjs`). Três cópias de um `d` de 487 caracteres é a
 * receita do §4 para divergirem — e divergir aqui significa a marca do
 * navegador não ser a marca do site.
 *
 * **Não editar à mão.** Ele sai de `scripts/tracar-marca.mjs`, que lê os pixels
 * da arte oficial em `docs/identidade/referencias/`. Para mudar a marca, troca-se
 * a arte e roda-se o tracador de novo — o que mantém a arte como a fonte, e este
 * arquivo como derivado.
 *
 * A fidelidade foi medida em 1,80% da área, toda na borda de 1 px do
 * anti-serrilhado. A conferência é `scripts/conferir-fidelidade.mjs`.
 */
export const CAMINHO_DA_MARCA = 'M46.18 0.46 L49.54 0.76 L60.55 7.8 L61.16 27.06 L58.1 28.29 L51.99 24.31 L48.01 23.39 L20.18 40.21 L20.18 61.62 L39.76 73.85 L43.12 73.24 L43.12 62.84 L33.94 57.03 L33.64 46.64 L50.15 36.24 L52.6 36.54 L64.22 43.27 L71.25 39.91 L72.48 12.69 L75.23 12.69 L85.02 18.2 L97.86 25.54 L100 28.29 L100 71.71 L99.08 73.55 L79.2 83.94 L77.98 82.42 L77.98 53.98 L76.76 53.98 L61.47 62.23 L61.47 88.53 L60.55 90.67 L46.48 99.24 L43.12 99.24 L4.59 76.3 L0.31 72.63 L0 29.82 L2.14 26.45 L46.18 0.76 Z';

/**
 * O gradiente, MEDIDO na arte — eixo e paradas, não escolhidos por mim.
 *
 * `[11/09]` A primeira versão foi um chute meu: eixo diagonal, três paradas.
 * Renderizada ao lado da arte, o verde aparecia como um cantinho enquanto no
 * original ele domina o lado esquerdo. Medir desmentiu o chute em dois pontos:
 *
 *   - o eixo é **horizontal** (esquerda -> direita), não diagonal;
 *   - o verde ocupa os primeiros ~30%, não os primeiros 10%.
 *
 * As paradas saem da média de cor por faixa do ícone colorido da folha de arte
 * (7.754 pixels de marca, agrupados em 6 faixas ao longo do eixo). Os extremos
 * usam a matiz de PICO — a média de faixa puxa para o meio, e nas pontas é o
 * pico que o olho lê.
 */
export const PARADAS_DO_GRADIENTE = [
  { pos: 0, cor: '#00e012' },   // verde, pico
  { pos: 26, cor: '#02dc69' },  // verde-ciano, medido
  { pos: 46, cor: '#01b2c8' },  // ciano, medido
  { pos: 68, cor: '#3044e6' },  // azul, medido
  { pos: 84, cor: '#423af9' },  // azul-violeta, medido
  { pos: 100, cor: '#a000fd' }, // roxo, pico
];

/** As três matizes de pico, para quem precisa de uma cor só. */
export const CORES_DA_MARCA = {
  verde: '#00ed54',
  azul: '#009dfc',
  roxo: '#a000fd',
};
