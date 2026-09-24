/**
 * E2E autenticado — o caminho que todo usuário percorre todo dia.
 *
 * Por que existe: a suíte tinha 163 testes e **nenhum** exercitava um caminho
 * logado, e o teste de fumaça só abre as rotas como visitante — ou seja, todas
 * as internas caíam no guard e ele nunca via uma tela interna de verdade.
 * Todos os bugs da rodada de 22–23/08 estavam justamente aí.
 *
 * Cobre, nesta ordem:
 *   1. login e sessão válida;
 *   2. todas as rotas internas renderizando conteúdo real (não só montando);
 *   3. `/admin` e `/owner` **negando** acesso a `role = 'user'` — permissão
 *      conferida num navegador de verdade, não só em transação SQL;
 *   4. publicar → aparecer no feed → apagar → sumir;
 *   5. logout.
 *
 * Fora de escopo de propósito: banimento e moderação. Precisariam de uma
 * segunda conta como vítima, são destrutivos, e a hierarquia já é validada em
 * transação com ROLLBACK (ver `db/*.md`).
 *
 * Uso:  npm run build && npx vite preview --port 4173 &  →  node e2e/fluxos.mjs
 * Exige E2E_EMAIL e E2E_PASSWORD (conta comum, nunca de staff — ver passo 3).
 */
import { abrirNavegador, exigirServidor, salvarEvidencia, recusarSeBanido } from './util.mjs';
import { marcaDeTeste } from './publicarPost.mjs';
import { percorrerCicloDoPost } from './cicloDoPost.mjs';
import { conferirPortaoDeEntrada } from './portaoDeEntrada.mjs';
import { ROTAS_LOGADO, ROTAS_PROIBIDAS_PARA_USUARIO, MARCAS_DE_PAINEL } from './rotas.mjs';

const BASE  = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_PASSWORD;

// Título único por execução: nunca mexe num post que não seja o desta rodada,
// mesmo se uma execução anterior tiver morrido no meio.
const MARCA  = marcaDeTeste('[e2e ');

if (!EMAIL || !SENHA) {
  console.error('\n  E2E_EMAIL e E2E_PASSWORD nao definidos.');
  console.error('  Este teste precisa de uma conta descartavel para logar.\n');
  process.exit(2);
}

await exigirServidor(BASE);
const browser = await abrirNavegador();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const erros = [];
page.on('pageerror', e => erros.push(`exceçao: ${e.message}`));

let passo = 0;
const ok = (msg) => console.log(`  ${String(++passo).padStart(2)}. OK   ${msg}`);

async function morrer(etapa, erro) {
  console.error(`\n  FALHOU em: ${etapa}`);
  console.error(`  ${erro?.message ?? erro}\n`);
  await salvarEvidencia(page, { erros });
  await browser.close();
  process.exit(1);
}

const main = page.locator('main');

console.log(`\n  Fluxos autenticados em ${BASE}\n`);

