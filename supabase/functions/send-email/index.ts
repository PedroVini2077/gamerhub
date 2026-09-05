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
//   GMAIL_USER / GMAIL_APP_PASSWORD   — o caminho de HOJE (Gmail)
//
//   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS   — o caminho GENERICO.
//     `[05/09]` Se `SMTP_HOST` existir, ele vence. Foi assim, e nao trocando o
//     Gmail de lugar, porque isso torna a migracao uma acao de PAINEL: o dono
//     cola quatro segredos e o proximo e-mail ja sai pelo provedor novo, sem
//     deploy, sem coordenar horario, e com o caminho antigo intacto para
//     voltar apagando um segredo. Mudanca aditiva (§7): o caminho feliz de
//     hoje continua identico enquanto SMTP_HOST nao existir.
//
// Sem o secret a função RECUSA tudo e grita. É proposital: preferir cadastro
// parado e barulhento a hook aberto e silencioso. Ao chamador sai sempre o
// mesmo 401, para não contar de fora qual é o estado da configuração.

import nodemailer from "npm:nodemailer@6";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getEmailContent, buildEmail } from "./email-template.ts";

const GMAIL_USER         = Deno.env.get("GMAIL_USER") ?? "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const SMTP_HOST          = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT          = Number(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_USER          = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS          = Deno.env.get("SMTP_PASS") ?? "";
// De quem o e-mail PARECE vir. No Gmail e obrigatoriamente a propria conta —
// provedor nenhum deixa remetente arbitrario. Num relay (Brevo, Resend) o
// remetente e verificado la, e pode ser diferente do usuario de login.
const SMTP_FROM          = Deno.env.get("SMTP_FROM") ?? SMTP_USER;
const HOOK_SECRET        = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// URL da aplicacao - sempre aponta para producao
const APP_URL = "https://gamerhub-nine.vercel.app";

// Janela de tolerância do carimbo de tempo. Sem isso, uma requisição assinada
// capturada hoje poderia ser repetida para sempre (replay).
const TOLERANCIA_SEGUNDOS = 5 * 60;

// ---------------------------------------------------------------------------
// SEVERIDADE — recusar estranho é a função FUNCIONANDO
//
// Em 27/08 os números mostraram que `edge_function_error` tinha virado a 2ª
// ação mais frequente da trilha inteira, com 68 de 68 sendo "chamada recusada"
// e nenhuma sendo falha de verdade. Todas daqui. E entravam como `critical` —
// mentira: a função recusou um estranho, que é o trabalho dela. Uma falha real
// (Google travou a conta, cadastro parado) chegaria num canal já cheio de ruído.
//
// O critério abaixo é FATO, não palpite: **o GoTrue sempre assina, e sempre
// manda carimbo de tempo válido.** Se não veio cabeçalho, ou o carimbo está
// fora da janela, não era ele — foi um estranho batendo na porta.
//
// Tudo que NÃO está nesta lista continua `critical`, de propósito. Inclusive
// "assinatura invalida", que é ambígua: pode ser um atacante mandando lixo, ou
// pode ser o secret ERRADO — e nesse caso o cadastro está quebrado em silêncio.
// Na dúvida, grita.
const RECUSAS_DE_ESTRANHO = new Set([
  "requisicao sem cabecalhos de assinatura",
  "carimbo de tempo invalido",
  "carimbo de tempo fora da janela",
]);

/**
 * Registra a falha em `admin_logs`, que é o painel que o dono abre.
 * Nunca deixa a própria falha do log derrubar a função — se o banco também
 * estiver fora, ainda resta o `console.error`.
 *
 * A RPC limita a UMA linha por hora por (função, tipo de falha), então repetir
 * a chamada não enche a trilha.
 */
