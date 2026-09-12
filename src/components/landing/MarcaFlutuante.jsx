import { useEffect, useId, useRef, useState } from 'react';

import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../../lib/marca';
import {
  CENTRO_DA_MARCA, OPACIDADE_NO_HERO, TAMANHO_NO_HERO,
} from '../../lib/marcaNoHero';

/**
 * A marca que fica no hero depois da abertura — flutuando, reagindo ao ponteiro
 * e recebendo o mesmo reflexo da abertura de vez em quando.
 *
 * ── O pedido do dono ────────────────────────────────────────────────────────
 *
 * *"a logo ir para o centro da landing... queria que a logo ficasse ali
 * flutuando e tendo interações com o cenário ou com o mouse"*, com o movimento
 * próprio *"aleatório, como se estivesse no espaço"*. E, depois de ver a
 * abertura pronta: *"sabe esse brilho na animação? será que vc pode adicionar
 * ela nessa logo na landing page? ela passa de vez em quando"*.
 *
 * ── Por que ela é o fecho da ideia, e não um enfeite a mais ─────────────────
 *
 * Até 11/09 os trajetos do `ConvergenciaDoHub` convergiam para **espaço vazio**
 * atrás do título. Com a marca aqui, eles convergem **nela** — o nome do
 * produto (Hub = ponto de encontro), o fundo e a marca passam a dizer a mesma
 * coisa em vez de três coisas parecidas.
 *
 * ── Por que ela é DISCRETA, e isso não é timidez ────────────────────────────
 *
 * Ela fica **atrás do texto**, e o parágrafo do hero precisa continuar legível.
 * O que dá presença a ela não é o brilho: é o movimento próprio, a reação ao
 * ponteiro e o reflexo que passa de tempos em tempos.
 *
 * ── Nenhum laço de JavaScript por quadro ────────────────────────────────────
 *
 * Tudo em `transform`, que roda no compositor. O único JavaScript aqui é um
 * `IntersectionObserver` que **pausa** as animações quando o hero sai da tela —
 * e ele existe por causa de uma lição cara: a cena 3D continuava desenhando
 * 60×/s para quem já tinha rolado para longe, e isso custou **29.441 ms** de
 * thread principal num PageSpeed (§0.3).
 *
 * ── `[12/09]` Por que a opacidade virou parâmetro ───────────────────────────
 *
 * Ela é `0.16` no hero e continua sendo — o valor é o contrato de
 * `lib/marcaNoHero.js`, e é o que mantém o parágrafo legível por cima dela.
 *
 * O que mudou é que o prólogo precisa **acender** a marca no ato dela e depois
 * baixá-la até esse mesmo 0,16. Isso não cabe multiplicando opacidade de pai
 * com filho (o produto nunca passa do menor dos dois), então quem controla a
 * opacidade ali é a camada de fora, e este componente entra transparente ao
 * próprio valor — `1` — para não dividir o brilho em dois lugares.
 *
 * @param {object} props
 * @param {number} [props.opacidade] Padrão: o contrato do hero. Só o prólogo
 *   passa outro valor, e passa `1` porque a opacidade dele é animada por fora.
 */
export default function MarcaFlutuante({
  className = '', opacidade = OPACIDADE_NO_HERO,
}) {
  // O `<defs>` é global ao documento, e esta marca convive com a do cabeçalho e
  // com a da abertura. Sem id único, um gradiente rouba o do outro e a marca
  // aparece preta — sem erro nenhum.
  const id = useId().replace(/:/g, '');
  const caixa = useRef(null);
  // Começa VISÍVEL: o hero é a primeira coisa da página, e nascer pausada
  // faria a marca ficar parada até o primeiro relatório do observador.
  const [naTela, setNaTela] = useState(true);

  useEffect(() => {
    const alvo = caixa.current;
    // Navegador sem `IntersectionObserver` fica com a animação sempre ligada —
    // que é o comportamento de antes, e não um defeito novo.
    if (!alvo || typeof IntersectionObserver === 'undefined') return undefined;

    const vigia = new IntersectionObserver(
      ([entrada]) => setNaTela(entrada.isIntersecting),
      // Margem generosa: retomar a animação só quando a marca já entrou na tela
      // faria o primeiro quadro dela ser visto parado.
      { rootMargin: '200px' },
    );
    vigia.observe(alvo);
    return () => vigia.disconnect();
  }, []);

  return (
    <div
      ref={caixa}
      className={`marca-flutuante-ponteiro pointer-events-none absolute
                  -translate-x-1/2 -translate-y-1/2
                  ${naTela ? '' : 'marca-flutuante-parada'} ${className}`}
      style={{
        left: CENTRO_DA_MARCA.x,
        top: CENTRO_DA_MARCA.y,
        width: TAMANHO_NO_HERO,
        height: TAMANHO_NO_HERO,
        opacity: opacidade,
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

              {/* A MESMA faixa do polimento da abertura: transparente, clara no
                  meio, transparente. Repetir o desenho é o ponto — é o mesmo
                  reflexo, voltando de vez em quando. */}
              <linearGradient id={`${id}-faixa`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                <stop offset="50%" stopColor="#fff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>

              <mask id={`${id}-brilho`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                {/* Inclinação igual à da abertura: reflexo em superfície polida
                    corre torto, e vertical leria como cortina. */}
                <g transform="rotate(-16 50 50)">
                  <rect
                    className="marca-flutuante-brilho"
                    x="-46" y="-40" width="46" height="180"
                    fill={`url(#${id}-faixa)`}
                  />
                </g>
              </mask>
            </defs>

            <path d={CAMINHO_DA_MARCA} fill={`url(#${id}-cor)`} fillRule="evenodd" />

            {/* O reflexo, recortado pela PRÓPRIA marca: ele existe só onde há
                objeto, nunca na tela. É a linha que o dono traçou ao descartar
                o clarão — ver `docs/DECISOES.md`. */}
            <path
              d={CAMINHO_DA_MARCA} fill="#ffffff" fillRule="evenodd"
              mask={`url(#${id}-brilho)`}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
