import { Heart, MessageCircle } from 'lucide-react';
import RevealCard from '../RevealCard';

// Card ilustrativo no estilo do feed real — não busca dados, é só apresentação.
export default function FeedMockup() {
  return (
    <RevealCard accent="green" className="card p-5 space-y-3 border-neon-green/20 max-w-sm mx-auto">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-dark-600 border border-neon-green/30" />
        <div>
          <p className="text-sm text-white font-medium">@player_one</p>
          <p className="text-[10px] text-gray-600 font-mono">há 2 minutos</p>
        </div>
        <span className="tag tag-green ml-auto">dica</span>
      </div>
      <p className="text-sm text-gray-300 font-body leading-snug">
        "Combo secreto descoberto na última atualização — bora testar?"
      </p>
      <div className="h-24 rounded-md bg-dark-700 border border-dark-500" />
      <div className="flex items-center gap-4 text-xs text-gray-500 font-mono pt-1">
        <span className="flex items-center gap-1.5"><Heart size={13} /> 128</span>
        <span className="flex items-center gap-1.5"><MessageCircle size={13} /> 34</span>
      </div>
    </RevealCard>
  );
}
