import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

/**
 * As travas das CENAS da landing.
 *
 * `[12/09]` As três falhas abaixo têm a mesma assinatura: **a página continua
 * bonita e nada estoura**. É por isso que precisam de teste — nenhuma delas
 * aparece como erro, e o portão de bytes do CI só mede JavaScript.
 */

const FONTE = (c) => readFileSync(c, 'utf8');
const CENA = 'src/components/landing/CenaDaLanding.jsx';
const CTA = 'src/components/landing/FinalCTA.jsx';
const MAPA = 'src/lib/cenasDaLanding.js';
const REFERENCIAS = 'docs/identidade/referencias/cenas';
const GERADAS = 'src/assets/landing/cenas';

describe('as artes das cenas', () => {
  it('toda referência tem as artes geradas, e vice-versa', () => {
    // A divergência acontece assim: alguém troca uma arte em `referencias/` e
    // esquece de rodar `npm run cenas`. O site continua servindo a arte VELHA,
    // sem erro nenhum, e a pessoa jura que trocou.
    const refs = readdirSync(REFERENCIAS)
      .filter((n) => n.endsWith('.webp'))
      .map((n) => n.replace('.webp', ''));

    expect(
      refs.length,
      `Nenhuma referência em ${REFERENCIAS}. Se a pasta mudou de lugar, ajuste `
      + 'esta trava — senão ela aprova tudo sem olhar nada.',
    ).toBeGreaterThanOrEqual(7);

    for (const nome of refs) {
      // Três larguras largas + três altas por cena.
      for (const sufixo of ['larga-1600', 'larga-1200', 'larga-828']) {
        expect(
          existsSync(`${GERADAS}/${nome}-${sufixo}.webp`),
          `Falta \`${nome}-${sufixo}.webp\` em ${GERADAS}.\n`
          + '  A referência existe mas a arte do site não foi gerada. O site vai\n'
          + '  servir o que sobrou da geração anterior — ou nada — e ninguém\n'
          + '  percebe, porque não há erro.\n'
          + '  Rode `npm run cenas`.',
        ).toBe(true);
      }
    }
  });

  it('o mapa não monta caminho por string — ele IMPORTA cada arquivo', () => {
    const mapa = FONTE(MAPA);
    // Montar `../assets/.../${nome}.webp` por template faria o Vite não ver o
    // arquivo: ele não entra no build, e o `src` aponta para um caminho que não
    // existe em produção. Em desenvolvimento funciona — é o pior tipo de bug.
    expect(
      mapa,
      'O mapa das cenas passou a montar caminho por string.\n'
      + '  O Vite só inclui no build o que é IMPORTADO estaticamente. Caminho\n'
      + '  montado em tempo de execução funciona em desenvolvimento e some em\n'
      + '  produção — a página fica com retângulos vazios, sem erro no console.',
    ).not.toMatch(/from\s+[`'"].*\$\{/);
    expect(mapa.match(/^import .* from '\.\.\/assets\/landing\/cenas\//gm)?.length)
      .toBeGreaterThanOrEqual(21);
  });
});

describe('o custo das artes', () => {
  it('toda cena que não é a primeira é PREGUIÇOSA', () => {
    for (const caminho of [CENA, CTA]) {
      const fonte = FONTE(caminho);
      expect(
        fonte,
        `${caminho} deixou de declarar \`loading\`.\n`
        + '  Sem `loading="lazy"` o navegador baixa as SEIS artes de uma vez: são\n'
        + '  813 kB medidos no computador, para quem talvez pare na primeira\n'
        + '  dobra. Nada estoura, nada aparece em log — só a conta de dados de\n'
        + '  quem visita. E o orçamento de bytes do CI não vê isto: ele mede\n'
        + '  chunk de JavaScript.',
      ).toContain('loading=');
    }
    // O CTA é o último elemento da página: ele nunca pode ser ansioso.
    expect(FONTE(CTA)).toContain('loading="lazy"');
  });

  it('toda arte reserva o espaço dela antes de chegar', () => {
    for (const caminho of [CENA, CTA]) {
      const fonte = FONTE(caminho);
      expect(
        /width=\{/.test(fonte) && /height=\{/.test(fonte),
        `${caminho} tem \`<img>\` sem \`width\`/\`height\`.\n`
        + '  Sem eles o navegador não sabe quanto espaço reservar, e a página\n'
        + '  EMPURRA o conteúdo para baixo quando cada arte chega — enquanto a\n'
        + '  pessoa está lendo. É o salto mais irritante que existe, e ele não\n'
        + '  quebra nada: só acontece.',
      ).toBe(true);
    }
  });

  it('o `sizes` acompanha o `srcset` — senão o celular baixa a arte do monitor', () => {
    for (const caminho of [CENA, CTA]) {
      const fonte = FONTE(caminho);
      expect(
        fonte.includes('srcSet') && fonte.includes('sizes='),
        `${caminho} tem \`srcSet\` sem \`sizes\` (ou o contrário).\n`
        + '  Sem `sizes`, o navegador assume que a imagem ocupa 100% da largura\n'
        + '  da JANELA e escolhe o arquivo maior — o celular baixa a arte de\n'
        + '  1600 px. Funciona, aparece certo, e custa 3x mais dados.',
      ).toBe(true);
    }
  });
});
