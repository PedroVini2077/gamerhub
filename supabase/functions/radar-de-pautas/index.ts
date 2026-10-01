// radar-de-pautas — o que está acontecendo AGORA, e o que o GamerHub tem a dizer.
//
// ============================================================================
// A VERIFICAÇÃO QUE MUDOU O DESENHO — e ela é a parte importante
// ============================================================================
//
// O pedido dele foi *"ela me dando as ideias, as fontes confiáveis, às vezes
// o título"*, e ele mandou verificar se dá antes.
//
// **Perguntar a notícia ao modelo NÃO DÁ, e não é limitação de plano.** Um LLM
// não tem internet e tem data de corte: responderia com treino velho ou
// inventaria — e notícia inventada com cara de fonte confiável é o pior
// resultado possível numa seção de jornalismo.
//
// O que dá: **o fato vem das fontes que ELE escolheu**, e o modelo faz o que
// modelo faz bem — ler as manchetes, juntar as repetidas, dizer quais importam
// e propor ângulo. Mesma regra da `redigir-materia`: REDIGE, não apura.
//
//
// ONDE MORA O QUE NÃO ESTÁ AQUI: `coleta.ts` despacha RSS e API · `gdelt.ts`
// o 2º coletor e o teto dele · `pedido.ts` o orçamento de tokens · `contrato.ts`
// a instrução e o esquema estrito da resposta. Em uma linha: o modelo cita
// NÚMERO e nunca endereço, e a lista para de crescer antes do teto da Groq.
//
// ============================================================================
// COTA — as duas perguntas do §0.2, respondidas em `docs/regras/COTAS.md`
// ============================================================================
//
// Uma execucao por clique de editor; so `is_staff()` alcanca. Os tetos que
// contam sao o da GDELT (frequencia, ver `gdelt.ts`) e o de tokens por minuto
// da Groq (volume, ver `pedido.ts`). Nenhum multiplica por visitante.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { fatiaJusta } from "./rss.ts";
import { coletarTudo } from "./coleta.ts";
import {
  ORCAMENTO_DA_LISTA, montarPedido, resolverPautas,
  RESERVA_DE_SAIDA, TPM_DO_PLANO, TETO_DE_PAUTAS,
} from "./pedido.ts";
import { INSTRUCAO, ESQUEMA_DA_RESPOSTA } from "./contrato.ts";

// A impressao deste codigo. Gerada por `npm run impressao-edges` — NAO editar a
// mao. Um GET devolve este valor, e o portao do CI compara com o do repositorio.
const IMPRESSAO_DESTE_CODIGO = "73182d7737826abd";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY  = Deno.env.get("GROQ_API_KEY") ?? "";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// `[26/09]` Era `llama-3.3-70b-versatile` e dava `HTTP 404`: o Groq responde
// 404 quando o modelo existe mas a conta nao o alcanca, e aquele e Enterprise.
// O porque completo esta no cabecalho da `redigir-materia`; a lista do que foi
// conferido no plano gratis, em `src/lib/modelosConferidos.js`.
const MODELO = "openai/gpt-oss-120b";

const TETO_DO_PEDIDO  = 60;   // manchetes mandadas ao modelo

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "Content-Type": "application/json" };
/**
 * Tira a cerca de markdown que alguns modelos poem em volta do JSON.
 *
 * O `response_format: json_object` pede JSON puro e a maioria obedece — mas
 * "a maioria" nao e "todos", e trocar de modelo troca esse comportamento. Sem
 * isto, um ```json em volta derruba o `JSON.parse` e a tela diz "a IA
 * respondeu algo que eu nao entendi" sobre uma resposta que estava correta.
 */
