import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[09/10]` O INVENTÁRIO DE TRAVAS PRECISA CITAR AS TRAVAS QUE EXISTEM.
 *
 * ── O buraco, com número ──────────────────────────────────────────────────
 *
 * O `docs/TRAVAS.md` existe desde 19/09 e terminava dizendo: *"este arquivo é
 * vigiado pelos portões que já existem"*.
 *
 * **Vigilância de mão única.** O `documentacao-quebrada.mjs` confere se todo
 * caminho CITADO lá existe. Nada conferia o contrário. Medido em 09/10: 113
 * arquivos de teste leem algum arquivo do projeto, e o inventário nomeava 71
 * — **63%**, caindo a cada trava nova.
 *
 * É a mesma classe que o dono apontou na tabela da política de privacidade:
 * lista que se apresenta como o inventário e não é **deixa de ser verdade
 * para quem a lê** — inclusive para mim, procurando se já existe trava para
 * alguma coisa.
 *
 * ── Por que "lê arquivo do projeto" é o critério ──────────────────────────
 *
 * É o que separa TRAVA de teste comum, e é mensurável. Teste comum exercita
 * uma função com entradas; trava de contrato abre o código, a migration ou o
 * workflow e exige que algo continue lá. Quem chama `readFileSync` está
 * fazendo a segunda coisa.
 *
 * Critério imperfeito nas bordas — e preferível a "o que me parecer trava",
 * que é exatamente como a cobertura escorrega (§6, sobre o piso de auditoria).
 *
 * ── Por que isto NÃO é a espiral de controle do §9.8 ─────────────────────
 *
 * A pergunta 2 de lá é *"o mecanismo existente está falhando, ou eu não o
 * usei?"*. Aqui ele não falhou nem deixou de ser usado: **ele nunca olhou
 * para este lado.** Buraco de cobertura, não espiral.
 *
 * E o conserto é UMA checagem dentro de um teste, não um script com portão,
 * workflow e documentação própria — pergunta 5 do mesmo §9.8.
 */

const RAIZ = join(import.meta.dirname, '../..');
const INVENTARIO = join(RAIZ, 'docs/TRAVAS.md');

/** Todo `*.test.js(x)` de `src/` e `scripts/` que lê algum arquivo. */
function travasQueLeemArquivo() {
  const achadas = [];
  const andar = (dir) => {
    for (const nome of readdirSync(dir)) {
      if (nome === 'node_modules') continue;
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) { andar(caminho); continue; }
      if (!/\.test\.jsx?$/.test(nome)) continue;
      if (readFileSync(caminho, 'utf8').includes('readFileSync')) achadas.push(nome);
    }
  };
  andar(join(RAIZ, 'src'));
  andar(join(RAIZ, 'scripts'));
  return achadas.sort();
}

describe('o inventário de travas cita as travas que existem', () => {
  it('a varredura acha travas — senão ela aprova o vazio', () => {
    // A vacuidade de sempre: renomear a pasta ou mudar o sufixo dos testes
    // faria a lista vir vazia e o `for` abaixo não rodar nenhuma vez.
    expect(
      travasQueLeemArquivo().length,
      'a varredura não achou NENHUMA trava que lê arquivo.\n'
      + 'O projeto tem mais de cem. Se chegou a zero, foi a varredura que\n'
      + 'quebrou — e um teste que não lê nada passa verde para sempre.',
    ).toBeGreaterThan(80);
  });

  it('nenhuma trava existe sem estar no `docs/TRAVAS.md`', () => {
    const inventario = readFileSync(INVENTARIO, 'utf8');
    const fora = travasQueLeemArquivo().filter((n) => !inventario.includes(n));

    expect(
      fora,
      `${fora.length} trava(s) existem e NÃO estão no \`docs/TRAVAS.md\`:\n`
      + fora.map((n) => `  - ${n}`).join('\n')
      + '\n\nO inventário se apresenta como a resposta para "esta regra tem\n'
      + 'proteção, e quem protege?". Incompleto, ele responde com autoridade e\n'
      + 'manda a pessoa para o lugar errado — pior do que não existir.\n\n'
      + 'Acrescente cada uma com o que ela prova e o `INV-*`, se houver. Se\n'
      + 'genuinamente não for trava, o critério é `readFileSync`: um teste que\n'
      + 'só exercita função não deveria estar lendo arquivo nenhum.',
    ).toEqual([]);
  });

  it('o fecho do inventário não volta a prometer vigilância de mão única', () => {
    // A frase "é vigiado pelos portões que já existem" foi o que deixou o
    // arquivo cair para 63% sem nada acusar: aqueles portões conferem se o
    // que está CITADO existe, nunca se o que EXISTE está citado.
    const inventario = readFileSync(INVENTARIO, 'utf8');
    expect(
      /vigiado nos DOIS sentidos/.test(inventario),
      'o fecho do `TRAVAS.md` perdeu a distinção dos dois sentidos.\n'
      + 'Ela é o que impede alguém de reler o arquivo, concluir que os portões\n'
      + 'existentes bastam, e apagar esta checagem como se fosse a espiral de\n'
      + 'controle do §9.8. Foi exatamente esse raciocínio que criou o buraco.',
    ).toBe(true);
  });
});
