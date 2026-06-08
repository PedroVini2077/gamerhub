import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { fadeUpReveal, expandPanel, VIEWPORT } from '../../lib/landingMotion';

const ACCENTS = {
  green:  { text: 'text-neon-green',  tag: 'tag-green' },
  purple: { text: 'text-neon-purple', tag: 'tag-purple' },
  cyan:   { text: 'text-neon-cyan',   tag: 'tag-cyan' },
};

// Bloco "explicação + mockup" usado pra cada feature do site. O botão
// "Saiba mais" abre um painel animado com mais detalhes — interação
// exclusiva da landing (clique → conteúdo se expande).
export default function FeatureSection({ icon: Icon, eyebrow, title, description, details, accent = 'green', reverse = false, mockup }) {
  const [open, setOpen] = useState(false);
  const c = ACCENTS[accent];

  return (
    <motion.section
      variants={fadeUpReveal} initial="initial" whileInView="animate" viewport={VIEWPORT}
      className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-16 py-14`}
    >
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className={c.text} />}
          <span className={`font-display text-xs tracking-widest uppercase ${c.text}`}>{eyebrow}</span>
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-white">{title}</h2>
        <p className="text-gray-400 font-body leading-relaxed">{description}</p>

        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className={`tag ${c.tag} cursor-pointer inline-flex items-center gap-1.5 py-1.5 px-3 transition-opacity hover:opacity-80`}
        >
          {open ? 'Ver menos' : 'Saiba mais'}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={12} />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="details"
              variants={expandPanel} initial="collapsed" animate="expanded" exit="collapsed"
              className="overflow-hidden"
            >
              <p className="text-sm text-gray-500 font-mono leading-relaxed pt-3 mt-1 border-t border-dark-600">
                {details}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 w-full">
        {mockup}
      </div>
    </motion.section>
  );
}
