import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[19/09]` SEC-043 — estado do operador faz parte da autorização.
 *
 * ── A causa-raiz, que é uma ASSIMETRIA ────────────────────────────────────
 *
 * O projeto já tinha a regra certa, de um lado só:
 *
 *     pode_publicar()  ->  NOT banned AND NOT suspended     (usada no INSERT)
 *     is_staff()       ->  role_rank >= 2                   (só cargo)
 *
 * Aplicou o estado operacional a PUBLICAR e nunca a MODERAR. Por isso N43–N48
 * não eram seis bugs: eram um, visto por seis janelas.
 *
 * Medido antes, com papel `authenticated` real e o valor RELIDO do banco (não
 * "sem exceção"): admin BANIDO suspendeu, baniu e desbaniu; admin SUSPENSO
 * suspendeu e baniu. Tudo persistiu.
 *
 * ── A porta que o ataque contra a própria correção encontrou ─────────────
 *
 * A 1ª versão só guardava as RPCs. O admin banido moderou assim mesmo:
 *
 *     UPDATE posts SET hidden_at = now() WHERE id = ...   -> PERSISTIU
 *
 * É o caminho do `moderationService.setHiddenAt`: UPDATE direto, RLS, sem RPC.
 * Por isso a guarda entra nos três HELPERS, não só nas funções — e é o que
 * faz 24 policies herdarem a correção de uma vez.
 *
 * ── O que esta trava NÃO cobre, dito para ninguém confiar demais ─────────
 *
 * Uma RPC administrativa **nova** não entra sozinha na lista da SEC-043. Este
 * teste pega a lista encolhendo, não a lista ficando para trás — para isso
 * seria preciso ler o banco no CI, credencial que este projeto já recusou três
 * vezes. Está registrado como risco residual no `BACKLOG.md`.
 *
 * ── Provada reinjetando cada bug (§2) ────────────────────────────────────
 *
 *   . tirado `AND operador_ativo()` do is_staff   -> falha nomeando a porta RLS
 *   . removida uma função da lista de injeção     -> falha nomeando a função
 *   . `operador_ativo` deixando de isentar o owner -> falha explicando o travamento
 */

const PASTA = 'supabase/migrations';

/** Comentário de SQL é PROSA, e prosa cita comando. Já me pegou 10 vezes. */
function semComentariosSQL(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function migrationsEmOrdem() {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) throw new Error(`Nenhuma migration em "${PASTA}".`);
  return nomes.map(n => semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')));
}

const SQL = migrationsEmOrdem().join('\n');

/** O corpo da ÚLTIMA definição de uma função, que é a que vale hoje. */
function ultimaDefinicao(nome) {
  const re = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${nome}\\s*\\([^)]*\\)[\\s\\S]*?\\$fn\\$[\\s\\S]*?\\$fn\\$`,
    'gi');
  const achados = SQL.match(re);
  return achados ? achados[achados.length - 1] : null;
}

describe('SEC-043 — a política existe e é UMA só', () => {
  it('`operador_ativo()` existe nas migrations', () => {
    expect(ultimaDefinicao('operador_ativo'), [
      'A função `operador_ativo()` sumiu das migrations.',
      'Ela é a política central: "este chamador pode exercer poder AGORA?".',
      'Sem ela, cargo volta a ser a única pergunta e a família N43–N48 reabre.',
    ].join('\n')).toBeTruthy();
  });

  it('o OWNER é isento, e isso é deliberado', () => {
    expect(ultimaDefinicao('operador_ativo'), [
      'O `operador_ativo()` deixou de isentar o owner.',
      '',
      'Isso NÃO é endurecimento — é um travamento sem volta. Medido:',
      "  role_rank('owner') = 4, maior rank não-owner = 2",
      '  `ban_user` exige rank(caller) > rank(alvo)',
      '',
      'Ou seja: ninguém consegue banir o owner pelo produto, então isentá-lo não',
      'abre caminho nenhum. Mas se ele ficar marcado como banido por um bug ou',
      'por um UPDATE direto, NÃO existe autoridade acima dele para desfazer —',
      'o fundador fica trancado fora do próprio site, para sempre.',
    ].join('\n')).toMatch(/role\s*=\s*'owner'/i);
  });

  // A porta que o ataque achou. Sem isto, a moderação inteira fica aberta pelo
  // UPDATE direto, e só as RPCs estariam protegidas.
  const HELPERS = ['is_staff', 'is_super', 'can_moderate_content'];

  it.each(HELPERS)('`%s()` consulta o estado do operador, não só o cargo', (nome) => {
    const corpo = ultimaDefinicao(nome);
    expect(corpo, `A função \`${nome}()\` sumiu das migrations.`).toBeTruthy();

    expect(corpo, [
      `\`${nome}()\` voltou a olhar SÓ o cargo.`,
      '',
      'Ela alimenta as policies de RLS da moderação. Sem `operador_ativo()`, um',
      'admin BANIDO volta a moderar por UPDATE direto na tabela — que é o',
      'caminho real do `moderationService.setHiddenAt`, sem passar por RPC',
      'nenhuma. Medido: o `hidden_at` PERSISTIU.',
      '',
      'Guardar só a RPC e deixar este helper cru é fechar a porta e deixar a',
      'janela — e o relatório diria "corrigido".',
    ].join('\n')).toMatch(/operador_ativo\s*\(\s*\)/i);
  });
});

describe('SEC-043 — a lista de RPCs guardadas não encolhe', () => {
  // A SEC-043 injeta a guarda percorrendo esta lista. Se alguém tirar um nome
  // dela, aquela função perde a proteção sem nenhum sinal.
  const EXIGEM_GUARDA = [
    'apply_suspension', 'lift_suspension', 'ban_user', 'unban_user',
    'approve_unban_request', 'deny_unban_request', 'admin_unlock_login',
    'decide_role_demotion', 'nominate_staff', 'review_staff_nomination',
    'decide_staff_trial', 'soft_delete_post', 'restore_post', 'notify_user',
    'notify_owner', 'admin_delete_unconfirmed_user', 'owner_set_site_config',
    'contato_registrar_resposta', 'request_role_demotion', 'admin_set_role',
    'owner_set_role', 'admin_list_users', 'admin_get_unconfirmed_users',
    'get_blocked_logins', 'contato_dados_para_resposta',
  ];

  const blocoDeInjecao = (() => {
    const m = SQL.match(/DO\s+\$inj\$[\s\S]*?\$inj\$/g);
    return m ? m[m.length - 1] : null;
  })();

  it('o bloco de injeção da SEC-043 existe', () => {
    expect(blocoDeInjecao, [
      'O bloco que injeta `exige_operador_ativo()` nas RPCs sumiu.',
      'Sem ele, 25 funções administrativas voltam a confiar só no cargo.',
    ].join('\n')).toBeTruthy();
  });

  it.each(EXIGEM_GUARDA)('`%s` continua na lista que recebe a guarda', (nome) => {
    expect(blocoDeInjecao?.includes(`'${nome}'`), [
      `A RPC \`${nome}\` saiu da lista da SEC-043.`,
      '',
      'Ela é administrativa e muda estado (ou lê dado administrativo). Fora da',
      'lista, um operador BANIDO ou SUSPENSO volta a executá-la — e nada',
      'estoura: a função continua existindo e respondendo normalmente.',
      '',
      'Se ela foi removida do sistema, tire o nome DESTA lista também, no mesmo',
      'PR, para a trava não virar decoração.',
    ].join('\n')).toBe(true);
  });
});
