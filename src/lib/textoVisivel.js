/**
 * `[10/10]` "Sobrou algum caractere VISÍVEL?" — a pergunta que `trim()` não
 * responde.
 *
 * ── Por que isto existe em JS, quando já existia em SQL ─────────────────────
 *
 * O banco tem `texto_visivel(text)` desde a SEC-046 (19/09), e ele é a
 * autoridade: é por ele que o bônus de perfil é pago e que a conquista
 * `perfil_completo` é registrada.
 *
 * O problema é que o JS media a MESMA coisa com `String(x).trim() !== ''`, e
 * `trim()` só corta branco ASCII. Um perfil preenchido com U+200B contava como
 * completo **na tela** e como vazio **no servidor** — e isso ficou observável
 * no dia em que o desbloqueio passou a ser registrado: o card mostraria
 * "Identidade Completa" concluída e **sem data, para sempre**, porque a RPC
 * nunca registraria nada. Nada estouraria (§1.5).
 *
 * ── A lista é a mesma de propósito, e a deriva é travada ────────────────────
 *
 * Os caracteres abaixo são os que `trim` deixa passar. `conquistaNaoDeriva`
 * compara o COMPORTAMENTO desta função com o da classe reconstruída da
 * `texto_visivel` do SQL — não a grafia, porque a mesma migration pode guardar
 * `\u200b` como escape ou como o caractere já interpretado (lição do
 * `xpSoPagaOQueAparece`).
 */

/**
 * Os invisíveis que sobrevivem a `trim()`.
 *
 * Escritos como escape `\u` e não colados literalmente: caractere invisível no
 * código-fonte é exatamente o tipo de coisa que alguém "limpa" sem perceber.
 */
const INVISIVEIS = new RegExp(
  '['
  + '\\u0009-\\u000d'   // tab, LF, VT, FF, CR
  + '\\u0020'           // espaço comum — o único que `trim` já pegava
  + '\\u0085'           // NEL
  + '\\u00a0'           // NO-BREAK SPACE — o que o Word produz sozinho
  + '\\u1680\\u180e'    // OGHAM SPACE MARK · MONGOLIAN VOWEL SEPARATOR
  + '\\u2000-\\u200f'   // espaços tipográficos + ZERO WIDTH + marcas de direção
  + '\\u2028\\u2029'    // separador de linha e de parágrafo
  + '\\u202a-\\u202f'   // controles de bidi + NARROW NO-BREAK
  + '\\u205f-\\u2064'   // MEDIUM MATHEMATICAL SPACE · WORD JOINER · invisíveis
  + '\\u206a-\\u206f'   // controles de formatação herdados
  + '\\u3000'           // IDEOGRAPHIC SPACE — teclado CJK gera direto
  + '\\ufeff'           // BOM — vem colado em texto copiado de arquivo
  + '\\ufff9-\\ufffb'   // marcas de anotação interlinear
  + ']',
  'gu',
);

/**
 * `true` quando resta ao menos um caractere que a pessoa consegue ver.
 *
 * `null`/`undefined` devolvem `false` — e aqui o `false` **é** a resposta
 * certa, não um chute: campo ausente não tem conteúdo visível.
 */
export function textoVisivel(t) {
  if (t === null || t === undefined) return false;
  return String(t).replace(INVISIVEIS, '').length > 0;
}
