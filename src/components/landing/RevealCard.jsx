import { motion } from 'framer-motion';
import { fadeUpReveal, scanSweep, VIEWPORT } from '../../lib/landingMotion';

// Card que "surge" ao entrar na viewport: o conteúdo faz fade-up enquanto uma
// barra neon varre de cima pra baixo por cima dele — assinatura visual
// exclusiva dos mockups da Landing. A barra herda o estado do card por
// propagação de variants (mesmas chaves initial/animate em fadeUpReveal/scanSweep).
export default function RevealCard({ accent = 'green', className = '', children }) {
  const gradient = {
    green:  'from-neon-green/35',
    purple: 'from-neon-purple/35',
    cyan:   'from-neon-cyan/35',
  }[accent];

  return (
    <motion.div
      variants={fadeUpReveal} initial="initial" whileInView="animate" viewport={VIEWPORT}
      whileHover={{ y: -5 }}
      className={`relative overflow-hidden ${className}`}
    >
      {children}
      <motion.div
        aria-hidden
        variants={scanSweep}
        className={`absolute inset-0 origin-top bg-gradient-to-b ${gradient} via-transparent to-transparent pointer-events-none`}
      />
    </motion.div>
  );
}
