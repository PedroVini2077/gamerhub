/**
 * `[02/10]` COMUM × MODERADOR na mesma tela — e os três fluxos que isso cobre.
 *
 * ── Por que é UM roteiro e não três ──────────────────────────────────────
 *
 * A lista dele de 18/09 pedia quatro coisas, e três delas **são o mesmo
 * cenário**. Isso não foi escolha de economia: foi o que a medição mostrou.
 *
 *   notificação na tela  os três gatilhos pulam o próprio autor
 *                        (`v_owner = NEW.user_id -> return NEW`, lido em
 *                        `pg_proc`). Conta nenhuma se notifica sozinha.
 *   depois de OCULTAR    `canReport = user.id !== post.user_id`: o autor não
 *                        denuncia o próprio post, então a fila precisa de
 *                        alguém de fora.
 *   comum × moderador    duas contas, por definição.
 *
 * Três roteiros separados fariam seis logins para exercitar o mesmo par.
 *
 * ── A pergunta que ele fez, e que este roteiro responde ─────────────────
 *
 * *"Não considere 'a função/RLS/trigger está correta' equivalente a 'o fluxo
 * do GamerHub está seguro'."* Cada peça daqui já tem teste em ROLLBACK. O que
 * nenhum deles responde é se as peças, ligadas, produzem o que a pessoa vê.
 *
 * ── A limpeza é PROVADA, e aqui ela é obrigação dupla ───────────────────
 *
 * O roteiro escreve em produção com DUAS contas, e o que ele cria é visível
 * para gente de verdade: um post no feed, uma denúncia na fila da equipe, uma
 * notificação no sino de alguém. Cada passo tem o seu desfazer, e o fim
 * CONFERE que desfez.
 *
 * O post é apagado pela conta que o criou; a ocultação é desfeita pelo painel
 * (a inversa que nasceu hoje — ver `handleMostrarPost`); as notificações são
 * marcadas como lidas, e a faxina das 04:00 as recolhe em 30 dias.
 *
 * ── O que ele NÃO cobre, dito com todas as letras ───────────────────────
 *
 * Banimento e suspensão. São destrutivos sobre uma conta, a inversa deles
 * depende de hierarquia, e um roteiro que morre no meio deixaria a conta de
 * teste banida — o que derruba TODOS os outros roteiros. Continuam validados
 * em transação com ROLLBACK, onde nada sobrevive.
 *
 * Uso:  npm run build && npx vite preview --port 4173 &  →  node e2e/duasContas.mjs
 * Exige E2E_EMAIL/E2E_PASSWORD (conta comum) e E2E_STAFF_EMAIL/E2E_STAFF_PASSWORD.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia, entrar, sair } from './util.mjs';
import { publicarEEsperarNoFeed, marcaDeTeste } from './publicarPost.mjs';
import { comentarEEsperarNaLista } from './comentar.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const COMUM = { email: process.env.E2E_EMAIL, senha: process.env.E2E_PASSWORD };
const STAFF = { email: process.env.E2E_STAFF_EMAIL, senha: process.env.E2E_STAFF_PASSWORD };

if (!COMUM.email || !COMUM.senha || !STAFF.email || !STAFF.senha) {
  console.error('\n  Este roteiro precisa das DUAS contas:');
  console.error('    E2E_EMAIL / E2E_PASSWORD         (conta comum, autora do post)');
  console.error('    E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD  (cargo admin, modera)\n');
  process.exit(2);
}

const MARCA = marcaDeTeste('[e2e ');

await exigirServidor(BASE);
const browser = await abrirNavegador();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const erros = [];
page.on('pageerror', (e) => erros.push(`exceçao: ${e.message}`));

let passo = 0;
const ok = (m) => console.log(`  ${String(++passo).padStart(2)}. OK   ${m}`);

console.log(`\n  Comum x moderador em ${BASE}\n`);

/** O que precisa ser desfeito, na ORDEM INVERSA de como foi feito. */
const aDesfazer = [];

