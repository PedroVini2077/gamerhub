// Motivo da pausa, guardado no navegador.
//
// A armadilha lógica desta funcionalidade: **se o banco caiu, o motivo não pode
// ser lido do banco**. Então o app guarda a chave `pause_reason` enquanto ainda
// está online e usa a cópia quando o banco some.
//
// Consequência honesta, e vale saber:
//   - pausa PLANEJADA (o dono escreve o motivo antes de pausar) → quem já tinha
//     entrado no site vê o motivo de verdade;
//   - queda inesperada, ou primeira visita de alguém → mensagem genérica.
// Não há como fugir disso sem hospedar o aviso fora do Supabase.

const CHAVE = 'gh_pause_reason';

export const MOTIVO_GENERICO =
  'O site está temporariamente fora do ar. Estamos trabalhando para voltar o quanto antes.';

/** Guarda o motivo lido do banco. String vazia limpa a cópia. */
export function guardarMotivoDaPausa(motivo) {
  try {
    const limpo = (motivo || '').trim();
    if (limpo) localStorage.setItem(CHAVE, limpo);
    else localStorage.removeItem(CHAVE);
  } catch { /* modo privado / storage bloqueado */ }
}

/** Motivo guardado, ou o genérico. Nunca devolve vazio. */
export function motivoDaPausa() {
  try {
    return localStorage.getItem(CHAVE)?.trim() || MOTIVO_GENERICO;
  } catch {
    return MOTIVO_GENERICO;
  }
}
