import { Users, Image as ImageIcon } from 'lucide-react';
import RevealCard from '../RevealCard';

export default function MuralMockup() {
  return (
    <RevealCard accent="purple" className="card p-5 space-y-3 border-neon-purple/20 max-w-sm mx-auto">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-neon-purple" />
        <span className="font-display text-xs text-neon-purple tracking-widest uppercase">Mural da comunidade</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="aspect-square rounded-md bg-dark-700 border border-dark-500 flex items-center justify-center">
            <ImageIcon size={16} className="text-gray-700" />
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-300 font-body leading-snug">
        "Galera, vamos montar squad pra hoje à noite? 🎮"
      </p>
      <div className="flex -space-x-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-6 h-6 rounded-full bg-dark-600 border-2 border-dark-800" />
        ))}
        <span className="text-[10px] text-gray-500 font-mono pl-3 self-center">+12 na conversa</span>
      </div>
    </RevealCard>
  );
}
