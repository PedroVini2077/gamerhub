#!/usr/bin/env node
/**
 * Portão de documentação: nenhum documento pode citar arquivo que não existe.
 *
 * ── Por que este portão existe ──────────────────────────────────────────────
 *
 * Pedido do dono em 28/08, depois de encontrar três documentos desatualizados
 * numa sessão só: *"TODOS OS DOCUMENTOS DEVEM ESTAR ATUALIZADOS... nem que vc
 * precise de um gatilho pra lembrar e ver o que está desatualizado"*.
 *
 * Já existia um portão no CI que reprova PR que mexe em `src/` sem tocar
 * documentação. Ele garante que ALGUM documento foi tocado — não que o
 * documento **certo** continua verdadeiro. Este fecha uma fatia diferente e
 * provável: a documentação que cita arquivo renomeado ou apagado.
 *
 * ── Por que só caminho de arquivo, e não "o texto está velho" ───────────────
 *
 * Porque este precisa ser **determinístico**. O arquivo existe ou não existe;
 * não há julgamento no meio. Um portão que tentasse adivinhar se um parágrafo
 * envelheceu erraria o tempo todo, e alarme que grita à toa é pior que alarme
 * nenhum — ensina a ignorar o canal onde a falha real vai aparecer
 * (`CLAUDE.md` §0.2, 4ª regra).
 *
 * A parte subjetiva — "este texto ainda descreve o sistema?" — tem outro
 * mecanismo, que **não bloqueia**: `.github/workflows/lembrete-de-documentacao.yml`
 * abre uma issue mensal listando os documentos cujo código andou sem eles.
 *
 * ── O que ele NÃO cobre, dito abertamente ───────────────────────────────────
 *
 * Documento que cita arquivo existente e diz dele algo falso passa por aqui.
 * Foi o caso do `effectiveType` em `DECISOES.md`: o arquivo `lib/cena3D.js`
 * continuava lá, só não tinha mais aquele portão dentro. Nenhum portão
 * automático pega isso — é o que a regra de reler antes de escrever cobre.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Onde procurar documentação. */
const DOCUMENTOS = ['README.md', 'BACKLOG.md', 'CLAUDE.md'];
const PASTAS_DE_DOC = ['docs', 'db', 'supabase'];

/**
 * Nomes citados de propósito que não existem (mais) no repositório.
 *
 * Cada linha precisa de motivo. Sem o motivo, esta lista vira o lugar onde se
 * esconde documentação quebrada — exatamente o que o portão quer impedir.
 */
const CITACOES_HISTORICAS = new Map([
  // Vazia de propósito, e a história de por quê importa: nasceu com duas
  // entradas que eu escrevi por precaução, SEM CONFERIR. As duas eram falsas —
  // `DATABASE_SCHEMA_BACKUP.sql` (132 KB) e `.github/dependabot.yml` estão no
  // repositório. Ou seja: a primeira versão desta lista já estava dispensando
  // do portão dois arquivos que ele conferiria sem problema.
  //
  // É a lição do §1.4 dentro do próprio script que existe para aplicá-la:
  // exceção escrita "por garantia" é o lugar onde a verificação morre. Antes de
  // acrescentar QUALQUER linha aqui, rode `ls` no arquivo. Se ele existe, o
  // portão dá conta — a exceção não é necessária.
]);

/** Extensões que valem a pena conferir. Documento cita muito nome solto. */
const EXTENSOES = /\.(js|jsx|ts|tsx|mjs|sql|ya?ml)$/;

function arquivosDe(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.git' || nome === 'dist') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDe(caminho, acc);
    else acc.push(relative(RAIZ, caminho));
  }
  return acc;
}

const TODOS = arquivosDe(RAIZ);
const PORNOME = new Set(TODOS.map(f => basename(f)));

/** Um documento pode citar `lib/cena3D.js` sem o `src/` na frente. */
function existe(citado) {
  if (existsSync(join(RAIZ, citado))) return true;
  if (TODOS.some(f => f === citado || f.endsWith('/' + citado))) return true;
  return PORNOME.has(basename(citado));
}

function docsParaConferir() {
  const lista = DOCUMENTOS.filter(d => existsSync(join(RAIZ, d)));
  for (const pasta of PASTAS_DE_DOC) {
    const dir = join(RAIZ, pasta);
    if (!existsSync(dir)) continue;
    lista.push(...arquivosDe(dir).filter(f => f.endsWith('.md')));
  }
  return lista;
}

const quebrados = [];

for (const doc of docsParaConferir()) {
  const texto = readFileSync(join(RAIZ, doc), 'utf8');
  const vistos = new Set();

  // `@caminho.md` no início da linha é IMPORT do Claude Code, não citação — o
  // arquivo é carregado como se estivesse escrito dentro do CLAUDE.md. Um
  // caminho quebrado aqui é a pior falha silenciosa possível neste
  // repositório: as regras simplesmente param de ser carregadas, em toda
  // sessão futura, sem nada avisar. Por isso entram no mesmo portão.
  //
  // (Entre crases o Claude Code NÃO importa, então citar `@algo.md` num texto
  // continua sendo só citação e cai no laço de baixo.)
  for (const m of texto.matchAll(/^@([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)\s*$/gm)) {
    const importado = m[1];
    if (existe(importado)) continue;
    const linha = texto.slice(0, m.index).split('\n').length;
    quebrados.push({ doc, citado: `${importado}  (IMPORT — as regras não carregam)`, linha });
  }

  for (const m of texto.matchAll(/`([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)`/g)) {
    const citado = m[1];
    // Caminho absoluto num documento é exemplo de comando de terminal
    // (`psql ... > /tmp/schema.sql`), nunca referência a arquivo do repositório.
    if (citado.startsWith('/')) continue;
    if (!EXTENSOES.test(citado)) continue;
    if (vistos.has(citado)) continue;
    vistos.add(citado);
    if (CITACOES_HISTORICAS.has(basename(citado))) continue;
    if (existe(citado)) continue;

    const linha = texto.slice(0, m.index).split('\n').length;
    quebrados.push({ doc, citado, linha });
  }
}

if (quebrados.length === 0) {
  console.log('OK: nenhum documento cita arquivo inexistente.');
  process.exit(0);
}

console.error('\nDOCUMENTAÇÃO CITANDO ARQUIVO QUE NÃO EXISTE\n');
for (const { doc, citado, linha } of quebrados) {
  console.error(`  ${doc}:${linha}  →  ${citado}`);
}
console.error(`
${quebrados.length} referência(s) quebrada(s).

O arquivo foi renomeado, movido ou apagado e a documentação não acompanhou.
Três saídas, nesta ordem de preferência:

  1. Corrigir o caminho no documento — é quase sempre o caso.
  2. Se o arquivo deixou de existir de propósito, reescrever o trecho: ele
     está descrevendo um sistema que não existe mais.
  3. Se a citação é histórica de propósito (um "antes existia X"), acrescentar
     o nome em CITACOES_HISTORICAS, em scripts/documentacao-quebrada.mjs,
     COM O MOTIVO.
`);
process.exit(1);
