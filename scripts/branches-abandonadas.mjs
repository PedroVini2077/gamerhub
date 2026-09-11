// Branches que ficaram para trás — e a distinção que decide se é lixo ou não.
//
// ── Por que existe ──────────────────────────────────────────────────────────
//
// `[11/09]` Pedido do dono: *"tenho percebido que os commits lá no GitHub não
// tem estado todos sincronizados, vc não consegue fazer um portão ou gatilho
// passar por eles não? eu vivo vendo os bots e as outras branch's
// desatualizadas"*.
//
// Medido antes de escrever qualquer coisa: **9 branches do Dependabot**, até
// 119 commits atrás da `main` — e apenas **2 PRs abertos**. Ou seja, sete delas
// eram restos de PR já fechado que nunca foram apagados. Não eram trabalho
// pendente; eram entulho.
//
// ── A distinção que este script faz, e por que ela é o ponto ────────────────
//
// "Atrás da main" sozinho não quer dizer nada. Toda branch de trabalho fica
// atrás assim que alguém mergeia outra coisa, e o Dependabot rebaseia as dele
// quando precisa. Gritar por isso seria alarme falso diário — o tipo que ensina
// a ignorar o canal (`CLAUDE.md` §0.2, 4ª regra).
//
// O que importa é outra pergunta: **existe um PR aberto para esta branch?**
//
//   | Situação | O que é | O que fazer |
//   | --- | --- | --- |
//   | atrás **e sem PR aberto** | resto de PR fechado | apagar |
//   | atrás **com PR aberto** | trabalho em fila | nada — o autor rebaseia |
//
// ── A correção de RAIZ não é este script ───────────────────────────────────
//
// É o `Automatically delete head branches` nas configurações do repositório:
// um clique, e o entulho deixa de nascer. Este script existe porque (a) essa
// opção é ação do dono, e (b) ela não apaga o que já está lá.
//
// Uso:  node scripts/branches-abandonadas.mjs
// No CI, usa o `GITHUB_TOKEN` que o Actions já injeta — sem credencial nova.

const REPO = process.env.GITHUB_REPOSITORY ?? 'PedroVini2077/gamerhub';
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const BASE = 'https://api.github.com';

/** Branch que o script NUNCA sugere apagar, por mais atrás que esteja. */
const PROTEGIDAS = [
  'main',
  // A branch de trabalho combinada com o dono (`CLAUDE.md` §8). Ela fica atrás
  // por definição entre um merge e o `--force-with-lease` que a realinha.
  'claude/gamerhub-technical-summary-vhguK',
];

async function api(caminho) {
  const r = await fetch(BASE + caminho, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!r.ok) {
    // Cada status quer uma acao diferente, e dizer o motivo errado manda quem
    // le procurar no lugar errado (§1.5: toda mensagem de erro tem que ser
    // verdadeira). A primeira versao dizia "sem token" para TUDO — e o 401 que
    // ela recebeu de verdade significa o oposto: um token FOI enviado e
    // recusado.
    const porQue = {
      401: 'o GITHUB_TOKEN do ambiente foi RECUSADO. Rode sem ele\n'
         + '       (`env -u GITHUB_TOKEN node ...`) ou exporte um valido.',
      403: 'limite de chamadas da API. Sem token sao 60 por hora; no CI o\n'
         + '       Actions injeta o `GITHUB_TOKEN` e o teto sobe.',
      404: 'repositorio ou branch nao encontrado — confira GITHUB_REPOSITORY.',
    }[r.status] ?? 'resposta inesperada da API.';
    throw new Error(`GitHub respondeu ${r.status} em ${caminho}.\n       ${porQue}`);
  }
  return r.json();
}

/** Tudo de uma listagem paginada, nao so a primeira pagina. */
async function tudo(caminho) {
  const itens = [];
  for (let pagina = 1; pagina <= 10; pagina++) {
    const lote = await api(`${caminho}${caminho.includes('?') ? '&' : '?'}per_page=100&page=${pagina}`);
    itens.push(...lote);
    if (lote.length < 100) break;
  }
  return itens;
}

/**
 * A CLASSIFICACAO, separada do I/O para poder ser testada.
 *
 * Sem isto ela so existiria dentro de um laco que chama a API, e a unica forma
 * de verificar seria rodar contra o GitHub de verdade — que e exatamente o tipo
 * de trava que nao roda no `npm test` e por isso nunca reprova nada.
 */
export function classificar(nomes, refsComPrAberto, protegidas = PROTEGIDAS) {
  const orfas = [];
  const emFila = [];
  for (const nome of nomes) {
    if (protegidas.includes(nome)) continue;
    (refsComPrAberto.includes(nome) ? emFila : orfas).push(nome);
  }
  return { orfas, emFila };
}

// A varredura so roda quando o script E EXECUTADO. Importado por um teste, ele
// para aqui: bater na API do GitHub durante o `npm test` seria lento, flaky e
// dependente de rede — e a trava que importa e sobre a CLASSIFICACAO, nao sobre
// a rede.
if (!process.env.VITEST) {

const branches = await tudo(`/repos/${REPO}/branches`);
const prs = await tudo(`/repos/${REPO}/pulls?state=open`);
const comPrAberto = new Set(prs.map((p) => p.head?.ref).filter(Boolean));

const abandonadas = [];
const emFila = [];

for (const b of branches) {
  if (PROTEGIDAS.includes(b.name)) continue;
  // `compare` diz quantos commits a branch esta atras e a frente da main.
  const c = await api(`/repos/${REPO}/compare/main...${encodeURIComponent(b.name)}`);
  const linha = { nome: b.name, atras: c.behind_by, frente: c.ahead_by };
  if (comPrAberto.has(b.name)) emFila.push(linha);
  else abandonadas.push(linha);
}

abandonadas.sort((a, b) => b.atras - a.atras);

console.log(`\n  Branches em ${REPO}\n`);

if (emFila.length) {
  console.log('  Com PR aberto — nao sao lixo, o autor rebaseia:');
  for (const b of emFila) {
    console.log(`    ${b.nome.padEnd(52)} ${String(b.atras).padStart(4)} atras`);
  }
  console.log('');
}

if (!abandonadas.length) {
  console.log('  OK: nenhuma branch orfa. Toda branch tem PR aberto.\n');
  process.exit(0);
}

console.log(`  ${abandonadas.length} branch(es) SEM PR aberto — restos de PR fechado:\n`);
for (const b of abandonadas) {
  console.log(`    ${b.nome.padEnd(52)} ${String(b.atras).padStart(4)} atras · ${b.frente} a frente`);
}

console.log('\n  Elas nao representam trabalho pendente: o PR delas ja foi fechado');
console.log('  ou substituido. Cada uma pode ser apagada pela pagina de branches.');
console.log('\n  A correcao de RAIZ, e ela e de UM CLIQUE:');
console.log('    Settings -> General -> Pull Requests');
console.log('    -> "Automatically delete head branches"');
console.log('  Com isso ligado, o entulho deixa de nascer.\n');

// Nao reprova: branch orfa nao quebra o site nem o build. Reprovar PR por causa
// disso seria exatamente o alarme que grita a toa (§0.2, 4a regra). Quem avisa
// e a issue semanal.

}
