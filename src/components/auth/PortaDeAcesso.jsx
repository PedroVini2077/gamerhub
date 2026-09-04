/**
 * A PORTA de acesso, desenhada à mão em SVG.
 *
 * ── Por que SVG e não a ilustração ──────────────────────────────────────────
 *
 * O dono mandou um render 3D como REFERÊNCIA e foi explícito: *"eu mandei pra
 * você usar como exemplo e criar à mão"*. Antes disso eu tinha recortado a
 * própria ilustração em quatro pedaços — e ele cortou, com razão.
 *
 * Três motivos pelos quais desenhar é melhor aqui, e nenhum é preferência:
 *
 * | | imagem recortada | este SVG |
 * | --- | --- | --- |
 * | tela estreita | 1175x575 fixos viram uma tirinha no celular | escala em qualquer proporção |
 * | peças que se mexem | só dá para girar o disco inteiro | ferrolho recua, chevron acende em sequência, dente gira |
 * | peso | 83 KB | alguns kB de marcação |
 *
 * ── O que este desenho NÃO é, e vale estar escrito ──────────────────────────
 *
 * A referência é um render com material metálico, reflexo e sujeira. Isto aqui
 * é **sci-fi vetorial**: chapado, de linha e brilho nítidos, mais perto de uma
 * interface de jogo do que de uma foto. É outra estética — foi a troca aceita
 * para ter as três colunas da tabela acima.
 *
 * ── A geometria é toda ESPELHADA ────────────────────────────────────────────
 *
 * A folha esquerda e o pilar esquerdo são desenhados uma vez, em `<defs>`, e a
 * direita é a mesma coisa com `scale(-1,1)` em torno de x=600. Isso corta o
 * desenho pela metade e garante simetria exata — dois desenhos parecidos à mão
 * divergem, e a divergência aparece bem na emenda, que é onde o olho está.
 *
 * **Texto não entra no espelho** (sairia invertido), então os rótulos dos
 * painéis laterais são desenhados por fora, um de cada lado.
 *
 * ── Coordenadas ────────────────────────────────────────────────────────────
 *
 *     viewBox ..... 0 0 1200 620
 *     pilares ..... 0..96 e 1104..1200
 *     folhas ...... 96..600 e 600..1104
 *     tranca ...... centro (600, 318), raio 78
 *
 * Quem for mexer: o centro em x=600 é o eixo do espelho E a emenda das folhas.
 * Mudar um sem o outro parte a porta no lugar errado.
 */

/** O eixo do espelho e a emenda das folhas. */
const EIXO = 600;
/** Centro e raio da tranca, em unidades do viewBox. */
const TRANCA = { x: EIXO, y: 318, r: 78 };

/** Os dentes do disco: oito trapézios em volta, um a cada 45°. */
const DENTES = Array.from({ length: 8 }, (_, i) => i * 45);

