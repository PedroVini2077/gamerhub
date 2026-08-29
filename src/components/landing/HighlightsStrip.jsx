import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { fadeUpReveal, staggerContainer, VIEWPORT } from '../../lib/landingMotion';
import { SECOES, alvoDaSecao } from './secoesDaLanding';

/**
 * A faixa de destaques do topo — agora LEVA às seções.
 *
 * ── Por que virou link ──────────────────────────────────────────────────────
 *
 * Pedido do dono: *"queria adicionar links nesses cards que falam do site, pra
 * pessoa poder clicar e ir direto aonde explica, pq imagina o site cresce, e o
 * usuário ter que rolar uma tela grande"*.
 *
 * Ele está certo e o problema piora sozinho: cada seção nova alonga a página, e
 * um card que só descreve vira uma promessa sem caminho. Com link, a faixa
 * deixa de ser enfeite e vira o índice da página.
 *
 * ── A lista some daqui de propósito ─────────────────────────────────────────
 *
 * Ela mora em `secoesDaLanding.js`, junto com a do rodapé e a da navegação
 * lateral. A versão anterior tinha a lista escrita à mão aqui, e ela já
 * divergia da página: citava "Lives ao vivo" e **não mencionava Keys**, que é
 * uma seção inteira do site (§4, fonte única).
 */
export default function HighlightsStrip() {
  return (
    <motion.nav
      aria-label="Seções desta página"
      variants={staggerContainer()} initial="initial" whileInView="animate" viewport={VIEWPORT}
      className="grid grid-cols-2 md:grid-cols-5 gap-3 py-10"
    >
      {SECOES.map(({ id, rotulo, icone: Icone, cor }) => (
        <motion.a
          key={id}
          href={alvoDaSecao(id)}
          variants={fadeUpReveal}
          whileHover={{ y: -3 }}
          className="card p-4 flex flex-col items-center gap-2 text-center group focus:outline-none focus:ring-1 focus:ring-neon-green/60"
        >
          <Icone size={22} className={cor} />
          <span className="text-xs font-mono text-gray-400 group-hover:text-gray-200 transition-colors">
            {rotulo}
          </span>
          <ArrowDown
            size={12}
            aria-hidden
            className="text-gray-700 group-hover:text-neon-green transition-colors"
          />
        </motion.a>
      ))}
    </motion.nav>
  );
}
