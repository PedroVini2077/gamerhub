import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { varrerFontes } from './varrerFontes';

/**
 * Crase dentro de bloco GLSL FECHA o template literal do JS.
 *
 * ── Por que existe esta trava ───────────────────────────────────────────────
 *
 * `[10/09]` O mesmo erro aconteceu **três vezes na mesma sessão**. O shader
 * mora num template literal:
 *
 * ```js
 * const fragmentShader = \/* glsl *\/ `
 *   void main() { ... }
 * `;
 * ```
 *
 * Ao comentar uma decisão ali dentro no estilo do projeto — que usa crase para
 * marcar nome de símbolo — a crase encerra a string. O que vem depois vira
 * código JS, e a mensagem de erro não fala de crase nenhuma: fala
 * *"Decimals with leading zeros are not allowed in strict mode"*, porque o
 * `[10/09]` do comentário virou o número `09`.
 *
 * Diagnosticar isso custa minutos toda vez, e o erro não aparece no editor —
 * só na hora de carregar o módulo.
 *
 * ── O que ela cobre ─────────────────────────────────────────────────────────
 *
 * Qualquer arquivo de `src/` que declare um bloco marcado `/* glsl *\/`. A
 * varredura falha se a pasta sumir ou for renomeada (`varrerFontes`), senão a
 * trava ficaria verde para sempre sem ler nada.
 */

const MARCA = '/* glsl */';

/** Extrai os blocos de template literal marcados como GLSL. */
function blocosGlsl(fonte) {
  const blocos = [];
  let i = 0;
  for (;;) {
    const marca = fonte.indexOf(MARCA, i);
    if (marca === -1) break;
    const abre = fonte.indexOf('`', marca);
    if (abre === -1) break;
    const fecha = fonte.indexOf('`', abre + 1);
    if (fecha === -1) break;
    blocos.push({ inicio: abre + 1, texto: fonte.slice(abre + 1, fecha) });
    i = fecha + 1;
  }
  return blocos;
}

describe('crase dentro de bloco GLSL', () => {
  const arquivos = varrerFontes('src', (nome) => nome.endsWith('.js') || nome.endsWith('.jsx'));

  it('varreu a pasta de fontes de verdade', () => {
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it('nenhum bloco GLSL termina antes do fim do shader', () => {
    const suspeitos = [];

    for (const caminho of arquivos) {
      const fonte = readFileSync(caminho, 'utf8');
      if (!fonte.includes(MARCA)) continue;

      for (const bloco of blocosGlsl(fonte)) {
        // O critério é o FIM do bloco, não o começo — e isso custou uma
        // rodada. A primeira versão exigia `void main` dentro do bloco, e a
        // crase que eu injetei para provar a trava estava DEPOIS do `void
        // main`: o teste passou com o bug presente, que é a definição de trava
        // decorativa (§2).
        //
        // Um shader completo termina no `}` do `main`. Se a string fechou numa
        // crase perdida, o bloco acaba no meio de um comentário.
        const texto = bloco.texto.trimEnd();
        const completo = texto.endsWith('}')
          && (texto.includes('gl_FragColor') || texto.includes('gl_Position'));
        if (completo) continue;
        const linha = fonte.slice(0, bloco.inicio).split('\n').length;
        suspeitos.push(`${caminho}:${linha}`);
      }
    }

    expect(
      suspeitos,
      'Bloco marcado /* glsl */ que termina ANTES do fim do shader: quase sempre é uma '
      + 'CRASE dentro do comentário do shader, que fecha o template literal do JS. '
      + 'O erro que isso produz não fala de crase — fala de número com zero à '
      + 'esquerda, porque uma data como [10/09] no comentário virou código. '
      + 'Tire a crase do comentário; use aspas ou nada.\n'
      + `Suspeitos: ${suspeitos.join(', ')}`,
    ).toEqual([]);
  });
});