export default function PortaDeAcesso() {
  return (
    <svg
      className="porta-svg"
      viewBox="0 0 1200 620"
      role="img"
      aria-label="Porta de acesso do GamerHub"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* ── Materiais ────────────────────────────────────────────────────
            Três degraus de escuro fazem o volume: chapa, painel afundado e
            vinco. Sem eles a porta vira um retângulo preto. */}
        <linearGradient id="ghChapa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2430" />
          <stop offset="0.5" stopColor="#111823" />
          <stop offset="1" stopColor="#0a0f16" />
        </linearGradient>
        <linearGradient id="ghPainel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#141c27" />
          <stop offset="1" stopColor="#0b1119" />
        </linearGradient>
        <linearGradient id="ghPilar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0a0f16" />
          <stop offset="0.45" stopColor="#1c2634" />
          <stop offset="1" stopColor="#0c121a" />
        </linearGradient>

        {/* O brilho dos neons. `stdDeviation` pequeno: borrão grande engorda a
            linha e come o desenho. */}
        <filter id="ghBrilho" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ── A FOLHA (metade esquerda), desenhada uma vez ────────────────── */}
        <g id="ghFolha">
          {/* Chapa externa, com canto chanfrado em cima e embaixo — canto reto
              lê como caixa; chanfro lê como blindagem. */}
          <path
            d="M124 74 L596 74 L596 562 L124 562 L100 534 L100 102 Z"
            fill="url(#ghChapa)" stroke="#2b3a4d" strokeWidth="2"
          />

          {/* Painel de cima e painel de baixo, afundados. */}
          <path
            d="M146 106 L578 106 L578 246 L548 278 L146 278 Z"
            fill="url(#ghPainel)" stroke="#243141" strokeWidth="1.5"
          />
          <path
            d="M146 358 L548 358 L578 390 L578 530 L146 530 Z"
            fill="url(#ghPainel)" stroke="#243141" strokeWidth="1.5"
          />

          {/* Vincos diagonais: é o que dá a leitura de placa blindada. */}
          <g stroke="#1e2a38" strokeWidth="2" fill="none">
            <path d="M170 250 L232 188 L360 188" />
            <path d="M170 414 L232 476 L360 476" />
            <path d="M420 130 L500 130 L556 186" />
            <path d="M420 506 L500 506 L556 450" />
          </g>

          {/* Neon: verde na diagonal principal, ciano e roxo de apoio. Eles são
              o que amarra a porta à paleta do site. */}
          <g fill="none" strokeWidth="3" strokeLinecap="round" filter="url(#ghBrilho)">
            <path d="M182 262 L252 192 L372 192" stroke="#39ff14" opacity="0.9" />
            <path d="M182 402 L252 472 L372 472" stroke="#39ff14" opacity="0.9" />
            <path d="M408 142 L496 142 L544 190" stroke="#00ffff" opacity="0.75" />
            <path d="M408 522 L496 522 L544 474" stroke="#bf00ff" opacity="0.7" />
            <path d="M164 150 L164 226" stroke="#00ffff" opacity="0.55" />
            <path d="M164 438 L164 514" stroke="#bf00ff" opacity="0.5" />
          </g>

          {/* Parafusos. Quatro, nos cantos do painel — mais que isso vira
              textura e some. */}
          <g fill="#0d141d" stroke="#2f3f52" strokeWidth="1.5">
            <circle cx="164" cy="126" r="6" />
            <circle cx="164" cy="510" r="6" />
            <circle cx="558" cy="126" r="6" />
            <circle cx="558" cy="510" r="6" />
          </g>
        </g>

        {/* ── O PILAR (esquerdo), com o painel de leitura ─────────────────── */}
        <g id="ghPilarEsq">
          <path
            d="M8 20 L88 20 L88 44 L96 52 L96 556 L88 564 L88 588 L8 588 Z"
            fill="url(#ghPilar)" stroke="#2b3a4d" strokeWidth="2"
          />
          {/* Tira de neon vertical: a luz de "energia ligada". */}
          <rect x="20" y="60" width="5" height="180" rx="2.5" fill="#39ff14"
                opacity="0.8" filter="url(#ghBrilho)" />
          <rect x="20" y="372" width="5" height="180" rx="2.5" fill="#00ffff"
                opacity="0.55" filter="url(#ghBrilho)" />
          {/* A telinha do painel. */}
          <rect x="18" y="256" width="60" height="96" rx="6"
                fill="#070c12" stroke="#2f3f52" strokeWidth="1.5" />
        </g>
      </defs>

      {/* ── Fundo do vão: o que aparece quando a porta abre ───────────────── */}
      <rect x="96" y="64" width="1008" height="500" fill="#04070a" />

      {/* ── As duas folhas ───────────────────────────────────────────────────
          Cada uma leva a sua metade da tranca DENTRO dela: na abertura, a
          metade viaja junto sem conta nenhuma. */}
      <g className="porta-folha porta-folha-esq">
        <use href="#ghFolha" />
        <g className="porta-tranca-metade">
          <MetadeDaTranca lado="esq" />
        </g>
        <BarraDeTranca />
      </g>

      <g className="porta-folha porta-folha-dir">
        {/* `scale(-1,1)` em torno do eixo: a folha direita é a esquerda
            espelhada, então as duas são exatamente simétricas. */}
        <g transform={`translate(${EIXO * 2},0) scale(-1,1)`}>
          <use href="#ghFolha" />
          <BarraDeTranca />
        </g>
        <g className="porta-tranca-metade">
          <MetadeDaTranca lado="dir" />
        </g>
      </g>

      {/* ── Moldura: pilares e base, POR CIMA das folhas ─────────────────────
          Por cima de propósito: a folha desliza para trás do pilar, como numa
          porta de verdade, em vez de passar na frente dele. */}
      <use href="#ghPilarEsq" />
      <g transform={`translate(${EIXO * 2},0) scale(-1,1)`}>
        <use href="#ghPilarEsq" />
      </g>

      {/* Base */}
      <path d="M0 564 L1200 564 L1200 612 L1160 612 L1160 588 L40 588 L40 612 L0 612 Z"
            fill="url(#ghPilar)" stroke="#2b3a4d" strokeWidth="2" />
      <g stroke="#1b2634" strokeWidth="3">
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} d={`M${300 + i * 28} 570 L${300 + i * 28} 582`} />
        ))}
      </g>

      {/* ── Placa de topo ────────────────────────────────────────────────── */}
      <path d="M400 0 L800 0 L800 44 L776 68 L424 68 L400 44 Z"
            fill="url(#ghChapa)" stroke="#2b3a4d" strokeWidth="2" />
      <text x={EIXO} y="30" className="porta-marca" textAnchor="middle">
        GAMER<tspan className="porta-marca-hub">HUB</tspan>
      </text>
      <text x={EIXO} y="54" className="porta-restrito" textAnchor="middle">
        ACESSO RESTRITO
      </text>

      {/* Rótulos dos painéis laterais — fora do espelho, senão sairiam ao
          contrário. */}
      <text x="48" y="248" className="porta-rotulo" textAnchor="middle">ACESSO</text>
      <text x="48" y="376" className="porta-rotulo porta-rotulo-estado" textAnchor="middle">
        LIBERADO
      </text>
      <text x="1152" y="248" className="porta-rotulo" textAnchor="middle">IDENTIFIQUE-SE</text>
      <text x="1152" y="376" className="porta-rotulo porta-rotulo-estado" textAnchor="middle">OK</text>
    </svg>
  );
}

