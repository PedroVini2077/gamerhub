import { useId } from 'react';

import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../../lib/marca';
import {
  CENTRO_DA_MARCA, OPACIDADE_NO_HERO, TAMANHO_NO_HERO,
} from '../../lib/marcaNoHero';

/**
 * A marca que fica no hero depois da abertura — flutuando e reagindo ao
 * ponteiro.
 *
 * ── O pedido do dono ────────────────────────────────────────────────────────
 *
 * *"eu pensei de a tela ir aparecendo aos poucos e a logo ir para o centro da
 * landing, assim como o antigo raio... queria que a logo ficasse ali flutuando
 * e tendo interações com o cenário ou com o mouse"*. E, sobre o movimento
 * próprio: *"a marca tem um vai e vem próprio aleatório, como se estivesse no
 * espaço"*.
 *
 * ── Por que ela é o fecho da ideia, e não só um enfeite a mais ──────────────
 *
 * Até hoje os trajetos do `ConvergenciaDoHub` convergiam para **espaço vazio**
 * atrás do título. Com a marca aqui, eles passam a convergir **nela** — o nome
 * do produto (Hub = ponto de encontro), o fundo e a marca passam a dizer a
 * mesma coisa em vez de três coisas parecidas.
 *
 * ── Por que ela é DISCRETA, e isso não é timidez ────────────────────────────
 *
 * Ela fica **atrás do texto**, e o parágrafo do hero precisa continuar legível.
 * O que dá presença a ela não é o brilho: é o movimento próprio e a reação ao
 * ponteiro. Objeto que se mexe devagar chama mais atenção do que objeto aceso e
 * parado, e custa menos contraste ao texto.
 *
 * ── O movimento "de espaço", sem laço por quadro ────────────────────────────
 *
 * Duas camadas, cada uma com a sua animação lenta e de durações **primas entre
 * si** (29 s e 41 s). As duas juntas não voltam à mesma posição relativa em
 * quase 20 minutos, então o olho não acha a repetição — é a mesma técnica das
 * luzes de arena do site logado.
 *
 * Tudo em `transform` e `opacity`, que rodam no compositor. Nenhum
 * `requestAnimationFrame` nosso: foi o laço por quadro que custou 5.877 ms de
 * thread em 6 s de página parada na cena 3D (§0.3).
 */
export default function MarcaFlutuante({ className = '' }) {
  // O `<defs>` é global ao documento, e esta marca convive com a do cabeçalho e
  // com a da abertura. Sem id único, um gradiente rouba o do outro e a marca
  // aparece preta — sem erro nenhum.
  const id = useId().replace(/:/g, '');

  return (
    <div
      className={`marca-flutuante-ponteiro pointer-events-none absolute
                  -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{
        left: CENTRO_DA_MARCA.x,
        top: CENTRO_DA_MARCA.y,
        width: TAMANHO_NO_HERO,
        height: TAMANHO_NO_HERO,
        opacity: OPACIDADE_NO_HERO,
      }}
      aria-hidden="true"
    >
      <div className="marca-flutuante-deriva w-full h-full">
        <div className="marca-flutuante-respiro w-full h-full">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
            <defs>
              <linearGradient id={`${id}-cor`} x1="0%" y1="0%" x2="100%" y2="0%">
                {PARADAS_DO_GRADIENTE.map(({ pos, cor }) => (
                  <stop key={pos} offset={`${pos}%`} stopColor={cor} />
                ))}
              </linearGradient>
            </defs>
            <path d={CAMINHO_DA_MARCA} fill={`url(#${id}-cor)`} fillRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
}
