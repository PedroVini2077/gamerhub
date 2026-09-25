// redigir-materia — o RASCUNHO da matéria, escrito a partir das NOTAS do editor.
//
// ============================================================================
// O DESENHO QUE TIRA A ALUCINAÇÃO DO CAMINHO, E NÃO É O MODELO
// ============================================================================
//
// O dono aprovou IA no News com uma condição: *"ela não vai postar nada
// sozinha, vai passar pela administração e por mim"*. Isso resolve o risco de
// PUBLICAR errado. Não resolve o de **inventar**, que é outro: revisor humano
// cansado aprova texto plausível, e "plausível" é exatamente o que um modelo
// produz quando não sabe.
//
// A saída não é um modelo melhor. É **de onde vêm os fatos**:
//
//   o editor manda as NOTAS (o que ele apurou, colou, leu)
//   o modelo REDIGE a partir delas, e só delas
//
// A instrução central do prompt é essa, e ela é o mecanismo inteiro: sem notas,
// não há matéria. O modelo vira redator, não repórter — e redator não inventa
// fato porque não é ele quem os traz.
//
// O que ele ainda pode errar: redação, ênfase, um número copiado torto. Tudo
// isso o revisor pega lendo. O que ele NÃO pode mais fazer é criar do nada uma
// data de lançamento que ninguém anunciou.
//
// ============================================================================
// POR QUE GROQ, E NÃO GEMINI — a diferença não é limite, é o que deu para
// VERIFICAR sobre o dado
// ============================================================================
//
// Medido em 25/09. O limite não decide nada aqui: o volume é de algumas
// matérias por dia contra ~1.000 requisições/dia no plano grátis — ~50x de
// folga nos dois provedores.
//
// O que decide é o DADO, e a comparação é assimétrica de propósito: um lado tem
// texto oficial dizendo o que faz; o outro não tem texto oficial dizendo que
// faz.
//
// LIDO NOS TERMOS DO GOOGLE (ai.google.dev/gemini-api/terms), sobre o plano
// GRÁTIS, palavras deles:
//
//   "Google uses the content you submit to the Services and any generated
//    responses to provide, improve, and develop Google products"
//   "human reviewers may read, annotate, and process your API input and output"
//   "Do not submit sensitive, confidential, or personal information to the
//    Unpaid Services."
//
// A última frase decide sozinha. Rascunho de matéria é conteúdo NÃO PUBLICADO:
// se o GamerHub tiver um furo, mandá-lo para o plano grátis do Gemini é mandá-lo
// para fora antes de publicar. O plano PAGO do Google não tem esse problema —
// mas plano pago não é este projeto.
//
// LIDO NO DPA DA GROQ (console.groq.com/docs/legal/...), palavras deles:
//
//   "Groq will Process Personal Data only: (a) to provide, maintain, and
//    support the Cloud Services ... (b) on Customer's behalf in compliance with
//    Customer's documented instructions"
//
// O QUE EU NÃO CONSEGUI VERIFICAR, e fica escrito porque ausência de evidência
// não é evidência (CLAUDE.md §1.1): não achei, no texto oficial da Groq, a
// frase "não treinamos com os seus dados". Fontes de terceiros afirmam isso;
// terceiro não é fonte. O que o DPA diz é mais estreito — processar só para
// prestar o serviço — e a AUSÊNCIA da cláusula de "melhorar nossos produtos" é
// a diferença real entre os dois. É menos do que uma promessa explícita, e é
// mais do que o Gemini grátis oferece.
//
// Se um dia isso pesar mais do que hoje, o caminho é escrever para a Groq e
// guardar a resposta, ou pagar o Gemini. Está anotado no BACKLOG.
//
// ============================================================================
// SÓ EQUIPE, E O MOTIVO É COTA
// ============================================================================
//
// A `moderate-links` já ensinou isto do jeito caro: porta decorativa deixa
// qualquer um da internet queimar a cota do projeto. Aqui a checagem é MAIS
// estrita — não basta estar logado, tem de ser `is_staff()`. Quem escreve
// matéria é a equipe; qualquer outro chamador é abuso por definição.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// A impressao deste codigo. Gerada por `npm run impressao-edges` — NAO editar a
// mao. Um GET devolve este valor, e o portao do CI compara com o do repositorio.
const IMPRESSAO_DESTE_CODIGO = "77a094ca7de7757a";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY  = Deno.env.get("GROQ_API_KEY") ?? "";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Llama 3.3 70B: a melhor das gratuitas em portugues. Trocar de modelo e
// trocar esta string — a forma da API e a da OpenAI.
const MODELO = "llama-3.3-70b-versatile";

// Teto de entrada. Nota gigante nao melhora o rascunho e queima cota de token.
const TETO_DAS_NOTAS = 6000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "Content-Type": "application/json" };

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: JSON_CORS });

/** Registra a falha em `admin_logs`, o painel que o dono abre (§1.5). */
async function gritar(detalhe: string, metadata: Record<string, unknown> = {}) {
  console.error("[redigir-materia]", detalhe, JSON.stringify(metadata));
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error } = await admin.rpc("registrar_falha_de_edge_function", {
      p_funcao:    "redigir-materia",
      p_detalhe:   detalhe,
      p_categoria: "moderation",
      p_metadata:  metadata,
    });
    if (error) console.error("[redigir-materia] nao consegui registrar a falha:", error.message);
  } catch (e) {
    console.error("[redigir-materia] nao consegui registrar a falha:", e);
  }
}

/**
 * A instrução do sistema. A primeira regra é a que faz o resto valer.
 *
 * Escrita em português de propósito: pedir em inglês um texto em português
 * produz tradução, e tradução tem cheiro.
 */
