import { Newspaper, Users, Tv, Trophy, Key } from 'lucide-react';

/**
 * As seções da landing, num lugar só.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * Três lugares precisam concordar sobre quais seções existem e como elas se
 * chamam: a faixa de destaques no topo (que agora leva até elas), a navegação
 * lateral, e o rodapé. Antes cada um tinha a sua lista escrita à mão — e a do
 * topo já divergia da página: falava em "Lives ao vivo" e não mencionava Keys,
 * que é uma seção inteira do site.
 *
 * Lista duplicada diverge (`CLAUDE.md` §4). Aqui ela é fonte única, e o `id` é
 * o que liga o card ao destino: o mesmo valor vira o `id` da seção no HTML e o
 * alvo do link.
 */
export const SECOES = [
  { id: 'feed',   rotulo: 'Feed',        icone: Newspaper, cor: 'text-neon-green'  },
  { id: 'mural',  rotulo: 'Mural',       icone: Users,     cor: 'text-neon-purple' },
  { id: 'lives',  rotulo: 'Lives',       icone: Tv,        cor: 'text-neon-cyan'   },
  { id: 'keys',   rotulo: 'Keys & Promos', icone: Key,     cor: 'text-neon-purple' },
  { id: 'ranks',  rotulo: 'Ranks & XP',  icone: Trophy,    cor: 'text-neon-green'  },
];

/** O `id` de uma seção vira o alvo do link (`/#feed`). */
export const alvoDaSecao = (id) => `#${id}`;