try {
  // ── 1. A conta COMUM publica ────────────────────────────────────────────
  await entrar(page, BASE, COMUM.email, COMUM.senha);
  ok('entrou como conta comum');

  await publicarEEsperarNoFeed(page, {
    titulo: `${MARCA} post que vai ser moderado`,
    corpo: 'Post criado pelo roteiro de duas contas. Ele é ocultado, mostrado de novo e apagado.',
    marca: MARCA,
  });
  aDesfazer.push('o post da conta comum');
  ok('conta comum publicou');

  await sair(page);

  // ── 2. O STAFF curte e comenta — é isto que GERA a notificação ─────────
  await entrar(page, BASE, STAFF.email, STAFF.senha);
  ok('entrou como staff');

  const cartao = page.locator('article, [data-post]', { hasText: MARCA }).first();
  await cartao.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    throw new Error(
      `o staff nao enxerga o post ${MARCA} no feed.\n`
      + '    Ou o feed nao carregou, ou a conta comum nao publicou de verdade —\n'
      + '    e o passo anterior so provou que o TITULO apareceu para ela.');
  });

  await cartao.getByRole('button', { name: /^(Curtir|Descurtir) — \d+ curtida\(s\)$/ }).click();
  ok('staff curtiu o post da conta comum');

  await comentarEEsperarNaLista(page, { card: cartao, texto: `${MARCA} comentario do staff` });
  ok('staff comentou — as duas notificações estão geradas');

  // ── 3. DENUNCIAR: é o que coloca o item na fila ────────────────────────
  //
  // O autor não pode denunciar o próprio post (`canReport`), e sem denúncia
  // não existe item na fila — ou seja, não existe caminho de UI para ocultar.
  await cartao.getByRole('button', { name: 'Denunciar post' }).click();
  const modal = page.locator('[role="dialog"], .fixed').filter({ hasText: /Denunciar/ }).first();
  await modal.getByRole('radio').first().check();
  await modal.getByRole('button', { name: /^Denunciar$/ }).click();
  await modal.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {
    throw new Error('o modal de denuncia nao fechou — a denuncia pode nao ter sido gravada');
  });
  aDesfazer.push('a denúncia na fila de moderação (ela sai sozinha ao resolver o item)');
  ok('staff denunciou o post');

  // ── 4. OCULTAR pela fila ───────────────────────────────────────────────
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: 'Moderação', exact: true }).click();

  const naFila = page.locator('.card', { hasText: MARCA }).first();
  await naFila.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    throw new Error(
      `o post ${MARCA} nao apareceu na fila de moderacao.\n`
      + '    A denuncia foi gravada (o modal fechou), entao ou o trigger que\n'
      + '    enfileira nao disparou, ou a fila so lista `pending` e o item ja\n'
      + '    nasceu com outro status. Confira `moderation_queue`.');
  });

  await naFila.getByRole('combobox', { name: 'Ação de moderação' }).selectOption('hide');
  await naFila.getByRole('button', { name: /Confirmar ocultação/ }).click();
  aDesfazer.push('o post OCULTADO — desfaz em /admin > Posts > botao "Mostrar post"');
  ok('staff ocultou o post pela fila');

  // ── 5. O post SUMIU do feed ────────────────────────────────────────────
  //
  // Esta é a assertiva que nenhum teste de RLS dá: a policy pode estar certa e
  // a tela continuar mostrando, porque a lista veio de um cache do React Query.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  if (await page.locator('h2', { hasText: MARCA }).count()) {
    throw new Error(
      `o post ${MARCA} foi ocultado e CONTINUA no feed.\n`
      + '    `hidden_at` esta preenchido (a fila aceitou), entao ou a consulta do\n'
      + '    feed parou de filtrar `hidden_at`, ou a tela serviu cache sem\n'
      + '    revalidar depois da moderacao.');
  }
  ok('o post ocultado sumiu do feed');

  // ── 6. MOSTRAR de novo — a inversa que nasceu em 02/10 ─────────────────
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: 'Posts', exact: true }).click();

  const noPainel = page.locator('.card', { hasText: MARCA }).first();
  await noPainel.waitFor({ state: 'visible', timeout: 30000 });
  await noPainel.getByText('Oculto').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
    throw new Error('o painel nao marca o post como "Oculto" — o selo sumiu da lista');
  });

  await noPainel.getByTitle(/Mostrar post/).click().catch(() => {
    throw new Error(
      'o botao "Mostrar post" nao existe para um post OCULTO.\n'
      + '    Esta e a inversa de ocultar, e sem ela `restoreContent` volta a ser\n'
      + '    inalcancavel pela tela — o estado de antes de 02/10.');
  });
  await page.getByRole('button', { name: /^Mostrar$/ }).click();
  await page.waitForTimeout(1500);
  aDesfazer.pop();   // a ocultação foi desfeita
  ok('staff tirou o post da ocultação pelo painel');

  await sair(page);

  // ── 7. A conta COMUM vê a notificação ──────────────────────────────────
  await entrar(page, BASE, COMUM.email, COMUM.senha);

  const sino = page.getByRole('button', { name: /^Notificações/ });
  await sino.waitFor({ state: 'visible', timeout: 30000 });
  const rotulo = await sino.getAttribute('aria-label');
  if (!/\d+ não lidas/.test(rotulo ?? '')) {
    throw new Error(
      `o sino diz "${rotulo}" — nenhuma notificacao nao lida.\n`
      + '    O staff curtiu E comentou o post desta conta, e os dois gatilhos\n'
      + '    gravam em `notifications`. Se nao chegou, ou o trigger nao disparou,\n'
      + '    ou a consulta do sino parou de ver as linhas.');
  }
  ok(`o sino mostra notificação nova (${rotulo})`);

  await sino.click();
  const painel = page.locator('.notif-panel');
  await painel.waitFor({ state: 'visible', timeout: 10000 });
  const texto = await painel.innerText();
  if (!/coment|curt/i.test(texto)) {
    throw new Error(
      'o painel de notificacoes abriu e nao fala de comentario nem de curtida.\n'
      + `    O que ele mostrou: ${texto.slice(0, 200)}`);
  }
  ok('o painel mostra a notificação do staff');

  // Limpeza: marcar lido tira o "não lidas" e deixa a faxina das 04:00
  // recolher as linhas em 30 dias.
  await painel.getByRole('button', { name: /Marcar tudo lido/ }).click();
  await page.waitForTimeout(1000);
  ok('notificações marcadas como lidas (limpeza)');

  // ── 8. A conta COMUM apaga o post ──────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const meu = page.locator('article, [data-post]', { hasText: MARCA }).first();
  await meu.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    throw new Error(
      `o post ${MARCA} NAO voltou ao feed depois de "Mostrar post".\n`
      + '    A inversa aceitou o clique e o post continua escondido — e e assim\n'
      + '    que `restoreContent` falharia em silencio (0 linhas, nenhum erro).');
  });
  ok('o post voltou ao feed depois de ser mostrado');

  await meu.getByRole('button', { name: 'Deletar post' }).click();
  await page.getByRole('button', { name: /^(Deletar|Excluir|Apagar)$/ }).first().click();
  await page.locator('h2', { hasText: MARCA }).first()
    .waitFor({ state: 'detached', timeout: 20000 })
    .catch(() => { throw new Error('o post nao sumiu depois de apagar'); });
  aDesfazer.length = 0;
  ok('conta comum apagou o post (limpeza provada)');

  await sair(page);
  ok('saiu');
} catch (e) {
  console.error(`\n  FALHOU em: passo ${passo + 1}`);
  console.error(`  ${e?.message ?? e}`);
  if (aDesfazer.length) {
    console.error('\n  SOBROU EM PRODUCAO, e precisa ser limpo a mao:');
    for (const x of aDesfazer) console.error(`    - ${x}`);
  }
  await salvarEvidencia(page, { erros });
  await browser.close();
  process.exit(1);
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
