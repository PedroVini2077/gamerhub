// responder-contato — a equipe responde uma mensagem do formulário público, e
// a resposta sai por e-mail com a cara do site.
//
// ============================================================================
// POR QUE ESTA FUNÇÃO EXISTE
// ============================================================================
//
// O status `answered` existia desde 02/09 e **nada no sistema enviava resposta
// nenhuma**. O dono percebeu testando: *"como vou clicar no respondido sendo
// que não tem como responder nada?"*. Era um carimbo afirmando um ato que o
// sistema nunca executou — e, pior, quem abrisse o painel depois não conseguia
// distinguir "respondi por fora" de "cliquei sem responder" (§1.5).
//
// ============================================================================
// A ORDEM DAS TRÊS ETAPAS É O PONTO
// ============================================================================
//
//   1. perguntar ao banco PARA QUEM é (e se quem pede é da equipe)
//   2. ENVIAR o e-mail
//   3. só então REGISTRAR que foi respondida
//
// Inverter 2 e 3 reproduziria exatamente o defeito que esta função conserta: o
// painel diria "respondida" com o envio tendo falhado. Se a etapa 3 falhar
// depois de o e-mail ter saído, isso vai para `admin_logs` — é o único caso em
// que o sistema fica sabendo mais do que a tela mostra, e ele grita.
//
// ============================================================================
// SEGURANÇA
// ============================================================================
//
// A checagem de equipe NÃO mora aqui: as duas RPCs são `SECURITY DEFINER` com
// `is_staff()` por dentro, e esta função as chama COM A CREDENCIAL DE QUEM
// PEDIU. Ou seja, mesmo que alguém descubra a URL e mande um POST com um JWT de
// usuário comum, o banco recusa. Uma checagem só aqui seria a porta decorativa
// que a `moderate-links` tinha em 23/08 (§1.3).
//
// E a cota: o envio passa pelo mesmo Gmail do cadastro e da recuperação de
// senha (~500/dia). Resposta de contato é rara, então o volume não é o risco —
// o risco é a conta do Google travar, e por isso a falha de SMTP grita
// (§0.2, regra 3).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";
import { montarEmailDeResposta } from "./modelo.ts";

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON      = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GMAIL_USER         = Deno.env.get("GMAIL_USER") ?? "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const JSON_CORS = { ...CORS, "Content-Type": "application/json" };
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: JSON_CORS });

async function gritar(detalhe: string, metadata: Record<string, unknown> = {}) {
  console.error("[responder-contato]", detalhe, JSON.stringify(metadata));
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.rpc("registrar_falha_de_edge_function", {
      p_funcao: "responder-contato", p_detalhe: detalhe,
      p_categoria: "moderation", p_metadata: metadata,
    });
  } catch (e) {
    console.error("[responder-contato] nao consegui registrar a falha:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Metodo nao permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return responder({ error: "Nao autorizado" }, 401);

  let body: { id?: string; texto?: string };
  try { body = await req.json(); }
  catch { return responder({ error: "Payload invalido" }, 400); }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (!id) return responder({ error: "Informe qual mensagem esta sendo respondida." }, 400);
  // A FAIXA INTEIRA, e o teto importa mais do que o piso — descoberto quando o
  // dono perguntou se texto muito grande quebrava alguma coisa.
  //
  // O `CHECK` da coluna recusa acima de 4000. Sem conferir aqui, um texto de
  // 5000 passaria pelas etapas 1 e 2 — ou seja, **o e-mail sairia** — e só a
  // etapa 3 recusaria, caindo no pior caminho que esta função tem: "enviado mas
  // não registrado". O `maxLength` do textarea não conta como proteção: a função
  // é chamável direto (§1.3).
  if (texto.length < 10 || texto.length > 4000) {
    return responder({ error: "A resposta precisa ter entre 10 e 4000 caracteres." }, 400);
  }

  // Cliente COM a credencial de quem pediu: é o que faz o `is_staff()` das RPCs
  // valer de verdade. Trocar por `service_role` aqui abriria a função para
  // qualquer usuário logado.
  const comoQuemPediu = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  // ── 1. Para quem é, e quem pede tem direito? ───────────────────────────────
  const { data: dados, error: erroDados } =
    await comoQuemPediu.rpc("contato_dados_para_resposta", { p_id: id });
  if (erroDados) return responder({ error: erroDados.message }, 403);

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    await gritar("GMAIL_USER ou GMAIL_APP_PASSWORD nao configurado — nenhuma resposta de contato esta saindo");
    return responder({ error: "O envio de e-mail nao esta configurado. A resposta NAO foi enviada." }, 500);
  }

  // ── 2. O e-mail sai ANTES de qualquer gravação ─────────────────────────────
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: `GamerHub <${GMAIL_USER}>`,
      to: dados.email,
      subject: "Resposta da equipe do GamerHub",
      html: montarEmailDeResposta({
        nome: dados.nome, resposta: texto, mensagemOriginal: dados.mensagem,
      }),
    });
  } catch (err) {
    // A falha mais provável é a conta do Google: senha de app revogada, conta
    // travada por envio automatizado, ou cota do dia estourada — e as três
    // travam TAMBÉM o cadastro do site, que usa o mesmo Gmail.
    await gritar(`SMTP recusou a resposta de contato: ${err instanceof Error ? err.message : String(err)}`,
      { contact_id: id });
    return responder({ error: "Nao foi possivel enviar o e-mail. A resposta NAO foi registrada." }, 502);
  }

  // ── 3. Agora sim, o registro ───────────────────────────────────────────────
  const { error: erroRegistro } =
    await comoQuemPediu.rpc("contato_registrar_resposta", { p_id: id, p_texto: texto });
  if (erroRegistro) {
    // O único caso em que o mundo real andou e a tela não sabe. Não dá para
    // "desenviar" um e-mail, então o que resta é gritar bem alto: sem isto, a
    // pessoa receberia a resposta e o painel continuaria pedindo resposta.
    await gritar(
      `E-MAIL ENVIADO mas o registro falhou: ${erroRegistro.message}. `
      + "A pessoa recebeu a resposta e o painel NAO sabe disso.",
      { contact_id: id });
    return responder({
      error: "O e-mail foi enviado, mas nao consegui registrar a resposta no painel. "
           + "Nao responda de novo — confira a trilha de auditoria.",
    }, 500);
  }

  return responder({ ok: true });
});
