import { Zap } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="border-t border-dark-600 py-8 text-center space-y-2">
      <div className="flex items-center justify-center gap-2">
        <Zap size={16} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 6px #39ff14)' }} />
        <span className="font-display font-bold text-sm text-neon-green tracking-wider">GAMER</span>
        <span className="font-display font-bold text-sm text-white tracking-wider">HUB</span>
      </div>
      <p className="text-xs text-gray-600 font-mono">// GamerHub v1.0 — Powered by Supabase</p>
    </footer>
  );
}
