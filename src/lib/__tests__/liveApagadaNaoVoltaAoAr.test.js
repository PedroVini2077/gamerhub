import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[19/09]` LIVE-050 — live APAGADA voltava ao ar pelo painel, e cada volta
 * gravava uma sessão que paga XP.
 *
 * Bug encontrado pelo dono clicando no site: *"assim que exclui um post de
 * live, eu consigo ativar e reativar a live mesmo estando apagado, lá pelo
 * painel"*.
 *
 * ── O que eu medi, e era pior do que o relato ─────────────────────────────
 *
 * Reproduzido em ROLLBACK, com o post já apagado:
 *
 *   0_estado_apos_apagar         is_live=false  deleted_at=SIM
 *   1_apos_REATIVAR_pelo_painel  is_live=true   deleted_at=SIM
 *   2_ESTADO_IMPOSSIVEL          SIM — no ar E apagado ao mesmo tempo
 *   3_aparece_no_fetchActiveLives  não (o filtro `deleted_at` segura)
 *   4_sessoes_registradas        2
 *
 * A linha 3 é a que engana: a tela NÃO mostrava a live, então o sintoma
 * visível era só um botão que parecia funcionar. A linha 4 é o estrago — cada
 * ciclo ativar/desativar de um post apagado gravava uma sessão em
 * `lives_realizadas`, e a view de XP paga por sessão registrada. Um post
 * apagado virava máquina de XP acionável pelo painel.
 *
 * ── A causa raiz: o CHECK do SEC-034 cobria o PAR ERRADO ──────────────────
 *
 * O SEC-034 já tinha decidido que "no ar" e "encerrada" não coexistem, e
 * travou isso com `posts_live_no_ar_nao_tem_fim` (`is_live` × `live_ended_at`).
 * O par `is_live` × `deleted_at` ficou de fora — mesma CLASSE de estado
 * impossível, outro par de colunas. E o `set_live_ended_at` tinha o caminho de
 * IDA (apagar uma live no ar encerra ela) sem a VOLTA.
 *
 * ── Por que esta trava tem QUATRO asserções e não uma ─────────────────────
 *
 * As três camadas do conserto são independentes de propósito, então a trava
 * precisa vigiar as três separadamente: se alguém amanhã mexer no trigger e
 * achar que o CHECK cobre, ou vice-versa, o teste tem que dizer QUAL caiu.
 *
 * ── Provada reinjetando cada bug (§2) ─────────────────────────────────────
 *
 *   . tirado o `RAISE EXCEPTION` do `set_live_ended_at`
 *       -> falhou apontando "o painel volta a reativar post apagado"
 *   . tirado `OLD.deleted_at IS NULL` do `registrar_live_realizada`
 *       -> falhou apontando "sessão de post apagado volta a pagar XP"
 *   . apagado o `ADD CONSTRAINT posts_live_apagada_nao_fica_no_ar`
 *       -> falhou apontando a camada de 1ª força que sumiu
 *   . posto `SECURITY DEFINER` no `set_live_ended_at`
 *       -> falhou apontando a lição do PR #217
 *
 * ── O que ela NÃO cobre ───────────────────────────────────────────────────
 *
 * Alguém desfazendo isto direto no editor SQL, sem migration. O REVOKE das
 * duas funções também não está aqui: ele é da `funcaoDeTriggerNaoEhRpc`, que
 * vigia a CLASSE inteira. Duplicar ali criaria duas fontes de verdade (§4).
 */

const PASTA = 'supabase/migrations';

/** Comentário de SQL é PROSA, e prosa cita comando. Já me pegou 10 vezes. */
function semComentariosSQL(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function migrationsEmOrdem() {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) {
    throw new Error(`Nenhuma migration em "${PASTA}" — a pasta mudou de lugar?`);
  }
  return nomes.map(n => semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')));
}

/** O corpo da ÚLTIMA ocorrência de um padrão, que é a que vale hoje. */
function ultimo(re) {
  let corpo = null;
  for (const sql of migrationsEmOrdem()) {
    const achados = sql.match(re);
    if (achados) corpo = achados[achados.length - 1];
  }
  return corpo;
}

/**
 * O corpo da última definição de uma função de trigger.
 *
 * O `\$(?:fn)?\$` cobre as duas marcações que este projeto usa: as migrations
 * de junho fecham com `$$` e as de setembro com `$fn$`. Ancorar só numa delas
 * faria a trava parar de achar a função no dia em que alguém usasse a outra —
 * e ela passaria VERDE, que é o pior tipo de falha (`varrerFontes`).
 */
function funcao(nome) {
  const corpo = ultimo(new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${nome}\\s*\\(\\)[\\s\\S]*?\\$(?:fn)?\\$\\s*;`,
    'gi',
  ));
  if (!corpo) {
    throw new Error(
      `A função \`${nome}\` sumiu das migrations, ou a marcação de corpo mudou.\n`
      + '  Sem ela esta trava não olha nada — corrija o padrão ou apague a trava.');
  }
  return corpo;
}

