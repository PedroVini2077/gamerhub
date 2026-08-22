/**
 * Teste de fumaça das rotas — roda num navegador de verdade.
 *
 * Existe por causa do upgrade do react-router (7.15 -> 7.18.2, correção de
 * CSRF), que na época foi validado só por build e suíte unitária. Build
 * passando não prova que uma rota renderiza: prova que compila.
 *
 * O que este teste garante: cada rota monta, sem erro de console e sem
 * exceção de JS. Não substitui teste de fluxo (postar, banir) — é a rede de
 * segurança contra "um upgrade derrubou uma página inteira".
 *
 * Uso:  npm run build && npx vite preview --port 4173 &  →  node e2e/smoke.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

// `esperado` é um trecho que precisa aparecer na tela para provar que a página
// renderizou de verdade, e não só devolveu um HTML vazio de SPA.
const ROTAS = [
  { path: '/',                 nome: 'Landing',        esperado: /gamerhub/i },
  { path: '/login',            nome: 'Login',          esperado: /entrar|login|senha/i },
  { path: '/home',             nome: 'Feed',           esperado: /./ },
  { path: '/lives',            nome: 'Lives',          esperado: /lives/i },
  { path: '/comunidade',       nome: 'Comunidade',     esperado: /./ },
  { path: '/keys',             nome: 'Keys',           esperado: /./ },
  { path: '/ranks',            nome: 'Ranks',          esperado: /rank/i },
  { path: '/perfil',           nome: 'Perfil',         esperado: /./ },
  { path: '/configuracoes',    nome: 'Configuracoes',  esperado: /./ },
  { path: '/admin',            nome: 'Admin',          esperado: /./ },
  { path: '/u/opedrovini',     nome: 'Perfil publico', esperado: /./ },
  { path: '/rota-que-nao-existe', nome: '404',         esperado: /./ },
];

// Ruído esperado que não indica quebra de rota.
const IGNORAR = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /the server responded with a status of 4/i,
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let falhas = 0;

for (const rota of ROTAS) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const erros = [];

  page.on('pageerror', e => erros.push(`exceção JS: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const txt = m.text();
    if (IGNORAR.some(re => re.test(txt))) return;
    erros.push(`console.error: ${txt.slice(0, 160)}`);
  });

  let status = 'OK';
  try {
    const resp = await page.goto(BASE + rota.path, {
      waitUntil: 'networkidle', timeout: 20000,
    });
    if (!resp || resp.status() >= 400) status = `HTTP ${resp?.status()}`;

    // A app é SPA: dá um tempo pro React montar antes de olhar o conteúdo.
    await page.waitForTimeout(700);
    const texto = await page.locator('body').innerText();

    if (!texto.trim()) status = 'TELA BRANCA';
    else if (!rota.esperado.test(texto)) status = `sem o conteúdo esperado (${rota.esperado})`;
  } catch (e) {
    status = `falhou: ${e.message.split('\n')[0]}`;
  }

  if (erros.length) status = status === 'OK' ? erros[0] : `${status} | ${erros[0]}`;

  const ok = status === 'OK';
  if (!ok) falhas++;
  console.log(`  ${ok ? 'OK   ' : 'FALHA'}  ${rota.nome.padEnd(16)} ${rota.path.padEnd(24)} ${ok ? '' : status}`);

  await ctx.close();
}

await browser.close();
console.log(`\n  ${ROTAS.length - falhas}/${ROTAS.length} rotas OK`);
process.exit(falhas ? 1 : 0);
