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
  const linhas = () => page.locator('main [data-post-row]').count();

  // `[29/08]` O SELETOR É CONFERIDO ANTES DE QUALQUER COISA, e esta linha é a
  // correção de um teste que passou meses mentindo.
  //
  // O contador usava `main tbody tr, main [data-post-row]`. Nenhum dos dois
  // casava: a lista de posts é de `<div class="card">`, não de tabela, e o
  // atributo não existia no componente. O contador dava ZERO — sempre.
  //
  // E ninguém percebeu porque o ramo de baixo (`else`) era o que rodava: com
  // menos de uma página de posts o botão "Carregar mais" nem aparece, e o teste
  // registrava "sem botao" como SUCESSO. Ele passava sem nunca ter contado uma
  // linha na vida. Quando o banco passou de 20 posts, o botão surgiu e a
  // asserção caiu com `0 linhas antes, 0 depois`.
  //
  // Exigir linhas ANTES de olhar o botão fecha esse esconderijo: com ou sem
  // paginação, o teste agora prova que sabe enxergar um post.
  // `[30/08]` ZERO TEM DUAS CAUSAS OPOSTAS, e confundi-las custou um CI
  // vermelho por motivo nenhum.
  //
  // Em 30/08 este teste reprovou com o site legitimamente VAZIO: o dono tinha
  // esvaziado a lixeira ("20 posts da lixeira apagados permanentemente"), e o
  // painel mostrava "Nenhum post ativo" — funcionando perfeitamente. O teste
  // dependia de existir dado em PRODUÇÃO, e alarme que grita à toa ensina a
  // ignorar o canal (§0.2, 4ª regra).
  //
  // Mas aceitar zero de graça reabriria o buraco descrito acima. A saída é
  // perguntar ao PRÓPRIO PAINEL quantos posts ele diz ter:
  //
  //   declara N > 0 e não acho linha   -> seletor quebrou. FALHA (a trava original)
  //   declara 0 (ou nada) e mostra vazio -> site vazio. O painel está certo
  //   não mostra o vazio e não há linha  -> a aba não renderizou. FALHA
  //
  // `declarados <= 0` e não `=== 0` porque com o site vazio o painel não
  // imprime número nenhum ao lado de "Posts ativos" — o regex devolve -1. Ler
  // isso como "declara zero" seria chute; aqui é o oposto: ausência de número
  // só passa ACOMPANHADA do estado vazio explícito na tela.
  //
  // Assim a trava continua pegando a regressão de seletor sempre que houver
  // dado, e para de mentir quando não houver.
  const linhasVisiveis = await linhas();
  const textoAba = await page.locator('main').innerText();
  const declarados = Number(textoAba.match(/Posts ativos\s*(\d+)/)?.[1] ?? -1);
  const mostraVazio = /nenhum post ativo/i.test(textoAba);

  if (linhasVisiveis === 0 && declarados <= 0 && mostraVazio) {
    ok('aba Posts: site sem post ativo, e o painel mostra o estado vazio');
    console.log('           (a paginacao nao pode ser exercitada sem dado — '
      + 'a trava do seletor volta a valer assim que houver post)');
  } else if (linhasVisiveis === 0) {
    throw new Error(
      'nenhuma linha de post encontrada com [data-post-row], e o painel NAO '
      + `esta no estado vazio (ele declara ${declarados} post(s) ativo(s), `
      + `estado vazio na tela: ${mostraVazio}).\n`
      + '  Ou a aba nao carregou, ou o atributo saiu do PostsPanel — e sem ele '
      + 'o teste de paginacao passa a contar zero e vira decoracao.');
  } else {
    ok(`aba Posts lista ${linhasVisiveis} post(s)`);
  }

  // `[29/08]` MEDE O TOTAL CARREGADO, e não as linhas visíveis. Segunda
  // correção do mesmo teste, e a causa é diferente da primeira.
  //
  // A aba Posts tem duas sub-abas — "Posts ativos" e "Lixeira" — e mostra só
  // uma por vez. Na época, a paginação NÃO era por sub-aba: `fetchAll` trazia
  // os 20 posts mais recentes MISTURADOS, e `loadMorePosts` os próximos 20,
  // também misturados.
  //
  // Resultado observado no CI: 8 ativos, 14 na lixeira. O botão aparecia porque
  // faltavam posts a carregar, mas os que vinham eram antigos — e antigos aqui
  // estão quase todos apagados. A lista de ATIVOS não mudava, e contar só ela
  // dava "8 antes, 8 depois" com a paginação funcionando perfeitamente.
  //
  // AINDA NO MESMO DIA a causa de fundo foi corrigida: cada sub-aba passou a
  // paginar a si mesma (`lib/paginacaoDePosts.js`), então hoje o contador da
  // sub-aba visível também cresceria. A soma FICA assim mesmo por dois motivos:
  // ela continua verdadeira nos dois desenhos, e é a medida do que o botão de
  // fato altera — quantos posts o painel tem em mãos.
  const totalCarregado = async () => {
    const txt = await page.locator('main').innerText();
    const ativos = Number(txt.match(/Posts ativos\s*(\d+)/)?.[1] ?? -1);
    const lixeira = Number(txt.match(/Lixeira\s*(\d+)/)?.[1] ?? -1);
    if (ativos < 0 || lixeira < 0) {
      throw new Error(
        'nao consegui ler os contadores das sub-abas ("Posts ativos" / '
        + '"Lixeira"). Se os rotulos mudaram, atualize este teste — sem eles a '
        + 'medicao da paginacao volta a ser cega.');
    }
    return ativos + lixeira;
  };

  if (await carregarMais.count() > 0) {
    const antes = await totalCarregado();
    await carregarMais.click();
    await page.waitForTimeout(3000);
    const depois = await totalCarregado();
    if (depois <= antes) {
      throw new Error(
        `"Carregar mais" nao trouxe nada: ${antes} posts carregados antes, `
        + `${depois} depois. O botao existe mas a paginacao parou de funcionar.`);
    }
    ok(`paginacao de posts funciona (${antes} -> ${depois} posts carregados)`);
  } else {
    // Menos posts que uma página inteira: não há o que paginar, e exigir o
    // botão aqui transformaria "banco pequeno" em teste vermelho. Mas agora
    // este ramo só é alcançado depois de o teste ter contado linhas de verdade.
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
