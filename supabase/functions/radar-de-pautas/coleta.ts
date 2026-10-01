// A COLETA — dois coletores, dois ritmos, uma lista só.
//
// `[01/10]` Saiu do `index.ts` quando a GDELT entrou (Fase 1). Não foi só o
// limite de 300 linhas do §4: a coleta é a parte que dá para testar sem rede,
// e enquanto ela vivia dentro do `Deno.serve` nenhum teste a alcançava.
//
// ── Os dois ritmos, e por que não dá para unificar ────────────────────────
//
//     RSS   13 fontes, EM PARALELO     ~1 volta de rede, cada site aguenta
//     API    2 consultas, EM SÉRIE     a GDELT exige 5,2 s entre elas
//
// Tentar um laço só com um ritmo só quebraria um dos dois: paralelizar a
// GDELT garante `429` em tudo menos na primeira, e serializar o RSS faria o
// editor esperar 13 voltas de rede.
//
// ── A regra que vale para os dois, e é o critério 6 da Fase 1 ─────────────
//
// **Coletor que falha não derruba o outro.** Feed fora do ar é o caso NORMAL
// quando se depende de 13 sites de terceiros, e a GDELT recusando por cota é
// o caso esperado dela. Os dois viram linha em `comFalha` e a coleta segue.

import { lerFeed, type ItemBruto } from "./rss.ts";
import { coletarDasApis, TIMEOUT_DA_CONSULTA_MS, type Falha } from "./gdelt.ts";

export const TETO_POR_FEED = 15;
export const TIMEOUT_DO_FEED = 10_000;

export type Fonte = { id: string; nome: string; url: string; tipo: string };
export type ItemColetado = ItemBruto & { fonte_id: string; fonte_nome: string };

/**
 * O `fetch` de verdade. O TIMEOUT depende de quem está do outro lado.
 *
 * `[01/10]` Um só não serve: site de RSS responde em 1–3 s e a GDELT levou
 * **12 s só para devolver um `429`** (medido duas vezes). Com o teto do RSS
 * ela estourava sempre — e foi o que o primeiro clique real mostrou.
 *
 * Esticar o teto do RSS junto seria pior: feed morto passaria a prender o
 * editor por 20 s em vez de 10, e são treze deles.
 */
export async function buscarTexto(url: string, tetoMs = TIMEOUT_DO_FEED) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(tetoMs),
    headers: { "User-Agent": "GamerHubNews/1.0 (+https://gamerhub.com.br)" },
  });
  return { ok: r.ok, status: r.status, texto: await r.text() };
}

export const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Lê os feeds RSS em paralelo. Um que falha não cala os outros doze. */
async function coletarDosFeeds(
  fontes: Fonte[],
  buscar: (url: string) => Promise<{ ok: boolean; status: number; texto: string }>,
): Promise<{ itens: ItemColetado[]; comFalha: Falha[] }> {
  const itens: ItemColetado[] = [];
  const comFalha: Falha[] = [];

  await Promise.all(fontes.map(async (f) => {
    try {
      const r = await buscar(f.url);
      if (!r.ok) { comFalha.push({ nome: f.nome, motivo: `HTTP ${r.status}` }); return; }
      const lidos = lerFeed(r.texto, TETO_POR_FEED);
      if (!lidos.length) { comFalha.push({ nome: f.nome, motivo: "feed sem itens" }); return; }
      for (const i of lidos) itens.push({ ...i, fonte_id: f.id, fonte_nome: f.nome });
    } catch (e) {
      comFalha.push({ nome: f.nome, motivo: e instanceof Error ? e.message : String(e) });
    }
  }));

  return { itens, comFalha };
}

/**
 * Coleta de todas as fontes ativas, qualquer que seja o tipo.
 *
 * O despacho é por `tipo`, e tipo desconhecido **grita** em vez de cair num
 * `else`: fonte cadastrada com tipo que ninguém lê seria a "cobertura que não
 * cobre" — ela apareceria na lista do painel como ativa e nunca traria nada,
 * sem erro nenhum (§1.5, e o fallback silencioso do §4).
 */
export async function coletarTudo(
  fontes: Fonte[],
  buscar: (url: string, tetoMs?: number) => Promise<{ ok: boolean; status: number; texto: string }> = buscarTexto,
  esperar = dormir,
): Promise<{ itens: ItemColetado[]; comFalha: Falha[] }> {
  const feeds = fontes.filter((f) => f.tipo === "rss");
  const apis  = fontes.filter((f) => f.tipo === "api");
  const outras = fontes.filter((f) => f.tipo !== "rss" && f.tipo !== "api");

  const [doRss, daApi] = await Promise.all([
    coletarDosFeeds(feeds, buscar),
    coletarDasApis(apis, (u) => buscar(u, TIMEOUT_DA_CONSULTA_MS), esperar),
  ]);

  const comFalha = [...doRss.comFalha, ...daApi.comFalha];
  for (const f of outras) {
    comFalha.push({ nome: f.nome, motivo: `tipo "${f.tipo}" nao tem coletor — ninguem le esta fonte` });
  }

  return { itens: [...doRss.itens, ...daApi.itens], comFalha };
}
