/**
 * O ícone de cada bloco da página "Sobre".
 *
 * Por que um mapa e não o nome direto do `lucide-react`: importar por nome
 * dinâmico traria a biblioteca inteira para o pacote, e ela é grande. Aqui só
 * entram os sete ícones que a página usa de fato.
 *
 * Por que um mapa EXPLÍCITO e não `?? algumIconePadrao`: um bloco novo sem
 * ícone cadastrado deve **estourar no teste**, não escolher um ícone qualquer
 * por conta própria. Padrão escondendo chave inexistente é fallback silencioso
 * (`CLAUDE.md` §4) — e neste caso o sintoma seria mudo: a página continuaria
 * bonita, com um ícone errado que ninguém questiona.
 */
import {
  Gamepad2, Sprout, User, HeartHandshake, ShieldCheck, Bot, Rocket,
  Cookie, Database, Share2, UserCheck, CalendarClock, Timer, Mail,
  Scale, FileText, AlertTriangle,
} from 'lucide-react';

// `[02/09]` A página `/privacidade` usa o mesmo mapa. Manter DOIS mapas de
// ícone seria duas fontes de verdade para a mesma coisa (§4) — e o teste que
// exige "todo bloco tem ícone" passaria a precisar saber qual mapa consultar.
export const ICONES = {
  Gamepad2, Sprout, User, HeartHandshake, ShieldCheck, Bot, Rocket,
  Cookie, Database, Share2, UserCheck, CalendarClock, Timer, Mail,
  Scale, FileText, AlertTriangle,
};

/** Devolve o componente, ou `undefined` — nunca um palpite. */
export function iconeDoBloco(nome) {
  return ICONES[nome];
}
