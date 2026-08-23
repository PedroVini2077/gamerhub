// Capturado da versão 10 implantada em 23/08/2026 — ver ../README.md.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const HF_API_KEY     = Deno.env.get("HUGGINGFACE_API_KEY") ?? "";

const OPENAI_URL   = "https://api.openai.com/v1/moderations";
const OPENAI_MODEL = "omni-moderation-latest";
const HF_MODEL_URL = "https://router.huggingface.co/hf-inference/models/Falconsai/nsfw_image_detection";

// So imagem do proprio storage do projeto e analisada. Sem isto a funcao aceita
// qualquer URL do corpo e vira um SSRF: quem chama escolhe o destino do fetch
// que sai de dentro da infra da Supabase.
const PREFIXO_STORAGE = `${SUPABASE_URL}/storage/v1/object/public/`;

const CARGOS_STAFF = ["admin", "super_admin", "owner"];
const TABELAS: Record<string, string> = {
  post: "posts", comment: "comments", mural: "community_posts",
};

// ---------------------------------------------------------------------------
// POLITICA DE IMAGEM — e o "jogo de cintura" do gore
//
// O modelo antigo (Falconsai/nsfw_image_detection) era binario nsfw/normal,
// treinado em pornografia: nao pegava sangue, gore, automutilacao nem simbolo
// de odio. Medimos foto de rapaz sem camisa na praia em nsfw_score=0.000 — o
// pipeline funcionava, o modelo e que era estreito.
//
// A troca para `omni-moderation-latest` cobre tudo isso numa chamada so. Mas
// num site de JOGOS a maioria das imagens e print de jogo, e NENHUM modelo
// distingue gore de Doom de gore real. Por isso a nota tem dois destinos:
// ---------------------------------------------------------------------------

/** Passou disto, OCULTA na hora. So o que nunca e aceitavel aqui. */
const OCULTA: Record<string, number> = {
  "sexual/minors":          0.10,
  "sexual":                 0.55, // mais folgado que no texto: foto de praia
                                  // e biquini pontuam sem ser pornografia
  "self-harm":              0.50,
  "self-harm/intent":       0.40,
  "self-harm/instructions": 0.30,
};

/**
 * Passou disto, SO ENFILEIRA para uma pessoa olhar — nunca oculta sozinho.
 *
 * Auto-ocultar `violence/graphic` derrubaria metade do conteudo legitimo do
 * site no primeiro dia. Com o destino sendo a fila, um limiar errado gera fila
 * maior; nunca censura.
 */
