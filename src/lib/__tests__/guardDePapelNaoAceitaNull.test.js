import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ── As travas do SEC-016/017/018: comparar PAPEL com NULL não barra nada ────
 *
 * O mecanismo, medido no banco e não deduzido:
 *
 *     select (null::text not in ('super_admin','owner'));   -->  NULL
 *     select (null::text <> 'super_admin');                 -->  NULL
 *
 * Em SQL, comparar com NULL não devolve `false`: devolve NULL. E `IF NULL THEN
 * ... END IF` **não dispara**. Então um guard escrito assim...
 *
 *     IF v_caller_role NOT IN ('super_admin','owner') THEN RAISE ...
 *
 * ...deixa passar exatamente quem **não tem linha em `profiles`**: o
 * `SELECT role INTO v_caller_role` não acha nada, a variável fica NULL, e o
 * portão fica aberto. Foram encontradas **cinco** funções assim numa varredura
 * de classe.
 *
 * ── Por que a trava lê `supabase/migrations/` e não o banco ─────────────────
 *
 * `npm test` não tem credencial de banco, e nem deve ter. Mas o portão
 * `scripts/espelho-de-migrations.mjs` já garante que a pasta de migrations e o
 * banco têm o mesmo conteúdo — então **a última definição de cada função na
 * pasta É a definição que está no ar**.
 *
 * Daí o desenho: percorrer os arquivos em ordem de nome (que é ordem
 * cronológica, pelo prefixo de data) e ficar com o ÚLTIMO `CREATE OR REPLACE
 * FUNCTION` de cada nome. Migration antiga contendo o código velho é normal e
 * **não** pode reprovar — ela é história, não estado.
 *
 * ── O que ela NÃO cobre, dito com todas as letras ───────────────────────────
 *
 * Função criada direto pelo painel do Supabase, sem migration, é invisível
 * aqui. Esse buraco é do `espelho-de-migrations`, não desta trava — e ele
 * existe e reprova.
 */

const MIGRATIONS = 'supabase/migrations';

/** A definição FINAL de cada função, reconstruída da pasta de migrations. */
function definicoesFinais() {
  const arquivos = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort();

  // Sem isto a trava vira decoração no dia em que a pasta mudar de nome:
  // zero arquivos, zero definições, zero violações, verde para sempre.
  // É a lição do `varrerFontes.js`, aplicada a uma pasta que ele não varre.
  expect(
    arquivos.length,
    `Nao achei migration nenhuma em ${MIGRATIONS}/.\n`
    + '  A pasta foi renomeada ou movida? Sem ela esta trava passa verde sem\n'
    + '  ter lido uma linha de SQL.',
  ).toBeGreaterThan(100);

  const ultima = new Map();
  for (const nome of arquivos) {
    const sql = readFileSync(join(MIGRATIONS, nome), 'utf8');
    // Casa da assinatura até o `$...$;` de fechamento do corpo.
    const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\)\s*\n?\s*RETURNS[\s\S]*?AS\s+(\$\w*\$)([\s\S]*?)\3\s*;/gi;
    for (const [, fn, , , corpo] of sql.matchAll(re)) {
      ultima.set(fn, { corpo, arquivo: nome });
    }
  }
  return ultima;
}

/** Tira comentários `--` para a trava ler CÓDIGO, e não a prosa que o explica. */
function semComentarios(sql) {
  return sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
}

