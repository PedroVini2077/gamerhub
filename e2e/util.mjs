/**
 * Peças comuns aos testes de navegador (`smoke.mjs` e `fluxos.mjs`).
 *
 * Existe porque as três primeiras coisas que todo E2E faz — achar o Chromium,
 * conferir se o servidor está de pé, e salvar evidência quando quebra — já
 * estavam duplicadas em dois arquivos. Cópia diverge: o caminho do Chromium
 * cravado num deles foi exatamente o bug que fez o CI falhar por um motivo que
 * não tinha nada a ver com o site.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

// O ambiente onde o Claude roda traz um Chromium pré-instalado num caminho
// fixo. Cravar esse caminho fez o teste funcionar SÓ ali: no CI e em qualquer
// outra máquina ele morria com "executable doesn't exist". Agora é dica
// opcional — sem o arquivo, o Playwright acha o navegador dele sozinho.
const CHROMIUM_PRE_INSTALADO = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// WebGL por software. Chromium sem GPU (CI, container) não cria contexto WebGL
// nenhum — e o teste da cena 3D, que precisa contar desenhos, reportaria "sem
// contexto" e reprovaria por causa do AMBIENTE, não do site. Fica opcional
// porque os outros E2E não desenham nada e não têm por que pagar por isto.
const ARGS_WEBGL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];

export function abrirNavegador({ webgl = false } = {}) {
  return chromium.launch({
    ...(existsSync(CHROMIUM_PRE_INSTALADO) ? { executablePath: CHROMIUM_PRE_INSTALADO } : {}),
    args: ['--no-sandbox', ...(webgl ? ARGS_WEBGL : [])],
  });
}

/**
 * Servidor fora do ar apareceria como "todas as rotas falharam" — o teste
 * mentiria sobre a causa. Já aconteceu de verdade uma vez.
 * Sai com 2 (e não 1) para separar "ambiente errado" de "site quebrado".
 */
export async function exigirServidor(base) {
  try {
    const r = await fetch(base, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    console.error(`\n  Servidor nao respondeu em ${base} (${e.message}).`);
    console.error('  Rode antes:  npm run build && npx vite preview --port 4173\n');
    process.exit(2);
  }
}

/**
 * Sem isto, um E2E que falha no CI só diz "timeout" e ninguém descobre o porquê
 * sem reproduzir na mão. Screenshot + texto da tela + URL + exceções de JS.
 */
export async function salvarEvidencia(page, { erros = [] } = {}) {
  try {
    mkdirSync('e2e-evidencia', { recursive: true });
    await page.screenshot({ path: 'e2e-evidencia/falha.png', fullPage: true });
    const texto = (await page.locator('body').innerText()).slice(0, 1500);
    console.error('  --- o que estava na tela ---');
    console.error(texto.split('\n').map(l => `  | ${l}`).join('\n'));
    console.error(`\n  URL no momento da falha: ${page.url()}`);
    if (erros.length) console.error(`  Exceçoes de JS: ${erros.join(' | ')}`);
    console.error('\n  Screenshot em e2e-evidencia/falha.png (artefato do CI).\n');
  } catch { /* evidência é bônus; nunca esconder o erro original */ }
}

/**
 * Falha com a CAUSA quando a conta de teste está banida.
 *
 * Em 28/08 o `fluxos` quebrou com um timeout de 30 s esperando o composer. A
 * mensagem era verdadeira e inútil: dizia que o formulário não apareceu, não
 * que a conta estava banida. O motivo real era simples — a `claudetester`
 * tinha acabado de ser banida à mão para testar o fluxo de recurso, e a
 * `BannedScreen` (`z-[9999]`) cobria a tela inteira.
 *
 * Sem isto, a próxima vez que alguém banir a conta de teste para validar
 * moderação, o CI volta a acusar "o site não carrega" — e alguém vai caçar um
 * bug que não existe. Mensagem errada custa mais tempo do que mensagem nenhuma
 * (`CLAUDE.md` §1.5).
 */
export async function recusarSeBanido(page) {
  const banida = await page.getByText(/conta banida/i).count();
  if (banida === 0) return;
  const motivo = await page.locator('main, body').innerText().catch(() => '');
  throw new Error(
    'a CONTA DE TESTE esta banida — nao e falha do site.\n'
    + '  A BannedScreen cobre a tela e nenhuma acao do teste alcanca a pagina.\n'
    + '  Desbane a conta no painel (ou por unban_user) e rode de novo.\n'
    + `  Motivo mostrado na tela: ${motivo.slice(0, 200)}`);
}
