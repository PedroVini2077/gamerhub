import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  entraNoFeed, somarNovo, rotuloDeNovos, TETO_DE_NOVOS, COLUNAS_QUE_O_FEED_FILTRA,
} from '../novidadeDoFeed';

/**
 * `[24/09]` O aviso de "novas publicações" não pode prometer o que a recarga
 * não traz — e o número que ele mostra tem de ser sustentável.
 *
 * ── Os dois defeitos que esta trava impede de voltar ──────────────────────
 *
 * **1. Deriva entre o aviso e a consulta.** O handler de realtime contava todo
 * `INSERT` em `posts`; `fetchFeedPosts` exclui `live_kind IS NOT NULL`. Abrir
 * uma live somava "1 nova publicação" para todo mundo com a aba aberta, e o
 * clique não trazia nada. É a FASE 4 do §6 em miniatura: dois lugares que
 * precisam concordar, e nenhum teste perguntando se concordavam.
 *
 * **2. Número que o mecanismo não sustenta.** O contador acumulava eventos da
 * aba; o dono decidiu o teto em `"20+"`.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `entraNoFeed` deixando de olhar `live_kind` -> falhou no caso da live
 *   . teto removido de `somarNovo`                -> falhou no acúmulo
 *   . filtro novo na consulta e não aqui          -> falhou nomeando a coluna
 */

const MIGRATIONS = 'supabase/migrations';

/**
 * O corpo da RPC `feed_pagina`, que é onde a consulta do feed mora desde
 * `[24/09]`.
 *
 * **Antes este contrato lia o `postService.js`**, porque os filtros eram
 * `.is('coluna', null)` no cliente. A paginação por keyset mudou isso: o
 * PostgREST não expressa comparação de linha, então a consulta virou RPC — e
 * o contrato tinha de seguir o alvo, senão passaria a conferir um lugar onde
 * não há mais nada, ficando verde para sempre.
 */
function corpoDaConsultaDoFeed() {
  const arquivo = readdirSync(MIGRATIONS)
    .filter((n) => n.includes('feed_pagina'))
    .sort()
    .pop();
  if (!arquivo) {
    throw new Error(
      `Não achei a migration da \`feed_pagina\` em ${MIGRATIONS}.\n`
      + '  É ela que define o recorte do feed. Se mudou de nome, atualize a\n'
      + '  busca aqui — senão este contrato não olha nada e fica verde para\n'
      + '  sempre, que é o oposto do que ele existe para fazer.');
  }
  return readFileSync(join(MIGRATIONS, arquivo), 'utf8');
}

describe('o que conta como nova publicação', () => {
  it('post comum entra', () => {
    expect(entraNoFeed({ live_kind: null, deleted_at: null, hidden_at: null })).toBe(true);
  });

  it('LIVE não entra — foi o bug', () => {
    expect(entraNoFeed({ live_kind: 'gameplay', deleted_at: null, hidden_at: null }), [
      'Uma live voltou a contar como "nova publicação" no feed.',
      '',
      'A consulta do feed exclui `live_kind IS NOT NULL`, então o aviso',
      'prometeria um post que a recarga não traz — e a pessoa conclui que o',
      'site travou. Não estoura nada: o aviso só mente.',
    ].join('\n')).toBe(false);
  });

  it('post que nasce OCULTO não entra', () => {
    // Não é hipótese: `checar_palavras_bloqueadas` escreve `NEW.hidden_at` no
    // próprio INSERT — conferido no banco em 24/09.
    expect(entraNoFeed({ live_kind: null, deleted_at: null, hidden_at: '2026-09-24' })).toBe(false);
  });

  it('post apagado não entra, e nada sem linha entra', () => {
    expect(entraNoFeed({ live_kind: null, deleted_at: '2026-09-24', hidden_at: null })).toBe(false);
    expect(entraNoFeed(null)).toBe(false);
    expect(entraNoFeed(undefined)).toBe(false);
  });

  it('CONTRATO: a consulta do feed não ganhou filtro que o aviso ignora', () => {
    const consulta = corpoDaConsultaDoFeed();
    // O recorte do feed no SQL é `p.<coluna> IS NULL`, repetido nos dois ramos
    // (com cursor e sem). O `Set` colapsa a repetição.
    const filtrados = [...new Set(
      [...consulta.matchAll(/p\.([a-z_]+)\s+IS\s+NULL/gi)].map((m) => m[1]),
    )];

    expect(filtrados.length, [
      'Não achei nenhum `p.<coluna> IS NULL` na migration da `feed_pagina`.',
      '',
      'Ou a consulta mudou de forma, ou este contrato parou de enxergá-la.',
      'Nos dois casos ele deixaria de proteger sem avisar.',
    ].join('\n')).toBeGreaterThanOrEqual(2);

    for (const coluna of filtrados) {
      expect(COLUNAS_QUE_O_FEED_FILTRA, [
        `A consulta do feed filtra \`${coluna}\` e o aviso de novas publicações não sabe disso.`,
        '',
        'Post que a consulta exclui, mas o aviso conta, vira promessa que a',
        'recarga não cumpre — foi exatamente assim que a live entrou na conta.',
        '',
        `O conserto é ensinar \`entraNoFeed\` a olhar \`${coluna}\` e somar a coluna`,
        'em COLUNAS_QUE_O_FEED_FILTRA, em `src/lib/novidadeDoFeed.js`.',
        '',
        '(O recorte do feed mora na RPC `feed_pagina` desde 24/09 — o keyset',
        ' precisa de comparação de linha, que o PostgREST não expressa.)',
      ].join('\n')).toContain(coluna);
    }
  });
});

describe('o número que o aviso mostra', () => {
  it('soma normalmente abaixo do teto', () => {
    expect(somarNovo(0)).toBe(1);
    expect(somarNovo(5)).toBe(6);
  });

  it('não passa do teto — decisão do dono em 24/09', () => {
    expect(somarNovo(TETO_DE_NOVOS), [
      `O contador passou de ${TETO_DE_NOVOS}.`,
      '',
      'Ele acumula EVENTOS da aba aberta, não posts do banco: sem teto, quem',
      'deixa a aba aberta vê um número que não corresponde a nada, e a recarga',
      'traz outra coisa. O teto é o que torna o rótulo honesto.',
    ].join('\n')).toBe(TETO_DE_NOVOS);
    expect(somarNovo(TETO_DE_NOVOS + 50)).toBe(TETO_DE_NOVOS);
  });

  it('o rótulo some quando não há novidade', () => {
    expect(rotuloDeNovos(0)).toBeNull();
    expect(rotuloDeNovos(undefined)).toBeNull();
  });

  it('o rótulo concorda em número', () => {
    expect(rotuloDeNovos(1)).toContain('1 nova publicação');
    expect(rotuloDeNovos(3)).toContain('3 novas publicações');
  });

  it('no teto, o rótulo diz "+" em vez de fingir precisão', () => {
    expect(rotuloDeNovos(TETO_DE_NOVOS), [
      'No teto o rótulo ainda mostra um número exato.',
      '',
      `Ao chegar em ${TETO_DE_NOVOS} o sistema só sabe "pelo menos isto" — dizer o`,
      'número seco afirma uma precisão que ele não tem.',
    ].join('\n')).toContain(`${TETO_DE_NOVOS}+`);
  });
});
