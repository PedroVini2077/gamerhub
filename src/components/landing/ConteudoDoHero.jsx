import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PauseCircle, ShieldQuestion } from 'lucide-react';
import { useDbOffline } from '../../hooks/useDbOffline';
import { motivoDaPausa } from '../../lib/pauseReason';
import { heroFade } from '../../lib/landingMotion';
import ElectricTitle from './ElectricTitle';
import MarcaGH from '../ui/MarcaGH';

/**
 * O QUE SE LÊ no hero: sobrancelha, título, parágrafo, botão e os dois avisos.
 *
 * ── Por que isto saiu do `Hero.jsx` `[12/09]` ───────────────────────────────
 *
 * Porque passou a ter **dois** donos. O `Hero` continua montando a cena inteira
 * (fundo, convergência, marca) para quem pediu menos movimento; e o
 * `PrologoDaLanding` monta a mesma coluna de texto como o último ato da
 * narrativa por rolagem, com os fundos sob controle do progresso.
 *
 * A alternativa era o `Hero` ganhar props do tipo `semFundo` e `dentroDoPalco`.
 * Isso é o começo do componente que faz três coisas conforme quem chama — e o
 * `Hero` é o primeiro elemento que qualquer visitante vê. Separar o que se lê
 * do palco onde se lê deixa os dois caminhos honestos e curtos.
 *
 * **Nada aqui mudou de comportamento**: é o mesmo conteúdo, com os mesmos
 * atrasos do `heroFade`, na mesma ordem.
 *
 * @param {object} props
 * @param {boolean} [props.introDone] A abertura terminou. Antes disso a tela
 *   ainda está no clarão, e revelar o texto por baixo dele seria atropelo.
 */
export default function ConteudoDoHero({ introDone = true }) {
  const foraDoAr = useDbOffline();
  const show = introDone ? 'animate' : 'initial';

  return (
    <div className="relative z-10 flex flex-col items-center">
      <motion.div variants={heroFade(0)} initial="initial" animate={show} className="flex items-center gap-2 mb-5">
        <MarcaGH tamanho={20} />
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
  );
}
