/**
 * Comentar num post e esperar o comentário aparecer — passo compartilhado.
 *
 * ── Por que ele nasceu, e o número que o justifica ──────────────────────────
 *
 * `[05/09]` A produção tinha **150 posts e ZERO comentários**, com 5 pessoas.
 * O zero podia ser só falta de gente — mas **nada** respondia isso: nenhum dos
 * 16 roteiros de navegador comentava. O `publicarPost.mjs` cobre publicar, não
 * conversar.
 *
 * E "funcionalidade que ninguém usa" é o esconderijo preferido dos bugs deste
 * projeto. A moderação de comentário ficou quebrada **meses** porque o `UPDATE`
 * afetava 0 linhas em silêncio; a moderação por IA falhou em 26 de 26 chamadas
 * sem ninguém saber. Nos dois casos não havia usuário para reclamar — é
 * exatamente o §1.5, com as três respostas em "nada".
 *
 * ── O que ele prova, e o que NÃO prova ──────────────────────────────────────
 *
 * Prova a ida inteira num navegador de verdade: a seção abre, o `INSERT` passa
 * pela RLS (`comments_insert` exige `auth.uid() = user_id` **e**
 * `pode_publicar()`), o trigger de moderação não derruba a escrita, e a lista
 * relê e mostra.
 *
 * **Não** prova a moderação do comentário — essa é outra tela, e prometer
 * cobertura que não existe é pior do que não ter (§1.1). A **resposta
 * aninhada** ficou fora daqui de 05/09 a 24/09; hoje ela tem passo próprio,
 * logo abaixo (`responderEEsperarAninhada`).
 *
 * ── Limpeza ────────────────────────────────────────────────────────────────
 *
 * Nenhuma, e é de propósito: `comments_post_id_fkey` é **ON DELETE CASCADE**
 * (verificado no banco, não suposto). O passo que apaga o post do teste leva o
 * comentário junto. Se essa FK mudar um dia, este comentário aqui é a pista.
 */

/**
 * Abre a seção de comentários do card — e não presume que ela CONTINUOU aberta.
 *
 * `[24/09]` Medido no CI: segundos depois de comentar com sucesso, o card
 * voltava a mostrar o botão "Comentar" (ou seja, contagem ZERO) e a lista some
 * da tela, com o comentário vivo no banco (`hidden_at` nulo, conferido). Seja
 * remontagem do feed ou o `initialCount` em lote sobrescrevendo a contagem, o
 * passo de responder não pode herdar o estado de tela do passo anterior.
 *
 * O defeito em si está no BACKLOG — ele é do SITE, não do roteiro.
 */
