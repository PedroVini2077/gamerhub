// O e-mail de resposta ao formulário de contato.
//
// Mesma linguagem visual do `send-email/email-template.ts` — tabela, fundo
// escuro, monoespaçada, verde neon —, mas SEM botão: aqui não há ação para
// clicar, e um botão para lugar nenhum é enfeite que ainda por cima parece
// phishing.

/**
 * Escapa para HTML. Não é zelo extra: a `mensagemOriginal` foi digitada por
 * qualquer pessoa da internet no formulário público, e o e-mail é HTML. Sem
 * isto, um `<script>` ou uma tag quebrada iria inteira para a caixa de entrada
 * de quem escreveu — e para o cliente de e-mail interpretar.
 */
const seguro = (t: string) =>
  String(t ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Quebra de linha vira `<br>` DEPOIS do escape, senão o escape comeria a tag. */
const comQuebras = (t: string) => seguro(t).replace(/\n/g, "<br>");

export function montarEmailDeResposta({
  nome, resposta, mensagemOriginal,
}: { nome: string; resposta: string; mensagemOriginal: string }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>GamerHub</title>
</head>
<body style="margin:0;padding:0;background-color:#09090f;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090f" style="background-color:#09090f;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

        <tr><td align="center" style="padding-bottom:36px;">
          <span style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#39ff14;">GAMER</span>
          <span style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#ffffff;">HUB</span>
          <p style="margin:8px 0 0;font-size:10px;color:#3a3a5c;letter-spacing:3px;text-transform:uppercase;">// Sua base de operacoes gamer</p>
        </td></tr>

        <tr><td bgcolor="#0f0f1a" style="background-color:#0f0f1a;border:1px solid #1a1a2e;border-radius:12px;padding:40px 36px;">
          <p style="margin:0 0 6px;font-size:10px;color:#39ff14;letter-spacing:3px;text-transform:uppercase;">// Resposta da equipe</p>
          <h1 style="margin:0 0 24px;font-size:22px;color:#ffffff;font-weight:bold;">Oi, ${seguro(nome)}</h1>
          <div style="height:1px;background:linear-gradient(90deg,#39ff1430,#39ff1410,transparent);margin-bottom:24px;"></div>

          <p style="margin:0 0 28px;font-size:14px;color:#c8c8dc;line-height:1.8;">${comQuebras(resposta)}</p>

          <p style="margin:0 0 8px;font-size:10px;color:#3a3a5c;letter-spacing:2px;text-transform:uppercase;">// O que voce escreveu</p>
          <div style="border-left:2px solid #1a1a2e;padding:2px 0 2px 14px;">
            <p style="margin:0;font-size:12px;color:#6b6b85;line-height:1.7;font-style:italic;">${comQuebras(mensagemOriginal)}</p>
          </div>
        </td></tr>

        <tr><td align="center" style="padding-top:28px;">
          <p style="margin:0;font-size:11px;color:#3a3a5c;line-height:1.8;">
            Voce recebeu este e-mail porque escreveu para a equipe pelo formulario<br>
            de contato do GamerHub. Para falar de novo, e so responder por la.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
