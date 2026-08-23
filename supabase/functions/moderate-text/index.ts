// Capturado da versão implantada em 23/08/2026 — ver ../README.md.
//
// Este arquivo cuida do HTTP: quem pode chamar, de onde vem o texto, e o que
// fazer com o veredito. A POLÍTICA (o que conta como violação, e como se
// pergunta ao provedor) mora em `politica.ts` — separado em 23/08 porque o
// arquivo estava em 328 linhas e as duas perguntas se misturavam (§4).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  DIAL_PADRAO, viaOpenAI, viaHuggingFace, type Decisao,
} from "./politica.ts";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const HF_API_KEY     = Deno.env.get("HUGGINGFACE_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ---------------------------------------------------------------------------
// DE ONDE VEM O TEXTO
//
// O texto NAO vem do corpo da requisicao. Vinha, e isso era um buraco:
// qualquer pessoa logada podia mandar `content_id` de um post alheio junto de
// um texto ofensivo qualquer e derrubar o post de outro. O texto e lido da
// propria linha, e so o autor (ou a equipe) pode pedir a moderacao dela.
// ---------------------------------------------------------------------------
const FONTES: Record<string, { tabela: string; campos: string[] }> = {
  post:    { tabela: "posts",           campos: ["title", "content"] },
  comment: { tabela: "comments",        campos: ["content"] },
  mural:   { tabela: "community_posts", campos: ["message"] },
  chat:    { tabela: "live_chat",       campos: ["message"] },
};

const CARGOS_STAFF = ["admin", "super_admin", "owner"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Nao autorizado" }, 401);

  // A RPC `apply_ai_moderation` so e executavel por `service_role` — de
  // proposito: ela recebe o score do chamador, entao liberar pra
  // `authenticated` daria a qualquer pessoa logada o poder de ocultar
  // qualquer conteudo do site mandando score 1.
  if (!SERVICE_ROLE) {
    console.error("[moderate-text] SUPABASE_SERVICE_ROLE_KEY ausente");
    return json({ error: "Servico mal configurado" }, 500);
  }

  if (!OPENAI_API_KEY && !HF_API_KEY) {
    console.error("[moderate-text] nenhuma API key configurada");
    return json({ error: "API key nao configurada" }, 500);
  }

  let body: { content_type?: string; content_id?: string };
  try { body = await req.json(); }
  catch { return json({ error: "Payload invalido" }, 400); }

  const { content_type, content_id } = body;
  const fonte = content_type ? FONTES[content_type] : undefined;
  if (!fonte || !content_id)
    return json({ error: "content_type e content_id sao obrigatorios" }, 400);

  // Valida a ASSINATURA do token. Antes so se checava a presenca do header —
  // qualquer string passava, e a funcao e publica (verify_jwt desligado por
  // causa do preflight).
  const clienteUsuario = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await clienteUsuario.auth.getUser();
  if (!user) return json({ error: "Nao autorizado" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // A falha vai para a trilha que o dono ja olha. O corpo da resposta sozinho
  // nao basta: o cliente dispara e descarta (fire-and-forget), entao o erro
  // ficaria sem ninguem para ouvi-lo — foi assim que a IA ficou quebrada em
  // 26 de 26 chamadas por semanas (§1.5).
  const gritar = async (detalhe: string, extra: Record<string, unknown> = {}) => {
    try {
      await admin.rpc("registrar_falha_de_moderacao", {
        p_funcao: "moderate-text", p_detalhe: detalhe,
        p_metadata: { content_type, content_id, ...extra },
      });
    } catch { /* se nem isto passar, o console e o ultimo recurso */ }
  };

  const { data: linha } = await admin
    .from(fonte.tabela)
    .select(["user_id", ...fonte.campos].join(", "))
    .eq("id", content_id)
    .maybeSingle();
  if (!linha) return json({ error: "Conteudo nao encontrado" }, 404);

  const row = linha as unknown as Record<string, string | null>;

  // So o autor da linha — ou a equipe — pode pedir a moderacao dela.
  if (row.user_id !== user.id) {
    const { data: perfil } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!CARGOS_STAFF.includes(perfil?.role ?? "")) {
      console.warn(`[moderate-text] ${user.id} tentou moderar ${content_type}/${content_id} de outro`);
      return json({ error: "Nao autorizado" }, 403);
    }
  }

  const texto = fonte.campos.map(c => row[c]).filter(Boolean).join(" ").trim();
  if (!texto) return json({ score: 0, flagged: false, status: "sem_texto" });

  // O dial vem do painel do dono; se a leitura falhar, cai no padrao.
  let dial = DIAL_PADRAO;
  try {
    const { data } = await admin
      .from("site_config").select("value").eq("key", "mod_ai_text_threshold").maybeSingle();
    const v = parseFloat(data?.value ?? "");
    if (!Number.isNaN(v) && v > 0 && v <= 1) dial = v;
  } catch { /* mantem o padrao */ }

  const provedor = OPENAI_API_KEY ? "openai" : "huggingface";
  let decisao: Decisao | null = null;
  try {
    decisao = OPENAI_API_KEY
      ? await viaOpenAI(texto, dial, OPENAI_API_KEY)
      : await viaHuggingFace(texto, dial, HF_API_KEY);
  } catch (e) {
    console.error("[moderate-text] fetch error:", e);
  }

  // Falha do provedor nao pode bloquear o post do usuario — devolve sem ocultar.
  // Mas TEM que gritar: texto que passou sem analise e um buraco silencioso.
  if (!decisao) {
    await gritar(`provedor ${provedor} nao respondeu`, { provedor });
    return json({ score: 0, flagged: false, provider: provedor, status: "api_error" });
  }

  // A decisao de ocultar e tomada AQUI (politica por categoria). O score
  // mandado pra RPC reflete essa decisao: 1.0 forca o ocultamento seja qual
  // for o dial gravado no banco; senao vai o maior score real, pra registro.
  const scoreParaRpc = decisao.flagged ? 1 : decisao.maiorScore;

  console.log(
    `[moderate-text] ${provedor} ${content_type}/${content_id} ` +
    `flagged=${decisao.flagged} ${decisao.motivos.join(", ") || "-"}`
  );

  const { error: rpcError } = await admin.rpc("apply_ai_moderation", {
    p_content_type: content_type,
    p_content_id:   content_id,
    p_score:        scoreParaRpc,
    p_threshold_key: "mod_ai_text_threshold",
    p_categoria:    decisao.flagged ? decisao.categoriaPrincipal : null,
  });
  if (rpcError) {
    console.error("[moderate-text] RPC error:", rpcError.message);
    await gritar(rpcError.message, { categoria: decisao.categoriaPrincipal });
    return json({
      score: Math.round(decisao.maiorScore * 1000) / 1000,
      flagged: decisao.flagged,
      reasons: decisao.motivos,
      provider: provedor,
      status: "rpc_error",
      error: rpcError.message,
    }, 500);
  }

  return json({
    score: Math.round(decisao.maiorScore * 1000) / 1000,
    flagged: decisao.flagged,
    reasons: decisao.motivos,
    category: decisao.categoriaPrincipal,
    categories: decisao.categorias,
    provider: provedor,
    status: "ok",
  });
});
