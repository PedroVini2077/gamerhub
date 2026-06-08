import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { fadeUpReveal, VIEWPORT } from '../../lib/landingMotion';

export default function FinalCTA() {
  return (
    <motion.section
      variants={fadeUpReveal} initial="initial" whileInView="animate" viewport={VIEWPORT}
      className="card p-10 md:p-14 text-center border-neon-green/20 relative overflow-hidden my-16"
    >
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" aria-hidden />
      <div className="relative space-y-5">
        <motion.div
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="inline-flex"
        >
          <Zap size={30} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 14px #39ff14)' }} />
        </motion.div>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-white">
          Pronto pra entrar pro <span className="text-neon-green">Hub</span>?
        </h2>
        <p className="text-gray-400 font-body max-w-md mx-auto">
          Crie sua conta gratuita e comece a postar, conversar, assistir lives e subir no ranking agora mesmo.
        </p>
        <Link to="/login" className="btn-solid py-3.5 px-10 text-sm inline-block">Criar minha conta</Link>
      </div>
    </motion.section>
  );
}
