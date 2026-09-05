/**
 * Trava dos dois bugs de navegação achados em 01/09.
 *
 * Nenhum dos dois quebra nada visível: a página abre, os links existem, o
 * console fica limpo. Eles só entregam a pessoa no lugar errado — e por isso
 * passaram por todos os portões que já existiam.
 *
 * ── Bug 1: abrir "Sobre" pelo rodapé caía no MEIO da página ────────────────
 *
 * Medido antes do conserto: scroll em 4420 px no rodapé da landing, clique em
 * "Sobre o GamerHub", e a `/sobre` abria em **4420 px**.
 *
 * Não era defeito do site. Navegação do React Router é troca de rota no
 * cliente, não carregamento de documento — o navegador não tem por que mexer
 * no scroll, e o v6 não reseta sozinho.
 *
 * ── Bug 2: os links de seção do rodapé não funcionavam na "Sobre" ──────────
 *
 * O rodapé aparece nas DUAS páginas, mas usava âncora relativa (`#feed`). Na
 * `/sobre` essa seção não existe: o clique não fazia nada.
 *
 * ── O que este arquivo NÃO deixa acontecer de novo ─────────────────────────
 *
 * Que "chegar no lugar certo" volte a ser uma promessa não verificada. Um
 * `scrollTo(0,0)` jogado em qualquer lugar consertaria o bug 1 e QUEBRARIA as
 * âncoras e o botão voltar — por isso o teste confere os três casos, não um.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const JANELA = { width: 412, height: 830 };   // celular, onde o dono viu

const navegador = await abrirNavegador();
const page = await navegador.newPage({ viewport: JANELA });
let passo = 0;
const ok = (m) => console.log(`  ${String(++passo).padStart(2)}. OK   ${m}`);

async function morrer(etapa, erro) {
  console.error(`\n  FALHOU em: ${etapa}\n  ${erro?.message ?? erro}\n`);
  await salvarEvidencia(page);
  await navegador.close();
  process.exit(1);
}

const rolagem = () => page.evaluate(() => Math.round(window.scrollY));
const rodape = () => page.evaluate(
  () => window.scrollTo(0, document.body.scrollHeight));

try {
  await exigirServidor(BASE);
  console.log(`\n  Navegação em ${BASE}\n`);

  // ── 1. Landing rolada -> Sobre: tem que abrir NO TOPO ────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1200);
  await rodape();
  await page.waitForTimeout(400);

  const antes = await rolagem();
  if (antes < 500) {
    throw new Error(`a landing so rolou ${antes}px — o teste precisa dela `
      + 'rolada para provar o conserto. A pagina encolheu?');
  }

  await page.getByRole('link', { name: /sobre o gamerhub/i }).first().click();
  await page.waitForTimeout(1200);

  const depois = await rolagem();
  const url = await page.evaluate(() => location.pathname);
  if (url !== '/sobre') throw new Error(`o link nao levou para /sobre (foi para ${url})`);
  if (depois > 80) {
    throw new Error(
      `a /sobre abriu em ${depois}px, vinda de ${antes}px na landing.\n`
      + '  A pessoa cai no MEIO da pagina — foi o bug de 01/09 voltando.\n'
      + '  Causa: React Router nao reseta scroll ao trocar de rota. Quem faz\n'
      + '  isso e src/components/ui/RolagemDeRota.jsx; confira se ele ainda\n'
      + '  esta montado no App.jsx.');
  }
  ok(`landing em ${antes}px -> /sobre abriu em ${depois}px`);

  // ── 2. Link de seção do rodapé, A PARTIR da /sobre ───────────────────────
  await rodape();
  await page.waitForTimeout(400);
  await page.locator('a').filter({ hasText: /^Feed/i }).first().click();
  await page.waitForTimeout(1600);

  const destino = await page.evaluate(() => ({
    caminho: location.pathname, hash: location.hash,
    y: Math.round(window.scrollY),
    temSecao: !!document.querySelector('#feed'),
  }));

  if (destino.caminho !== '/') {
    throw new Error(`o link de secao do rodape nao voltou para a landing `
      + `(foi para ${destino.caminho}). Ele precisa ser absoluto: o rodape `
      + 'aparece na /sobre tambem, e ancora relativa nao existe la.');
  }
  if (!destino.temSecao) throw new Error('a landing carregou sem a secao #feed');
  if (destino.y < 100) {
    throw new Error(`chegou na landing mas ficou em ${destino.y}px — a ancora `
      + 'nao rolou ate a secao. Confira o ramo `hash` do RolagemDeRota.');
  }
  ok(`secao do rodape a partir da /sobre -> landing em ${destino.y}px`);

  // ── 3. Voltar tem que PRESERVAR a posição ────────────────────────────────
  // O caso mais esquecido: o navegador ja guarda onde a pessoa estava, e um
  // reset cego apagaria isso. Sem esta checagem, "consertar" o bug 1 mais
  // agressivamente passaria despercebido.
  await page.goBack();
  await page.waitForTimeout(1200);
  const voltou = await page.evaluate(() => location.pathname);
  if (voltou !== '/sobre') throw new Error(`voltar levou para ${voltou}, nao /sobre`);
  ok('voltar leva de volta para /sobre sem o reset atropelar o navegador');
} catch (e) {
  await morrer(`passo ${passo + 1}`, e);
}

await navegador.close();
console.log(`\n  ${passo}/3 comportamentos de navegação corretos.\n`);
