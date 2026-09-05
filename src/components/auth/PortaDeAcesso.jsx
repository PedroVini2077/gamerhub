/**
 * A PORTA de acesso — e ela é A TELA, não um desenho dentro da tela.
 *
 * ── `[05/09]` A correção que motivou esta reescrita ─────────────────────────
 *
 * A versão anterior era um SVG de `max-height: 62vh` centralizado, com pilares,
 * base e placa de topo, e fundo preto em volta. O dono cortou, e a frase dele é
 * a especificação: *"a porta é pra ser a tela inteira, entendeu? A TELA INTEIRA!
 * não uma imagem abrindo, é pra ter imersão"*.
 *
 * A diferença não é de tamanho, é de **enquadramento**. Enquanto existe um
 * "fora da porta" na tela, o olho lê um objeto: uma ilustração de porta. Quando
 * a porta encosta nas quatro bordas, não sobra fora — e aí a pessoa não está
 * olhando uma porta, está atrás dela.
 *
 * ── Por que CSS para as folhas e SVG só para a tranca ───────────────────────
 *
 * Foi a decisão técnica que destravou o problema, e ela veio de uma medida.
 * Um SVG único de tela cheia precisa de `preserveAspectRatio`, e nenhum dos
 * dois modos serve:
 *
 * | modo | o que acontece no celular (390x844) |
 * | --- | --- |
 * | `meet` | a porta cabe inteira e sobra fundo em volta — o defeito de novo |
 * | `slice` | com viewBox 1200x800, sobram ~370 unidades de largura: some tudo menos a tranca |
 * | `none` | a tranca deixa de ser redonda e vira uma elipse achatada |
 *
 * Então a divisão passou a ser por natureza de cada peça:
 *
 *   **superfície** -> CSS. Gradiente, nervura e listra se esticam para qualquer
 *   proporção sem deformar nada, porque não têm forma própria a preservar.
 *
 *   **mecanismo** -> SVG. A tranca tem forma, e a forma precisa continuar
 *   redonda. Ela é um quadrado de lado fixo, centrado na emenda.
 *
 * ── O truque que apaga três problemas de uma vez ────────────────────────────
 *
 * Cada folha é `overflow: hidden` e a tranca é desenhada INTEIRA dentro das
 * duas, centrada na emenda. A folha esquerda mostra a metade esquerda do disco,
 * a direita mostra a outra — não porque alguém recortou, mas porque é o que
 * cabe. Disso saem de graça:
 *
 *   1. simetria exata, já que é o mesmo desenho nas duas;
 *   2. a metade viaja com a folha na abertura, sem conta nenhuma;
 *   3. nada aparece fora da moldura quando as folhas saem — o defeito do print
 *      de 04/09, em que elas deslizavam e ficavam flutuando sobre o fundo.
 *
 * ── O que a abertura revela ─────────────────────────────────────────────────
 *
 * O SITE. Não há cor de fundo por baixo das folhas de propósito: elas são o que
 * cobre a tela, e quando saem o que aparece atrás é a página já montada. Um
 * fundo ali esconderia justamente aquilo que a porta existe para revelar.
 *
 * ── Onde mora o quê ─────────────────────────────────────────────────────────
 *
 *     este arquivo ............ a estrutura e o desenho da tranca
 *     estilos/portao.css ...... a superfície e todo o movimento
 *     PortaoDeBoasVindas.jsx .. os estados e os tempos
 */

/** Lado do quadrado da tranca, em unidades do seu próprio viewBox. */
const D = 200;
/** Centro e raio do disco, dentro desse quadrado. */
const C = D / 2;
const R = 92;

/** Os dentes do disco: oito em volta, um a cada 45°. */
const DENTES = Array.from({ length: 8 }, (_, i) => i * 45);

export default function PortaDeAcesso() {
  return (
    <div className="porta" aria-hidden="true">
      <FolhaDaPorta lado="esq" />
      <FolhaDaPorta lado="dir" />
    </div>
  );
}

/**
 * Uma folha — metade da tela.
 *
 * A decoração vai dentro de `.porta-face`, e na folha direita essa face é
 * espelhada por CSS. A tranca fica FORA da face, senão o raio da marca sairia
 * ao contrário de um lado.
 */
