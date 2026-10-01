// O segundo coletor — e a pergunta que ele existe para responder.
//
// ============================================================================
// POR QUE UMA SEGUNDA FONTE, E POR QUE ESTA
// ============================================================================
//
// `[01/10]` O radar hoje responde *"o que as 13 fontes que escolhemos
// publicaram?"*. Ele não tem como responder *"o que saiu FORA das minhas
// fontes"* — e essa é a pergunta do dono. Um feed só enxerga o próprio site.
//
// A GDELT DOC 2.0 indexa notícia do mundo inteiro, é **grátis, sem chave e
// sem ação do dono** — por isso ela é a Fase 1, antes de YouTube e comunidade,
// que exigem segredo novo.
//
// ============================================================================
// NADA AQUI SABE DE QUAL ASSUNTO SE TRATA — e isso é requisito dele
// ============================================================================
//
// Ordem na letra: *"Não crie lógica específica, palavras-chave hardcoded,
// fontes especiais, pesos especiais ou tratamento especial para GTA,
// Rockstar, Marvel, Avengers ou qualquer outro assunto citado nos exemplos.
// O sistema precisa ser GENÉRICO."*
//
// Então **a consulta não mora no código**: ela mora em `news_sources`, numa
// linha com `tipo = 'api'`, e o `url` da linha é a consulta inteira. O
// `news_sources_tipo` já aceitava `'api'` — medido em `pg_constraint`, e é por
// isso que a Fase 1 não precisa de migration de schema.
//
// Consequência boa: mudar o que se procura é editar uma linha de tabela, não
// fazer deploy. E `trava` nenhuma precisa conhecer assunto — ela confere que o
// código **não** conhece nenhum.
//
// ============================================================================
// O LIMITE DE 1 REQUISIÇÃO A CADA 5 SEGUNDOS, e o que ele tem de pior
// ============================================================================
//
// Não está na documentação da GDELT. Veio de um `429` medido em 26/09, e o
// corpo da resposta diz, em texto puro:
//
//     Please limit requests to one every 5 seconds or contact kalev...
//
// **Medido de novo em 01/10, e o resultado é pior do que parecia:** quatro
// requisições nossas espaçadas de 8 s, e depois UMA sozinha após 70 s de
// silêncio, todas `429`. A conclusão provável é que o teto é **por IP de
// saída**, e o IP de onde eu testo é compartilhado — o orçamento é gasto por
// tráfego de terceiros, não nosso.
//
// **Isso é hipótese, não fato** (§1.1): o que eu medi é o `429`; a causa eu
// deduzo. Não consigo confirmar daqui, e o IP da Edge Function é outro.
//
// Por isso o desenho abaixo trata `429` como **caso normal**, não como erro:
// ele vira uma linha em `comFalha`, a coleta do RSS segue intacta, e a tela
// diz o que aconteceu. Se a GDELT nunca responder da Supabase, o radar
// continua exatamente como era — e nós vamos **saber**, em vez de supor.

import type { ItemBruto } from "./rss.ts";

/** Quantos artigos aproveitar de cada consulta. */
export const TETO_POR_CONSULTA = 12;

/** O intervalo que a GDELT exige ENTRE requisições, medido no corpo do 429. */
export const ESPACO_ENTRE_CONSULTAS_MS = 5_200;

/**
 * Quantas consultas `api` por clique.
 *
 * Duas, e o motivo é o relógio de quem está esperando: a serialização obriga
 * uma espera de 5,2 s entre elas, então 2 custam ~5 s e 4 custariam ~16 s. O
 * editor clica e olha a tela. Aumentar isto exige mover a coleta para fora do
 * clique, que é outra arquitetura (e outra fase).
 */
export const TETO_DE_CONSULTAS = 2;

/**
 * `20260926T134500Z` -> ISO. Formato só da GDELT, e sem separador nenhum.
 *
 * Devolve `null` em vez de inventar: data errada num radar de atualidade é
 * pior do que data ausente — ela ordena a lista errado e ninguém percebe.
 */
