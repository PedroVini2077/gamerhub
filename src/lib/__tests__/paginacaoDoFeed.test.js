import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';


/**
 * `[24/09]` A paginação do feed — as três coisas que quebram em SILÊNCIO.
 *
 * O feed passou a paginar por keyset. Nenhuma das três falhas abaixo aparece
 * na tela: o site continua funcionando, só que errado, mais lento ou vazando.
 *
 * ── 1. A RPC virar `SECURITY DEFINER` ─────────────────────────────────────
 *
 * É a mais grave, e é a que mais parece inofensiva. Sob `INVOKER`, a RLS de
 * `posts` faz o recorte sozinha — post apagado e post oculto não chegam a quem
 * não é equipe. Sob `DEFINER`, a função passa a rodar como o dono dela e a RLS
 * **deixa de valer**: o feed começaria a listar conteúdo moderado para todo
 * mundo. Nada estoura; a lista só fica maior.
 *
 * É a mesma armadilha do `prazoDaLive.test.js`, que existe porque eu quase
 * entreguei um guard de colunas como DEFINER no PR #217.
 *
 * ── 2. O `OR` do cursor nulo voltar ───────────────────────────────────────
 *
 * A forma "óbvia" de tratar a primeira página é
 * `WHERE (p_cursor IS NULL OR ROW(...) < ROW(...))`. Medido no banco: esse
 * `OR` **derruba o Index Cond para Filter** — 100 linhas lidas e descartadas
 * numa página de 20, e pior a cada página. O resultado continua CERTO, só que
 * o custo vira o do `OFFSET`. Nenhum teste de comportamento pega isso.
 *
 * ── 3. O lote passar do teto da RPC ───────────────────────────────────────
 *
 * O cliente pede `TAMANHO_DO_LOTE + 1` para saber se existe próxima página. A
 * RPC limita em 50. Se o lote crescer até 50, o pedido de 51 volta com 50, o
 * extra nunca aparece, e o "carregar mais" **some com posts ainda por ler**.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . INVOKER -> DEFINER na migration     -> falhou nomeando a RLS
 *   . os dois ramos viram um `OR`         -> falhou citando a medição
 *   . TAMANHO_DO_LOTE = 50                -> falhou na conta com o teto
 */

const MIGRATIONS = 'supabase/migrations';

function migracaoDaPagina() {
  const arquivo = readdirSync(MIGRATIONS)
    .filter((n) => n.includes('feed_pagina'))
    .sort()
    .pop();
  if (!arquivo) {
    throw new Error(
      `Não achei a migration da \`feed_pagina\` em ${MIGRATIONS}.\n`
      + '  Sem ela esta trava não olha nada e fica verde para sempre.');
  }
  return readFileSync(join(MIGRATIONS, arquivo), 'utf8');
}

const sql = migracaoDaPagina();

/**
 * O SQL sem os comentários.
 *
 * A prosa desta migration explica POR QUE existem dois `RETURN QUERY` — e
 * contar as ocorrências no arquivo inteiro daria 3, acusando um problema que
 * não existe. É a fragilidade que o `TRAVAS.md` lista para as travas que leem
 * texto de migration: prosa que cita comando.
 */
const sqlSemProsa = sql.replace(/^\s*--.*$/gm, '');

/**
 * O tamanho do lote, lido do FONTE e não importado.
 *
 * Importar `postService` traria o cliente do Supabase junto, que exige variável
 * de ambiente e derruba o teste fora do navegador. Ler o número do arquivo
 * mantém a trava sem dependência — e falha alto se a constante mudar de nome.
 */
function tamanhoDoLote() {
  const fonte = readFileSync('src/services/postService.js', 'utf8');
  const m = fonte.match(/export const TAMANHO_DO_LOTE\s*=\s*(\d+)/);
  if (!m) {
    throw new Error(
      'Não achei `TAMANHO_DO_LOTE` em src/services/postService.js.\n'
      + '  Se ele mudou de nome ou de arquivo, atualize a busca aqui — senão a\n'
      + '  conta com o teto da RPC deixa de ser feita, em silêncio.');
  }
  return Number(m[1]);
}

const TAMANHO_DO_LOTE = tamanhoDoLote();

