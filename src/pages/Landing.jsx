import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

// Stub da Fase A — valida o fluxo de bloqueio/redirecionamento. O conteúdo
// completo (seções, animações exclusivas, cena 3D) entra na Fase B.
export default function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 grid-bg scanline-overlay p-4">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Zap size={28} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 10px #39ff14)' }} />
          <span className="font-display font-bold text-3xl text-neon-green tracking-wider">GAMER</span>
          <span className="font-display font-bold text-3xl text-white tracking-wider">HUB</span>
        </div>
        <p className="text-gray-400 font-mono text-sm mb-8">
          Sua base de operações gamer — feed, mural, lives, ranks e muito mais.
        </p>
        <Link to="/login" className="btn-solid py-3 px-8">Entrar / Criar conta</Link>
      </div>
    </div>
  );
}
