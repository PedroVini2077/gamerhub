/**
 * A camada que se mexe atrás do texto da página "Sobre".
 *
 * ── Por que NÃO tem física ──────────────────────────────────────────────────
 *
 * O pedido do dono foi "formas flutuando e batendo aleatoriamente, tipo um
 * ping-pong em tempo real". Colisão de verdade exige um laço de JavaScript a
 * cada quadro, e isso é exatamente o custo que derrubou o desempenho da cena
 * 3D (§0.3): 29.441 ms de thread principal em "Other", que era o laço de
 * animação rodando. Numa página de LEITURA o estrago seria pior — a pessoa
 * fica parada minutos, e o laço queima CPU o tempo todo, no celular dela.
 *
 * Aqui é tudo `transform` e `opacity`, que rodam no **compositor**, fora da
 * thread principal. O movimento é real e o custo é perto de zero.
 *
 * **O que se perde, e é honesto dizer:** as formas não colidem. O que substitui
 * a aleatoriedade é cada uma ter duração, atraso e trajetória próprias — os
 * ciclos nunca fecham juntos, então o conjunto não se repete de forma visível.
 * Parece aleatório sem custar um laço.
 *
 * ── As três regras que este enfeite obedece ─────────────────────────────────
 *
 * 1. `pointer-events-none` — enfeite nunca rouba clique do texto.
 * 2. `motion-reduce:hidden` — quem pediu menos movimento no sistema não vê
 *    nada disso. Não é acessibilidade decorativa: movimento de fundo dispara
 *    enjoo em quem tem sensibilidade vestibular.
 * 3. `aria-hidden` — leitor de tela não anuncia decoração.
 */

/** Contorno neon, sem preenchimento: pesa quase nada e casa com a identidade. */
const FORMAS = {
  triangulo: 'M12 3 L21.5 20.5 L2.5 20.5 Z',
  losango: 'M12 2 L21 12 L12 22 L3 12 Z',
  quadrado: 'M4.5 4.5 H19.5 V19.5 H4.5 Z',
  // Os quatro botões do controle, desenhados aqui como geometria simples e nas
  // cores do site — não são o logotipo de ninguém, são um X, um círculo, um
  // quadrado e um triângulo.
  xis: 'M5 5 L19 19 M19 5 L5 19',
  circulo: 'M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z',
  // Uma cruz cheia (não o X), para variar o ritmo visual.
  cruz: 'M10 3 H14 V10 H21 V14 H14 V21 H10 V14 H3 V10 H10 Z',
};

/**
 * Cada peça tem trajetória própria. Os números são espalhados de propósito:
 * durações que não são múltiplas entre si fazem os ciclos demorarem muito para
 * coincidir, e o atraso NEGATIVO faz a peça já entrar no meio do caminho — sem
 * ele, a tela começaria vazia e tudo apareceria junto.
 */
const PECAS = [
  { forma: 'triangulo', topo: '6%',  tamanho: 34, duracao: 21, atraso: -3,  cor: '#39ff14' },
  { forma: 'xis',       topo: '14%', tamanho: 26, duracao: 29, atraso: -17, cor: '#22d3ee' },
  { forma: 'circulo',   topo: '23%', tamanho: 22, duracao: 24, atraso: -9,  cor: '#a855f7' },
  { forma: 'quadrado',  topo: '31%', tamanho: 30, duracao: 33, atraso: -22, cor: '#39ff14' },
  { forma: 'losango',   topo: '39%', tamanho: 20, duracao: 19, atraso: -14, cor: '#39ff14' },
  { forma: 'cruz',      topo: '47%', tamanho: 25, duracao: 27, atraso: -6,  cor: '#a855f7' },
  { forma: 'triangulo', topo: '55%', tamanho: 19, duracao: 31, atraso: -25, cor: '#22d3ee' },
  { forma: 'circulo',   topo: '63%', tamanho: 33, duracao: 23, atraso: -11, cor: '#39ff14' },
  { forma: 'xis',       topo: '71%', tamanho: 21, duracao: 35, atraso: -30, cor: '#39ff14' },
  { forma: 'quadrado',  topo: '79%', tamanho: 24, duracao: 26, atraso: -19, cor: '#a855f7' },
  { forma: 'losango',   topo: '87%', tamanho: 28, duracao: 22, atraso: -4,  cor: '#22d3ee' },
  { forma: 'cruz',      topo: '94%', tamanho: 18, duracao: 30, atraso: -27, cor: '#39ff14' },
];

export default function FundoAnimado() {
  return (
    <div
      aria-hidden="true"
      className="camada-de-fundo fixed top-0 left-0 w-full overflow-hidden
                 pointer-events-none motion-reduce:hidden"
    >
      {PECAS.map((peca, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={peca.tamanho}
          height={peca.tamanho}
          className="absolute animate-travessia"
          style={{
            top: peca.topo,
            // `willChange` avisa o navegador para promover a camada ANTES do
            // primeiro quadro. Sem isso a primeira volta engasga enquanto ele
            // descobre sozinho que o elemento se move.
            willChange: 'transform, opacity',
            animationDuration: `${peca.duracao}s`,
            animationDelay: `${peca.atraso}s`,
            opacity: 0.14,
            filter: `drop-shadow(0 0 6px ${peca.cor})`,
          }}
        >
          <path
            d={FORMAS[peca.forma]}
            fill="none"
            stroke={peca.cor}
            strokeWidth="1.5"
          />
        </svg>
      ))}
    </div>
  );
}
