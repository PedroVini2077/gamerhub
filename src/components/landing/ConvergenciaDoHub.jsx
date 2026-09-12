import { useMemo } from 'react';

import { CORES_DA_MARCA } from '../../lib/marca';

/**
 * O fundo do hero: trajetos que CONVERGEM para onde o nome está.
 *
 * ── Por que ele existe, e o que ele substituiu ──────────────────────────────
 *
 * `[11/09]` Até hoje o hero era uma cena 3D com um raio girando — **708 kB**,
 * e o raio é a marca aposentada. O dono corrigiu o rumo com uma frase que já
 * estava no briefing dele e que eu não tinha seguido: *"prefiro isso a
 * adicionar 3D apenas para deixar a página mais impressionante"*.
 *
 * ── O que ele diz ───────────────────────────────────────────────────────────
 *
 * O nome do produto é **Hub**: um ponto onde as coisas se encontram. Este fundo
 * é essa frase desenhada — trajetos chegando de fora e pousando no centro, onde
 * o nome está. Não é enfeite abstrato: é a única direção do briefing que nasce
 * do próprio nome, e ninguém a estava usando.
 *
 * ── A correção que a primeira versão exigiu, e ela é GEOMÉTRICA ─────────────
 *
 * A primeira versão desenhava cada trajeto **inteiro**, da borda até o centro,
 * e tentava resolver o atropelo do texto com opacidade: o traço nascia
 * transparente, acendia no meio e apagava antes de chegar. No print isso falhou
 * pelos dois lados — as linhas ainda cruzavam o título, e como apagavam num
 * ponto arbitrário, liam como **risco na tela**, não como chegada.
 *
 * O erro não era de calibragem, era de construção: reta que aponta para o
 * centro **passa por cima do que está no centro**, e nenhuma opacidade
 * conserta isso. O que conserta é o traço **parar** — cada um existe só no anel
 * entre o raio externo e a borda de uma elipse que envolve o bloco de texto. A
 * elipse nunca é desenhada; ela é o espaço limpo onde o texto vive.
 *
 * O ganho é duplo: o texto fica em área garantidamente livre, e a convergência
 * passa a ser **legível** — dez traços curtos, todos apontando para o mesmo
 * lugar e parando na mesma distância, é o que o olho lê como íris. Traço longo
 * atravessando a tela inteira lê como ruído.
 *
 * ── Por que `preserveAspectRatio="none"` ───────────────────────────────────
 *
 * Porque a zona limpa precisa acompanhar o **bloco de texto**, que é
 * proporcional ao contêiner nos dois eixos. Com `slice`, o `viewBox` quadrado
 * era recortado na horizontal: num celular de 400 px só apareciam as unidades
 * 25–75, e o anel inteiro ficava fora da tela.
 *
 * Distorcer é seguro aqui e isso não é opinião: escala não uniforme é uma
 * transformação **afim**, e afim preserva reta e ponto de concorrência. Os
 * traços continuam sendo retas que se encontram no mesmo ponto. O que ela
 * mudaria é a espessura — resolvido com `vector-effect="non-scaling-stroke"`,
 * que fixa o traço em pixels de tela.
 *
 * ── Por que SVG e CSS, e não canvas ─────────────────────────────────────────
 *
 * Custo. A cena que saiu pesava 708 kB e ocupava a thread principal; isto é
 * markup estático com animação de `transform` e `opacity`, que rodam no
 * compositor. E `prefers-reduced-motion` desliga o movimento sem apagar o
 * desenho — quem pede menos animação continua vendo a composição.
 */

/** Quantos trajetos. Ímpar de propósito: evita simetria de espelho perfeita. */
const TRAJETOS = 11;

/** O centro, em % do hero. O bloco de texto fica centrado em ~49% da altura. */
const ALVO = { x: 50, y: 49 };

