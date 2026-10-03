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
 * ── DUAS SESSÕES ABERTAS, não login e logout alternados ─────────────────
 *
 * `[03/10]` Cada conta tem o seu `BrowserContext`. A 1ª versão logava e
 * deslogava, e isso custava caro de dois jeitos: cinco logins de relógio, e —
 * pior — a assertiva mais importante ficava difícil de posicionar.
 *
 * Porque ela é **o autor deixar de ver**: moderador vê conteúdo oculto de
 * propósito (o `PostCard` tem borda própria para `hidden_at`), então conferir
 * o feed do STAFF depois de ocultar não prova nada. A 1ª versão fazia isso e
 * acusava um bug que não existia.
 *
 * Com as duas sessões vivas, "o staff oculta" e "o autor deixa de ver" ficam
 * a duas linhas uma da outra.
 *
 * ── A pergunta que ele fez, e que este roteiro responde ─────────────────
 *
 * *"Não considere 'a função/RLS/trigger está correta' equivalente a 'o fluxo
 * do GamerHub está seguro'."* Cada peça daqui já tem teste em ROLLBACK. O que
 * nenhum deles responde é se as peças, ligadas, produzem o que a pessoa vê.
 *
 * ── A limpeza é PROVADA, e aqui ela é obrigação dupla ───────────────────
 *
 * Ele escreve em produção com DUAS contas, e o que cria é visível para gente
 * de verdade: post no feed, denúncia na fila, notificação no sino. Cada passo
 * tem o seu desfazer — o post é apagado por quem o criou, a ocultação é
 * desfeita pelo painel (`handleMostrarPost`), as notificações são marcadas
 * como lidas — e o fim CONFERE que desfez.
 *
 * ── O que ele NÃO cobre ─────────────────────────────────────────────────
 *
 * Banimento e suspensão: morrer no meio deixaria a conta de teste banida, o
 * que derruba TODOS os outros roteiros. Continuam validados em ROLLBACK.
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

// Uma sessao por conta. Contextos sao isolados por construcao — cookie e
// storage de um nao alcancam o outro.
const ctxComum = await browser.newContext();
const ctxStaff = await browser.newContext();
const comum = await ctxComum.newPage();
const staff = await ctxStaff.newPage();

const erros = [];
for (const [quem, pg] of [['comum', comum], ['staff', staff]]) {
  pg.on('pageerror', (e) => erros.push(`excecao (${quem}): ${e.message}`));
}

let passo = 0;
const ok = (m) => console.log(`  ${String(++passo).padStart(2)}. OK   ${m}`);

/** O card do post no feed, pelo padrao provado no `cicloDoPost.mjs`. */
const cardDoPost = (pg) =>
  pg.locator('.card').filter({ has: pg.locator('h2', { hasText: MARCA }) }).first();

/** As abas do painel sao `button[aria-pressed]` — ver `painel-admin.mjs`. */
const aba = (pg, nome) => pg.locator('button[aria-pressed]').filter({ hasText: nome }).first();

/** Os avisos que a tela deu, para a mensagem de erro dizer o que ela disse. */
const avisosDaTela = async (pg) =>
  (await pg.locator('[role="status"]').allInnerTexts().catch(() => []))
    .map((t) => t.trim()).filter(Boolean);

console.log(`\n  Comum x moderador em ${BASE}\n`);

/** O que precisa ser desfeito, na ORDEM INVERSA de como foi feito. */
const aDesfazer = [];
let ondeFalhou = comum;

