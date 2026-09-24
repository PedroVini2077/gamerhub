/**
 * A CSP, conferida num NAVEGADOR DE VERDADE antes de ir ao ar.
 *
 * ── Por que este roteiro existe ─────────────────────────────────────────────
 *
 * CSP errada nao avisa: ela derruba a tela de quem usa. E o item ficou aberto no
 * backlog por dias justamente porque *"CSP errada derruba o site"* — o medo era
 * legitimo, e a resposta certa nao era evitar, era **medir**.
 *
 * Ele sobe o `dist` num servidor local **com a politica lida do
 * `vercel.json`** e carrega as rotas publicas num Chromium. Ler a politica do
 * `vercel.json` e o que impede a deriva: nao existe uma segunda copia da CSP
 * para envelhecer (§4, fonte unica).
 *
 * ── As duas diretivas que rota publica NAO exercita ────────────────────────
 *
 * `frame-src` so aparece quando ha uma live no ar, e `connect-src` so quando o
 * app fala com o banco. Por isso o roteiro **sonda as duas de proposito**,
 * criando um iframe para cada origem de embed e disparando `fetch` para as
 * origens que a politica deve permitir.
 *
 * ── O controle, sem o qual a sonda mentiria ────────────────────────────────
 *
 * Na primeira execucao, `fetch` para o Supabase falhou com `Failed to fetch` e
 * **zero violacoes de CSP**. Concluir "a CSP bloqueou" ali teria sido inferencia
 * vestida de fato (§1.1): o ambiente de CI nao tem saida de rede na pagina.
 *
 * Por isso existe o CONTROLE: uma origem que a politica **proibe de verdade**.
 * Se ela falha COM violacao no console e as outras falham SEM, a diferenca
 * prova que o que barrou as outras foi a rede, nao a politica.
 *
 * ── O que ele NAO cobre, dito com todas as letras ──────────────────────────
 *
 * Rota autenticada. O roteiro nao faz login, entao feed, lives, perfil e painel
 * nao passam por aqui. O risco disso e baixo e nomeavel: essas telas nao
 * introduzem origem nova — usam o mesmo Supabase e os mesmos embeds que a sonda
 * ja cobre. Se um dia entrar um dominio novo, e aqui que ele tem de ser somado.
 *
 * Uso:  node e2e/politica-de-conteudo.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIST = 'dist';
const PORTA = 4199;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('\n  Nao ha `dist/`. Rode `npm run build` antes.\n');
  process.exit(2);                    // 2 = ambiente, != 1 = site com problema
}

/** FONTE UNICA: a politica sai do `vercel.json`, nunca de uma copia aqui. */
const CSP = (() => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const h = (v.headers || []).flatMap(b => b.headers || [])
    .find(x => x.key.toLowerCase() === 'content-security-policy');
  if (!h) {
    console.error('\n  O `vercel.json` nao declara `Content-Security-Policy`.');
    console.error('  Se ela foi removida de proposito, este roteiro sai junto —');
    console.error('  portao que confere politica inexistente e alarme falso.\n');
    process.exit(1);
  }
  return h.value;
})();

const TIPOS = {
  '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json',
  '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.ico':'image/x-icon',
  '.webmanifest':'application/manifest+json', '.txt':'text/plain', '.xml':'application/xml',
};

const srv = createServer((req, res) => {
  const url = req.url.split('?')[0];
  let f = join(DIST, url === '/' ? 'index.html' : url);
  if (!existsSync(f) || url === '/') {
    // Asset que nao existe devolve 404 em vez do `index.html`. Sem isto, um JS
    // faltando chega como HTML e o erro vira `Unexpected token '<'` — que manda
    // procurar no lugar errado.
    if (url !== '/' && /\.[a-z0-9]+$/i.test(url)) { res.writeHead(404); return res.end(); }
    f = join(DIST, 'index.html');
  }
  res.writeHead(200, {
    'Content-Type': TIPOS[extname(f)] || 'application/octet-stream',
    'Content-Security-Policy': CSP,
  });
  res.end(readFileSync(f));
});
await new Promise(r => srv.listen(PORTA, r));

const ROTAS = ['/', '/login', '/cadastro', '/sobre', '/privacidade', '/termos'];
const EMBEDS = [
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'https://player.twitch.tv/?channel=x&parent=localhost',
  'https://clips.twitch.tv/embed?clip=x&parent=localhost',
];
const PROIBIDA = 'https://origem-que-a-csp-proibe.invalid/x';

const violacoes = [];
const erros = [];
const eViolacao = (t) => /Content Security Policy|Refused to (connect|load|execute|frame)/i.test(t);

let navegador;
try {
  navegador = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
} catch (e) {
  console.error(`\n  Nao consegui abrir o Chromium: ${String(e).slice(0, 160)}`);
  console.error('  Ambiente, nao site. Use PW_CHROMIUM=/caminho/do/chrome se preciso.\n');
  srv.close();
  process.exit(2);
}

