import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export default function LandingNav() {
  return (
    <motion.nav
      initial={{ y: -56, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 inset-x-0 z-40 backdrop-blur-md bg-dark-900/70 border-b border-dark-600"
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 8px #39ff14)' }} />
          <span className="font-display font-bold text-lg text-neon-green tracking-wider">GAMER</span>
          <span className="font-display font-bold text-lg text-white tracking-wider">HUB</span>
        </div>
        <Link to="/login" className="btn-neon py-2 px-5 text-[11px]">Entrar</Link>
      </div>
    </motion.nav>
  );
}
