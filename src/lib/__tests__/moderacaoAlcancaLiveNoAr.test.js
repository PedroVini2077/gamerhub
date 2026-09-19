import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[19/09]` LIVE-051 — a invalidação da moderação só alcançava sessão que JÁ
 * EXISTIA, e live no ar ainda não tem sessão.
 *
 * ── Como este bug foi achado, e por que isso importa ──────────────────────
 *
 * Não foi relatado. Saiu da **varredura de classe** do LIVE-050 (§1.3: *"onde
 * mais esse mesmo padrão existe?"*). O LIVE-050 fechou `is_live` × `deleted_at`;
 * a mesma pergunta, feita na coluna irmã, devolveu este — que é **pior**, porque
 * ocultar é o que a moderação mais faz.
 *
 * ── O mecanismo, em uma frase ─────────────────────────────────────────────
 *
 * `invalidar_lives_do_post_moderado` faz `UPDATE lives_realizadas WHERE
 * post_id = ...`. Uma live NO AR não tem linha ali, então moderar não invalida
 * nada — e a sessão que nasce depois nunca é revisitada.
 *
 * ── Medido em ROLLBACK, com papel `authenticated` real ────────────────────
 *
 *   ocultar uma live NO AR ........ is_live seguia `true`, XP `lives` 0 -> 1
 *   equipe apagar uma live NO AR .. sessão VÁLIDA gravada,  XP `lives` 0 -> 1
 *   live oculta, vista pela EQUIPE  ainda listada como "AO VIVO" (comum via 0)
 *
 * O terceiro é o SEC-034 se repetindo: a RLS escondia o problema de todo mundo
 * **menos de quem mais olha aquela tela**.
 *
 * ── Por que a correção é na CERTIDÃO DE NASCIMENTO ────────────────────────
 *
 * Inverter a ordem dos triggers fecharia só a porta do apagar — o ocultar
 * encerra a live minutos depois, em outro statement. Por isso a sessão passa a
 * **nascer** invalidada, e a varredura retrospectiva continua para a live que
 * já tinha acabado. Duas camadas independentes.
 *
 * ── Provada reinjetando os SETE modos de desfazer (§2) ────────────────────
 *
 *   . `registrar` sem o `motivo_de_invalidacao`  -> "sessão nasce válida"
 *   . `set_live_ended_at` sem o ramo de `hidden` -> "ocultar não tira do ar"
 *   . sem o `RAISE` de live oculta               -> "reativar oculta volta"
 *   . CHECK apagado                              -> "1ª força sumiu"
 *   . CHECK sem `COALESCE`                       -> "predicado mudou"
 *   . motivo literal na inversa (em vez da fn)   -> "duas fontes de verdade"
 *   . `hidden_at` fora do `fetchActiveLives`     -> "equipe volta a ver"
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
 * O corpo da última definição de uma função.
 *
 * O `\$(?:fn)?\$` cobre as duas marcações do projeto: as migrations de junho
 * fecham com `$$` e as de setembro com `$fn$`. Ancorar numa só faria a trava
 * parar de achar a função e passar VERDE — a falha que o `varrerFontes` existe
 * para impedir do outro lado.
 */
function funcao(nome) {
  const corpo = ultimo(new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${nome}\\s*\\([\\s\\S]*?\\$(?:fn)?\\$\\s*;`,
    'gi',
  ));
  if (!corpo) {
    throw new Error(
      `A função \`${nome}\` sumiu das migrations, ou a marcação de corpo mudou.\n`
      + '  Sem ela esta trava não olha nada — corrija o padrão ou apague a trava.');
  }
  return corpo;
}

