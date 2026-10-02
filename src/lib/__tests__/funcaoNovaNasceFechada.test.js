import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[02/10]` SEC-056 — toda funcao nova nasce FECHADA para `anon` e `PUBLIC`.
 *
 * ── O que mudou, e por que isto e uma trava diferente do SEC-042 ───────────
 *
 * O `funcaoDeTriggerNaoEhRpc.test.js` trava um CASO: funcao de trigger sem
 * `REVOKE`. Ele mesmo diz, no cabecalho, que fechar o MECANISMO era mudanca de
 * contrato esperando decisao do dono. Ela foi tomada em 02/10, e o mecanismo e
 * um EVENT TRIGGER em `ddl_command_end`: o banco escreve o `REVOKE` sozinho.
 *
 * Esta trava nao repete aquela. Ela cuida das tres formas de o MECANISMO
 * morrer sem ninguem notar.
 *
 * ── (1) O event trigger sumir da migration ────────────────────────────────
 *
 * Sem ele, toda funcao criada daqui para frente volta a nascer chamavel por
 * quem nao tem conta, e **nada estoura**: o `CREATE FUNCTION` continua
 * passando, o build continua verde, e o buraco so aparece numa auditoria.
 *
 * ── (2) As DUAS listas de excecao divergirem ──────────────────────────────
 *
 * A mesma lista de quatro funcoes existe em dois lugares:
 *
 *     o event trigger daqui          -> quem ele NAO fecha
 *     `auditoria_de_operadores()`    -> quem ele NAO acusa (4a checagem)
 *
 * Duas copias divergem (§4, fonte unica). E a divergencia e silenciosa nos
 * DOIS sentidos, com estragos opostos:
 *
 *     so no trigger   -> a funcao fica aberta E o auditor a acusa para sempre
 *                        = alarme que grita certo e nunca some (§0.2, 4a regra)
 *     so no auditor   -> o trigger FECHA uma funcao que o publico precisa, e
 *                        o auditor concorda em silencio. O cadastro para de
 *                        conferir apelido e ninguem fica sabendo.
 *
 * O segundo caso e o perigoso, e ele e real: `CREATE OR REPLACE` de uma funcao
 * que ja existe **tambem** dispara `ddl_command_end` com a tag
 * `CREATE FUNCTION`. Editar `username_disponivel` sem ela na lista arrancaria
 * o `anon` dela na hora.
 *
 * ── (3) A propria funcao do trigger ficar aberta ──────────────────────────
 *
 * Ela e `SECURITY DEFINER` e nao se fecha sozinha: no instante em que o
 * `CREATE FUNCTION` dela roda, o event trigger ainda nao existe.
 *
 * ── Por que ela le MIGRATION e nao o banco ────────────────────────────────
 *
 * Mesma razao do SEC-042: conferir privilegio de verdade exigiria credencial
 * de banco no CI, troca que este projeto ja recusou tres vezes. O
 * `espelho-de-migrations` reprova quando a contagem de arquivos diverge da do
 * banco, entao a migration nao pode ficar para tras em silencio.
 *
 * **O que ela nao cobre:** alguem removendo o event trigger direto no editor
 * SQL. Isso e detectado pelo outro lado — a 4a checagem de
 * `auditoria_de_operadores()`, cujo numero o `e2e/portas-do-banco.mjs` le com
 * a anon key.
 *
 * ── Provada reinjetando o bug (§2) ────────────────────────────────────────
 *
 * Tres reinjecoes, uma por checagem — ver o relatorio da sessao.
 */

const PASTA = 'supabase/migrations';

/** Comentario de SQL e PROSA, e esta migration cita os nomes na prosa. */
function semComentariosSQL(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function migrations() {
  const nomes = readdirSync(PASTA).filter((f) => f.endsWith('.sql')).sort();
  if (!nomes.length) throw new Error(`nenhuma migration lida em ${PASTA}/ — a pasta mudou de nome?`);
  return nomes.map((n) => ({ nome: n, sql: semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')) }));
}

/** A ULTIMA migration que define algo e a que vale — igual ao banco. */
function ultimaQueCasa(padrao) {
  const achadas = migrations().filter((m) => padrao.test(m.sql));
  return achadas.length ? achadas[achadas.length - 1] : null;
}

/** Os nomes de dentro de uma lista SQL `('a','b','c')`, em ordem. */
function nomesDaLista(trecho) {
  return [...trecho.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort();
}

describe('SEC-056 — funcao nova nasce fechada para anon', () => {
  it('o EVENT TRIGGER existe, em ddl_command_end e na tag CREATE FUNCTION', () => {
    const m = ultimaQueCasa(/CREATE\s+EVENT\s+TRIGGER\s+fecha_funcao_nova_para_anon/i);
    expect(
      m,
      'nenhuma migration cria o event trigger `fecha_funcao_nova_para_anon`.\n'
      + '    Sem ele, TODA funcao criada daqui para frente volta a nascer\n'
      + '    chamavel por `anon` via /rest/v1/rpc/ — o `pg_default_acl` do\n'
      + '    schema public da EXECUTE a `anon` e a `PUBLIC` sozinho.\n'
      + '    Nada estoura quando isso acontece: o CREATE FUNCTION passa.\n'
      + '    Restaure o CREATE EVENT TRIGGER em supabase/migrations/.',
    ).not.toBeNull();

    const bloco = m.sql.match(/CREATE\s+EVENT\s+TRIGGER\s+fecha_funcao_nova_para_anon[\s\S]*?;/i)[0];
    expect(
      /ON\s+ddl_command_end/i.test(bloco),
      'o event trigger nao esta em `ddl_command_end`.\n'
      + '    Em `ddl_command_start` o `pg_event_trigger_ddl_commands()` ainda\n'
      + '    nao tem a funcao criada, e o REVOKE nao tem alvo.',
    ).toBe(true);
    expect(
      /WHEN\s+TAG\s+IN\s*\(\s*'CREATE FUNCTION'\s*\)/i.test(bloco),
      'o event trigger nao filtra a tag `CREATE FUNCTION`.\n'
      + '    Sem o filtro ele roda em TODO comando DDL do projeto.',
    ).toBe(true);
  });

  it('a lista de excecao do trigger e a do auditor sao a MESMA', () => {
    const t = ultimaQueCasa(/FUNCTION\s+public\.fecha_funcao_nova_para_anon\s*\(\)/i);
    expect(t, 'nenhuma migration define `fecha_funcao_nova_para_anon()`.').not.toBeNull();
    const regex = t.sql.match(/\^public\\\.\(([^)]+)\)/);
    expect(
      regex,
      'nao achei a lista de excecao dentro de `fecha_funcao_nova_para_anon()`.\n'
      + '    Ela e o `~ \'^public\\.(a|b|c)\\(\'` do corpo. Se o formato mudou,\n'
      + '    ajuste ESTA trava junto — senao ela passa a aprovar qualquer lista.',
    ).not.toBeNull();
    const doTrigger = regex[1].split('|').map((s) => s.trim()).sort();

    const a = ultimaQueCasa(/alcancavel por ANON/);
    expect(a, 'nenhuma migration define a 4a checagem do auditor.').not.toBeNull();
    const trecho = a.sql.match(/alcancavel por ANON[\s\S]*?NOT IN\s*\(([^)]+)\)/);
    expect(
      trecho,
      'nao achei o `NOT IN` da 4a checagem de `auditoria_de_operadores()`.',
    ).not.toBeNull();
    const doAuditor = nomesDaLista(trecho[1]);

    expect(doTrigger.length, 'a lista do trigger ficou vazia — a extracao quebrou.').toBeGreaterThan(0);
    expect(
      doTrigger,
      'as duas listas de excecao DIVERGIRAM, e a divergencia e silenciosa:\n'
      + `    event trigger : ${doTrigger.join(', ')}\n`
      + `    auditor       : ${doAuditor.join(', ')}\n`
      + '\n'
      + '    So no TRIGGER  -> a funcao fica aberta e o auditor a acusa para\n'
      + '                      sempre; alarme que nunca some ensina a ignorar.\n'
      + '    So no AUDITOR  -> pior: o trigger ARRANCA o `anon` de uma funcao\n'
      + '                      que o publico precisa, e o auditor concorda.\n'
      + '                      `CREATE OR REPLACE` tambem dispara a tag\n'
      + '                      `CREATE FUNCTION`, entao basta editar a funcao.\n'
      + '\n'
      + '    Acrescente o nome nos DOIS lugares, com uma migration nova.',
    ).toEqual(doAuditor);
  });

  it('a propria funcao do event trigger nao fica aberta', () => {
    const m = ultimaQueCasa(/FUNCTION\s+public\.fecha_funcao_nova_para_anon\s*\(\)/i);
    expect(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.fecha_funcao_nova_para_anon\s*\(\)\s*FROM[^;]*\banon\b/i
        .test(m.sql),
      'a funcao `fecha_funcao_nova_para_anon()` nao tem REVOKE para `anon`.\n'
      + '    Ela e a unica que o mecanismo nao alcanca: quando o CREATE\n'
      + '    FUNCTION dela roda, o event trigger ainda nao existe. Entao o\n'
      + '    REVOKE dela precisa estar escrito a mao, na mesma migration.',
    ).toBe(true);
  });
});
