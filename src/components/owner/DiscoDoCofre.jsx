/**
 * O disco do cofre — a única parte decorativa da tranca do Fundador.
 *
 * Desenho próprio em SVG, pela mesma razão do portão de boas-vindas: escala em
 * qualquer tela, cada peça se move sozinha, e não custa um arquivo de imagem.
 *
 * Laranja e não verde: é a cor do painel do Fundador em todo o site (`#f97316`
 * em `pages/Owner.jsx`), e trocar aqui faria a tranca parecer de outro lugar.
 *
 * O giro é `transform` puro, com `transform-box: view-box` — sem isso a origem
 * do `transform` num nó SVG é o canto do viewBox, e "girar no centro" vira
 * girar em torno do canto.
 */

/** Os oito pinos em volta do disco. */
const PINOS = Array.from({ length: 8 }, (_, i) => i * 45);
/** As marcas da escala — 24 riscos, como num cofre de verdade. */
const MARCAS = Array.from({ length: 24 }, (_, i) => i * 15);

const C = 100;
const R = 74;

export default function DiscoDoCofre({ girando }) {
  return (
    <svg
      viewBox="0 0 200 200" role="img" aria-label="Cofre do painel do Fundador"
      className={`w-36 h-36 mx-auto${girando ? ' cofre-girando' : ''}`}
    >
      <defs>
        <linearGradient id="cofreMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2019" />
          <stop offset="0.55" stopColor="#1a1410" />
          <stop offset="1" stopColor="#100c09" />
        </linearGradient>
        <filter id="cofreBrilho" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Encaixe: a sombra em que o disco se assenta. */}
      <circle cx={C} cy={C} r={R + 12} fill="#0b0906" stroke="#2b211a" strokeWidth="3" />

      <g className="cofre-disco">
        {/* Pinos */}
        <g fill="#241b14" stroke="#584231" strokeWidth="1.5">
          {PINOS.map((a) => (
            <rect key={a} x={C - 9} y={C - R - 14} width="18" height="20" rx="3"
                  transform={`rotate(${a} ${C} ${C})`} />
          ))}
        </g>

        <circle cx={C} cy={C} r={R} fill="url(#cofreMetal)" stroke="#6b4f39" strokeWidth="3" />

        {/* Escala */}
        <g stroke="#5d4531" strokeWidth="2" strokeLinecap="round">
          {MARCAS.map((a) => (
            <path key={a} d={`M${C} ${C - R + 6} L${C} ${C - R + 15}`}
                  transform={`rotate(${a} ${C} ${C})`} />
          ))}
        </g>

        <circle cx={C} cy={C} r={R - 26} fill="#0f0b08" stroke="#3d2d20" strokeWidth="2" />

        {/* O ponteiro: sem um ponto de referência, um disco girando é
            indistinguível de um disco parado. */}
        <path className="cofre-ponteiro" filter="url(#cofreBrilho)"
              d={`M${C} ${C - R + 4} L${C - 7} ${C - R + 20} L${C + 7} ${C - R + 20} Z`}
              fill="#f97316" />

        {/* Os braços da manopla. */}
        <g stroke="#7a5942" strokeWidth="7" strokeLinecap="round">
          <path d={`M${C} ${C - 34} L${C} ${C + 34}`} />
          <path d={`M${C - 34} ${C} L${C + 34} ${C}`} />
        </g>
        <circle cx={C} cy={C} r="13" fill="#1a1410" stroke="#f97316" strokeWidth="2.5" />
      </g>
    </svg>
  );
}
