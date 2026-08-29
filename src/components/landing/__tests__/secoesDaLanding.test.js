import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECOES, alvoDaSecao } from '../secoesDaLanding';

/**
 * Trava dos links internos da landing.
 *
 * ── O que ela impede ────────────────────────────────────────────────────────
 *
 * Que um card do topo, um item do rodapé ou uma aba da navegação lateral levem
 * a uma âncora que não existe na página. O sintoma é peculiar e silencioso: o
 * navegador **não dá erro** para uma âncora inexistente — ele simplesmente não
 * rola. O visitante clica, nada acontece, e parece que o site travou.
 *
 * Nenhum teste de renderização pegaria isso: os dois lados renderizam
 * perfeitamente, e o que está errado é a correspondência entre eles. É a Fase 4
 * da auditoria aplicada à landing.
 *
 * ── Por que a lista precisava sair de dentro dos componentes ────────────────
 *
 * Antes, a faixa do topo tinha a própria lista escrita à mão — e ela **já
 * divergia**: citava "Lives ao vivo" e não mencionava Keys, que é uma seção
 * inteira do site. Ninguém tinha notado porque a faixa não levava a lugar
 * nenhum; assim que ela virou navegação, a divergência viraria link quebrado.
 */

const raiz = join(import.meta.dirname, '../../..');
const LANDING = readFileSync(join(raiz, 'pages/Landing.jsx'), 'utf8');

describe('as seções declaradas existem na página', () => {
  it.each(SECOES.map(s => [s.id]))('a seção `%s` tem âncora na Landing', (id) => {
    expect(
      LANDING,
      `Nenhuma seção da Landing tem \`id="${id}"\`.\n`
      + 'O card do topo, o rodapé e a navegação lateral apontam para essa\n'
      + 'âncora. Âncora inexistente NÃO dá erro no navegador: ele só não rola.\n'
      + 'Para quem clica, é indistinguível de site travado.',
    ).toContain(`id="${id}"`);
  });

  it('toda seção da página está na lista (nenhuma fica sem link)', () => {
    const idsNaPagina = [...LANDING.matchAll(/<FeatureSection\s+id="([^"]+)"/g)].map(m => m[1]);
    expect(idsNaPagina.length).toBeGreaterThan(0);
    for (const id of idsNaPagina) {
      expect(
        SECOES.map(s => s.id),
        `A seção "${id}" existe na Landing mas não está em SECOES — então ela\n`
        + 'não aparece na faixa do topo, nem no rodapé, nem no menu. Uma seção\n'
        + 'inteira do site fica sem caminho até ela, e nada acusa.',
      ).toContain(id);
    }
  });

  it('não há id repetido — âncora duplicada leva sempre à primeira', () => {
    const ids = SECOES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada seção tem rótulo, ícone e cor para as três telas usarem', () => {
    for (const s of SECOES) {
      expect(s.rotulo, `seção "${s.id}" sem rótulo`).toBeTruthy();
      expect(s.icone, `seção "${s.id}" sem ícone`).toBeTruthy();
      expect(s.cor, `seção "${s.id}" sem cor`).toBeTruthy();
    }
  });

  it('o alvo é uma âncora da própria página', () => {
    expect(alvoDaSecao('feed')).toBe('#feed');
  });
});

describe('quem consome a lista não escreve a sua própria', () => {
  // Se um destes voltar a ter lista literal, ela volta a divergir em silêncio.
  it.each([
    ['HighlightsStrip.jsx'],
    ['LandingFooter.jsx'],
    ['LandingSidebar.jsx'],
  ])('%s importa de secoesDaLanding', (arquivo) => {
    const fonte = readFileSync(join(raiz, 'components/landing', arquivo), 'utf8');
    expect(
      fonte,
      `${arquivo} parou de importar a lista de seções e provavelmente tem uma\n`
      + 'cópia própria. Cópia diverge — foi assim que a faixa do topo ficou sem\n'
      + 'Keys sem ninguém perceber.',
    ).toMatch(/from '\.\/secoesDaLanding'/);
  });
});
