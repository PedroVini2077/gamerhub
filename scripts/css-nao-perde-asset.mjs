#!/usr/bin/env node
/**
 * PORTÃO: todo `url()` do CSS construído aponta para um arquivo que EXISTE.
 *
 * ── Por que ele nasceu, com o caso ──────────────────────────────────────────
 *
 * Na migração para o Tailwind 4 (09/10), o plugin de PostCSS passou a achatar
 * os `@import` do CSS **antes** de o Vite reescrever os `url()` relativos. A
 * `background-image` da moldura da tela de entrada virou isto:
 *
 *     v3   url("/assets/moldura-verde-C42BpkIK.webp")    image/webp
 *     v4   url("/assets/auth/moldura-verde.webp")        text/html   <- sumiu
 *
 * A arte simplesmente deixou de existir na tela de login.
 *
 * ── Por que NADA pegou ──────────────────────────────────────────────────────
 *
 * Três coisas conspiraram, e cada uma sozinha já seria suficiente:
 *
 * 1. **O caminho responde HTTP 200.** O rewrite de SPA devolve o `index.html`
 *    para qualquer coisa que não exista — a mesma armadilha que o
 *    `portas-da-web.mjs` documenta para o `/.env`. Conferir o status não
 *    adianta; é preciso olhar o `content-type`.
 * 2. **`artes-da-arena.mjs` passou 6/6.** Ele olha os `<img>` dos lutadores, e
 *    a moldura é `background-image`.
 * 3. **O build não reclama.** CSS com `url()` quebrado compila limpo.
 *
 * Quem pegou foi comparar PRINT da v3 com PRINT da v4, a olho. Isso não
 * escala e não roda sozinho — daí este portão.
 *
 * ── O que ele cobre, e é a CLASSE ──────────────────────────────────────────
 *
 * Não é "a moldura existe". É: **nenhum asset referenciado pelo CSS pode
 * sumir do pacote**, qualquer que seja a causa — bundler, renomeação de pasta,
 * arquivo apagado. É o tipo de falha que não estoura, não loga e não quebra
 * teste: a imagem só não aparece.
 *
 * Uso:  node scripts/css-nao-perde-asset.mjs   (depois de `npm run build`)
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`ERRO: ${DIST}/index.html não existe. Rode \`npm run build\` antes.`);
  process.exit(2);
}

const folhas = readdirSync(join(DIST, 'assets')).filter((n) => n.endsWith('.css'));
if (folhas.length === 0) {
  // Zero folha e aprovar é a vacuidade de sempre: o portão diria "OK" sem
  // ter olhado um único `url()`.
  console.error('ERRO: nenhuma folha de estilo em dist/assets.');
  console.error('Ou o build parou de gerar CSS, ou a pasta mudou de lugar.');
  process.exit(2);
}

/** Todo `url(...)` que aponta para arquivo nosso — fora `data:` e externo. */
function urlsDeArquivo(css) {
  return [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)]
    .map((m) => m[1].trim())
    .filter((u) => !u.startsWith('data:') && !/^https?:/.test(u) && !u.startsWith('#'));
}

const falhas = [];
let conferidos = 0;

for (const folha of folhas) {
  const css = readFileSync(join(DIST, 'assets', folha), 'utf8');
  const urls = urlsDeArquivo(css);

  if (urls.length === 0) {
    falhas.push(
      `\`${folha}\` não tem NENHUM \`url()\` de arquivo.\n`
      + '    Este site tem fontes próprias e artes em `background-image`: zero\n'
      + '    url é sinal de que a extração parou de casar, não de que o CSS\n'
      + '    ficou limpo. Portão que mede zero e aprova é o pior dos dois.');
    continue;
  }

  for (const u of urls) {
    conferidos += 1;
    const caminho = join(DIST, u.replace(/^\//, '').split('?')[0]);
    if (!existsSync(caminho) || !statSync(caminho).isFile()) {
      falhas.push(
        `\`${folha}\` referencia \`${u}\`, que NÃO EXISTE no pacote.\n`
        + '    Em produção isso NÃO dá 404 visível: o rewrite de SPA devolve o\n'
        + '    `index.html` com HTTP 200, e o navegador descarta em silêncio.\n'
        + '    A imagem (ou a fonte) simplesmente não aparece.\n'
        + '    Causa provável: o `url()` relativo deixou de ser reescrito pelo\n'
        + '    bundler. Foi o que aconteceu ao pôr o Tailwind como plugin de\n'
        + '    PostCSS em vez de plugin do Vite — ver `vite.config.js`.');
    }
  }
}

if (falhas.length > 0) {
  console.error('CSS PERDEU ASSET\n');
  for (const f of falhas) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log(`OK: ${conferidos} \`url()\` do CSS apontam para arquivo existente.`);