const SO_ENFILEIRA: Record<string, number> = {
  "violence/graphic": 0.80,
  "violence":         0.90,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

type Veredito = {
  categoria: string | null;
  score: number;
  ocultar: boolean;
  scores: Record<string, number>;
};

const NADA: Veredito = { categoria: null, score: 0, ocultar: false, scores: {} };

/** Escolhe o pior caso entre todas as imagens do post. */
function decidir(scores: Record<string, number>): Veredito {
  let melhor: Veredito = { ...NADA, scores };

  for (const [cat, valor] of Object.entries(scores)) {
    if (typeof valor !== "number") continue;

    const pisoOculta = OCULTA[cat];
    if (pisoOculta !== undefined && valor >= pisoOculta) {
      // Ocultar sempre vence enfileirar, e entre dois que ocultam vence o maior.
      if (!melhor.ocultar || valor > melhor.score) {
        melhor = { categoria: cat, score: valor, ocultar: true, scores };
      }
      continue;
    }

    const pisoFila = SO_ENFILEIRA[cat];
    if (pisoFila !== undefined && valor >= pisoFila && !melhor.ocultar) {
      if (valor > melhor.score) {
        melhor = { categoria: cat, score: valor, ocultar: false, scores };
      }
    }
  }
  return melhor;
}

async function viaOpenAI(urls: string[]): Promise<Veredito | null> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      // As imagens estao em bucket publico, entao a OpenAI busca a URL direto —
      // sem precisar trafegar o arquivo por aqui.
      input: urls.map(url => ({ type: "image_url", image_url: { url } })),
    }),
  });
  if (!res.ok) {
    console.error("[moderate-image] OpenAI error:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const resultados = data?.results;
  if (!Array.isArray(resultados) || resultados.length === 0) return null;

  // Pior caso por categoria entre todas as imagens.
  const maximos: Record<string, number> = {};
  for (const r of resultados) {
    for (const [cat, v] of Object.entries(r?.category_scores ?? {})) {
      if (typeof v === "number" && v > (maximos[cat] ?? 0)) maximos[cat] = v;
    }
  }
  return decidir(maximos);
}

/** Reserva: so pornografia, como era antes. Usado se a chave da OpenAI sumir. */
async function viaHuggingFace(urls: string[]): Promise<Veredito | null> {
  let maior = 0;
  for (const url of urls) {
    try {
      const img = await fetch(url);
      if (!img.ok) continue;
      const bytes = await img.arrayBuffer();
      const hf = await fetch(HF_MODEL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": img.headers.get("content-type") || "image/jpeg",
        },
        body: bytes,
      });
      if (!hf.ok) { console.error("[moderate-image] HF error:", hf.status); continue; }
      const r = await hf.json();
      const arr: Array<{ label: string; score: number }> = Array.isArray(r[0]) ? r[0] : r;
      const nsfw = arr.find(x => x.label === "nsfw");
      if (nsfw && nsfw.score > maior) maior = nsfw.score;
    } catch (e) {
      console.error("[moderate-image] erro ao processar imagem:", e);
    }
  }
  return { categoria: maior >= 0.85 ? "nsfw" : null, score: maior,
           ocultar: maior >= 0.85, scores: { nsfw: maior } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Nao autorizado" }, 401);

  if (!SERVICE_ROLE) {
    console.error("[moderate-image] SUPABASE_SERVICE_ROLE_KEY ausente");
    return json({ error: "Servico mal configurado" }, 500);
  }
  if (!OPENAI_API_KEY && !HF_API_KEY) {
    console.error("[moderate-image] nenhuma API key configurada");
    return json({ error: "API key nao configurada" }, 500);
  }

  let body: { content_type?: string; content_id?: string; image_urls?: string[] };
  try { body = await req.json(); }
  catch { return json({ error: "Payload invalido" }, 400); }

  const { content_type, content_id, image_urls } = body;
  const tabela = content_type ? TABELAS[content_type] : undefined;
  if (!tabela || !content_id || !image_urls?.length)
    return json({ error: "content_type, content_id e image_urls sao obrigatorios" }, 400);

  const clienteUsuario = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await clienteUsuario.auth.getUser();
  if (!user) return json({ error: "Nao autorizado" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // A falha vai para a trilha que o dono ja olha. O corpo da resposta sozinho
  // nao basta: o cliente dispara e descarta (fire-and-forget), entao o erro
  // ficaria sem ninguem para ouvi-lo — foi assim que a IA ficou quebrada em
  // 26 de 26 chamadas por semanas (§1.5).
  const gritar = async (detalhe: string, extra: Record<string, unknown> = {}) => {
    try {
      await admin.rpc("registrar_falha_de_moderacao", {
        p_funcao: "moderate-image", p_detalhe: detalhe,
        p_metadata: { content_type, content_id, ...extra },
      });
    } catch { /* se nem isto passar, o console e o ultimo recurso */ }
  };

  const { data: linha } = await admin
    .from(tabela).select("user_id").eq("id", content_id).maybeSingle();
  if (!linha) return json({ error: "Conteudo nao encontrado" }, 404);

  if (linha.user_id !== user.id) {
    const { data: perfil } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!CARGOS_STAFF.includes(perfil?.role ?? "")) {
      console.warn(`[moderate-image] ${user.id} tentou moderar ${content_type}/${content_id} de outro`);
      return json({ error: "Nao autorizado" }, 403);
    }
  }

  const urls = image_urls
    .filter(u => typeof u === "string" && u.startsWith(PREFIXO_STORAGE))
    .slice(0, 4);
  const recusadas = image_urls.length - urls.length;
  if (recusadas > 0) console.warn(`[moderate-image] ${recusadas} url(s) fora do storage ignorada(s)`);
  if (!urls.length) return json({ score: 0, flagged: false, status: "sem_imagem_valida" });

  const provedor = OPENAI_API_KEY ? "openai" : "huggingface";
  let veredito: Veredito | null = null;
  try {
    veredito = OPENAI_API_KEY ? await viaOpenAI(urls) : await viaHuggingFace(urls);
  } catch (e) {
    console.error("[moderate-image] fetch error:", e);
  }

  // Provedor fora do ar tambem e falha silenciosa: a imagem passa sem analise e
  // ninguem fica sabendo que ela nao foi analisada.
  if (!veredito) {
    await gritar(`provedor ${provedor} nao respondeu`, { provedor });
    return json({ score: 0, flagged: false, provider: provedor, status: "api_error" });
  }

  console.log(
    `[moderate-image] ${provedor} ${content_type}/${content_id} ` +
    `categoria=${veredito.categoria ?? "-"} score=${veredito.score.toFixed(3)} ` +
    `acao=${veredito.categoria ? (veredito.ocultar ? "ocultar" : "enfileirar") : "nada"}`
  );

  if (!veredito.categoria) {
    return json({ score: Math.round(veredito.score * 1000) / 1000, flagged: false,
                  scores: veredito.scores, provider: provedor, status: "ok" });
  }

  // Score 1 porque a decisao ja foi tomada aqui pela politica por categoria; o
  // limiar do painel nao deve desfazer o que os pisos fixos decidiram.
  const { error: rpcError } = await admin.rpc("apply_ai_moderation", {
    p_content_type:  content_type,
    p_content_id:    content_id,
    p_score:         1,
    p_threshold_key: "mod_ai_image_threshold",
    p_categoria:     veredito.categoria,
    p_ocultar:       veredito.ocultar,
  });
  if (rpcError) {
    console.error("[moderate-image] RPC error:", rpcError.message);
    await gritar(rpcError.message, { categoria: veredito.categoria });
    return json({ score: Math.round(veredito.score * 1000) / 1000,
                  status: "rpc_error", error: rpcError.message }, 500);
  }

  return json({
    score: Math.round(veredito.score * 1000) / 1000,
    category: veredito.categoria,
    flagged: true,
    hidden: veredito.ocultar,
    scores: veredito.scores,
    provider: provedor,
    status: "ok",
  });
});
