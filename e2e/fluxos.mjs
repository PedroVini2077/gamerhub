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
import { publicarEEsperarNoFeed } from './publicarPost.mjs';
import { ROTAS_LOGADO, ROTAS_PROIBIDAS_PARA_USUARIO, MARCAS_DE_PAINEL } from './rotas.mjs';

const BASE  = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_PASSWORD;

// Título único por execução: nunca mexe num post que não seja o desta rodada,
// mesmo se uma execução anterior tiver morrido no meio.
const MARCA  = `[e2e ${Date.now()}]`;
const TITULO = `${MARCA} post automatico`;
const CORPO  = 'Publicado pelo teste automatizado. Se este post ficou no ar, o E2E falhou na limpeza.';

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

  // ── 4. Publicar → conferir → apagar ─────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // O post aparecendo no feed prova a ida INTEIRA: o INSERT passou pela RLS,
  // os triggers rodaram sem estourar, e o feed releu.
  //
  // `[02/09]` O passo virou helper compartilhado com o `painel-admin.mjs` — as
  // duas copias eram identicas, e as duas precisavam da mesma melhoria: dizer
  // O QUE A TELA DISSE quando o post nao aparece.
  await publicarEEsperarNoFeed(page, { marca: MARCA, titulo: TITULO, corpo: CORPO });
  const tituloNoFeed = page.locator('h2', { hasText: MARCA });
  ok('post publicado e visível no feed');

  // `.card` é a raiz do PostCard: garante que o botão é o do post desta
  // execução, nunca o de um vizinho.
  const card = page.locator('.card').filter({ has: tituloNoFeed });
  await card.getByRole('button', { name: 'Deletar post' }).click();
  await page.getByRole('button', { name: /^Deletar$/ }).click();

  // A exclusão só acontece quando a contagem de 5s zera (janela pra cancelar).
  // A conta de teste é `role = 'user'`: para ela o post soft-deletado some do
  // feed. Para admin ele continuaria visível com o aviso "Post excluído" — por
  // isso o passo 3 existe e por isso o E2E não pode rodar com conta de staff.
  await tituloNoFeed.first().waitFor({ state: 'detached', timeout: 30000 });
  ok('post apagado e fora do feed depois da contagem');

  // ── 4b. NENHUM post de teste sobrando de execuções anteriores ────────────
  //
  // `[01/09]` Padrão de falha meu, catalogado: "crio dado de teste que confunde
  // o dono". Já aconteceu duas vezes — uma fila de moderação com itens falsos
  // marcados como se a IA tivesse detectado, e um post de e2e que ficou no ar
  // porque o teste morreu antes do passo que apaga.
  //
  // Até agora a única defesa era eu lembrar de conferir. Isto passa a olhar
  // sozinho: se o feed tiver marca `[e2e` que não seja a desta execução, é
  // lixo de uma rodada que quebrou no meio.
  //
  // Por que aqui e não num script próprio: só uma conta LOGADA enxerga o feed
  // (o anônimo leva 401), e este é o único teste que tem sessão.
  const sobras = await main.locator('h2').filter({ hasText: /\[e2e / })
    .filter({ hasNotText: MARCA }).count();
  if (sobras > 0) {
    throw new Error(
      `${sobras} post(s) de teste sobrando no feed de execucoes anteriores.\n`
      + '  Alguma rodada morreu antes do passo que apaga, e o lixo ficou no ar\n'
      + '  para quem usa o site. Apague pelo painel admin (aba Posts) e veja\n'
      + '  POR QUE aquela rodada quebrou — o post sobrando e o sintoma, nao a causa.');
  }
  ok('nenhum post de teste sobrando de execuções anteriores');

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
