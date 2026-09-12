import { useRef } from 'react';
import useProgressoDeRolagem from '../../hooks/useProgressoDeRolagem';

/**
 * O PALCO: uma cena presa na tela enquanto a rolagem passa por ela.
 *
 * ── O que ele é ─────────────────────────────────────────────────────────────
 *
 * Um bloco alto (várias telas) cujo conteúdo fica **grudado** ocupando uma tela
 * só. Enquanto a pessoa rola essas várias telas, o conteúdo não sai do lugar —
 * o que muda é o `progresso`, de 0 a 1, que as camadas usam para se transformar.
 *
 * É o mecanismo inteiro da narrativa por rolagem, e ele mora **aqui e em lugar
 * nenhum mais**: quem escreve uma cena recebe um número e não precisa saber o
 * que é `sticky`, `useScroll` ou `offset`.
 *
 * ── Por que Framer Motion e NÃO GSAP/ScrollTrigger ──────────────────────────
 *
 * O prompt do dono manda justificar antes de acrescentar dependência, e a
 * justificativa aqui é contra:
 *
 * | | GSAP + ScrollTrigger | o que está sendo usado |
 * | --- | --- | --- |
 * | peso | ~70 kB **descompactados** no caminho crítico | 0 — `framer-motion` já está no pacote e é usado em toda a landing |
 * | como prende | JavaScript: cria elemento espaçador e reescreve o layout | `position: sticky` do CSS, no compositor |
 * | o que quebra | pin próprio briga com `position: fixed` (o `FluxoDeDados` é fixo) e com âncora de rolagem | nada: a página continua rolando normalmente |
 * | manutenção | uma timeline central que cresce sem fim | uma janela por camada, num arquivo de dados |
 *
 * A regra do §0.3 é perguntar quanto a biblioteca custa **descompactada**,
 * porque é o número que vira trabalho de CPU. 70 kB para fazer o que
 * `position: sticky` faz de graça não passa nessa conta.
 *
 * ── Por que a mola (`useSpring`) ────────────────────────────────────────────
 *
 * `scrollYProgress` é degrau: roda de mouse anda de 100 em 100 px, e cada
 * degrau apareceria como um salto em cinco camadas ao mesmo tempo. A mola faz o
 * progresso **perseguir** a rolagem em vez de copiá-la — é o que separa
 * "narrativa" de "coisa amarrada na barra de rolagem".
 *
 * Ela é frouxa de propósito (`damping` alto, `mass` baixa): mola dura devolve
 * oscilação, e oscilação em cinco camadas simultâneas é enjoo.
 *
 * ── Custo por quadro ────────────────────────────────────────────────────────
 *
 * Nenhum. `useScroll` usa um ouvinte passivo de rolagem e as camadas escrevem
 * `transform`/`opacity`, que o navegador resolve no compositor. Não há
 * `useState` por quadro — que é o erro que custou 714 ms no `FluxoDeDados` e
 * está medido em `docs/DESEMPENHO.md`.
 *
 * @param {object} props
 * @param {number} props.altura Quantas alturas de tela o palco consome. **Este
 *   número é o tempo da cena**: ele decide quanto de rolagem cabe entre o
 *   começo e o fim do roteiro.
 * @param {(progresso: import('framer-motion').MotionValue<number>) => React.ReactNode} props.children
 *   Recebe o progresso e devolve as camadas. É função, e não elemento, para o
 *   progresso chegar sem contexto e sem `cloneElement`.
 */
export default function PalcoDeRolagem({
  altura, children, className = '', classeDoPalco = '', estiloDoPalco,
}) {
  const alvo = useRef(null);

  // O recorte `presa`: 0 quando o TOPO do bloco encosta no topo da tela (é
  // quando a cena prende), 1 quando o FIM do bloco encosta no fim da tela (é
  // quando ela solta). Qualquer outro par desalinha o progresso do momento em
  // que a cena está de fato presa — e aí a última camada termina de aparecer
  // depois de a cena já ter saído.
  //
  // `[12/09]` A medição e a mola saíram daqui para `useProgressoDeRolagem`,
  // porque as cenas SOLTAS precisam do mesmo progresso com outro recorte. Duas
  // molas escritas em dois lugares dariam inércias diferentes a cenas da mesma
  // página, sem ninguém ter decidido isso.
  const progresso = useProgressoDeRolagem(alvo, 'presa');

  return (
    <div ref={alvo} style={{ height: `${altura}vh` }} className={className}>
      {/* `h-[100svh]` e não `100vh`: no celular a barra de endereço some ao
          rolar e a janela CRESCE. Com `vh` a cena presa mudaria de altura no
          meio do movimento — é a mesma lição de 01/09 que fez as formas da
          "Sobre" darem um pulo (ver `index.css`).
          `overflow-hidden` porque as camadas escalam para além da borda: sem
          ele, uma arte a 1,16× cria barra de rolagem horizontal. */}
      <div
        className={`sticky top-0 h-[100svh] w-full overflow-hidden ${classeDoPalco}`}
        style={estiloDoPalco}
      >
        {children(progresso)}
      </div>
    </div>
  );
}