describe('guard de papel não pode comparar com NULL', () => {
  // As funções que o SEC-016/017/018 consertou. Nomeadas para que a trava
  // falhe se alguma sumir da pasta — o que significaria que a correção foi
  // revertida ou que a função virou órfã.
  const CORRIGIDAS = [
    'unban_user', 'approve_unban_request', 'deny_unban_request',
    'notify_owner', 'owner_set_role', 'admin_set_role', 'nominate_staff',
  ];

  it('as sete funções corrigidas continuam na pasta de migrations', () => {
    const defs = definicoesFinais();
    for (const fn of CORRIGIDAS) {
      expect(
        defs.has(fn),
        `Nao achei a definicao final de \`${fn}\` em ${MIGRATIONS}/.\n`
        + '  Ou a funcao foi apagada, ou o casamento de CREATE OR REPLACE parou\n'
        + '  de reconhecer a forma como ela e escrita — e nesse caso as travas\n'
        + '  abaixo deixaram de olhar para ela, em silencio.',
      ).toBe(true);
    }
  });

  it('nenhuma delas volta a comparar o papel do CHAMADOR com literal inseguro', () => {
    const defs = definicoesFinais();

    // Guards que leem a variavel do papel de QUEM CHAMA. `p_new_role`,
    // `p_target_role` e `v_nom.target_role` sao PARAMETRO/dado, tratados na
    // outra trava — aqui o alvo e o portao de acesso.
    const INSEGURO = /\bv_(caller_)?role\b\s*(NOT\s+IN|<>|!=)/i;

    for (const fn of CORRIGIDAS) {
      const { corpo, arquivo } = defs.get(fn);
      const codigo = semComentarios(corpo);
      const achado = codigo.match(INSEGURO);

      expect(
        achado,
        `\`${fn}\` (definida por ultimo em ${arquivo}) voltou a comparar o papel\n`
        + `  do chamador com um literal usando \`${achado?.[2]}\`:\n`
        + `      ${achado?.[0]}\n`
        + '  Isso NAO barra nada quando o papel e NULL — o chamador sem linha em\n'
        + '  `profiles` passa direto, porque `NULL <> x` e NULL e o IF nao dispara.\n'
        + '  Use `is_staff()` / `is_super()` / `is_owner()`, que sao NULL-safe por\n'
        + '  construcao (role_rank(NULL) e 0). Se o sentido for EXATAMENTE um\n'
        + '  papel e nao "aquele ou acima", use `IS DISTINCT FROM`.',
      ).toBe(null);
    }
  });

  it('quem valida CARGO recebido do cliente checa `IS NULL` antes do `NOT IN`', () => {
    // A irma do bug acima, no PARAMETRO: `p_new_role NOT IN (...)` nao dispara
    // com NULL, e o UPDATE grava NULL em `profiles.role`. O CHECK da coluna nao
    // segura — `NULL = ANY(...)` e NULL, e constraint so reprova em FALSE.
    const defs = definicoesFinais();

    for (const fn of ['owner_set_role', 'admin_set_role', 'nominate_staff']) {
      const { corpo, arquivo } = defs.get(fn);
      const codigo = semComentarios(corpo);
      const guard = codigo.match(/\b(p_\w*role)\b[\s\S]{0,120}?NOT\s+IN\s*\(/i);

      expect(
        guard,
        `\`${fn}\` (${arquivo}) nao valida mais o cargo recebido com NOT IN.\n`
        + '  Se a validacao mudou de forma, esta trava parou de olhar — confira.',
      ).not.toBe(null);

      const param = guard[1];
      const trecho = codigo.slice(Math.max(0, guard.index - 160), guard.index + guard[0].length);
      expect(
        new RegExp(`${param}\\s+IS\\s+NULL`, 'i').test(trecho),
        `\`${fn}\` (${arquivo}) valida \`${param}\` com NOT IN e sem checar IS NULL antes.\n`
        + `      ${guard[0].replace(/\s+/g, ' ')}\n`
        + '  Com o parametro NULL o IF nao dispara e o valor segue para o UPDATE.\n'
        + '  O `NOT NULL` da coluna e a rede embaixo, mas a mensagem que chega no\n'
        + '  painel vira o texto cru do Postgres em vez de "Role invalida".\n'
        + '  Escreva `if <param> is null or <param> not in (...)`.',
      ).toBe(true);
    }
  });

  it('`role` e `banned` de `profiles` são NOT NULL — e a trava é do DADO', () => {
    // A trava de nivel 1 (§2): o estado ruim deixa de ser possivel, em vez de
    // depender de cada funcao lembrar de checar. Vive numa migration, entao a
    // conferencia aqui e de que ela nao foi revertida por outra depois.
    const arquivos = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort();
    let roleNotNull = false;
    let bannedNotNull = false;

    for (const nome of arquivos) {
      const sql = semComentarios(readFileSync(join(MIGRATIONS, nome), 'utf8'));
      for (const [, coluna, acao] of sql.matchAll(
        /ALTER\s+COLUMN\s+(role|banned)\s+(SET|DROP)\s+NOT\s+NULL/gi,
      )) {
        const ligado = acao.toUpperCase() === 'SET';
        if (coluna.toLowerCase() === 'role') roleNotNull = ligado;
        else bannedNotNull = ligado;
      }
    }

    expect(
      roleNotNull && bannedNotNull,
      `profiles.role NOT NULL: ${roleNotNull} · profiles.banned NOT NULL: ${bannedNotNull}.\n`
      + '  Alguma migration derrubou a trava do SEC-017. Sem ela:\n'
      + '  - `role` nulo da `role_rank` = 0, que e ABAIXO de `user` (1) — um\n'
      + '    estado que nenhuma tela, policy ou funcao sabe que existe;\n'
      + '  - `banned` nulo faz `IF NOT v_banned` nao disparar, e o guard do\n'
      + '    desbanimento passa direto.\n'
      + '  O CHECK da coluna NAO substitui: `NULL = ANY(...)` e NULL, e\n'
      + '  constraint so reprova em FALSE explicito.',
    ).toBe(true);
  });
});

describe('os motivos de ban são os MESMOS no modal e no banco', () => {
  // `[12/09]` SEC-014. O `BanModal` oferece seis motivos numa lista fechada; a
  // RPC aceitava `text` livre. O site usa a anon key, entao a REST API e
  // chamavel direto — e esse texto vai para a trilha de auditoria, para a
  // `BannedScreen` da pessoa banida e para a notificacao de toda a equipe.
  //
  // A faixa virou lista fechada no SQL, o que cria uma deriva de propósito
  // vigiada: motivo novo no modal e esquecido no banco faz o ban falhar ALTO
  // (excecao -> toast) em vez de gravar um valor que os paineis nao agrupam.
  const MODAL = 'src/components/ui/BanModal.jsx';

  it('a lista do modal e a lista do `ban_user` são iguais', () => {
    const defs = definicoesFinais();
    const banUser = defs.get('ban_user');
    expect(banUser, 'Nao achei a definicao final de `ban_user` nas migrations.').toBeTruthy();

    const doModal = [...readFileSync(MODAL, 'utf8')
      .match(/const BAN_REASONS = \[([\s\S]*?)\]/)[1]
      .matchAll(/'([^']+)'/g)].map((m) => m[1]);

    const guard = semComentarios(banUser.corpo)
      .match(/p_reason\s+NOT\s+IN\s*\(([\s\S]*?)\)/i);
    expect(
      guard,
      'O `ban_user` nao valida mais `p_reason` com uma lista fechada.\n'
      + '  Sem ela, qualquer texto vindo da REST API vira motivo de banimento —\n'
      + '  e ele aparece na trilha, na tela da pessoa banida e para a equipe.',
    ).toBeTruthy();
    const doBanco = [...guard[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

    expect(doModal.length, `Li ${doModal.length} motivos no ${MODAL} — a trava ficaria vazia.`)
      .toBeGreaterThan(0);

    expect(
      [...doBanco].sort(),
      `Os motivos de ban DIVERGIRAM entre os dois lados.\n`
      + `  ${MODAL}: ${JSON.stringify(doModal)}\n`
      + `  ${banUser.arquivo}: ${JSON.stringify(doBanco)}\n`
      + '  Motivo que existe no modal e nao no banco faz o ban falhar com\n'
      + '  "Motivo invalido" na cara do admin. O contrario deixa um valor\n'
      + '  inalcancavel pela tela. Acerte os dois na mesma mudanca.',
    ).toEqual([...doModal].sort());
  });
});