/**
 * A zona limpa — a elipse que NENHUM traço invade.
 *
 * Medida no print de 1280×800: o bloco de texto (sobrancelha, título,
 * parágrafo, botão e o link de conta bloqueada) ocupa 31–69% da largura e
 * 32–67% da altura. Os raios abaixo são esses limites com folga.
 */
const LIMPO = { rx: 25, ry: 22 };

/** Até onde o traço vai para fora. Curto de propósito: ver o cabeçalho. */
const FORA = { min: 34, max: 45 };

/**
 * `[12/09]` O RASTRO — quanto os trajetos que apontam para BAIXO continuam
 * depois de sair da tela do hero.
 *
 * O dono mandou print: *"as linhas que vc desenhou com alguns objetos indo em
 * direção a logo do site, elas estão cortadas, antes dessa reformulação elas
 * atravessavam até os cards"*. Ele está certo, e a causa é do palco: o elemento
 * preso tem `overflow-hidden` (a arte escala 1,18 e criaria barra), então o SVG
 * era recortado exatamente na altura da tela.
 *
 * O rastro não muda a composição do hero — os trajetos originais continuam
 * idênticos. Ele acrescenta uma CONTINUAÇÃO a partir do ponto externo de cada
 * trajeto que desce, com uma fração da intensidade, atravessando a emenda e
 * apagando sozinha antes de chegar na primeira cena.
 *
 * Só para baixo: continuar para cima desenharia por trás do cabeçalho, onde não
 * há nada para atravessar.
 */
const RASTRO = { alcance: 2.4, opacidade: 0.2 };

/**
 * Onde cada traço começa e termina.
 *
 * O ponto interno é a interseção do raio com a elipse limpa — resolvido, não
 * aproximado: num raio de ângulo θ, o ponto `t·(cosθ, senθ)` está na elipse
 * quando `(t·cosθ/rx)² + (t·senθ/ry)² = 1`, ou seja
 * `t = 1 / √((cosθ/rx)² + (senθ/ry)²)`.
 *
 * Isso importa porque a elipse não é círculo: parar todo mundo na mesma
 * distância deixaria buraco em cima e invasão nas laterais.
 */
