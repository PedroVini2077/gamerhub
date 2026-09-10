// As peças que orbitam o raio na cena da Landing — dados, sem JSX.
//
// ── Por que este arquivo existe separado ────────────────────────────────────
//
// `Scene2D.jsx` desenha; aqui ficam os números. Junto, o componente passava de
// 300 linhas (§4) e a composição virava um paredão de coordenadas onde ninguém
// acha nada.
//
// ── A leitura da referência, e o que dela é PERMANENTE ──────────────────────
//
// A cena de referência (`docs/identidade/referencias/10-cena-da-landing.webp`)
// tem quatro camadas de profundidade, e é isso que a faz parecer um espaço em
// vez de um cartaz:
//
//   1. atmosfera   — névoa esverdeada, sem forma
//   2. fragmentos LONGE  — pequenos, nítidos, quase parados
//   3. os anéis + o RAIO — o plano em foco
//   4. fragmentos PERTO  — grandes, MUITO desfocados, cortados pela borda
//
// A camada 4 é a que engana o olho: na referência os cristais dos cantos estão
// fora de foco e saem do quadro. É profundidade de campo, e é de graça em CSS
// (`blur` + `scale`). Sem ela, tudo vira adesivo colado no mesmo plano.

/**
 * Os anéis de energia que circundam o núcleo.
 *
 * `rx`/`ry` em porcentagem do quadro da cena. A inclinação diferente em cada um
 * é o que dá a sensação de órbita em 3D — três elipses no mesmo ângulo leriam
 * como alvo de tiro.
 */
export const ANEIS = [
  { chave: 'externo', rx: 46, ry: 15, giro: -18, duracao: '38s', sentido: 'normal',  opacidade: 0.5,  espessura: 0.9 },
  { chave: 'medio',   rx: 34, ry: 11, giro: 12,  duracao: '26s', sentido: 'reverse', opacidade: 0.65, espessura: 1.1 },
  { chave: 'interno', rx: 22, ry: 7.5, giro: -34, duracao: '18s', sentido: 'normal',  opacidade: 0.8,  espessura: 1.3 },
];

/**
 * Os fragmentos de cristal.
 *
 * `profundidade` decide desfoque, escala e opacidade juntos — são a MESMA
 * informação vista de três jeitos, e separá-las deixaria criar um fragmento
 * "perto e nítido", que quebra a ilusão.
 *
 * `atraso` é negativo de propósito: a animação começa no meio, então os
 * fragmentos não sobem todos no mesmo instante como um pelotão.
 */
export const FRAGMENTOS = [
  // longe — pequenos e nítidos, atrás dos anéis
  { chave: 'l1', profundidade: 'longe', x: 18, y: 26, tamanho: 26, giro: 24,   atraso: '-3s',   cor: '#39ff14' },
  { chave: 'l2', profundidade: 'longe', x: 79, y: 21, tamanho: 20, giro: -38,  atraso: '-11s',  cor: '#7de3ff' },
  { chave: 'l3', profundidade: 'longe', x: 71, y: 58, tamanho: 16, giro: 62,   atraso: '-7s',   cor: '#c56bff' },
  { chave: 'l4', profundidade: 'longe', x: 27, y: 62, tamanho: 22, giro: -14,  atraso: '-15s',  cor: '#39ff14' },
  // meio — o plano do raio
  { chave: 'm1', profundidade: 'meio',  x: 12, y: 44, tamanho: 44, giro: -28,  atraso: '-5s',   cor: '#39ff14' },
  { chave: 'm2', profundidade: 'meio',  x: 86, y: 40, tamanho: 38, giro: 41,   atraso: '-13s',  cor: '#a855f7' },
  // perto — grandes, desfocados e CORTADOS pela borda (é o que dá profundidade)
  { chave: 'p1', profundidade: 'perto', x: -6,  y: 72, tamanho: 150, giro: 18,  atraso: '-9s',  cor: '#39ff14' },
  { chave: 'p2', profundidade: 'perto', x: 104, y: 78, tamanho: 132, giro: -22, atraso: '-2s',  cor: '#8b5cf6' },
];

/** Desfoque, escala e opacidade andam juntos — ver o comentário acima. */
export const POR_PROFUNDIDADE = {
  longe: { blur: '1.5px', opacidade: 0.42, z: 1 },
  meio:  { blur: '0px',   opacidade: 0.78, z: 3 },
  perto: { blur: '14px',  opacidade: 0.3,  z: 6 },
};

/**
 * A silhueta de um fragmento — um losango cristalino com uma faceta interna.
 *
 * É UMA forma só, girada e escalada por fragmento, em vez de oito desenhos
 * diferentes. A faceta interna é o que separa "cristal" de "losango": ela pega
 * a luz de um lado só.
 */
export const FRAGMENTO_EXTERNO = 'M50 4 L88 42 L50 96 L12 42 Z';
export const FRAGMENTO_FACETA  = 'M50 4 L88 42 L50 52 Z';
