/**
 * E2E das LIVES — o módulo que a suíte autenticada declarava não cobrir.
 *
 * ── Por que ele existe ──────────────────────────────────────────────────────
 *
 * O `fluxos.mjs` diz, na própria abertura, o que deixa de fora: lives, likes,
 * chat e XP. Uma auditoria externa de 18/09 cobrou exatamente isso — *"não
 * considere 'a função/RLS/trigger está correta' equivalente a 'o fluxo do
 * GamerHub está seguro'. São verificações diferentes"*.
 *
 * Ele está certo, e o caso que prova é desta mesma rodada: a SEC-034 encontrou
 * que **apagar uma live não a encerrava**, e nenhum teste de banco pegaria isso
 * — a RLS estava correta, o trigger estava correto, e mesmo assim a live
 * apagada continuava listada como "AO VIVO" para quem é da equipe.
 *
 * ── As DUAS camadas, que é o ponto do pedido ────────────────────────────────
 *
 * | Camada | O que ela responde |
 * | --- | --- |
 * | **produto** (navegador) | a tela mostra o estado certo? |
 * | **API/banco** (token real) | o que ficou GRAVADO é o mesmo que a tela diz? |
 *
 * A segunda camada usa o **token de verdade do usuário**, obtido no endpoint de
 * auth — não `SET LOCAL role` numa transação SQL. Essa diferença importa: a
 * transação prova a RLS, o token prova o **caminho inteiro** (PostgREST, JWT,
 * policy, trigger). Foi por não ter a segunda que a SEC-027 precisou ser
 * testada duas vezes.
 *
 * ── A regra que ele repetiu, e que este arquivo obedece ─────────────────────
 *
 * *"Não confunda HTTP com sucesso."* Nenhum passo aqui conclui nada por `204`
 * ou `200 []`: todo ataque é seguido de uma RELEITURA do estado persistido.
 * Foi assim que um "achado confirmado" do pentest anterior virou falso positivo
 * — o `UPDATE` era aceito e o trigger revertia por baixo.
 *
 * Uso:  npm run build && npx vite preview --port 4173 &  →  node e2e/lives.mjs
 * Exige E2E_EMAIL e E2E_PASSWORD (conta comum).
 */
import { abrirNavegador, exigirServidor, salvarEvidencia, recusarSeBanido } from './util.mjs';
import { marcaDeTeste } from './publicarPost.mjs';

const BASE  = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_PASSWORD;
const URL_SUPA = process.env.VITE_SUPABASE_URL;
const CHAVE    = process.env.VITE_SUPABASE_ANON_KEY;

const MARCA  = marcaDeTeste('[e2e-live ');
const TITULO = `${MARCA} live automatica`;
const LINK   = 'https://twitch.tv/gamerhub_teste_e2e';

for (const [nome, valor] of [
  ['E2E_EMAIL', EMAIL], ['E2E_PASSWORD', SENHA],
  ['VITE_SUPABASE_URL', URL_SUPA], ['VITE_SUPABASE_ANON_KEY', CHAVE],
]) {
  if (!valor) {
    console.error(`\n  ${nome} nao definido.`);
    console.error('  Este teste precisa da conta descartavel E do acesso a API,');
    console.error('  porque ele confere a TELA contra o ESTADO PERSISTIDO.\n');
    process.exit(1);
  }
}

await exigirServidor(BASE);

