/**
 * E2E do painel de administração — o único caminho do site sem cobertura de
 * navegador até 28/08/2026.
 *
 * ── Por que ele faltava ─────────────────────────────────────────────────────
 *
 * O `fluxos.mjs` loga com uma conta comum **de propósito**: é assim que ele
 * prova que `/admin` e `/owner` são NEGADOS. Promover aquela conta destruiria
 * a prova. Consequência: o painel inteiro — moderação, logs, usuários — nunca
 * era aberto por um navegador de verdade, e era justamente ali que estava a
 * moderação de comentário quebrada por meses sem ninguém notar.
 *
 * Este arquivo fecha esse buraco com uma SEGUNDA conta, de cargo `admin`.
 *
 * ── Por que ele é somente leitura, e isso não é preguiça ────────────────────
 *
 * Uma conta `admin` automatizada rodando em todo PR pode ocultar post,
 * suspender gente e resolver fila. Um teste com esse poder, se der errado no
 * meio, deixa estrago em dados reais — e rodando a cada push, "se der errado"
 * é questão de tempo.
 *
 * Então aqui ele só ABRE e LÊ. Cada aba tem que renderizar de verdade. As ações
 * destrutivas continuam validadas onde é seguro validá-las: em transação com
 * `ROLLBACK` (ver `db/*.md`), onde nada sobrevive ao teste.
 *
 * ── O que ele prova ─────────────────────────────────────────────────────────
 *
 *   1. `admin` ENTRA no `/admin` — o portão deixa passar quem deve;
 *   2. as sete abas do painel renderizam conteúdo, não só montam;
 *   3. `admin` é NEGADO no `/owner` — a hierarquia é real num navegador, e não
 *      só em teoria. É a metade que faltava: o `fluxos.mjs` prova que `user`
 *      não entra; este prova que `admin` também não sobe além do dele.
 *
 * Uso:  npm run build && npx vite preview --port 4173 &  →  node e2e/painel-admin.mjs
 * Exige E2E_STAFF_EMAIL e E2E_STAFF_PASSWORD (conta de cargo `admin`).
 */
import { abrirNavegador, exigirServidor, salvarEvidencia, recusarSeBanido } from './util.mjs';

import { MARCAS_DE_PAINEL } from './rotas.mjs';

const BASE  = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const EMAIL = process.env.E2E_STAFF_EMAIL;
const SENHA = process.env.E2E_STAFF_PASSWORD;

// As abas que um `admin` (rank 1) enxerga. `Cargos` e `Super Admin` ficam de
// fora de propósito: elas só existem para `super_admin` e `owner`, e esperá-las
// aqui transformaria a hierarquia correta em falha de teste.
const ABAS = ['Usuários', 'Posts', 'Moderação', 'Mod de Lives', 'Keys & Promos', 'Notificações', 'Logs'];

/**
 * A aba do painel, e SÓ ela.
 *
 * `getByRole('button', { name: /Notificações/ })` casava com o SINO do
 * cabeçalho, que vem antes no DOM — então `.first()` pegava o sino. O teste
 * "aba Notificações renderizou" passava sem nunca abrir a aba: ele abria o
 * dropdown do sino, e o `<main>` continuava com o conteúdo da aba anterior,
 * satisfazendo a verificação de tamanho. Teste que passa pelo motivo errado é
 * pior que teste nenhum, e este só foi desmascarado quando o dropdown aberto
 * passou a bloquear o clique seguinte.
 *
 * O que separa os dois sem ambiguidade é o `aria-pressed`: só as abas do
 * `AdminTabs` o têm. O sino não.
 */
const aba = (page, nome) =>
  page.locator('button[aria-pressed]').filter({ hasText: nome }).first();

if (!EMAIL || !SENHA) {
  console.error('\n  E2E_STAFF_EMAIL e E2E_STAFF_PASSWORD nao definidos.');
  console.error('  Este teste precisa de uma conta com cargo admin.\n');
  process.exit(2);
}

await exigirServidor(BASE);
const browser = await abrirNavegador();
const page = await (await browser.newContext()).newPage();

const erros = [];
page.on('pageerror', e => erros.push(`excecao: ${e.message}`));

let passo = 0;
const ok = (msg) => console.log(`  ${String(++passo).padStart(2)}. OK   ${msg}`);

async function morrer(etapa, erro) {
  console.error(`\n  FALHOU em: ${etapa}`);
  console.error(`  ${erro?.message ?? erro}\n`);
  if (erros.length) console.error('  excecoes de JS:', erros.join(' | '), '\n');
  await salvarEvidencia(page, { erros });
  await browser.close();
  process.exit(1);
}

