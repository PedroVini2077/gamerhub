import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { heroTitle } from '../../lib/landingMotion';

// Raios decorativos ao redor de "GAMERHUB" — posições/tempos fixos (sem
// Math.random no render) pra continuar puro; a ilusão de aleatoriedade vem
// de cada um ter duração e atraso de animação diferentes (CSS only).
const SPARKS = [
  { pos: '-top-3 left-[14%]',     color: 'text-neon-cyan',   size: 14, rotate: -30, dur: '3.6s', delay: '0s' },
  { pos: '-top-4 right-[18%]',    color: 'text-neon-green',  size: 12, rotate: 20,  dur: '4.4s', delay: '1.3s' },
  { pos: '-bottom-3 left-[26%]',  color: 'text-neon-purple', size: 12, rotate: 195, dur: '3.9s', delay: '2.4s' },
  { pos: '-bottom-4 right-[12%]', color: 'text-neon-cyan',   size: 14, rotate: 160, dur: '4.8s', delay: '0.7s' },
];

// Título do Hero com efeito de "letra energizada": o HUB pisca como neon mal
// aterrado e raios saltam nas bordas em disparos espaçados — eletricidade na
// marca em si, não só nos objetos 3D ao redor.
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
      {SPARKS.map((s, i) => (
        <span key={i} aria-hidden className={`absolute ${s.pos} ${s.color}`} style={{ transform: `rotate(${s.rotate}deg)` }}>
          <Zap
            size={s.size}
            className="animate-electric-spark"
            style={{ animationDuration: s.dur, animationDelay: s.delay, filter: 'drop-shadow(0 0 6px currentColor)' }}
          />
        </span>
      ))}
    </motion.h1>
  );
}
