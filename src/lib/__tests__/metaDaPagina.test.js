import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { META, DOMINIO } from '../metaDaPagina.js';

/**
 * `[17/09]` Cada página pública se anuncia como ela mesma — Etapa 2 do Prompt 1.
 *
 * ── O que existia antes ─────────────────────────────────────────────────────
 *
 * O site é uma aplicação de página única com `index.html` estático, e navegação
 * do React Router **não recarrega o documento**. Resultado: as seis páginas
 * públicas serviam o MESMO `<title>` e a MESMA `description`.
 *
 * Para quem indexa, seis endereços que se anunciam igual são a mesma página —
 * ele escolhe um e trata os outros como duplicata. Quem procurasse "termos de
 * uso do GamerHub" podia cair na landing.
 *
 * ── Por que a trava é de CONTRATO, e não "o título existe" ──────────────────
 *
 * O jeito de isto voltar a quebrar não é alguém apagar o catálogo: é **nascer
 * uma página pública nova** e ninguém lembrar de acrescentá-la. Aí ela herda o
 * título da landing, em silêncio, e nada acusa.
 *
 * Então a trava lê as rotas do ROUTER e as cruza com o catálogo, nos dois
 * sentidos.
 */

const ROUTER = 'src/App.jsx';

/** As rotas públicas do router — as que não estão atrás de `RequireAuth`. */
function rotasPublicas() {
  const linhas = readFileSync(ROUTER, 'utf8')
    .split('\n')
    .filter((l) => /<Route\s+path=/.test(l));

  expect(
    linhas.length,
    `Nao achei rota nenhuma em ${ROUTER} — o router mudou de forma?\n`
    + '  Sem isto a trava aprova qualquer catalogo.',
  ).toBeGreaterThanOrEqual(10);

  return linhas
    .filter((l) => !/RequireAuth/.test(l))
    .map((l) => l.match(/path="([^"]+)"/)?.[1])
    .filter((p) => p && p !== '*'
      // Fluxo de entrada não é conteúdo: não se indexa tela de login, e o
      // `robots.txt` já pede para não rastrear. Fora do catálogo de propósito.
      && p !== '/login' && !p.startsWith('/auth'));
}

describe('meta por página', () => {
  it('toda rota pública do router tem entrada no catálogo', () => {
    const faltando = rotasPublicas().filter((p) => !META[p]);
    expect(
      faltando,
      `Rota publica SEM titulo e descricao proprios:\n  ${faltando.join('\n  ')}\n\n`
      + '  Ela vai herdar o titulo da landing, e para quem indexa as duas viram\n'
      + '  a mesma pagina. Acrescente em `src/lib/metaDaPagina.js`.',
    ).toEqual([]);
  });

  it('o catálogo não inventa rota que não existe', () => {
    const publicas = rotasPublicas();
    const orfas = Object.keys(META).filter((p) => !publicas.includes(p));
    expect(
      orfas,
      `O catalogo tem entrada para rota que nao existe (ou que exige login):\n  ${orfas.join('\n  ')}\n\n`
      + '  Ou a pagina foi removida e a entrada ficou, ou o caminho tem erro de\n'
      + '  digitacao — e ai a pagina REAL continua sem meta propria.',
    ).toEqual([]);
  });

  it('nenhum título se repete', () => {
    // O ponto inteiro da etapa: dois títulos iguais recriam o problema que ela
    // veio resolver, e o teste acima não pega isso (as duas TÊM entrada).
    const titulos = Object.values(META).map((m) => m.titulo);
    const repetidos = titulos.filter((t, i) => titulos.indexOf(t) !== i);
    expect(
      [...new Set(repetidos)],
      `Titulo repetido entre paginas publicas:\n  ${[...new Set(repetidos)].join('\n  ')}\n\n`
      + '  Duas paginas com o mesmo titulo voltam a ser "a mesma pagina" para\n'
      + '  quem indexa — que e exatamente o defeito que esta etapa corrigiu.',
    ).toEqual([]);
  });

  it('nenhuma descrição se repete, e todas cabem no que o buscador mostra', () => {
    const vistas = new Set();
    for (const [rota, m] of Object.entries(META)) {
      expect(
        vistas.has(m.descricao),
        `A descricao de \`${rota}\` e igual a de outra pagina.`,
      ).toBe(false);
      vistas.add(m.descricao);

      // ~160 caracteres é o que costuma aparecer no resultado de busca. Acima
      // disso o texto é cortado — não é erro, mas a última frase se perde.
      expect(
        m.descricao.length,
        `A descricao de \`${rota}\` tem ${m.descricao.length} caracteres.\n`
        + '  Acima de ~160 o buscador corta, e o fim da frase nao aparece.\n'
        + '  Abaixo de ~50 ela nao diz o bastante para alguem decidir clicar.',
      ).toBeGreaterThanOrEqual(50);
      expect(m.descricao.length, `A descricao de \`${rota}\` passa de 200 caracteres.`)
        .toBeLessThanOrEqual(200);

      expect(
        m.titulo.length,
        `O titulo de \`${rota}\` tem ${m.titulo.length} caracteres — acima de ~65 o buscador corta.`,
      ).toBeLessThanOrEqual(70);
    }
  });

  it('o `index.html` tem canonical base, para quem não executa JavaScript', () => {
    // O `MetaDaRota` reescreve o canonical por página — mas só depois que o JS
    // roda. Sem um valor no HTML, quem nao executa JS fica sem canonical, e
    // `?utm_source=…` vira uma segunda versao da landing.
    const html = readFileSync('index.html', 'utf8');
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];

    expect(
      canonical,
      'O `index.html` ficou sem `<link rel="canonical">`.\n'
      + '  O MetaDaRota so age depois do JavaScript. Sem o valor base, quem nao\n'
      + '  executa JS nao ve canonical nenhum.',
    ).toBeTruthy();
    expect(
      canonical.startsWith(DOMINIO),
      `O canonical base aponta para \`${canonical}\`, fora de ${DOMINIO}.`,
    ).toBe(true);
  });

  it('o componente está MONTADO no App — senão o catálogo não vale nada', () => {
    // A falha mais fácil de não perceber: o catálogo perfeito, os testes acima
    // todos verdes, e ninguém chamando `aplicarMeta`. Verde total, zero efeito.
    const app = readFileSync(ROUTER, 'utf8');
    expect(
      /<MetaDaRota\s*\/>/.test(app) && /import MetaDaRota/.test(app),
      `O \`<MetaDaRota />\` nao esta montado em ${ROUTER}.\n`
      + '  Sem ele o catalogo existe e nao e aplicado: todas as paginas voltam a\n'
      + '  servir o titulo do index.html, e os outros testes deste arquivo\n'
      + '  continuariam VERDES.',
    ).toBe(true);
  });
});
