import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap, ChevronDown, PauseCircle, ShieldQuestion } from 'lucide-react';
import { useDbOffline } from '../../hooks/useDbOffline';
import { motivoDaPausa } from '../../lib/pauseReason';
import { heroFade } from '../../lib/landingMotion';
import Scene3D from './Scene3D';
import ElectricTitle from './ElectricTitle';
import IntroLightning from './IntroLightning';
import { deveTocarIntroAgora, marcarIntroVista } from '../../lib/introJaVista';
import BotaoCena3D from './BotaoCena3D';

export default function Hero({ aoIntroTerminar }) {
  const foraDoAr = useDbOffline();
  // O raio de abertura cobre o Hero, estoura, some e então libera o conteúdo.
  //
  // `[29/08]` Ele toca UMA VEZ por sessão do navegador. Antes tocava a cada
  // recarga, a cada volta do login e a cada nova montagem — o dono descreveu
  // exatamente isso, e a intro segura o conteúdo do Hero enquanto roda, então
  // cada repetição é ~1,3 s de espera para ver a mesma coisa.
  //
  // `useState(fn)` decide na montagem: quem já viu entra direto com o Hero
  // pronto (`introDone` nasce `true`), sem um quadro sequer de tela preta.
  // Ver `lib/introJaVista.js` para o porquê de `sessionStorage` e não
  // `localStorage`.
  const [introDone, setIntroDone] = useState(() => !deveTocarIntroAgora());
  const show = introDone ? 'animate' : 'initial';

  // `[02/09]` `aoIntroTerminar` sobe para a Landing porque o som ambiente mora
  // lá (no `BotaoDeSom`), e ele precisa saber QUANDO a intro acabou para tentar
  // tocar. O Hero continua dono da intro; ele só passa a avisar.
  //
  // Um contexto ou um barramento de eventos resolveria o mesmo, e seria mais
  // maquinário para um sinal booleano que atravessa exatamente um nível.
  function aoTerminarIntro() {
    marcarIntroVista();
    setIntroDone(true);
    aoIntroTerminar?.();
  }

  // Quem já viu a intro nesta sessão nasce com `introDone` verdadeiro e o
  // `onComplete` NUNCA dispara — sem isto, o som jamais tentaria tocar a
  // partir da segunda visita da sessão, que é justamente quando a pessoa mais
  // provavelmente já decidiu que quer ouvir.
  useEffect(() => {
    if (introDone) aoIntroTerminar?.();
    // Só na montagem: `aoTerminarIntro` cobre a transição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-x-clip">
      <AnimatePresence>
        {!introDone && <IntroLightning key="intro" onComplete={aoTerminarIntro} />}
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

        {/*
          `[29/08]` Porta de entrada para quem foi banido.

          O pedido do dono era um aviso na landing "só para ele" — identificando
          quem está banido. Descartado, e o motivo está em `docs/DECISOES.md`: a
          landing é vista por visitante anônimo, então identificar exigiria
          guardar no navegador que AQUELA MÁQUINA teve um login banido. Num PC ou
          celular compartilhado, isso conta a terceiros algo que não é da conta
          deles — o oposto do endurecimento de LGPD que este projeto fez.

          Este link resolve o problema real sem identificar ninguém: quem está
          banido JÁ consegue entrar e ver o andamento do recurso na
          `BannedScreen`; o que faltava era saber que isso existe. O link é
          igual para todo mundo e não revela nada — quem não está banido só
          encontra a tela de login normal.
        */}
        <motion.div variants={heroFade(0.5)} initial="initial" animate={show}>
          <Link
            to="/login"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-gray-600 hover:text-gray-400 transition-colors"
          >
            <ShieldQuestion size={13} />
            Conta bloqueada? Consulte seu caso
          </Link>
        </motion.div>

        {/* Troca entre a cena 3D e a versão leve. Só aparece para quem tem o
            que trocar — em desktop rodando o padrão (que já é 3D) ele some
            sozinho, para não poluir a landing. Ver `lib/cena3D.js`. */}
        <motion.div variants={heroFade(0.6)} initial="initial" animate={show}>
          <BotaoCena3D />
        </motion.div>

        {/* O aviso de pausa era um texto FIXO no código: para tirar ou trocar,
            precisava de commit e deploy. Agora ele aparece sozinho quando o
            site perde o banco, e some sozinho quando volta. O motivo vem da
            chave `pause_reason`, guardada no navegador enquanto havia conexão
            (ver `lib/pauseReason.js` para o porquê de não vir do banco). */}
        {foraDoAr && (
          <motion.div variants={heroFade(0.65)} initial="initial" animate={show}>
            <div className="mt-5 flex items-start gap-2 px-4 py-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-400/70 font-mono text-xs text-left">
              <PauseCircle size={13} className="shrink-0 mt-0.5" />
              <span>{motivoDaPausa()}</span>
            </div>
          </motion.div>
        )}
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