function useTrajetos() {
  return useMemo(() => Array.from({ length: TRAJETOS }, (_, i) => {
    // Distribuição irregular: regular demais lê como mira, não como fluxo.
    const angulo = (i * 360) / TRAJETOS + (i % 3) * 6;
    const rad = (angulo * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sen = Math.sin(rad);

    const dentro = 1 / Math.hypot(cos / LIMPO.rx, sen / LIMPO.ry);
    const fora = FORA.min + ((i * 5) % (FORA.max - FORA.min));

    // Um trajeto "desce" quando o seno é claramente positivo. O corte em 0,3
    // deixa de fora os quase-horizontais, que só sairiam pelos lados.
    const desce = sen > 0.3;

    return {
      id: i,
      desce,
      // Onde o rastro termina, se houver: o mesmo raio, mais longe.
      x3: ALVO.x + cos * fora * RASTRO.alcance,
      y3: ALVO.y + sen * fora * RASTRO.alcance,
      // De fora para dentro: é o sentido da chegada.
      x1: ALVO.x + cos * fora,
      y1: ALVO.y + sen * fora,
      x2: ALVO.x + cos * dentro,
      y2: ALVO.y + sen * dentro,
      // O lado decide a cor: esquerda verde, direita roxo.
      cor: cos < 0 ? CORES_DA_MARCA.verde : CORES_DA_MARCA.roxo,
      // Só uma parte dos trajetos carrega um ponto, e isso foi medido no print:
      // com onze pontos simultâneos eles viravam o elemento mais brilhante da
      // tela — pastilhas espalhadas, não chegadas. Chegada é **evento**; onze
      // eventos ao mesmo tempo é tráfego de fundo.
      leva: i % 3 === 0,
      atraso: (i * 0.62) % 4.4,
      duracao: 3.6 + (i % 3) * 0.8,
    };
  }), []);
}

/**
 * @param {boolean} [props.rastro] Deixar os trajetos que descem CONTINUAREM
 *   para fora da caixa. Só o prólogo usa: é ele que precisa atravessar a emenda
 *   até a faixa de destaques. Exige que nenhum ancestral recorte na vertical.
 */
export default function ConvergenciaDoHub({ className = '', rastro = false }) {
  const trajetos = useTrajetos();

  return (
    <div className={`pointer-events-none ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full convergencia"
        // `overflow: visible` é o que permite desenhar FORA do `viewBox`. Sem
        // ele o SVG recorta na própria caixa e o rastro não existiria — que era
        // metade do problema; a outra metade é o recorte do palco.
        style={rastro ? { overflow: 'visible' } : undefined}
      >
        <defs>
          {/* Afina nas DUAS pontas e acende no meio. O traço não "começa" nem
              "acaba" em lugar nenhum — ele é um lampejo apontado. */}
          {trajetos.map((t) => (
            <linearGradient
              key={`g${t.id}`} id={`conv-${t.id}`} gradientUnits="userSpaceOnUse"
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            >
              <stop offset="0%" stopColor={t.cor} stopOpacity="0" />
              <stop offset="55%" stopColor={t.cor} stopOpacity="0.38" />
              <stop offset="100%" stopColor={t.cor} stopOpacity="0" />
            </linearGradient>
          ))}
          {/* O gradiente do rastro: começa onde o trajeto acabou, com uma
              fração da intensidade dele, e apaga por completo antes do fim.
              É o que faz a linha ATRAVESSAR a emenda em vez de terminar nela. */}
          {trajetos.filter((t) => t.desce).map((t) => (
            <linearGradient
              key={`r${t.id}`} id={`rastro-${t.id}`} gradientUnits="userSpaceOnUse"
              x1={t.x1} y1={t.y1} x2={t.x3} y2={t.y3}
            >
              <stop offset="0%" stopColor={t.cor} stopOpacity={RASTRO.opacidade} />
              <stop offset="45%" stopColor={t.cor} stopOpacity={RASTRO.opacidade * 0.7} />
              <stop offset="100%" stopColor={t.cor} stopOpacity="0" />
            </linearGradient>
          ))}
          <radialGradient id="conv-nucleo">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="45%" stopColor={CORES_DA_MARCA.azul} stopOpacity="0.05" />
            <stop offset="100%" stopColor={CORES_DA_MARCA.azul} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* O núcleo: o ponto de encontro, atrás do nome. Ele preenche a zona
            limpa — é o que faz o vazio ler como clareira, e não como buraco. */}
        <ellipse
          cx={ALVO.x} cy={ALVO.y} rx={LIMPO.rx * 1.5} ry={LIMPO.ry * 1.5}
          fill="url(#conv-nucleo)"
        />

        {trajetos.map((t) => (
          <g key={t.id}>
            {/* O rastro vem PRIMEIRO: ele é o fundo do trajeto, e o trajeto é o
                assunto. Desenhado depois, ele apareceria por cima do que ele
                próprio continua. */}
            {rastro && t.desce && (
              <line
                x1={t.x1} y1={t.y1} x2={t.x3} y2={t.y3}
                stroke={`url(#rastro-${t.id})`} strokeWidth="1.4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <line
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={`url(#conv-${t.id})`} strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
            {/* O que chega. Anima de fora para dentro e desaparece ao pousar. */}
            {t.leva && (
              <circle
                r="0.19" fill={t.cor} className="convergencia-ponto"
                style={{
                  animationDelay: `${t.atraso}s`,
                  animationDuration: `${t.duracao}s`,
                }}
              >
                <animateMotion
                  dur={`${t.duracao}s`} begin={`${t.atraso}s`} repeatCount="indefinite"
                  path={`M${t.x1} ${t.y1} L${t.x2} ${t.y2}`} calcMode="spline"
                  keyTimes="0;1" keySplines="0.4 0 0.2 1"
                />
              </circle>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