for (const rota of ROTAS) {
  const pg = await navegador.newPage();
  pg.on('console', m => { if (eViolacao(m.text())) violacoes.push(`${rota} :: ${m.text().slice(0, 200)}`); });
  pg.on('pageerror', e => erros.push(`${rota} :: ${String(e).slice(0, 150)}`));
  await pg.goto(`http://127.0.0.1:${PORTA}${rota}`, { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => {});
  await pg.waitForTimeout(2000);
  const textoNaTela = await pg.evaluate(() => (document.body?.innerText || '').trim().length);
  if (textoNaTela < 40) {
    erros.push(`${rota} :: TELA PRATICAMENTE VAZIA (${textoNaTela} caracteres) — `
      + 'a CSP provavelmente matou o app antes de ele pintar');
  }
  await pg.close();
}

// ── A sonda das duas diretivas, e o controle que a torna confiavel ──────────
const sonda = await navegador.newPage();
const violacoesDaSonda = [];
sonda.on('console', m => { if (eViolacao(m.text())) violacoesDaSonda.push(m.text()); });
await sonda.goto(`http://127.0.0.1:${PORTA}/`, { waitUntil: 'domcontentloaded' });

const frames = await sonda.evaluate(async (alvos) => {
  const r = [];
  for (const src of alvos) {
    const f = document.createElement('iframe');
    f.src = src; document.body.appendChild(f);
    await new Promise(res => setTimeout(res, 800));
    r.push([new URL(src).host, !!f.contentWindow]);
  }
  return r;
}, EMBEDS);

// `[24/09]` `f.contentWindow` continua verdadeiro num iframe BLOQUEADO — ele
// aponta para `about:blank`. A primeira versao deste roteiro checava so isso, e
// reinjetar "youtube fora do frame-src" passou VERDE. Quem sabe a verdade e o
// console: bloqueio de frame vira `Refused to frame ...`.
for (const [host, carregou] of frames) {
  const barrado = violacoesDaSonda.some(v => v.includes(host));
  if (barrado || !carregou) {
    violacoes.push(`frame-src :: ${host} foi BLOQUEADO — o player de live nao abriria`);
  }
}

await sonda.evaluate(async (u) => { try { await fetch(u, { mode: 'no-cors' }); } catch { /* esperado */ } },
  PROIBIDA);
await sonda.waitForTimeout(600);

for (const v of violacoesDaSonda) {
  if (!v.includes('origem-que-a-csp-proibe') && !EMBEDS.some(e => v.includes(new URL(e).host))) {
    violacoes.push(`sonda :: ${v.slice(0, 200)}`);
  }
}

const controlouCerto = violacoesDaSonda.some(v => v.includes('origem-que-a-csp-proibe'));
if (!controlouCerto) {
  erros.push('CONTROLE FALHOU: a origem proibida NAO gerou violacao de CSP.\n'
    + '    Isso quer dizer que este roteiro nao consegue distinguir politica de\n'
    + '    rede — e um verde dele deixaria de significar alguma coisa.');
}
await sonda.close();
await navegador.close();
srv.close();

// ── Veredicto ──────────────────────────────────────────────────────────────
//
// `[24/09]` AMBIENTE nao e POLITICA. Um `dist` construido sem as variaveis do
// site derruba o app por conta propria, e sem esta separacao o roteiro
// acusaria a CSP por um erro que nao e dela — mandando procurar no lugar
// errado, que e o pior tipo de mensagem de falha (§1.5).
const semVariaveis = erros.some(e => /Configura..o ausente|VITE_SUPABASE/i.test(e));
if (semVariaveis && violacoes.length === 0) {
  console.error('\n  O `dist` foi construido SEM as variaveis do site, entao o app nao sobe');
  console.error('  e este roteiro nao consegue dizer nada sobre a CSP.');
  console.error('  Rode: VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run build\n');
  process.exit(2);                  // 2 = ambiente, != 1 = politica com problema
}

console.log(`\n  ${ROTAS.length} rotas publicas · ${EMBEDS.length} origens de embed · 1 controle`);

if (violacoes.length === 0 && erros.length === 0) {
  console.log('  OK      nenhuma violacao de CSP, e o controle provou que o roteiro enxerga\n');
  process.exit(0);
}
console.log('');
[...new Set(violacoes)].forEach(v => console.log(`  FALHOU  ${v}`));
[...new Set(erros)].forEach(e => console.log(`  FALHOU  ${e}`));
console.log(`\n  ${violacoes.length + erros.length} problema(s) com a CSP do \`vercel.json\`.`);
console.log('  A politica esta em `vercel.json`; ajuste LA, nunca uma copia aqui.\n');
process.exit(1);
