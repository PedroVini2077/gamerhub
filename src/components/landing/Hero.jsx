import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ConvergenciaDoHub from './ConvergenciaDoHub';
import MarcaFlutuante from './MarcaFlutuante';
import ConteudoDoHero from './ConteudoDoHero';

/**
 * O hero em UMA tela, sem narrativa por rolagem.
 *
 * ── `[12/09]` Quem chega aqui hoje ──────────────────────────────────────────
 *
 * Este é o caminho de quem pediu **menos movimento** no sistema
 * (`prefers-reduced-motion`). Para todos os outros, o hero é o último ato do
 * `PrologoDaLanding`, que monta as mesmas três camadas com o progresso da
 * rolagem no comando.
 *
 * Ele **não** é um caminho de segunda: é a mesma cena, sem a narrativa. Quem
 * desliga animação no sistema tem motivo — de enjoo a vestibular —, e entregar
 * a landing sem conteúdo para essa pessoa seria trocar acessibilidade por
 * efeito. Aqui ela vê a convergência, a marca e o texto, parados.
 *
 * ── `[02/09]` A intro NÃO mora mais aqui, e a razão é medida ────────────────
 *
 * Ela era montada pelo Hero, que vive dentro do chunk lazy da landing.
 * Consequência: o clarão só existia na tela depois de aquele chunk baixar e
 * executar — **1320 ms a 6× de CPU, 1820 ms a 8×**. Todo esse tempo é tela
 * preta, e foi metade do "às vezes não aparece" que o dono relatou.
 *
 * Hoje quem monta a abertura é o `HomeOrLanding` (App.jsx), que está no pacote
 * inicial. O Hero só recebe o resultado em `introDone`.
 */
export default function Hero({ introDone = true }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-x-clip">
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

      {/* `[11/09]` Aqui morava a cena 3D com o raio — 708 kB para desenhar a
          marca que foi aposentada. No lugar dela, o que o NOME promete:
          trajetos chegando de fora e pousando onde o nome está. */}
      <ConvergenciaDoHub className="absolute inset-0 z-[1]" />

      {/* `[11/09]` A marca que a abertura pintou ASSENTA aqui — mesmo centro,
          combinado em `lib/marcaNoHero.js`, para a troca ser um cruzamento e
          não um voo até uma posição medida.

          Ela fica ENTRE a convergência e o texto: os trajetos convergem nela em
          vez de convergirem para espaço vazio, e o texto continua por cima. */}
      <MarcaFlutuante className="z-[2]" />

      <ConteudoDoHero introDone={introDone} />

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
