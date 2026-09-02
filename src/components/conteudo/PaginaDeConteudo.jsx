import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, PencilLine } from 'lucide-react';
import { iconeDoBloco } from '../sobre/iconesDoSobre';
import LandingFooter from '../landing/LandingFooter';
import { fadeUpReveal, VIEWPORT } from '../../lib/landingMotion';

/**
 * A casca das páginas públicas de texto (`/privacidade`, `/regras`).
 *
 * Extraída em 02/09, quando a segunda página com esta estrutura ia nascer. O
 * §4 manda extrair a partir de DUAS repetições, e o motivo é concreto: cópias
 * divergem. Se cada página tivesse a sua, a correção do scroll de âncora ou do
 * `whileInView` precisaria ser feita em três lugares — e um deles ficaria para
 * trás sem ninguém notar.
 *
 * A `/sobre` NÃO usa esta casca: ela tem lema, bloco em destaque e o mural de
 * jogos. Forçá-la aqui encheria este componente de opção que só uma página usa,
 * que é a outra forma de errar a abstração.
 *
 * Cada seção carrega o próprio `whileInView`. Não envolver num container com
 * `viewport={VIEWPORT}`: `amount: 0.25` de um container mais alto que 4x a
 * janela nunca é atingido, e a página inteira fica invisível — foi o bug de
 * 29/08.
 */

/** Bloco que depende de decisão de alguém. Aparece marcado; não some. */
function BlocoPendente({ dica }) {
  return (
    <div className="card p-4 border-dashed border-yellow-500/40 space-y-1">
      <p className="inline-flex items-center gap-2 text-sm font-mono text-yellow-300">
        <PencilLine size={14} />
        Esta parte ainda depende de uma decisão, e não vamos inventar.
      </p>
      <p className="text-xs font-mono text-gray-500">{dica}</p>
    </div>
  );
}

function Icone({ nome }) {
  const componente = iconeDoBloco(nome);
  if (!componente) return null;
  return (
    <span className="shrink-0 grid place-items-center rounded-xl border
                     border-dark-500 bg-dark-800 w-9 h-9">
      {createElement(componente, { size: 17, className: 'text-neon-green' })}
    </span>
  );
}

/** Tabela com rolagem própria: em celular ela é mais larga que a tela. */
function Tabela({ dados }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs font-mono border-collapse">
        <caption className="sr-only">{dados.titulo}</caption>
        <thead>
          <tr className="border-b border-dark-500">
            {dados.colunas.map(c => (
              <th key={c} scope="col"
                  className="py-2 pr-4 text-neon-green font-normal uppercase tracking-wider">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dados.linhas.map((linha, i) => (
            <tr key={i} className="border-b border-dark-700/60 align-top">
              {linha.map((celula, j) => (
                <td key={j} className={`py-2 pr-4 ${j === 0 ? 'text-white' : 'text-gray-400'}`}>
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Lista de `[termo, explicação]` — mais legível que parágrafo para regra. */
function ListaDeItens({ itens }) {
  return (
    <ul className="space-y-2">
      {itens.map(([termo, explicacao]) => (
        <li key={termo} className="text-sm font-body text-gray-400">
          <span className="font-display text-white">{termo}</span>
          <span className="text-gray-600"> — </span>
          {explicacao}
        </li>
      ))}
    </ul>
  );
}

export default function PaginaDeConteudo({
  eyebrow, icone: IconeTopo, titulo, destaque, rodapeDoTitulo, blocos, children,
}) {
  return (
    <div className="min-h-screen bg-dark-900 grid-bg relative">
      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 pt-10 pb-16 space-y-10">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-mono
                                text-gray-400 hover:text-neon-green transition-colors">
          <ArrowLeft size={14} /> Voltar
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            {IconeTopo && <IconeTopo size={14} className="text-neon-green" />}
            <p className="font-display text-xs tracking-widest uppercase text-neon-green">
              {eyebrow}
            </p>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
            {titulo}
            {destaque && <span className="block text-neon-green">{destaque}</span>}
          </h1>
          {rodapeDoTitulo && (
            <p className="text-xs font-mono text-gray-500">{rodapeDoTitulo}</p>
          )}
        </motion.header>

        {children}

        <div className="space-y-10">
          {blocos.map(bloco => (
            <motion.section
              key={bloco.id} id={bloco.id}
              variants={fadeUpReveal}
              initial="initial" whileInView="animate" viewport={VIEWPORT}
              style={{ scrollMarginTop: '2rem' }}
              className="space-y-3"
            >
              <h2 className="font-display text-xl md:text-2xl font-bold text-white
                             flex items-center gap-3">
                <Icone nome={bloco.icone} />
                {bloco.titulo}
              </h2>

              {bloco.pendente
                ? <BlocoPendente dica={bloco.dica} />
                : bloco.paragrafos?.map((texto, i) => (
                    <p key={i} className="text-gray-400 font-body leading-relaxed">{texto}</p>
                  ))}

              {bloco.itens && <ListaDeItens itens={bloco.itens} />}
              {bloco.tabela && <Tabela dados={bloco.tabela} />}
            </motion.section>
          ))}
        </div>
      </div>

      <div className="relative z-10"><LandingFooter /></div>
    </div>
  );
}
