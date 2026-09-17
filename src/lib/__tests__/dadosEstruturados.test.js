import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { META, DOMINIO } from '../metaDaPagina.js';

/**
 * `[17/09]` Dados estruturados e acessibilidade — Etapa 3 do Prompt 1.
 *
 * ── O risco aqui NÃO é ficar sem JSON-LD; é MENTIR nele ─────────────────────
 *
 * Pedido dele, na letra: *"NÃO invente dados estruturados. Não coloque
 * avaliações falsas, preços inexistentes, informações inexistentes, links
 * falsos, dados que não aparecem no site"*.
 *
 * Dado estruturado é uma afirmação legível por máquina sobre o que o site é.
 * Um `aggregateRating` sem avaliação, um `Organization` sem organização ou um
 * `SearchAction` apontando para uma busca que não existe são mentiras que o
 * buscador repassa — e, quando ele percebe, quem paga é o domínio.
 *
 * Por isso esta trava é **uma lista fechada do que pode aparecer**, e não uma
 * checagem de que o bloco existe. Tipo novo entra aqui junto com a evidência
 * de que o dado é real.
 *
 * ── O que foi declarado, e o que foi deixado de fora ────────────────────────
 *
 * | Tipo | Decisão |
 * | --- | --- |
 * | `WebSite` | **declarado** — nome, URL, descrição e idioma existem no site |
 * | `Organization` | **fora**: o GamerHub é um projeto, não uma organização com endereço, contato ou quadro de pessoas |
 * | `SearchAction` | **fora**: declara uma URL de busca, e não há busca pública. Seria prometer uma página que devolve 404 |
 */

const INDEX = 'index.html';

/** Os tipos que este site tem direito de afirmar, com o motivo ao lado. */
const TIPOS_PERMITIDOS = ['WebSite'];

/**
 * O que NÃO pode aparecer sem dado real por trás. Não é a lista completa do
 * schema.org — é a lista do que costuma ser inventado.
 */
const CAMPOS_QUE_EXIGEM_PROVA = [
  'aggregateRating', 'ratingValue', 'reviewCount', 'review',
  'offers', 'price', 'priceCurrency',
  'address', 'telephone', 'email',
  'potentialAction', 'SearchAction',
  'foundingDate', 'numberOfEmployees',
];

