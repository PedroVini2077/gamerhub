import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { EDITORIAS } from '../editorias';
import { ESTADOS, estadoNoAr } from '../estadosDoArtigo';

/**
 * `[25/09]` O VOCABULÁRIO DO NEWS × O QUE O BANCO ACEITA — a FASE 4 do §6.
 *
 * ── A falha que esta trava cobre, e ela é MUDA nos dois sentidos ──────────
 *
 * `news_articles.editoria` e `.status` têm `CHECK` com lista fechada. A tela
 * tem um mapa de cada. São dois lugares que precisam concordar para sempre, e
 * o sintoma de divergirem depende do lado:
 *
 *   banco ganha valor, tela não sabe  -> o artigo aparece SEM RÓTULO, e nada
 *                                        estoura. A informação só some.
 *   tela ganha valor, banco não tem   -> o `INSERT` é recusado, e o editor vê
 *                                        um erro de constraint que não ensina
 *                                        nada sobre o que fazer.
 *
 * O primeiro é o perigoso, e é exatamente o caso do `chat` que ficou girando
 * em "Carregando..." por semanas.
 *
 * ── Por que ler a MIGRATION e não o banco ─────────────────────────────────
 *
 * O `npm test` roda no CI sem credencial de banco (de propósito — ver
 * `docs/TRAVAS.md`). A migration é o que o banco vai ter, e é versionada. O
 * limite é conhecido: alguém alterando o `CHECK` pelo editor SQL sem migration
 * passa batido. É o mesmo limite de todas as travas que leem migration.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . editoria tirada do mapa da tela   -> falhou nomeando a que faltava
 *   . estado inventado no mapa da tela  -> falhou nomeando o que sobrava
 *   . `scheduled` deixando de ser "no ar" -> falhou explicando o furo do corte
 */

const PASTA = 'supabase/migrations';
const semComentariosSQL = (sql) =>
  sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

const SQL = (() => {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) throw new Error(`Nenhuma migration em "${PASTA}".`);
  return nomes.map(n => semComentariosSQL(readFileSync(join(PASTA, n), 'utf8'))).join('\n');
})();

/**
 * Os valores do ÚLTIMO `CHECK` com este nome.
 *
 * O último, e não o primeiro: `news_articles_status` já foi redefinido uma vez
 * (o corte editorial acrescentou `in_review`). Ler o primeiro faria a trava
 * conferir um vocabulário que o banco não tem mais — verde e errada, que é o
 * defeito que a trava do auditor teve por um PR inteiro.
 */
function valoresDoCheck(constraint) {
  const abertura = new RegExp(`CONSTRAINT\\s+${constraint}\\s+CHECK\\s*\\(`, 'gi');
  const encontrados = [];

  for (const m of SQL.matchAll(abertura)) {
    // A JANELA existe para a busca do literal NÃO poder atravessar para a
    // constraint seguinte. Sem ela, um `CHECK` escrito em outro formato faz o
    // `[\s\S]*?` varrer o arquivo inteiro e capturar a lista de OUTRA coluna
    // — foi o que aconteceu na primeira versão desta trava: ela conferiu as
    // editorias contra a lista de STATUS e reprovou com os dois lados errados.
    const depois = SQL.slice(m.index + m[0].length);
    const janela = depois.slice(0, 600).split(/\bCONSTRAINT\b/i)[0];

    // Os dois formatos que este banco usa: `IN ('a','b')` e `ARRAY['a','b']`.
    const lista = janela.match(/(?:IN|ARRAY)\s*[[(]([\s\S]*?)[\])]/i);
    if (lista) {
      // `_` E `-`: as editorias usam hífen (`cultura-pop`) e os estados usam
      // underscore (`in_review`). A primeira versão desta linha só aceitava
      // hífen, e `in_review` era DESCARTADO em silêncio — a trava comparava uma
      // lista de 4 com uma de 5 e acusava a TELA de estar errada, quando quem
      // não sabia ler era ela. É a "cobertura que não cobre" do §1.5, dentro do
      // próprio mecanismo que existe para pegar esse tipo de coisa.
      encontrados.push([...lista[1].matchAll(/'([a-z0-9_-]+)'/gi)].map(x => x[1]).sort());
    }
  }

  // Lista vazia é o pior resultado possível: ela compara [] com [] no dia em
  // que alguém esvaziar o mapa da tela, e passa. Se a extração não achou valor,
  // é a trava que está quebrada, não o código.
  for (const valores of encontrados) {
    if (valores.length === 0) {
      throw new Error(
        `O CHECK \`${constraint}\` foi achado mas nenhum valor foi extraído dele.\n`
        + '  A trava não está conferindo nada — conserte a extração, não o mapa.');
    }
  }

  if (encontrados.length === 0) {
    throw new Error(
      `O CHECK \`${constraint}\` não foi achado nas migrations, ou mudou de formato.\n`
      + '  Sem ele esta trava não confere nada e fica verde para sempre.\n'
      + '  Formatos que ela entende: `IN (...)` e `ARRAY[...]`.');
  }
  // O ÚLTIMO: `news_articles_status` já foi redefinido uma vez (o corte
  // editorial acrescentou `in_review`). Ler o primeiro faria a trava conferir
  // um vocabulário que o banco não tem mais — verde e errada.
  return encontrados[encontrados.length - 1];
}

describe('o vocabulário do News não deriva do banco', () => {
  it('as EDITORIAS da tela são exatamente as do CHECK', () => {
    const noBanco = valoresDoCheck('news_articles_editoria');
    const naTela = Object.keys(EDITORIAS).sort();

    expect(naTela, [
      `No banco: ${noBanco.join(', ')}`,
      `Na tela:  ${naTela.join(', ')}`,
      '',
      'Editoria que o banco aceita e a tela não conhece aparece SEM RÓTULO,',
      'sem erro nenhum. Editoria que a tela oferece e o banco recusa vira um',
      'erro de constraint na cara do editor.',
      '',
      'Acerte `src/lib/news/editorias.js` e o CHECK na MESMA migration.',
    ].join('\n')).toEqual(noBanco);
  });

  it('os ESTADOS da tela são exatamente os do CHECK', () => {
    const noBanco = valoresDoCheck('news_articles_status');
    const naTela = Object.keys(ESTADOS).sort();

    expect(naTela, [
      `No banco: ${noBanco.join(', ')}`,
      `Na tela:  ${naTela.join(', ')}`,
      '',
      'Estado que o banco aceita e a tela não conhece aparece com o slug cru',
      'no painel, e o editor não sabe o que aquilo significa.',
    ].join('\n')).toEqual(noBanco);
  });

  it('`scheduled` conta como NO AR — senão o corte editorial é furável', () => {
    // O trigger do banco trata `published` e `scheduled` juntos. Se a tela
    // discordar, ela oferece "agendar" a um admin e o banco recusa — ou pior,
    // alguém "simplifica" o trigger olhando só para esta lista.
    expect(estadoNoAr('scheduled'), [
      'Agendar é PUBLICAR com atraso.',
      '',
      'Se `scheduled` deixar de contar como "no ar", um admin agenda para',
      'daqui a um minuto e o corte editorial vira enfeite — ele publicaria',
      'sem passar por super admin nenhum.',
      '',
      'O trigger `news_guarda_a_publicacao` trata os dois juntos. Esta lista',
      'tem de concordar com ele.',
    ].join('\n')).toBe(true);

    expect(estadoNoAr('published')).toBe(true);
    for (const fora of ['draft', 'in_review', 'archived']) {
      expect(estadoNoAr(fora), `"${fora}" não põe o artigo na frente de ninguém`).toBe(false);
    }
  });
});
