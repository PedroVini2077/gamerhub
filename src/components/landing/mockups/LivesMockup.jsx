import { motion } from 'framer-motion';
import { Tv, Play } from 'lucide-react';
import RevealCard from '../RevealCard';

export default function LivesMockup() {
  return (
    <RevealCard accent="cyan" className="card p-5 space-y-3 border-neon-cyan/20 max-w-sm mx-auto">
      <div className="relative h-32 rounded-md bg-dark-700 border border-dark-500 flex items-center justify-center overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 bg-neon-cyan/5"
        />
        <Play size={28} className="text-neon-cyan relative" style={{ filter: 'drop-shadow(0 0 10px #00ffff)' }} />
        <span className="absolute top-2 left-2 tag bg-red-500/20 text-red-400 border border-red-500/40">● AO VIVO</span>
        <span className="absolute bottom-2 right-2 text-[10px] text-gray-400 font-mono bg-dark-900/70 px-1.5 py-0.5 rounded">
          312 espectadores
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Tv size={15} className="text-neon-cyan" />
        <p className="text-sm text-white font-medium">Ranqueada até o topo — bora?</p>
      </div>
      <div className="space-y-1.5">
        {['@gg_mary: bora time!', '@nox: cuidado atrás 👀'].map(t => (
          <p key={t} className="text-xs text-gray-500 font-mono truncate">{t}</p>
        ))}
      </div>
    </RevealCard>
  );
}
