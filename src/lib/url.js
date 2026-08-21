// Saneamento de URL vinda de dado de usuário.
//
// Motivo (falha real encontrada na auditoria de ago/2026): `getEmbedInfo` devolvia
// `{type:'link'}` para QUALQUER string, então `javascript:alert(...)` passava pela
// validação do PostForm e era renderizado como `<a href={url}>` no EmbedPlayer.
// Qualquer pessoa que clicasse no link de um post executava script na origem do
// site — com o token de sessão do Supabase acessível no localStorage.
//
// Regra: só `http:` e `https:` viram href. Todo o resto (javascript:, data:,
// vbscript:, file:, blob:, string que nem é URL) é descartado.

const SAFE_PROTOCOLS = ['http:', 'https:'];

/**
 * @param {unknown} url
 * @returns {string|null} a URL se for http(s); `null` caso contrário.
 */
export function safeExternalUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    // `new URL` resolve escapes e variações de caixa/espaço que um regex
    // ingênuo deixaria passar (ex.: "JaVaScRiPt:", "java\tscript:").
    const parsed = new URL(trimmed);
    return SAFE_PROTOCOLS.includes(parsed.protocol) ? trimmed : null;
  } catch {
    // Sem protocolo (ex.: "youtube.com/x") ou string inválida: não é link
    // externo confiável. Não tentamos "consertar" prefixando https:// —
    // adivinhar intenção em entrada não confiável é como brecha nasce.
    return null;
  }
}

/** `true` se a URL é segura para virar href. */
export function isSafeExternalUrl(url) {
  return safeExternalUrl(url) !== null;
}
