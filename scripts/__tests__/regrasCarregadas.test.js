import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trava do `CLAUDE.md` depois do split de 28/08.
 *
 * ── O risco que ela cobre, e por que ele é diferente de todos os outros ─────
 *
 * O `CLAUDE.md` passou de 1.512 linhas e quatro seções estouraram o limite de
 * ~150 do §6.2 — o arquivo estava desobedecendo à própria regra. As seções
 * grandes viraram arquivos em `docs/regras/`, puxados por `@import`.
 *
 * Isso resolve o tamanho e cria um modo de falhar que **nenhuma outra parte do
 * projeto tem**: se um import quebrar, as regras param de ser carregadas em
 * TODA SESSÃO FUTURA, sem nada avisar. O site continua funcionando, o CI
 * continua verde, os testes continuam passando — e eu passo a trabalhar sem
 * metade das instruções, incluindo as de segurança. É o §1.5 no lugar mais
 * caro possível.
 *
 * ── Duas camadas, porque o caminho existir não basta ────────────────────────
 *
 * `documentacao-quebrada.mjs` (no CI) garante que o caminho do import existe.
 * Este teste garante que o CONTEÚDO continua lá: um arquivo esvaziado, ou uma
 * seção apagada por engano num merge, passa pelo portão e é pego aqui.
 *
 * ── Como conferir de fora ───────────────────────────────────────────────────
 *
 * No Claude Code, `/context` mostra os arquivos de memória de fato carregados,
 * com os imports já expandidos. É a verificação de última instância, feita por
 * uma pessoa; este teste é a que roda sozinha.
 */

const RAIZ = join(import.meta.dirname, '../..');
const CLAUDE = readFileSync(join(RAIZ, 'CLAUDE.md'), 'utf8');

/** Os `@caminho` no começo da linha — o que o Claude Code de fato importa. */
function importsDeclarados() {
  return [...CLAUDE.matchAll(/^@([a-zA-Z0-9_./-]+\.md)\s*$/gm)].map(m => m[1]);
}

/** O texto que eu realmente enxergo: o CLAUDE.md com os imports expandidos. */
function regrasInteiras() {
  return importsDeclarados().reduce(
    (texto, caminho) => texto + '\n' + readFileSync(join(RAIZ, caminho), 'utf8'),
    CLAUDE,
  );
}

/**
 * Âncoras: trechos que provam que uma regra INTEIRA continua presente.
 *
 * Escolhidas por serem específicas — uma frase genérica sobreviveria ao
 * apagamento acidental da seção e daria falso verde.
 */
const ANCORAS = [
  ['§1.1  sinceridade', 'Nunca dizer que algo foi verificado se não foi'],
  ['§1.1  fato × inferência × hipótese', 'Toda hipótese vem com o teste que a confirma'],
  ['§1.2  diagnosticar antes de consertar', 'Reproduzir'],
  ['§1.3  segurança proativa', 'Validação no cliente não vale nada sozinha'],
  ['§1.4  não confiar no que está escrito', 'Documento envelhece; o sistema não mente'],
  ['§1.5  falha tem que gritar', 'O teste dos três canais'],
  ['§5    teste de RLS em ROLLBACK', 'SET LOCAL request.jwt.claims'],
  ['§5    inversa e limpeza', 'Qual é a inversa, e quem pode executá-la?'],
  ['§6    as 4 fases da auditoria', 'FASE 4 — Deriva entre o código e o banco'],
  ['§6.1  faxina', 'Medir antes e depois'],
  ['§6.2  contrato de evolução', 'Contrato de Evolução'],
  ['§6.2  as três camadas de documentação', 'TODOS os documentos têm que estar atualizados'],
];

describe('CLAUDE.md — as regras continuam sendo carregadas', () => {
  const imports = importsDeclarados();

  it('declara os imports das seções que saíram', () => {
    expect(
      imports.length,
      'Nenhum `@import` no CLAUDE.md. Ou o split foi desfeito (e aí o arquivo\n'
      + 'voltou a ter 1.500 linhas), ou os imports foram apagados e as regras\n'
      + 'grandes deixaram de ser carregadas.',
    ).toBeGreaterThanOrEqual(4);
  });

  it('todo arquivo importado existe e tem conteúdo', () => {
    for (const caminho of imports) {
      expect(existsSync(join(RAIZ, caminho)), `${caminho} não existe`).toBe(true);
      const conteudo = readFileSync(join(RAIZ, caminho), 'utf8');
      expect(
        conteudo.trim().length,
        `${caminho} está vazio — o import resolve e não carrega regra nenhuma.`,
      ).toBeGreaterThan(500);
    }
  });

  it.each(ANCORAS)('a regra %s continua presente', (_nome, ancora) => {
    expect(
      regrasInteiras(),
      `Esta regra sumiu do CLAUDE.md e dos arquivos importados.\n`
      + `Âncora procurada: "${ancora}"\n\n`
      + 'Se a seção foi movida de arquivo, atualize a âncora aqui. Se foi\n'
      + 'apagada sem querer, recupere: sem ela eu passo a trabalhar sem essa\n'
      + 'instrução, e nada mais no projeto avisa.',
    ).toContain(ancora);
  });

  it('o CLAUDE.md cabe no limite que ele mesmo manda respeitar', () => {
    const linhas = CLAUDE.split('\n').length;
    expect(
      linhas,
      `O CLAUDE.md voltou a ${linhas} linhas. A regra do §6.2 (seção acima de\n`
      + '~150 linhas vira arquivo próprio) vale para ele também — foi por\n'
      + 'desobedecer a si mesmo que ele chegou a 1.512 linhas em 28/08.',
    ).toBeLessThan(900);
  });

  it('nenhuma seção do CLAUDE.md passou de 150 linhas de novo', () => {
    const linhas = CLAUDE.split('\n');
    const grandes = [];
    let titulo = null;
    let contagem = 0;
    for (const linha of [...linhas, '## fim']) {
      if (/^## /.test(linha)) {
        if (titulo && contagem > 150) grandes.push(`${titulo} (${contagem} linhas)`);
        titulo = linha.replace(/^## /, '');
        contagem = 0;
      }
      contagem++;
    }
    expect(grandes, grandes.length
      ? 'Estas seções voltaram a estourar o limite do §6.2 e pedem arquivo\n'
        + 'próprio em docs/regras/, puxado por @import:\n  ' + grandes.join('\n  ')
      : undefined).toEqual([]);
  });
});
