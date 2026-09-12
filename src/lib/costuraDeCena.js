/**
 * A COSTURA — como uma cena invade a anterior em vez de começar depois dela.
 *
 * ── Por que virou arquivo `[12/09]` ─────────────────────────────────────────
 *
 * No bloco A ela nasceu dentro do `CenaDaLanding`, aplicada a uma emenda só.
 * No bloco B ela passa a valer em **todas** — e três componentes precisam dela:
 * a cena que atravessa, a que prende e o fecho. Copiada três vezes, a
 * profundidade da máscara divergiria entre elas no primeiro ajuste, e o
 * sintoma seria uma emenda visível no meio de cinco invisíveis (§4).
 *
 * ── As duas metades, e nenhuma funciona sozinha ─────────────────────────────
 *
 * | | o que faz | sozinha |
 * | --- | --- | --- |
 * | **margem negativa** | a cena sobe por cima do fim da anterior | a borda dura aparece por cima: fica **pior** que o corte |
 * | **máscara no topo** | apaga a borda de cima da cena que chega | dissolve para o vazio, e o corte continua onde estava |
 *
 * Máscara e não véu: um gradiente sobreposto **escureceria** o que está
 * embaixo. A máscara apaga a arte NOVA na faixa de emenda e deixa a anterior
 * intacta — é dissolução, não sombra.
 *
 * E ela é **estática**: não anima, não é recalculada por quadro. O custo é uma
 * camada de composição, uma vez.
 */

/** A sobreposição no layout. `z-10` porque a cena de cima vem antes no fluxo. */
export const CLASSE_DA_COSTURA = '-mt-[9vh] md:-mt-[12vh] z-10';

/**
 * A máscara. O prefixo `-webkit-` não é opcional: sem ele o Safari mostra a
 * borda dura, e quem confere no Chrome não vê defeito nenhum.
 */
export function estiloDaCostura() {
  const mascara = 'linear-gradient(to bottom, transparent 0, #000 14vh)';
  return { maskImage: mascara, WebkitMaskImage: mascara };
}

/**
 * ── A INVASÃO: como a arte que chega se comporta na emenda ──────────────────
 *
 * A costura resolve a **emenda**; ela não resolve a monotonia. Se as seis cenas
 * apenas dissolvessem por cima da anterior, a página teria trocado seis cortes
 * iguais por seis dissoluções iguais — e a ordem do dono continua valendo:
 * *"não faça todas as transições iguais"*.
 *
 * Então cada emenda tem um GESTO próprio, aplicado à arte que entra enquanto
 * ela atravessa a tela. Todos são `transform`, todos compostos pelo navegador.
 *
 * A escolha de cada um é a regra 14 dele — o movimento representa o que a cena
 * é, e a passagem entre duas cenas representa a relação entre elas:
 *
 * | de → para | gesto | por quê |
 * | --- | --- | --- |
 * | destaques → **feed** | `sobe` | o feed chega de baixo, como conteúdo novo chega num feed |
 * | feed → **comunidade** | `afasta` | a câmera recua e o que era uma lista vira um grupo |
 * | comunidade → **lives** | `mergulha` | do grupo para uma transmissão: a câmera desce e entra |
 * | lives → **keys** | `deriva` | o olhar sai do centro e encontra outra coisa ao lado |
 * | keys → **ranks** | `sobe` | a informação vira progresso, e progresso sobe |
 * | ranks → **cta** | `afasta` | o fecho abre o plano e mostra as pessoas |
 *
 * Dois gestos repetem em emendas DISTANTES uma da outra, de propósito: seis
 * gestos diferentes seria um catálogo, e catálogo é o que ele pediu para
 * evitar. O que não pode é duas emendas **seguidas** com o mesmo gesto — e
 * disso tem trava.
 *
 * ── Todos terminam em escala 1, e isso NÃO é estética ───────────────────────
 *
 * Duas armadilhas apareceram ao desenhar os gestos, e as duas abrem buraco na
 * borda da cena:
 *
 * - **escala final menor que 1** deixaria uma moldura de fundo em volta da arte
 *   para sempre;
 * - **deslocar sem folga** mostra o vazio do lado de onde a arte saiu.
 *
 * Por isso cada gesto que desloca **começa ampliado** — a ampliação é a folga
 * que cobre o deslocamento — e todos chegam a 1, que é a arte no tamanho em que
 * ela foi composta. Terminar ampliado seria recortar a composição do dono para
 * sempre por causa de um movimento de dois segundos.
 */
export const INVASOES = {
  // `scale` inicial ≥ o deslocamento em cada gesto: 1,12 dá 6% de folga por
  // lado, que cobre os 5% de `y`. É a conta que impede o buraco na borda.
  sobe: { de: { y: '5%', scale: 1.12 }, para: { y: '0%', scale: 1 } },
  afasta: { de: { scale: 1.18 }, para: { scale: 1 } },
  mergulha: { de: { y: '-4%', scale: 1.1 }, para: { y: '0%', scale: 1 } },
  deriva: { de: { x: '-4%', scale: 1.12 }, para: { x: '0%', scale: 1 } },
};

/**
 * A janela em que o gesto acontece, no progresso da cena na tela: do momento em
 * que ela começa a entrar por baixo até estar comodamente enquadrada.
 *
 * Não vai até 1 de propósito — depois de assentar, a arte fica **parada**. Uma
 * imagem que nunca para de se mexer é o parallax exagerado que ele proibiu, e
 * cansa antes de impressionar.
 */
export const JANELA_DA_INVASAO = [0, 0.42];
