/**
 * `[24/09]` CURTIR — e a unica pergunta que importa: o servidor GUARDOU?
 *
 * ── Por que este passo existe ───────────────────────────────────────────────
 *
 * A curtida deste projeto e OTIMISTA por design: `src/lib/like.js` acende o
 * coracao e sobe o numero ANTES de o servidor responder, e so desfaz se vier
 * erro. Isso e a coisa certa para quem usa — e e exatamente o que torna a tela
 * uma testemunha ruim.
 *
 * Conferir "o numero virou 1" logo depois do clique nao prova nada: ele vira 1
 * mesmo que o INSERT nunca chegue. O que separa os dois casos e RECARREGAR a
 * pagina e perguntar de novo.
 *
 * ── E o DESCURTIR e o lado perigoso, nao o curtir ───────────────────────────
 *
 * `DELETE` negado pela RLS devolve **0 linhas e nenhum erro** — esta escrito no
 * `POSTURA.md` §1.5 como a 2a das sete fontes de silencio, e ja escondeu por
 * meses a moderacao de comentario. Do lado do cliente o `supabase-js` nao
 * devolve erro nenhum, entao o `runLikeToggle` **nao reverte**: o coracao apaga,
 * o numero desce, e a curtida continua no banco.
 *
 * Nenhuma checagem de status HTTP pega isso (o PostgREST responde 204 nos dois
 * casos). So o segundo recarregamento pega.
 *
 * ── O que ele NAO cobre, dito com todas as letras ───────────────────────────
 *
 * Curtida em comentario e no mural usam o mesmo `runLikeToggle`, mas por telas
 * diferentes — este passo so exercita a do POST. E ele curte o post da PROPRIA
 * execucao: curtir o post de outra pessoa mexeria no XP dela e deixaria rastro
 * que a limpeza deste roteiro nao alcanca.
 */

/** O rotulo carrega o estado E a contagem — por isso serve de assercao inteira. */
const ROTULO = /^(Curtir|Descurtir) — \d+ curtida\(s\)$/;

function botaoDe(card) {
  return card.getByRole('button', { name: ROTULO });
}

async function rotuloAtual(card) {
  return botaoDe(card).getAttribute('aria-label');
}

/**
 * Clica e SO retorna quando a requisicao de curtida terminou.
 *
 * Sem esperar a resposta, o `page.reload()` seguinte competiria com um POST em
 * voo e o teste ficaria intermitente — que e pior do que teste nenhum, porque
 * ensina a reexecutar ate passar.
 */
async function clicarEEsperarOServidor(page, card) {
  const [resposta] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/rest/v1/post_likes') && r.request().method() !== 'GET',
      { timeout: 20000 },
    ),
    botaoDe(card).click(),
  ]);
  return resposta;
}

/**
 * @param {import('playwright').Page} page
 * @param {object} p
 * @param {string} p.base   URL do site
 * @param {string} p.marca  marca unica desta execucao, para reencontrar o card
 */
export async function curtirEConferirPersistencia(page, { base, marca }) {
  // Relocalizado a cada uso: locator do Playwright reconsulta o DOM, entao ele
  // sobrevive ao reload — mas a funcao deixa isso explicito para quem ler.
  const card = () => page.locator('.card').filter({ has: page.locator('h2', { hasText: marca }) });

  // O `getByRole` estoura com "waiting for locator" — mensagem que manda
  // procurar no lugar errado (§1.5). Se o botao sumiu ou o rotulo mudou, quem
  // ler o log precisa saber O QUE conferir.
  let antes;
  try {
    antes = await botaoDe(card()).getAttribute('aria-label', { timeout: 20000 });
  } catch {
    throw new Error(
      'nao achei o botao de curtir no card deste post.\n'
      + `    Procurei por um botao cujo nome acessivel case com ${ROTULO}.\n`
      + '    Esse rotulo e montado em `src/components/feed/PostCard.jsx`; se o\n'
      + '    texto mudou, o lugar de atualizar e a constante ROTULO aqui. Se o\n'
      + '    botao simplesmente sumiu, o bug e la, nao aqui.');
  }
  if (antes !== 'Curtir — 0 curtida(s)') {
    throw new Error(
      `o post recem-publicado ja nasceu com curtida: "${antes}".\n`
      + '    Ou o feed mostrou o card errado, ou sobrou linha em `post_likes`\n'
      + '    de uma execucao que morreu no meio.');
  }

  // ── 1. Curtir, e conferir que SOBREVIVE ao recarregamento ────────────────
  await clicarEEsperarOServidor(page, card());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await card().waitFor({ state: 'visible', timeout: 30000 });

  const depoisDeCurtir = await rotuloAtual(card());
  if (depoisDeCurtir !== 'Descurtir — 1 curtida(s)') {
    throw new Error(
      `depois de recarregar, o botao diz "${depoisDeCurtir}" — esperado\n`
      + '    "Descurtir — 1 curtida(s)".\n'
      + '    A curtida e OTIMISTA: a tela acende antes de o servidor responder.\n'
      + '    Rotulo errado DEPOIS do reload significa que o INSERT em\n'
      + '    `post_likes` nao ficou — RLS negando, ou o service mandando para\n'
      + '    a linha errada. Confira `src/lib/like.js` e a policy de INSERT.');
  }

  // ── 2. Descurtir — o lado que a RLS nega EM SILENCIO ─────────────────────
  await clicarEEsperarOServidor(page, card());
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await card().waitFor({ state: 'visible', timeout: 30000 });

  const depoisDeDescurtir = await rotuloAtual(card());
  if (depoisDeDescurtir !== 'Curtir — 0 curtida(s)') {
    throw new Error(
      `depois de recarregar, o botao diz "${depoisDeDescurtir}" — esperado\n`
      + '    "Curtir — 0 curtida(s)".\n'
      + '    Este e o caso que NENHUM status HTTP pega: `DELETE` negado pela\n'
      + '    RLS devolve 204 e ZERO linhas, sem erro — entao o cliente nao\n'
      + '    reverte, a tela apaga o coracao e a curtida continua no banco.\n'
      + '    Confira a policy de DELETE de `post_likes`.');
  }
}
