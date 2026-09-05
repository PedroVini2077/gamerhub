// verify-contact — a única porta do formulário público de contato.
//
// ============================================================================
// POR QUE ESTA FUNÇÃO EXISTE
// ============================================================================
//
// A RPC `enviar_mensagem_de_contato` já tem faixa de tamanho, lista fechada de
// assuntos, teto de 3 mensagens por e-mail em 24 h e um disjuntor de 60/hora.
// O que nada disso impede — e está escrito no SQL da própria migration de
// 02/09 — é **um robô com muitos endereços diferentes encher a hora e fechar o
// canal para todo mundo**.
//
// O captcha (Cloudflare Turnstile) fecha isso. Mas só fecha porque a RPC deixou
// de ser chamável por `anon`: enquanto ela aceitasse chamada direta em
// `/rest/v1/rpc/`, o captcha seria decoração — a regra existiria só para quem
// já não era ameaça (§1.3, "validação no cliente não vale nada").
//
// Ou seja: esta função e o revoke da RPC são UMA coisa só. Uma sem a outra não
// protege nada.
//
// ============================================================================
// AS TRÊS DECISÕES QUE VALE SABER ANTES DE MEXER
// ============================================================================
//
// 1. CLOUDFLARE FORA DO AR -> A MENSAGEM PASSA, e a falha vai para admin_logs.
//
//    O `/contato` é o canal de quem está banido ou trancado para fora do site —
//    está escrito como requisito na rota. Barrar todo mundo por causa de uma
//    indisponibilidade do Cloudflare cortaria justamente quem mais precisa
//    falar com a equipe.
//
//    O buraco é estreito de propósito: token que o Cloudflare **recusa**
//    continua recusado. Só a QUEDA do serviço passa, e ninguém de fora
//    consegue provocar essa queda. Por baixo continuam os limites do banco.
//
// 2. NÃO MANDAMOS O IP DE NINGUÉM PARA O CLOUDFLARE.
//
//    O `siteverify` aceita um `remoteip` opcional que melhora um pouco a
//    heurística. Mandá-lo seria compartilhar endereço de IP de visitante com
//    mais um terceiro — o oposto do endurecimento de LGPD que este projeto
//    fez. O ganho não paga (ver docs/PRIVACIDADE.md).
//
// 3. TOKEN MALFORMADO É RECUSADO AQUI, ANTES DE FALAR COM O CLOUDFLARE.
//
//    Senão um robô gasta a cota de verificação mandando lixo — a pergunta
//    "quantas vezes por dia isto roda?" do §0.2, regra 2.
//
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// O Cloudflare documenta o token como tendo até 2048 caracteres. O piso de 20
// não vem de especificação — é só o suficiente para descartar "", "a" e
// "undefined" sem gastar uma requisição com eles.
const TOKEN_MIN = 20;
const TOKEN_MAX = 2048;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "Content-Type": "application/json" };

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: JSON_CORS });

/** Registra a falha em `admin_logs`, o painel que o dono abre de verdade. */
async function gritar(detalhe: string, metadata: Record<string, unknown> = {}) {
  console.error("[verify-contact]", detalhe, JSON.stringify(metadata));
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error } = await admin.rpc("registrar_falha_de_edge_function", {
      p_funcao:    "verify-contact",
      p_detalhe:   detalhe,
      p_categoria: "security",
      p_metadata:  metadata,
    });
    if (error) console.error("[verify-contact] nao consegui registrar a falha:", error.message);
  } catch (e) {
    console.error("[verify-contact] nao consegui registrar a falha:", e);
  }
}

/**
 * Pergunta ao Cloudflare se o token vale.
 *
 * Devolve `"ok"`, `"recusado"` ou `"indisponivel"` — três estados, e não um
 * booleano, porque "o Cloudflare disse não" e "o Cloudflare não respondeu"
 * levam a decisões OPOSTAS. Um booleano obrigaria quem chama a escolher um dos
 * dois erros para o caso ambíguo, que é como nasce fallback silencioso (§4).
 */
