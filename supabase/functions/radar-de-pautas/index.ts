// radar-de-pautas — o que está acontecendo AGORA, e o que o GamerHub tem a dizer.
//
// ============================================================================
// A VERIFICAÇÃO QUE MUDOU O DESENHO — e ela é a parte importante
// ============================================================================
//
// O pedido do dono foi: *"eu imaginei ela me dando as ideias, as fontes
// confiáveis, às vezes o título... até eu achar uma notícia, estudar sobre e
// colocar lá, isso demoraria"*. Ele pediu para eu verificar se dá antes.
//
// **Perguntar a notícia ao modelo NÃO DÁ, e não é limitação de plano.** Um LLM
// não tem internet e tem data de corte: ele responderia com o que estava no
// treino, ou inventaria — e inventar notícia com cara de fonte confiável é o
// pior resultado possível para uma seção de jornalismo. Seria trocar o
// trabalho de apurar por um gerador de plausibilidade.
//
// O que dá, e é melhor: **os fatos vêm de RSS de fontes que ELE escolheu**, e
// o modelo faz o que modelo faz bem — ler 60 manchetes, juntar as repetidas,
// dizer quais importam para um público gamer brasileiro, e propor um ângulo e
// um título. Mesma regra da `redigir-materia`: o modelo REDIGE, não apura.
//
//     RSS das fontes  ->  news_items_raw  ->  o modelo ORDENA e SUGERE
//     (o fato)            (o registro)        (a leitura editorial)
//
// A fonte de cada pauta é um endereço real, de um feed real, que ele pode
// abrir. Não é o modelo dizendo "segundo a IGN".
//
// ============================================================================
// A GUARDA QUE IMPEDE FONTE INVENTADA
// ============================================================================
//
// O modelo devolve, para cada pauta, os endereços que a sustentam. **Todo
// endereço que não estava no que eu mandei é DESCARTADO** antes de a resposta
// sair daqui — e a contagem do descarte volta no corpo.
//
// Sem isso, "fonte confiável" seria promessa: bastaria o modelo escrever uma
// URL plausível de um site conhecido e ela chegaria na tela com cara de
// apuração. Aqui a lista de endereços válidos é fechada por construção.
//
// ============================================================================
// COTA — a pergunta do §0.2 feita ANTES de ligar
// ============================================================================
//
// Quantas vezes por dia? Uma por clique de editor em "Buscar pautas": ~12
// requisições de RSS (uma por fonte ativa) + 1 ao modelo. Não multiplica por
// usuário, post nem leitor, porque só `is_staff()` alcança. Feed é de graça e
// não tem cota; o teto que conta é o mesmo da `redigir-materia`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { lerFeed, type ItemBruto } from "./rss.ts";

// A impressao deste codigo. Gerada por `npm run impressao-edges` — NAO editar a
// mao. Um GET devolve este valor, e o portao do CI compara com o do repositorio.
const IMPRESSAO_DESTE_CODIGO = "2bafe30b1af9f699";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY  = Deno.env.get("GROQ_API_KEY") ?? "";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELO = "llama-3.3-70b-versatile";

const TETO_POR_FEED   = 15;   // itens lidos de cada fonte
const TETO_DO_PEDIDO  = 60;   // manchetes mandadas ao modelo
const TETO_DE_PAUTAS  = 8;    // sugestoes devolvidas
const TIMEOUT_DO_FEED = 10_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "Content-Type": "application/json" };
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: JSON_CORS });

/** Registra a falha em `admin_logs`, o painel que o dono abre (§1.5). */
async function gritar(admin: ReturnType<typeof createClient> | null, detalhe: string, metadata = {}) {
  console.error("[radar-de-pautas]", detalhe, JSON.stringify(metadata));
  if (!admin) return;
  try {
    await admin.rpc("registrar_falha_de_edge_function", {
      p_funcao: "radar-de-pautas", p_detalhe: detalhe,
      p_categoria: "moderation", p_metadata: metadata,
    });
  } catch (e) { console.error("[radar-de-pautas] nao consegui registrar:", e); }
}

