import raio460 from '../../assets/marca/raio-460.webp';
import raio260 from '../../assets/marca/raio-260.webp';
import {
  ANEIS, FRAGMENTOS, POR_PROFUNDIDADE, FRAGMENTO_EXTERNO, FRAGMENTO_FACETA,
} from './cena/pecasDaCena';

// A cena da Landing em CSS + SVG — a versão que TODO MUNDO recebe.
//
// ── O que mudou em 10/09, e por quê ─────────────────────────────────────────
//
// Antes: um raio em wireframe e quatro sólidos de contorno nos cantos. Era
// desenho meu, e lia como enfeite genérico de SaaS. O dono pediu o oposto —
// *"use essas imagens como base real da experiência visual, em vez de tentar
// recriar tudo do zero"* — e ele está certo: a arte da identidade já existe,
// aprovada, e reconstruí-la em vetor só perde informação.
//
// **A regra que ele deu, e que decide tudo aqui:** a imagem não entra como
// `<img>` solto nem como fundo. Ela é o ARTEFATO no centro de uma composição
// construída em volta — molduras, profundidade, camadas, iluminação.
//
// ── A técnica que torna isto barato: `screen` em vez de canal alfa ──────────
//
// A arte original (`08-raio-nucleo-aceso.webp`) tem alfa de verdade — 82,8% do
// quadro é transparente. Usá-la assim custava **67 kB** no tamanho de tela,
// porque o canal alfa domina a compressão do WebP.
//
// Só que a página é quase preta e o raio é um cristal que BRILHA. Composto
// sobre preto, sem alfa, e desenhado com `mix-blend-mode: screen`, o preto some
// sozinho (somar zero não muda nada) e sobra a luz. Medido: **18,9 kB** — 3,5×
// menor, mais leve que o `feed.jpg` da própria landing.
//
// E o ganho não é só peso: o `screen` funde o glow na página em vez de deixar a
// arte num retângulo com borda de recorte. É o que faz a peça parecer que
// EMITE luz em vez de estar colada por cima.
//
// ── Por que continua com custo de JavaScript ZERO ───────────────────────────
//
// Tudo aqui é `@keyframes` de CSS sobre `transform` e `opacity`, que rodam no
// compositor. Nenhum `requestAnimationFrame`, nenhum estado de React. Era a
// propriedade da cena antiga e ela foi preservada — é o que separa esta cena da
// 3D, que custa 887 kB e disputa a main thread.
//
// `motion-reduce:animate-none` desliga o movimento para quem pediu menos
// movimento no sistema; a composição continua de pé, parada.

// ── A geometria da cena, DERIVADA e ancorada no NÚCLEO ──────────────────────
//
// Duas versões erradas antes desta, e as duas só apareceram no print:
//
//  1. tamanho do raio e centro dos anéis digitados separados — discordaram em
//     **13vh**, e a cena lia como duas coisas empilhadas;
//  2. altura em `vh` puro — no celular (390x844) o raio ficava com metade da
//     LARGURA da tela e engolia o título. `vh` não sabe nada sobre a largura.
//
// A saída para as duas é a mesma: **uma expressão só, e tudo ancorado no
// núcleo por `calc()`**. `min(vh, vmin)` faz o raio encolher quando a tela é
// estreita; os anéis e o brilho seguem por cálculo, então não existe número
// para desalinhar.
const ALTURA_RAIO = 'min(42vh, 56vmin)';
const TOPO_RAIO   = '1vh';

/** Onde o núcleo cai dentro da própria arte (medido na imagem). */
const NUCLEO_NA_ARTE = 0.46;

/** O ponto que TUDO orbita — em CSS, para acompanhar o raio em qualquer tela. */
const CENTRO_Y = `calc(${TOPO_RAIO} + ${ALTURA_RAIO} * ${NUCLEO_NA_ARTE})`;

/** O campo dos anéis: bem maior que a arte, para orbitarem por fora dela. */
const CAMPO = `calc(${ALTURA_RAIO} * 2.7)`;

// ── A máscara, e por que ela é ELÍPTICA e não uma faixa vertical ────────────
//
// `mix-blend-mode: screen` deveria fazer o preto da arte sumir. **Ele não
// alcança o fundo da página, e isso foi diagnosticado, não suposto:** a
// `Landing` envolve o conteúdo inteiro num `div.relative.z-10` (para ficar
// acima da camada de dados), e `z-index` em elemento posicionado cria contexto
// de empilhamento. O `screen` só enxerga o que é pintado DENTRO desse contexto,
// e o `grid-bg` da página está fora dele. Resultado: o quadrado preto da arte
// tapava o grid, com aresta reta visível.
//
// Tirar aquele `z-10` consertaria o blend e quebraria a ordem de pintura da
// landing — troca ruim. Ir para a arte com canal alfa custava **3,5× mais
// bytes**. `mask-mode: luminance` resolveria de graça, mas não existe no
// Safari, e enfeite que some sem erro é exatamente a falha muda do §1.5.
//
// A saída é a máscara: sem aresta, não há caixa. E ela não é remendo — a
// própria referência tem uma vinheta escura em volta do raio, então a área
// escura passa a LER como atmosfera. De quebra, atende ao pedido de
// "elementos parcialmente fora da composição": as pontas das lâminas se
// dissolvem em vez de terminarem cortadas.
//
// A elipse é deslocada para cima (44%) porque o núcleo também é — a máscara
// acompanha o peso da arte, não o centro geométrico do quadrado.
const MASCARA =
  'radial-gradient(ellipse 58% 50% at 50% 41%, #000 54%, #0005 78%, transparent 98%)';

