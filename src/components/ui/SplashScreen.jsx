import { Zap } from 'lucide-react';

// Tela exibida só durante a resolução inicial da sessão (useAuth.loading) —
// evita o flash de Landing↔Home enquanto o usuário/perfil ainda carregam.
export default function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 grid-bg">
      <div className="flex items-center gap-2 animate-pulse">
        <Zap size={26} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 10px #39ff14)' }} />
        <span className="font-display font-bold text-2xl text-neon-green tracking-wider">GAMER</span>
        <span className="font-display font-bold text-2xl text-white tracking-wider">HUB</span>
      </div>
    </div>
  );
}