const INSTRUCAO = `Voce e o editor de pauta do GamerHub News, um site brasileiro sobre
games, tecnologia e cultura geek.

Voce recebe uma lista de manchetes coletadas HOJE dos feeds que a equipe assina.
Seu trabalho e LER essa lista e dizer o que vale virar materia.

REGRA NUMERO UM:
Trabalhe SOMENTE com as manchetes da lista. Nao acrescente assunto que nao
esteja nela, nao complete com o que voce sabe de outro lugar, e nao invente
endereco: cada pauta so pode citar URLs que apareceram na lista que eu mandei.
Voce nao tem internet e nao sabe o que aconteceu hoje — quem sabe e a lista.

O QUE FAZER:
- Junte manchetes que falam do MESMO assunto numa pauta so, citando todas as
  URLs delas. Assunto coberto por varias fontes e mais forte, nao mais fraco.
- Descarte o que nao interessa a um publico gamer brasileiro.
- Ordene da mais relevante para a menos.
- Para cada pauta escreva um angulo: o que o GamerHub tem a dizer sobre aquilo
  que nao e so repetir a manchete.

RESPONDA SOMENTE COM UM JSON, sem texto antes nem depois:
{"pautas":[{"titulo":"...","angulo":"...","editoria":"...","por_que_agora":"...","urls":["..."]}]}

titulo        um titulo em portugues, ate 90 caracteres, factual, sem caca-clique
angulo        1 a 2 frases: o recorte que o GamerHub daria
editoria      uma de: gaming, esports, hardware, mobile, playstation, xbox, nintendo, pc, cultura
por_que_agora 1 frase curta dizendo por que isso e assunto hoje
urls          os enderecos DA LISTA que sustentam a pauta, do mais direto ao menos`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ impressao: IMPRESSAO_DESTE_CODIGO }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return responder({ error: "Nao autorizado" }, 401);

  const cliente = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await cliente.auth.getUser();
  if (authError || !user) return responder({ error: "Nao autorizado" }, 401);

  // So equipe: a licao da `moderate-links`. Aqui o recurso em jogo sao 12
  // requisicoes de rede por clique mais a cota do modelo.
  const { data: ehEquipe, error: erroPapel } = await cliente.rpc("is_staff");
  if (erroPapel || ehEquipe !== true) {
    return responder({ error: "O radar de pautas e da equipe." }, 403);
  }

  const admin = SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE) : null;
  if (!admin) {
    return responder({ status: "sem_servico", error: "Servico indisponivel." }, 503);
  }

  // ── 1. COLETAR ────────────────────────────────────────────────────────────
  const { data: fontes, error: erroFontes } = await admin
    .from("news_sources").select("id, nome, url")
    .eq("ativa", true).eq("tipo", "rss");

  if (erroFontes) {
    await gritar(admin, `nao consegui ler as fontes: ${erroFontes.message}`);
    return responder({ status: "erro", error: "Nao consegui ler a lista de fontes." }, 502);
  }
  if (!fontes?.length) {
    return responder({
      status: "sem_fontes",
      error: "Nenhuma fonte RSS ativa cadastrada. Ver docs/OPERACAO.md.",
    }, 200);
  }

  const comFalha: { nome: string; motivo: string }[] = [];
  const coletados: (ItemBruto & { fonte_id: string; fonte_nome: string })[] = [];

  // Em paralelo: 12 feeds em serie seriam ~12x o tempo de um, e o editor
  // esperando. Feed que falha nao derruba os outros — ele entra em `comFalha`.
  await Promise.all(fontes.map(async (f) => {
    try {
      const res = await fetch(f.url, {
        signal: AbortSignal.timeout(TIMEOUT_DO_FEED),
        headers: { "User-Agent": "GamerHubNews/1.0 (+https://gamerhub.com.br)" },
      });
      if (!res.ok) { comFalha.push({ nome: f.nome, motivo: `HTTP ${res.status}` }); return; }
      const itens = lerFeed(await res.text(), TETO_POR_FEED);
      if (!itens.length) { comFalha.push({ nome: f.nome, motivo: "feed sem itens" }); return; }
      for (const i of itens) coletados.push({ ...i, fonte_id: f.id, fonte_nome: f.nome });
    } catch (e) {
      comFalha.push({ nome: f.nome, motivo: e instanceof Error ? e.message : String(e) });
    }
  }));

  if (!coletados.length) {
    await gritar(admin, "nenhuma fonte respondeu", { comFalha });
    return responder({
      status: "sem_itens", comFalha,
      error: "Nenhuma fonte respondeu agora. Tente de novo em alguns minutos.",
    }, 200);
  }

  // Guarda o que chegou. `url` e UNIQUE: `ignoreDuplicates` faz a repeticao
  // entre execucoes custar nada, e e por isso que reexecutar e barato.
  const { error: erroGravar } = await admin.from("news_items_raw").upsert(
    coletados.map(({ fonte_id, titulo, url, resumo, publicado_em }) =>
      ({ fonte_id, titulo, url, resumo, publicado_em })),
    { onConflict: "url", ignoreDuplicates: true },
  );
  if (erroGravar) await gritar(admin, `nao consegui gravar os itens: ${erroGravar.message}`);

  await admin.from("news_sources")
    .update({ ultima_coleta: new Date().toISOString() })
    .in("id", fontes.map((f) => f.id));

  if (!GROQ_API_KEY) {
    // Sem chave a leitura editorial nao acontece — mas a COLETA aconteceu, e
    // devolver as manchetes cruas ja e util. Dizer isso e melhor do que 503.
    return responder({
      status: "sem_chave", coletados: coletados.length, comFalha, pautas: [],
      itens: coletados.slice(0, 30),
      error: "A IA nao esta configurada (GROQ_API_KEY) — segue a lista crua.",
    });
  }

  // ── 2. A LEITURA EDITORIAL ────────────────────────────────────────────────
  const paraOModelo = coletados.slice(0, TETO_DO_PEDIDO);
  const enderecosValidos = new Set(paraOModelo.map((i) => i.url));

  const lista = paraOModelo
    .map((i, n) => `${n + 1}. [${i.fonte_nome}] ${i.titulo}\n   ${i.url}\n   ${i.resumo}`)
    .join("\n");

  let pautas: Record<string, unknown>[] = [];
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO, temperature: 0.4, max_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INSTRUCAO },
          { role: "user", content: `MANCHETES COLETADAS HOJE:\n\n${lista}\n\n`
            + `Devolva no maximo ${TETO_DE_PAUTAS} pautas.` },
        ],
      }),
    });
    if (!res.ok) {
      const corpo = (await res.text()).slice(0, 300);
      await gritar(admin, res.status === 429
        ? "cota da Groq estourada — o radar parou de ordenar"
        : `Groq respondeu HTTP ${res.status}`, { status: res.status, corpo });
      // A coleta valeu. Devolve as manchetes cruas em vez de perder tudo.
      return responder({
        status: res.status === 429 ? "cota" : "erro_provedor",
        coletados: coletados.length, comFalha, pautas: [], itens: paraOModelo.slice(0, 30),
        error: res.status === 429
          ? "A cota diaria da IA acabou — segue a lista crua das manchetes."
          : `A IA nao respondeu (HTTP ${res.status}) — segue a lista crua.`,
      });
    }
    const json = await res.json();
    pautas = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}")?.pautas ?? [];
  } catch (e) {
    await gritar(admin, "falha ao chamar ou interpretar a Groq", { erro: String(e).slice(0, 300) });
    return responder({
      status: "erro_provedor", coletados: coletados.length, comFalha,
      pautas: [], itens: paraOModelo.slice(0, 30),
      error: "A IA respondeu algo que eu nao entendi — segue a lista crua.",
    });
  }

  // ── 3. A GUARDA CONTRA FONTE INVENTADA ────────────────────────────────────
  //
  // Endereco que o modelo escreveu e que NAO estava na lista e descartado.
  // Sem isto, "fontes confiaveis" seria so uma promessa do prompt.
  let inventados = 0;
  const limpas = (Array.isArray(pautas) ? pautas : []).slice(0, TETO_DE_PAUTAS).flatMap((p) => {
    const urls = (Array.isArray(p?.urls) ? p.urls : []).filter((u: unknown) => {
      const vale = typeof u === "string" && enderecosValidos.has(u);
      if (!vale) inventados++;
      return vale;
    });
    // Pauta que perdeu TODAS as fontes nao e pauta: e afirmacao sem lastro.
    if (!urls.length) return [];
    return [{
      titulo:        String(p.titulo ?? "").slice(0, 200),
      angulo:        String(p.angulo ?? "").slice(0, 500),
      editoria:      String(p.editoria ?? "").slice(0, 40),
      por_que_agora: String(p.por_que_agora ?? "").slice(0, 300),
      urls: urls.slice(0, 5),
      // O resumo da fonte principal vira as NOTAS do rascunho: e o elo entre
      // este radar e a `redigir-materia`, que exige nota para escrever.
      notas: paraOModelo.filter((i) => urls.includes(i.url))
        .map((i) => `[${i.fonte_nome}] ${i.titulo}\n${i.resumo}\n${i.url}`).join("\n\n"),
    }];
  });

  if (inventados > 0) {
    await gritar(admin, `o modelo citou ${inventados} endereco(s) que nao estavam na lista`,
      { inventados, pautas: limpas.length });
  }

  return responder({
    status: "ok",
    coletados: coletados.length,
    fontes: fontes.length,
    comFalha,
    enderecosDescartados: inventados,
    pautas: limpas,
  });
});
