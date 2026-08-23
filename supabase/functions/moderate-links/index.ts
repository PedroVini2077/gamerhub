// Capturado da versão 6 implantada em 23/08/2026 — ver ../README.md.
//
// moderate-links — checa um link de post contra o Google Safe Browsing.
//
// ============================================================================
// DUAS CORREÇÕES NESTA VERSÃO
// ============================================================================
//
// 1. A PORTA ERA DECORATIVA. A versão anterior fazia `if (!authHeader) 401` e
//    seguia em frente — sem NUNCA validar o token. Provado com um curl:
//
//      curl -X POST .../moderate-links -H "Authorization: Bearer lixo-qualquer" \
//           -d '{"content_type":"post","content_id":"...","url":"https://x"}'
//      -> {"safe":true,"threat_type":null,"status":"ok"}
//
//    Não dá escalada de privilégio (a RPC do fim confere de novo), mas dá para
//    qualquer pessoa da internet queimar a cota do Safe Browsing do projeto,
//    que é de 10 mil consultas/dia. Estourada, a checagem de link **para de
//    funcionar para todo mundo** — e em silêncio, porque a falha da API
//    degrada de forma graciosa por design.
//
//    Agora valida de verdade com `auth.getUser()`, igual à moderate-text.
//
// 2. ELA NÃO GRITAVA (CLAUDE.md §1.5). Tudo ia para `console.error`. Era a
//    última das três funções de moderacao sem trilha — ficou de fora por ser
//    "a menos crítica", o que é justamente como se acumula ponto cego.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GSB_KEY       = Deno.env.get("GOOGLE_SAFE_BROWSING_KEY") ?? "";
const GSB_URL       = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GSB_KEY}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "Content-Type": "application/json" };

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: JSON_CORS });

/**
 * Registra a falha em `admin_logs`, o painel que o dono abre. Nunca deixa a
 * falha do próprio log derrubar a função.
 */
async function gritar(detalhe: string, metadata: Record<string, unknown> = {}) {
  console.error("[moderate-links]", detalhe, JSON.stringify(metadata));
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error } = await admin.rpc("registrar_falha_de_edge_function", {
      p_funcao:    "moderate-links",
      p_detalhe:   detalhe,
      p_categoria: "moderation",
      p_metadata:  metadata,
    });
    if (error) console.error("[moderate-links] nao consegui registrar a falha:", error.message);
  } catch (e) {
    console.error("[moderate-links] nao consegui registrar a falha:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return responder({ error: "Nao autorizado" }, 401);

  // O `verify_jwt` do gateway fica desligado porque ele rejeitaria o preflight
  // OPTIONS e quebraria o CORS. A validação aqui é estritamente mais forte: o
  // gateway aceitaria qualquer JWT do projeto, inclusive a própria anon key.
  const cliente = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await cliente.auth.getUser();
  if (authError || !user) return responder({ error: "Nao autorizado" }, 401);

  if (!GSB_KEY) {
    // Sem chave, a checagem de link nunca acontece — e nunca acontecer em
    // silêncio é pior do que falhar. Grita.
    await gritar("GOOGLE_SAFE_BROWSING_KEY nao configurado — nenhum link esta sendo checado");
    return responder({ safe: true, status: "no_key" });
  }

  let body: { content_type?: string; content_id?: string; url?: string };
  try { body = await req.json(); }
  catch { return responder({ error: "Payload invalido" }, 400); }

  const { content_type, content_id, url } = body;
  if (!content_type || !content_id || !url?.trim())
    return responder({ error: "content_type, content_id e url sao obrigatorios" }, 400);

  const alvo = { content_type, content_id, url: url.trim().slice(0, 300) };

  let safe = true;
  let matchType: string | null = null;
  try {
    const gsbRes = await fetch(GSB_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "gamerhub", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: url.trim() }],
        },
      }),
    });
    if (!gsbRes.ok) {
      // 429 aqui é cota estourada: a checagem para de valer para todo mundo.
      await gritar(`Safe Browsing respondeu ${gsbRes.status}: ${(await gsbRes.text()).slice(0, 200)}`, alvo);
      return responder({ safe: true, status: "api_error" });
    }
    const result = await gsbRes.json();
    if (result.matches && result.matches.length > 0) {
      safe = false;
      matchType = result.matches[0]?.threatType ?? "UNKNOWN";
    }
  } catch (e) {
    await gritar(`nao consegui falar com o Safe Browsing: ${e instanceof Error ? e.message : String(e)}`, alvo);
    return responder({ safe: true, status: "fetch_error" });
  }

  console.log(`[moderate-links] ${content_type}/${content_id} safe=${safe} type=${matchType}`);

  if (!safe) {
    const { error: rpcError } = await cliente.rpc("apply_link_moderation", {
      p_content_type: content_type,
      p_content_id:   content_id,
    });
    if (rpcError) {
      // Link malicioso DETECTADO e não ocultado — o pior desfecho possível
      // desta função, e era o que morria num console.error. Foi exatamente
      // esta forma de falha que deixou a moderacao por IA quebrada em 26 de
      // 26 chamadas por semanas.
      await gritar(`link malicioso detectado (${matchType}) e a RPC NAO ocultou: ${rpcError.message}`, alvo);
      return responder({ safe, threat_type: matchType, status: "rpc_error", erro: rpcError.message });
    }
  }

  return responder({ safe, threat_type: matchType, status: "ok" });
});
