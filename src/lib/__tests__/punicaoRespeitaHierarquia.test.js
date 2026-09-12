import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[12/09]` SEC-020 — quem PUNE tem que olhar o cargo do alvo.
 *
 * ── O bug, e ele é o mais grave que esta auditoria encontrou ────────────────
 *
 * Existiam dois caminhos para banir, e a hierarquia estava escrita só num.
 * Provado em `ROLLBACK`, os dois lados na mesma transação:
 *
 *     caminho direto   -> BARRADO: "cannot ban equal or higher role"   (certo)
 *     caminho indireto -> INSERT INTO violations (user_id, points)
 *                         VALUES (<owner>, 999)                        (passou)
 *     resultado        -> o FUNDADOR banido, e o conteúdo dele apagado
 *
 * A corrente tinha quatro elos e **cada um estava certo lendo isolado**: a
 * policy checava o autor (nunca o alvo), a coluna `points` tinha tipo mas não
 * faixa, o trigger de escalação é só aritmética, e `apply_mod_auto_ban` não
 * checava cargo nenhum porque "quem chama é o sistema".
 *
 * ── Por que esta trava varre a CLASSE ───────────────────────────────────────
 *
 * Travar as duas funções pelo nome deixaria a próxima nascer sem o piso — e foi
 * exatamente assim que 14 policies ficaram sem `owner`, três vezes seguidas. A
 * pergunta que ela faz é geral: *toda função que escreve punição em `profiles`
 * consulta `role_rank`?*
 *
 * ── O que ela lê, e por que isso é legítimo ─────────────────────────────────
 *
 * `supabase/migrations/`, ficando com a **última** definição de cada função. O
 * portão `espelho-de-migrations.mjs` já garante que a pasta e o banco têm o
 * mesmo conteúdo, então a última definição na pasta é a que está no ar.
 * Migration antiga com o código velho é história, e não pode reprovar.
 *
 * ── O limite dela, escrito porque verde precisa significar algo ─────────────
 *
 * Ela confere que `role_rank` **aparece** na função, não que a comparação está
 * correta. Um `role_rank(v_role) >= 99` passaria. É trava contra o esquecimento
 * — que foi o defeito real — e não contra o erro de lógica; para esse o que
 * vale é o teste em `ROLLBACK` na hora de mexer.
 */

const MIGRATIONS = 'supabase/migrations';

function semComentarios(sql) {
  return sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
}

/** A definição final de cada função da pasta de migrations. */
function definicoesFinais() {
  const arquivos = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort();
  expect(
    arquivos.length,
    `Nao achei migration nenhuma em ${MIGRATIONS}/ — a trava passaria sem ler nada.`,
  ).toBeGreaterThan(100);

  const ultima = new Map();
  for (const nome of arquivos) {
    const sql = readFileSync(join(MIGRATIONS, nome), 'utf8');
    const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?(\w+)\s*\([\s\S]*?RETURNS[\s\S]*?AS\s+(\$\w*\$)([\s\S]*?)\2\s*;/gi;
    for (const [, fn, , corpo] of sql.matchAll(re)) ultima.set(fn, { corpo, arquivo: nome });
  }
  return ultima;
}

/**
 * Escreve punição? Só conta `UPDATE profiles SET ...` que grave `banned = true`
 * ou uma data em `suspended_until`.
 *
 * A distinção importa: `WHERE banned = true` aparece em `pode_publicar`,
 * `request_unban` e `owner_get_stats`, que só LEEM. Uma varredura ingênua por
 * `banned = true` acusaria as três e a trava viraria ruído (§0.2, 4ª regra).
 */
function escrevePunicao(corpo) {
  for (const m of semComentarios(corpo).matchAll(/UPDATE\s+profiles\s+SET\b([\s\S]*?)(?:WHERE|;)/gi)) {
    const sets = m[1];
    if (/\bbanned\s*=\s*true\b/i.test(sets)) return 'banned = true';
    if (/\bsuspended_until\s*=\s*(?!null)/i.test(sets)) return 'suspended_until = <data>';
  }
  return null;
}

describe('toda punição consulta a hierarquia', () => {
  it('nenhuma função bane ou suspende sem olhar `role_rank`', () => {
    const defs = definicoesFinais();
    const punem = [];

    for (const [fn, { corpo, arquivo }] of defs) {
      const oQue = escrevePunicao(corpo);
      if (oQue) punem.push({ fn, arquivo, oQue, temRank: /role_rank\s*\(/i.test(semComentarios(corpo)) });
    }

    // A guarda do `varrerFontes`: se o casamento parar de achar as funções que
    // punem, a lista vem vazia e o `every` abaixo passa — verde sem ter olhado.
    expect(
      punem.length,
      'Nao achei NENHUMA funcao que escreva punicao em `profiles`.\n'
      + '  Ou o casamento de UPDATE parou de reconhecer a forma como elas sao\n'
      + '  escritas, ou elas sumiram. Nos dois casos esta trava deixou de\n'
      + '  proteger — confira antes de aceitar o verde.',
    ).toBeGreaterThanOrEqual(3);

    const semPiso = punem.filter((p) => !p.temRank);
    expect(
      semPiso.map((p) => `${p.fn} (${p.arquivo}) — escreve ${p.oQue}`),
      'Funcao que PUNE sem consultar `role_rank`:\n'
      + `  ${semPiso.map((p) => `${p.fn} em ${p.arquivo}`).join('\n  ')}\n\n`
      + '  Foi assim que um ADMIN baniu o FUNDADOR (SEC-020): o caminho direto\n'
      + '  (`ban_user`) comparava cargos e barrava; o caminho lateral\n'
      + '  (uma linha em `violations` -> trigger -> `apply_mod_auto_ban`) nao\n'
      + '  comparava nada, e derrubou a conta e o conteudo dele.\n\n'
      + '  A regra: punicao automatica NUNCA alcanca a equipe (rank >= 2) —\n'
      + '  staff so e punido por decisao humana com hierarquia. E o desvio tem\n'
      + '  que ir para `admin_logs`, nao ser um RETURN mudo (§1.5).',
    ).toEqual([]);
  });

  it('a policy de `violations` olha o ALVO, e não só quem escreve', () => {
    // A policy dizia `role_rank(<autor>) >= 2` — staff pode inserir. Nunca
    // perguntava CONTRA QUEM. `can_moderate_content(user_id)` e o mesmo
    // auxiliar que as seis policies de conteudo usam desde o SEC-009.
    const arquivos = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort();
    let atual = null;
    for (const nome of arquivos) {
      const sql = semComentarios(readFileSync(join(MIGRATIONS, nome), 'utf8'));
      const m = [...sql.matchAll(
        /CREATE\s+POLICY\s+violations_insert[\s\S]*?WITH\s+CHECK\s*\(([\s\S]*?)\)\s*;/gi,
      )].pop();
      if (m) atual = { regra: m[1], arquivo: nome };
    }

    expect(
      atual,
      'Nao achei a policy `violations_insert` nas migrations — a trava ficou vazia.',
    ).toBeTruthy();
    expect(
      /can_moderate_content/.test(atual.regra),
      `A policy \`violations_insert\` (${atual.arquivo}) voltou a nao olhar o alvo:\n`
      + `      WITH CHECK (${atual.regra.trim().replace(/\s+/g, ' ')})\n`
      + '  Uma regra que so pergunta o cargo de QUEM ESCREVE deixa um admin\n'
      + '  registrar infracao contra o fundador — e a escalacao automatica faz\n'
      + '  o resto. Use `can_moderate_content(user_id)`: rank do ator\n'
      + '  estritamente maior que o do alvo.',
    ).toBe(true);
  });

  it('`violations.points` tem faixa, e ela não foi derrubada', () => {
    // Trava de nivel 1 (§2). O ACTION_POINTS do painel vai de 0 a 10; `999` so
    // existe para quem chama a REST API direto.
    const arquivos = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort();
    let temFaixa = false;
    for (const nome of arquivos) {
      const sql = semComentarios(readFileSync(join(MIGRATIONS, nome), 'utf8'));
      if (/ADD\s+CONSTRAINT\s+violations_points_faixa/i.test(sql)) temFaixa = true;
      if (/DROP\s+CONSTRAINT\s+(IF\s+EXISTS\s+)?violations_points_faixa/i.test(sql)) temFaixa = false;
    }
    expect(
      temFaixa,
      'A faixa de `violations.points` foi removida.\n'
      + '  Sem ela, UMA linha com `points: 999` passa do limite de banimento\n'
      + '  sozinha. O maior valor que o painel produz e 10 (`suspend_7d`).',
    ).toBe(true);
  });
});