async function gritar(
  detalhe: string,
  metadata: Record<string, unknown> = {},
  severidade: "critical" | "warning" = "critical",
) {
  console.error("[send-email]", detalhe, JSON.stringify(metadata));
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error } = await admin.rpc("registrar_falha_de_edge_function", {
      p_funcao:     "send-email",
      p_detalhe:    detalhe,
      p_categoria:  "system",
      p_metadata:   metadata,
      p_severidade: severidade,
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
/**
 * `[05/09]` O corpo tem cara de chamada REAL do GoTrue?
 *
 * É o discriminador que faltava para a severidade parar de mentir. Ver o bloco
 * SEVERIDADE lá em cima: "assinatura invalida" é produzida por DOIS eventos
 * muito diferentes — um estranho batendo na porta (comum, inofensivo) e o
 * `SEND_EMAIL_HOOK_SECRET` errado (raro, fatal) —, e a função não tinha como
 * separar os dois.
 *
 * O corpo separa: o GoTrue só chama esta função quando existe alguém para
 * receber e-mail, então ele SEMPRE manda `user.email` e `email_data`. Quem
 * varre a internet não monta isso.
 *
 * **Não é prova, e não pretende ser.** Um atacante pode montar um corpo
 * parecido — e aí `critical` é a resposta certa mesmo, porque alguém que sabe
 * o formato do payload não é varredura de porta.
 */
function pareceChamadaDoGoTrue(corpo: string): boolean {
  try {
    const p = JSON.parse(corpo) as Record<string, any>;
    return typeof p?.user?.email === "string" && typeof p?.email_data === "object";
  } catch {
    return false;
  }
}

const RECUSADO = () => new Response(
  JSON.stringify({ error: "Nao autorizado" }),
  { status: 401, headers: { "Content-Type": "application/json" } },
);

Deno.serve(async (req: Request) => {
  const rawBody = await req.text();

  const recusa = await motivoParaRecusar(req, rawBody);
  if (recusa) {
    // `[05/09]` A severidade parou de ser decidida SÓ pelo motivo.
    //
    // Medido em 05/09: `edge_function_error` era a 5ª ação mais frequente da
    // trilha inteira — 72 eventos em 7 dias, SEMPRE EM PARES no mesmo segundo.
    // A origem era o nosso próprio portão `e2e/portas-fechadas.mjs`, e metade
    // entrava como `critical`. Alarme que grita todo dia por causa do CI ensina
    // a ignorar o nível onde a falha real vai aparecer (§0.2, 4ª regra).
    //
    // A saída óbvia — deixar o teste se identificar por um cabeçalho — é uma
    // BRECHA: cabeçalho é controlado por quem chama, então qualquer atacante
    // mandaria o mesmo e apagaria o próprio rastro. O corpo não resolve isso
    // sozinho, mas move a barra para bem mais alto: é preciso conhecer o
    // formato do payload do GoTrue, o que já não é varredura de porta.
    const pareceReal = pareceChamadaDoGoTrue(rawBody);
    const severidade = RECUSAS_DE_ESTRANHO.has(recusa) || !pareceReal
      ? "warning" as const
      : "critical" as const;

    await gritar(
      `chamada recusada: ${recusa}`,
      {
        motivo: recusa,
        // Ajuda a distinguir varredura da internet de hook mal configurado.
        tem_cabecalho_de_assinatura: !!req.headers.get("webhook-signature"),
        // A razão da severidade fica GRAVADA, não só decidida: quem abrir a
        // linha daqui a seis meses precisa saber por que ela é warning.
        corpo_parece_gotrue: pareceReal,
      },
      severidade,
    );
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

  // Qual caminho vale, e a regra e uma so: SMTP_HOST presente vence.
  //
  // Sem `else if` encadeado e sem "tenta um, se falhar tenta o outro" — cair
  // para o outro provedor quando o primeiro recusa esconderia justamente o que
  // precisa gritar (cota estourada, senha revogada). Um caminho, escolhido pela
  // configuracao, e a falha dele e a falha (§1.5).
  const usandoRelay = Boolean(SMTP_HOST);
  const remetente   = usandoRelay ? SMTP_FROM : GMAIL_USER;
  const faltando    = usandoRelay
    ? [!SMTP_USER && "SMTP_USER", !SMTP_PASS && "SMTP_PASS", !SMTP_FROM && "SMTP_FROM"]
    : [!GMAIL_USER && "GMAIL_USER", !GMAIL_APP_PASSWORD && "GMAIL_APP_PASSWORD"];
  const ausentes    = faltando.filter(Boolean);

  if (ausentes.length > 0) {
    await gritar(
      `${ausentes.join(" e ")} nao configurado — NINGUEM consegue se cadastrar `
      + `nem recuperar senha (caminho: ${usandoRelay ? `relay ${SMTP_HOST}` : "gmail"})`,
      { tipo: verification_type, caminho: usandoRelay ? "relay" : "gmail" });
    return new Response(JSON.stringify({ error: "Credenciais SMTP nao configuradas" }), { status: 500 });
  }

  const transporter = usandoRelay
    ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      // 465 é TLS implícito; 587 começa em claro e sobe com STARTTLS. Deixar
      // `secure: true` na 587 faz o handshake travar sem mensagem útil.
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
    : nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

  try {
    await transporter.sendMail({
      from: `GamerHub <${remetente}>`,
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
    await gritar(
      `SMTP recusou o envio (${usandoRelay ? `relay ${SMTP_HOST}` : "gmail"}): `
      + `${err instanceof Error ? err.message : String(err)}`,
      { tipo: verification_type, caminho: usandoRelay ? "relay" : "gmail" });
    return new Response(JSON.stringify({ error: "Falha ao enviar email" }), { status: 500 });
  }
});