/**
 * A barra de ferrolho, com os chevrons apontando para o centro.
 *
 * Ela RECUA quando a porta destranca — é a peça que torna "destrancou" visível
 * sem depender do texto.
 */
function BarraDeTranca() {
  return (
    <g className="porta-ferrolho">
      <rect x="176" y="296" width="330" height="44" rx="6"
            fill="url(#ghChapa)" stroke="#2f3f52" strokeWidth="2" />
      <rect x="176" y="312" width="330" height="12" fill="#0a1119" />
      <g fill="#39ff14" filter="url(#ghBrilho)">
        {[236, 286, 336].map((x, i) => (
          <path key={x} className={`porta-chevron porta-chevron-${i + 1}`}
                d={`M${x} 302 L${x + 22} 318 L${x} 334 L${x + 9} 318 Z`} />
        ))}
      </g>
    </g>
  );
}

/**
 * Metade do disco da tranca.
 *
 * As duas metades giram em torno do MESMO ponto — a esquerda pela borda
 * direita, a direita pela esquerda — então girar as duas é girar o disco.
 * O recorte é feito por `clipPath`: um retângulo de meia largura.
 */
function MetadeDaTranca({ lado }) {
  const id = `ghMeia-${lado}`;
  const x = lado === 'esq' ? TRANCA.x - TRANCA.r - 8 : TRANCA.x;
  return (
    <>
      <clipPath id={id}>
        <rect x={x} y={TRANCA.y - TRANCA.r - 8} width={TRANCA.r + 8} height={(TRANCA.r + 8) * 2} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        {/* Dentes */}
        <g fill="#16202c" stroke="#33465c" strokeWidth="1.5">
          {DENTES.map((a) => (
            <rect key={a} x={TRANCA.x - 9} y={TRANCA.y - TRANCA.r - 7} width="18" height="20" rx="3"
                  transform={`rotate(${a} ${TRANCA.x} ${TRANCA.y})`} />
          ))}
        </g>
        <circle cx={TRANCA.x} cy={TRANCA.y} r={TRANCA.r - 4} fill="url(#ghChapa)"
                stroke="#3a4c63" strokeWidth="2.5" />
        <circle cx={TRANCA.x} cy={TRANCA.y} r={TRANCA.r - 20} fill="#0b1119"
                stroke="#2b3a4d" strokeWidth="2" />
        {/* Arco aceso: é ele que deixa o giro visível. Sem um ponto de
            referência, um círculo girando parece parado. */}
        <path
          className="porta-arco"
          d={`M${TRANCA.x} ${TRANCA.y - TRANCA.r + 12} A ${TRANCA.r - 12} ${TRANCA.r - 12} 0 0 1 ${TRANCA.x + TRANCA.r - 12} ${TRANCA.y}`}
          fill="none" stroke="#39ff14" strokeWidth="5" strokeLinecap="round"
          filter="url(#ghBrilho)"
        />
        <circle cx={TRANCA.x} cy={TRANCA.y} r="30" fill="#0d1620"
                stroke="#39ff14" strokeWidth="2" opacity="0.9" />
        {/* O raio da marca, no miolo. */}
        <path className="porta-raio"
              d={`M${TRANCA.x + 5} ${TRANCA.y - 20} L${TRANCA.x - 11} ${TRANCA.y + 3} L${TRANCA.x - 1} ${TRANCA.y + 3} L${TRANCA.x - 5} ${TRANCA.y + 20} L${TRANCA.x + 11} ${TRANCA.y - 3} L${TRANCA.x + 1} ${TRANCA.y - 3} Z`}
              fill="#39ff14" filter="url(#ghBrilho)" />
      </g>
    </>
  );
}
