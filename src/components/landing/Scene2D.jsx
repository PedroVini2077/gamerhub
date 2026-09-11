// Decoração do Hero em SVG + CSS puro — a versão leve da cena 3D.
//
// ── Por que ela existe ──────────────────────────────────────────────────────
//
// A cena 3D (`scene3d/LandingScene.jsx`) custa 887 KB de JavaScript, quase
// tudo three.js: o código usa cinco símbolos da biblioteca, mas o renderer
// WebGL inteiro vem junto e não há tree-shaking que alcance isso. Num celular
// mediano, o Lighthouse mediu 13,9 s de main thread e 3,7 s de bloqueio — e
// era esse bloqueio que engolia o raio de abertura, porque animação do
// framer-motion é guiada por relógio: main thread travada não deixa a
// animação lenta, faz ela PULAR para o fim.
//
// Esta cena tem custo de JavaScript ZERO em tempo de execução: são elementos
// SVG estáticos animados por `@keyframes` do CSS, que rodam no compositor do
// navegador e não disputam a main thread com nada.
//
// ── O que ela desenha ───────────────────────────────────────────────────────
//
// O mesmo arranjo da cena 3D, para a landing não mudar de cara entre um
// aparelho e outro: o raio-logo no alto do centro, e quatro formas de contorno
// nos cantos, nas mesmas cores (verde, roxo, âmbar, ciano).
//
// `motion-reduce:animate-none` desliga o movimento para quem pediu menos
// movimento no sistema — por isso esta cena pode aparecer inclusive nesse
// modo, em vez de deixar o Hero vazio como antes.

// Silhueta idêntica à do `useBoltGeometry()` da cena 3D. O eixo Y do SVG
// cresce para baixo, então os sinais estão invertidos em relação ao THREE.Shape.
const RAIO = 'M 0.06 -0.85 L -0.7 0.12 L -0.04 0.12 L -0.06 0.85 L 0.7 -0.12 L 0.04 -0.12 Z';

// Cada forma carrega o próprio desenho em vez de haver um mapa `tipo -> svg`.
// É de propósito: mapa com chave desconhecida devolve `undefined` e some em
// silêncio (CLAUDE.md §4). Aqui não existe chave para errar.
const FORMAS = [
  {
    chave: 'orbe',
    cor: '#39ff14',
    posicao: 'left-[6%] top-[14%] w-24 h-24 md:w-36 md:h-36',
    atraso: '0s',
    opacidade: 0.32,
    desenho: (
      <>
        <circle cx="50" cy="50" r="34" />
        <ellipse cx="50" cy="50" rx="34" ry="13" />
        <ellipse cx="50" cy="50" rx="13" ry="34" />
      </>
    ),
  },
  {
    chave: 'toro',
    cor: '#bf00ff',
    posicao: 'right-[8%] top-[18%] w-20 h-20 md:w-32 md:h-32',
    atraso: '-2.2s',
    opacidade: 0.34,
    desenho: (
      <>
        <ellipse cx="50" cy="50" rx="36" ry="16" />
        <ellipse cx="50" cy="50" rx="20" ry="8" />
      </>
    ),
  },
  {
    chave: 'octaedro',
    cor: '#ffa33a',
    posicao: 'left-[10%] bottom-[16%] w-16 h-16 md:w-28 md:h-28',
    atraso: '-4.4s',
    opacidade: 0.3,
    desenho: (
      <>
        <path d="M50 12 L84 50 L50 88 L16 50 Z" />
        <path d="M16 50 L50 62 L84 50" />
        <path d="M50 12 L50 88" />
      </>
    ),
  },
  {
    chave: 'icosaedro',
    cor: '#00ffff',
    posicao: 'right-[12%] bottom-[20%] w-16 h-16 md:w-28 md:h-28',
    atraso: '-6.6s',
    opacidade: 0.3,
    desenho: (
      <>
        <path d="M50 14 L83 34 L83 66 L50 86 L17 66 L17 34 Z" />
        <path d="M17 34 L50 50 L83 34" />
        <path d="M50 50 L50 86" />
      </>
    ),
  },
];

export default function Scene2D() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Raio-logo: mesma posição de destaque que o `LogoBolt` ocupa em 3D.
          São DOIS divs de propósito. O de fora centraliza com
          `-translate-x-1/2`; o de dentro anima. Juntos no mesmo elemento, o
          `transform` do `@keyframes` substitui o do Tailwind por inteiro e o
          raio aparece descentralizado — foi o que aconteceu na primeira
          versão, e só o print no viewport de celular mostrou. */}
      <div className="absolute left-1/2 top-[11%] -translate-x-1/2">
        <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-52 md:h-52 animate-bolt-float motion-reduce:animate-none">
          <svg
            viewBox="-0.9 -1 1.8 2"
            className="w-full h-full"
            style={{ filter: 'drop-shadow(0 0 10px #39ff14) drop-shadow(0 0 34px #39ff1470)' }}
          >
            <path d={RAIO} fill="#39ff14" fillOpacity="0.16" stroke="#39ff14" strokeWidth="0.045" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {FORMAS.map(({ chave, cor, posicao, atraso, opacidade, desenho }) => (
        <div
          key={chave}
          className={`absolute ${posicao} animate-shape-drift motion-reduce:animate-none`}
          style={{ animationDelay: atraso }}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            fill="none"
            stroke={cor}
            strokeWidth="1.6"
            style={{ opacity: opacidade, filter: `drop-shadow(0 0 6px ${cor}55)` }}
          >
            {desenho}
          </svg>
        </div>
      ))}
    </div>
  );
}
