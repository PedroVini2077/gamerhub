import { motion } from 'framer-motion';
import { Trophy, Crown, Star } from 'lucide-react';
import RevealCard from '../RevealCard';

const TIERS = [
  { icon: Crown, label: 'Lendário', pct: '92%', accent: 'text-neon-green' },
  { icon: Star,  label: 'Veterano', pct: '64%', accent: 'text-neon-purple' },
  { icon: Trophy, label: 'Novato',  pct: '28%', accent: 'text-neon-cyan' },
];

export default function RanksMockup() {
  return (
    <RevealCard accent="green" className="card p-5 space-y-4 border-neon-green/20 max-w-sm mx-auto">
      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-neon-green" />
        <span className="font-display text-xs text-neon-green tracking-widest uppercase">Ranks & XP</span>
      </div>
      {TIERS.map(({ icon: Icon, label, pct, accent }) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className={`flex items-center gap-1.5 ${accent}`}><Icon size={13} /> {label}</span>
            <span className="text-gray-500">{pct} XP</span>
          </div>
          <div className="h-1.5 rounded-full bg-dark-700 overflow-hidden">
            <motion.div
              initial={{ width: 0 }} whileInView={{ width: pct }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-neon-green to-neon-cyan"
            />
          </div>
        </div>
      ))}
    </RevealCard>
  );
}
