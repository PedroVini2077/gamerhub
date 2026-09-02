/**
 * Publicar um post e esperar ele aparecer no feed — passo compartilhado.
 *
 * ── Por que virou arquivo ───────────────────────────────────────────────────
 *
 * `fluxos.mjs` e `painel-admin.mjs` tinham a MESMA sequência copiada: preencher,
 * clicar em Publicar, esperar o `h2`. Duas cópias da mesma coisa divergem (§4),
 * e aqui a divergência custaria caro — as duas precisam da melhoria abaixo.
 *
 * ── O que ele conserta, e é a razão de existir ──────────────────────────────
 *
 * Em 02/09 o job do painel falhou assim:
 *
 *     FALHOU em: painel de admin
 *     - waiting for locator('h2').filter({ hasText: '[painel 1788347076199]' })
 *
 * Isso diz **o que não aconteceu** e nada sobre **por quê**. Fui ao banco e o
 * post não existia — ou seja, o `INSERT` nem chegou a acontecer. E o site
 * tinha dito o motivo, num toast, que o teste jogou fora.
 *
 * A mensagem de erro tem que ENSINAR (§2). Este helper vigia os avisos da tela
 * enquanto espera e os devolve na falha, com o que cada um significa.
 */

/**
 * @param {import('playwright').Page} page
 * @param {object} opcoes
 * @param {string} opcoes.titulo   o que vai no campo de título
 * @param {string} opcoes.corpo    o que vai no campo de conteúdo
 * @param {string} opcoes.marca    o trecho único que identifica ESTE post
 * @param {number} [opcoes.timeout]
 * @returns {Promise<import('playwright').Locator>} o `h2` do post no feed
 */
export async function publicarEEsperarNoFeed(page, {
  titulo, corpo, marca, timeout = 30000,
}) {
  // Todos os avisos que a tela deu, sem classificar. O `react-hot-toast` usa
  // `role="status"` tanto no sucesso quanto no erro, e tentar separar os dois
  // por texto seria adivinhação — o valor está em relatar o que apareceu.
  const avisos = new Set();
  const coletarAvisos = async () => {
    const textos = await page.locator('[role="status"]').allInnerTexts().catch(() => []);
    for (const t of textos) {
      const limpo = t.trim();
      if (limpo) avisos.add(limpo);
    }
  };

  await page.locator('#post-title').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#post-title').fill(titulo);
  await page.locator('#post-content').fill(corpo);
  await page.getByRole('button', { name: /^Publicar$/ }).click();

  const alvo = page.locator('h2', { hasText: marca }).first();
  const limite = Date.now() + timeout;

  // Laço de 500 ms em vez de `waitFor`: o `waitFor` bloqueia até estourar e não
  // deixa ninguém olhar a tela no meio do caminho — que é exatamente onde o
  // toast aparece e some.
  while (Date.now() < limite) {
    await coletarAvisos();
    if (await alvo.isVisible().catch(() => false)) return alvo;
    await page.waitForTimeout(500);
  }
  await coletarAvisos();

  const ditos = avisos.size
    ? [...avisos].map(t => JSON.stringify(t)).join(' | ')
    : '(a tela nao disse NADA)';

  throw new Error(
    `o post "${marca}" nao apareceu no feed em ${timeout / 1000}s.\n`
    + `  O que a tela disse enquanto isso: ${ditos}\n`
    + '\n'
    + '  Como ler isso:\n'
    + '    "Conteudo nao permitido"  -> a wordlist casou algo no titulo ou no corpo.\n'
    + '    "Erro: ..."               -> o INSERT falhou, e a mensagem vem do banco\n'
    + '                                 (RLS, trigger, constraint).\n'
    + '    "Post publicado!"         -> o post EXISTE e o feed nao releu. Aqui o\n'
    + '                                 suspeito e `lib/recarregarAteAparecer.js`:\n'
    + '                                 leitura logo apos escrita pode trazer dado\n'
    + '                                 anterior, e a insistencia dele tem teto.\n'
    + '    (nada)                    -> o clique nao chegou no botao, ou a pagina\n'
    + '                                 nao era o feed. Veja a evidencia salva.');
}
