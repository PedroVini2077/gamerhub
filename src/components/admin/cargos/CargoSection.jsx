import { motion } from 'framer-motion';
import { listContainer } from '../../../lib/motion';

/** Seção da aba Cargos: título com contagem, estado vazio e lista animada. */
export default function CargoSection({ icon: Icon, title, count, emptyText, children }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-mono text-gray-500 uppercase tracking-wider">
        <Icon size={12} /> {title} ({count})
      </h3>
      {count === 0 ? (
        <p className="text-xs font-mono text-gray-600 px-1">{emptyText}</p>
      ) : (
        <motion.div variants={listContainer} initial="hidden" animate="visible" className="space-y-2">
          {children}
        </motion.div>
      )}
    </section>
  );
}
