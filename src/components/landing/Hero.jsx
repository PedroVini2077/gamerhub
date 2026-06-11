import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap, ChevronDown, PauseCircle } from 'lucide-react';
import { heroFade } from '../../lib/landingMotion';
import Scene3D from './Scene3D';
import ElectricTitle from './ElectricTitle';
import IntroLightning from './IntroLightning';

export default function Hero() {
  // O raio de abertura cobre o Hero, estoura, some e então libera o conteúdo.
  const [introDone, setIntroDone] = useState(false);
  const show = introDone ? 'animate' : 'initial';

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-x-clip">
      <AnimatePresence>
        {!introDone && <IntroLightning key="intro" onComplete={() => setIntroDone(true)} />}
      </AnimatePresence>

      {/* Glows flutuantes — assinatura exclusiva da landing, não existem no resto do site */}
      <motion.div
        aria-hidden
        animate={{ y: [0, -22, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-24 -left-28 w-72 h-72 rounded-full bg-neon-green/10 blur-3xl pointer-events-none"
      />
      <motion.div
        aria-hidden
        animate={{ y: [0, 24, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute -bottom-28 -right-24 w-80 h-80 rounded-full bg-neon-purple/10 blur-3xl pointer-events-none"
      />

      {/* Logo 3D + objetos flutuantes — só essa página, carregado sob demanda */}
      <Scene3D className="absolute inset-0 z-[1] opacity-90" />

      <div className="relative z-10 flex flex-col items-center">
        <motion.div variants={heroFade(0)} initial="initial" animate={show} className="flex items-center gap-2 mb-5">
          <Zap size={20} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 10px #39ff14)' }} />
          <span className="font-mono text-xs tracking-[0.3em] text-neon-green uppercase">
            Sua base de operações gamer
          </span>
        </motion.div>

        <ElectricTitle active={introDone} />

        <motion.p
          variants={heroFade(0.25)} initial="initial" animate={show}
          className="max-w-xl text-gray-400 font-body text-base md:text-lg mb-9"
        >
          Feed colaborativo, mural da comunidade, lives ao vivo, ranks e XP —
          tudo num só lugar, feito pra quem vive games.
        </motion.p>

        <motion.div variants={heroFade(0.45)} initial="initial" animate={show}>
          <Link to="/login" className="btn-solid py-3.5 px-9 text-sm">Entrar / Criar conta</Link>
        </motion.div>

        <motion.div variants={heroFade(0.65)} initial="initial" animate={show}>
          <div className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-400/60 font-mono text-xs">
            <PauseCircle size={13} className="shrink-0" />
            <span>Projeto pausado · Limite de banda da infraestrutura gratuita atingido · Em breve de volta</span>
          </div>
        </motion.div>
      </div>

      <motion.div
        aria-hidden
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-8 text-gray-600 z-10"
      >
        <ChevronDown size={22} />
      </motion.div>
    </section>
  );
}
