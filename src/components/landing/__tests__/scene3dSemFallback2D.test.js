import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trava do flash da landing 2D.
 *
 * ── O defeito ───────────────────────────────────────────────────────────────
 *
 * A `Scene2D` era o fallback do `Suspense` e também o que aparecia enquanto a
 * cena 3D esperava o navegador ficar ocioso. Parecia gentileza — manter o Hero
 * decorado — e era um defeito, que o dono viu no PC da loja, onde a espera é
 * mais longa: *"a landing 2d aparecendo por alguns segundos depois de
 * recarregar a landing 3d"*, e *"não é pra aparecer em hipótese alguma"*.
 *
 * São duas cenas com arranjos diferentes. Trocar uma pela outra no meio do
 * carregamento não é "carregando": é a página mudando na frente de quem está
 * olhando.
 *
 * ── Por que ler o fonte ─────────────────────────────────────────────────────
 *
 * O caso só aparece na janela entre a montagem e a cena ficar pronta. Um teste
 * de renderização precisaria congelar exatamente esse instante, com o
 * `requestIdleCallback` e o `lazy()` no meio. O que precisa ser garantido é uma
 * escolha de código, e ela é legível.
 */

const FONTE = readFileSync(
  join(import.meta.dirname, '../Scene3D.jsx'), 'utf8',
);

describe('Scene3D não mostra a 2D para quem vai receber a 3D', () => {
  it('o fallback do Suspense é nulo, não a Scene2D', () => {
    expect(
      FONTE,
      'A `Scene2D` voltou a ser o fallback do Suspense. Quem vai receber a cena\n'
      + '3D passa a ver a landing 2D por alguns segundos e depois ela é trocada —\n'
      + 'a página muda de arranjo na frente de quem está olhando.',
    ).toMatch(/<Suspense fallback=\{null\}>/);
  });

  it('a busca do chunk começa antes da hora de montar', () => {
    expect(
      FONTE,
      'A pré-busca sumiu. Sem ela, a espera pelo ocioso e o download de 708 kB\n'
      + 'viram uma fila: primeiro espera, depois baixa. Era isso que fazia o\n'
      + 'buraco durar "alguns segundos" no PC da loja.',
    ).toMatch(/import\('\.\/scene3d\/LandingScene'\)\.catch/);
  });

  it('a Scene2D continua existindo para quem NÃO recebe a 3D', () => {
    // Ela não foi apagada: é a cena de quem está no celular, pediu menos
    // movimento, ou escolheu a versão leve. Some só do caminho da 3D.
    expect(FONTE).toMatch(/<Scene2D \/>/);
  });
});
