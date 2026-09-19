import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[19/09]` O portão da borda HTTP não pode ser esvaziado em silêncio.
 *
 * ── Por que esta trava existe ─────────────────────────────────────────────
 *
 * `e2e/portas-da-web.mjs` confere cabeçalho de segurança e caminho que não
 * pode vazar. Ele é uma LISTA — e a varredura de classe de 02/09 achou **6 de
 * 9** travas deste projeto que liam uma lista sem conferir que a lista tinha
 * algo dentro. O desenho é sempre o mesmo:
 *
 *     const itens = [...];              // e se alguem esvaziar?
 *     for (const i of itens) confere(i);
 *     // nenhuma falha -> verde. sempre.
 *
 * Um portão de lista vazia **passa para sempre**, e o pior é que ele continua
 * imprimindo "nenhuma falha" — sinal verde que não sustenta nada, que é a
 * mesma falsa confiança do §6.3.
 *
 * O `varrerFontes` resolve isso para as travas que leem PASTA. Este arquivo
 * faz o mesmo para a que lê uma lista escrita à mão.
 *
 * ── Por que os nomes são conferidos um a um, e não só o total ─────────────
 *
 * Contar daria verde para alguém que troca `x-frame-options` por um cabeçalho
 * decorativo qualquer e mantém o total. Os quatro nomes abaixo são os que
 * protegem contra ataque de verdade; o total sozinho não os defende.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . lista de cabeçalhos esvaziada      -> falhou apontando o esvaziamento
 *   . `x-frame-options` removido da lista -> falhou nomeando o cabeçalho
 *   . lista de caminhos esvaziada         -> falhou apontando o vazamento
 */

const PORTAO = 'e2e/portas-da-web.mjs';
const fonte = readFileSync(PORTAO, 'utf8');

/** Prosa cita comando. O nome do cabeçalho aparece no texto explicativo também. */
const semComentarios = fonte
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\*.*$/gm, ' ')
  .replace(/\/\/[^\n]*/g, ' ');

function lista(nome) {
  // Aceita array de uma linha E multi-linha: `NAO_PODEM_VAZAR` e de uma so,
  // e ancorar em `\n];` deixava a trava estourar num portao saudavel.
  const m = semComentarios.match(new RegExp(`const\\s+${nome}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!m) {
    throw new Error(
      `A lista \`${nome}\` sumiu de ${PORTAO}, ou mudou de formato.\n`
      + '  Sem ela esta trava não olha nada e fica verde para sempre — que é\n'
      + '  exatamente o que ela existe para impedir. Corrija o padrão aqui,\n'
      + '  ou apague a trava se o portão deixou de fazer sentido.');
  }
  return m[1];
}

describe('o portão da borda HTTP não pode ser esvaziado', () => {
  it('a lista de cabeçalhos tem conteúdo', () => {
    const itens = (lista('CABECALHOS').match(/^\s*\[/gm) || []).length;
    expect(itens, [
      `A lista CABECALHOS de ${PORTAO} ficou com ${itens} item(ns).`,
      '',
      'Um portão de lista vazia não falha nunca, e continua imprimindo',
      '"nenhuma falha" — sinal verde que não sustenta nada.',
      '',
      'Se um cabeçalho saiu de propósito, o lugar de registrar isso é o próprio',
      'portão, com o motivo escrito ao lado da linha removida.',
    ].join('\n')).toBeGreaterThanOrEqual(4);
  });

  it('os cabeçalhos que protegem de ataque continuam na lista', () => {
    const corpo = lista('CABECALHOS');
    for (const [nome, ataque] of [
      ['x-content-type-options',    'sniffing de MIME'],
      ['x-frame-options',           'clickjacking'],
      ['referrer-policy',           'vazamento de URL no Referer'],
      ['strict-transport-security', 'downgrade para HTTP'],
    ]) {
      expect(corpo, [
        `O cabeçalho \`${nome}\` saiu da lista do ${PORTAO}.`,
        '',
        `Ele protege contra ${ataque}. Fora da lista, o portão para de conferir`,
        'e o dia em que alguém remover esse cabeçalho do `vercel.json` passa',
        'batido — nada quebra na tela, e o job fica verde.',
        '',
        'Contar os itens não protege disto: trocar um cabeçalho de verdade por',
        'um decorativo mantém o total e esvazia a proteção.',
      ].join('\n')).toContain(`'${nome}'`);
    }
  });

  it('a lista de caminhos que não podem vazar tem conteúdo', () => {
    const itens = (lista('NAO_PODEM_VAZAR').match(/'/g) || []).length / 2;
    expect(itens, [
      `A lista NAO_PODEM_VAZAR de ${PORTAO} ficou com ${itens} caminho(s).`,
      '',
      'Ela é o que separa "o rewrite do SPA devolveu o app" de "existe um',
      'arquivo de verdade ali". Vazia, o portão deixa de fazer essa pergunta.',
    ].join('\n')).toBeGreaterThanOrEqual(3);
  });
});
