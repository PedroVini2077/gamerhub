import {
  FileText, Layers, Tv, Heart, Flame, MessageCircle, UserCheck, CalendarClock,
} from 'lucide-react';

/**
 * As CONQUISTAS — e por que elas não têm tabela no banco.
 *
 * ── A decisão que define tudo aqui ──────────────────────────────────────────
 *
 * Conquista, normalmente, é uma tabela: `achievements` mais `user_achievements`,
 * com trigger gravando a cada post, curtida e comentário. Aqui não é, e a razão
 * é a mesma que decide quase tudo neste projeto (§0.2): **quantas vezes por dia
 * isso roda?**
 *
 * A resposta seria "uma escrita por interação de todo mundo" — e isso multiplica
 * por usuários × posts × curtidas, que é exatamente a conta que cresce.
 *
 * Estas conquistas são **derivadas**: a `get_user_xp` já devolve posts,
 * curtidas, comentários e lives numa chamada que o perfil **já faz**. Avaliar a
 * lista em cima disso custa **zero** consulta nova, zero escrita, zero tabela e
 * zero trigger.
 *
 * ── O que se perde com isso, dito antes de alguém descobrir ─────────────────
 *
 * | | derivada (é assim) | com tabela |
 * | --- | --- | --- |
 * | custo | zero | uma escrita por interação |
 * | "quando" foi conquistada | **não existe** | data guardada |
 * | notificar na hora | **não dá** | dá |
 * | conquista de evento que não deixa rastro (ex.: "entrou no 1º dia") | **impossível** | possível |
 *
 * O dia em que uma dessas colunas virar necessidade — notificar, ou datar — a
 * tabela passa a valer o preço. Hoje não vale.
 *
 * ── Nada aqui inventa valor ─────────────────────────────────────────────────
 *
 * `avaliarConquistas` devolve `null` quando os dados ainda não chegaram, em vez
 * de responder "0 de 10". A diferença importa: "0 de 10" é uma afirmação falsa
 * sobre a pessoa, e a tela mostraria conquista bloqueada para quem já a tem
 * (§4, fallback silencioso).
 */

/** Quantos dias de conta o "Um Mês de Casa" pede. */
const DIAS_DE_CASA = 30;

/**
 * Os seis campos que fazem o perfil estar completo.
 *
 * A mesma lista existe na `get_user_xp`, que paga bônus por cada um. **Não dá
 * para importar dali** — é SQL —, então a duplicação é assumida e está anotada
 * nos dois lados. O que se ganha em troca é não depender do número mágico 140
 * (a soma dos bônus): se um bônus mudar de valor no SQL, esta conquista continua
 * verdadeira, porque ela olha os campos e não o total.
 */
const CAMPOS_DO_PERFIL = ['bio', 'avatar_url', 'platform', 'discord', 'twitch', 'youtube'];

/**
 * A lista fechada.
 *
 * `medir` recebe `{ xp, perfil }` e devolve **um número** — quanto a pessoa tem
 * daquilo. A comparação com `meta` é feita num lugar só, o que impede duas
 * conquistas de discordarem sobre o que é "concluída".
 */
export const CONQUISTAS = [
  {
    id: 'primeiro_post',
    nome: 'Primeiro Post',
    descricao: 'Publique seu primeiro post no feed',
    Icon: FileText,
    cor: '#39ff14',
    meta: 1,
    medir: ({ xp }) => xp.posts,
  },
  {
    id: 'dez_posts',
    nome: 'Presença Constante',
    descricao: 'Publique 10 posts',
    Icon: Layers,
    cor: '#39ff14',
    meta: 10,
    medir: ({ xp }) => xp.posts,
  },
  {
    id: 'primeira_live',
    nome: 'No Ar',
    descricao: 'Transmita sua primeira live',
    Icon: Tv,
    cor: '#00ffff',
    meta: 1,
    medir: ({ xp }) => xp.lives,
  },
  {
    id: 'primeira_curtida',
    nome: 'Alguém Curtiu',
    descricao: 'Receba a primeira curtida de outra pessoa',
    Icon: Heart,
    cor: '#bf00ff',
    meta: 1,
    medir: ({ xp }) => xp.likes,
  },
  {
    id: 'vinte_e_cinco_curtidas',
    nome: 'Em Alta',
    descricao: 'Receba 25 curtidas nos seus posts',
    Icon: Flame,
    cor: '#bf00ff',
    meta: 25,
    medir: ({ xp }) => xp.likes,
  },
  {
    id: 'dez_comentarios',
    nome: 'Conversador',
    descricao: 'Deixe 10 comentários',
    Icon: MessageCircle,
    cor: '#00ffff',
    meta: 10,
    medir: ({ xp }) => xp.comments,
  },
  {
    id: 'perfil_completo',
    nome: 'Identidade Completa',
    descricao: 'Preencha bio, avatar, plataforma e as três redes',
    Icon: UserCheck,
    cor: '#f97316',
    meta: CAMPOS_DO_PERFIL.length,
    medir: ({ perfil }) => CAMPOS_DO_PERFIL
      .filter((campo) => String(perfil?.[campo] ?? '').trim() !== '').length,
  },
  {
    id: 'um_mes_de_casa',
    nome: 'Um Mês de Casa',
    descricao: 'Complete 30 dias de conta no GamerHub',
    Icon: CalendarClock,
    cor: '#f97316',
    meta: DIAS_DE_CASA,
    medir: ({ perfil }) => diasDesde(perfil?.created_at),
  },
];

/**
 * Dias inteiros desde uma data.
 *
 * Devolve 0 para data ausente ou inválida — e aqui o 0 **é** a resposta certa,
 * não um chute: sem data conhecida, a pessoa não tem tempo de casa comprovado.
 * `Math.floor` porque 29,9 dias não são 30.
 */
function diasDesde(quando) {
  if (!quando) return 0;
  const inicio = new Date(quando).getTime();
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((Date.now() - inicio) / 86400000));
}

/**
 * Avalia a lista inteira.
 *
 * @param {object|null} xp      o que a `get_user_xp` devolveu
 * @param {object|null} perfil  a linha de `profiles`
 * @returns {Array|null}        `null` enquanto faltar dado — nunca uma lista
 *                              de zeros, que seria mentira sobre a pessoa
 */
export function avaliarConquistas(xp, perfil) {
  if (!xp || typeof xp.posts !== 'number') return null;

  return CONQUISTAS.map((c) => {
    const valor = Math.max(0, c.medir({ xp, perfil }) ?? 0);
    return {
      ...c,
      valor: Math.min(valor, c.meta),
      concluida: valor >= c.meta,
      // Percentual já pronto: a barra não deve fazer conta, e assim as duas
      // (barra e texto) nunca discordam.
      progresso: Math.min(100, Math.round((valor / c.meta) * 100)),
    };
  });
}

/** Quantas de quantas — o resumo do cabeçalho do card. */
export function contarConcluidas(avaliadas) {
  if (!avaliadas) return null;
  return { feitas: avaliadas.filter((c) => c.concluida).length, total: avaliadas.length };
}
