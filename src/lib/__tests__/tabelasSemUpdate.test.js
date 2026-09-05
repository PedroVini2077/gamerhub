import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrerFontes } from './varrerFontes';
import { TABELAS_SEM_UPDATE } from '../tabelasSemUpdate';

/**
 * Trava contra a fonte de silêncio nº 2: `UPDATE` negado pela RLS devolve
 * **0 linhas e nenhum erro**.
 *
 * O código chama, o service não reclama, a tela diz que salvou, e nada
 * aconteceu. Não é hipótese — foi assim que a moderação de comentário e de
 * mural ficou quebrada por meses neste projeto.
 *
 * Este teste não julga se a tabela DEVERIA ter policy. Ele só garante que
 * ninguém escreva um `update` contra uma tabela que hoje não aceita nenhum.
 */

/**
 * Procura `.from('tabela')` seguido de `.update(` na mesma cadeia.
 *
 * A janela de 220 caracteres cobre a cadeia encadeada e quebrada em linhas
 * (`.from('x')\n  .update({...})`) sem atravessar para a chamada seguinte.
 * Heurística, e assumida como tal: ela erra para MENOS (pode não ver um caso
 * exótico), nunca para mais — e portão que acusa à toa é pior do que portão
 * nenhum (§0.2, 4ª regra).
 */
function atualizacoesPorTabela(conteudo) {
  const achados = [];
  const re = /\.from\(\s*['"`]([a-z_]+)['"`]\s*\)/g;
  let m;
  while ((m = re.exec(conteudo)) !== null) {
    const janela = conteudo.slice(m.index, m.index + 220);
    if (/\.update\s*\(/.test(janela)) achados.push(m[1]);
  }
  return achados;
}

describe('nenhum código atualiza tabela sem policy de UPDATE', () => {
  it('varre src/ e cruza com a lista vinda do banco', () => {
    const proibidas = new Set(TABELAS_SEM_UPDATE);
    const violacoes = [];

    // `varrerFontes` ESTOURA se não achar arquivo — sem isso, um caminho
    // errado deixaria este teste verde para sempre sem olhar nada.
    for (const arquivo of varrerFontes('src')) {
      const conteudo = readFileSync(arquivo, 'utf8');
      for (const tabela of atualizacoesPorTabela(conteudo)) {
        if (proibidas.has(tabela)) violacoes.push(`${arquivo} -> ${tabela}`);
      }
    }

    expect(violacoes, violacoes.length === 0 ? '' : (
      `\n  ${violacoes.length} update(s) contra tabela SEM policy de UPDATE:\n`
      + violacoes.map(v => `    ${v}`).join('\n')
      + '\n\n  Esse update vai devolver 0 LINHAS E NENHUM ERRO. A tela vai dizer\n'
      + '  que salvou e nada vai acontecer — foi assim que a moderação de\n'
      + '  comentário ficou quebrada por meses.\n\n'
      + '  Saídas, nesta ordem:\n'
      + '    1. A tabela DEVE aceitar update? Crie a policy no banco e tire o\n'
      + '       nome de lib/tabelasSemUpdate.js.\n'
      + '    2. Não deve? Então este update está errado — some com ele.\n'
      + '    3. Em qualquer caso, trate 0 linhas como FALHA no chamador\n'
      + '       (`count: "exact"`), senão o proximo caso volta a ser mudo.\n'
    )).toEqual([]);
  });

  it('a lista não está vazia — lista vazia faria o teste passar sempre', () => {
    // Sem isto, alguém "consertando" um falso positivo esvaziaria a lista e o
    // teste viraria decoração: continuaria verde sem verificar nada.
    expect(TABELAS_SEM_UPDATE.length).toBeGreaterThan(0);
  });
});
