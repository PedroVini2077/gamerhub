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
      {/* A linha de horizonte. Ela é o que faz a tela ler como "chão de
          fliperama" em vez de só um borrão colorido — e é estática, então não
          entra na conta de movimento. */}
      <span className="horizonte-da-arena" style={{ '--cor': acento }} />
    </div>
  );
}
