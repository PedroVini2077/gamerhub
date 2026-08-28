import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trava do portão de documentação (`CLAUDE.md` §6.2, camada 1).
 *
 * O portão existe porque documentação que cita arquivo renomeado ou apagado é
 * a forma mais comum e mais silenciosa de documento apodrecer. O teste existe
 * porque um portão que passa a aceitar tudo é indistinguível de um portão que
 * funciona — ele fica verde do mesmo jeito.
 *
 * Por isso os dois sentidos são exercidos aqui: o repositório limpo passa, e
 * uma citação quebrada REPROVA. Se um dia alguém afrouxar o regex, este
 * arquivo é que vai acusar.
 */

const RAIZ = join(import.meta.dirname, '../..');
const SCRIPT = join(RAIZ, 'scripts/documentacao-quebrada.mjs');

function rodar() {
  try {
    return { codigo: 0, saida: execFileSync('node', [SCRIPT], { encoding: 'utf8' }) };
  } catch (e) {
    return { codigo: e.status ?? 1, saida: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

describe('portão de documentação quebrada', () => {
  it('o repositório de hoje passa', () => {
    const { codigo, saida } = rodar();
    expect(
      codigo,
      'Algum documento está citando arquivo que não existe:\n' + saida,
    ).toBe(0);
  });

  it('reprova documento que cita arquivo inexistente', () => {
    const alvo = join(RAIZ, 'BACKLOG.md');
    const original = readFileSync(alvo, 'utf8');
    try {
      writeFileSync(alvo, original + '\n\nVer `src/lib/naoExisteDeJeitoNenhum.js`.\n');
      const { codigo, saida } = rodar();
      expect(codigo, 'o portão deixou passar uma citação quebrada').toBe(1);
      expect(saida).toContain('naoExisteDeJeitoNenhum.js');
    } finally {
      writeFileSync(alvo, original);
    }
  });

  it('não reclama de caminho absoluto — é exemplo de terminal, não do repo', () => {
    const alvo = join(RAIZ, 'BACKLOG.md');
    const original = readFileSync(alvo, 'utf8');
    try {
      writeFileSync(alvo, original + '\n\nRode `pg_dump > /tmp/backup-de-teste.sql`.\n');
      expect(
        rodar().codigo,
        'caminho em /tmp é exemplo de comando; tratar como referência quebrada '
        + 'transformaria o portão em alarme falso (§0.2, 4ª regra)',
      ).toBe(0);
    } finally {
      writeFileSync(alvo, original);
    }
  });

  it('aceita nome de arquivo sem o caminho completo', () => {
    // A documentação cita `Admin.jsx` e `cena3D.js` sem o `src/` na frente o
    // tempo todo. Exigir caminho completo faria o portão reprovar o texto
    // legítimo, e um portão assim é desligado na primeira semana.
    const alvo = join(RAIZ, 'BACKLOG.md');
    const original = readFileSync(alvo, 'utf8');
    try {
      writeFileSync(alvo, original + '\n\nVer `cena3D.js` e `useAuth.jsx`.\n');
      expect(rodar().codigo).toBe(0);
    } finally {
      writeFileSync(alvo, original);
    }
  });

  it('o script existe e é executável pelo CI', () => {
    expect(existsSync(SCRIPT)).toBe(true);
    const ci = readFileSync(join(RAIZ, '.github/workflows/ci.yml'), 'utf8');
    expect(
      ci,
      'o portão não está ligado no CI — script que ninguém roda não trava nada',
    ).toContain('scripts/documentacao-quebrada.mjs');
  });
});

/**
 * Trava do contador do `BACKLOG.md`.
 *
 * Ele diz "N itens abertos" no cabeçalho, e esse número **já mentiu duas
 * vezes**: em 23/08 a lista tinha cinco itens que já estavam feitos, e em
 * 28/08 o cabeçalho anunciava 21 quando havia 17 — os quatro tinham sido
 * fechados durante a sessão e a conta não acompanhou.
 *
 * É bobo e é exatamente por isso que erra: ninguém recalcula um número à mão
 * ao editar um item. E o custo é real — o cabeçalho é a primeira coisa que se
 * lê para decidir se o backlog está sob controle.
 */
describe('BACKLOG.md — o contador bate com a lista', () => {
  const RAIZ_BL = join(import.meta.dirname, '../..');

  it('o número anunciado é o número de itens', () => {
    const texto = readFileSync(join(RAIZ_BL, 'BACKLOG.md'), 'utf8');
    const declarado = texto.match(/\*\*(\d+) itens abertos\*\*/);
    expect(declarado, 'o cabeçalho perdeu a contagem de itens abertos').not.toBeNull();

    const reais = (texto.match(/^- ⬜/gm) ?? []).length;
    expect(
      Number(declarado[1]),
      `O cabeçalho anuncia ${declarado[1]} itens e a lista tem ${reais}.\n`
      + 'Atualize o número — ele é a primeira coisa que se lê para saber se o\n'
      + 'backlog está sob controle, e já mentiu duas vezes.',
    ).toBe(reais);
  });
});

describe('relatório de documentação envelhecida', () => {
  const RELATORIO = join(RAIZ, 'scripts/documentacao-envelhecida.mjs');

  it('roda sem estourar e não reprova nada', () => {
    // Ele é relatório, não portão: precisa sair com 0 mesmo tendo achado algo,
    // senão viraria build vermelho por indício (§0.2, 4ª regra).
    const saida = execFileSync('node', [RELATORIO], { encoding: 'utf8' });
    expect(saida.length).toBeGreaterThan(0);
  });

  it('todo documento de docs/ tem território mapeado', () => {
    const saida = execFileSync('node', [RELATORIO], { encoding: 'utf8' });
    expect(
      saida,
      'Documento novo sem entrada em TERRITORIO nunca seria apontado como\n'
      + 'envelhecido — o próprio mapa envelheceria em silêncio, que é o problema\n'
      + 'que ele existe para resolver. Acrescente em\n'
      + 'scripts/documentacao-envelhecida.mjs.',
    ).not.toContain('sem território mapeado');
  });

  it('está ligado no lembrete semanal', () => {
    const wf = join(RAIZ, '.github/workflows/lembrete-de-documentacao.yml');
    expect(existsSync(wf), 'o lembrete mensal sumiu').toBe(true);
    expect(readFileSync(wf, 'utf8')).toContain('documentacao-envelhecida.mjs');
  });
});
