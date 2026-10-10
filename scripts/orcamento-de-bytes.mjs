#!/usr/bin/env node
/**
 * Orçamento de bytes do carregamento inicial.
 *
 * ── Por que este portão existe ──────────────────────────────────────────────
 *
 * Até 28/08/2026 o CI barrava build quebrado, lint, teste, rota fora do ar e PR
 * sem documentação. **Não barrava regressão de desempenho.** Dava para mergear
 * algo que dobrasse o JavaScript inicial e ninguém ficaria sabendo até alguém
 * abrir o PageSpeed por conta própria — falha silenciosa (CLAUDE.md §1.5)
 * aplicada à experiência de quem usa o site.
 *
 * E não é risco teórico: a regressão que a gente acabou de consertar era
 * exatamente isto. O `@sentry/react` foi parar dentro do `vendor-react` por
 * causa de uma regra de chunking ampla demais, e ficou lá por meses sem nada
 * acusar.
 *
 * ── Por que BYTES e não tempo ───────────────────────────────────────────────
 *
 * Tempo de laboratório oscila com a máquina do runner: as duas medições de
 * 27/08 discordaram 4× no TBT medindo o MESMO site. Orçamento em cima de número
 * que balança vira alarme falso, e alarme que grita à toa ensina a ignorar o
 * canal onde a falha real vai aparecer (CLAUDE.md §0.2, quarta regra).
 *
 * Byte é determinístico: o mesmo commit dá o mesmo número em qualquer máquina.
 * Este portão não mede se o site está rápido — mede se ele ficou mais pesado, e
 * é isso que dá para afirmar sem margem de erro.
 *
 * ── O que conta como "inicial" ──────────────────────────────────────────────
 *
 * O próprio `dist/index.html` responde: o `<script type="module">` da entrada e
 * cada `<link rel="modulepreload">`. São os arquivos que o navegador busca
 * antes de pintar qualquer coisa. Ler dali em vez de manter uma lista à mão
 * significa que chunk novo entra na conta sozinho.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';

// ── Os tetos moram em `orcamento/tetos.mjs`, com a história de cada um ─────
//
// `[10/10]` Separados daqui no corte de 324 linhas: eles são DECISÃO (cada
// número tem data e motivo), e isto é MEDIÇÃO. Ao subir um teto, a
// justificativa vai lá — é o que o §0.3 cobra.
import {
  TETO_BRUTO_KB,
  TETO_GZIP_KB,
  TETO_POR_CHUNK_KB,
  TETO_CSS_GZIP_KB,
  PRECISA_TER_CHUNK_PROPRIO,
} from './orcamento/tetos.mjs';

function kb(n) { return (n / 1024).toFixed(1); }

function chunksIniciais(html) {
  const caminhos = [
    ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
    ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
  ].map(m => m[1].replace(/^\//, ''));
  return [...new Set(caminhos)];
}

const indexHtml = join(DIST, 'index.html');
if (!existsSync(indexHtml)) {
  console.error(`ERRO: ${indexHtml} não existe. Rode \`npm run build\` antes deste script.`);
  process.exit(2);
}

const arquivos = chunksIniciais(readFileSync(indexHtml, 'utf8'));
if (arquivos.length === 0) {
  // Rollup mudou o formato do HTML e a regex parou de casar. Passar batido aqui
  // seria pior que falhar: o portão diria "tudo certo" medindo zero byte.
  console.error('ERRO: nenhum chunk inicial encontrado no dist/index.html.');
  console.error('O formato do HTML gerado mudou e as expressões deste script pararam de casar.');
  process.exit(2);
}

let bruto = 0;
let comprimido = 0;
const linhas = [];

for (const caminho of arquivos) {
  const conteudo = readFileSync(join(DIST, caminho));
  const g = gzipSync(conteudo).length;
  bruto += conteudo.length;
  comprimido += g;
  linhas.push(`  ${caminho.padEnd(46)} ${kb(conteudo.length).padStart(8)} kB  ${kb(g).padStart(8)} kB gzip`);
}

console.log('Chunks carregados antes da primeira pintura:');
console.log(linhas.sort().join('\n'));
console.log(`  ${'TOTAL'.padEnd(46)} ${kb(bruto).padStart(8)} kB  ${kb(comprimido).padStart(8)} kB gzip`);
console.log(`  ${'teto'.padEnd(46)} ${String(TETO_BRUTO_KB).padStart(8)} kB  ${String(TETO_GZIP_KB).padStart(8)} kB gzip\n`);

const falhas = [];

if (bruto / 1024 > TETO_BRUTO_KB) {
  falhas.push(
    `JavaScript inicial em ${kb(bruto)} kB, acima do teto de ${TETO_BRUTO_KB} kB.\n`
    + '    Alguma biblioteca voltou para o caminho crítico. Suspeitos, em ordem:\n'
    + '      1. `import` estático de algo que devia ser `import()` sob demanda;\n'
    + '      2. regra do `manualChunks` no vite.config.js casando pacote demais\n'
    + '         (foi assim que o @sentry/react entrou no vendor-react);\n'
    + '      3. dependência nova que entrou junto de outra.\n'
    + '    Se o crescimento for intencional, suba o teto NESTE arquivo e explique no commit.');
}

if (comprimido / 1024 > TETO_GZIP_KB) {
  falhas.push(`JavaScript inicial comprimido em ${kb(comprimido)} kB, acima do teto de ${TETO_GZIP_KB} kB.`);
}


function cssInicial(html) {
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)]
    .map(m => m[1].replace(/^\//, ''));
}

const folhas = cssInicial(readFileSync(indexHtml, 'utf8'));
if (folhas.length === 0) {
  // Mesma regra dos chunks: medir zero byte e aprovar é pior do que falhar.
  console.error('ERRO: nenhuma folha de estilo encontrada no dist/index.html.');
  console.error('Ou o build parou de gerar CSS, ou a regex deste script parou de casar.');
  process.exit(2);
}

let cssBruto = 0;
let cssGzip = 0;
for (const caminho of folhas) {
  const conteudo = readFileSync(join(DIST, caminho));
  cssBruto += conteudo.length;
  cssGzip += gzipSync(conteudo).length;
}

console.log('CSS, que bloqueia a pintura:');
console.log(`  ${'TOTAL'.padEnd(46)} ${kb(cssBruto).padStart(8)} kB  ${kb(cssGzip).padStart(8)} kB gzip`);
console.log(`  ${'teto'.padEnd(46)} ${''.padStart(8)}     ${String(TETO_CSS_GZIP_KB).padStart(8)} kB gzip\n`);

if (cssGzip / 1024 > TETO_CSS_GZIP_KB) {
  falhas.push(
    `CSS comprimido em ${kb(cssGzip)} kB, acima do teto de ${TETO_CSS_GZIP_KB} kB.\n`
    + '    CSS bloqueia a renderização: nada aparece na tela antes de ele chegar.\n'
    + '    Suspeitos: classe utilitária nova que puxou um bloco inteiro do tema,\n'
    + '    arquivo em `src/estilos/` que cresceu, ou atualização do Tailwind —\n'
    + '    foi a do 4 que custou +3,4 kB gzip de uma vez (ver DESEMPENHO.md).');
}

// ── Teto por arquivo, incluindo os chunks de rota ───────────────────────────
const todosOsChunks = readdirSync(join(DIST, 'assets')).filter(n => n.endsWith('.js'));

for (const nome of todosOsChunks) {
  const tamanho = statSync(join(DIST, 'assets', nome)).size;
  if (tamanho / 1024 > TETO_POR_CHUNK_KB) {
    falhas.push(
      `o chunk \`${nome}\` tem ${kb(tamanho)} kB, acima do teto de ${TETO_POR_CHUNK_KB} kB por arquivo.\n`
      + '    Chunk de rota não aparece no index.html, então ele escapa do teto do\n'
      + '    carregamento inicial — mas quem abre aquela página paga tudo.\n'
      + '    Causa mais provável: uma biblioteca pesada importada estaticamente\n'
      + '    dentro da página em vez de `lazy()`/`import()`.');
  }
}

// ── As fronteiras de lazy que precisam sobreviver ───────────────────────────
for (const esperado of PRECISA_TER_CHUNK_PROPRIO) {
  if (!todosOsChunks.some(n => n.includes(esperado))) {
    falhas.push(
      `não existe nenhum chunk \`${esperado}-*.js\` em dist/assets.\n`
      + '    Isso significa que o código dele foi absorvido por outro arquivo, ou seja,\n'
      + '    o `lazy(() => import(...))` virou `import` estático em algum lugar.\n'
      + '    Procure por `import X from` onde deveria haver `lazy(() => import(X))`\n'
      + '    — o suspeito de sempre é `src/paginasLazy.js`.\n'
      + '    Custo: os painéis da equipe passam a viajar no pacote que TODO\n'
      + '    visitante anônimo baixa. Já aconteceu com a cena 3D, e o chunk da\n'
      + '    Landing foi de 17,9 kB para 907 kB sem nada quebrar.');
  }
}

if (falhas.length > 0) {
  console.error('ORÇAMENTO DE BYTES ESTOUROU\n');
  for (const f of falhas) console.error(`  - ${f}\n`);
  process.exit(1);
}

console.log('OK: o carregamento inicial cabe no orçamento.');
