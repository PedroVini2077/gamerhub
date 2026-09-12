import { useRef } from 'react';
import { motion } from 'framer-motion';
import ArteDaCena from './ArteDaCena';
import TextoDaCena from './TextoDaCena';
import CortinaDaCena from './CortinaDaCena';
import { entradaDaCena } from '../../lib/landingMotion';
import useProgressoDeRolagem from '../../hooks/useProgressoDeRolagem';

/**
 * Uma cena que ATRAVESSA — ela rola junto com a página.
 *
 * ── As duas formas de cena, e por que existem as duas `[12/09]` ─────────────
 *
 * | | esta | `CenaPresa` |
 * | --- | --- | --- |
 * | o que faz | passa pela tela | fica presa enquanto a rolagem passa |
 * | o que ela conta | um **estado** — algo que está acontecendo | uma **transformação** — algo virando outra coisa |
 * | custo | nenhum: não alonga a página | some ~2,5 telas de rolagem |
 *
 * Ordem do dono, na letra: *"não transforme obrigatoriamente cada uma das cinco
 * cenas em um enorme bloco preso... não quero cinco mini-sites consecutivos"*.
 * Três das cinco são deste tipo, e é isso que dá o respiro entre as duas presas.
 *
 * ── A hierarquia continua ARTE → PRODUTO → INFORMAÇÃO ───────────────────────
 *
 * A arte é o mundo; a **sobreposição** é o produto acontecendo dentro dele; o
 * texto explica o que acabou de acontecer. A sobreposição é uma camada própria
 * de HTML/SVG — nunca um remendo colado em cima de um detalhe desenhado dentro
 * da arte, que seria frágil por construção: a composição larga e a de retrato
 * têm enquadramentos diferentes, e a arte pode ser regerada a qualquer momento.
 *
 * ── A revelação é DIFERENTE em cada cena, de propósito ──────────────────────
 *
 * `revelacao` escolhe entre a entrada por deslize e as cortinas. Cinco seções
 * com o mesmo `fadeUpReveal` foi exatamente o que ele mandou eliminar.
 *
 * @param {object} props
 * @param {'deslize'|'centro'|'varredura'} [props.revelacao] Como a cena é
 *   descoberta. Ver `CortinaDaCena` para o que cada eixo significa.
 * @param {(progresso: import('framer-motion').MotionValue<number>) => React.ReactNode}
 *   [props.sobreposicao] A camada de produto. Recebe o progresso da cena na
 *   tela (0 = começou a entrar por baixo, 1 = terminou de sair por cima).
 */
export default function CenaDaLanding({
  id, arte, eyebrow, titulo, descricao, lado = 'esquerda', prioridade = false,
  revelacao = 'deslize', sobreposicao,
}) {
  const alvo = useRef(null);
  // O progresso é medido sempre, e é barato: o `useScroll` do Framer Motion
  // divide UM ouvinte passivo entre todas as chamadas da página. Torná-lo
  // condicional seria hook atrás de `if`, que as Rules of Hooks proíbem.
  const progresso = useProgressoDeRolagem(alvo, 'solta');
  const desliza = revelacao === 'deslize';

  return (
    <motion.section
      ref={alvo}
      id={id}
      // `scroll-mt` compensa a barra fixa do topo: sem isso o link leva a seção
      // para debaixo dela, e o visitante cai num lugar que parece o errado.
      style={{ scrollMarginTop: '5rem' }}
      variants={desliza ? entradaDaCena(lado) : undefined}
      initial={desliza ? 'initial' : undefined}
      whileInView={desliza ? 'animate' : undefined}
      viewport={desliza ? { once: true, amount: 0.25 } : undefined}
      className="relative overflow-hidden md:rounded-2xl my-8 md:my-16"
    >
      <ArteDaCena arte={arte} prioridade={prioridade} />
      <TextoDaCena eyebrow={eyebrow} titulo={titulo} descricao={descricao} lado={lado} />

      {sobreposicao?.(progresso)}

      {!desliza && <CortinaDaCena eixo={revelacao} />}
    </motion.section>
  );
}
