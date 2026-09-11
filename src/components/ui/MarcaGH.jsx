import { useId } from 'react';

import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../../lib/marca';

/**
 * A MARCA do GamerHub — o monograma GH hexagonal.
 *
 * ── De onde ela vem, e por que isso importa ─────────────────────────────────
 *
 * `[11/09]` O caminho **não foi desenhado por mim**. Ele foi derivado da arte
 * que o dono trouxe, lendo os pixels: `scripts/tracar-marca.mjs` binariza a
 * versão monocromática da folha, encadeia as arestas de fronteira em laços e
 * simplifica por Ramer–Douglas–Peucker. 2.316 pontos de contorno viraram
 * **39 vértices**, sem perder forma.
 *
 * Isso importa porque eu já tinha tentado desenhar marca aqui duas vezes, e as
 * duas foram recusadas — a última com a palavra dele: *"muito gradadão"*.
 * Redesenhar no olho seria a terceira tentativa do mesmo erro.
 *
 * **A fidelidade é medida, não afirmada.** `scripts/conferir-fidelidade.mjs`
 * desenha este caminho por cima do recorte da arte e conta os pixels que
 * discordam: **1,80% da área da marca**, e a diferença inteira mora na borda de
 * 1 px do anti-serrilhado — o limite do que vetorizar bitmap alcança.
 *
 * ── Por que não bastava usar o PNG ──────────────────────────────────────────
 *
 * Favicon de 16 px vira mancha; versão monocromática não sai de um bitmap
 * colorido; e cada variante custaria dezenas de kB. Este caminho custa **menos
 * de 0,5 kB** e serve todos os tamanhos, do favicon ao outdoor.
 *
 * ── O `useId` não é capricho ────────────────────────────────────────────────
 *
 * Dois destes na mesma página com o mesmo `id` de gradiente fariam o segundo
 * herdar o do primeiro — e um dos dois apareceria com a cor errada. É um bug
 * que só aparece quando alguém põe a marca duas vezes na tela, que é
 * exatamente o que o cabeçalho e o rodapé fazem.
 */
export default function MarcaGH({
  tamanho = 32,
  variante = 'gradiente',
  className = '',
  title,
}) {
  const id = useId();
  const preenchimento = variante === 'mono' ? 'currentColor' : `url(#${id})`;

  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {variante !== 'mono' && (
        <defs>
          {/* Eixo e paradas MEDIDOS na arte — ver `lib/marca.js`. O eixo é
              horizontal: a primeira versão usava diagonal, e o verde aparecia
              como um canto enquanto no original ele domina a esquerda. */}
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            {PARADAS_DO_GRADIENTE.map(({ pos, cor }) => (
              <stop key={pos} offset={`${pos}%`} stopColor={cor} />
            ))}
          </linearGradient>
        </defs>
      )}
      <path d={CAMINHO_DA_MARCA} fill={preenchimento} fillRule="evenodd" />
    </svg>
  );
}
