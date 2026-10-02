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
// a instrução e o esquema estrito · `sinais.ts` o que se anexa à pauta pronta,
// com `aceleracao.ts` e `youtube.ts`. Em uma linha: o modelo cita NÚMERO e
// nunca endereço, e a lista para de crescer antes do teto da Groq.
//
// ============================================================================
// COTA — as duas perguntas do §0.2, respondidas em `docs/regras/COTAS.md`
// ============================================================================
//
// Uma execucao por clique de editor; so `is_staff()` alcanca. Os tetos que
// contam sao o da Groq (tokens por minuto, ver `pedido.ts`) e o do YouTube
// (**100 search.list por dia**, e por isso e UMA busca por clique e nunca uma
// por pauta — ver `youtube.ts`). Nenhum multiplica por visitante.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { fatiaJusta } from "./rss.ts";
import { coletarTudo } from "./coleta.ts";
import { ORCAMENTO_DA_LISTA, montarPedido, resolverPautas, TETO_DE_PAUTAS } from "./pedido.ts";
import { JANELA_DE_DIAS } from "./aceleracao.ts";
import { anexarSinais } from "./sinais.ts";
import { buscarTexto } from "./coleta.ts";
import { pedirAoModelo } from "./modelo.ts";

// A impressao deste codigo. Gerada por `npm run impressao-edges` — NAO editar a
// mao. Um GET devolve este valor, e o portao do CI compara com o do repositorio.
const IMPRESSAO_DESTE_CODIGO = "9f19ebdf754530c3";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
// `[02/10]` FASE 4. SEM `!`, e de proposito: a chave pode nao estar
// configurada, e o radar continua inteiro sem ela — o sinal de video e que
// fica de fora, dizendo na tela que ficou (ver `youtube.ts`).
const YOUTUBE_KEY   = Deno.env.get("YOUTUBE_API_KEY");
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY  = Deno.env.get("GROQ_API_KEY") ?? "";

// A escolha do modelo e a chamada em si moram em `modelo.ts` desde `[02/10]`.

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
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: JSON_CORS });

/**
 * O mínimo que `gritar` e `medirAceleracao` precisam do cliente: só `.rpc`.
 *
 * `[01/10]` Era `ReturnType<typeof createClient>`, que parece preciso e **não
 * é**: o genérico que o `createClient` infere não é o mesmo que o tipo nomeado
 * do pacote, e o `deno check` acusava oito vezes a mesma incompatibilidade.
 * Pedir a superfície que se usa é mais honesto do que pedir o objeto inteiro —
 * e é o que deixa a função testável sem um Supabase de verdade.
 */
type ChamaRpc = {
  rpc: (nome: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** Registra a falha em `admin_logs`, o painel que o dono abre (§1.5). */
async function gritar(admin: ChamaRpc | null, detalhe: string, metadata = {}) {
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
  // `[02/10]` `youtube` entra no filtro mas NAO vai para o `coletarTudo`: ele
  // despacha por tipo e chamaria a fonte de "tipo sem coletor". O vídeo e
  // SINAL, nao manchete — ele e lido depois das pautas prontas.
  const { data: fontes, error: erroFontes } = await admin
    .from("news_sources").select("id, nome, url, tipo")
    .eq("ativa", true).in("tipo", ["rss", "api", "youtube"]);

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

  const fontesDeVideo = fontes.filter((f) => f.tipo === "youtube");
  const { itens: coletados, comFalha } = await coletarTudo(
    fontes.filter((f) => f.tipo !== "youtube"));

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

  const doModelo = await pedirAoModelo(lista, chars, usados.length, GROQ_API_KEY);
  if (!doModelo.ok) {
    await gritar(admin, doModelo.motivo, doModelo.metadata);
    // A coleta valeu. Devolve as manchetes cruas em vez de perder tudo.
    return responder(corpo({
      status: doModelo.status, itens: usados.slice(0, 30), error: doModelo.aviso,
    }));
  }
  const resposta = doModelo.resposta;

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

  // ── 4. OS SINAIS ANEXADOS ─────────────────────────────────────────────────
  //
  // Aceleração (Fase 3) e vídeo (Fase 4). É a ÚLTIMA coisa que acontece, de
  // propósito: sinal que falha não pode custar pauta. O porquê de cada um está
  // em `sinais.ts`, `aceleracao.ts` e `youtube.ts`.
  const { pautas: comSinal, falhasDeVideo } = await anexarSinais(limpas, {
    chamarAceleracao: (termos, dias) => admin.rpc("news_aceleracao_de_termos",
      { p_termos: termos, p_janela_dias: dias }),
    fontesDeVideo,
    chaveDoYoutube: YOUTUBE_KEY,
    buscar: buscarTexto,
  });

  return responder(corpo({
    status: "ok",
    noPedido: usados.length,
    enderecosDescartados: foraDaLista,
    janelaDoSinal: JANELA_DE_DIAS,
    // A falha do video entra JUNTO das de coleta: para quem le a tela, "uma
    // fonte nao respondeu" e a mesma informacao, venha ela de um feed ou da
    // API do YouTube. Duas listas separadas fariam uma delas ser esquecida.
    comFalha: [...comFalha, ...falhasDeVideo],
    pautas: comSinal,
  }));
});
