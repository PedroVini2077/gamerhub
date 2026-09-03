import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Menu } from 'lucide-react';
import LandingSidebar from './LandingSidebar';

/**
 * A barra fixa do topo da landing.
 *
 * `[29/08]` Ganhou o botão que abre a navegação lateral (`LandingSidebar`).
 * Antes ela tinha só a marca e o "Entrar" — o que bastava enquanto a página era
 * uma rolagem só, e deixa de bastar assim que ela cresce, que é justamente o
 * que o dono pediu.
 */
export default function LandingNav() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <>
      <motion.nav
        initial={{ y: -56, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="fixed inset-x-0 z-40 backdrop-blur-md bg-dark-900/70 border-b border-dark-600"
        // `[03/09]` `top` vem da variável que o `AvisoSemBanco` publica: sem
        // banco a faixa ocupa o topo, e sem isto ela COBRIA este cabeçalho —
        // o menu existia e não dava para tocar. Padrão `0px`: sem faixa, nada muda.
        style={{ top: 'var(--altura-do-aviso, 0px)' }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Zap size={20} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 8px #39ff14)' }} />
            <span className="font-display font-bold text-lg text-neon-green tracking-wider">GAMER</span>
            <span className="font-display font-bold text-lg text-white tracking-wider">HUB</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-neon py-2 px-5 text-[11px]">Entrar</Link>
            <button
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              className="p-2 text-gray-400 hover:text-neon-green transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </motion.nav>

      <LandingSidebar aberta={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </>
  );
}
