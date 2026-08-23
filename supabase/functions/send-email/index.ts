// send-email — Auth Hook do Supabase (GoTrue chama esta função para enviar
// confirmação de cadastro, recuperação de senha, troca de email e magic link).
//
// ============================================================================
// POR QUE ESTA VERSÃO EXISTE — duas coisas erradas, uma grave
// ============================================================================
//
// 1. BRECHA (grave). A função é pública (`verify_jwt: false`, como todo auth
//    hook precisa ser) e NÃO conferia quem estava chamando. Provado com um
//    `curl` de fora, sem credencial nenhuma:
//
//      curl -X POST .../send-email -d '{"user":{"email":"alvo@x.com"},
//        "email_data":{"token_hash":"...","email_action_type":"recovery"}}'
//      -> HTTP 200, e o email de "Redefinir Senha" chegou no alvo.
//
//    Ou seja: qualquer pessoa na internet mandava email com a marca do
//    GamerHub para qualquer endereço. Três estragos, do menor para o pior:
//    incômodo (spam em nome do site), engenharia social (a vítima recebe um
//    "redefina sua senha" legítimo que não pediu), e — o que derruba o site —
//    queimar a cota de ~500 envios/dia do Gmail, ou fazer o Google travar a
//    conta por abuso. Nos dois últimos casos NINGUÉM MAIS SE CADASTRA.
//
//    Correção: assinatura Standard Webhooks, que é como o Supabase assina o
//    hook. Sem `webhook-signature` válida, a função não envia nada.
//
// 2. SILÊNCIO (CLAUDE.md §1.5, fonte nº 7). Toda falha ia para `console.error`.
//    Se o Google travar a conta, a senha de app expirar ou o secret ficar
//    errado, o cadastro para de funcionar e o dono só descobre quando alguém
//    reclamar. Agora tudo grita em `admin_logs` — o painel que ele já olha.
//
// ============================================================================
// O QUE PRECISA ESTAR CONFIGURADO
// ============================================================================
//
//   SEND_EMAIL_HOOK_SECRET  — o mesmo segredo que aparece em
//                             Authentication -> Hooks -> Send Email Hook.
//                             Formato `v1,whsec_...` (cola como está).
//   GMAIL_USER / GMAIL_APP_PASSWORD
//
// Sem o secret a função RECUSA tudo e grita. É proposital: preferir cadastro
// parado e barulhento a hook aberto e silencioso. Ao chamador sai sempre o
// mesmo 401, para não contar de fora qual é o estado da configuração.

import nodemailer from "npm:nodemailer@6";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getEmailContent, buildEmail } from "./email-template.ts";

const GMAIL_USER         = Deno.env.get("GMAIL_USER") ?? "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const HOOK_SECRET        = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// URL da aplicacao - sempre aponta para producao
const APP_URL = "https://gamerhub-nine.vercel.app";

// Janela de tolerância do carimbo de tempo. Sem isso, uma requisição assinada
// capturada hoje poderia ser repetida para sempre (replay).
const TOLERANCIA_SEGUNDOS = 5 * 60;

/**
 * Registra a falha em `admin_logs`, que é o painel que o dono abre.
 * Nunca deixa a própria falha do log derrubar a função — se o banco também
 * estiver fora, ainda resta o `console.error`.
 */
async function gritar(detalhe: string, metadata: Record<string, unknown> = {}) {
  console.error("[send-email]", detalhe, JSON.stringify(metadata));
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error } = await admin.rpc("registrar_falha_de_edge_function", {
      p_funcao:    "send-email",
      p_detalhe:   detalhe,
      p_categoria: "system",
      p_metadata:  metadata,
    });
    if (error) console.error("[send-email] nao consegui registrar a falha:", error.message);
  } catch (e) {
    console.error("[send-email] nao consegui registrar a falha:", e);
  }
}

