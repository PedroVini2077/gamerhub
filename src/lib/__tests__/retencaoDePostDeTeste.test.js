import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PREFIXOS_DE_TESTE, marcaDeTeste } from '../../../e2e/publicarPost.mjs';

/**
 * `[24/09]` A retenção do banco tem de conhecer TODOS os prefixos de teste.
 *
 * ── O problema que ela resolve, com número ────────────────────────────────
 *
 * Cada execução do E2E publica um post de VERDADE na produção e o apaga — e o
 * apagar do site é SOFT. Em menos de um mês, `posts` chegou a **410 linhas,
 * todas de robô**. O `cleanup_old_data()` passou a apagá-las de verdade.
 *
 * ── A deriva que esta trava impede ────────────────────────────────────────
 *
 * A lista de prefixos vive em DOIS lugares agora: `PREFIXOS_DE_TESTE`, no
 * `e2e/publicarPost.mjs`, e o padrão dentro da função SQL. Prefixo novo do
 * lado do JS e não do lado do SQL = lixo que volta a se acumular, **em
 * silêncio**, porque nada quebra quando sobra linha num banco.
 *
 * É a mesma família do `[e2e-live `, que já nasceu depois dos outros dois e
 * fez o detector de sobras errar — a história está no `publicarPost.mjs`.
 *
 * ── Por que a trava lê a MIGRATION, e não o banco ─────────────────────────
 *
 * Porque o `npm test` roda sem credencial de banco. A migration é o espelho
 * versionado do que foi aplicado, e o portão `edges-implantadas` cobre o outro
 * lado (função no ar que não veio deste código).
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . prefixo novo em PREFIXOS_DE_TESTE e não no SQL -> falhou nomeando ele
 *   . `[0-9]{10,}` trocado por `.*` no SQL           -> falhou no caso do título de gente
 */

const MIGRATIONS = 'supabase/migrations';

/** A migration mais recente cujo nome contém o pedaço dado. */
function migrationChamada(pedaco, paraQue) {
  const arquivo = readdirSync(MIGRATIONS)
    .filter((n) => n.includes(pedaco)).sort().pop();
  if (!arquivo) {
    throw new Error(
      `Não achei a migration \`${pedaco}\` em ${MIGRATIONS}.\n`
      + `  Ela é o que ${paraQue}. Se foi renomeada, atualize a busca aqui;\n`
      + '  se foi removida, o acúmulo voltou.');
  }
  return readFileSync(join(MIGRATIONS, arquivo), 'utf8');
}

const fonteDaRetencao = () => migrationChamada(
  'retencao_de_post_de_teste', 'impede `posts` de acumular post de robô');

/** O padrão de título dentro do SQL, extraído do `DELETE FROM posts`. */
function padraoDoSql(fonte) {
  const m = fonte.match(/title\s*~\s*'(\^[^']+)'/);
  if (!m) {
    throw new Error(
      'Não achei o padrão `title ~ \'…\'` na migration de retenção.\n'
      + '  Sem ele esta trava não olha nada e fica verde para sempre — que é\n'
      + '  exatamente o que ela existe para impedir.');
  }
  return m[1];
}

