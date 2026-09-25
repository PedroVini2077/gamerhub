/**
 * `[25/09]` OS ESTADOS DE UM ARTIGO, e quem pode levá-lo a cada um.
 *
 * ── Isto NÃO é a segurança ────────────────────────────────────────────────
 *
 * Quem impede de verdade é o banco: o trigger `news_guarda_a_publicacao`
 * levanta exceção quando alguém que não é super admin tenta publicar, agendar,
 * ou editar o que já está no ar. O site usa a `anon key` — qualquer pessoa
 * chama a REST API direto e pula esta tela inteira (§1.3).
 *
 * O que este arquivo faz é **não oferecer o botão** que o banco vai recusar.
 * Botão que existe para ser negado é a tela mentindo antes de o servidor
 * responder.
 *
 * ── O corte, decidido pelo dono em 25/09 (saída "B") ──────────────────────
 *
 *   escrever, editar, mandar revisar ... admin, super admin, owner
 *   PUBLICAR e AGENDAR ................. só super admin e owner
 *   editar o que já está NO AR .......... só super admin e owner
 *
 * Rascunho é reversível; publicado é a voz do GamerHub falando com todo mundo.
 */

/** Os cinco estados. Espelho do `CHECK` de `news_articles.status`. */
export const ESTADOS = {
  draft:     { rotulo: 'Rascunho',   cor: 'text-gray-400',     noAr: false },
  in_review: { rotulo: 'Em revisão', cor: 'text-yellow-400',   noAr: false },
  scheduled: { rotulo: 'Agendado',   cor: 'text-neon-cyan',    noAr: true  },
  published: { rotulo: 'No ar',      cor: 'text-neon-green',   noAr: true  },
  archived:  { rotulo: 'Arquivado',  cor: 'text-gray-500',     noAr: false },
};

export const ESTADOS_EM_ORDEM = Object.keys(ESTADOS);

/**
 * O estado coloca (ou vai colocar) o artigo na frente do público?
 *
 * `scheduled` conta: agendar é publicar com atraso. Se só `published` contasse,
 * bastaria agendar para daqui a um minuto para furar o corte — e é por isso que
 * o trigger no banco trata os dois juntos.
 */
export const estadoNoAr = (status) => ESTADOS[status]?.noAr === true;

export const rotuloDoEstado = (status) => ESTADOS[status]?.rotulo ?? status;
export const corDoEstado = (status) => ESTADOS[status]?.cor ?? 'text-gray-400';

/**
 * Esta pessoa pode levar o artigo a este estado?
 *
 * @param {string} destino   o estado pretendido
 * @param {string} atual     o estado de hoje (importa: mexer no que está no ar
 *                           é do super, mesmo que o destino seja um rascunho)
 * @param {boolean} ehSuper  `is_super()` do lado do servidor
 */
export function podeLevarPara(destino, atual, ehSuper) {
  if (ehSuper) return true;
  if (estadoNoAr(destino)) return false;   // publicar/agendar é do super
  if (estadoNoAr(atual)) return false;     // tirar do ar também
  return true;
}

/** Pode editar o TEXTO? Mesma regra: o que está no ar é do super. */
export const podeEditar = (atual, ehSuper) => ehSuper || !estadoNoAr(atual);
