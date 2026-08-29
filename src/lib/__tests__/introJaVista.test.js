import { describe, it, expect } from 'vitest';
import { deveTocarIntro } from '../introJaVista';

/**
 * Trava da intro do raio.
 *
 * ── O que ela protege ───────────────────────────────────────────────────────
 *
 * Relato do dono: *"quando recarrego a página, vem a animação, mudo de aba, de
 * novo, saio do login, novamente"*. A intro segura o conteúdo do Hero enquanto
 * roda, então cada repetição é ~1,3 s de espera para ver a mesma coisa.
 *
 * A decisão está isolada do componente de propósito: `sessionStorage` **lança**
 * em modo privado, com cookies bloqueados ou com o armazenamento cheio.
 * Enterrado num `useState`, esse `throw` derrubaria a landing inteira — a
 * primeira página do site — por causa de um enfeite.
 */

describe('deveTocarIntro', () => {
  it('toca na primeira vez da sessão', () => {
    expect(deveTocarIntro({ jaVista: false })).toBe(true);
  });

  it('NÃO toca de novo na mesma sessão', () => {
    expect(
      deveTocarIntro({ jaVista: true }),
      'A intro voltou a tocar mesmo já tendo sido vista. Cada repetição é\n'
      + '~1,3 s segurando o conteúdo do Hero para mostrar o que a pessoa já viu.',
    ).toBe(false);
  });

  it('NÃO toca para quem pediu menos movimento', () => {
    expect(
      deveTocarIntro({ jaVista: false, prefereMenosMovimento: true }),
      'A intro é o movimento mais agressivo do site: tela inteira, flash e\n'
      + 'clarão. Quem pediu `prefers-reduced-motion` ao sistema pediu por causa\n'
      + 'de coisas exatamente assim.',
    ).toBe(false);
  });

  it('a preferência de movimento vence, mesmo sendo a primeira vez', () => {
    expect(deveTocarIntro({ jaVista: true, prefereMenosMovimento: true })).toBe(false);
  });

  it('sem informação nenhuma, toca — é o comportamento de antes', () => {
    // O padrão importa: quem não consegue ler o `sessionStorage` (modo privado)
    // cai aqui. Errar mostrando a intro é melhor do que errar escondendo-a de
    // todo mundo que navega em janela anônima, sem ninguém entender por quê.
    expect(deveTocarIntro({})).toBe(true);
    expect(deveTocarIntro()).toBe(true);
  });
});
