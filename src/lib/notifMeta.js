import { Heart, MessageSquare, ShieldAlert, ShieldCheck, Bell } from 'lucide-react';

/**
 * Ícone e cor de cada tipo de notificação do sino.
 *
 * ── Por que virou um mapa num arquivo ───────────────────────────────────────
 *
 * Isto morava em dois ternários encadeados dentro do `Header.jsx`:
 *
 *     n.type === 'like' ? <Heart/> : n.type === 'moderation' ? <ShieldAlert/> : <Users/>
 *
 * O `else` final é fallback silencioso (`CLAUDE.md` §4): todo tipo que não
 * fosse `like` nem `moderation` ganhava, sem aviso, o ícone de "alguém te
 * seguiu" — inclusive `comment`, que já existia no banco, e inclusive o `unban`
 * que entrou em 28/08. Ninguém escreve esse bug; ele nasce sozinho no dia em
 * que o banco grava um valor novo.
 *
 * O mapa explícito devolve `undefined` para o desconhecido, e quem usa trata
 * isso de forma VISÍVEL (`DESCONHECIDO` abaixo) em vez de chutar um ícone.
 *
 * ── Onde os tipos nascem ────────────────────────────────────────────────────
 *
 * No banco, sempre: gatilhos e RPCs que fazem `INSERT INTO notifications`. Se
 * um tipo novo aparecer lá, ele precisa aparecer aqui — é o que
 * `__tests__/notifMeta.test.js` cobra.
 */
export const NOTIF_META = {
  like:       { Icone: Heart,         cor: 'text-neon-green' },
  comment:    { Icone: MessageSquare, cor: 'text-neon-purple' },
  moderation: { Icone: ShieldAlert,   cor: 'text-orange-400' },
  // Desbanimento (`unban_user` e `approve_unban_request`, desde 28/08). Escudo
  // com visto, e não o de alerta: é a única notificação desta família que traz
  // boa notícia, e usar o mesmo ícone de punição confundiria as duas.
  unban:      { Icone: ShieldCheck,   cor: 'text-neon-green' },
};

/**
 * O que mostrar quando o banco gravar um tipo que este mapa não conhece.
 *
 * Sino genérico e cinza, de propósito: a mensagem continua legível (ela vem
 * pronta do banco), e o visual neutro deixa claro que o site não soube
 * classificar aquilo — em vez de fingir que era outra coisa.
 */
export const DESCONHECIDO = { Icone: Bell, cor: 'text-gray-500' };

/** Nunca devolve `undefined`: quem chama sempre tem o que renderizar. */
export function metaDaNotificacao(tipo) {
  return NOTIF_META[tipo] ?? DESCONHECIDO;
}