describe('a paginação do feed', () => {
  it('a RPC é SECURITY INVOKER — é a RLS que recorta o feed', () => {
    expect(sql, [
      'A `feed_pagina` deixou de ser `SECURITY INVOKER`.',
      '',
      'Sob INVOKER, a RLS de `posts` esconde apagado e oculto de quem não é',
      'equipe, sozinha. Sob DEFINER a função roda como o dono dela e a RLS',
      'DEIXA DE VALER — o feed passaria a listar conteúdo moderado para todo',
      'mundo, sem erro nenhum: a lista só fica maior.',
      '',
      'Se algum dia ela PRECISAR ser DEFINER, o recorte tem de ser reescrito',
      'dentro dela, à mão, e conferido em ROLLBACK com papel `authenticated`.',
    ].join('\n')).toMatch(/SECURITY\s+INVOKER/i);

    expect(/SECURITY\s+DEFINER/i.test(sql), 'a migration não pode declarar DEFINER').toBe(false);
  });

  it('a RPC tem `SET search_path` explícito', () => {
    expect(sql).toMatch(/SET\s+search_path\s*=\s*public/i);
  });

  it('`anon` não executa — o feed é área de conta', () => {
    expect(sql, [
      'A `feed_pagina` perdeu o REVOKE de `anon`.',
      '',
      'A régua de papéis de 12/09 é explícita: `anon` alcança `site_config` e',
      'mais nada. Privilégio de FUNÇÃO não é tocado por revoke de TABELA, então',
      'o REVOKE tem de estar aqui.',
    ].join('\n')).toMatch(/REVOKE[\s\S]{0,120}anon/i);
  });

  it('a comparação é de LINHA, e os dois ramos continuam separados', () => {
    expect(sql, [
      'A comparação de linha `(created_at, id) < (…)` sumiu da `feed_pagina`.',
      '',
      'É ela que faz o Postgres entrar no índice no ponto certo. Sem ela o',
      'cursor vira filtro, e o custo passa a ser o do OFFSET.',
    ].join('\n')).toMatch(/\(\s*p\.created_at\s*,\s*p\.id\s*\)\s*<\s*\(/);

    // Dois `RETURN QUERY`: um por ramo. Um só significa que alguém juntou os
    // dois casos num `OR` — que foi medido e é mais lento.
    const ramos = (sqlSemProsa.match(/RETURN\s+QUERY/gi) || []).length;
    expect(ramos, [
      `A \`feed_pagina\` ficou com ${ramos} \`RETURN QUERY\` — deveriam ser 2.`,
      '',
      'A primeira página e a seguinte são ramos SEPARADOS de propósito.',
      'Juntá-las num `WHERE (p_cursor IS NULL OR ROW(…) < ROW(…))` foi medido:',
      'o `OR` sozinho derruba o Index Cond para Filter — 100 linhas lidas e',
      'descartadas numa página de 20, e pior a cada página.',
      '',
      'O resultado continua CERTO. Só o custo muda, e nenhum teste de',
      'comportamento pega isso.',
    ].join('\n')).toBe(2);
  });

  it('cursor pela metade estoura, em vez de devolver vazio em silêncio', () => {
    expect(sql, [
      'A `feed_pagina` perdeu a checagem de cursor incompleto.',
      '',
      'Com só um dos dois campos, a comparação de linha com NULL devolve ZERO',
      'linhas SEM ERRO — e a tela diria "acabou" no meio do feed (§1.5).',
    ].join('\n')).toMatch(/RAISE\s+EXCEPTION[\s\S]{0,80}[Cc]ursor/);
  });

  it('o lote cabe no teto da RPC, com o item extra', () => {
    const teto = Number((sqlSemProsa.match(/least\(.*,\s*(\d+)\s*\)\s*;/) || [])[1]);
    expect(teto, 'não achei o teto do limite na migration').toBeGreaterThan(0);

    expect(TAMANHO_DO_LOTE + 1, [
      `O lote é ${TAMANHO_DO_LOTE} e a RPC limita em ${teto}.`,
      '',
      'O cliente pede SEMPRE um item a mais que o lote, para saber se existe',
      `próxima página. Com lote ${TAMANHO_DO_LOTE}, ele pede ${TAMANHO_DO_LOTE + 1} — e a RPC devolve no`,
      `máximo ${teto}.`,
      '',
      'Quando o pedido passa do teto, o item extra nunca volta, `temMais` fica',
      'falso para sempre e o "carregar mais" SOME com posts ainda por ler.',
      '',
      'Se o lote precisa crescer, o teto da RPC cresce junto — numa migration',
      'nova, nunca editando a que já rodou.',
    ].join('\n')).toBeLessThanOrEqual(teto);
  });
});
