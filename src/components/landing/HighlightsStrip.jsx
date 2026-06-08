import { motion } from 'framer-motion';
import { Newspaper, Users, Radio, Trophy } from 'lucide-react';
import { fadeUpReveal, staggerContainer, VIEWPORT } from '../../lib/landingMotion';

const ITEMS = [
  { icon: Newspaper, label: 'Feed colaborativo',    accent: 'text-neon-green' },
  { icon: Users,     label: 'Mural da comunidade',  accent: 'text-neon-purple' },
  { icon: Radio,     label: 'Lives ao vivo',        accent: 'text-neon-cyan' },
  { icon: Trophy,    label: 'Ranks & XP',           accent: 'text-neon-green' },
];

export default function HighlightsStrip() {
  return (
    <motion.div
      variants={staggerContainer()} initial="initial" whileInView="animate" viewport={VIEWPORT}
      className="grid grid-cols-2 md:grid-cols-4 gap-3 py-10"
    >
      {ITEMS.map(({ icon: Icon, label, accent }) => (
        <motion.div
          key={label}
          variants={fadeUpReveal}
          whileHover={{ y: -3 }}
          className="card p-4 flex flex-col items-center gap-2 text-center"
        >
          <Icon size={22} className={accent} />
          <span className="text-xs font-mono text-gray-400">{label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}