const semCerca = (t: string) =>
  t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/,"").trim();

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
  // `[01/10]` `tipo` entra no SELECT e `api` entra no filtro: a Fase 1 trouxe
  // a GDELT como segundo coletor, e a consulta dela e uma LINHA desta tabela
  // (nada de assunto escrito no codigo — ver `gdelt.ts`).
  const { data: fontes, error: erroFontes } = await admin
    .from("news_sources").select("id, nome, url, tipo")
    .eq("ativa", true).in("tipo", ["rss", "api"]);

  if (erroFontes) {
    await gritar(admin, `nao consegui ler as fontes: ${erroFontes.message}`);
    return responder({ status: "erro", error: "Nao consegui ler a lista de fontes." }, 502);
  }
  if (!fontes?.length) {
    return responder({
      status: "sem_fontes",
      error: "Nenhuma fonte ativa cadastrada. Ver docs/OPERACAO.md.",
    }, 200);
  }

  const { itens: coletados, comFalha } = await coletarTudo(fontes);

  /**
   * `[01/10]` O corpo da resposta, montado num lugar SÓ.
   *
   * Só o retorno de SUCESSO carregava `fontes`; os cinco caminhos de falha
   * não, e o cliente faz `?? 0` — a tela dizia **"170 manchetes de 0
   * fontes"** com treze funcionando. Consertar nos cinco lugares convidaria
   * o sexto a nascer errado (§4): aqui o campo comum é estrutural.
   */
  const corpo = (extra: Record<string, unknown>) => ({
    coletados: coletados.length, fontes: fontes.length, comFalha, pautas: [], ...extra,
  });

  if (!coletados.length) {
    await gritar(admin, "nenhuma fonte respondeu", { comFalha });
    return responder(corpo({
      status: "sem_itens",
      error: "Nenhuma fonte respondeu agora. Tente de novo em alguns minutos.",
    }), 200);
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
    return responder(corpo({
      status: "sem_chave",
      itens: coletados.slice(0, 30),
      error: "A IA nao esta configurada (GROQ_API_KEY) — segue a lista crua.",
    }));
  }

  // ── 2. A LEITURA EDITORIAL ────────────────────────────────────────────────
  //
  // FATIA JUSTA POR FONTE, e nao os primeiros 60 que chegaram — o porque esta
  // no cabecalho de `fatiaJusta` em `rss.ts`, junto com a medicao que o
  // revelou. Resumo: `coletados` vem na ordem em que o `Promise.all` termina,
  // entao as fontes RAPIDAS comiam as vagas das boas, em silencio.
  //
  // E entao o ORCAMENTO corta o que nao couber no teto por minuto da Groq.
  // Era isto que faltava, e custou 7 chamadas em 7 — ver `pedido.ts`.
  const justos = fatiaJusta(coletados, (i) => i.fonte_id, TETO_DO_PEDIDO);
  const { lista, usados, chars } = montarPedido(justos, ORCAMENTO_DA_LISTA);

  if (!usados.length) {
    await gritar(admin, "nenhum item coube no orcamento do pedido",
      { orcamento: ORCAMENTO_DA_LISTA, candidatos: justos.length });
    return responder(corpo({
      status: "erro_provedor", itens: justos.slice(0, 30),
      error: "Nao consegui montar o pedido para a IA — segue a lista crua.",
    }));
  }

  let resposta: unknown = {};
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO, temperature: 0.4, max_tokens: RESERVA_DE_SAIDA,
        // Raciocinio BAIXO: o gpt-oss-120b gasta a cadeia de pensamento do
        // MESMO `max_tokens`, e foi isso que esvaziou a resposta (`pedido.ts`,
        // RESERVA_DE_RACIOCINIO). Ordenar manchete nao pede raciocinio fundo.
        reasoning_effort: "low",
        // Esquema estrito no lugar de `json_object` — garante a FORMA, nao so
        // a sintaxe. Ver `contrato.ts`: nao e isto que conserta o 400.
        response_format: { type: "json_schema", json_schema: ESQUEMA_DA_RESPOSTA },
        messages: [
          { role: "system", content: INSTRUCAO },
          { role: "user", content: `MANCHETES COLETADAS HOJE:\n\n${lista}\n\n`
            + `Devolva no maximo ${TETO_DE_PAUTAS} pautas.` },
        ],
      }),
    });
    if (!res.ok) {
      const corpo = (await res.text()).slice(0, 300);

      // A MENSAGEM TEM QUE SER VERDADEIRA (§1.5). O 413 da Groq nao e "corpo
      // grande demais" nem "cota diaria": e o teto por MINUTO batido por uma
      // requisicao so. Chamar isso de cota diaria mandaria o dono esperar ate
      // amanha por um defeito que e nosso e que o orcamento deveria impedir.
      const porDia = /per day|\bRPD\b/i.test(corpo);

      // `[01/10]` O 400 tem DOIS significados, e confundi-los custa horas:
      // `failed_generation` VAZIO e falta de espaco para o raciocinio (o
      // modelo nao escreveu nada); 400 citando `response_format` ou
      // `reasoning_effort` e a Groq recusando o PEDIDO.
      const ficouSemEspaco = /json_validate_failed/i.test(corpo)
        && /"failed_generation"\s*:\s*""/.test(corpo);
      const recusouOParametro = res.status === 400
        && /response_format|json_schema|reasoning_effort/i.test(corpo);

      const motivo = res.status === 400 && ficouSemEspaco
        ? "o modelo nao escreveu nada — o raciocinio comeu o max_tokens (ver RESERVA_DE_RACIOCINIO)"
        : recusouOParametro
          ? "a Groq RECUSOU o pedido: json_schema estrito ou reasoning_effort deixaram de valer para este modelo"
        : res.status === 413
        ? `o pedido passou do teto por minuto da Groq (TPM ${TPM_DO_PLANO}) — o orcamento falhou`
        : res.status === 429
          ? (porDia ? "cota DIARIA da Groq estourada" : "teto por minuto da Groq — pedidos rapidos demais")
          : `Groq respondeu HTTP ${res.status}`;

      await gritar(admin, motivo,
        { status: res.status, corpo, charsDaLista: chars, itensNoPedido: usados.length });

      // A coleta valeu. Devolve as manchetes cruas em vez de perder tudo.
      const aviso = ficouSemEspaco || recusouOParametro
        ? "A IA recusou o pedido — e defeito nosso, ja registrado com o motivo. Segue a lista crua."
        : res.status === 413
        ? "A IA recusou o pedido por tamanho — e defeito nosso, ja registrado. Segue a lista crua."
        : res.status === 429
          ? (porDia
            ? "A cota diaria da IA acabou. Ela volta amanha — segue a lista crua."
            : "Muitos pedidos seguidos. Espere um minuto e tente de novo — segue a lista crua.")
          : `A IA nao respondeu (HTTP ${res.status}) — segue a lista crua.`;

      return responder(corpo({
        status: res.status === 429 && porDia ? "cota" : "erro_provedor",
        itens: usados.slice(0, 30), error: aviso,
      }));
    }
    const json = await res.json();
    resposta = JSON.parse(semCerca(json?.choices?.[0]?.message?.content ?? "{}"));
  } catch (e) {
    await gritar(admin, "falha ao chamar ou interpretar a Groq", { erro: String(e).slice(0, 300) });
    return responder(corpo({
      status: "erro_provedor", itens: usados.slice(0, 30),
      error: "A IA respondeu algo que eu nao entendi — segue a lista crua.",
    }));
  }

  // ── 3. RESOLVER OS NUMEROS EM FONTES REAIS ────────────────────────────────
  //
  // O modelo cita numero; o endereco sai de `usados`, que e a lista que NOS
  // mandamos. Nao ha campo onde ele possa escrever uma URL — citar fonte que
  // nao existe deixou de ser algo que se filtra e passou a ser algo que nao
  // cabe no formato. `foraDaLista` conta o numero fora da faixa, que e o que
  // sobrou da mesma classe.
  const { pautas: limpas, foraDaLista } = resolverPautas(resposta, usados, TETO_DE_PAUTAS);

  if (foraDaLista > 0) {
    await gritar(admin, `o modelo citou ${foraDaLista} item(ns) que nao estavam na lista`,
      { foraDaLista, pautas: limpas.length, itensNoPedido: usados.length });
  }

  return responder(corpo({
    status: "ok",
    noPedido: usados.length,
    enderecosDescartados: foraDaLista,
    pautas: limpas,
  }));
});
