import { motion } from 'framer-motion';
import { heroTitle } from '../../lib/landingMotion';

// Traçado em zigue-zague determinístico (sem Math.random — mantém o
// componente puro/sem custo por render). `amplitude` maior = arco mais
// "violento"; `segments` maior = arco mais comprido. O sinal alterna a cada
// segmento, então o resultado já sai em zigue-zague sem precisar de sorteio.
function zigzagPath(x1, y1, x2, y2, segments, amplitude) {
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const x = x1 + (x2 - x1) * t + (i % 2 === 0 ? amplitude : -amplitude);
    const y = y1 + (y2 - y1) * t;
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d} L ${x2} ${y2}`;
}

// Arcos de tamanhos variados cruzando "GAMERHUB": alguns curtos (faísca
// dentro de uma letra), outros compridos atravessando a palavra inteira —
// alguns nascem acima do texto, como se a energia da logo 3D escorresse pra
// dentro da marca. Cada um com cor/duração/atraso próprios pra disparar em
// momentos diferentes (mesma lógica do Lightning.jsx, só que em SVG 2D).
const ARCS = [
  { d: zigzagPath(9, -4, 15, 15, 3, 1.6),    width: 0.5, color: '#7df9ff', dur: '3.4s', delay: '0s' },
  { d: zigzagPath(63, 3, 68, 17, 3, 1.3),    width: 0.45, color: '#00ffff', dur: '3.8s', delay: '1.2s' },
  { d: zigzagPath(33, 0, 43, 18, 4, 1.7),    width: 0.55, color: '#39ff14', dur: '4.4s', delay: '2.1s' },
  { d: zigzagPath(3, -7, 76, 19, 8, 2.6),    width: 0.7, color: '#bf00ff', dur: '5.2s', delay: '0.6s' },
  { d: zigzagPath(55, -5, 98, 16, 6, 2.2),   width: 0.6, color: '#39ff14', dur: '4.8s', delay: '3s' },
];

// Título do Hero com eletricidade de verdade correndo pela palavra: o "HUB"
// pisca como neon mal aterrado e arcos em zigue-zague (não ícones — traços
// reais, igual aos raios 3D) cruzam o texto em disparos espaçados.
export default function ElectricTitle() {
  return (
    <motion.h1
      variants={heroTitle} initial="initial" animate="animate"
      className="relative font-display font-black text-5xl md:text-7xl text-white mb-4"
    >
      GAMER
      <span className="text-neon-green animate-electric-buzz" style={{ textShadow: '0 0 30px #39ff14' }}>
        HUB
      </span>
      <svg
        aria-hidden
        viewBox="0 0 100 20"
        className="absolute -inset-x-3 -inset-y-4 w-[calc(100%+1.5rem)] h-[calc(100%+2rem)] pointer-events-none overflow-visible"
      >
        {ARCS.map((arc, i) => (
          <path
            key={i}
            d={arc.d}
            fill="none"
            stroke={arc.color}
            strokeWidth={arc.width}
            strokeLinecap="round"
            className="animate-electric-arc"
            style={{
              animationDuration: arc.dur,
              animationDelay: arc.delay,
              filter: `drop-shadow(0 0 1.5px ${arc.color})`,
            }}
          />
        ))}
      </svg>
    </motion.h1>
  );
}
