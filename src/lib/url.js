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

/**
 * Saneamento do outro lado: um caminho DENTRO deste site, vindo da URL.
 *
 * ── Por que ele existe ──────────────────────────────────────────────────────
 *
 * Os links dos documentos legais abrem em **aba nova** de propósito — sem isso,
 * clicar em "Termos de Uso" no meio do cadastro faria a pessoa perder tudo que
 * digitou. O efeito colateral é que a aba nova nasce **sem histórico**, e aí
 * "Voltar" não tem para onde voltar. A origem viaja num `?de=` na URL.
 *
 * ── E por que ele precisa ser DESCONFIADO ───────────────────────────────────
 *
 * `?de=` é entrada de usuário: qualquer pessoa monta
 * `gamerhub/termos?de=<qualquer coisa>` e manda o link para alguém. Um botão
 * "Voltar" que obedecesse cegamente seria **redirecionamento aberto** — a
 * vítima confere o domínio (é o nosso), clica em Voltar, e cai num site de
 * phishing com a nossa cara. É a mesma família do XSS que originou
 * `safeExternalUrl`, e por isso mora no mesmo arquivo.
 *
 * A armadilha específica é `//`: `//evil.com` **não é um caminho**, é uma URL
 * relativa a protocolo, e o navegador a lê como HOST. `/\evil.com` também —
 * navegadores tratam a contrabarra como barra aqui. Os dois começam com `/` e
 * passariam por uma checagem ingênua.
 *
 * @param {unknown} valor o `?de=` já decodificado pelo `URLSearchParams`
 * @returns {string|null} o caminho, se for interno; `null` caso contrário.
 */
export function caminhoInternoSeguro(valor) {
  if (typeof valor !== 'string') return null;
  const bruto = valor.trim();
  // Uma barra, e a segunda posição não pode ser barra nem contrabarra.
  if (!/^\/(?![/\\])/.test(bruto)) return null;
  // Caractere de controle (`\n`, `\t`, `\0`) é usado para partir a análise de
  // quem lê a URL depois. Nenhuma rota deste site tem um.
  // eslint-disable-next-line no-control-regex -- é exatamente o que se procura
  if (/[\u0000-\u001f\u007f]/.test(bruto)) return null;
  // Decodificar de novo pega `/%2f%2fevil.com`, que já chega aqui como `//…`
  // em alguns caminhos e como texto escapado em outros.
  let decodificado;
  try {
    decodificado = decodeURIComponent(bruto);
  } catch {
    return null; // `%` solto: entrada quebrada, não caminho.
  }
  if (!/^\/(?![/\\])/.test(decodificado)) return null;
  return bruto;
}

/**
 * Acrescenta a um link a informação de PARA ONDE VOLTAR depois.
 *
 * Só faz sentido em link que abre em aba nova: a aba nasce sem histórico, e sem
 * isto o "Voltar" da página de destino não tem para onde ir (ver
 * `components/conteudo/BotaoVoltar.jsx`).
 *
 * Se a origem não for um caminho interno válido, o link sai **sem** o `?de=` —
 * e o destino cai no comportamento padrão. Nunca se escreve na URL um valor que
 * o próprio site recusaria ao ler de volta.
 *
 * @param {string} caminho o destino (uma rota deste site)
 * @param {string} origem  de onde a pessoa está saindo (`pathname + search`)
 */
export function comVoltaPara(caminho, origem) {
  if (!caminhoInternoSeguro(origem)) return caminho;
  return `${caminho}${caminho.includes('?') ? '&' : '?'}de=${encodeURIComponent(origem)}`;
}
