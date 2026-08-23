// Extraído do index.ts em 23/08/2026: com o HTML junto, o arquivo passava de
// 400 linhas e a lógica de segurança (verificação de assinatura) ficava
// enterrada embaixo de tabela de email. §4 do CLAUDE.md.
//
// Aqui só tem texto e marcação. Nada decide nada.

export function getEmailContent(type: string) {
  switch (type) {
    case "signup":
      return {
        subject: "Confirme seu email - GamerHub",
        title: "Confirmar Email",
        message: "Voce esta quase la! Clique no botao abaixo para confirmar seu email e ativar sua conta no GamerHub.",
        buttonText: "// CONFIRMAR EMAIL"
      };
    case "recovery":
      return {
        subject: "Redefinir senha - GamerHub",
        title: "Redefinir Senha",
        message: "Recebemos uma solicitacao para redefinir sua senha. Se nao foi voce, ignore este email.",
        buttonText: "// REDEFINIR SENHA"
      };
    case "email_change":
      return {
        subject: "Confirme seu novo email - GamerHub",
        title: "Novo Email",
        message: "Confirme o novo endereco de email associado a sua conta no GamerHub.",
        buttonText: "// CONFIRMAR NOVO EMAIL"
      };
    case "magiclink":
      return {
        subject: "Seu link de acesso - GamerHub",
        title: "Acessar GamerHub",
        message: "Clique no botao abaixo para entrar no GamerHub. Este link expira em 24 horas.",
        buttonText: "// ENTRAR AGORA"
      };
    default:
      return {
        subject: "Confirme seu email - GamerHub",
        title: "Confirmar Email",
        message: "Voce esta quase la! Clique no botao abaixo para confirmar seu email e ativar sua conta no GamerHub.",
        buttonText: "// CONFIRMAR EMAIL"
      };
  }
}

export function buildEmail({
  title, message, buttonText, actionUrl, userEmail
}: {
  title: string; message: string; buttonText: string; actionUrl: string; userEmail: string;
}) {
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
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090f" style="background-color:#09090f;min-height:100vh;">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="100%" style="max-width:500px;" cellpadding="0" cellspacing="0">
        <tr><td align="center" style="padding-bottom:36px;">
          <span style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#39ff14;">GAMER</span>
          <span style="font-size:26px;font-weight:bold;letter-spacing:4px;color:#ffffff;">HUB</span>
          <p style="margin:8px 0 0;font-size:10px;color:#3a3a5c;letter-spacing:3px;text-transform:uppercase;">// Sua base de operacoes gamer</p>
        </td></tr>
        <tr><td bgcolor="#0f0f1a" style="background-color:#0f0f1a;border:1px solid #1a1a2e;border-radius:12px;padding:40px 36px;">
          <p style="margin:0 0 6px;font-size:10px;color:#39ff14;letter-spacing:3px;text-transform:uppercase;">// GamerHub</p>
          <h1 style="margin:0 0 24px;font-size:22px;color:#ffffff;font-weight:bold;">${title}</h1>
          <div style="height:1px;background:linear-gradient(90deg,#39ff1430,#39ff1410,transparent);margin-bottom:24px;"></div>
          <p style="margin:0 0 32px;font-size:14px;color:#8b8ba7;line-height:1.8;">${message}</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${actionUrl}" style="display:inline-block;background-color:#39ff14;color:#000000;font-family:'Courier New',Courier,monospace;font-weight:bold;font-size:12px;letter-spacing:2px;text-decoration:none;padding:15px 36px;border-radius:6px;">${buttonText}</a>
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:#3a3a5c;text-align:center;">Este link expira em 24 horas.</p>
          <div style="margin-top:28px;padding:14px;background-color:#0a0a12;border:1px solid #1a1a2e;border-radius:6px;">
            <p style="margin:0 0 6px;font-size:10px;color:#3a3a5c;">// SE O BOTAO NAO FUNCIONAR:</p>
            <p style="margin:0;font-size:11px;color:#39ff1460;word-break:break-all;">${actionUrl}</p>
          </div>
        </td></tr>
        <tr><td align="center" style="padding-top:28px;">
          <p style="margin:0;font-size:10px;color:#1e1e30;">// GamerHub v1.0 - email enviado para ${userEmail}</p>
          <p style="margin:6px 0 0;font-size:10px;color:#1e1e30;">Nao solicitou isso? Ignore este email com seguranca.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
