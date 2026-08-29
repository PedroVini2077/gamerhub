/**
 * Trava do laço de animação da cena 3D — roda num navegador de verdade.
 *
 * ── O número que motivou esta trava ─────────────────────────────────────────
 *
 * PageSpeed de 28/08, desktop, repartição da thread principal:
 *
 *     Other                       29.441 ms   <- o laço de animação
 *     Script Evaluation              789 ms
 *     Script Parsing & Compilation    79 ms
 *
 * 96% do custo estava no laço, e não nos 887 KB. A correção foi parar de
 * desenhar quando a cena sai da tela (`frameloop` em `LandingScene.jsx`).
 *
 * ── Por que precisa de navegador, e por que precisa de trava ────────────────
 *
 * `IntersectionObserver`, `requestAnimationFrame` e WebGL não existem no
 * ambiente do Vitest — nenhum teste unitário consegue afirmar que o laço
 * parou. E o modo de falhar aqui é silencioso da pior forma: se alguém
 * remover o `frameloop`, a página continua **funcionando e bonita**, só volta
 * a queimar CPU de quem já rolou para longe. Ninguém abre um bug para isso;
 * só a nota do Lighthouse cai, meses depois (`CLAUDE.md` §1.5).
 *
 * ── Como ele mede ───────────────────────────────────────────────────────────
 *
 * Envolve `gl.drawElements` e conta as chamadas. É o desenho de fato, não uma
 * proxy: se o WebGL está desenhando, este contador sobe.
 *
 * Uso:  npm run build && npx vite preview --port 4173 &  →  node e2e/cena-3d.mjs
 */
import { abrirNavegador, exigirServidor } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

// A cena só sobe em tela larga (`LARGURA_MINIMA_3D` = 1024 em `lib/cena3D.js`).
const JANELA = { width: 1440, height: 900 };
const JANELA_DE_MEDICAO_MS = 2000;

await exigirServidor(BASE);
const browser = await abrirNavegador({ webgl: true });
const ctx = await browser.newContext({ viewport: JANELA });
const page = await ctx.newPage();

let falhas = 0;
const falhar = (msg) => { console.error(`  FALHA: ${msg}`); falhas++; };

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

// A cena 3D é carregada depois do ocioso, com teto absoluto de 2,5 s
// (`Scene3D.jsx`). Esperar com folga.
await page.waitForSelector('canvas', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(4000);

// Teto de thread principal BLOQUEADA na janela de medicao, com a cena visivel.
//
// Os dois lados foram medidos nesta mesma janela de 2 s, nesta mesma maquina,
// em 29/08:
//
//     dpr 1,5 + antialias (como estava)  ->  2.151 ms em 22 long tasks
//     resolucao adaptativa (como esta)   ->      0 ms em  0 long tasks
//
// Nao e estimativa: o numero ruim veio de reinjetar o bug e rodar (§2, a trava
// tem que ser provada). O teto fica no meio, longe dos dois.
//
// Por que TEMPO aqui, sendo que o §0.3 manda barrar por BYTE: o portao de byte
// existe porque medicao de tempo com diferenca PEQUENA vira alarme falso. Aqui
// nao ha diferenca pequena — e zero contra dois mil na mesma maquina, e nenhuma
// oscilacao de ambiente atravessa essa distancia.
const TETO_DE_BLOQUEIO_MS = 800;

/** Soma o tempo de long task (>50 ms) observado durante `ms`. */
function medirBloqueio(ms) {
  return page.evaluate((duracao) => new Promise((resolve) => {
    let total = 0;
    let quantas = 0;
    const observador = new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) { total += e.duration; quantas++; }
    });
    try { observador.observe({ type: 'longtask' }); }
    catch { return resolve(null); }   // navegador sem a API: nao inventa numero
    setTimeout(() => {
      observador.disconnect();
      resolve({ ms: Math.round(total), quantas });
    }, duracao);
  }), ms);
}

/** Conta chamadas reais de desenho do WebGL durante `ms`. */
function medirDesenhos(ms) {
  return page.evaluate((duracao) => new Promise((resolve) => {
    const cv = document.querySelector('canvas');
    if (!cv) return resolve(-1);
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    if (!gl) return resolve(-2);
    let n = 0;
    const original = gl.drawElements.bind(gl);
    gl.drawElements = (...args) => { n++; return original(...args); };
    setTimeout(() => resolve(n), duracao);
  }), ms);
}

const visivel = await medirDesenhos(JANELA_DE_MEDICAO_MS);