describe('a retenção de post de teste conhece todos os prefixos', () => {
  const fonte = fonteDaRetencao();
  const padrao = padraoDoSql(fonte);

  it('a lista de prefixos do E2E não está vazia', () => {
    expect(PREFIXOS_DE_TESTE.length).toBeGreaterThanOrEqual(3);
  });

  it.each(PREFIXOS_DE_TESTE)('o SQL conhece o prefixo %s', (prefixo) => {
    // `[e2e ` -> `e2e`. O SQL guarda o nome sem o colchete nem o espaço.
    const nome = prefixo.replace(/^\[/, '').trim();
    expect(padrao, [
      `O prefixo de teste \`${prefixo}\` não aparece no padrão da retenção.`,
      '',
      `Padrão no SQL: ${padrao}`,
      '',
      'Post publicado com esse prefixo pelo CI vai ficar no banco PARA SEMPRE,',
      'e nada quebra quando isso acontece — foi assim que `posts` chegou a 410',
      'linhas de robô.',
      '',
      'O conserto é somar o prefixo ao padrão numa migration nova, nunca',
      'editando a que já rodou (o banco não muda, e o espelho passa a mentir).',
    ].join('\n')).toContain(nome);
  });

  it('o padrão exige o RELÓGIO da marca, não só o prefixo', () => {
    // Sem o relógio, um título de gente que comece com "[e2e " seria destruído
    // 2h depois de a pessoa apagar o próprio post.
    expect(padrao, [
      'O padrão da retenção deixou de exigir o relógio da marca.',
      '',
      `Padrão atual: ${padrao}`,
      '',
      'Com só o prefixo, "[e2e coisas da vida] meu post" casaria — e um post',
      'de gente que a própria pessoa apagou seria destruído de verdade 2h',
      'depois. O relógio é o que torna a colisão acidental impossível.',
    ].join('\n')).toMatch(/\[0-9\]\{\d+,?\d*\}/);
  });

  it('o padrão casa uma marca REAL e não casa um título de gente', () => {
    // Traduz o padrão do Postgres para JS: os dois são POSIX estendido aqui.
    const re = new RegExp(padrao);
    for (const prefixo of PREFIXOS_DE_TESTE) {
      const real = `${marcaDeTeste(prefixo)} post automatico`;
      expect(re.test(real), `a marca real "${real}" deveria casar`).toBe(true);
    }
    expect(re.test('[e2e coisas da vida] meu post'), [
      'Um título de GENTE casou com o padrão da retenção.',
      '',
      'Isso faria o site destruir de verdade o post que a pessoa apagou.',
    ].join('\n')).toBe(false);
  });

  it('só apaga o que JÁ está soft-deletado, e com folga de tempo', () => {
    expect(fonte, 'a retenção precisa exigir `deleted_at IS NOT NULL`')
      .toMatch(/deleted_at\s+IS\s+NOT\s+NULL/i);
    expect(fonte, [
      'A retenção perdeu a janela de tolerância.',
      '',
      'Sem ela, o post de uma execução EM ANDAMENTO pode ser apagado no meio —',
      'e o detector de sobras deixa de conseguir acusar a rodada que morreu,',
      'porque o lixo some antes de alguém ver.',
    ].join('\n')).toMatch(/deleted_at\s*<\s*now\(\)\s*-\s*interval/i);
  });
});


/**
 * `[01/10]` A MESMA trava, do lado do News — e a divergência entre as DUAS cópias.
 *
 * ── Por que o News precisou de um segundo mecanismo ───────────────────────
 *
 * O `painel-admin.mjs` cria uma matéria de verdade a cada rodada de CI, e a
 * conta dele é `admin`: `news_articles_delete` exige `is_super()`, então **ele
 * não consegue limpar a própria sujeira**. Diferente do post, que o roteiro
 * apaga pela tela, a sobra do News é por construção.
 *
 * A regra existia desde 25/09 dentro do `cleanup_old_data()` e estava certa.
 * O que ninguém conferiu foi o relógio: aquele lote roda **uma vez por dia**.
 * Em 01/10 o dono mostrou a tela com três rascunhos `EM REVISÃO` de 12 min,
 * 20 min e 1 h — todos esperando 17 horas para sumir, dentro da fila editorial
 * que uma pessoa usa para decidir o que vai ao ar.
 *
 * ── O que esta parte vigia, e é o §4 na veia ──────────────────────────────
 *
 * Agora o padrão de título do News vive em DOIS arquivos: o `cleanup_old_data`
 * (rede diária) e a `limpar_rascunhos_de_teste_do_news` (de 10 em 10 min).
 * Duas cópias da mesma regra divergem — foi exatamente o que aconteceu com o
 * `[e2e-live `, que nasceu depois dos outros dois e fez o detector de sobras
 * errar. Então aqui se exige que as duas sejam **idênticas**.
 */

/** O padrão de título do News, extraído de um `DELETE FROM news_articles`. */
function padraoDoNews(fonte, ondeEsta) {
  const m = fonte.match(/titulo\s*~\s*'(\^[^']+)'/);
  if (!m) {
    throw new Error(
      `Não achei o padrão \`titulo ~ '…'\` em ${ondeEsta}.\n`
      + '  Sem ele esta trava não olha nada e fica verde para sempre — que é\n'
      + '  exatamente o que ela existe para impedir.');
  }
  return m[1];
}

