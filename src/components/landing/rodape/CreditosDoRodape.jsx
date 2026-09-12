import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { creditosDoRodape, VIEWPORT } from '../../../lib/landingMotion';

/**
 * A última linha da página: créditos e o caminho de volta.
 *
 * ── O botão de voltar respeita quem pediu menos movimento ───────────────────
 *
 * `behavior: 'smooth'` numa página de ~11 mil pixels é uma rolagem longa e
 * automática — exatamente o tipo de movimento que dispara enjoo em quem tem
 * sensibilidade vestibular, e o motivo de `prefers-reduced-motion` existir. Com
 * a preferência ligada o salto é instantâneo: chega no mesmo lugar sem a
 * viagem.
 *
 * ── Ele é `button`, e não uma âncora `#topo` ────────────────────────────────
 *
 * Âncora empilharia uma entrada no histórico, e o "voltar" do navegador
 * passaria a desfazer o "voltar ao início" em vez de sair da página. O rodapé
 * do site logado teria o mesmo problema, então a escolha fica registrada aqui.
 *
 * ── A seta é o único ícone da landing que aponta para algo ──────────────────
 *
 * A convenção do projeto proíbe seta TIPOGRÁFICA (`→`) em botão e manda usar
 * ícone — é `lucide-react`, então está dentro da regra.
 */
export default function CreditosDoRodape() {
  const menosMovimento = useReducedMotion();
  const ANO = new Date().getFullYear();

  const voltarAoInicio = () => {
    window.scrollTo({ top: 0, behavior: menosMovimento ? 'auto' : 'smooth' });
  };

  return (
    <div className="border-t border-dark-700">
      <motion.div
        variants={creditosDoRodape}
        initial="initial"
        whileInView="animate"
        viewport={VIEWPORT}
        className="max-w-5xl mx-auto px-4 md:px-6 py-5 flex flex-col sm:flex-row
                   items-center justify-between gap-4"
      >
        <p className="text-xs text-gray-600 font-mono order-2 sm:order-1 text-center sm:text-left">
          © {ANO} GamerHub — projeto independente, feito por um gamer.
        </p>

        {/* Ele vem PRIMEIRO no celular (`order-1`) porque é a única coisa
            acionável da linha: enterrá-lo embaixo dos créditos, no fim de uma
            página de 11 mil pixels, é escondê-lo de quem mais precisa dele. */}
        <button
          type="button"
          onClick={voltarAoInicio}
          className="group order-1 sm:order-2 inline-flex items-center gap-2 rounded-full
                     border border-dark-600 px-4 py-2 font-mono text-xs text-gray-400
                     hover:text-neon-green hover:border-neon-green/40
                     transition-colors duration-200"
        >
          <ArrowUp
            size={13}
            className="transition-transform duration-200 group-hover:-translate-y-0.5"
          />
          Voltar ao início
        </button>
      </motion.div>

      <p className="max-w-5xl mx-auto px-4 md:px-6 pb-5 text-xs text-gray-700 font-mono
                    text-center sm:text-left">
        // construído com React, Supabase e muito café
      </p>
    </div>
  );
}
