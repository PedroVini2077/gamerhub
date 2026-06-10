import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeTab } from '../../lib/motion';
import { ShieldAlert, Clock, List, BookX, AlertTriangle } from 'lucide-react';
import ModerationQueue from './ModerationQueue';
import WordlistManager from './WordlistManager';
import ViolationsPanel from './ViolationsPanel';
import ReportsList from './ReportsList';

const TABS = [
  { id: 'queue',      label: 'Fila',       icon: Clock },
  { id: 'reports',    label: 'Denúncias',  icon: AlertTriangle },
  { id: 'wordlist',   label: 'Palavrões',  icon: BookX },
  { id: 'violations', label: 'Infrações',  icon: List },
];

export default function ModerationPanel() {
  const [tab, setTab] = useState('queue');

  return (
    <div className="space-y-4">
      <div className="card p-4 border-orange-500/20">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert size={15} className="text-orange-400" />
          <h2 className="font-display text-sm text-orange-400 uppercase tracking-wider">Moderação de Conteúdo</h2>
        </div>
        <p className="text-xs text-gray-500 font-mono">
          Fila de revisão, palavras bloqueadas e histórico de infrações.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 py-2 px-4 text-xs font-display tracking-wider uppercase rounded border transition-all shrink-0 ${
              tab === id
                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                : 'border-dark-400 text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} variants={fadeTab} initial="initial" animate="animate" exit="exit">
          {tab === 'queue'      && <ModerationQueue />}
          {tab === 'reports'   && <ReportsList />}
          {tab === 'wordlist'  && <WordlistManager />}
          {tab === 'violations'&& <ViolationsPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
