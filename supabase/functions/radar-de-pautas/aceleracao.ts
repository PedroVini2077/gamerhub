// O SINAL DE ACELERAÇÃO — "isto está crescendo?", medido no nosso histórico.
//
// ============================================================================
// `[01/10]` FASE 3, e ela trocou de fonte antes de existir
// ============================================================================
//
// O plano previa `TimelineVol` do GDELT e Google Trends. **Os dois morreram
// no mesmo dia, e por motivos diferentes:**
//
//   GDELT   desligada — sete tentativas, dois IPs, zero sucessos. O teto dela
//           é por IP, e saímos de IP compartilhado por construção.
//   Trends  rejeitado na auditoria por trazer loteria e futebol. O dono viu e
//           reclamou: *"não tem nenhuma cara de GamerHub"*.
//
// Dizer "a Fase 3 não dá" seria verdade e inútil. O valor dela é **um sinal
// anexado ao evento**, e `news_items_raw` já tinha com que produzi-lo — 772
// itens em 5 dias, de 17 fontes. Medido antes de escrever uma linha:
//
//     Gears of War / E-Day    25/09: 1    28/09: 2    01/10: 16
//
// ============================================================================
// O QUE ESTE SINAL NÃO É — e a diferença muda o que ele significa
// ============================================================================
//
// **Não é Trends.** Trends mede o MUNDO PROCURANDO. Isto mede OS VEÍCULOS QUE
// NÓS ESCOLHEMOS PUBLICANDO. É mais estreito e mais honesto: "a imprensa de
// games está falando mais disso hoje do que ontem" — não "o Brasil está
// buscando isso".
//
// A diferença importa para quem lê a tela, e é por isso que o rótulo diz
// "veículos", nunca "buscas" nem "interesse".
//
// **E ele não sabe o que é novidade de verdade.** Assunto que nasceu hoje não
// tem com que comparar: o sinal diz `novo`, que é a verdade disponível. Com 5
// dias de base, "novo" ainda inclui "existia antes de 25/09 e nós não
// estávamos olhando".

export type Aceleracao = { termo: string; hoje: number; antes: number; desde: string | null };

/** Quantos dias para trás a comparação olha. O banco corta em 30 de qualquer forma. */
export const JANELA_DE_DIAS = 7;

/**
 * O rótulo que vai para a tela. **Lista fechada, e nenhum número solto.**
 *
 * O plano dizia *"sem score mágico — se houver ordenação, ela é explicável por
 * sinal"*. Um "87 de relevância" não se explica; `3× ontem` se explica, porque
 * quem lê consegue refazer a conta.
 */
export function rotuloDaAceleracao(a: Aceleracao | undefined): string {
  if (!a || a.hoje === 0) return "";
  // Sem passado: pode ser assunto novo OU assunto que existia antes de a
  // coleta começar. A palavra "novo" é honesta para os dois casos.
  if (a.antes === 0) return a.hoje >= 3 ? "novo e forte" : "novo";

  const vezes = a.hoje / a.antes;
  if (vezes >= 3) return `${Math.round(vezes)}x o normal`;
  if (vezes >= 1.5) return "crescendo";
  // Mencionado hoje e mais ainda antes: o assunto esta ESFRIANDO. Dizer isso
  // vale tanto quanto dizer que esta subindo — pauta velha disfarcada de
  // novidade e o erro que um radar de atualidade nao pode cometer.
  return vezes < 0.6 ? "esfriando" : "";
}

/**
 * Pergunta ao banco quantas vezes cada termo apareceu hoje × antes.
 *
 * **Uma chamada só, com os termos de TODAS as pautas.** Oito pautas × três
 * termos é uma consulta, não vinte e quatro — e a RPC já corta em 20 termos.
 *
 * Falha aqui **não derruba o radar**: o sinal é enfeite informativo, e perder
 * enfeite não pode custar as pautas. Mesma regra do coletor que cai.
 */
export async function medirAceleracao(
  termos: string[],
  // `PromiseLike` e nao `Promise`: o `PostgrestFilterBuilder` do supabase-js e
  // "thenable" mas nao e um Promise — exigir Promise aqui reprova o chamador
  // real, e foi o que o `deno check` apontou.
  chamar: (termos: string[], dias: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Map<string, Aceleracao>> {
  const mapa = new Map<string, Aceleracao>();
  const unicos = [...new Set(termos.map((t) => t.trim()).filter((t) => t.length >= 3))];
  if (!unicos.length) return mapa;

  try {
    const { data, error } = await chamar(unicos, JANELA_DE_DIAS);
    if (error || !Array.isArray(data)) return mapa;
    for (const linha of data as Aceleracao[]) {
      if (linha && typeof linha.termo === "string") mapa.set(linha.termo, linha);
    }
  } catch { /* enfeite nao derruba pauta */ }

  return mapa;
}

/** O rótulo de uma pauta: o sinal MAIS FORTE entre os termos dela. */
export function sinalDaPauta(termos: string[], medidas: Map<string, Aceleracao>): string {
  // O mais forte, e nao a media: um assunto cujo nome proprio explodiu e o
  // generico nao e um assunto que explodiu. Media diluiria justamente o
  // termo que carrega o sinal.
  const ordem = ["novo e forte", "crescendo", "novo", "esfriando"];
  let melhor = "";
  let melhorPeso = -1;

  for (const t of termos) {
    const r = rotuloDaAceleracao(medidas.get(t.trim()));
    if (!r) continue;
    // "Nx o normal" ganha de tudo, e o maior N ganha entre eles.
    const n = r.match(/^(\d+)x/);
    const peso = n ? 100 + Number(n[1]) : ordem.length - ordem.indexOf(r);
    if (peso > melhorPeso) { melhorPeso = peso; melhor = r; }
  }
  return melhor;
}