describe('a retenção de RASCUNHO de teste do News', () => {
  const rapida = migrationChamada('limpeza_rapida_de_rascunho_de_teste_do_news',
    'tira o rascunho de robô do painel em minutos, e não em um dia');
  const diaria = migrationChamada('retencao_de_rascunho_de_teste_do_news',
    'é a rede diária do mesmo lixo');

  const padraoRapido = padraoDoNews(rapida, 'a limpeza rápida do News');
  const padraoDiario = padraoDoNews(diaria, 'a retenção diária do News');

  it('as DUAS cópias usam exatamente o mesmo padrão', () => {
    expect(padraoRapido, [
      'As duas limpezas de rascunho de teste do News divergiram.',
      '',
      `  rápida (10 em 10 min): ${padraoRapido}`,
      `  diária (cleanup_old_data): ${padraoDiario}`,
      '',
      'Prefixo que entra em uma e não na outra vira lixo que volta a se',
      'acumular — em silêncio, porque nada quebra quando sobra linha num banco.',
      'Foi assim com o `[e2e-live `.',
    ].join('\n')).toBe(padraoDiario);
  });

  it.each(PREFIXOS_DE_TESTE)('a limpeza rápida conhece o prefixo %s', (prefixo) => {
    expect(padraoRapido, `O prefixo \`${prefixo}\` não aparece no padrão da `
      + `limpeza rápida do News.\n\n  Padrão: ${padraoRapido}\n\n`
      + '  Rascunho criado pelo CI com esse prefixo vai ficar no painel do dono\n'
      + '  até alguém apagar à mão — e ele entra na FILA EDITORIAL.')
      .toContain(prefixo.replace(/^\[/, '').trim());
  });

  it('casa a marca real e NÃO casa título de gente', () => {
    const re = new RegExp(padraoRapido);
    for (const prefixo of PREFIXOS_DE_TESTE) {
      expect(re.test(`${marcaDeTeste(prefixo)} materia automatica`)).toBe(true);
    }
    expect(re.test('[e2e coisas da vida] materia de gente'), [
      'Um título de GENTE casou com a limpeza do News.',
      '',
      'Isso apagaria de verdade uma matéria escrita por uma pessoa. O relógio',
      'da marca é o que torna a colisão acidental impossível.',
    ].join('\n')).toBe(false);
  });

  it('nunca alcança o que está NO AR', () => {
    // Tirar materia publicada do ar e decisao de gente, nunca de faxina. E
    // `scheduled` conta como no ar: agendar para daqui a um minuto nao pode
    // virar porta para a limpeza apagar.
    for (const [nome, fonte] of [['rápida', rapida], ['diária', diaria]]) {
      const filtro = fonte.match(/status\s+IN\s*\(([^)]*)\)/i)?.[1] ?? '';
      expect(filtro, `a limpeza ${nome} do News deixou de restringir o status. `
        + 'Sem isso ela alcanca materia PUBLICADA — faxina automatica tirando '
        + 'do ar o que uma pessoa colocou.').toMatch(/draft/);
      expect(filtro, `a limpeza ${nome} passou a alcancar materia no ar`)
        .not.toMatch(/published|scheduled/);
    }
  });

  it('tem janela de tolerância para a rodada EM CURSO', () => {
    expect(rapida, 'a limpeza rápida perdeu a janela de tempo. Sem ela, o '
      + 'rascunho de uma rodada em andamento pode sumir no meio do roteiro.')
      .toMatch(/created_at\s*<\s*now\(\)\s*-\s*interval/i);
  });
});
