import { useId } from 'react';

/**
 * `[18/09]` O PORTAL — o Ato 0 desenhado à mão, em SVG.
 *
 * ── EXPERIMENTO, e isso não é ressalva de rodapé ────────────────────────────
 *
 * Pedido dele: *"na documentação fala algo sobre tirar as cenas em imagem e
 * usar SVG, quero que vc faça a mudança só na primeira cena, algo que faça
 * sentido com portal… e queria ver na preview, **depois pode desfazer**"*.
 *
 * É para **olhar e decidir**, não para ficar. O
 * [`EVOLUCAO-VISUAL-DA-LANDING.md`](../../../docs/identidade/EVOLUCAO-VISUAL-DA-LANDING.md)
 * lista SVG como um dos quatro caminhos, e diz quando ele passa a fazer
 * sentido: *"o conceito é estrutura — grade, conexão, fluxo"*. **Portal é
 * estrutura**: anel, profundidade e convergência são geometria, não textura.
 *
 * ── A PRIMEIRA VERSÃO FICOU FEIA, e o que ela ensinou ───────────────────────
 *
 * Anéis concêntricos de mesma cor e espessura parecida não leem como portal —
 * leem como **alvo de tiro**. Vi no navegador antes de mostrar a ele, e o
 * problema não era acabamento: era o desenho não ter **eixo**.
 *
 * O que faz um portal parecer portal, e que a v1 não tinha:
 *
 * | | |
 * | --- | --- |
 * | **perspectiva** | o `rx` encolhe mais rápido que o `ry` — o anel de dentro é mais *estreito*, não só menor. É isso que vira túnel |
 * | **cor com distância** | roxo longe, ciano no meio, verde perto. Cor única achata tudo no mesmo plano |
 * | **espessura decrescente** | o traço de fora é grosso e apagado; o de dentro, fino e aceso |
 * | **chão** | sem horizonte o portal flutua no vazio, como adesivo colado |
 *
 * ── As regras que este arquivo obedece ──────────────────────────────────────
 *
 * | Regra | Como |
 * | --- | --- |
 * | nada de laço por quadro (§0.3) | só CSS: `transform` e `opacity`, no compositor |
 * | nada de `filter: blur()` animado | o desfoque é **estático**, rasterizado uma vez |
 * | `prefers-reduced-motion` | a composição fica **parada**, não vazia |
 * | `useId` nos `<defs>` | id de gradiente é global: dois SVGs com o mesmo id, e o segundo some **sem erro** |
 * | `aria-hidden` | é ambientação; o assunto está na frase por cima |
 *
 * ── O que ele NÃO tenta fazer ───────────────────────────────────────────────
 *
 * Imitar a arte gerada. Cena pintada tem ruído, profundidade e luz que vetor
 * não alcança — tentar seria o pior dos dois. Ele faz o que **vetor faz
 * melhor**: linha limpa, escala infinita, peso de texto.
 */

/**
 * Os anéis do túnel, de FORA para DENTRO.
 *
 * `rx` cai mais rápido que `ry` de propósito — é a perspectiva. E a cor viaja
 * do roxo (longe) ao verde (perto), que é a paleta da marca usada como
 * profundidade em vez de enfeite.
 */
const ANEIS = [
  { rx: 30, ry: 44, largura: 1.10, cor: '#bf00ff', opacidade: 0.16, dur: '23s' },
  { rx: 22, ry: 35, largura: 0.85, cor: '#7c3aed', opacidade: 0.24, dur: '19s' },
  { rx: 15, ry: 27, largura: 0.65, cor: '#22d3ee', opacidade: 0.34, dur: '17s' },
  { rx: 9.5, ry: 19, largura: 0.50, cor: '#39ff14', opacidade: 0.50, dur: '13s' },
  { rx: 6.4, ry: 13, largura: 0.34, cor: '#b6ffd0', opacidade: 0.70, dur: '11s' },
];

/**
 * As fagulhas que sobem de dentro do portal.
 *
 * Determinístico, sem `Math.random`: sorteio mudaria a composição a cada render
 * e tiraria o controle de onde cada uma nasce — mesmo motivo do `zigzagPath` do
 * `ElectricTitle`.
 */