const INSTRUCAO = `Voce e um redator do GamerHub News, um site brasileiro de noticias
sobre games, tecnologia e cultura geek.

REGRA NUMERO UM, ACIMA DE QUALQUER OUTRA:
Escreva APENAS a partir das notas que o editor forneceu. Nao acrescente nenhum
fato, data, numero, nome, preco ou declaracao que nao esteja nas notas.
Se uma informacao importante faltar, escreva no lugar dela o marcador
[CONFERIR: o que falta]
em vez de preencher. Um rascunho com lacunas marcadas e util; um rascunho com
fato inventado e um problema que alguem so descobre depois de publicado.

Voce NAO tem conhecimento proprio sobre o assunto. Trate tudo o que nao esta
nas notas como desconhecido.

COMO ESCREVER:
- Portugues brasileiro, direto, sem jargao de imprensa e sem caca-clique.
- Nada de "voce nao vai acreditar", "chocante", "olha so isso".
- Frases curtas. Um paragrafo por ideia.
- Nao invente citacao entre aspas. Se as notas tiverem uma, use como esta.
- O corpo aceita marcacao simples: **negrito**, *italico*, - lista, > citacao.

RESPONDA SOMENTE COM UM JSON, sem texto antes nem depois, neste formato:
{"titulo":"...","subtitulo":"...","resumo":"...","corpo":"..."}

titulo    ate 90 caracteres, factual, sem ponto final
subtitulo uma frase que complementa o titulo, nao o repete
resumo    ate 280 caracteres, e o que aparece no cartao da lista
corpo     a materia, entre 2 e 6 paragrafos`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // O GET so devolve a impressao, e vem ANTES de qualquer autenticacao: o
  // portao do CI precisa alcanca-lo sem segredo nenhum.
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

  // MAIS estrito do que estar logado. Quem escreve materia e a equipe, e a
  // cota do projeto e o que esta em jogo — a licao da `moderate-links`.
  const { data: ehEquipe, error: erroPapel } = await cliente.rpc("is_staff");
  if (erroPapel || ehEquipe !== true) {
    return responder({ error: "Redigir materia e da equipe." }, 403);
  }

  if (!GROQ_API_KEY) {
    // Sem chave a funcao nao existe na pratica. Ela DIZ isso, em vez de
    // devolver um rascunho vazio que pareceria o modelo falhando.
    return responder({
      status: "sem_chave",
      error: "A IA nao esta configurada. Falta o segredo GROQ_API_KEY — ver docs/OPERACAO.md.",
    }, 503);
  }

  let body: { titulo?: string; notas?: string; fonte_url?: string };
  try { body = await req.json(); }
  catch { return responder({ error: "Payload invalido" }, 400); }

  const titulo = (body.titulo ?? "").trim();
  const notas  = (body.notas ?? "").trim().slice(0, TETO_DAS_NOTAS);

  // SEM NOTAS NAO HA MATERIA. Esta checagem e a regra do desenho virando
  // codigo: aceitar so o titulo obrigaria o modelo a inventar o resto, que e
  // exatamente o que esta funcao existe para nao fazer.
  if (notas.length < 40) {
    return responder({
      error: "Escreva as notas primeiro — o que voce apurou, colou ou leu. "
           + "A IA redige a partir delas; ela nao sabe nada sobre o assunto.",
    }, 400);
  }

  const pedido = [
    titulo ? `Titulo pretendido pelo editor: ${titulo}` : "O editor ainda nao definiu o titulo.",
    body.fonte_url?.trim() ? `Fonte: ${body.fonte_url.trim()}` : "",
    "",
    "NOTAS DO EDITOR (a unica fonte de fatos):",
    notas,
  ].filter(Boolean).join("\n");

  let rascunho: Record<string, string>;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0.3,       // baixa: e redacao a partir de nota, nao criacao
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INSTRUCAO },
          { role: "user", content: pedido },
        ],
      }),
    });

    if (!res.ok) {
      const corpo = (await res.text()).slice(0, 300);
      // 429 e cota estourada. Ela PRECISA gritar: senao a IA some do painel e
      // ninguem sabe por que (§0.2, regra 3).
      await gritar(
        res.status === 429
          ? "cota da Groq estourada — a IA parou de redigir"
          : `Groq respondeu HTTP ${res.status}`,
        { status: res.status, corpo },
      );
      return responder({
        status: res.status === 429 ? "cota" : "erro_provedor",
        error: res.status === 429
          ? "A cota diaria da IA acabou. Ela volta amanha — escreva a mao por enquanto."
          : `A IA nao respondeu (HTTP ${res.status}).`,
      }, 502);
    }

    const json = await res.json();
    const texto = json?.choices?.[0]?.message?.content ?? "";
    rascunho = JSON.parse(texto);
  } catch (e) {
    await gritar("falha ao chamar ou interpretar a Groq", { erro: String(e).slice(0, 300) });
    return responder({ status: "erro_provedor", error: "A IA respondeu algo que eu nao entendi." }, 502);
  }

  // O que volta e RASCUNHO. Esta funcao nao escreve no banco de proposito:
  // quem aplica e quem clica, e quem clica e quem assina.
  return responder({
    status: "ok",
    rascunho: {
      titulo:    String(rascunho.titulo ?? "").slice(0, 200),
      subtitulo: String(rascunho.subtitulo ?? "").slice(0, 300),
      resumo:    String(rascunho.resumo ?? "").slice(0, 400),
      corpo:     String(rascunho.corpo ?? ""),
    },
  });
});
