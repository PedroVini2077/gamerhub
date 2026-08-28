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

await browser.close();

if (falhas) {
  console.error(`\n${falhas} falha(s) na trava da cena 3D.`);
  process.exit(1);
}
console.log('\nOK: o laço anima na tela e para fora dela.');