if (visivel === -1) {
  // Sem canvas o teste não tem o que medir. Não é falha do laço — é a cena não
  // ter subido —, mas também não pode passar em silêncio fingindo que validou.
  falhar('nenhum <canvas> na landing: a cena 3D não montou, e a trava não mediu nada');
} else if (visivel === -2) {
  falhar('o canvas existe mas não tem contexto WebGL — a cena não está desenhando');
} else if (visivel === 0) {
  falhar('a cena está VISÍVEL e não desenhou nenhum quadro em 2 s — ela deveria animar aqui');
} else {
  console.log(`  cena visível: ${visivel} desenhos em ${JANELA_DE_MEDICAO_MS} ms`);

  // O desenho acontecer nao basta: ele precisa caber na thread principal.
  const bloqueio = await medirBloqueio(JANELA_DE_MEDICAO_MS);
  if (bloqueio === null) {
    console.log('  (sem PerformanceObserver de longtask neste navegador — bloqueio nao medido)');
  } else {
    console.log(
      `  thread principal: ${bloqueio.ms} ms em ${bloqueio.quantas} long task(s) `
      + `numa janela de ${JANELA_DE_MEDICAO_MS} ms`,
    );
    if (bloqueio.ms > TETO_DE_BLOQUEIO_MS) {
      falhar(
        `a cena bloqueou a thread principal por ${bloqueio.ms} ms de ${JANELA_DE_MEDICAO_MS} ms.\n`
        + `  Teto: ${TETO_DE_BLOQUEIO_MS} ms. Nesta mesma janela, com dpr 1,5 e antialias, deu 2.151 ms —\n`
        + '  ou seja, a landing travada enquanto o Hero estivesse na tela. Foi de onde\n'
        + '  saiu o "Other: 30.182 ms" do PageSpeed no desktop.\n'
        + '  O suspeito e a resolucao: o custo por quadro e proporcional a PIXEL. Confira\n'
        + '  `dpr` e `antialias` no <Canvas> e `ResolucaoAdaptativa.jsx`.',
      );
    }
  }

  // Rola bem para longe do Hero. A margem do observador é 200px, então 4000
  // garante que a cena saiu da zona de "quase visível".
  await page.evaluate(() => window.scrollTo(0, 4000));
  await page.waitForTimeout(1200);

  const escondido = await medirDesenhos(JANELA_DE_MEDICAO_MS);
  console.log(`  cena fora da tela: ${escondido} desenhos em ${JANELA_DE_MEDICAO_MS} ms`);

  if (escondido > 0) {
    falhar(
      `a cena continuou desenhando ${escondido} vez(es) fora da tela.\n`
      + '  O `frameloop` de LandingScene.jsx deixou de pausar o laço. Isso não\n'
      + '  quebra nada visível — só volta a queimar CPU de quem já rolou para\n'
      + '  longe, e foi de onde vieram 29.441 ms de thread principal em 28/08.',
    );
  }
}

// ── O canvas acompanha o tamanho da janela ─────────────────────────────────
//
// Esta parte existe porque em 29/08 o `<Canvas>` do fiber foi trocado por
// `createRoot` (−20% do chunk: ele traz junto o sistema de eventos de ponteiro,
// que esta cena decorativa nunca usa). O `<Canvas>` media o contêiner e
// reconfigurava sozinho ao redimensionar; agora isso é um `ResizeObserver`
// nosso, em `LandingScene.jsx`.
//
// Quebrar esse observador não gera erro nenhum: a cena continua desenhando, só
// que esticada ou cortada, e ninguém percebe até alguém girar o celular ou
// mudar a janela. É falha silenciosa (§1.5) — por isso vira teste.
if (!falhas) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);

  const larguraDoCanvas = () => page.evaluate(
    () => document.querySelector('canvas')?.clientWidth ?? -1,
  );

  const antes = await larguraDoCanvas();
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(1200);
  const depois = await larguraDoCanvas();

  if (antes <= 0 || depois <= 0) {
    falhar('nao consegui medir a largura do canvas antes/depois do resize');
  } else if (depois >= antes) {
    falhar(
      `o canvas nao acompanhou o resize: ${antes}px antes, ${depois}px depois de\n`
      + `  a janela encolher de ${JANELA.width}px para 1100px.\n`
      + '  O ResizeObserver de LandingScene.jsx parou de reconfigurar a raiz. A cena\n'
      + '  continua desenhando — esticada ou cortada — e nada acusa isso.');
  } else {
    console.log(`  canvas acompanha o resize: ${antes}px -> ${depois}px`);
  }
}

await browser.close();

if (falhas) {
  console.error(`\n${falhas} falha(s) na trava da cena 3D.`);
  process.exit(1);
}
console.log('\nOK: o laço anima na tela e para fora dela.');
