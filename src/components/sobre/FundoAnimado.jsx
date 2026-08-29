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
  triangulo: 'M12 2 L22 21 L2 21 Z',
  losango: 'M12 2 L21 12 L12 22 L3 12 Z',
  quadrado: 'M4 4 H20 V20 H4 Z',
};

/**
 * Cada peça tem trajetória própria. Os números são espalhados de propósito:
 * durações que não são múltiplas entre si fazem os ciclos demorarem muito para
 * coincidir, e o atraso NEGATIVO faz a peça já entrar no meio do caminho — sem
 * ele, a tela começaria vazia e tudo apareceria junto.
 */
const PECAS = [
  { forma: 'triangulo', topo: '12%', tamanho: 38, duracao: 34, atraso: -2,  cor: '#39ff14' },
  { forma: 'losango',   topo: '28%', tamanho: 26, duracao: 47, atraso: -19, cor: '#a855f7' },
  { forma: 'quadrado',  topo: '44%', tamanho: 30, duracao: 39, atraso: -31, cor: '#39ff14' },
  { forma: 'triangulo', topo: '61%', tamanho: 22, duracao: 53, atraso: -8,  cor: '#22d3ee' },
  { forma: 'losango',   topo: '74%', tamanho: 44, duracao: 41, atraso: -25, cor: '#39ff14' },
  { forma: 'quadrado',  topo: '88%', tamanho: 20, duracao: 58, atraso: -44, cor: '#a855f7' },
];

export default function FundoAnimado() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 overflow-hidden pointer-events-none
                 motion-reduce:hidden"
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
