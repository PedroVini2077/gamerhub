import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Trava de deriva entre os modos da tela de entrada e o que ela DIZ em cada um.
 *
 * ── O que ela impede ────────────────────────────────────────────────────────
 *
 * `/login` tem três modos — entrar, cadastrar e recuperar senha — e desde
 * `[04/09]` a frase abaixo do logo muda com o modo (é o "escolha seu
 * personagem" do cadastro). O mapa é FECHADO de propósito: modo sem frase faz a
 * linha sumir, em vez de herdar a frase errada por um `else` (§4).
 *
 * Sumir é visível; herdar a errada não é. O cadastro exibindo "Sua base de
 * operações gamer" pareceria certo para quem não sabe que deveria ser outra
 * coisa — e é exatamente assim que a deriva sobrevive (§6 FASE 4).
 *
 * ── Por que varredura de fonte ──────────────────────────────────────────────
 *
 * Os modos não são uma constante exportada: eles aparecem nas chamadas
 * `switchMode('x')` e no `useState` inicial. Um modo novo nasce ali, não numa
 * lista — então é ali que se procura.
 */
describe('todo modo da tela de entrada tem frase própria', () => {
  const src = readFileSync('src/pages/Login.jsx', 'utf8');

  it('o arquivo foi lido de verdade', () => {
    // Sem isto, renomear `Login.jsx` deixaria esta trava verde para sempre —
    // a classe "teste que não consegue falhar" que já pegou 6 travas em 02/09.
    expect(src.length).toBeGreaterThan(2000);
    expect(src).toContain('LINHA_DO_MODO');
  });

  it('todo modo usado no código existe no mapa de frases', () => {
    const declarados = new Set(
      [...src.matchAll(/LINHA_DO_MODO\s*=\s*\{([\s\S]*?)\n\}/g)][0]?.[1]
        ?.matchAll(/^\s*(\w+)\s*:/gm) ?? [],
    );
    const noMapa = new Set([...declarados].map((m) => m[1]));

    const usados = new Set([
      ...[...src.matchAll(/switchMode\(\s*'(\w+)'\s*\)/g)].map((m) => m[1]),
      ...[...src.matchAll(/useState\(\s*'(login|register|forgot)'\s*\)/g)].map((m) => m[1]),
    ]);

    expect(usados.size, 'nao achei modo nenhum no Login.jsx — o seletor mudou?')
      .toBeGreaterThanOrEqual(3);

    const semFrase = [...usados].filter((m) => !noMapa.has(m));
    expect(semFrase, semFrase.length === 0 ? '' : (
      `\n  modo(s) sem frase no LINHA_DO_MODO: ${semFrase.join(', ')}\n\n`
      + '  A linha abaixo do logo vai sumir nesse modo. Acrescente a frase em\n'
      + '  src/pages/Login.jsx — o mapa e fechado de proposito, para modo novo\n'
      + '  aparecer vazio em vez de herdar a frase de outro modo.\n'
    )).toEqual([]);
  });
});