export default function Scene2D() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* ── 1. Atmosfera ───────────────────────────────────────────────────
          Névoa sem forma. Na referência é o que impede o fundo de ser um vazio
          chapado — o raio precisa de ar em volta para parecer suspenso.

          A opacidade vive no ALFA das cores, e não numa classe `opacity-*`:
          `opacity` cria contexto de empilhamento, que é o que já quebrou o
          `screen` do raio uma vez. */}
      <div
        className="absolute inset-x-0 mx-auto top-[4%] w-[120vw] h-[64vh]"
        style={{
          background:
            'radial-gradient(ellipse 50% 42% at 50% 40%, #0d3d1a3b 0%, #06231124 42%, transparent 72%)',
        }}
      />

      {/* ── 2. O quadro dos fragmentos ─────────────────────────────────────
          Ocupa a tela toda: os fragmentos de PERTO precisam ser cortados pela
          borda para a profundidade de campo funcionar. */}
      <div className="absolute inset-0">
        {FRAGMENTOS.filter(f => f.profundidade !== 'perto').map(f => (
          <Fragmento key={f.chave} {...f} />
        ))}
      </div>

      {/* ── 3. O campo de órbita ───────────────────────────────────────────
          Ancorado no NÚCLEO por `calc()`, não num percentual de um quadro à
          parte. É isto que impede os anéis de escorregarem para longe do raio
          quando a tela muda de proporção — o erro de 13vh da primeira versão. */}
      <div
        className="absolute left-1/2"
        style={{
          top: CENTRO_Y, width: CAMPO, height: CAMPO,
          transform: 'translate(-50%, -50%)', zIndex: 2,
        }}
      >
        <svg
          viewBox="0 0 100 100" className="w-full h-full"
          style={{ filter: 'drop-shadow(0 0 6px #39ff1440)' }}
        >
          <defs>
            <linearGradient id="anel" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#39ff14" stopOpacity="0" />
              <stop offset="28%"  stopColor="#39ff14" stopOpacity="1" />
              <stop offset="62%"  stopColor="#7de3ff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ANEIS.map(a => (
            <g
              key={a.chave}
              className="animate-anel-orbita motion-reduce:animate-none"
              style={{
                transformOrigin: '50% 50%',
                animationDuration: a.duracao,
                animationDirection: a.sentido,
              }}
            >
              <ellipse
                cx="50" cy="50" rx={a.rx} ry={a.ry}
                fill="none" stroke="url(#anel)"
                strokeWidth={a.espessura} vectorEffect="non-scaling-stroke"
                opacity={a.opacidade}
                transform={`rotate(${a.giro} 50 50)`}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* ── 4. O brilho do NÚCLEO ──────────────────────────────────────────
          Fica ATRÁS da arte: o núcleo do raio é vazado, então a luz aparece
          através dele. Por cima, viraria uma mancha sobre o cristal. */}
      <div
        className="absolute left-1/2 animate-nucleo-pulsa motion-reduce:animate-none"
        style={{
          zIndex: 3, top: CENTRO_Y,
          width: `calc(${ALTURA_RAIO} * 0.62)`, height: `calc(${ALTURA_RAIO} * 0.62)`,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle, #eaffe6 0%, #39ff14cc 16%, #39ff1455 34%, transparent 66%)',
        }}
      />

      {/* ── 5. O RAIO ──────────────────────────────────────────────────────
          `min(vh, vmin)` é o que impede a arte de engolir a tela do celular:
          num aparelho estreito ela encolhe junto com a largura, e não só com a
          altura. Medido: em `42vh` puro num 390x844, o raio ficava com metade
          da largura da tela por cima do título. */}
      <picture>
        <source media="(max-width: 640px)" srcSet={raio260} />
        <img
          src={raio460}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="low"
          className="absolute left-1/2 w-auto max-w-none animate-raio-respira motion-reduce:animate-none"
          style={{
            zIndex: 4,
            top: TOPO_RAIO, height: ALTURA_RAIO,
            mixBlendMode: 'screen',
            maskImage: MASCARA,
            WebkitMaskImage: MASCARA,
          }}
        />
      </picture>

      {/* ── 6. Fragmentos de PERTO ─────────────────────────────────────────
          Grandes, desfocados e cortados pela borda — a camada que dá
          profundidade de campo (ver `cena/pecasDaCena.js`). */}
      <div className="absolute inset-0">
        {FRAGMENTOS.filter(f => f.profundidade === 'perto').map(f => (
          <Fragmento key={f.chave} {...f} />
        ))}
      </div>
    </div>
  );
}

/**
 * Um fragmento de cristal.
 *
 * Uma silhueta só, girada e escalada — e a faceta interna pegando luz de um
 * lado, que é o que separa "cristal" de "losango".
 */
function Fragmento({ x, y, tamanho, giro, atraso, cor, profundidade }) {
  const { blur, opacidade, z } = POR_PROFUNDIDADE[profundidade];
  return (
    // DOIS divs, e não um: o `transform` do `@keyframes` substitui o do
    // elemento por inteiro, então giro e animação no mesmo lugar fariam o giro
    // sumir no primeiro quadro. O de fora posiciona e gira; o de dentro anima.
    <div
      className="absolute"
      style={{
        left: `${x}%`, top: `${y}%`, width: tamanho, height: tamanho,
        zIndex: z, opacity: opacidade, filter: `blur(${blur})`,
        transform: `translate(-50%, -50%) rotate(${giro}deg)`,
      }}
    >
      <div
        className="w-full h-full animate-fragmento-flutua motion-reduce:animate-none"
        style={{ animationDelay: atraso }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path d={FRAGMENTO_EXTERNO} fill={`${cor}22`} stroke={cor} strokeWidth="2.5" strokeLinejoin="round" />
          <path d={FRAGMENTO_FACETA} fill={`${cor}44`} />
        </svg>
      </div>
    </div>
  );
}
