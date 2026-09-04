/**
 * O que a página /contato entrega a terceiros — MEDIDO, não afirmado.
 *
 * ── Por que este arquivo existe ─────────────────────────────────────────────
 *
 * O captcha do formulário de contato carrega um script do Cloudflare. Isso faz
 * o navegador de quem abre a página aparecer no registro de mais uma empresa —
 * exatamente o tipo de coisa que a política de privacidade promete listar.
 *
 * E a política afirma, no resumo, que **o site não usa cookies**. Se o
 * Turnstile criar um, aquela frase vira mentira num documento legal, e ninguém
 * veria pela tela. Nenhuma das travas existentes pega isso: a de terceiros
 * varre o `package.json` (e um `<script>` injetado não é dependência), e a de
 * fontes varre `index.html` e `index.css`.
 *
 * ── O que ele NÃO faz, e é a parte honesta ──────────────────────────────────
 *
 * Ele não conclui nada quando o Cloudflare está inalcançável — sai com 2
 * (ambiente), igual às travas de porta. "Não consegui medir" e "medi e está
 * limpo" são respostas diferentes, e trocar uma pela outra é como um portão
 * passa a dar verde sobre nada.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

// Hosts que a página PODE contactar. Qualquer outro é terceiro novo e a
// política precisa saber.
const PERMITIDOS = [
  'challenges.cloudflare.com',   // o captcha, declarado na política
];

const navegador = await abrirNavegador();
const contexto = await navegador.newContext({ viewport: { width: 412, height: 900 } });
const page = await contexto.newPage();

const hosts = new Set();
page.on('request', (r) => {
  try {
    const h = new URL(r.url()).host;
    if (h && !r.url().startsWith(BASE)) hosts.add(h);
  } catch { /* url estranha, ignora */ }
});

try {
  await exigirServidor(BASE);
  console.log(`\n  O que a /contato entrega para fora\n`);

  await page.goto(`${BASE}/contato`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // O widget é assíncrono: script, render, e o desafio em si.
  await page.waitForTimeout(12000);

  const carregou = await page.evaluate(() => ({
    temApi: !!window.turnstile,
    temIframe: !!document.querySelector('iframe[src*="challenges.cloudflare.com"]'),
    avisouFalha: /não carregou|nao carregou/i.test(document.body.innerText),
  }));

  if (!carregou.temApi && !carregou.temIframe) {
    console.error('\n  O script do Turnstile nao carregou neste ambiente.');
    console.error(`  (a tela ${carregou.avisouFalha ? 'AVISOU' : 'nao avisou'} a falha)`);
    console.error('  Sem ele nao da para medir o que a pagina entrega — e dizer');
    console.error('  "esta limpo" aqui seria dar verde sobre nada.\n');
    await navegador.close();
    process.exit(2);   // 2 = ambiente, != 1 = achado de verdade
  }

  // ── 1. A tela avisa quando o desafio falha? (§1.5) ───────────────────────
  // Se ele carregou, nao deve haver aviso de falha.
  console.log(`   1. OK   o desafio carregou (api: ${carregou.temApi}, iframe: ${carregou.temIframe})`);

  // ── 2. Nenhum cookie — é o que a política afirma no resumo ────────────────
  const cookies = await contexto.cookies();
  if (cookies.length > 0) {
    throw new Error(
      'a /contato criou cookie, e a politica de privacidade afirma que o site\n'
      + '    NAO usa cookies. Um documento legal passou a mentir.\n'
      + `    cookies: ${JSON.stringify(cookies.map((c) => ({ nome: c.name, dominio: c.domain })))}\n`
      + '    Se o cookie e do Turnstile e nao da para evitar, o certo NAO e\n'
      + '    afrouxar este teste: e corrigir o texto da politica, subir a versao\n'
      + '    do documento (lib/documentosLegais.js) e recolher o aceite de novo.');
  }
  console.log('   2. OK   nenhum cookie criado');

  // ── 3. Nenhum terceiro além do declarado ─────────────────────────────────
  const naoDeclarados = [...hosts].filter(
    (h) => !PERMITIDOS.some((p) => h === p || h.endsWith(`.${p}`)));
  if (naoDeclarados.length > 0) {
    throw new Error(
      'a /contato contactou terceiro que a politica nao lista:\n'
      + naoDeclarados.map((h) => `      ${h}`).join('\n')
      + '\n    Toda empresa que recebe uma requisicao do navegador do visitante\n'
      + '    ve o IP dele. A pagina /privacidade lista quem recebe o que — ligar\n'
      + '    um servico novo sem atualiza-la e fazer a pessoa aparecer no\n'
      + '    registro de outra empresa sem que o site diga isso.');
  }
  console.log(`   3. OK   terceiros contactados: ${[...hosts].join(', ') || '(nenhum)'}`);

} catch (e) {
  console.error(`\n  FALHOU: ${e.message}\n`);
  await salvarEvidencia(page);
  await navegador.close();
  process.exit(1);
}

await navegador.close();
console.log('\n  A /contato entrega para fora exatamente o que a politica declara.\n');