describe('LIVE-050 — live apagada não volta ao ar e não gera XP', () => {
  const guarda = funcao('set_live_ended_at');

  it('o trigger RECUSA reativar uma live cujo post está apagado', () => {
    // As duas metades: reconhecer a tentativa, e levantar em vez de engolir.
    expect(guarda, [
      'O `set_live_ended_at` parou de olhar `NEW.deleted_at` ao ligar a live.',
      '',
      'Isso reabre o bug que o dono encontrou clicando: pelo painel dava para',
      'reativar a live de um post APAGADO. O post ficava `is_live = true` e',
      '`deleted_at IS NOT NULL` ao mesmo tempo — estado impossível — e cada',
      'ciclo ativar/desativar gravava uma sessão em `lives_realizadas`, que',
      'paga 30 XP. Medido: 2 sessões em 2 cliques.',
      '',
      'O ramo precisa ser: ligando a live (`NEW.is_live` e não `OLD.is_live`)',
      'com `NEW.deleted_at IS NOT NULL` -> recusa.',
    ].join('\n')).toMatch(
      /NOT\s+COALESCE\s*\(\s*OLD\.is_live[\s\S]{0,120}?NEW\.deleted_at\s+IS\s+NOT\s+NULL/i,
    );

    expect(guarda, [
      'O `set_live_ended_at` deixou de LEVANTAR ao recusar a reativação.',
      '',
      'Forçar `is_live := false` em silêncio resolveria o estado e criaria o',
      '§1.5: um botão do painel que não faz nada e não explica. O painel já faz',
      '`toast.error(\'Erro ao reativar: \' + err.message)`, então a mensagem',
      'chega na tela de quem clicou — mas só se a função levantar.',
    ].join('\n')).toMatch(/RAISE\s+EXCEPTION[^;]*apagada/i);
  });

  it('o guard do trigger NÃO é `SECURITY DEFINER` — a lição do PR #217', () => {
    expect(/SECURITY\s+DEFINER/i.test(guarda), [
      'O `set_live_ended_at` ganhou `SECURITY DEFINER`, e isso o QUEBRA.',
      '',
      'Ele é guarda de coluna e precisa rodar como QUEM CHAMA. Sob DEFINER,',
      '`current_user` vira o dono da função (`postgres`) para todo mundo, e',
      'qualquer decisão baseada em papel passa a valer para o site inteiro.',
      '',
      'Foi exatamente esse erro que quase reverteu a SEC-027 inteira no PR',
      '#217: eu escrevi `SECURITY DEFINER` num guard de `posts` e só descobri',
      'porque três asserções de ROLLBACK falharam juntas.',
      '',
      'Se um dia ele precisar mesmo escrever onde o chamador não alcança, o',
      'caminho é uma função separada — não trocar o modo desta.',
    ].join('\n')).toBe(false);
  });

  it('a sessão só é registrada se o post estava NO AR durante a live', () => {
    expect(funcao('registrar_live_realizada'), [
      'O `registrar_live_realizada` parou de exigir `OLD.deleted_at IS NULL`.',
      '',
      'Essa condição é a 2ª camada, e ela existe SEPARADA do bloqueio de',
      'propósito: se algum caminho futuro reabrir o estado impossível, o XP',
      'continua fechado. Sem ela, ciclar um post já apagado volta a gravar',
      'sessão — e a view `xp_dos_usuarios` paga por sessão registrada.',
      '',
      'Cuidado ao mexer: apagar uma live que está NO AR **precisa** continuar',
      'registrando (SEC-034). A diferença está em `OLD`, não em `NEW`.',
    ].join('\n')).toMatch(/OLD\.deleted_at\s+IS\s+NULL/i);
  });

  it('o estado impossível é barrado por CHECK, e não só pelo trigger', () => {
    const check = ultimo(
      /ADD\s+CONSTRAINT\s+posts_live_apagada_nao_fica_no_ar[\s\S]*?;/gi,
    );

    expect(check, [
      'O CHECK `posts_live_apagada_nao_fica_no_ar` sumiu das migrations.',
      '',
      'Ele é a única camada de 1ª força da tabela do §2: com ele, o estado',
      '"no ar E apagado" passa a ser IMPOSSÍVEL de existir, venha de onde vier',
      '— REST API com a anon key, trigger novo, `UPDATE` cru pelo MCP.',
      '',
      'Trigger é 2ª força: ele cobre o caminho que passa por ele.',
      '',
      'Ele é irmão do `posts_live_no_ar_nao_tem_fim` (SEC-034) — mesma classe,',
      'o par de colunas que tinha ficado de fora, e foi essa metade faltando',
      'que deixou o bug do painel de pé.',
    ].join('\n')).toBeTruthy();

    expect(check, [
      'O CHECK `posts_live_apagada_nao_fica_no_ar` mudou de predicado.',
      '',
      'Ele tem que negar a COMBINAÇÃO `is_live` + `deleted_at IS NOT NULL`.',
      'O `COALESCE(is_live,false)` não é decoração: `is_live` é anulável, e em',
      'SQL `NULL AND true` é `NULL`, que o CHECK aceita — sem o COALESCE o',
      'estado impossível volta a passar por um post com `is_live` nulo.',
    ].join('\n')).toMatch(
      /NOT\s*\(\s*COALESCE\s*\(\s*is_live\s*,\s*false\s*\)\s+AND\s+deleted_at\s+IS\s+NOT\s+NULL\s*\)/i,
    );
  });
});