async function conferirNoCloudflare(token: string): Promise<"ok" | "recusado" | "indisponivel"> {
  try {
    const corpo = new FormData();
    corpo.append("secret", TURNSTILE_SECRET);
    corpo.append("response", token);
    const resp = await fetch(SITEVERIFY, {
      method: "POST",
      body: corpo,
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      await gritar(`Turnstile respondeu HTTP ${resp.status} — captcha nao esta sendo conferido`);
      return "indisponivel";
    }
    const r = await resp.json();
    if (r?.success === true) return "ok";

    const codigos: string[] = Array.isArray(r?.["error-codes"]) ? r["error-codes"] : [];
    // `invalid-input-secret` e `missing-input-secret` NÃO são "o visitante
    // falhou": são a NOSSA configuração quebrada, e nesse estado ninguém mais
    // consegue mandar mensagem. Tem que gritar, senão o canal fecha em
    // silêncio — que é o §1.5 na letra.
    if (codigos.some((c) => c === "invalid-input-secret" || c === "missing-input-secret")) {
      await gritar(
        "TURNSTILE_SECRET_KEY invalida ou ausente — o formulario de contato esta recusando TODO MUNDO",
        { codigos });
      return "indisponivel";
    }
    return "recusado";
  } catch (e) {
    await gritar(`nao consegui falar com o Turnstile: ${e instanceof Error ? e.message : String(e)}`);
    return "indisponivel";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Metodo nao permitido" }, 405);

  let body: {
    token?: string; nome?: string; email?: string; assunto?: string; mensagem?: string;
  };
  try { body = await req.json(); }
  catch { return responder({ error: "Payload invalido" }, 400); }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < TOKEN_MIN || token.length > TOKEN_MAX) {
    // Sem gritar: um token ausente é o caso normal de quem bate na porta sem
    // passar pelo formulário. Marcar isso como falha encheria a trilha de ruído
    // e ensinaria a ignorar o canal (§0.2, 4a regra) — foi exatamente o que
    // aconteceu com o `edge_function_error` da send-email em 27/08.
    return responder({ error: "Confirme que voce nao e um robo antes de enviar." }, 400);
  }

  if (!TURNSTILE_SECRET) {
    // Sem secret não há verificação possível. A escolha aqui é a MESMA da
    // indisponibilidade do Cloudflare — a mensagem passa —, porque o canal de
    // quem está trancado para fora não pode depender de uma configuração que
    // ninguém percebeu que sumiu. Mas grita alto: é a nossa config quebrada.
    await gritar("TURNSTILE_SECRET_KEY nao configurado — nenhum captcha esta sendo conferido");
  } else {
    const veredito = await conferirNoCloudflare(token);
    if (veredito === "recusado") {
      return responder({ error: "Nao foi possivel confirmar o captcha. Tente novamente." }, 403);
    }
    // "indisponivel" segue adiante de propósito — ver a decisão 1 no topo.
  }

  // Quem mandou, SE estava logado. O `functions.invoke` do supabase-js manda a
  // anon key quando não há sessão, e aí `getUser()` simplesmente não devolve
  // usuário — isso NÃO é erro, é o caso normal deste formulário.
  //
  // O id vem daqui e não do corpo da requisição: derivado de um JWT que o
  // próprio Supabase valida, ele não é forjável. Se viesse do cliente, qualquer
  // um assinaria uma mensagem com o nome de outra pessoa.
  let autorId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    try {
      const comoVisitante = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await comoVisitante.auth.getUser();
      autorId = user?.id ?? null;
    } catch { /* anon key ou token expirado: segue como anônimo */ }
  }

  if (!SERVICE_ROLE) {
    await gritar("SUPABASE_SERVICE_ROLE_KEY ausente — nenhuma mensagem de contato esta sendo gravada");
    return responder({ error: "Nao foi possivel enviar agora. Tente novamente mais tarde." }, 503);
  }

  // A RPC continua sendo a dona de TODA regra de conteúdo: tamanho, assunto,
  // teto por e-mail e disjuntor. Esta função não repete nenhuma — repetir
  // criaria a segunda fonte de verdade que o §4 proíbe, e as duas divergiriam.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { error } = await admin.rpc("enviar_mensagem_de_contato", {
    p_nome:      body.nome ?? "",
    p_email:     body.email ?? "",
    p_assunto:   body.assunto ?? "",
    p_mensagem:  body.mensagem ?? "",
    p_author_id: autorId,
  });

  if (error) {
    // As mensagens da RPC já vêm em português e explicando o caso ("Escreva
    // pelo menos 20 caracteres…"). Trocar por um "erro ao enviar" genérico
    // mandaria a pessoa adivinhar qual dos seis limites ela esbarrou (§1.5).
    return responder({ error: error.message }, 400);
  }

  return responder({ ok: true });
});