export function dataDaGdelt(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const m = bruto.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Lê a resposta da GDELT. **Nunca lança.**
 *
 * Ela responde de três jeitos diferentes, e dois não são JSON: o `429` vem em
 * TEXTO PURO (*"Please limit requests…"*) e um erro de consulta vem em HTML.
 * Um `JSON.parse` solto aqui derrubaria a coleta inteira do RSS junto —
 * exatamente o que o critério 6 da Fase 1 proíbe.
 */
export function lerGdelt(corpo: string, teto = TETO_POR_CONSULTA): ItemBruto[] {
  let json: unknown;
  try { json = JSON.parse(corpo); } catch { return []; }

  const artigos = (json as { articles?: unknown })?.articles;
  if (!Array.isArray(artigos)) return [];

  return artigos.slice(0, teto).flatMap((bruto): ItemBruto[] => {
    const a = (bruto ?? {}) as Record<string, unknown>;
    const url = typeof a.url === "string" ? a.url : "";
    const titulo = typeof a.title === "string" ? a.title.replace(/\s+/g, " ").trim() : "";

    // Mesma regra do leitor de RSS: sem título ou sem endereço absoluto não é
    // pauta, é ruído ocupando vaga no pedido ao modelo.
    if (!titulo || !/^https?:\/\//i.test(url)) return [];

    return [{
      titulo: titulo.slice(0, 300),
      url,
      // A GDELT **não devolve resumo** — só título, endereço, domínio e data.
      // O campo fica vazio de propósito: preencher com o domínio ou com a data
      // seria fabricar conteúdo editorial a partir de metadado, e o modelo
      // leria aquilo como se fosse apuração.
      resumo: "",
      publicado_em: dataDaGdelt(a.seendate),
    }];
  });
}

export type FonteApi = { id: string; nome: string; url: string };
export type Falha = { nome: string; motivo: string };

/**
 * Consulta as fontes `api` EM SÉRIE, com o espaço que a GDELT exige.
 *
 * Em série e não em paralelo: o RSS vai em `Promise.all` porque 13 sites
 * aguentam, e a GDELT explicitamente não aguenta. Paralelizar aqui garantiria
 * `429` em tudo menos na primeira.
 *
 * `buscar` e `esperar` entram por parâmetro para o teste poder provar o
 * espaçamento sem gastar 5 segundos de relógio real — e para provar que o
 * `429` não derruba a coleta.
 */
export async function coletarDasApis(
  fontes: FonteApi[],
  buscar: (url: string) => Promise<{ ok: boolean; status: number; texto: string }>,
  esperar: (ms: number) => Promise<void>,
  teto = TETO_DE_CONSULTAS,
): Promise<{ itens: (ItemBruto & { fonte_id: string; fonte_nome: string })[]; comFalha: Falha[] }> {
  const itens: (ItemBruto & { fonte_id: string; fonte_nome: string })[] = [];
  const comFalha: Falha[] = [];

  const escolhidas = fontes.slice(0, teto);
  for (let n = 0; n < escolhidas.length; n++) {
    const f = escolhidas[n];
    // A espera vai ANTES da 2ª em diante, nunca antes da 1ª: cobrar 5 s do
    // editor para a primeira consulta seria pagar o pedágio sem a estrada.
    if (n > 0) await esperar(ESPACO_ENTRE_CONSULTAS_MS);

    try {
      const r = await buscar(f.url);
      if (!r.ok) {
        // O 429 é o caso ESPERADO, e a mensagem diz isso em português para
        // quem lê a tela — "HTTP 429" sozinho mandaria procurar defeito nosso.
        comFalha.push({
          nome: f.nome,
          motivo: r.status === 429
            ? "a GDELT recusou por excesso de consultas (limite dela, nao nosso)"
            : `HTTP ${r.status}`,
        });
        continue;
      }
      const lidos = lerGdelt(r.texto);
      if (!lidos.length) { comFalha.push({ nome: f.nome, motivo: "sem artigos na janela" }); continue; }
      for (const i of lidos) itens.push({ ...i, fonte_id: f.id, fonte_nome: f.nome });
    } catch (e) {
      comFalha.push({ nome: f.nome, motivo: e instanceof Error ? e.message : String(e) });
    }
  }

  if (fontes.length > teto) {
    // Dizer o que ficou de fora, em vez de cortar calado. Fonte cadastrada que
    // nunca é consultada é a "cobertura que não cobre" do §1.5.
    comFalha.push({
      nome: `${fontes.length - teto} consulta(s) de API`,
      motivo: `fora do teto de ${teto} por clique (a GDELT exige 5 s entre consultas)`,
    });
  }

  return { itens, comFalha };
}
