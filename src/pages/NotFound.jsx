import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 grid-bg">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Zap size={24} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 8px #39ff14)' }} />
          <span className="font-display font-bold text-xl text-neon-green">GAMER</span>
          <span className="font-display font-bold text-xl text-white">HUB</span>
        </div>

        <h1 className="font-display text-8xl font-bold text-neon-green mb-2"
          style={{ textShadow: '0 0 30px #39ff14' }}>
          404
        </h1>
        <p className="font-mono text-gray-400 text-sm mb-2">PÁGINA NÃO ENCONTRADA</p>
        <p className="font-mono text-gray-600 text-xs mb-8">
          // Você caiu fora do mapa, gamer
        </p>

        <Link to="/" className="btn-solid py-3 px-8">
          VOLTAR AO HUB
        </Link>
      </div>
    </div>
  );
}
