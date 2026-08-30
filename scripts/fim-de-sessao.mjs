/**
 * "Posso fechar a sessão?" — em um comando.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * Ordem do dono em 29/08, depois de eu falhar duas vezes na MESMA sessão com as
 * regras escritas e certas: *"nada mais pode falhar... eu como não consigo ver
 * se vc está seguindo tudo, só deixo passar, mas a partir de hoje não vou
 * aceitar mais"*.
 *
 * **A parte que decide o formato disto:** as regras que falharam existiam. Eu
 * as tinha lido no começo da sessão e mesmo assim escrevi medição no documento
 * errado seis horas depois. A tabela do §2 já diz por quê — "comentário
 * explicando o porquê" é a MAIS FRACA das cinco travas. Responder a uma falha
 * de cumprimento escrevendo mais uma regra seria repetir o que não funcionou.
 *
 * Então isto não é uma regra: é a §2 (definição de pronto) e a §6.1 (faxina)
 * transformadas em coisa que RODA e REPROVA.
 *
 * ── O que ele confere que nenhum outro portão via ───────────────────────────
 *
 * O CI só enxerga o que já foi empurrado. Ele nunca soube dizer se sobrou
 * trabalho não commitado, commit não empurrado, ou um arquivo que passou de
 * 300 linhas. Essas três só existiam na minha memória — e memória foi
 * exatamente o que falhou.
 *
 * Uso:  node scripts/fim-de-sessao.mjs
 */
import { execSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const falhas = [];
const avisos = [];

/** Roda um comando e diz só se passou — a saída inteira só aparece na falha. */
function passa(rotulo, comando) {
  try {
    execSync(comando, { stdio: 'pipe' });
    console.log(`  OK      ${rotulo}`);
    return true;
  } catch (e) {
    console.log(`  FALHOU  ${rotulo}`);
    falhas.push(`${rotulo}\n${(e.stdout ?? e.stderr ?? '').toString().slice(-700)}`);
    return false;
  }
}

const git = c => execSync(c, { encoding: 'utf8' }).trim();

console.log('\n  Fechamento de sessão — §2 (definição de pronto) e §6.1 (faxina)\n');

// ── 1. O que o CI também conferiria ────────────────────────────────────────
passa('build',                'npm run build');
passa('lint (0 erros)',       'npm run lint');
passa('testes',               'npx vitest run');
passa('mapa de arquivos',     'node scripts/mapa-de-arquivos.mjs');
passa('documentação quebrada','node scripts/documentacao-quebrada.mjs');
passa('orçamento de bytes',   'node scripts/orcamento-de-bytes.mjs');

// ── 2. O que SÓ este script vê ─────────────────────────────────────────────

// Arquivo grande: §4 manda dividir ANTES de entregar, não anotar pra depois.
const varrer = d => readdirSync(d).flatMap(n => {
  const c = join(d, n);
  return statSync(c).isDirectory() ? varrer(c) : [c];
});
const grandes = varrer('src')
  .filter(f => /\.(js|jsx)$/.test(f) && !f.includes('__tests__'))
  .map(f => [f, readFileSync(f, 'utf8').split('\n').length])
  .filter(([, n]) => n > 300)
  .sort((a, b) => b[1] - a[1]);

if (grandes.length) {
  console.log(`  FALHOU  nenhum arquivo acima de 300 linhas`);
  falhas.push('arquivos acima de 300 linhas (§4 manda dividir ANTES de entregar):\n'
    + grandes.map(([f, n]) => `    ${n} linhas  ${f}`).join('\n'));
} else {
  console.log('  OK      nenhum arquivo acima de 300 linhas');
}

// Contador do backlog batendo com a contagem real: já divergiu, e um contador
// que mente é pior do que contador nenhum.
const backlog = readFileSync('BACKLOG.md', 'utf8');
const declarado = Number(backlog.match(/\*\*(\d+) itens abertos\*\*/)?.[1]);
const real = (backlog.match(/^- ⬜/gm) ?? []).length;
if (declarado !== real) {
  console.log('  FALHOU  contador do BACKLOG.md');
  falhas.push(`o BACKLOG.md diz ${declarado} itens abertos e tem ${real}. `
    + 'Contador que mente faz o dono decidir prioridade com número errado.');
} else {
  console.log(`  OK      contador do BACKLOG.md (${real} itens)`);
}

// Trabalho solto: o CI nunca vê isto, porque não foi empurrado.
const sujo = git('git status --porcelain');
if (sujo) {
  console.log('  FALHOU  nada por commitar');
  falhas.push('há trabalho NÃO COMMITADO:\n' + sujo.split('\n').map(l => '    ' + l).join('\n')
    + '\n  A sessão morre e isto some junto. Commite ou descarte, conscientemente.');
} else {
  console.log('  OK      nada por commitar');
}

const branch = git('git rev-parse --abbrev-ref HEAD');
let naoEmpurrado = '';
try { naoEmpurrado = git(`git log origin/${branch}..HEAD --oneline`); } catch { /* branch nova */ }
if (naoEmpurrado) {
  console.log('  FALHOU  nada por empurrar');
  falhas.push('há commit NÃO EMPURRADO:\n'
    + naoEmpurrado.split('\n').map(l => '    ' + l).join('\n'));
} else {
  console.log('  OK      nada por empurrar');
}

// Aviso, não falha: divergir da main é normal com PR aberto. Vira falha só se
// o dono confirmar que o ciclo do §8 estava fechado.
try {
  const atras = git('git rev-list --count HEAD..origin/main');
  if (Number(atras) > 0) avisos.push(`a branch está ${atras} commit(s) atrás da main — `
    + 'se o PR já foi mergeado, falta o passo 4/5 do §8 (sincronizar e realinhar).');
} catch { /* sem origin/main local */ }

// ── O que NENHUM script consegue conferir ──────────────────────────────────
//
// Pergunta do dono em 30/08: *"esse script te faz lembrar dessas regras ou
// testes? ... te faz lembrar de TUDO oq vc precisa fazer na sessão?"*
//
// A resposta honesta é NÃO, e por um motivo que não tem conserto em código: dos
// 13 itens da definição de pronto (§2), seis são MECÂNICOS e as verificações
// acima os cobrem. Os outros sete são de JULGAMENTO — não existe comando que
// responda "eu pensei como um atacante pensaria?".
//
// Fingir que verifica seria pior do que não verificar. Um portão que dá verde
// sobre julgamento ensina a confiar num sinal que não sustenta nada — é a
// mesma falha das cotas que estouram em silêncio (§0.2), só que do lado da
// falsa confiança.
//
// Então isto NÃO é uma checagem: é a lista sendo posta na frente de quem vai
// fechar, no último momento em que ainda dá para voltar. A resposta é dita ao
// dono, no relatório de entrega, e é lá que ela pode ser cobrada.
const JULGAMENTO = [
  ['§1.3', 'Pensei em como ABUSAR disto — dado forjado, RLS que não cobre um '
         + 'caminho, RPC chamável por quem não devia, corrida, permissão? '
         + 'Fechei o que achei?'],
  ['§1.5', 'Teste dos três canais: se isto quebrar de madrugada, (a) o que a '
         + 'pessoa vê, (b) o que fica gravado, (c) qual teste falha? Se as três '
         + 'forem "nada", não está pronto.'],
  ['§2',   'Todo bug que corrigi virou TRAVA, e eu provei a trava reinjetando '
         + 'o bug e vendo o teste falhar?'],
  ['§1.2', 'Os caminhos que NÃO podiam quebrar foram testados de propósito, e '
         + 'não só o caminho que eu mexi?'],
  ['§5',   'Mexi em banco/RPC/RLS? Testei em transação com ROLLBACK ANTES de '
         + 'aplicar em produção?'],
  ['§6.1', 'Faxina no que toquei: código morto, duplicação, egress, cleanup de '
         + 'timer/subscription/objectURL?'],
  ['§6.2', 'A documentação que mudou foi a CERTA? (medição -> DESEMPENHO, '
         + 'decisão -> DECISOES, arquivo novo -> ARQUITETURA, o que falta -> '
         + 'BACKLOG, quando quebra -> OPERACAO)'],
];

// ── Veredicto ──────────────────────────────────────────────────────────────
if (avisos.length) {
  console.log('\n  Avisos:');
  avisos.forEach(a => console.log(`    - ${a}`));
}

if (falhas.length) {
  console.error(`\n  ${falhas.length} item(ns) impedem fechar a sessão:\n`);
  falhas.forEach(f => console.error(`  ─ ${f}\n`));
  console.error('  Nada disto vai para a próxima sessão: a sessão acaba e o contexto some.\n');
  process.exit(1);
}

console.log('\n  A parte MECÂNICA está fechada — 6 dos 13 itens do §2.');
console.log('  Os outros 7 nenhum script verifica. Responda cada um, em voz alta,');
console.log('  no relatório de entrega ao dono:\n');
JULGAMENTO.forEach(([sec, pergunta]) => {
  console.log(`  ${sec.padEnd(5)} ${pergunta.replace(/(.{72}) /g, '$1\n        ')}`);
  console.log('');
});
console.log('  Verde aqui NÃO quer dizer pronto. Quer dizer que o que dá para');
console.log('  medir por máquina está medido.\n');
