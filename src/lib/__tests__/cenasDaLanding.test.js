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
const ARTE = 'src/components/landing/ArteDaCena.jsx';
const MAPA = 'src/lib/cenasDaLanding.js';
const REF_LARGA = 'docs/identidade/referencias/cenas';
const REF_ALTA = 'docs/identidade/referencias/cenas-retrato';
const GERADAS = 'src/assets/landing/cenas';

describe('as artes das cenas', () => {
  const nomesDe = (pasta) => readdirSync(pasta)
    .filter((n) => n.endsWith('.webp'))
    .map((n) => n.replace('.webp', ''))
    .sort();

  it('as duas pastas de referência têm as MESMAS cenas', () => {
    // `[12/09]` Cada cena existe em duas composições: a larga (16:9, do
    // computador) e a de retrato (do celular). Elas não são a mesma imagem
    // redimensionada — são artes diferentes, geradas pelo dono.
    //
    // A falha silenciosa: acrescentar uma cena só numa das pastas. O site
    // funciona no aparelho que tem a arte e mostra a cena ANTERIOR no outro,
    // porque o `<picture>` escolhe uma fonte que não existe e cai no `<img>`.
    const largas = nomesDe(REF_LARGA);
    const altas = nomesDe(REF_ALTA);

    expect(
      largas.length,
      `Nenhuma referência em ${REF_LARGA}. Se a pasta mudou de lugar, ajuste `
      + 'esta trava — senão ela aprova tudo sem olhar nada.',
    ).toBeGreaterThanOrEqual(7);

    expect(
      altas,
      'As duas pastas de referência têm cenas diferentes.\n'
      + `  largas:  ${largas.join(', ')}\n`
      + `  retrato: ${altas.join(', ')}\n`
      + '  Cena que existe só numa delas aparece num aparelho e some no outro.',
    ).toEqual(largas);
  });

  it('toda referência tem as artes geradas, e vice-versa', () => {
    // A divergência acontece assim: alguém troca uma arte em `referencias/` e
    // esquece de rodar `npm run cenas`. O site continua servindo a arte VELHA,
    // sem erro nenhum, e a pessoa jura que trocou.
    for (const nome of nomesDe(REF_LARGA)) {
      for (const sufixo of [
        'larga-1600', 'larga-1200', 'larga-828',
        'alta-828', 'alta-620', 'alta-420',
      ]) {
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

  it('cada cena tem as DUAS composições no mapa', () => {
    const mapa = FONTE(MAPA);
    // Sem `alta`, o `<picture>` não tem fonte de celular e cai na arte 16:9 —
    // que foi medida como ilegível numa tela em pé. Funciona, aparece, e está
    // errado.
    expect(
      mapa,
      'O mapa das cenas deixou de expor a composição de RETRATO (`alta`).\n'
      + '  Sem ela o celular volta a receber a arte 16:9 espremida, onde o texto\n'
      + '  da interface fica com 2–3 px. Nada quebra: só fica ilegível.',
    ).toContain('alta:');
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

describe('o cartão de compartilhamento', () => {
  it('o recorte do cartão usa as medidas REAIS da arte', () => {
    // `[12/09]` O cartão passou a ser a arte do ATO 0, recortada de 1672x940
    // para 1200x630. O script escreve essas duas medidas à mão, porque ele lê
    // o arquivo como bytes e não como imagem.
    //
    // A falha silenciosa: o dono regerar a arte noutra proporção. A conta de
    // "cobrir" passaria a mirar no lugar errado — o cartão sairia com tarja,
    // ou cortando o assunto — e nada acusaria, porque o arquivo é gerado sem
    // erro e ninguém olha o og:image depois de ele existir uma vez.
    const script = readFileSync('scripts/gerar-icones.mjs', 'utf8');
    const mapa = FONTE(MAPA);
    const larg = script.match(/larguraDaArte:\s*(\d+)/)?.[1];
    const alt = script.match(/alturaDaArte:\s*(\d+)/)?.[1];
    expect(
      `${larg}x${alt}`,
      'As medidas da arte no gerador do cartão não batem com as do site.\n'
      + '  `scripts/gerar-icones.mjs` recorta a arte por essas duas medidas.\n'
      + '  Divergindo delas, o cartão sai com tarja preta ou cortando o meio —\n'
      + '  e a prévia do WhatsApp é onde muita gente vê o site pela primeira vez.',
    ).toBe(
      `${mapa.match(/export const LARGURA = (\d+)/)[1]}x${mapa.match(/export const ALTURA = (\d+)/)[1]}`,
    );
  });
});

describe('o custo das artes', () => {
  // `[12/09]` O `<picture>` era copiado em `CenaDaLanding` e em `FinalCTA`, e o
  // prólogo seria a terceira cópia. Hoje ele mora em `ArteDaCena`, e é lá que
  // estas travas olham — mas só depois de provarem que os chamadores REALMENTE
  // passam por ele. Sem essa primeira asserção, alguém poderia reescrever um
  // `<img>` à mão dentro da cena e as três verificações abaixo continuariam
  // verdes, olhando um arquivo que ninguém mais usa.
  it('as cenas usam o `ArteDaCena` — e não um `<img>` próprio', () => {
    for (const caminho of [CENA, CTA]) {
      const fonte = FONTE(caminho);
      expect(
        fonte,
        `${caminho} deixou de usar \`<ArteDaCena>\`.\n`
        + '  As seis decisões de carregamento (media, srcSet, sizes, dimensões,\n'
        + '  loading, fetchPriority) voltaram a ser copiadas. Copiadas, elas\n'
        + '  divergem na primeira vez que alguém mexer em uma — e a divergência\n'
        + '  não aparece: a página continua bonita, só custa mais.',
      ).toContain('<ArteDaCena');
      expect(
        /<img[\s>]/.test(fonte),
        `${caminho} voltou a ter um \`<img>\` escrito à mão.`,
      ).toBe(false);
    }
  });

  it('só a PRIMEIRA arte da página pode ser ansiosa', () => {
    const arte = FONTE(ARTE);
    expect(
      arte,
      `${ARTE} deixou de decidir o \`loading\`.\n`
      + '  Sem `loading="lazy"` nas artes de baixo o navegador baixa as SETE de\n'
      + '  uma vez: são ~960 kB medidos no computador, para quem talvez pare na\n'
      + '  primeira dobra. Nada estoura, nada aparece em log — só a conta de\n'
      + '  dados de quem visita. E o orçamento de bytes do CI não vê isto: ele\n'
      + '  mede chunk de JavaScript.',
    ).toContain('loading=');
    expect(arte).toContain("'eager'");
    expect(arte).toContain("'lazy'");

    // O CTA é o último elemento da página: ele nunca pode ser ansioso.
    // A chamada, não o texto: o arquivo EXPLICA num comentário por que não pede
    // prioridade, e varrer o texto inteiro reprovaria a própria explicação.
    expect(
      /<ArteDaCena[^/>]*prioridade/.test(FONTE(CTA)),
      'O `FinalCTA` passou a pedir `prioridade`.\n'
      + '  Ele é a ÚLTIMA seção da landing. Arte ansiosa ali é banda cobrada de\n'
      + '  quem talvez nunca role até lá.',
    ).toBe(false);
  });

  it('toda arte reserva o espaço dela antes de chegar', () => {
    const arte = FONTE(ARTE);
    expect(
      /width=\{/.test(arte) && /height=\{/.test(arte),
      `${ARTE} tem \`<img>\` sem \`width\`/\`height\`.\n`
      + '  Sem eles o navegador não sabe quanto espaço reservar, e a página\n'
      + '  EMPURRA o conteúdo para baixo quando cada arte chega — enquanto a\n'
      + '  pessoa está lendo. É o salto mais irritante que existe, e ele não\n'
      + '  quebra nada: só acontece.',
    ).toBe(true);
  });

  it('o `sizes` acompanha o `srcset` — senão o celular baixa a arte do monitor', () => {
    const arte = FONTE(ARTE);
    expect(
      arte.includes('srcSet') && arte.includes('sizes='),
      `${ARTE} tem \`srcSet\` sem \`sizes\` (ou o contrário).\n`
      + '  Sem `sizes`, o navegador assume que a imagem ocupa 100% da largura\n'
      + '  da JANELA e escolhe o arquivo maior — o celular baixa a arte de\n'
      + '  1600 px. Funciona, aparece certo, e custa 3x mais dados.',
    ).toBe(true);
  });
});
