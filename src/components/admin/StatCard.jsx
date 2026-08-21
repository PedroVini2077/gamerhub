import { motion } from 'framer-motion';
import { gridCard } from '../../lib/motion';

// Cartão de número do topo do painel admin (usuários, posts, keys).
export default function StatCard({ icon: Icon, label, value, color }) {
  return (
    <motion.div variants={gridCard} className="card p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-display font-bold text-white">{value}</p>
      </div>
    </motion.div>
  );
}
