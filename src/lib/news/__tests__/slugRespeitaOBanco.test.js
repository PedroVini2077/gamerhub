import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { slugificar, slugValido, FORMATO_DO_SLUG } from '../slug';

/**
 * `[25/09]` O SLUG QUE A TELA MONTA TEM DE PASSAR NO `CHECK` DO BANCO.
 *
 * ── A falha que isto cobre ────────────────────────────────────────────────
 *
 * O editor digita "Notícia: o PS6 é real?" e a tela monta um slug. Se ele sair
 * com acento, espaço ou hífen duplo, o `INSERT` é recusado e a mensagem que
 * chega é `violates check constraint "news_articles_slug_formato"` — jargão de
 * Postgres para quem só queria publicar uma matéria.
 *
 * Não é falha silenciosa: ela grita. Mas grita para a pessoa errada, em uma
 * língua que não é a dela, e num momento em que ela já escreveu o texto todo.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `normalize('NFD')` removido  -> falhou no título com acento
 *   . o trim de hífen removido     -> falhou no título terminado em pontuação
 */

const PASTA = 'supabase/migrations';
const SQL = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort()
  .map(n => readFileSync(join(PASTA, n), 'utf8')).join('\n');

describe('o slug do News respeita o banco', () => {
  it('a regra da tela é a MESMA que está na migration', () => {
    const m = SQL.match(/news_articles_slug_formato\s+CHECK\s*\(\s*slug\s*~\s*'([^']+)'/i);

    expect(m, [
      'O CHECK `news_articles_slug_formato` sumiu das migrations, ou mudou de',
      'forma. Sem ele esta trava não confere nada e fica verde para sempre.',
    ].join('\n')).toBeTruthy();

    expect(m[1], [
      `No banco: ${m && m[1]}`,
      `Na tela:  ${FORMATO_DO_SLUG.source}`,
      '',
      'As duas regras precisam ser a MESMA. Se o banco afrouxar ou apertar o',
      'formato, `src/lib/news/slug.js` muda na MESMA migration — senão a tela',
      'monta um slug que o banco recusa, e o editor recebe jargão de Postgres',
      'depois de ter escrito a matéria inteira.',
    ].join('\n')).toBe(FORMATO_DO_SLUG.source);
  });

  it.each([
    ['Notícia: o PS6 é real?',            'noticia-o-ps6-e-real'],
    ['  Espaços    demais  ',             'espacos-demais'],
    ['Ação, coração e pão',               'acao-coracao-e-pao'],
    ['GTA VI — o trailer',                'gta-vi-o-trailer'],
    ['100% confirmado!!!',                '100-confirmado'],
    ['Já-tem-hífen',                      'ja-tem-hifen'],
  ])('%s → %s', (titulo, esperado) => {
    const slug = slugificar(titulo);
    expect(slug).toBe(esperado);
    expect(slugValido(slug), `"${slug}" tem de passar no CHECK do banco`).toBe(true);
  });

  it('título sem caractere aproveitável devolve VAZIO, não um palpite', () => {
    // Vazio é recusado por quem chama, com mensagem em português. Inventar um
    // slug aqui criaria um link permanente que ninguém escolheu.
    for (const nada of ['', '   ', '!!!', '—', '🎮🎮']) {
      expect(slugificar(nada), `"${nada}" não vira slug`).toBe('');
      expect(slugValido(slugificar(nada))).toBe(false);
    }
  });
});