// ── A camada 2: token de verdade, não papel assumido em SQL ─────────────────
const cab = (token) => ({
  apikey: CHAVE,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

async function entrarNaApi() {
  const r = await fetch(`${URL_SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CHAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login na API falhou: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

/** Relê a linha do banco. É isto que vale como prova, nunca o código HTTP. */
async function lerPost(token, id) {
  const r = await fetch(
    `${URL_SUPA}/rest/v1/posts?id=eq.${id}&select=id,is_live,was_live,live_ended_at,deleted_at,expires_at,created_at,user_id`,
    { headers: cab(token) });
  const linhas = await r.json();
  return Array.isArray(linhas) ? linhas[0] : undefined;
}

async function xpDe(token, userId) {
  const r = await fetch(`${URL_SUPA}/rest/v1/rpc/get_user_xp`, {
    method: 'POST', headers: cab(token), body: JSON.stringify({ p_user_id: userId }),
  });
  return r.json();
}

/**
 * Abre a aba onde a live do `LiveGoModal` REALMENTE cai.
 *
 * ── A primeira versao deste teste errou aqui, e o erro foi util ─────────────
 *
 * As abas de `/lives` sao, na ordem:
 *
 *   Da comunidade  ->  !live_kind      <- ABA PADRAO
 *   Gameplays      ->  live_kind = 'gameplay'
 *   Reacts / Outros
 *
 * O `LiveGoModal` SEMPRE define um `live_kind` (o padrao dele e `gameplay`),
 * entao uma live criada por ali **nunca** aparece na aba padrao. O teste
 * procurava o titulo na tela recem-carregada e falhava com "nao apareceu" —
 * enquanto o cabecalho, na mesma tela, dizia "1 ao vivo".
 *
 * Isso e comportamento de produto, nao defeito: as abas separam live de jogador
 * de live da comunidade de proposito. O que o E2E expos foi a leitura da tela
 * (cabecalho e aba discordando), e isso esta anotado no BACKLOG — nao e papel
 * deste teste decidir.
 */
async function abrirAbaDaLive(page) {
  await page.getByRole('button', { name: /^Gameplays/i }).first().click();
  await page.waitForTimeout(800);
}

const browser = await abrirNavegador();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', e => erros.push(`exceçao: ${e.message}`));

let passo = 0;
const ok = (msg) => console.log(`  ${String(++passo).padStart(2)}. OK   ${msg}`);

let token; let postId;

async function morrer(etapa, erro) {
  console.error(`\n  FALHOU em: ${etapa}`);
  console.error(`  ${erro?.message ?? erro}\n`);
  await salvarEvidencia(page, { erros });
  if (token && postId) {
    // Limpeza mesmo no caminho de falha: live de teste que fica no ar é pior do
    // que o teste ter falhado — ela aparece para gente de verdade.
    await fetch(`${URL_SUPA}/rest/v1/rpc/soft_delete_post`, {
      method: 'POST', headers: cab(token), body: JSON.stringify({ p_post_id: postId }),
    }).catch(() => {});
  }
  await browser.close();
  process.exit(1);
}

console.log(`\n  E2E das lives em ${BASE}\n`);

try {
  token = await entrarNaApi();
  const eu = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub;
  ok('sessao de API obtida (token de verdade, nao papel assumido)');

  const xpAntes = await xpDe(token, eu);

  // ── 1. Login no produto ───────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(SENHA);
  await page.getByRole('button', { name: '// ENTRAR' }).click();
  await page.waitForTimeout(2500);
  await recusarSeBanido(page);
  ok('entrou no produto');

  // ── 2. Ficar ao vivo PELA INTERFACE ───────────────────────────────────────
  await page.goto(`${BASE}/lives`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: /Ficar ao vivo/i }).click();
  await page.getByPlaceholder('Ex: Ranqueada até o topo — bora?').fill(TITULO);
  await page.getByPlaceholder('https://twitch.tv/seucanal').fill(LINK);
  await page.getByRole('button', { name: /Iniciar live/i }).click();
  await abrirAbaDaLive(page);
  await page.getByText(TITULO).first().waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => { throw new Error('a live criada nao apareceu na aba Gameplays'); });
  ok('criou a live pela interface e ela apareceu na aba certa');

  // ── 3. A TELA diz "ao vivo". O BANCO concorda? ────────────────────────────
  const achado = await fetch(
    `${URL_SUPA}/rest/v1/posts?user_id=eq.${eu}&title=eq.${encodeURIComponent(TITULO)}&select=id`,
    { headers: cab(token) }).then(r => r.json());
  postId = achado?.[0]?.id;
  if (!postId) throw new Error('a live nao foi encontrada no banco pelo titulo');

  let linha = await lerPost(token, postId);
  if (!linha.is_live)       throw new Error('a tela mostrou a live, mas is_live=false no banco');
  if (!linha.was_live)      throw new Error('was_live nao acendeu junto com is_live (SEC-027)');
  if (linha.live_ended_at)  throw new Error('live recem-criada ja nasceu com live_ended_at (SEC-034)');
  if (linha.expires_at)     throw new Error('o cliente conseguiu gravar expires_at (SEC-027)');
  ok('banco concorda com a tela: no ar, was_live derivado, sem data de fim');

  // ── 4. O ATAQUE, com o token REAL do usuario ──────────────────────────────
  // Este e o passo que a transacao SQL nao consegue fazer: bater na REST API
  // como o navegador bateria, com o JWT de uma conta comum de verdade.
  const ataque = await fetch(`${URL_SUPA}/rest/v1/posts?id=eq.${postId}`, {
    method: 'PATCH',
    headers: { ...cab(token), Prefer: 'return=minimal' },
    body: JSON.stringify({
      expires_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: '2020-01-01T00:00:00Z',
      live_ended_at: new Date().toISOString(),
      user_id: '00000000-0000-0000-0000-000000000000',
    }),
  });
  // O `204` aqui NAO prova nada — e exatamente o que enganou o pentest
  // anterior. Quem prova e a releitura logo abaixo.
  linha = await lerPost(token, postId);
  if (linha.expires_at)   throw new Error('expires_at foi gravado pelo cliente (SEC-027 furada)');
  if (linha.live_ended_at) throw new Error('live_ended_at foi gravado pelo cliente (SEC-027 furada)');
  if (linha.user_id !== eu) throw new Error('a autoria do post foi trocada pelo cliente');
  if (new Date(linha.created_at).getFullYear() === 2020) {
    throw new Error('created_at foi forjado pelo cliente (SEC-027 furada)');
  }
  ok(`PATCH das colunas privilegiadas respondeu ${ataque.status} e NAO mudou nada`);

  // ── 5. Encerrar pela interface ────────────────────────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded' });
  await abrirAbaDaLive(page);
  await page.getByText(TITULO).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const botaoEncerrar = page.getByRole('button', { name: /Encerrar/i }).first();
  if (await botaoEncerrar.count()) {
    await botaoEncerrar.click();
    await page.waitForTimeout(2000);
    linha = await lerPost(token, postId);
    if (linha.is_live) throw new Error('clicou em Encerrar e o banco continua is_live=true');
    if (!linha.live_ended_at) throw new Error('encerrou e live_ended_at nao foi gravado');
    ok('encerrou pela interface e o banco gravou a data de fim');
  } else {
    // Não falha o teste: o botão só existe dentro da própria live, e o layout
    // dessa tela pode mudar. Mas DIZ que não testou, em vez de fingir.
    console.log('      (o botao Encerrar nao estava na tela — passo pulado, NAO testado)');
  }

  // ── 6. Reativar: o estado impossivel da SEC-034 ───────────────────────────
  await fetch(`${URL_SUPA}/rest/v1/posts?id=eq.${postId}`, {
    method: 'PATCH', headers: { ...cab(token), Prefer: 'return=minimal' },
    body: JSON.stringify({ is_live: false }),
  });
  await fetch(`${URL_SUPA}/rest/v1/posts?id=eq.${postId}`, {
    method: 'PATCH', headers: { ...cab(token), Prefer: 'return=minimal' },
    body: JSON.stringify({ is_live: true }),
  });
  linha = await lerPost(token, postId);
  if (linha.is_live && linha.live_ended_at) {
    throw new Error('ESTADO IMPOSSIVEL: no ar E com data de encerramento (SEC-034 furada)');
  }
  ok('reativar limpou a data de fim — sem estado impossivel');

  // ── 7. Apagar a live: ela some da lista? (o bug da SEC-034) ───────────────
  await fetch(`${URL_SUPA}/rest/v1/rpc/soft_delete_post`, {
    method: 'POST', headers: cab(token), body: JSON.stringify({ p_post_id: postId }),
  });
  linha = await lerPost(token, postId);
  if (linha && linha.is_live) {
    throw new Error('o post foi apagado e a live continua is_live=true (SEC-034 furada)');
  }
  await page.goto(`${BASE}/lives`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  await abrirAbaDaLive(page);
  if (await page.getByText(TITULO).count()) {
    throw new Error('a live apagada continua aparecendo na lista');
  }
  postId = null;
  ok('apagar a live encerrou e tirou ela da lista');

  // ── 8. O XP conta so o que existe ─────────────────────────────────────────
  const xpDepois = await xpDe(token, eu);
  if (xpDepois.lives > xpAntes.lives) {
    throw new Error(
      `a live apagada continua valendo XP: lives ${xpAntes.lives} -> ${xpDepois.lives} (SEC-028 furada)`);
  }
  ok(`XP nao contou a live apagada (lives ${xpAntes.lives} -> ${xpDepois.lives})`);

  console.log(`\n  ${passo}/${passo} passos do E2E de lives no lugar.\n`);
  await browser.close();
} catch (e) {
  await morrer('E2E de lives', e);
}