/** `v1,whsec_BASE64` ou `whsec_BASE64` -> os bytes da chave. */
function bytesDoSegredo(bruto: string): Uint8Array {
  const base64 = bruto.replace(/^v1,/, "").replace(/^whsec_/, "");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Comparação em tempo constante — `===` em string vaza o tamanho do prefixo. */
function igualSemVazarTempo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Standard Webhooks, que é o formato que o Supabase usa no auth hook:
 * assina `${id}.${timestamp}.${corpo}` com HMAC-SHA256 e manda em
 * `webhook-signature` como uma lista de `v1,<base64>` separada por espaço
 * (mais de uma quando o segredo está sendo rotacionado).
 *
 * Devolve `null` quando está tudo certo, ou o motivo da recusa.
 */
async function motivoParaRecusar(req: Request, corpo: string): Promise<string | null> {
  const id        = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const assinatura = req.headers.get("webhook-signature");

  if (!id || !timestamp || !assinatura) return "requisicao sem cabecalhos de assinatura";
  if (!HOOK_SECRET) return "SEND_EMAIL_HOOK_SECRET nao configurado";

  const agora = Math.floor(Date.now() / 1000);
  const t = Number(timestamp);
  if (!Number.isFinite(t)) return "carimbo de tempo invalido";
  if (Math.abs(agora - t) > TOLERANCIA_SEGUNDOS) return "carimbo de tempo fora da janela";

  let chave: CryptoKey;
  try {
    chave = await crypto.subtle.importKey(
      "raw", bytesDoSegredo(HOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
  } catch {
    return "SEND_EMAIL_HOOK_SECRET malformado (esperado v1,whsec_<base64>)";
  }

  const mac = await crypto.subtle.sign(
    "HMAC", chave, new TextEncoder().encode(`${id}.${timestamp}.${corpo}`),
  );
  const esperada = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Pode vir mais de uma assinatura (rotação de segredo). Basta uma bater.
  const bate = assinatura.split(" ")
    .map((p) => p.split(",")[1] ?? "")
    .some((s) => igualSemVazarTempo(s, esperada));

  return bate ? null : "assinatura invalida";
}

// Resposta única para toda recusa: contar de fora QUAL foi o motivo entrega de
// graça o estado da configuração a quem está sondando. O motivo de verdade vai
// para `admin_logs`.
const RECUSADO = () => new Response(
  JSON.stringify({ error: "Nao autorizado" }),
  { status: 401, headers: { "Content-Type": "application/json" } },
);

Deno.serve(async (req: Request) => {
  const rawBody = await req.text();

  const recusa = await motivoParaRecusar(req, rawBody);
  if (recusa) {
    await gritar(`chamada recusada: ${recusa}`, {
      motivo: recusa,
      // Ajuda a distinguir varredura da internet de hook mal configurado.
      tem_cabecalho_de_assinatura: !!req.headers.get("webhook-signature"),
    });
    return RECUSADO();
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await gritar("payload invalido: nao e JSON");
    return new Response(JSON.stringify({ error: "Payload invalido" }), { status: 400 });
  }

  const user      = payload.user      as Record<string, string>;
  const emailData = payload.email_data as Record<string, string>;

  const token_hash        = emailData?.token_hash ?? "";
  const verification_type = emailData?.email_action_type ?? emailData?.verification_type ?? emailData?.type ?? "signup";

  if (!user?.email) {
    await gritar("payload sem user.email", { tipo: verification_type });
    return new Response(JSON.stringify({ error: "Payload invalido" }), { status: 400 });
  }

  const actionUrl = `${APP_URL}/auth/confirm?token_hash=${token_hash}&type=${verification_type}&redirect_to=%2F`;

  // O `token_hash` NÃO entra no log: ele é a credencial de uso único que
  // confirma a conta ou troca a senha. Logar a URL inteira era guardar uma
  // chave de acesso em texto puro no log da função.
  console.log("[send-email] enviando para", user.email, "| tipo:", verification_type);

  const { subject, title, message, buttonText } = getEmailContent(verification_type);
  const html = buildEmail({ title, message, buttonText, actionUrl, userEmail: user.email });

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    await gritar("GMAIL_USER ou GMAIL_APP_PASSWORD nao configurado — NINGUEM consegue se cadastrar nem recuperar senha",
      { tipo: verification_type });
    return new Response(JSON.stringify({ error: "Credenciais SMTP nao configuradas" }), { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `GamerHub <${GMAIL_USER}>`,
      to: user.email,
      subject,
      html,
    });
    console.log("[send-email] enviado com sucesso para", user.email);
    return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    // A falha mais provável aqui é a conta do Google: senha de app revogada,
    // conta travada por envio automatizado, ou cota diária estourada. Todas
    // travam a porta de entrada do site, e nenhuma avisa sozinha.
    await gritar(`SMTP recusou o envio: ${err instanceof Error ? err.message : String(err)}`,
      { tipo: verification_type });
    return new Response(JSON.stringify({ error: "Falha ao enviar email" }), { status: 500 });
  }
});
