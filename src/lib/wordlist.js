// Filtro de palavras bloqueadas — match de palavra inteira (não substring).
//
// Motivo: `texto.includes('ass')` casaria com "classe", "massa", "passar"...
// (falsos positivos sérios em português). Aqui a palavra bloqueada só casa se
// NÃO estiver cercada por outras letras. Usamos `\p{L}` (qualquer letra unicode,
// inclui acentuadas) nas bordas, então "ass" não casa "classe" mas casa "ass!".
//
// ---------------------------------------------------------------------------
// SEVERIDADE MANDA NO QUE ACONTECE
//
// Antes, QUALQUER palavra da lista barrava o envio. Isso torna a lista
// impossível de usar de verdade: numa comunidade gamer "caralho que jogo foda"
// é elogio — a própria IA pontua isso em 0.066 — e bloquear o envio afastaria
// o usuário por nada.
//
// Agora:
//   high          -> BARRA o envio. Só para o que nunca é aceitável aqui
//                    (discurso de ódio, conteúdo sexual com menor, aliciamento).
//   medium / low  -> NÃO barra. Passa e fica por conta da IA e das denúncias,
//                    que julgam o contexto — coisa que uma lista de palavras
//                    não sabe fazer.
// ---------------------------------------------------------------------------

/** Severidade que impede o envio. As demais são informativas. */
export const SEVERIDADE_BLOQUEIA = 'high';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Primeira palavra da lista encontrada no texto.
 * Devolve `{ word, severity }` ou `null`.
 */
export function findBlockedWord(text, words) {
  if (!text || !words?.length) return null;
  for (const w of words) {
    const term = w?.word?.trim();
    if (!term) continue;
    const re = new RegExp(`(?<!\\p{L})${escapeRegex(term)}(?!\\p{L})`, 'iu');
    if (re.test(text)) return { word: w.word, severity: w.severity || 'medium' };
  }
  return null;
}

/**
 * Procura a de MAIOR severidade, não a primeira — senão um "medium" no começo
 * do texto esconderia um "high" logo depois e o envio passaria.
 */
export function checkText(text, words) {
  if (!text || !words?.length) return { blocked: false, word: null, severity: null };

  let achado = null;
  for (const w of words) {
    const term = w?.word?.trim();
    if (!term) continue;
    const re = new RegExp(`(?<!\\p{L})${escapeRegex(term)}(?!\\p{L})`, 'iu');
    if (!re.test(text)) continue;

    const severity = w.severity || 'medium';
    if (severity === SEVERIDADE_BLOQUEIA) {
      return { blocked: true, word: w.word, severity };
    }
    if (!achado) achado = { blocked: false, word: w.word, severity };
  }

  return achado || { blocked: false, word: null, severity: null };
}
