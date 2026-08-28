/**
 * Teste de fumaça das rotas COMO VISITANTE — roda num navegador de verdade.
 *
 * Existe por causa do upgrade do react-router (7.15 -> 7.18.2, correção de
 * CSRF), que na época foi validado só por build e suíte unitária. Build
 * passando não prova que uma rota renderiza: prova que compila.
 *
 * O que garante: cada rota monta sem exceção de JS, e o guard de visitante
 * (`RequireAuth`) manda para onde deveria. O caminho autenticado é do
 * `fluxos.mjs` — este aqui, sozinho, nunca passa da porta.
 *
 * Uso:  npm run build && npx vite preview --port 4173 &  →  node e2e/smoke.mjs
 */
import { abrirNavegador, exigirServidor } from './util.mjs';
import { ROTAS_VISITANTE } from './rotas.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

// Ruído esperado que não indica quebra de rota.
const IGNORAR = [
  /favicon/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /the server responded with a status of 4/i,
];

await exigirServidor(BASE);
const browser = await abrirNavegador();

let falhas = 0;

for (const rota of ROTAS_VISITANTE) {
  // Contexto novo por rota: sem isso, um redirecionamento deixaria estado de
  // sessão vazando para a rota seguinte.
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
    // `domcontentloaded`, e NÃO `networkidle`.
    //
    // `networkidle` espera a rede ficar parada por 500 ms — e ela nunca para
    // quando um recurso de terceiro pendura. Foi o que aconteceu numa rodada
    // local: `/community` estourou o timeout de 20 s, e na repetição passou
    // 13/13. A causa provável é o Google Fonts inalcançável no sandbox, com o
    // navegador retentando para sempre.
    //
    // O problema nem é a lentidão: é que o teste vermelho apontava para a
    // ROTA, quando o defeito estava na rede. Teste que acusa o inocente ensina
    // a ignorar vermelho, que é o oposto do que ele existe para fazer.
    //
    // A espera certa não é "a rede parou" — é "o conteúdo que eu vim conferir
    // apareceu". É isso que o `waitForFunction` abaixo faz.
    const resp = await page.goto(BASE + rota.path, {
      waitUntil: 'domcontentloaded', timeout: 20000,
    });
    if (!resp || resp.status() >= 400) status = `HTTP ${resp?.status()}`;

    // A app é SPA: espera o React montar e o guard redirecionar. O timeout
    // aqui NÃO estoura o teste de propósito — se o conteúdo não vier, as
    // checagens abaixo produzem uma mensagem precisa ("TELA BRANCA", "guard
    // levou para X", "sem o conteúdo esperado"), que diagnostica muito melhor
    // do que um timeout cru.
    await page
      .waitForFunction(
        ({ fonte, flags }) => new RegExp(fonte, flags).test(document.body?.innerText ?? ''),
        { fonte: rota.esperado.source, flags: rota.esperado.flags },
        { timeout: 12000 },
      )
      .catch(() => {});
    await page.waitForTimeout(300);

    // Onde o guard deixou a pessoa. `destino: null` = a rota não redireciona.
    if (rota.destino !== null) {
      const atual = new URL(page.url()).pathname;
      if (atual !== rota.destino) {
        status = `guard levou para ${atual}, esperado ${rota.destino}`;
      }
    }

    const texto = await page.locator('body').innerText();
    if (!texto.trim()) status = 'TELA BRANCA';
    else if (status === 'OK' && !rota.esperado.test(texto)) {
      status = `sem o conteúdo esperado (${rota.esperado})`;
    }
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
console.log(`\n  ${ROTAS_VISITANTE.length - falhas}/${ROTAS_VISITANTE.length} rotas OK (como visitante)`);
process.exit(falhas ? 1 : 0);