async function garantirSecaoAberta(card) {
  const composer = card.getByLabel(/Escreva um comentário/i);
  if (await composer.isVisible().catch(() => false)) return;

  // O rótulo MUDA com a contagem: "Comentar" quando é zero, "N comentários"
  // quando não é. Casar os dois evita um passo que só funciona num dos casos.
  const abrir = card.getByRole('button', { name: /^(Comentar|\d+ comentários?)$/ });
  await abrir.waitFor({ state: 'visible', timeout: 15000 });
  await abrir.click();
  await composer.waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * @param {import('playwright').Page} page
 * @param {object} opcoes
 * @param {import('playwright').Locator} opcoes.card  o `.card` do post alvo
 * @param {string} opcoes.texto   o que escrever — precisa ser único na execução
 * @param {number} [opcoes.timeout]
 */
export async function comentarEEsperarNaLista(page, { card, texto, timeout = 30000 }) {
  // Mesma coleta de avisos do `publicarPost.mjs`, e pelo mesmo motivo: o
  // `react-hot-toast` usa `role="status"` no sucesso e no erro, aparece por
  // poucos segundos, e é a ÚNICA coisa que diz por que a escrita não aconteceu.
  const avisos = new Set();
  const coletarAvisos = async () => {
    const textos = await page.locator('[role="status"]').allInnerTexts().catch(() => []);
    for (const t of textos) {
      const limpo = t.trim();
      if (limpo) avisos.add(limpo);
    }
  };

  await garantirSecaoAberta(card);

  const campo = card.getByLabel(/Escreva um comentário/i);
  await campo.fill(texto);

  // `[25/09]` Espera a RESPOSTA do servidor, e não só o clique.
  //
  // Sem isto, o passo seguinte corre contra uma requisição em voo — e, pior,
  // um `INSERT` recusado passa despercebido: o `supabase-js` devolve o erro
  // para o componente, que mostra um toast e some. Olhar o status HTTP é o
  // jeito mais direto de separar "ainda não chegou" de "o banco recusou".
  const [resposta] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/rest/v1/comments') && r.request().method() === 'POST',
      { timeout: 20000 },
    ).catch(() => null),
    card.getByRole('button', { name: 'Enviar comentário' }).click(),
  ]);

  if (resposta && !resposta.ok()) {
    const corpo = await resposta.text().catch(() => '(sem corpo)');
    throw new Error(
      `o INSERT do comentario foi RECUSADO: HTTP ${resposta.status()}\n`
      + `    ${corpo.slice(0, 300)}\n`
      + '    Suspeitos, nesta ordem: a policy `comments_insert` (exige\n'
      + '    auth.uid() = user_id E pode_publicar()), o trigger da wordlist, ou\n'
      + '    a conta de teste suspensa.');
  }
  if (!resposta) {
    throw new Error(
      'o clique em "Enviar comentario" nao produziu requisicao nenhuma em 20s.\n'
      + '    O botao estava desabilitado (texto vazio no estado do React?), ou o\n'
      + '    `handleSubmit` saiu cedo. Repare que `fill()` mexe no DOM e o React\n'
      + '    precisa ter processado o evento para o botao habilitar.');
  }

  // `[25/09]` Espera o texto DENTRO de um bloco de comentário, e não em
  // qualquer lugar do card.
  //
  // A versão anterior procurava `card.getByText(texto)` solto — e isso deu
  // FALSO VERDE: numa execução do CI o passo declarou "comentário publicado e
  // visível na lista" com o comentário **inexistente no banco** (conferido).
  // O texto estava na tela porque continuava no campo de escrita: quando o
  // `INSERT` falha, o compositor NÃO limpa o que a pessoa escreveu.
  //
  // O estrago não foi aqui: foi dois passos adiante, onde o roteiro de
  // responder não achou o comentário pai e acusou o lugar errado. Assertiva
  // fraca não falha no lugar fraco — ela empurra a falha para longe da causa.
  const alvo = card.locator('[data-comentario]').getByText(texto, { exact: false }).first();
  const limite = Date.now() + timeout;

  // Laço de 500 ms em vez de `waitFor`: o `waitFor` bloqueia até estourar e não
  // deixa ninguém olhar a tela no meio — que é justamente quando o toast
  // aparece e some.
  while (Date.now() < limite) {
    await coletarAvisos();
    if (await alvo.isVisible().catch(() => false)) return alvo;
    await page.waitForTimeout(500);
  }
  await coletarAvisos();

  const ditos = avisos.size
    ? [...avisos].map(t => JSON.stringify(t)).join(' | ')
    : '(a tela nao disse NADA)';

  // Ainda no campo de escrita? Então o `INSERT` falhou e o compositor não
  // limpou — é a pista mais útil que existe aqui.
  const aindaNoCampo = await card.getByLabel(/Escreva um coment/i)
    .inputValue().catch(() => '');

  throw new Error(
    `o comentario "${texto}" nao apareceu na LISTA em ${timeout / 1000}s.\n`
    + `  O que a tela disse enquanto isso: ${ditos}\n`
    + `  Ainda no campo de escrita: ${aindaNoCampo.includes(texto) ? 'SIM — o INSERT falhou e o compositor nao limpou' : 'nao'}\n`
    + '\n'
    + '  Como ler isso:\n'
    + '    "Conteudo nao permitido"  -> a wordlist casou algo no texto. Troque o\n'
    + '                                 texto do teste, nao a wordlist.\n'
    + '    "Erro: ..."               -> o INSERT falhou e a mensagem vem do banco.\n'
    + '                                 Suspeitos: a policy `comments_insert`\n'
    + '                                 (exige auth.uid() = user_id E\n'
    + '                                 pode_publicar()) ou um trigger.\n'
    + '    "Voce esta suspenso"      -> a conta de teste foi suspensa. Isso NAO e\n'
    + '                                 bug do comentario.\n'
    + '    (nada)                    -> o clique nao chegou, ou a secao nao abriu.\n'
    + '                                 Veja a evidencia salva: se o campo de\n'
    + '                                 texto nao esta na imagem, o problema e o\n'
    + '                                 botao que ABRE, nao o que envia.');
}

// ── `[10/10]` A RESPOSTA aninhada saiu para `comentar/responder.mjs` ───────
//
// Corte de 317 linhas (§4). Ela é reexportada aqui para os dois roteiros que a
// importam (`cicloDoPost.mjs` e `duasContas.mjs`) não saberem do corte.
export { responderEEsperarAninhada } from './comentar/responder.mjs';
export { garantirSecaoAberta };
