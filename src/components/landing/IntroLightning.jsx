import { motion } from 'framer-motion';

// Raio de abertura do Hero: um raio verde grande "cai" do topo até o centro
// da tela, estoura num clarão verde e some — e só então o conteúdo do Hero
// aparece. Coordenado por tempo: o traço se desenha (pathLength), o clarão
// estoura no ponto de impacto e, por fim, o fundo escuro some chamando
// onComplete (que libera as informações do Hero).

// Raio principal + uma bifurcação, em viewBox 0..100 (slice cobre a tela).
const BOLT = 'M 55 -6 L 46 18 L 54 21 L 44 40 L 52 43 L 47 56';
const FORK = 'M 54 21 L 61 33 L 56 36';

const boltDraw = {
  initial: { pathLength: 0, opacity: 1 },
  animate: {
    pathLength: 1,
    opacity: [1, 1, 0],
    transition: {
      pathLength: { duration: 0.3, ease: 'easeIn' },
      opacity: { duration: 0.75, times: [0, 0.5, 1], ease: 'easeOut' },
    },
  },
};

export default function IntroLightning({ onComplete }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-dark-900 overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.45, delay: 0.82, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
    >
      {/* Flash verde rápido na tela inteira — o "estouro" do impacto. */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at center, rgba(57,255,20,0.9) 0%, rgba(57,255,20,0.45) 40%, rgba(57,255,20,0.15) 100%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.85, 0] }}
        transition={{ duration: 0.34, delay: 0.28, times: [0, 0.25, 1], ease: 'easeOut' }}
      />

      {/* Clarão verde — estoura no impacto e se expande sumindo. */}
      <motion.div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: '60vmax',
          height: '60vmax',
          background:
            'radial-gradient(circle, rgba(235,255,230,1) 0%, rgba(160,255,120,0.95) 14%, rgba(57,255,20,0.55) 34%, rgba(57,255,20,0.15) 55%, transparent 72%)',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0.9, 2.4], opacity: [0, 1, 0] }}
        transition={{ duration: 0.72, delay: 0.28, times: [0, 0.35, 1], ease: 'easeOut' }}
      />

      {/* Raio descendo do topo até o centro. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        style={{ filter: 'drop-shadow(0 0 2px #39ff14) drop-shadow(0 0 7px #39ff14)' }}
      >
        <motion.path
          d={BOLT} fill="none" stroke="#39ff14" strokeWidth="1.4"
          strokeLinecap="round" strokeLinejoin="round"
          variants={boltDraw} initial="initial" animate="animate"
        />
        <motion.path
          d={FORK} fill="none" stroke="#7dff5e" strokeWidth="0.9"
          strokeLinecap="round" strokeLinejoin="round"
          variants={boltDraw} initial="initial" animate="animate"
        />
      </svg>
    </motion.div>
  );
}