function FolhaDaPorta({ lado }) {
  return (
    <div className={`porta-folha porta-folha-${lado}`}>
      <div className="porta-face">
        {/* Os dois blocos blindados, com o canto chanfrado. Canto reto lê como
            caixa; chanfro lê como blindagem. */}
        <div className="porta-bloco porta-bloco-alto" />
        <div className="porta-bloco porta-bloco-baixo" />

        {/* O neon da paleta do site: verde na diagonal principal, ciano e roxo
            de apoio. É o que amarra a porta ao resto do GamerHub. */}
        <span className="porta-neon porta-neon-1" />
        <span className="porta-neon porta-neon-2" />
        <span className="porta-neon porta-neon-3" />

        {/* Faixa de perigo na borda EXTERNA (a borda da tela) — a leitura mais
            rápida de "porta pesada" que existe, e custa um gradiente repetido.
            Junto da emenda ela sumia atrás do disco; ver o CSS. */}
        <div className="porta-faixa" />

        {/* O ferrolho: a barra que recua quando destranca. É a peça que torna
            "destrancou" visível sem depender de uma palavra escrita. */}
        <div className="porta-ferrolho">
          <span className="porta-chevron porta-chevron-1" />
          <span className="porta-chevron porta-chevron-2" />
          <span className="porta-chevron porta-chevron-3" />
        </div>

        {/* A emenda. Ela ESCURECE, não acende: chapa clara no meio da tela é
            lida como fenda, e fenda foi o que o dono recusou. Ver o CSS. */}
        <div className="porta-aresta" />
      </div>

      <div className="porta-tranca">
        <TrancaCompleta />
      </div>
    </div>
  );
}

/**
 * O disco da tranca, INTEIRO.
 *
 * Desenhado igual nas duas folhas: cada uma mostra a metade que couber (ver o
 * cabeçalho). Por isso não há `clipPath` aqui e não há "metade esquerda" e
 * "metade direita" para divergirem entre si.
 */
function TrancaCompleta() {
  return (
    <svg viewBox={`0 0 ${D} ${D}`} className="porta-tranca-svg">
      <defs>
        <linearGradient id="ghDisco" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22303f" />
          <stop offset="0.55" stopColor="#131c26" />
          <stop offset="1" stopColor="#0a1016" />
        </linearGradient>
        <filter id="ghBrilho" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Encaixe: a sombra no metal em que o disco se assenta. Sem ela o disco
          parece colado por cima, não embutido. */}
      <circle cx={C} cy={C} r={R + 8} fill="#070b10" stroke="#1b2735" strokeWidth="3" />

      {/* O que GIRA. Tudo daqui para baixo está dentro do grupo animado. */}
      <g className="porta-disco">
        <g fill="#16202c" stroke="#33465c" strokeWidth="1.5">
          {DENTES.map((a) => (
            <rect key={a} x={C - 11} y={C - R - 9} width="22" height="24" rx="3"
                  transform={`rotate(${a} ${C} ${C})`} />
          ))}
        </g>

        <circle cx={C} cy={C} r={R} fill="url(#ghDisco)" stroke="#3d5169" strokeWidth="3" />
        <circle cx={C} cy={C} r={R - 18} fill="#0b1119" stroke="#2b3a4d" strokeWidth="2" />

        {/* Arco aceso: é ele que deixa o giro VISÍVEL. Um círculo perfeito
            girando é indistinguível de um círculo parado. */}
        <path
          className="porta-arco"
          d={`M${C} ${C - R + 10} A ${R - 10} ${R - 10} 0 0 1 ${C + R - 10} ${C}`}
          fill="none" stroke="#39ff14" strokeWidth="5" strokeLinecap="round"
          filter="url(#ghBrilho)"
        />

        <circle cx={C} cy={C} r="34" fill="#0d1620" stroke="#39ff14" strokeWidth="2" />
        {/* O raio da marca, no miolo. */}
        <path className="porta-raio" filter="url(#ghBrilho)" fill="#39ff14"
              d={`M${C + 6} ${C - 23} L${C - 13} ${C + 4} L${C - 1} ${C + 4} L${C - 6} ${C + 23} L${C + 13} ${C - 4} L${C + 1} ${C - 4} Z`} />
      </g>
    </svg>
  );
}
