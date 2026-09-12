import { motion, useTransform } from 'framer-motion';
import PainelDaCena from './PainelDaCena';

/**
 * COMUNIDADE — a personalidade é **CONEXÃO**.
 *
 * ── A narrativa, e ela é literal ────────────────────────────────────────────
 *
 * `isolado → aproximando → conectado → comunidade`, conduzida pela rolagem.
 * Sete pessoas começam espalhadas e longe, caminham para um ponto comum, e só
 * então as linhas entre elas e o núcleo **se desenham**. A ordem importa: se a
 * linha aparecesse antes do encontro, a cena diria "já estavam ligadas", que é
 * outra história.
 *
 * ── Por que ela NÃO copia o `ConvergenciaDoHub` ─────────────────────────────
 *
 * O fundo do hero tem trajetos anônimos vindo de fora e **parando** num anel em
 * volta do nome: é o produto sendo apresentado. Aqui os pontos têm rosto, eles
 * **se movem**, e o que chega ao centro é gente. É a mesma ideia — Hub é onde
 * as coisas se encontram — num tempo diferente da história: lá é promessa, aqui
 * é a promessa cumprida.
 *
 * ── Custo ───────────────────────────────────────────────────────────────────
 *
 * Cada pessoa é um `<g>` deslocado por `transform`, e a linha é o mesmo par de
 * números virando atributo SVG. Nenhum `useState`, nenhum laço por quadro: o
 * Framer Motion escreve direto no elemento, fora do ciclo de render do React.
 *
 * O desenho da linha usa `pathLength`, que o navegador resolve com
 * `stroke-dasharray` — sem recalcular geometria.
 */

/** O centro do `viewBox`, que é para onde todo mundo caminha. */
const NUCLEO = { x: 50, y: 50 };

/**
 * Sete pessoas: de onde vêm e onde param.
 *
 * ── As posições de partida ficam DENTRO do quadro, e isso é conserto ────────
 *
 * Na primeira versão elas começavam fora do `viewBox` (em -18, 118, 126…). O
 * SVG recorta no `viewBox`, então a primeira metade da cena presa era **uma
 * tela vazia** — e a história perdia justamente o primeiro ato: para ler
 * *"isolado → conectado"* é preciso VER o isolamento.
 *
 * Achado no print, não no código. Nada estourava: o SVG estava lá, correto, e
 * desenhando nada.
 *
 * ── E as posições finais formam um anel IRREGULAR ───────────────────────────
 *
 * Um heptágono perfeito lê como diagrama de rede — genérico, e é justamente o
 * que o dono pediu para evitar. Comunidade não é simétrica.
 */
const PESSOAS = [
  { de: [10, 12], para: [22, 27], cor: '#39ff14', atraso: 0.00 },
  { de: [90, 8], para: [74, 22], cor: '#00ffff', atraso: 0.06 },
  { de: [8, 88], para: [26, 71], cor: '#bf00ff', atraso: 0.03 },
  { de: [92, 90], para: [76, 68], cor: '#39ff14', atraso: 0.09 },
  { de: [50, 6], para: [50, 18], cor: '#ffa33a', atraso: 0.12 },
  { de: [6, 48], para: [16, 49], cor: '#00ffff', atraso: 0.05 },
  { de: [94, 46], para: [84, 47], cor: '#bf00ff', atraso: 0.10 },
];

/** As janelas, dentro do progresso da cena presa. */
const CAMINHA = [0.10, 0.58];
const LIGA = [0.46, 0.80];
const NUCLEO_ACENDE = [0.70, 0.92];

function Pessoa({ progresso, pessoa }) {
  const { de, para, cor, atraso } = pessoa;
  // O atraso escalona a chegada: sete pessoas pousando no mesmo instante lê
  // como animação; chegando em tempos próximos lê como gente.
  const janela = [CAMINHA[0] + atraso, CAMINHA[1] + atraso];
  const x = useTransform(progresso, janela, [de[0], para[0]]);
  const y = useTransform(progresso, janela, [de[1], para[1]]);
  const linha = useTransform(progresso, LIGA, [0, 1]);
  const opacidadeDaLinha = useTransform(progresso, [LIGA[0], LIGA[0] + 0.05], [0, 0.5]);

  return (
    <>
      <motion.line
        x1={NUCLEO.x} y1={NUCLEO.y} x2={x} y2={y}
        stroke={cor} strokeWidth="0.5" strokeLinecap="round"
        style={{ pathLength: linha, opacity: opacidadeDaLinha }}
      />
      <motion.g style={{ x, y }}>
        {/* A pessoa: um retrato de 9 unidades com cabeça e ombros. Abstrato o
            bastante para não virar ícone de estoque, concreto o bastante para
            não ser "mais um ponto num grafo". */}
        <rect x="-4.5" y="-4.5" width="9" height="9" rx="2.6"
              fill="#0d0d12" stroke={cor} strokeWidth="0.55" strokeOpacity="0.85" />
        <circle cx="0" cy="-1.1" r="1.5" fill={cor} fillOpacity="0.9" />
        <path d="M -2.6 3.1 a 2.6 2.6 0 0 1 5.2 0" fill="none"
              stroke={cor} strokeOpacity="0.9" strokeWidth="0.9" strokeLinecap="round" />
      </motion.g>
    </>
  );
}

export default function SobreposicaoDaComunidade({ progresso, lado = 'direita' }) {
  const brilhoDoNucleo = useTransform(progresso, NUCLEO_ACENDE, [0, 1]);
  const escalaDoNucleo = useTransform(progresso, NUCLEO_ACENDE, [0.4, 1]);

  return (
    <PainelDaCena lado={lado} vidro={false} ancora="topo" largura="w-[min(82vw,26rem)]">
      {/* Um véu RADIAL atrás do desenho, e ele é necessário: a arte desta cena é
          cheia de cartões acesos justamente na metade onde a constelação pousa,
          e sem escurecer o fundo as linhas de 0,5 unidade somem no ruído. É o
          mesmo tratamento que o texto recebe — desenho fino sobre arte também
          precisa de chão. */}
      <div className="relative">
        <div
          className="absolute inset-[-14%] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(6,6,8,0.86) 0%, rgba(6,6,8,0.66) 46%, rgba(6,6,8,0) 74%)',
          }}
        />
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="relative w-full h-auto">
        {/* O núcleo é um ANEL, não um disco: o que se forma no meio é um
            espaço onde as pessoas cabem, não um objeto que as absorve. */}
        <motion.g style={{ opacity: brilhoDoNucleo, scale: escalaDoNucleo, originX: '50px', originY: '50px' }}>
          <circle cx={NUCLEO.x} cy={NUCLEO.y} r="7.5" fill="none"
                  stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.55" />
          <circle cx={NUCLEO.x} cy={NUCLEO.y} r="2.2" fill="#39ff14" fillOpacity="0.75" />
        </motion.g>

        {PESSOAS.map((pessoa, i) => (
          <Pessoa key={i} progresso={progresso} pessoa={pessoa} />
        ))}
        </svg>
      </div>
    </PainelDaCena>
  );
}
