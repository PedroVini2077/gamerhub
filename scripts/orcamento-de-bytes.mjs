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

// ── Os limites ──────────────────────────────────────────────────────────────
//
// Medido em 28/08, depois da rodada de otimização: **691,7 kB brutos / 206,6 kB
// comprimidos**. A folga de ~7% é para variação de versão de dependência não
// reprovar PR que não tem nada a ver — o alvo aqui é a regressão grande (uma
// biblioteca inteira voltando para o caminho crítico), não o quilobyte.
//
// Estes números corrigem uma conta que eu vinha repetendo. Nos relatórios da
// rodada eu citei "458,3 kB de JS inicial", que era a soma de `index` +
// `vendor-react` — os dois que eu tinha olhado. O conjunto ansioso de verdade
// inclui também `vendor-supabase` (203,8 kB) e `vendor-ui`. Ler do
// `dist/index.html`, como este script faz, é o que impede esse tipo de erro:
// a lista vem do build, não da minha memória (CLAUDE.md §1.4).
//
// **Ao subir um destes números, escreva no commit por que o site precisou
// engordar.** O limite existe para forçar essa frase, não para ser inatingível.
//
// ── `[11/09]` Os tetos foram RECALIBRADOS, e o site não engordou ────────────
//
// Esta é a exceção que a frase acima não previa, e ela precisa estar escrita
// aqui: **o número que mudou foi o da MEDIÇÃO, não o do site.**
//
// O job do CI rodava `npm run build` **sem** `VITE_SUPABASE_URL` e
// `VITE_SUPABASE_ANON_KEY`. Sem elas, a guarda de configuração no topo de
// `lib/supabase.js` vira condição constante, e o empacotador poda como código
// morto 94 kB do chunk que a produção realmente entrega. Medido em A/B na
// mesma máquina, tirando e pondo o `.env.local`:
//
//     sem as variáveis (o que o CI media)      640,8 kB  ->  195,5 kB gzip
//     com as variáveis (o que a Vercel serve)  735,1 kB  ->  222,5 kB gzip
//
// O teto de 222 estava sendo conferido contra um build de 195,5. Havia 26,5 kB
// de folga que **não era folga** — e a produção já servia 222,5, acima do teto,
// com o portão verde. Portão que dá certificado sobre um site que ninguém
// recebe é a falha do §1.5 dentro da ferramenta que deveria pegá-la.
//
// Os tetos abaixo são o tamanho REAL de hoje mais uma folga pequena. Não houve
// ganho nem perda de peso: houve o fim de uma mentira de medição. O histórico
// e a evidência estão em `docs/OPERACAO.md`.
// ── `[02/10]` O GZIP sobe de 228 para 229, e a frase que o teto exige ──────
//
// **Por que o site precisou engordar:** para o cliente do Supabase sair de
// 2.112 para 2.117. Ele custa **+1,0 kB gzip** e é a biblioteca que cuida de
// sessão, login e de toda chamada protegida por RLS — a que eu menos quero
// cinco minors atrasada.
//
// ── O que foi RECUSADO junto, e é a parte que justifica o número ser 1 ─────
//
// O PR do Dependabot trazia 14 pacotes. Cada um foi medido sozinho, em gzip,
// a partir da base de 227,8:
//
//     9 devDependencies (vite 8.0->8.3, eslint, playwright, jsdom, @types)
//                                             -0,2   <- DEVOLVEM byte
//     @sentry/react     10.72 -> 10.75.3       0,0
//     @supabase/supabase-js 2.112 -> 2.117    +1,0   <- entrou
//     lucide-react      1.37 -> 1.48          +2,4   <- RECUSADO
//     react/react-dom   19.2.8 -> 19.3.0      +8,4   <- RECUSADO
//
// O React saiu porque o 19.3 embute dois subsistemas novos inteiros —
// `<ViewTransition />` e Fragment Refs — que entram no pacote usemos ou não.
// Grep no `src/`: zero uso dos dois. Das dezenas de correções dele, UMA nos
// alcança (`useDeferredValue` travando), num painel que só a equipe abre, sem
// sintoma relatado. `npm audit` em 0: não havia pressão de segurança. 8,4 kB é
// 3,7% do orçamento inteiro, cobrados de quem chega pela primeira vez.
//
// O Lucide saiu por relação custo/benefício: 2,4 kB por ícones que já temos.
//
// ── E o que este episódio revelou sobre o PRÓPRIO teto ─────────────────────
//
// A folga era de **0,2 kB**. Qualquer dependência de runtime estourava — até
// um patch do cliente Supabase. Isso não é defeito do portão: é ele fazendo o
// que o comentário no topo promete, *forçar a frase*. Mas significa que todo
// PR do Dependabot vai reprovar aqui, todo mês, e isso tem de ser decisão
// consciente em vez de surpresa.
//
// **Onde está o byte, se um dia precisarmos de folga de verdade:**
// `vendor-supabase` são 53,3 kB gzip — 23% do orçamento — e estão no primeiro
// carregamento porque `hooks/useAuth.jsx` importa o cliente direto: o site
// precisa saber na primeira pintura se você está logado. Mexer nisso é mexer
// num arquivo de alto risco (`CLAUDE.md` §7), então fica registrado como
// onde a sala existe, não como plano.
// ── `[08/10]` O GZIP sobe de 229 para 230, e a frase que o teto exige ──────
//
// **Por que o site precisou engordar:** o PWA. Para o navegador poder oferecer
// a instalação, duas coisas têm de existir no pacote inicial — o registro do
// service worker e a CAPTURA do `beforeinstallprompt`, que dispara uma vez e
// antes do React montar. Adiar qualquer uma delas é não ter a funcionalidade.
//
// E este teto fez o trabalho dele: o portão reprovou, e a reprovação achou
// **enfeite no caminho crítico**. A faixa de convite inteira (`FaixaDeInstalacao`)
// estava sendo baixada por todo mundo, inclusive por quem já instalou e por
// quem está no iPhone, onde ela nem aparece. Ela foi para trás de um `lazy()`
// atrás da CONDIÇÃO — e aí o chunk não é pedido na maioria das visitas, que é a
// diferença entre este caso e a 1ª armadilha do §0.3.
//
//     antes do PWA                              228,9 kB gzip
//     Fases 1+2 (service worker + offline)       229,0   +0,1
//     Fase 4 com a faixa no caminho crítico      229,9   +0,9  <- estourou
//     Fase 4 com a faixa adiada por condição     229,5   +0,5  <- 44% devolvido
//
// A folga volta a ser ~0,5 kB, e a nota de 02/10 continua valendo na íntegra:
// **todo PR do Dependabot vai reprovar aqui**, e onde existe sala de verdade
// é no `vendor-supabase`, não neste número.
const TETO_BRUTO_KB = 760;
const TETO_GZIP_KB = 230;

