/**
 * O fundo do SITE LOGADO — e ele não é o da landing.
 *
 * ── O pedido, e o que eu tinha entendido errado ─────────────────────────────
 *
 * Em 02/09 o dono disse *"pode fazer o mesmo fundo pra todas as rotas"*, e eu
 * li isso como "o mesmo da landing também no site logado". Em 03/09 ele
 * corrigiu: *"eu quero que o fundo do site logado seja diferente do resto…
 * não quero o fluxo de dados no site logado"*.
 *
 * O "mesmo para todas as rotas" era **entre as abas do site logado** — feed,
 * mural, lives, keys, ranks. Não entre o site e a landing.
 *
 * ── Por que LUZ, e não outro enxame de partículas ───────────────────────────
 *
 * Porque as peças de videogame (`PecasFlutuantes`) já são a camada que se move.
 * Um segundo elemento em movimento disputaria atenção com o primeiro e com o
 * conteúdo — e o site logado é onde se lê e se rola, não onde se contempla.
 *
 * Então os papéis ficam separados: **esta camada é atmosfera** (luz que
 * respira, quase parada) e **as peças são o movimento**. A landing continua
 * com o fluxo de dados, que é a assinatura dela.
 *
 * ── O custo, e por que ele é o mesmo de zero ────────────────────────────────
 *
 * Dois `radial-gradient` num elemento cada, animados só por `transform` e
 * `opacity` — o navegador roda isso no compositor, fora da thread principal.
 * Nenhum laço de JavaScript por quadro, que foi o que custou 29.441 ms de
 * thread na cena 3D (§0.3).
 *
 * Ciclos longos e propositalmente **primos entre si** (37 s e 53 s): assim as
 * duas luzes nunca voltam à mesma posição relativa, e o olho não encontra a
 * repetição.
 *
 * ── As três regras que enfeite obedece neste projeto ────────────────────────
 *
 * 1. `pointer-events-none` — nunca rouba clique;
 * 2. `motion-reduce:hidden` — movimento de fundo dispara enjoo em quem tem
 *    sensibilidade vestibular;
 * 3. `aria-hidden` — leitor de tela não anuncia decoração.
 */
/**
 * Onde cada estouro acontece, e quando.
 *
 * Posições fixas pelo mesmo motivo das peças: `Math.random()` no render faria
 * o estouro trocar de lugar a cada atualização de estado.
 *
 * As durações são **primas entre si** (17, 23, 29 s) e os atrasos são
 * diferentes: assim dois estouros nunca caem juntos por acidente de sincronia,
 * e o conjunto não fecha ciclo de forma perceptível.
 *
 * Cada keyframe estoura em 12% do tempo e fica invisível no resto — é a espera
 * que entrega o *"não precisa ser algo muito exagerado"* do pedido.
 */
const ESTOUROS = [
  { x: '18%', y: '28%', tamanho: 180, duracao: 17, atraso: -3,  cor: '#39ff14' },
  { x: '72%', y: '62%', tamanho: 240, duracao: 23, atraso: -11, cor: '#bf00ff' },
  { x: '46%', y: '15%', tamanho: 150, duracao: 29, atraso: -19, cor: '#00ffff' },
  { x: '86%', y: '34%', tamanho: 200, duracao: 19, atraso: -7,  cor: '#39ff14' },
  { x: '28%', y: '78%', tamanho: 170, duracao: 27, atraso: -22, cor: '#00ffff' },
];

export default function LuzesDaArena({ acento }) {
  if (!acento) return null;

  return (
    <div
      aria-hidden="true"
      className="camada-de-fundo fixed top-0 left-0 w-full z-0 overflow-hidden
                 pointer-events-none motion-reduce:hidden"
    >
      {/* A luz alta, à esquerda: o "refletor" da arena. */}
      <span
        className="luz-da-arena luz-da-arena--alta"
        style={{ '--cor': acento }}
      />
      {/* A baixa, à direita e em ciclo diferente, para as duas nunca
          coincidirem. */}
      <span
        className="luz-da-arena luz-da-arena--baixa"
        style={{ '--cor': acento }}
      />
      {/* `[03/09]` As mini explosões, com as CORES DO SITE e não a da seção.
          O dono pediu *"mini explosões com as cores do site enquanto os objetos
          sobem… como se tivesse algo explodindo ao fundo"*.

          Se elas herdassem o acento da aba sumiriam dentro da própria cor —
          todo o resto do fundo já é monocromático. É o contraste com o verde /
          roxo / ciano da marca que faz o estouro LER como estouro. */}
      {ESTOUROS.map((e, i) => (
        <span
          key={i}
          className="explosao-de-fundo"
          style={{
            left: e.x,
            top: e.y,
            width: e.tamanho,
            height: e.tamanho,
            animationDuration: `${e.duracao}s`,
            animationDelay: `${e.atraso}s`,
            '--cor': e.cor,
          }}
        />
      ))}
    </div>
  );
}
