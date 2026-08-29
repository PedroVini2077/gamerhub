import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, PencilLine, Zap, ArrowRight } from 'lucide-react';
import { BLOCOS } from '../components/sobre/conteudoDoSobre';
import LandingFooter from '../components/landing/LandingFooter';
import { fadeUpReveal, VIEWPORT } from '../lib/landingMotion';

/**
 * A página "Sobre", pedida pelo dono como primeira aba da navegação lateral.
 *
 * É pública de propósito: alguém precisa poder ler sobre o projeto **antes** de
 * decidir criar conta. Por isso ela não entra no `RequireAuth`.
 *
 * O conteúdo mora em `components/sobre/conteudoDoSobre.js` — inclusive a marca
 * de qual bloco ainda está por escrever, que aparece na tela em vez de a seção
 * simplesmente sumir.
 */

/** Um bloco que ainda espera o texto. Aparece; não some. */
function BlocoPendente({ dica }) {
  return (
    <div className="card p-4 border-dashed border-dark-500 space-y-1">
      <p className="inline-flex items-center gap-2 text-sm font-mono text-gray-400">
        <PencilLine size={14} className="text-neon-purple" />
        Esta parte ainda vai ser escrita.
      </p>
      <p className="text-xs font-mono text-gray-600">{dica}</p>
    </div>
  );
}

export default function Sobre() {
  return (
    <div className="min-h-screen bg-dark-900 grid-bg">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-10 pb-16 space-y-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-neon-green transition-colors"
        >
          <ArrowLeft size={14} /> Voltar
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 6px #39ff14)' }} />
            <p className="font-display text-xs tracking-widest uppercase text-neon-green">
              Sobre o projeto
            </p>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            Começou com uma pergunta:
            <span className="block text-neon-green">até onde dá pra levar?</span>
          </h1>
        </motion.header>

        {/* Cada seção decide sozinha quando aparecer.
            NÃO envolver isto num container com `whileInView`: `VIEWPORT` usa
            `amount: 0.25`, e 25% de um container de ~3.900px são ~975px — mais
            do que a janela de um celular inteira. O container nunca entraria em
            vista, e os sete blocos ficariam invisíveis PARA SEMPRE, com o texto
            presente no DOM. Foi exatamente esse o bug de 29/08. */}
        <div className="space-y-10">
          {BLOCOS.map(bloco => (
            <motion.section
              key={bloco.id}
              id={bloco.id}
              variants={fadeUpReveal}
              initial="initial" whileInView="animate" viewport={VIEWPORT}
              style={{ scrollMarginTop: '2rem' }}
              className={bloco.destaque
                ? 'card p-6 space-y-4 border-neon-green/25'
                : 'space-y-3'}
            >
              <h2 className="font-display text-xl md:text-2xl font-bold text-white">
                {bloco.titulo}
              </h2>

              {/* O lema aparece grande e sozinho: é a frase que a pessoa devia
                  levar embora se lesse só uma linha da página inteira. */}
              {bloco.lema && (
                <p className="font-display text-lg md:text-xl text-neon-green">
                  {bloco.lema}
                </p>
              )}

              {bloco.pendente
                ? <BlocoPendente dica={bloco.dica} />
                : bloco.paragrafos.map((texto, i) => (
                    <p key={i} className="text-gray-400 font-body leading-relaxed">{texto}</p>
                  ))}
            </motion.section>
          ))}
        </div>

        <motion.div
          variants={fadeUpReveal} initial="initial" whileInView="animate" viewport={VIEWPORT}
          className="card p-6 text-center space-y-3 border-neon-green/25"
        >
          <p className="font-display text-lg text-white">Bora fazer parte disso?</p>
          <p className="text-sm text-gray-400 font-body">
            A comunidade tá aberta — e ela cresce com quem chega.
          </p>
          <Link to="/login" className="btn-neon inline-flex items-center gap-2 py-2.5 px-6 text-xs">
            Entrar ou criar conta <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>

      <LandingFooter />
    </div>
  );
}