const FAGULHAS = [
  { x: 46.5, r: 0.30, dur: '9s', atraso: '0s' },
  { x: 52.0, r: 0.22, dur: '11s', atraso: '1.7s' },
  { x: 49.0, r: 0.26, dur: '13s', atraso: '3.1s' },
  { x: 54.0, r: 0.18, dur: '10s', atraso: '5.2s' },
  { x: 44.5, r: 0.20, dur: '12s', atraso: '6.8s' },
];

export default function PortalDoAtoZero({ className = 'w-full h-full' }) {
  // `useId` porque `<defs>` é global ao documento — ver a tabela acima.
  const id = useId().replace(/:/g, '');
  const ceu = `ceu-${id}`;
  const boca = `boca-${id}`;
  const brilho = `brilho-${id}`;
  const chao = `chao-${id}`;

  return (
    <div className={`${className} portal-ato-zero`} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        <defs>
          {/* O fundo não é preto chapado: a luz do portal precisa ter de onde
              sair, e um radial dá o "longe" sem custar textura. */}
          <radialGradient id={ceu} cx="50%" cy="46%" r="78%">
            <stop offset="0%" stopColor="#0a1f18" />
            <stop offset="40%" stopColor="#080d14" />
            <stop offset="100%" stopColor="#060608" />
          </radialGradient>

          {/* A boca — o que se vê do outro lado. */}
          <radialGradient id={boca} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f2fff7" stopOpacity="0.98" />
            <stop offset="28%" stopColor="#8affb4" stopOpacity="0.72" />
            <stop offset="62%" stopColor="#39ff14" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#060608" stopOpacity="0" />
          </radialGradient>

          {/* O chão: some para as bordas, senão vira uma faixa com fim visível. */}
          <linearGradient id={chao} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#39ff14" stopOpacity="0" />
            <stop offset="50%" stopColor="#39ff14" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#39ff14" stopOpacity="0" />
          </linearGradient>

          {/* Desfoque ESTÁTICO: rasterizado uma vez. O que se move por cima é
              `transform`/`opacity`, no compositor. Animar o filtro é o
              travamento clássico de celular (§0.3). */}
          <filter id={brilho} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="2.8" />
          </filter>
        </defs>

        <rect width="100" height="100" fill={`url(#${ceu})`} />

        {/* ── O TÚNEL ───────────────────────────────────────────────────── */}
        <g className="portal-tunel">
          {ANEIS.map((a, i) => (
            <ellipse
              key={i}
              cx="50" cy="48" rx={a.rx} ry={a.ry}
              fill="none" stroke={a.cor}
              strokeWidth={a.largura} opacity={a.opacidade}
              className="portal-anel"
              style={{ animationDuration: a.dur, animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </g>

        {/* ── A BOCA, e o aro que a define ──────────────────────────────── */}
        <ellipse cx="50" cy="48" rx="3.4" ry="7.6" fill={`url(#${boca})`} className="portal-boca" />
        <ellipse
          cx="50" cy="48" rx="3.4" ry="7.6"
          fill="none" stroke="#eafff2" strokeWidth="0.18" opacity="0.9"
        />

        {/* ── O halo: é ele que faz a luz VAZAR para a cena ─────────────── */}
        <ellipse
          cx="50" cy="48" rx="8" ry="15"
          fill="#39ff14" opacity="0.10" filter={`url(#${brilho})`}
          className="portal-halo"
        />

        {/* ── As fagulhas que sobem ─────────────────────────────────────── */}
        <g className="portal-fagulhas">
          {FAGULHAS.map((f, i) => (
            <circle
              key={i}
              cx={f.x} cy="48" r={f.r}
              fill="#b6ffd0"
              className="portal-fagulha"
              style={{ animationDuration: f.dur, animationDelay: f.atraso }}
            />
          ))}
        </g>

        {/* ── O CHÃO: sem horizonte o portal flutua no vazio ────────────── */}
        <ellipse cx="50" cy="88" rx="44" ry="1.1" fill={`url(#${chao})`} />
        <ellipse
          cx="50" cy="88" rx="26" ry="5"
          fill="#39ff14" opacity="0.07" filter={`url(#${brilho})`}
        />
      </svg>
    </div>
  );
}