try {
  // ── 1. Login ──────────────────────────────────────────────────────────────
  // Seletores idênticos aos do `fluxos.mjs` de propósito: aquele já roda verde
  // no CI há semanas, então copiar dali é copiar o que está provado. Inventar
  // seletor novo aqui só criaria uma segunda forma de quebrar.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(SENHA);
  // `// ENTRAR` exato: a aba "Entrar" do topo do card também casaria com
  // /entrar/i, e o Playwright recusa seletor ambíguo.
  await page.getByRole('button', { name: '// ENTRAR' }).click();
  // O composer só monta depois de a sessão resolver e o perfil carregar.
  // Antes de esperar o composer: se a conta estiver banida, a BannedScreen
  // cobre tudo e o timeout diria 'o composer nao apareceu' em vez da causa.
  await page.waitForTimeout(2500);
  await recusarSeBanido(page);
  await page.locator('#post-title').waitFor({ state: 'visible', timeout: 30000 });
  ok('login com a conta de staff (sessão + perfil)');

  // ── 2. O painel abre ──────────────────────────────────────────────────────
  //
  // Atenção ao mecanismo, porque ele não é intuitivo: **não existe tela de
  // "acesso negado"**. O guard simplesmente não renderiza o conteúdo, e o
  // `<main>` fica vazio. Por isso a asserção é pela PRESENÇA das marcas de
  // painel (as mesmas de `rotas.mjs`, que o `fluxos.mjs` usa ao contrário para
  // provar que `user` não as vê).
  //
  // A primeira versão deste arquivo procurava o texto "Área restrita" como
  // sinal de negação — e "Área restrita. Acesso controlado por hierarquia." é
  // o SUBTÍTULO do painel funcionando. O teste teria reprovado o sucesso.
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // sessão + perfil + chunk do painel

  const textoAdmin = await page.locator('main').innerText();
  const marca = MARCAS_DE_PAINEL.find(re => re.test(textoAdmin));
  if (!marca) {
    throw new Error(
      'o /admin nao mostrou nenhuma marca de painel para uma conta `admin`. '
      + 'Ou a conta perdeu o cargo, ou o portao passou a exigir cargo maior. '
      + `Texto visto: ${JSON.stringify(textoAdmin.slice(0, 200))}`);
  }
  ok('/admin acessivel para cargo admin');

  // ── 3. As abas renderizam ─────────────────────────────────────────────────
  for (const nomeDaAba of ABAS) {
    try {
      await aba(page, nomeDaAba).click({ timeout: 15000 });
      // Espera algo além do esqueleto: a aba tem que produzir conteúdo.
      await page.waitForFunction(
        () => document.querySelector('main')?.innerText.trim().length > 80,
        { timeout: 15000 });
      ok(`aba "${nomeDaAba}" renderizou`);
    } catch (e) {
      await morrer(`abrir a aba "${nomeDaAba}"`, e);
    }
  }

  // ── 3b. Paginação e notificações ──────────────────────────────────────────
  //
  // Estas duas ficaram de fora da primeira versão, e a falta delas apareceu na
  // hora errada: ao planejar a migração do `useAdminData` para React Query,
  // ficou claro que as partes mais arriscadas — a paginação com estado local
  // (`loadMorePosts`/`loadMoreKeys`) e o canal lateral que escreve as
  // notificações no estado do pai — eram exatamente as que NENHUM teste tocava.
  //
  // Refatorar camada de dados sem cobrir as duas seria refatorar no escuro.
  // Continua tudo somente leitura: clicar em "Carregar mais" só busca mais
  // linhas, não altera nada.

  // Paginação: a lista tem que CRESCER. Contar antes e depois é o que separa
  // "o botão existe" de "o botão funciona" — um `onClick` quebrado deixaria o
  // botão lá, clicável, sem trazer nada.
  await aba(page, 'Posts').click();
  await page.waitForTimeout(2000);
  const carregarMais = page.getByRole('button', { name: /carregar mais/i }).first();
  if (await carregarMais.count() > 0) {
    const linhas = () => page.locator('main tbody tr, main [data-post-row]').count();
    const antes = await linhas();
    await carregarMais.click();
    await page.waitForTimeout(3000);
    const depois = await linhas();
    if (depois <= antes) {
      throw new Error(
        `"Carregar mais" nao trouxe nada: ${antes} linhas antes, ${depois} depois. `
        + 'O botao existe mas a paginacao parou de funcionar.');
    }
    ok(`paginacao de posts funciona (${antes} -> ${depois} linhas)`);
  } else {
    // Menos posts que uma página inteira: não há o que paginar, e exigir o
    // botão aqui transformaria "banco pequeno" em teste vermelho.
    ok('paginacao de posts: sem botao (menos de uma pagina de posts)');
  }

  // Notificações: elas não vêm de uma consulta própria — são escritas no estado
  // do painel pelo `useAdminData`, num canal lateral. Se esse fio se romper, a
  // aba fica eternamente vazia sem erro nenhum.
  await aba(page, 'Notificações').click();
  await page.waitForTimeout(2500);
  const textoNotifs = await page.locator('main').innerText();
  if (!/nenhuma notificação ainda/i.test(textoNotifs) && textoNotifs.trim().length < 120) {
    throw new Error(
      'a aba de Notificacoes nao mostrou nem notificacao nem o texto de lista vazia. '
      + 'O canal que alimenta as notificacoes provavelmente se rompeu.');
  }
  ok('aba de Notificacoes com estado definido (lista ou vazio explicito)');

  // ── 4. A hierarquia segura para cima ──────────────────────────────────────
  // O `fluxos.mjs` prova que `user` não entra no /admin. Falta a outra metade:
  // `admin` também não pode subir até o /owner. Sem isto, uma regressão que
  // desse poder de owner a qualquer staff passaria despercebida.
  await page.goto(`${BASE}/owner`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // dá tempo do guard esvaziar a tela
  const textoOwner = await page.locator('main').innerText();
  if (/painel do fundador/i.test(textoOwner)) {
    throw new Error(
      'uma conta `admin` abriu o Painel do Fundador. A hierarquia quebrou: '
      + 'admin (rank 1) nao pode alcancar a area do owner (rank 3).');
  }
  ok('/owner negado para cargo admin');

  // ── 5. Sem exceção de JavaScript em nenhuma tela ──────────────────────────
  if (erros.length) throw new Error(`excecoes de JS no painel: ${erros.join(' | ')}`);
  ok('nenhuma excecao de JavaScript no painel');

  console.log(`\n  ${passo}/${passo} passos do painel de admin\n`);
  await browser.close();
} catch (e) {
  await morrer('painel de admin', e);
}
