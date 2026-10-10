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
import { publicarEEsperarNoFeed, marcaDeTeste } from './publicarPost.mjs';

import { MARCAS_DE_PAINEL } from './rotas.mjs';
import { conferirAbasDoPainel } from './painel-admin/abasDoPainel.mjs';
import { conferirAbaDeNews } from './painel-admin/abaDeNews.mjs';

const BASE  = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const EMAIL = process.env.E2E_STAFF_EMAIL;
const SENHA = process.env.E2E_STAFF_PASSWORD;

// As abas que um `admin` (rank 1) enxerga. `Cargos` e `Super Admin` ficam de
// fora de propósito: elas só existem para `super_admin` e `owner`, e esperá-las
// aqui transformaria a hierarquia correta em falha de teste.
const ABAS = ['Usuários', 'Posts', 'News', 'Moderação', 'Mod de Lives', 'Keys & Promos', 'Notificações', 'Logs'];

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
  await salvarEvidencia(page, { erros, causa: `${etapa}: ${erro?.message ?? erro}` });
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
  // `[26/09]` Era o `#post-title` do compositor. Ele saiu do feed (publicar
  // virou rota), e a linha que ficou prova as MESMAS tres coisas: ela devolve
  // `null` sem usuario e `null` para quem esta suspenso.
  await page.locator('[data-publicar="linha"]').waitFor({ state: 'visible', timeout: 30000 });

  // ── `[02/09]` O TESTE PASSA A CRIAR O PRÓPRIO DADO ───────────────────────
  //
  // Antes ele media o BANCO, não o painel: em 30/08 reprovou porque o dono
  // esvaziou a lixeira e o site ficou sem post nenhum — defeito zero, CI
  // vermelho. O remendo da época distinguia "seletor quebrou" de "site vazio",
  // e mantinha a trava viva, mas a paginação só era exercitada quando alguém
  // por acaso tivesse postado.
  //
  // Criando o próprio post, a aba Posts sempre tem o que listar, e o teste
  // volta a provar o que promete. É o mesmo padrão do `fluxos.mjs`.
  const MARCA_PAINEL = marcaDeTeste('[painel ');
  // `[02/09]` Passou a usar o helper compartilhado. Antes, quando este passo
  // falhava, a mensagem era só "waiting for locator(...)" — o que nao
  // aconteceu, e nada sobre por que. O helper vigia os avisos da tela enquanto
  // espera e os devolve na falha.
  await publicarEEsperarNoFeed(page, {
    marca: MARCA_PAINEL,
    titulo: `${MARCA_PAINEL} post do teste`,
    corpo: 'Criado pelo teste do painel para a aba Posts ter conteudo proprio. '
         + 'Se este post ficou no ar, o teste falhou antes da limpeza.',
  });
  ok('post próprio criado para a aba Posts ter o que listar');
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

  // ── 3. As abas renderizam, e a de Posts lista ─────────────────────────────
  //
  // `[10/10]` O bloco saiu para `painel-admin/abasDoPainel.mjs` no corte de
  // 449 linhas: é o maior do roteiro e tem vida própria — oito abas, o
  // contador de linhas e a paginação.
  await conferirAbasDoPainel({ page, aba, ok, ABAS });

  // ── 4. A hierarquia segura para cima ──────────────────────────────────────
  // O `fluxos.mjs` prova que `user` não entra no /admin. Falta a outra metade:
  // `admin` também não pode subir até o /owner. Sem isto, uma regressão que
  // desse poder de owner a qualquer staff passaria despercebida.
  // ── A aba NEWS ────────────────────────────────────────────────────────────
  //
  // `[10/10]` Saiu para `painel-admin/abaDeNews.mjs` no mesmo corte.
  await conferirAbaDeNews({ page, aba, ok, marcaDeTeste });
  // ── Limpeza: o post do teste não pode ficar no ar ────────────────────────
  //
  // Vem ANTES do /owner de propósito: se o painel do dono falhar, o post já
  // saiu. Lixo de teste em produção já confundiu o dono duas vezes, e é um
  // padrão de falha catalogado meu.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const meuPost = page.locator('h2', { hasText: MARCA_PAINEL });
  await meuPost.first().waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('.card').filter({ has: meuPost })
    .getByRole('button', { name: 'Deletar post' }).click();
  await page.getByRole('button', { name: /^Deletar$/ }).click();
  await meuPost.first().waitFor({ state: 'detached', timeout: 30000 });
  ok('post do teste apagado');

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