describe('LIVE-051 — a moderação alcança a live que ainda está no ar', () => {
  it('a sessão NASCE invalidada quando o post já está sob moderação', () => {
    expect(funcao('registrar_live_realizada'), [
      'O `registrar_live_realizada` parou de consultar `motivo_de_invalidacao`',
      'ao gravar a sessão.',
      '',
      'Isso reabre o LIVE-051: a invalidação da moderação é RETROSPECTIVA — ela',
      'faz `UPDATE lives_realizadas WHERE post_id = ...`. Uma live que está NO',
      'AR não tem linha nenhuma ali, então moderar não invalida nada, e a sessão',
      'que nasce quando a live encerra nunca mais é revisitada.',
      '',
      'Medido antes: ocultar uma live no ar deixava o XP `lives` ir de 0 para 1.',
      'A punição da moderação simplesmente não alcançava o XP.',
      '',
      'A sessão precisa nascer com `invalidada_em`/`invalidada_motivo` já',
      'preenchidos quando `NEW.hidden_at`/`NEW.deleted_at` disserem que o post',
      'está sob moderação.',
    ].join('\n')).toMatch(/motivo_de_invalidacao\s*\(\s*NEW\.hidden_at\s*,\s*NEW\.deleted_at/i);
  });

  it('o motivo tem UMA fonte — a inversa casa por ele', () => {
    const invalidar = funcao('invalidar_lives_do_post_moderado');

    expect(invalidar, [
      'O ramo de RESTAURAR voltou a comparar `invalidada_motivo` com um texto',
      'literal em vez de chamar `motivo_de_invalidacao()`.',
      '',
      'São duas fontes de verdade para a mesma string (§4). A inversa casa por',
      'esse texto: mudar o motivo num lugar e não no outro faz `restaurar o',
      'post` parar de achar as linhas — e o XP NÃO volta, em silêncio (§1.5).',
      '',
      'O BANCO.md exige inversa para toda ação de estado. Uma inversa que existe',
      'mas não encontra nada é pior do que inversa nenhuma: ela parece funcionar.',
    ].join('\n')).toMatch(
      /invalidada_motivo\s*=\s*motivo_de_invalidacao\s*\(/i,
    );

    expect(funcao('motivo_de_invalidacao'), [
      'O `motivo_de_invalidacao` deixou de distinguir quem apagou.',
      '',
      'O autor apagando o PRÓPRIO post não perde o XP — a live aconteceu, e',
      'apagar o registro depois não desfaz o tempo transmitido. Só apagar por',
      'OUTRA pessoa é moderação.',
      '',
      'Sem o `p_ator <> p_autor`, o autor apagando o próprio post passaria a',
      'perder XP: punição que ninguém aplicou.',
    ].join('\n')).toMatch(/p_ator\s+IS\s+NOT\s+NULL\s+AND\s+p_ator\s*<>\s*p_autor/i);
  });

  it('ocultar uma live no ar ENCERRA ela, igual a apagar', () => {
    expect(funcao('set_live_ended_at'), [
      'O `set_live_ended_at` voltou a tratar só `deleted_at` ao tirar a live',
      'do ar, deixando `hidden_at` de fora.',
      '',
      'São o mesmo ato — sair do ar por moderação — e o SEC-034 só tinha escrito',
      'metade. Medido: depois de ocultar, `is_live` continuava `true`, e o post',
      'ficava oculto E no ar ao mesmo tempo.',
      '',
      'O ramo precisa cobrir as DUAS colunas.',
    ].join('\n')).toMatch(
      /OLD\.hidden_at\s+IS\s+NULL\s+AND\s+NEW\.hidden_at\s+IS\s+NOT\s+NULL[\s\S]{0,80}?NEW\.is_live\s*:=\s*false/i,
    );
  });

  it('reativar a live de um post OCULTO é recusado, e com mensagem', () => {
    expect(funcao('set_live_ended_at'), [
      'O `set_live_ended_at` deixou de recusar a reativação de uma live OCULTA.',
      '',
      'O LIVE-050 fechou isso para o post APAGADO. Ocultar é a outra metade — e',
      'é a que a moderação mais usa.',
      '',
      'Tem que LEVANTAR, não forçar `false` em silêncio: o painel faz',
      "`toast.error('Erro ao reativar: ' + err.message)`, então a mensagem chega",
      'na tela de quem clicou. Forçar o valor dá um botão que não faz nada e',
      'não explica — §1.5 com outro nome.',
    ].join('\n')).toMatch(/RAISE\s+EXCEPTION[^;]*oculta/i);
  });

  it('o estado impossível é barrado por CHECK, não só pelo trigger', () => {
    const check = ultimo(
      /ADD\s+CONSTRAINT\s+posts_live_oculta_nao_fica_no_ar[\s\S]*?;/gi,
    );

    expect(check, [
      'O CHECK `posts_live_oculta_nao_fica_no_ar` sumiu das migrations.',
      '',
      'Ele é a camada de 1ª força (§2): o estado "oculto E no ar" passa a ser',
      'IMPOSSÍVEL, venha de onde vier — REST API com a anon key, trigger novo,',
      '`UPDATE` cru. Trigger é 2ª força: cobre o caminho que passa por ele.',
      '',
      'CUIDADO ao mexer: este CHECK só é seguro porque o `checar_palavras_',
      'bloqueadas` passou a zerar `is_live` junto com o auto-ocultar. Sem isso,',
      'publicar uma live com termo `high` deixaria de ser "post ocultado" e',
      'viraria "publicação recusada" — a classe do erro do SEC-025.',
    ].join('\n')).toBeTruthy();

    expect(check, [
      'O CHECK `posts_live_oculta_nao_fica_no_ar` mudou de predicado.',
      '',
      'O `COALESCE(is_live,false)` não é decoração: `is_live` é ANULÁVEL',
      '(conferido no `information_schema`), e em SQL `NULL AND true` é `NULL`,',
      'que o CHECK aceita. Sem o COALESCE o estado impossível volta a passar',
      'por um post com `is_live` nulo.',
    ].join('\n')).toMatch(
      /NOT\s*\(\s*COALESCE\s*\(\s*is_live\s*,\s*false\s*\)\s+AND\s+hidden_at\s+IS\s+NOT\s+NULL\s*\)/i,
    );
  });

  it('a tela concorda com o banco — `hidden_at` filtrado nos dois lugares', () => {
    // Deriva de Fase 4: o banco parou de deixar a live oculta no ar, mas quem
    // LISTA precisa concordar. Sem isto a equipe volta a ver o que ela ocultou.
    const service = readFileSync('src/services/postService.js', 'utf8');
    const ativas = service.match(/export\s+async\s+function\s+fetchActiveLives[\s\S]*?\n}/);

    expect(ativas, [
      'O `fetchActiveLives` sumiu do `postService.js` — a trava não olha nada.',
    ].join('\n')).toBeTruthy();

    expect(ativas[0], [
      'O `fetchActiveLives` parou de filtrar `hidden_at`.',
      '',
      'Medido em 19/09, com papel `authenticated` real: com a live OCULTA, o',
      'usuário comum via 0 linhas (a RLS segura) e a EQUIPE via 1. Ou seja, a',
      'moderação ocultava a live e continuava vendo ela como "AO VIVO" — e só',
      'quem moderou enxergava o defeito.',
      '',
      'É o mesmo argumento do SEC-034 que já está escrito nesta função para',
      '`deleted_at`: segunda camada, porque depender de um mecanismo só foi',
      'exatamente o erro do SEC-025.',
    ].join('\n')).toMatch(/\.is\(\s*'hidden_at'\s*,\s*null\s*\)/);

    const painel = readFileSync('src/hooks/useLiveModeration.js', 'utf8');
    expect(painel, [
      'O `useLiveModeration` parou de filtrar `hidden_at` na lista de lives.',
      '',
      'É a aba de moderação de lives: sem o filtro, uma live que a própria',
      'equipe ocultou continua na lista "ao vivo agora" dela mesma.',
    ].join('\n')).toMatch(/\.eq\(\s*'is_live'\s*,\s*true\s*\)\s*\.is\(\s*'hidden_at'\s*,\s*null\s*\)/);
  });
});
