import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * TRAVA: escrever em conteúdo de outra pessoa respeita a HIERARQUIA.
 *
 * ── O achado (SEC-009, auditoria de 10/09) ──────────────────────────────────
 *
 * As três tabelas de conteúdo tinham `DELETE` com hierarquia e `UPDATE` com
 * checagem PLANA de cargo:
 *
 * | tabela | DELETE | UPDATE (antes) |
 * | --- | --- | --- |
 * | `posts` | `can_moderate_content(user_id)` | `... OR is_staff()` |
 * | `comments` | `can_moderate_content(user_id)` | `role_rank(...) >= 2` |
 * | `community_posts` | `can_moderate_content(user_id)` | `role_rank(...) >= 2` |
 *
 * `can_moderate_content` é `role_rank(quem_chama) > role_rank(autor)` —
 * **estrito**. `is_staff()` e `role_rank >= 2` são planos: qualquer staff
 * alcança qualquer autor, inclusive quem está ACIMA dele.
 *
 * Medido em `ROLLBACK`, um admin contra um post do fundador:
 *
 * ```
 * conteudo="TEXTO TROCADO PELO ADMIN" · oculto=true
 * 3_rpc_soft_delete  recusado: Sem permissão para excluir este post
 * ```
 *
 * O caminho oficial (RPC) barrava e o `PATCH` direto no PostgREST passava. O
 * admin não conseguia APAGAR o post do fundador, mas conseguia **reescrever** e
 * **ocultar** — e reescrever é pior, porque é silencioso.
 *
 * ── Por que esta trava lê MIGRATION, e não o banco ──────────────────────────
 *
 * `npm test` não fala com o Postgres, e não deve: teste que precisa de
 * credencial vira teste que ninguém roda. Mas a regra do projeto é que **toda
 * mudança de policy nasce numa migration** (§5), e as migrations estão no
 * repositório. Então o arquivo é uma fonte legítima — e é onde a regressão
 * apareceria antes de chegar ao banco.
 *
 * **O que ela NÃO cobre, dito com todas as letras:** uma policy trocada
 * direto no banco, sem migration. Isso é invisível aqui. Quem cobre esse caso é
 * o `e2e/portas-do-banco.mjs`, que fala com o banco de verdade.
 */

const DIR = 'supabase/migrations';

/**
 * As seis policies que decidem quem escreve em conteúdo alheio.
 *
 * A lista é fechada de propósito: "toda policy de conteúdo" viraria julgamento
 * na hora de rodar, que é como a cobertura escorrega (§6).
 */
const POLICIES = [
  'posts_update', 'posts_delete',
  'comments_update_mod', 'comments_delete',
  'community_posts_update_mod', 'community_posts_delete',
];

/** A ÚLTIMA definição de cada policy, na ordem cronológica dos arquivos. */
function ultimaDefinicao() {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  const achado = {};
  for (const arquivo of arquivos) {
    const sql = readFileSync(`${DIR}/${arquivo}`, 'utf8');
    for (const nome of POLICIES) {
      // `CREATE POLICY <nome> ...` até o `;` que fecha o comando.
      const re = new RegExp(`CREATE\\s+POLICY\\s+"?${nome}"?\\b[\\s\\S]*?;`, 'gi');
      const todas = sql.match(re);
      if (todas?.length) achado[nome] = { arquivo, sql: todas[todas.length - 1] };
    }
  }
  return achado;
}

describe('escrever em conteúdo alheio respeita a hierarquia', () => {
  const defs = ultimaDefinicao();

  it('achou a definição das seis policies (senão a trava não vigia nada)', () => {
    const faltando = POLICIES.filter((p) => !defs[p]);
    expect(faltando.join(', '),
      'não achei `CREATE POLICY` para: ' + faltando.join(', ') + '\n\n'
      + '  Ou a policy foi renomeada, ou passou a ser criada fora de\n'
      + '  supabase/migrations/. Nos dois casos esta trava parou de vigiar —\n'
      + '  e uma trava que nao le nada fica VERDE para sempre.')
      .toBe('');
  });

  it.each(POLICIES)('%s decide por hierarquia, não por cargo plano', (nome) => {
    const def = defs[nome];
    expect(def, `sem definição para ${nome}`).toBeTruthy();

    expect(def.sql,
      `a policy \`${nome}\` (em ${def.arquivo}) nao usa \`can_moderate_content\`.\n\n`
      + '  Sem ela a checagem e PLANA: `is_staff()` e `role_rank(...) >= 2`\n'
      + '  deixam qualquer staff alcancar QUALQUER autor — inclusive quem esta\n'
      + '  acima dele na hierarquia.\n\n'
      + '  Foi assim que um admin reescreveu e ocultou um post do FUNDADOR em\n'
      + '  10/09, enquanto o `soft_delete_post` recusava o mesmo post por falta\n'
      + '  de permissao (SEC-009, em db/2026-09-10-auditoria-seguranca.md).\n\n'
      + '  `can_moderate_content(autor)` e `role_rank(quem_chama) > role_rank(autor)`,\n'
      + '  ESTRITO — e e o modelo que este projeto escolheu de proposito:\n'
      + '  admin nao modera admin.')
      .toMatch(/can_moderate_content/);
  });

  it('nenhuma delas voltou a usar cargo plano como único critério', () => {
    // `role_rank >= 2` continua legitimo em comments/community_posts, mas
    // SOMENTE junto da hierarquia (é "staff E supera o autor"). O que nao pode
    // e `is_staff()` ou `role_rank >= 2` SOZINHO decidindo.
    const suspeitas = [];
    for (const nome of POLICIES) {
      const { sql, arquivo } = defs[nome] ?? {};
      if (!sql) continue;
      if (/is_staff\(\)/.test(sql) && !/can_moderate_content/.test(sql)) {
        suspeitas.push(`${nome} (${arquivo}) — is_staff() sem hierarquia`);
      }
    }
    expect(suspeitas.join('\n'),
      'policy de conteudo decidindo por cargo plano:\n\n'
      + `    ${suspeitas.join('\n    ')}\n\n`
      + '  Ver SEC-009: o DELETE respeitava a hierarquia e o UPDATE nao, e a\n'
      + '  diferenca deixou um admin reescrever o post do fundador.')
      .toBe('');
  });
});
