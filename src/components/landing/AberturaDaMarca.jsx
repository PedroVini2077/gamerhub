import { useEffect, useId, useRef } from 'react';

import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../../lib/marca';
import { CENTRO_DA_MARCA, TAMANHO_NA_ABERTURA } from '../../lib/marcaNoHero';
import { DURACAO_TOTAL_MS, variaveisDaAbertura } from '../../lib/tempoDaAbertura';

/**
 * A abertura do site: a marca é PINTADA por uma luz, a mesma luz revela a
 * frase, um reflexo corre por cima dela, e a landing abre.
 *
 * ── `[11/09]` Ela era `IntroLightning`, e o nome já não descrevia nada ──────
 *
 * O arquivo se chamava assim porque desenhava um **raio** — a marca do site até
 * 11/09. O raio foi aposentado quando o monograma GH entrou, e a abertura era o
 * último lugar onde ele sobrevivia; o pior de todos, porque é a primeira coisa
 * que alguém vê.
 *
 * ── O que o dono pediu, e o que saiu ────────────────────────────────────────
 *
 * *"pensei dela aparecer como se fosse pintada... depois ela brilhar, sabe
 * aquele brilho de objeto polido? ele se revelar, 'estoura' um brilho e aí sim
 * abrir a landing page"*.
 *
 * Saiu o **clarão verde de tela cheia** — decisão dele, registrada em
 * `docs/DECISOES.md`. A distinção que ficou: luz que lava a TELA está
 * descartada; luz que acontece NA MARCA é o que ele quer.
 *
 * ── O desenho, e por que ele é um mecanismo só ──────────────────────────────
 *
 * "Pintada" e "brilho de objeto polido" são o **mesmo recurso**: uma faixa de
 * luz atravessando a marca por baixo de uma máscara. Muda largura e velocidade.
 * Por isso a abertura é uma luz só, passando três vezes — e a resposta para
 * *"por que isso está se movendo?"*, que o briefing dele exige, é sempre a
 * mesma: **é a mesma luz, ainda andando**.
 *
 * ── Por que o fim é TEMPORIZADOR, e não `animationend` ──────────────────────
 *
 * Herdado da versão anterior e continua valendo: animação cortada — aba em
 * segundo plano, elemento removido, `animation-play-state` — **não dispara
 * evento**, e a abertura ficaria na tela para sempre segurando a landing. O
 * temporizador é o teto absoluto que o §0.3 regra 3 exige.
 */

/** Onde a luz entra e sai, no espaço do `viewBox`. Ver `abertura.css`. */
const FAIXA_DO_PINCEL = { x: -400, largura: 400 };
const FAIXA_DO_POLIMENTO = { x: -46, largura: 46 };

export default function AberturaDaMarca({ onComplete }) {
  const jaChamou = useRef(false);
  // `useId` porque o `<defs>` é global ao documento: dois SVGs com o mesmo id de
  // máscara fazem um roubar a máscara do outro, e o segundo some sem erro.
  const id = useId().replace(/:/g, '');

  useEffect(() => {
    const fim = setTimeout(() => {
      if (jaChamou.current) return;
      jaChamou.current = true;
      onComplete?.();
    }, DURACAO_TOTAL_MS);
    return () => clearTimeout(fim);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-dark-900 overflow-hidden abertura-veu"
      style={variaveisDaAbertura()}
      aria-hidden="true"
    >
      {/* A marca fica no CENTRO COMBINADO com o hero (`lib/marcaNoHero.js`), e
          não no centro do flex. É isso que permite a troca ser um cruzamento em
          vez de um voo até uma posição medida. */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: CENTRO_DA_MARCA.x,
          top: CENTRO_DA_MARCA.y,
          width: TAMANHO_NA_ABERTURA,
          height: TAMANHO_NA_ABERTURA,
          filter: 'drop-shadow(0 0 3px #00ed5455) drop-shadow(0 0 14px #009dfc44)',
        }}
      >
        <defs>
          <linearGradient id={`${id}-cor`} x1="0%" y1="0%" x2="100%" y2="0%">
            {PARADAS_DO_GRADIENTE.map(({ pos, cor }) => (
              <stop key={pos} offset={`${pos}%`} stopColor={cor} />
            ))}
          </linearGradient>

          {/* A faixa que PINTA: branca por quase toda a extensão, esmaecendo só
              na borda da frente. Branco na máscara é "mostra" — então onde ela
              já passou a marca fica, e o esmaecimento é a ponta do pincel. */}
          <linearGradient id={`${id}-faixaPincel`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="94%" stopColor="#fff" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>

          {/* A faixa que POLE: transparente, clara no meio, transparente. É um
              reflexo passando, não uma luz acesa. */}
          <linearGradient id={`${id}-faixaPolimento`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>

          <mask id={`${id}-pincel`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect
              className="abertura-pincel"
              x={FAIXA_DO_PINCEL.x} y="-20"
              width={FAIXA_DO_PINCEL.largura} height="140"
              fill={`url(#${id}-faixaPincel)`}
            />
          </mask>

          {/* Inclinada: reflexo em superfície polida corre torto. Vertical lê
              como cortina, não como brilho. */}
          <mask id={`${id}-polimento`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <g transform="rotate(-16 50 50)">
              <rect
                className="abertura-polimento"
                x={FAIXA_DO_POLIMENTO.x} y="-40"
                width={FAIXA_DO_POLIMENTO.largura} height="180"
                fill={`url(#${id}-faixaPolimento)`}
              />
            </g>
          </mask>
        </defs>

        {/* A marca, revelada pela primeira passagem. */}
        <path
          d={CAMINHO_DA_MARCA} fill={`url(#${id}-cor)`} fillRule="evenodd"
          mask={`url(#${id}-pincel)`}
        />

        {/* O reflexo, recortado pela PRÓPRIA marca: ele existe só onde há
            objeto. É o que o mantém sendo brilho no objeto, e não clarão na
            tela — a linha que o dono traçou. */}
        <path
          d={CAMINHO_DA_MARCA} fill="#ffffff" fillRule="evenodd"
          mask={`url(#${id}-polimento)`}
        />
      </svg>

      {/* A frase, revelada pela mesma luz que pintou a marca. */}
      <p
        className="abertura-frase absolute left-1/2 -translate-x-1/2 w-full px-6
                   text-center font-display uppercase text-gray-300
                   text-[0.78rem] md:text-sm tracking-[0.34em]"
        style={{ top: `calc(${CENTRO_DA_MARCA.y} + ${TAMANHO_NA_ABERTURA} * 0.62)` }}
      >
        Aqui o jogo continua
      </p>
    </div>
  );
}