try {
  // ── 1. As duas sessoes ──────────────────────────────────────────────────
  await entrar(comum, BASE, COMUM.email, COMUM.senha);
  await entrar(staff, BASE, STAFF.email, STAFF.senha);
  ok('as duas sessoes abertas, lado a lado');

  // ── 2. A conta COMUM publica ────────────────────────────────────────────
  ondeFalhou = comum;
  await publicarEEsperarNoFeed(comum, {
    titulo: `${MARCA} post que vai ser moderado`,
    corpo: 'Post do roteiro de duas contas: ele e ocultado, mostrado de novo e apagado.',
    marca: MARCA,
  });
  aDesfazer.push('o post da conta comum');
  ok('conta comum publicou');

  // ── 3. O STAFF curte e comenta — e isto GERA a notificacao ─────────────
  //
  // Os tres gatilhos de notificacao pulam o proprio autor, entao estas duas
  // acoes so existem com a segunda conta.
  ondeFalhou = staff;
  await staff.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const noStaff = cardDoPost(staff);
  await noStaff.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    throw new Error(`o staff nao enxerga o post ${MARCA} no feed — o feed nao carregou?`);
  });

  await noStaff.getByRole('button', { name: /^(Curtir|Descurtir) — \d+ curtida\(s\)$/ }).click();
  await comentarEEsperarNaLista(staff, { card: noStaff, texto: `${MARCA} comentario do staff` });
  ok('staff curtiu e comentou — as duas notificacoes estao geradas');

  // ── 4. DENUNCIAR: e o que coloca o item na fila ────────────────────────
  //
  // O autor nao pode denunciar o proprio post (`canReport`), entao sem a
  // segunda conta nao existe caminho de UI para ocultar.
  await noStaff.getByRole('button', { name: 'Denunciar post' }).click();
  const tituloDoModal = staff.getByRole('heading', { name: /^Denunciar$/ });
  await tituloDoModal.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {
    throw new Error('o modal de denuncia nao abriu depois do clique em "Denunciar post"');
  });
  await staff.getByRole('radio').first().check();
  await staff.getByRole('button', { name: /^Denunciar$/ }).click();
  await tituloDoModal.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {
    throw new Error('o modal de denuncia nao fechou — a denuncia pode nao ter sido gravada');
  });
  ok('staff denunciou o post');

  // ── 5. OCULTAR pela fila ───────────────────────────────────────────────
  await staff.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await aba(staff, 'Moderação').click();

  const naFila = staff.locator('.card', { hasText: MARCA }).first();
  await naFila.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    throw new Error(
      `o post ${MARCA} nao apareceu na fila de moderacao.\n`
      + '    A denuncia foi gravada (o modal fechou), entao ou o trigger que\n'
      + '    enfileira nao disparou, ou o item nasceu com outro status.');
  });

  await naFila.getByRole('combobox', { name: 'Ação de moderação' }).selectOption('hide');
  await naFila.getByRole('button', { name: /Confirmar ocultação/ }).click();

  // Esperar o item SAIR da fila: e o sinal observavel de que a resolucao
  // terminou. A 1a versao navegava embora no mesmo instante, e o banco
  // mostrava `hidden_at` nulo com o item ainda `pending`.
  await naFila.waitFor({ state: 'detached', timeout: 25000 }).catch(async () => {
    const avisos = await avisosDaTela(staff);
    throw new Error(
      'confirmei a ocultacao e o item NAO saiu da fila.\n'
      + (avisos.length ? `    A TELA DISSE: ${avisos.join(' | ')}\n` : '    A tela nao avisou nada.\n')
      + "    `hideContent` usa `count: 'exact'`, entao RLS negando vira erro\n"
      + '    visivel em vez de sucesso silencioso.');
  });
  aDesfazer.push('o post OCULTADO — desfaz em /admin > Posts > botao "Mostrar post"');
  ok('staff ocultou o post pela fila (o item saiu da fila)');

  // ── 6. O AUTOR deixa de ver. ESTA e a assertiva do fluxo ───────────────
  //
  // `[03/10]` A 1a versao conferia o feed do STAFF e acusava um bug que nao
  // existia: moderador ve conteudo oculto de proposito — o `PostCard` tem
  // borda propria para `hidden_at`. Quem precisa deixar de ver e o AUTOR.
  ondeFalhou = comum;
  await comum.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await comum.locator('[data-publicar="linha"]').waitFor({ state: 'visible', timeout: 30000 });
  await comum.waitForTimeout(1500);
  if (await comum.locator('h2', { hasText: MARCA }).count()) {
    throw new Error(
      `o post ${MARCA} foi ocultado e o AUTOR continua vendo no feed.\n`
      + '    FATO: o item saiu da fila, entao a resolucao terminou.\n'
      + '    Hipoteses: a policy de SELECT parou de esconder post oculto do\n'
      + '    proprio dono; a consulta do feed deixou de filtrar `hidden_at`; ou\n'
      + '    a resolucao marcou o item sem escrever em `posts`.');
  }
  ok('o AUTOR deixou de ver o post ocultado');

  // ── 7. A notificacao chegou ────────────────────────────────────────────
  const sino = comum.getByRole('button', { name: /^Notificações/ });
  await sino.waitFor({ state: 'visible', timeout: 30000 });
  const rotulo = await sino.getAttribute('aria-label');
  if (!/\d+ não lidas/.test(rotulo ?? '')) {
    throw new Error(
      `o sino diz "${rotulo}" — nenhuma notificacao nao lida.\n`
      + '    O staff curtiu E comentou o post desta conta, e os dois gatilhos\n'
      + '    gravam em `notifications`.');
  }
  await sino.click();
  const painel = comum.locator('.notif-panel');
  await painel.waitFor({ state: 'visible', timeout: 10000 });
  const texto = await painel.innerText();
  if (!/coment|curt/i.test(texto)) {
    throw new Error(
      'o painel de notificacoes abriu e nao fala de comentario nem de curtida.\n'
      + `    O que ele mostrou: ${texto.slice(0, 200)}`);
  }
  await painel.getByRole('button', { name: /Marcar tudo lido/ }).click();
  await comum.waitForTimeout(1000);
  ok(`o autor viu a notificacao do staff (${rotulo}) e marcou lida`);

  // ── 8. MOSTRAR de novo — a inversa que nasceu em 02/10 ─────────────────
  ondeFalhou = staff;
  await staff.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await aba(staff, 'Posts').click();

  const noPainel = staff.locator('.card', { hasText: MARCA }).first();
  await noPainel.waitFor({ state: 'visible', timeout: 30000 });
  await noPainel.getByText('Oculto').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
    throw new Error('o painel nao marca o post como "Oculto" — o selo sumiu da lista');
  });
  await noPainel.getByTitle(/Mostrar post/).click().catch(() => {
    throw new Error(
      'o botao "Mostrar post" nao existe para um post OCULTO.\n'
      + '    Sem ele `restoreContent` volta a ser inalcancavel pela tela — o\n'
      + '    estado de antes de 02/10.');
  });
  await staff.getByRole('button', { name: /^Mostrar$/ }).click();
  await staff.waitForTimeout(2000);
  aDesfazer.pop();
  ok('staff tirou o post da ocultacao pelo painel');

  // ── 9. O autor volta a ver, e apaga ────────────────────────────────────
  ondeFalhou = comum;
  await comum.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const meu = cardDoPost(comum);
  await meu.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    throw new Error(
      `o post ${MARCA} NAO voltou ao feed depois de "Mostrar post".\n`
      + '    A inversa aceitou o clique e o post continua escondido — e assim\n'
      + "    que `restoreContent` falharia em silencio (0 linhas, nenhum erro).");
  });
  ok('o post voltou ao feed depois de ser mostrado');

  await meu.getByRole('button', { name: 'Deletar post' }).click();
  await comum.getByRole('button', { name: /^(Deletar|Excluir|Apagar)$/ }).first().click();
  // A exclusao tem contagem regressiva de 5 s antes de acontecer.
  await comum.locator('h2', { hasText: MARCA }).first()
    .waitFor({ state: 'detached', timeout: 25000 })
    .catch(() => { throw new Error('o post nao sumiu depois de apagar'); });
  aDesfazer.length = 0;
  ok('conta comum apagou o post (limpeza provada)');

  await sair(comum);
  await sair(staff);
  ok('as duas sessoes sairam');
} catch (e) {
  console.error(`\n  FALHOU em: passo ${passo + 1}`);
  console.error(`  ${e?.message ?? e}`);
  if (aDesfazer.length) {
    console.error('\n  SOBROU EM PRODUCAO, e precisa ser limpo a mao:');
    for (const x of aDesfazer) console.error(`    - ${x}`);
  }
  await salvarEvidencia(ondeFalhou, { erros, causa: `passo ${passo + 1}: ${e?.message ?? e}` });
  await browser.close();
  process.exit(1);
}

// Excecao de JS em qualquer ponto reprova, mesmo com todos os passos verdes.
if (erros.length) {
  console.error(`\n  Passos OK, mas houve excecao de JS: ${erros.join(' | ')}\n`);
  await salvarEvidencia(comum, { erros, causa: `excecao de JS: ${erros.join(' | ')}` });
  await browser.close();
  process.exit(1);
}

console.log(`\n  ${passo}/${passo} passos OK\n`);
await browser.close();
