import { useScroll, useSpring } from 'framer-motion';

/**
 * O PROGRESSO de um elemento na rolagem, de 0 a 1 — numa fonte só.
 *
 * ── Por que ele existe `[12/09]` ────────────────────────────────────────────
 *
 * A landing mede progresso de rolagem em **dois recortes diferentes**, e a
 * diferença entre eles é o que separa uma cena presa de uma cena solta:
 *
 * | | `offset` | 0 é… | 1 é… |
 * | --- | --- | --- | --- |
 * | **presa** | `start start` → `end end` | o topo do bloco encostou no topo da tela | o fim do bloco encostou no fim da tela |
 * | **solta** | `start end` → `end start` | a cena começou a **entrar** por baixo | ela terminou de **sair** por cima |
 *
 * A mola é a mesma nos dois, e é ela que faz a diferença entre "narrativa" e
 * "coisa amarrada na barra de rolagem": `scrollYProgress` é degrau — roda de
 * mouse anda de 100 em 100 px —, e cada degrau apareceria como um salto em
 * várias camadas ao mesmo tempo.
 *
 * Escrever a configuração da mola em dois lugares seria a segunda fonte de
 * verdade que o §4 proíbe: as cenas passariam a ter inércias diferentes sem
 * ninguém ter decidido isso.
 *
 * ── Custo por quadro ────────────────────────────────────────────────────────
 *
 * Nenhum de React. `useScroll` usa um ouvinte passivo e devolve um `MotionValue`
 * — quem consome escreve direto no estilo, fora do ciclo de render. Não há
 * `useState` por quadro, que é o erro que custou 714 ms no `FluxoDeDados` e
 * está medido em `docs/DESEMPENHO.md`.
 *
 * @param {import('react').RefObject<HTMLElement>} alvo O elemento medido.
 * @param {'presa'|'solta'} [recorte] Qual dos dois recortes acima.
 * @returns {import('framer-motion').MotionValue<number>} 0 → 1, suavizado.
 */
export default function useProgressoDeRolagem(alvo, recorte = 'presa') {
  const { scrollYProgress } = useScroll({
    target: alvo,
    offset: recorte === 'presa'
      ? ['start start', 'end end']
      : ['start end', 'end start'],
  });

  // Frouxa de propósito (`damping` alto, `mass` baixa): mola dura devolve
  // oscilação, e oscilação em cinco camadas simultâneas é enjoo.
  return useSpring(scrollYProgress, {
    stiffness: 140, damping: 34, mass: 0.35, restDelta: 0.0005,
  });
}
