// Filtro de palavras bloqueadas — match de palavra inteira (não substring).
//
// Motivo: `texto.includes('ass')` casaria com "classe", "massa", "passar"...
// (falsos positivos sérios em português). Aqui a palavra bloqueada só casa se
// NÃO estiver cercada por outras letras. Usamos `\p{L}` (qualquer letra unicode,
// inclui acentuadas) nas bordas, então "ass" não casa "classe" mas casa "ass!".

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Retorna a palavra bloqueada encontrada (string original) ou null.
export function findBlockedWord(text, words) {
  if (!text || !words?.length) return null;
  for (const w of words) {
    const term = w?.word?.trim();
    if (!term) continue;
    const re = new RegExp(`(?<!\\p{L})${escapeRegex(term)}(?!\\p{L})`, 'iu');
    if (re.test(text)) return w.word;
  }
  return null;
}
