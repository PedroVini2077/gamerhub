import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[18/09]` SEC-042 — funcao de TRIGGER nao pode ser porta de RPC.
 *
 * ── O caso real, e ele e meu, das ultimas cinco horas ──────────────────────
 *
 * O `get_advisors` acusou, na faxina da propria rodada que as criou:
 *
 *     registrar_live_realizada          (LIVE-036)
 *     invalidar_lives_do_post_moderado  (LIVE-040)
 *
 * As duas chamaveis por `anon` e `authenticated` via `/rest/v1/rpc/`. E a
 * classe ja estava escrita no `AUDITORIA.md`, Fase 4 — o `checar_palavras_
 * bloqueadas` tinha passado por isso antes. A higiene do projeto estava certa;
 * quem furou fui eu, ao criar funcao nova sem repetir o revoke.
 *
 * ── Por que elas nascem abertas (a causa raiz, medida) ────────────────────
 *
 * `pg_default_acl` do schema `public`, para funcoes criadas pelo papel
 * `postgres` — que e o papel do `apply_migration`:
 *
 *     {postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, ...}
 *
 * **Toda funcao nova nasce com EXECUTE para `anon`.** Para TABELA o projeto ja
 * fechou esse padrao (SEC-005); para FUNCAO ele continua aberto. Fechar isso de
 * vez e mudanca de contrato do schema inteiro (§7 🟡), entao esta proposta ao
 * dono no `BACKLOG.md` — e enquanto ela nao for decidida, este teste e o que
 * segura a classe.
 *
 * ── Severidade: 🔵 BAIXO, dito para nao inflar o achado ───────────────────
 *
 * Chamada como RPC, uma funcao de trigger nao tem `NEW` nem `OLD` e estoura em
 * "record new is not assigned yet". Nao da para forjar live nem invalidar XP
 * por ali. Fecha mesmo assim porque "so e inofensiva enquanto o corpo nao mexer
 * em nada antes de tocar em NEW" e a protecao acidental do §1.3.
 *
 * ── Por que a trava le MIGRATION e nao o banco ────────────────────────────
 *
 * Conferir privilegio de verdade exigiria credencial de banco no CI — a troca
 * que este projeto ja recusou tres vezes. As migrations sao o historico, e o
 * `espelho-de-migrations` reprova quando a contagem diverge do banco.
 *
 * **O que ela nao cobre:** alguem criando funcao direto no editor SQL. O que
 * ela cobre e o caminho realista, que foi o que aconteceu hoje.
 *
 * ── Provada reinjetando o bug (§2) ────────────────────────────────────────
 *
 * Removido o `REVOKE` da SEC-042 -> falhou nomeando as duas funcoes e o
 * comando exato que faltava.
 */

const PASTA = 'supabase/migrations';

/** Comentario de SQL e PROSA, e prosa cita comando. Ja me pegou 10 vezes. */
function semComentariosSQL(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/**
 * As funcoes de trigger anteriores a SEC-042, fechadas UMA A UMA na auditoria
 * das 48 (SEC-026) em vez de por `REVOKE` na propria migration.
 *
 * Nao e lista de perdao: e o retrato de 18/09, **conferido no banco** com
 *
 *     SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 *      WHERE n.nspname='public' AND p.prorettype='trigger'::regtype
 *        AND (has_function_privilege('anon', p.oid,'EXECUTE')
 *          OR has_function_privilege('authenticated', p.oid,'EXECUTE'));
 *
 * que devolveu **zero linhas** depois da SEC-042. Se alguma voltar a abrir, o
 * `get_advisors` acusa — este teste guarda a porta das funcoes NOVAS.
 */
const FECHADAS_ANTES_DA_SEC_042 = new Set([
  'checar_palavras_bloqueadas',
  'enfileirar_conteudo_denunciado',
  'guard_idade_minima',
  'guard_post_privileged_cols',
  'guard_profile_privileged_cols',
  'handle_new_user',
  'handle_report_auto_hide',
  'handle_violation_escalation',
  'log_post_event',
  'log_report_created',
  'notify_admin_new_live',
  'notify_admin_new_user',
  'notify_admin_reactivation_request',
  'notify_comment_like',
  'notify_post_comment',
  'notify_post_like',
  'resolver_moderacao_de_conteudo_apagado',
  'set_live_ended_at',
]);

function migrationsEmOrdem() {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) {
    throw new Error(`Nenhuma migration em "${PASTA}" — a pasta mudou de lugar?`);
  }
  return nomes.map(n => semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')));
}

describe('SEC-042 — funcao de trigger nao e porta de RPC', () => {
  const sql = migrationsEmOrdem().join('\n');

  const deTrigger = [...new Set(
    [...sql.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*RETURNS\s+trigger/gi)]
      .map(m => m[1]),
  )];

  const revogadas = new Set(
    [...sql.matchAll(/REVOKE\s+(?:ALL|EXECUTE)[^;]*?ON\s+FUNCTION\s+(?:public\.)?(\w+)/gi)]
      .map(m => m[1]),
  );

  it('a varredura leu alguma coisa — senao ela passa para sempre', () => {
    // Sem esta asserção, renomear a pasta ou mudar a forma do `CREATE` deixa a
    // lista vazia e o teste verde eternamente. É a classe de falha que o
    // `varrerFontes` existe para impedir.
    expect(deTrigger.length, [
      'A varredura nao achou NENHUMA funcao de trigger nas migrations.',
      'Isso nao quer dizer que nao existem — quer dizer que o padrao parou de',
      'casar (a pasta mudou, ou o `CREATE OR REPLACE FUNCTION ... RETURNS',
      'trigger` passou a ser escrito de outro jeito). Conserte a varredura.',
    ].join('\n')).toBeGreaterThan(10);
  });

  const novas = deTrigger.filter(n => !FECHADAS_ANTES_DA_SEC_042.has(n));

  it.each(novas)('`%s` tem o REVOKE na propria migration', (nome) => {
    expect(revogadas.has(nome), [
      `A funcao de trigger \`${nome}\` nao tem \`REVOKE EXECUTE\` em migration`,
      'nenhuma — entao ela nasce chamavel por `anon` e `authenticated` via',
      '`/rest/v1/rpc/`.',
      '',
      'Isso NAO e teoria: o `pg_default_acl` do schema da EXECUTE para `anon`',
      'em toda funcao criada pelo `postgres`, que e o papel do `apply_migration`.',
      'Foi medido em 18/09, e foi assim que a `registrar_live_realizada` e a',
      '`invalidar_lives_do_post_moderado` ficaram abertas no dia em que nasceram.',
      '',
      'Acrescente na migration que a cria:',
      '',
      `    REVOKE EXECUTE ON FUNCTION public.${nome}()`,
      '      FROM PUBLIC, anon, authenticated;',
      '',
      'Revogar EXECUTE **nao** desliga o trigger — o Postgres checa esse',
      'privilegio na CRIACAO do trigger, nao a cada disparo. Isso foi medido em',
      'ROLLBACK na SEC-042, nao deduzido do manual.',
    ].join('\n')).toBe(true);
  });
});
