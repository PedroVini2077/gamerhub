import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[17/09]` A METADE `authenticated` das três portas do contador de login.
 *
 * ── O buraco que esta trava fecha ──────────────────────────────────────────
 *
 * O `e2e/portas-do-banco.mjs` bate na REST API com a chave **anônima**. Ele
 * prova, contra produção, que quem não tem conta não alcança nada — e prova
 * bem. Mas a SEC-024 revogou `reset_login_attempts` de **`authenticated`**, e
 * esse lado ele não vê: para vê-lo seria preciso uma sessão de verdade no CI,
 * e credencial no CI é a troca que este projeto já recusou três vezes (no
 * `portas-fechadas`, no alerta de cota do Sentry e no espelho de migrations).
 *
 * O dono fechou a porta para a outra saída: *"não tenho conta pra criar"*.
 *
 * ── Como provar sem conta e sem credencial ─────────────────────────────────
 *
 * As migrations **são** o histórico de privilégios, em ordem de nome. Lendo
 * todas e aplicando cada `GRANT`/`REVOKE` na ordem, chega-se ao estado final de
 * cada função — que é exatamente o que o banco tem.
 *
 * Isto NÃO é ler o banco. É ler a fonte que o constrói, e a diferença está
 * escrita no fim deste comentário.
 *
 * ── Por que ESTAS três ─────────────────────────────────────────────────────
 *
 * As três são o contador de login, e as três foram fechadas pelo mesmo motivo:
 * **ninguém as chama**, e a única coisa que as mantinha inofensivas era
 * `login_attempts` estar vazia — porque o hook que a encheria é de plano pago.
 *
 * É "proteção acidental", que a POSTURA §1.3 manda tratar como **sorte
 * esperando expirar**. No dia em que o contador for ligado, uma delas
 * reaberta significa: quem está com bloqueio temporário e tem uma sessão aberta
 * em outra aba limpa o próprio bloqueio, e o contador passa a mentir para a
 * equipe.
 *
 * ── O que esta trava NÃO garante, dito antes que alguém confie demais ──────
 *
 * Que o **banco** esteja assim. Um `GRANT` dado direto no editor SQL, sem
 * migration, passa por aqui sem ser visto. O que reduz esse risco é o
 * `scripts/espelho-de-migrations.mjs`, que reprova quando a **contagem** do
 * repositório diverge da do banco — e a disciplina do `BANCO.md`, que manda
 * toda mudança de schema ir por `apply_migration`.
 *
 * O que ela garante é o caminho realista de a porta reabrir: alguém escrever
 * uma migration nova que reconcede, sem perceber que está desfazendo a SEC-024.
 */

const PASTA = 'supabase/migrations';

/** As três portas do contador, e o motivo de cada uma estar fechada. */
const FECHADAS_PARA_AUTHENTICATED = {
  reset_login_attempts:
    'SEC-024 — apagaria o próprio histórico de tentativas. Quem zera em login '
    + 'bem-sucedido é o hook, com um DELETE próprio.',
  check_login_status:
    'SEC-022 — porta morta: a tela de login parou de chamá-la em 11/09.',
  contabilizar_falha_de_login:
    'quem conta é o Password Verification Hook, pelo servidor. Chamável pelo '
    + 'cliente, ela fabrica bloqueio sem saber a senha.',
};

/**
 * Tira comentário de SQL — `--` até o fim da linha, e bloco `/* … *␟/`.
 *
 * **Isto não é zelo, é a correção de um bug desta própria trava.** A primeira
 * versão acusou `reset_login_attempts` como ABERTA, contradizendo o que eu
 * tinha medido no `pg_proc` minutos antes. A causa: a migration da SEC-024
 * explica, em comentário, que a função *"estava com `GRANT EXECUTE … TO
 * authenticated` desde 06/06"* — e o varredor leu a frase como se fosse o
 * comando.
 *
 * É a **sétima vez** que este projeto é mordido por trava que lê a PROSA em vez
 * do CÓDIGO, e a terceira no mesmo dia (antes foram JSX e YAML; esta é SQL).
 * A lição não é "prestar atenção": é que **todo varredor de fonte começa
 * cortando comentário**, antes de qualquer regex.
 */
function semComentariosSQL(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

/**
 * Reconstrói o estado final de `EXECUTE` para `authenticated`, aplicando cada
 * comando na ordem em que as migrations rodam.
 */
function temExecuteParaAuthenticated(funcao, migrations) {
  let concedido = false;

  for (const { nome, sql: cru } of migrations) {
    const sql = semComentariosSQL(cru);
    // Um comando por vez, na ordem em que aparece no arquivo: a mesma migration
    // pode revogar de todos e reconceder a um só — foi o que a de 06/06 fez.
    for (const comando of sql.split(';')) {
      if (!new RegExp(`\\b${funcao}\\b`).test(comando)) continue;
      if (!/\bON\s+FUNCTION\b/i.test(comando)) continue;

      const alvos = comando.split(/\bTO\b|\bFROM\b/i)[1] ?? '';
      if (!/\bauthenticated\b/i.test(alvos)) continue;

      if (/^\s*GRANT\b/i.test(comando)) concedido = true;
      else if (/^\s*REVOKE\b/i.test(comando)) concedido = false;
      void nome;
    }
  }
  return concedido;
}

describe('as três portas do contador de login estão fechadas para `authenticated`', () => {
  const arquivos = readdirSync(PASTA).filter((n) => n.endsWith('.sql')).sort();

  // Sem esta guarda, renomear a pasta deixaria todos os `it` abaixo passando
  // por vacuidade — a classe de teste que não consegue falhar, que já mordeu
  // este projeto duas vezes.
  it('encontrou as migrations', () => {
    expect(
      arquivos.length,
      `Nenhuma migration em \`${PASTA}\`. A pasta mudou de lugar?\n`
      + '  Sem elas esta trava aprova qualquer coisa sem ter olhado nada.',
    ).toBeGreaterThan(150);
  });

  const migrations = arquivos.map((nome) => ({
    nome, sql: readFileSync(join(PASTA, nome), 'utf8'),
  }));

  it.each(Object.keys(FECHADAS_PARA_AUTHENTICATED))(
    '`%s` não tem EXECUTE para authenticated',
    (funcao) => {
      // Guarda de vacuidade por função: se o nome mudar, o varredor não acha
      // comando nenhum e devolveria "fechada" — verde sem ter olhado.
      const citada = migrations.some((m) => new RegExp(`\\b${funcao}\\b`).test(semComentariosSQL(m.sql)));
      expect(
        citada,
        `Nenhuma migration menciona \`${funcao}\`.\n`
        + '  Ou a funcao foi renomeada, ou nunca existiu — e nos dois casos esta\n'
        + '  asercao estaria passando sem verificar nada.',
      ).toBe(true);

      expect(
        temExecuteParaAuthenticated(funcao, migrations),
        `\`${funcao}\` voltou a ter EXECUTE para \`authenticated\`.\n\n`
        + `  Por que ela foi fechada: ${FECHADAS_PARA_AUTHENTICATED[funcao]}\n\n`
        + '  Isto é a metade que o `e2e/portas-do-banco.mjs` NÃO vê: ele bate com\n'
        + '  a chave anônima, e prova só o lado de quem não tem conta.\n\n'
        + '  Se a reabertura for proposital, apague a entrada desta lista NO MESMO\n'
        + '  PR — e escreva ao lado qual tela passou a chamar a função.',
      ).toBe(false);
    },
  );
});
