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

/** A migration da retenção — achada pelo nome, não por índice. */
function fonteDaRetencao() {
  const arquivo = readdirSync(MIGRATIONS)
    .filter((n) => n.includes('retencao_de_post_de_teste'))
    .sort()
    .pop();
  if (!arquivo) {
    throw new Error(
      `Não achei a migration de retenção em ${MIGRATIONS}.\n`
      + '  Ela é o que impede `posts` de voltar a acumular post de robô. Se foi\n'
      + '  renomeada, atualize a busca aqui; se foi removida, o acúmulo voltou.');
  }
  return readFileSync(join(MIGRATIONS, arquivo), 'utf8');
}

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
