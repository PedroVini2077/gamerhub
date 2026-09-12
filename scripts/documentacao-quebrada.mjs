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

  // `[02/09]` A primeira entrada legítima, e ela é conferida: `ls` confirma que
  // o arquivo NÃO existe. Foi apagado no PR #105 ("desfaz a otimização de
  // resolução da cena 3D"), e o `OPERACAO.md` o cita justamente para contar que
  // a entrada dele no mapa de territórios sobreviveu ao arquivo — deixando o
  // `DESEMPENHO.md` meio vigiado sem nada acusar. Reescrever o trecho para tirar
  // o nome destruiria o exemplo: ele é sobre ESTE arquivo ter sumido.
  // `[12/09]` Conferido com `ls`: o arquivo NAO existe mais. Ele foi criado e
  // apagado no MESMO dia — nasceu no bloco A da continuidade como o mecanismo
  // de revelacao variada, e morreu no bloco B quando a costura passou a valer
  // em todas as emendas e ele virou uma SEGUNDA entrada empilhada.
  // O DECISOES.md o cita porque a decisao e sobre ELE ter sido apagado: tirar o
  // nome deixaria a entrada sem sujeito, e a proxima pessoa que pensar em
  // "cada cena com uma cortina propria" nao acharia o registro de que isso ja
  // foi tentado e por que saiu.
  ['CortinaDaCena.jsx',
    'criado e apagado em 12/09; citado em DECISOES.md como o mecanismo que a '
    + 'costura tornou redundante (tres entradas viraram uma)'],

  ['resolucaoDaCena.js',
    'apagado no PR #105; citado em OPERACAO.md como o caso que motivou o portao '
    + 'de cobertura de territorio (scripts/territorio-coberto.mjs)'],

  // `[11/09]` Conferido com `ls`: o arquivo NAO existe mais. Apagado junto com o
  // bloqueio de login por tentativas, que saiu da tela porque o hook que o
  // alimentaria e exclusivo dos planos pagos — `login_attempts` nunca recebia
  // uma linha. O DECISOES-FERRAMENTAL o cita porque ele foi o PRIMEIRO achado do
  // teste de mutacao: 0,00% de mutantes mortos dentro de uma suite verde.
  // Tirar o nome destruiria o exemplo, que e sobre ESTE modulo.
  ['loginBlock.js',
    'apagado em 11/09 com o bloqueio por tentativas; citado em '
    + 'DECISOES-FERRAMENTAL.md como o primeiro achado do teste de mutacao'],

  // `[11/09]` A CENA 3D da landing inteira. Conferido com `ls`: nenhum destes
  // existe mais. Foram removidos quando o dono lembrou que o briefing dele ja
  // dizia "prefiro isso a adicionar 3D apenas para deixar a pagina mais
  // impressionante" — e a cena ainda desenhava o RAIO, a marca aposentada.
  //
  // Os documentos continuam citando os nomes porque o que eles contam sobrevive
  // a cena: que o custo de WebGL e por PIXEL, que dois PageSpeed do mesmo site
  // discordaram em 31 s, e que o R3F zera o relogio ao trocar de `frameloop`.
  // Reescrever para tirar os nomes destruiria os exemplos.
  ['cena3D.js', 'cena 3D removida em 11/09; citada em DESEMPENHO/DECISOES/ARQUITETURA como o portao por aparelho'],
  ['LandingScene.jsx', 'cena 3D removida em 11/09; citada em DESEMPENHO.md na medicao de custo por pixel'],
  ['SceneObjects.jsx', 'cena 3D removida em 11/09; citada em DESEMPENHO e FUNCIONALIDADES'],
  ['Lightning.jsx', 'cena 3D removida em 11/09; citada em DESEMPENHO.md'],
  ['ritmoDoRaio.js', 'orfao apos a remocao da cena 3D em 11/09; citado em FUNCIONALIDADES.md'],
  ['ritmoDoRaio.test.js', 'removido com a cena 3D em 11/09; citado em FUNCIONALIDADES e SEGURANCA'],

  // `[11/09]` Conferido com `ls`: o arquivo NAO existe mais. Era o roteiro de
  // navegador que provava o laco da cena parar fora da tela; saiu junto com a
  // cena, e o job do CI que o rodava saiu junto com ele — portao que vigia algo
  // inexistente so pode ficar verde, que e a falha do §1.5 dentro da ferramenta.
  //
  // DESEMPENHO e DECISOES continuam citando o nome porque ele e a PROVA das
  // duas medicoes: 125 desenhos com a cena visivel contra 0 fora da tela, e o
  // ResizeObserver conferido nos dois sentidos. Tirar o nome apagaria a
  // evidencia e deixaria so a afirmacao.
  ['cena-3d.mjs',
    'removido em 11/09 com a cena 3D e o job do CI que o rodava; citado em '
    + 'DESEMPENHO/DECISOES/FUNCIONALIDADES como a prova das medicoes do laco'],

  // `[12/09]` Conferido com `ls`: o arquivo NAO existe mais. Era o molde unico
  // das cinco secoes da landing — sobrancelha, titulo, descricao, botao, print —
  // e foi apagado quando cada funcionalidade ganhou arte propria.
  //
  // O BRIEFING continua citando o nome porque a analise dele é sobre ESTE
  // arquivo: "a monotonia é de UM arquivo, e isso é boa noticia — o problema
  // esta em 67 linhas, nao espalhado pela pagina". Tirar o nome apagaria o
  // achado e deixaria so a conclusao.
  ['FeatureSection.jsx',
    'apagado em 12/09 quando as cinco secoes viraram cenas com arte propria; '
    + 'citado no BRIEFING-LANDING como o molde que causava a monotonia'],
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
