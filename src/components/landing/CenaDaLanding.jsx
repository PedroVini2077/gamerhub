import { useRef } from 'react';
import ArteQueInvade from './ArteQueInvade';
import TextoDaCena from './TextoDaCena';
import useProgressoDeRolagem from '../../hooks/useProgressoDeRolagem';
import { CLASSE_DA_COSTURA, estiloDaCostura } from '../../lib/costuraDeCena';

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
 * ── `[12/09]` Ela sempre COSTURA, e o que varia é o gesto ───────────────────
 *
 * Houve três formas de entrar: deslize lateral, cortina e costura. Com a
 * costura valendo em todas as emendas, as outras duas viraram uma segunda
 * entrada empilhada — e duas entradas na mesma cena brigam.
 *
 * Sobrou uma, e a variedade mudou de lugar: ela vive agora no **gesto da arte**
 * que chega (`invasao`), diferente em cada emenda. Ver `lib/costuraDeCena.js`.
 * Menos mecanismo, mais variação — que é o que ele pediu ao escrever *"quero a
 * solução mais simples que consiga produzir a experiência desejada"*.
 *
 * @param {object} props
 * @param {'sobe'|'afasta'|'mergulha'|'deriva'} [props.invasao] O gesto da arte
 *   ao chegar.
 * @param {(progresso: import('framer-motion').MotionValue<number>) => React.ReactNode}
 *   [props.sobreposicao] A camada de produto. Recebe o progresso da cena na
 *   tela (0 = começou a entrar por baixo, 1 = terminou de sair por cima).
 */
export default function CenaDaLanding({
  id, arte, eyebrow, titulo, descricao, lado = 'esquerda', prioridade = false,
  sobreposicao, invasao,
}) {
  const alvo = useRef(null);
  // O progresso é medido sempre, e é barato: o `useScroll` do Framer Motion
  // divide UM ouvinte passivo entre todas as chamadas da página. Torná-lo
  // condicional seria hook atrás de `if`, que as Rules of Hooks proíbem.
  const progresso = useProgressoDeRolagem(alvo, 'solta');

  return (
    <section
      ref={alvo}
      id={id}
      // `scroll-mt` compensa a barra fixa do topo: sem isso o link leva a seção
      // para debaixo dela, e o visitante cai num lugar que parece o errado.
      className={`relative overflow-hidden my-8 md:my-14 ${CLASSE_DA_COSTURA}`}
      // ── `[12/09]` A COSTURA: a cena não começa, ela INVADE ────────────────
      //
      // Diagnóstico do dono: *"a página ainda denuncia que são blocos
      // independentes"*, e a régua que ele deu: *"não pense em como colocar
      // uma animação entre duas imagens. Pense em como fazer a imagem A se
      // transformar na imagem B"*.
      //
      // Duas coisas, e só duas:
      //
      // 1. **margem negativa** — a cena sobe por cima do fim da anterior. Sem
      //    sobreposição no LAYOUT não existe transformação possível: duas
      //    caixas que se tocam só podem trocar de vez.
      // 2. **máscara no topo** — a borda de cima deixa de existir. É ela que
      //    dizia "esta imagem acabou aqui"; sem ela a arte nova aparece
      //    ATRAVÉS da anterior.
      //
      // Por que máscara e não um gradiente por cima: um véu sobreposto
      // escureceria o que está embaixo. A máscara apaga a arte NOVA na faixa
      // de emenda, deixando a anterior intacta — é dissolução, não sombra.
      //
      // E ela é ESTÁTICA: não anima, não é recalculada por quadro. O custo é
      // uma camada de composição, uma vez.
      style={{ scrollMarginTop: '5rem', ...estiloDaCostura() }}
    >
      <ArteQueInvade arte={arte} prioridade={prioridade} progresso={progresso} invasao={invasao} />
      <TextoDaCena eyebrow={eyebrow} titulo={titulo} descricao={descricao} lado={lado} />

      {sobreposicao?.(progresso)}
    </section>
  );
}
