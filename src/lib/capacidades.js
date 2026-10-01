import { roleRank } from './roles';

/**
 * `[01/10]` CAPACIDADES — o que uma pessoa PODE FAZER, separado de QUEM ELA É.
 *
 * ── O problema que isto resolve ───────────────────────────────────────────
 *
 * Medido em 01/10: **114 usos** de `isAdmin`/`isSuperAdmin`/`isOwner` em **31
 * arquivos**. Cada um era uma decisão de capacidade escrita à mão, e a regra
 * ficava espalhada: para saber quem publica matéria era preciso ler o
 * `PainelEditorial`; para saber quem bane, o `UsersPanel`.
 *
 * Isso já custou caro neste projeto por três vezes, do lado do banco — lista
 * de papéis escrita à mão esquecendo `owner` (§1.3). A UI estava repetindo o
 * mesmo erro com outro vocabulário.
 *
 * ── A ARQUITETURA, e ela tem TRÊS camadas de propósito ────────────────────
 *
 *     role (identidade)          ──>  badge, cor, rótulo, rank
 *     hierarquia (DUAS pessoas)  ──>  canModerate(viewer, alvo)
 *     capacidade (UMA pessoa)    ──>  can('publish_news')          ← este arquivo
 *
 * **Achatar as três em capacidades destruiria semântica.** `canModerate` é
 * sobre a relação entre duas pessoas — admin não modera admin, e isso é `>`
 * estrito. Nenhum booleano de uma pessoa só expressa isso.
 *
 * E `manage_live` é a prova viva: a regra é *"é staff **OU** é o dono desta
 * live"*, e depende do OBJETO. Ela continua em `canModerateLive(isAdmin, live,
 * user)` — está listada aqui no mapa só para o inventário ficar completo, com
 * a ressalva escrita.
 *
 * ── DERIVADO do `roleRank`, nunca uma segunda tabela ──────────────────────
 *
 * O mapa guarda **rank mínimo**, não lista de cargos. Escrever
 * `['admin','super_admin','owner']` aqui recriaria exatamente o bug que o
 * banco já teve três vezes: alguém acrescenta um cargo e esquece uma lista.
 *
 * ── `can()` NÃO É SEGURANÇA, e isso não é detalhe ─────────────────────────
 *
 * O site usa a `anon key`: qualquer pessoa chama a REST API e pula o frontend
 * inteiro. A autorização real é RLS, RPC `SECURITY DEFINER` e constraint — a
 * coluna "proteção no banco" da tabela abaixo é a que vale.
 *
 * O que `can()` entrega é **experiência**: não oferecer um botão que o banco
 * vai recusar, e não entregar a quem não é da equipe o DOM com os controles
 * dela. Esconder botão não protege nada; mostrar botão que não funciona é que
 * estraga o produto.
 */

/**
 * O mapa. Cada capacidade diz o **rank mínimo** e **onde o banco de verdade a
 * protege** — a última coluna é a que importa: capacidade sem proteção no
 * banco é decoração, e o teste exige que ela exista.
 */
export const CAPACIDADES = {
  moderate_content: {
    rankMinimo: 2, // admin
    protecaoNoBanco: 'policies de posts/comments + can_moderate_content()',
  },
  ban_users: {
    rankMinimo: 2,
    protecaoNoBanco: 'ban_user / unban_user (SECURITY DEFINER, hierarquia estrita)',
  },
  unban_users: {
    // Rank 3, e isto NÃO foi deduzido: medido em `pg_proc.prosrc` em 01/10 —
    // `unban_user` exige `is_super()`, enquanto `ban_user` usa hierarquia.
    // Admin BANE mas não DESBANE sozinho: ele abre um pedido de desbanimento.
    rankMinimo: 3,
    protecaoNoBanco: 'unban_user (SECURITY DEFINER, exige is_super())',
  },
  view_audit_logs: {
    rankMinimo: 2,
    protecaoNoBanco: 'owner_get_audit_logs + policy de admin_logs',
  },
  manage_news: {
    rankMinimo: 2, // admin escreve
    protecaoNoBanco: 'policies de news_articles (is_staff)',
  },
  publish_news: {
    rankMinimo: 3, // super admin publica — decisão dele em 25/09, saída B
    protecaoNoBanco: 'trigger news_guarda_a_publicacao (levanta exceção)',
  },
  manage_roles: {
    rankMinimo: 3,
    protecaoNoBanco: 'admin_set_role · owner_set_role',
  },
  manage_site: {
    rankMinimo: 4, // owner
    protecaoNoBanco: 'owner_set_site_config (lista fechada de chaves)',
  },
  manage_live: {
    rankMinimo: 2,
    protecaoNoBanco: 'policies de live_chat / live_chat_timeouts',
    // A regra REAL é "staff OU dono da live" e depende do objeto. Quem a
    // responde é `canModerateLive(isAdmin, live, user)`. Esta entrada cobre só
    // a metade que depende de cargo — usar `can('manage_live')` sozinho para
    // decidir sobre UMA live seria perder o "ou é o dono dela".
    dependeDoObjeto: 'canModerateLive(isAdmin, live, user)',
  },
};

/** Toda capacidade conhecida. Lista derivada — não é segunda fonte. */
export const CAPACIDADES_CONHECIDAS = Object.keys(CAPACIDADES);

/**
 * O papel tem esta capacidade?
 *
 * Função PURA: o mesmo código que o React chama pelo `usePermissions` e que
 * qualquer lugar fora do React pode chamar direto. Duas implementações da
 * mesma pergunta divergiriam (§4).
 *
 * **Capacidade desconhecida estoura**, em vez de devolver `false`. Um
 * `can('publsh_news')` com typo que devolvesse `false` esconderia o botão para
 * todo mundo, em silêncio, para sempre — a 5ª fonte de silêncio do §1.5.
 *
 * @param {string} role  o cargo da pessoa
 * @param {string} capacidade  uma chave de `CAPACIDADES`
 */
export function podeComOPapel(role, capacidade) {
  const regra = CAPACIDADES[capacidade];
  if (!regra) {
    throw new Error(
      `Capacidade desconhecida: "${capacidade}".\n`
      + `  As que existem: ${CAPACIDADES_CONHECIDAS.join(', ')}.\n`
      + '  Devolver `false` aqui esconderia o controle para todo mundo, em\n'
      + '  silêncio — por isso isto estoura em vez de chutar.');
  }
  return roleRank(role) >= regra.rankMinimo;
}