// Teto por arquivo, para QUALQUER chunk — inclusive os de rota, que não estão
// no conjunto ansioso.
//
// Isto existe porque o teto do conjunto ansioso sozinho não bastava, e eu só
// descobri tentando furá-lo: troquei o `lazy()` da cena 3D por um `import`
// estático e o orçamento passou intacto. Motivo — a `Landing` é uma rota lazy,
// então os 887 kB foram parar no chunk DELA, que o navegador busca ao abrir o
// site mas que não aparece no `index.html`. O visitante pagava tudo; o portão
// não via nada. Medido: o chunk da Landing foi de 17,9 kB para **907 kB**.
const TETO_POR_CHUNK_KB = 320;

// `[11/09]` A cena 3D era a única exceção ao teto acima — 887 kB sob demanda,
// atrás dos portões de aparelho. **Ela não existe mais**: o hero passou a ser
// `ConvergenciaDoHub`, SVG estático, e nada mais importa `three`. Com a exceção
// removida, o teto por arquivo passa a valer para TODO chunk sem furo.
//
// Medido depois da remoção: o maior chunk é o `index` com 247,6 kB — 72 kB de
// folga até o teto, e nenhum candidato perto dele.

// As fronteiras de `lazy()` que precisam CONTINUAR existindo como arquivo
// separado. Se um `lazy()` virar `import` estático, o chunk simplesmente some —
// nada quebra, o site funciona, e só o carregamento fica mais caro. Falha
// silenciosa clássica (§1.5), e foi assim que a cena 3D furou o orçamento.
//
// `[11/09]` A lista deixou de apontar para `LandingScene`, que foi apagado.
// **Lista vazia não era opção**: um portão que não vigia nada passa para sempre
// e parece vigiar — o mesmo vício de vacuidade que o `varrerFontes.js` fecha nas
// travas. Ela aponta agora para os dois painéis, que são a maior superfície lazy
// que sobrou (`Admin` 113 kB, `Owner` 47 kB) e cujo vazamento para o pacote
// inicial faria todo VISITANTE ANÔNIMO baixar o código da equipe.
const PRECISA_TER_CHUNK_PROPRIO = ['Admin', 'Owner'];

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

// ── `[09/10]` O CSS, que este portão NUNCA tinha medido ─────────────────────
//
// Ele lia o `<script type="module">` e os `<link rel="modulepreload">`. A
// folha de estilo entra por `<link rel="stylesheet">` e ficava de fora — ou
// seja, **o portão de regressão de desempenho não via o arquivo que bloqueia a
// pintura**. Nada é desenhado antes de o CSS chegar.
//
// Descoberto na migração para o Tailwind 4, que levou o CSS de 15,7 para 19,0
// kB gzip e passaria verde. É o §1.5 dentro do mecanismo que existe para pegar
// exatamente isso, e com o agravante de o verde parecer que alguém olhou.
//
// O teto é o tamanho de hoje mais folga pequena, como o de JS. **Ao subi-lo,
// escreva no commit por que o site precisou engordar.**
const TETO_CSS_GZIP_KB = 20;

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