/** Tira comentario de bloco e de linha, para a trava ler CODIGO e nao prosa. */
function semComentarios(fonte) {
  return fonte
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function blocoJsonLd() {
  const html = readFileSync(INDEX, 'utf8');
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return m ? m[1] : null;
}

describe('dados estruturados', () => {
  it('o bloco existe e é JSON válido', () => {
    const cru = blocoJsonLd();
    expect(
      cru,
      `Nao achei o bloco \`application/ld+json\` em ${INDEX}.\n`
      + '  Sem ele o buscador nao tem como saber que este site e o GamerHub.',
    ).toBeTruthy();

    // JSON-LD quebrado é pior do que ausente: o buscador tenta ler, falha, e o
    // erro aparece só no Search Console — que ninguém abre por diversão.
    expect(() => JSON.parse(cru), 'O JSON-LD nao e JSON valido.').not.toThrow();
  });

  it('só declara tipo que este site TEM direito de afirmar', () => {
    const d = JSON.parse(blocoJsonLd());
    const tipos = [d['@type']].flat();

    const indevidos = tipos.filter((t) => !TIPOS_PERMITIDOS.includes(t));
    expect(
      indevidos,
      `Tipo de dado estruturado declarado sem estar na lista:\n  ${indevidos.join('\n  ')}\n\n`
      + `  Permitidos hoje: ${TIPOS_PERMITIDOS.join(', ')}.\n\n`
      + '  Isto nao e burocracia: dado estruturado e afirmacao sobre o que o site\n'
      + '  E. `Organization` ficou de fora porque o GamerHub e um projeto, nao\n'
      + '  uma organizacao com endereco e quadro de pessoas.\n\n'
      + '  Para acrescentar um tipo, acrescente-o AQUI junto com a evidencia de\n'
      + '  que o dado e real — nao o contrario.',
    ).toEqual([]);
  });

  it('não afirma nada que o site não tenha', () => {
    const cru = blocoJsonLd();
    const inventados = CAMPOS_QUE_EXIGEM_PROVA.filter((c) => cru.includes(c));
    expect(
      inventados,
      `O JSON-LD declara campo que exige dado REAL por tras:\n  ${inventados.join('\n  ')}\n\n`
      + '  Avaliacao sem avaliacao, preco sem preco, endereco sem endereco e\n'
      + '  busca sem busca sao mentiras que o buscador repassa — e quando ele\n'
      + '  percebe, quem paga e o dominio.\n\n'
      + '  Se o dado passou a existir DE VERDADE, tire o campo desta lista e\n'
      + '  escreva ao lado onde ele aparece no site.',
    ).toEqual([]);
  });

  it('o que ele afirma bate com o que a página diz', () => {
    // Deriva silenciosa: alguém melhora a descrição da landing e o JSON-LD fica
    // com a antiga. Aí o site diz uma coisa para a pessoa e outra para a
    // máquina — e nenhum dos dois está errado o bastante para alguém notar.
    const d = JSON.parse(blocoJsonLd());
    expect(
      d.url,
      `A URL do JSON-LD (\`${d.url}\`) nao e o dominio do site.`,
    ).toBe(`${DOMINIO}/`);

    expect(
      d.description,
      'A descricao do JSON-LD divergiu da descricao da LANDING.\n'
      + `  JSON-LD: ${d.description}\n`
      + `  landing: ${META['/'].descricao}\n\n`
      + '  As duas descrevem a mesma pagina. Duas versoes sao duas fontes de\n'
      + '  verdade, e elas vao divergir de novo (§4).',
    ).toBe(META['/'].descricao);

    expect(d.inLanguage, 'O site e em portugues do Brasil.').toBe('pt-BR');
  });
});

describe('acessibilidade — o que foi medido em navegador', () => {
  it('a tela de entrada tem um `<h1>`', () => {
    // `[17/09]` Medido: `/login` tinha ZERO `<h1>`. A marca estava em dois
    // `<span>` dentro de um `<div>`. Quem usa leitor de tela navega por
    // cabecalho, e pagina sem o principal obriga a percorrer tudo para
    // descobrir onde caiu.
    //
    // A troca foi so semantica: o preflight do Tailwind zera margem e tamanho
    // de fonte dos titulos, e as classes ficaram nos mesmos <span>. Conferido
    // em navegador: a caixa da marca continua em `top 236 · 448x36`.
    // `semComentarios` NAO e zelo: a primeira versao desta trava casou o
    // `<h1>` de dentro do COMENTARIO logo acima do elemento — o que eu mesmo
    // escrevi explicando a mudanca. Reinjetei o bug (voltei a tag para `<div>`)
    // e o teste passou VERDE. Ela era decoracao.
    //
    // E a quinta vez que este projeto e mordido pela mesma coisa: trava que le
    // a PROSA em vez do CODIGO. Por isso o corte vem antes de qualquer regex.
    const fonte = semComentarios(readFileSync('src/pages/Login.jsx', 'utf8'));
    expect(
      /<h1[\s>]/.test(fonte),
      'A tela de entrada voltou a ficar sem `<h1>`.\n'
      + '  Ela e a porta de quem ainda nao entrou, e quem navega por cabecalho\n'
      + '  perde a referencia da pagina inteira.',
    ).toBe(true);
  });

  it('o botão de dispensar o aviso de som tem área de toque suficiente', () => {
    // Medido: o icone tem 13 px, e sem padding a area clicavel era 13x13 —
    // abaixo dos 24x24 que o alvo de toque pede. `p-1.5 -m-1.5` leva a ~25 px
    // SEM mover nada: a margem negativa devolve o espaco ao layout.
    const fonte = readFileSync('src/components/landing/BotaoDeSom.jsx', 'utf8');
    const botao = fonte.slice(fonte.indexOf('Dispensar aviso de som'));
    const className = botao.match(/className="([^"]+)"/)?.[1] ?? '';

    expect(
      /\bp-1\.5\b/.test(className) && /-m-1\.5/.test(className),
      'O botao de dispensar o aviso de som perdeu o par `p-1.5 -m-1.5`.\n'
      + `  className atual: "${className}"\n\n`
      + '  O icone tem 13 px. Sem o padding a area de toque volta a 13x13, num\n'
      + '  botao que se tenta acertar com o polegar. E sem a margem NEGATIVA o\n'
      + '  padding empurra o layout — o par inteiro importa.',
    ).toBe(true);
  });
});