try {
  // ── 1. Login ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(SENHA);
  // `// ENTRAR` exato: a aba "Entrar" do topo do card também casaria com
  // /entrar/i, e o Playwright recusa seletor ambíguo (ainda bem).
  await page.getByRole('button', { name: '// ENTRAR' }).click();

  await conferirPortaoDeEntrada(page, ok);

  // O composer só monta depois de a sessão resolver, o perfil carregar e o
  // chunk do feed baixar. Ele aparecer prova três coisas de uma vez: sessão
  // válida, perfil existe, conta não suspensa (se estivesse, o
  // `SuspendedNotice` tomaria o lugar do formulário).
  // Antes de esperar o composer: se a conta estiver banida, a BannedScreen
  // cobre tudo e o timeout diria 'o composer nao apareceu' em vez da causa.
  await page.waitForTimeout(2500);
  await recusarSeBanido(page);
  await page.locator('#post-title').waitFor({ state: 'visible', timeout: 30000 });
  ok('entrou e o composer apareceu (sessão + perfil + conta liberada)');

  // ── 2. Todas as rotas internas, com conteúdo de verdade ─────────────────
  for (const rota of ROTAS_LOGADO) {
    await page.goto(BASE + rota.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Conferido dentro do <main>: a Sidebar repete o nome de quase toda rota
    // no menu, então procurar no body inteiro passaria com a página vazia.
    // Exceção: a tela de 404 fica fora do Layout e não tem `<main>`.
    const escopo = rota.foraDoLayout ? page.locator('body') : main;
    await escopo.getByText(rota.esperado).first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .catch(() => {
        throw new Error(`${rota.path} não mostrou ${rota.esperado} em `
          + `${rota.foraDoLayout ? '<body>' : '<main>'}`);
      });
    ok(`${rota.nome.padEnd(15)} ${rota.path}`);
  }

  // ── 3. Rotas de staff NEGADAS para conta comum ──────────────────────────
  for (const rota of ROTAS_PROIBIDAS_PARA_USUARIO) {
    await page.goto(BASE + rota.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500); // dá tempo do guard redirecionar/esvaziar
    const texto = await main.innerText();
    const vazou = MARCAS_DE_PAINEL.find(re => re.test(texto));
    if (vazou) throw new Error(`${rota.path} mostrou conteúdo de staff (${vazou}) para role = 'user'`);
    ok(`${rota.nome.padEnd(15)} ${rota.path} negado para conta comum`);
  }

  // ── `[03/09]` O fundo do site logado está mesmo NA TELA ─────────────────
  //
  // A trava existe por uma falha de três rodadas. O dono relatou três vezes
  // "não estou vendo as peças de videogame". As duas primeiras respostas minhas
  // foram calibragem de opacidade — erradas —, porque eu conferia num recorte
  // HTML meu que usava `animation: none` para fotografar as peças paradas.
  // Eu testava a aparência DESLIGANDO exatamente o que estava quebrado.
  //
  // A causa real: `.peca-de-jogo` não tinha `top`, então cada peça nascia no
  // TOPO do container e a animação a empurrava para fora por cima. Medido:
  // 3 de 4 fora da tela no instante zero, as quatro em 3 segundos.
  //
  // Nada acusava. Não é erro de JS, não é rota fora do ar, não é texto ausente
  // — é decoração que existe no DOM e não está onde alguém possa ver. É a mesma
  // família do `conteudo-visivel.mjs` (§1.5), só que na área logada, que aquele
  // não alcança porque exige sessão.
  //
  // A pergunta que ela faz é a única que importa aqui: **quantas peças estão
  // dentro da janela?**
  const pecasNaTela = await page.evaluate(() => {
    const todas = [...document.querySelectorAll('.peca-de-jogo')];
    const dentro = todas.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight
          && r.right > 0 && r.left < window.innerWidth;
    });
    return { total: todas.length, dentro: dentro.length };
  });

  if (pecasNaTela.total === 0) {
    throw new Error(
      'nenhuma `.peca-de-jogo` no DOM do site logado.\n'
      + '    O `FundoDaSecao` parou de montar as pecas — ou o elenco da rota\n'
      + '    ficou vazio (ver `elencoDaSecao` em src/lib/acentoDaSecao.js).');
  }
  if (pecasNaTela.dentro === 0) {
    throw new Error(
      `as ${pecasNaTela.total} pecas existem no DOM e NENHUMA esta dentro da janela.\n`
      + '    Foi exatamente este o bug de 01-03/09: sem `top`, a peca nasce no\n'
      + '    topo do container e a animacao a empurra para fora por cima.\n'
      + '    Decoracao invisivel nao estoura, nao loga e nao quebra teste nenhum —\n'
      + '    o dono precisou relatar tres vezes. Confira `.peca-de-jogo` no\n'
      + '    src/index.css e o keyframe `pecaFlutua`.');
  }
  ok(`fundo do site logado  ${pecasNaTela.dentro}/${pecasNaTela.total} pecas na tela`);

  // ── 4. O ciclo de vida de um post ───────────────────────────────────────
  //
  // `[24/09]` Saiu para o `cicloDoPost.mjs`: publicar, curtir, comentar,
  // responder, apagar e varrer sobras. Este roteiro ficou com a SESSÃO —
  // entrar, alcançar cada rota, ser negado no painel e sair — e os próximos
  // fluxos de conteúdo que faltam cabem lá, não aqui (§4).
  await percorrerCicloDoPost(page, { base: BASE, marca: MARCA, ok, main });

  // ── 5. Sair ─────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^Sair$/i }).click();
  // Sem sessão, a rota `/` volta a ser a Landing — que não tem `#post-title`.
  await page.locator('#post-title').waitFor({ state: 'detached', timeout: 20000 });
  ok('logout derrubou a sessão');
} catch (e) {
  await morrer(`passo ${passo + 1}`, e);
}

// Exceção de JS em qualquer ponto reprova, mesmo com todos os passos verdes:
// tela que funciona estourando erro no console é bug esperando escalar.
if (erros.length) {
  console.error(`\n  Passos OK, mas houve exceçao de JS: ${erros.join(' | ')}\n`);
  await salvarEvidencia(page, { erros });
  await browser.close();
  process.exit(1);
}

console.log(`\n  ${passo}/${passo} passos OK\n`);
await browser.close();
