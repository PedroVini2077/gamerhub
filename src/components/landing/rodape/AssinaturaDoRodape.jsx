import { motion, useReducedMotion } from 'framer-motion';
import MarcaGH from '../../ui/MarcaGH';
import { FRASE_DO_ATO_ZERO } from '../../../lib/atosDaLanding';
import { PARADAS_DO_GRADIENTE } from '../../../lib/marca';
import { assinaturaDoRodape, VIEWPORT } from '../../../lib/landingMotion';

/**
 * A ASSINATURA — o epílogo da landing.
 *
 * ── A ideia, e ela é o INVERSO de um ato que já existe ──────────────────────
 *
 * Pedido do dono: *"pense no footer como o epílogo da experiência… a sensação
 * de 'a experiência terminou, mas o universo do GamerHub continua aqui'"*, com
 * o limite explícito: *"menos espetáculo, mais assinatura"*.
 *
 * O prólogo tem um ato chamado CONVERGÊNCIA: fragmentos soltos vindo de todo
 * lado **para dentro** da marca. Aqui os mesmos traços saem **de dentro dela
 * para fora**. É o mesmo vocabulário da página — traço fino, desenhado, na cor
 * da marca —, invertido, e a inversão é exatamente a frase dele: no começo tudo
 * converge para o Hub; no fim, o Hub segue emitindo.
 *
 * Isso é deliberadamente diferente de inventar um enfeite novo para o rodapé.
 * Um estilo visual isolado no fim da página seria o oposto de assinatura.
 *
 * ── A frase é a MESMA do ATO 0, e isso é fonte única, não repetição ─────────
 *
 * `FRASE_DO_ATO_ZERO` é o primeiro texto da landing, sobre a arte de abertura.
 * Reaproveitá-la aqui fecha a página com a frase que a abriu — e como ela vem
 * do mesmo módulo, mudar a tagline muda os dois lados juntos. Escrever de novo
 * aqui criaria duas taglines que divergem no primeiro ajuste (§4).
 *
 * As duas aparições estão a ~11 mil pixels de distância: isso é encadernação,
 * não eco.
 *
 * ── Por que os traços NÃO ficam em laço ─────────────────────────────────────
 *
 * Ele autorizou *"um pulso discreto"*, e eu deixei de fora de propósito. Este é
 * o único lugar da página onde o movimento deve **acabar** — laço infinito no
 * rodapé mantém a página viva justamente onde ela deveria ter assentado, e
 * contradiz a desaceleração que o resto do rodapé constrói.
 *
 * (Se ele quiser o pulso, é uma linha: `repeat: Infinity` no `opacity` dos
 * traços. Fica registrado como escolha, não como esquecimento.)
 */

/**
 * Os traços que saem da marca. Coordenadas num `viewBox` de 400×120, com a
 * marca no centro (200, 60) — os pares são o ponto onde o traço nasce (perto da
 * marca, não nela) e onde ele morre.
 *
 * Eles são simétricos porque a assinatura é centrada, e ficam **fora** do texto:
 * o par mais horizontal passa na altura da marca, os inclinados abrem acima e
 * abaixo. Nenhum cruza o miolo, onde o monograma e o nome moram.
 */
const RAIOS = [
  { d: 'M232 60 H396', atraso: 0 },
  { d: 'M168 60 H4', atraso: 0 },
  { d: 'M228 44 L392 12', atraso: 0.12 },
  { d: 'M172 44 L8 12', atraso: 0.12 },
  { d: 'M228 76 L392 108', atraso: 0.22 },
  { d: 'M172 76 L8 108', atraso: 0.22 },
];

export default function AssinaturaDoRodape() {
  const menosMovimento = useReducedMotion();

  return (
    <motion.div
      variants={assinaturaDoRodape}
      initial="initial"
      whileInView="animate"
      viewport={VIEWPORT}
      // `overflow-x-clip` e não `hidden`: os traços são mais largos que o
      // texto de propósito, e sem recorte eles criavam 59 px de rolagem
      // horizontal no celular — medido, não suposto. `clip` no eixo x deixa o y
      // continuar `visible`, que é a mesma escolha do palco das cenas.
      className="relative overflow-x-clip flex flex-col items-center text-center
                 px-4 pt-14 pb-12 md:pt-20 md:pb-16"
    >
      {/* O SVG é irmão da MARCA, e não do bloco inteiro: centrado no bloco, os
          traços atravessavam a tagline — legível, mas riscado. Ancorado na
          linha da marca, ele irradia de onde deveria e o texto fica limpo
          embaixo.
          `aria-hidden` é obrigatório: seis caminhos SVG anunciados antes do nome
          da marca é ruído puro. `pointer-events-none` porque ele é mais largo
          que a marca e passaria por cima do que estiver ao lado. */}
      <div className="relative flex items-center justify-center gap-3">
      <svg
        aria-hidden
        viewBox="0 0 400 120"
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none absolute left-1/2 top-1/2
                   -translate-x-1/2 -translate-y-1/2
                   h-[120px] w-[130vw] max-w-2xl"
      >
        <defs>
          {/* O gradiente é o da MARCA, espelhado: opaco no centro (onde ele
              nasce) e transparente nas duas pontas, para o traço não terminar
              numa borda dura — que é o mesmo defeito que a costura resolve nas
              emendas das cenas. */}
          <linearGradient id="raioDaAssinatura" x1="0%" x2="100%">
            <stop offset="0%" stopColor={PARADAS_DO_GRADIENTE[3].cor} stopOpacity="0" />
            <stop offset="34%" stopColor={PARADAS_DO_GRADIENTE[2].cor} stopOpacity="0.5" />
            <stop offset="50%" stopColor={PARADAS_DO_GRADIENTE[1].cor} stopOpacity="0.75" />
            <stop offset="66%" stopColor={PARADAS_DO_GRADIENTE[2].cor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={PARADAS_DO_GRADIENTE[3].cor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {RAIOS.map(({ d, atraso }) => (
          <motion.path
            key={d}
            d={d}
            fill="none"
            stroke="url(#raioDaAssinatura)"
            // `non-scaling-stroke` e 1: com o efeito, a espessura passa a ser em
            // PIXEL DE TELA. Sem ele, o `viewBox` de 400 esticado numa tela de
            // 1440 engrossaria o traço 3,6× — e no celular ele sumiria. Foi
            // exatamente esse par que produziu o bug dos traços de 0,18 px.
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            initial={menosMovimento ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: 1.1, delay: 0.25 + atraso, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </svg>

        {/* `relative` para ficar por cima dos traços, que são absolutos. */}
        <div className="relative flex items-center gap-3">
          <MarcaGH tamanho={40} className="md:h-12 md:w-12" />
          <span className="font-display font-bold tracking-wider text-2xl md:text-4xl">
            <span className="text-neon-green">GAMER</span>
            <span className="text-white"> HUB</span>
          </span>
        </div>
      </div>

      <p className="relative mt-5 max-w-sm font-body text-sm md:text-base
                    text-gray-400 leading-relaxed">
        {FRASE_DO_ATO_ZERO}
      </p>
    </motion.div>
  );
}
