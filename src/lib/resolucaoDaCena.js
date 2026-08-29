/**
 * A resolução da cena 3D sobe se o aparelho aguentar, e não sobe se não.
 *
 * ── A medição que originou isto (29/08, navegador de verdade) ───────────────
 *
 * A landing foi medida com `PerformanceObserver` de `longtask` numa janela de
 * 8 s com o Hero na tela, no build de produção:
 *
 *     dpr 1,5 + antialias   88 quadros    88 long tasks   8.066 ms bloqueados
 *     dpr 1,0 sem antialias 133 quadros   132 long tasks  7.897 ms bloqueados
 *     dpr 0,75              182 quadros     9 long tasks     468 ms bloqueados
 *     dpr 0,5               243 quadros      0 long tasks       0 ms bloqueados
 *
 * A thread principal ficava **99% ocupada** enquanto a cena estava visível, e
 * cada quadro isolado era uma long task. Não é degrau: é um penhasco, porque
 * o custo é proporcional a PIXEL, e abaixo de ~50 ms por quadro o quadro
 * deixa de contar como long task — que é exatamente a conta do TBT.
 *
 * Isso também explica a contradição dos dois PageSpeed do dono: o do celular
 * marcou **TBT 0 ms** e o do desktop, 31 s de thread principal. Não é
 * inconsistência — a cena 3D não sobe abaixo de 1024px (`lib/cena3D.js`),
 * então o celular nunca pagou por ela.
 *
 * ── Por que ADAPTATIVO, e não simplesmente baixar o dpr ─────────────────────
 *
 * Porque a medição acima foi feita em rasterização por SOFTWARE (SwiftShader),
 * que é o que o Lighthouse e o PageSpeed usam — e o que também acontece em
 * máquina com GPU bloqueada. Numa máquina com GPU de verdade, cinco chamadas
 * de desenho não custam nada, e cravar 0,5 puniria justamente quem não tem
 * problema nenhum. Fixar um número seria trocar um erro por outro.
 *
 * ── Por que COMEÇA baixo e sobe, e não o contrário ──────────────────────────
 *
 * Começar em 1,5 e descer significa pagar a conta cheia durante a amostragem —
 * e a amostragem cai bem no meio do carregamento, que é a janela que o
 * Lighthouse observa e a que o visitante sente. Enfeite não taxa o caminho
 * crítico para depois pedir desculpas (`CLAUDE.md` §0.3, regra 2). Começando
 * embaixo, o pior caso é uma fração de segundo mais macia antes de firmar.
 *
 * ── Por que `delta`, e não o tempo de render ────────────────────────────────
 *
 * `delta` é o intervalo entre quadros. Com vsync ele fica preso em ~16,7 ms
 * enquanto a GPU der conta, e cresce assim que ela não der. É exatamente a
 * pergunta que importa — "estamos perdendo quadros?" — e não exige instrumentar
 * o renderer.
 */

// Degraus de resolução. 0,5 é o piso porque abaixo disso o serrilhado aparece
// mesmo numa cena difusa e brilhante; 1 é o teto porque acima dele o ganho
// visual é imperceptível numa cena sem texto nem textura fina — era o que o
// antigo `[1, 1.5]` pagava sem devolver nada.
const DEGRAUS = [0.5, 0.75, 1];

// Quantos quadros entram em cada veredito. 20 quadros são ~1/3 de segundo a
// 60 fps: rápido o bastante para o visitante não ver a subida, longo o
// bastante para um engasgo isolado (troca de aba, GC) não decidir nada.
export const QUADROS_POR_AMOSTRA = 20;

// Acima disto estamos perdendo quadros de propósito (60 fps = 16,7 ms).
const LENTO_MS = 24;
// Abaixo disto há folga de sobra para pagar mais pixel.
const RAPIDO_MS = 18;

/**
 * A decisão, isolada do React de propósito.
 *
 * Sobe um degrau quando sobra folga, desce quando falta — e **nunca volta a
 * subir depois de descer**. Sem esse teto, uma máquina no limiar oscila entre
 * dois degraus para sempre, e resolução piscando é pior de olhar do que
 * resolução baixa e estável. O primeiro rebaixamento é o veredito daquele
 * aparelho.
 *
 * Está separada porque a metade que importa não dá para provar num navegador
 * sem GPU: aqui a cena só **desce**. Que ela também **sobe** numa máquina
 * capaz é afirmação sobre código que nenhuma medição deste ambiente alcança —
 * então vira teste de unidade, e não suposição (§1.1).
 *
 * @returns {{degrau: number, teto: number}} o estado novo
 */
export function proximoDegrau({ degrau, teto, mediana }) {
  if (mediana > LENTO_MS && degrau > 0) {
    return { degrau: degrau - 1, teto: degrau - 1 };
  }
  if (mediana < RAPIDO_MS && degrau < teto) {
    return { degrau: degrau + 1, teto };
  }
  return { degrau, teto };
}

export const DEGRAUS_DE_RESOLUCAO = DEGRAUS;
