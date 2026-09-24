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

  // O rótulo do botão MUDA com a contagem: "Comentar" quando é zero,
  // "N comentários" quando não é. Casar os dois evita um teste que só funciona
  // no post recém-criado.
  const abrir = card.getByRole('button', { name: /^(Comentar|\d+ comentários?)$/ });
  await abrir.waitFor({ state: 'visible', timeout: 15000 });
  await abrir.click();

  const campo = card.getByLabel(/Escreva um comentário/i);
  await campo.waitFor({ state: 'visible', timeout: 15000 });
  await campo.fill(texto);
  await card.getByRole('button', { name: 'Enviar comentário' }).click();

  const alvo = card.getByText(texto, { exact: false }).first();
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

  throw new Error(
    `o comentario "${texto}" nao apareceu em ${timeout / 1000}s.\n`
    + `  O que a tela disse enquanto isso: ${ditos}\n`
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

/**
 * `[24/09]` RESPONDER a um comentário — e conferir que a resposta é RESPOSTA.
 *
 * ── Por que este passo existe ───────────────────────────────────────────────
 *
 * O cabeçalho acima dizia, em 05/09, que este roteiro **não** prova a resposta
 * aninhada. Era verdade e continuou verdade por 19 dias. Segundo dos sete
 * fluxos que o dono listou em 18/09.
 *
 * ── O que ele prova, e por que a indentação é uma assertiva de verdade ─────
 *
 * Resposta que aparece na lista como se fosse comentário solto é um bug que
 * **nada acusa**: o `INSERT` passou, o texto está na tela, e só a estrutura
 * está errada. A conferência é o `parent_id` ter chegado — e o sinal visível
 * disso é a resposta nascer **recuada** em relação ao comentário pai.
 *
 * Comparado por GEOMETRIA (`boundingBox().x`), não pela classe do Tailwind: a
 * classe é o mecanismo de hoje e renomeá-la não muda o que a pessoa vê. Medir
 * o que aparece é o que o `conteudo-visivel.mjs` já faz pelo mesmo motivo.
 *
 * ── Envia por ENTER, e não é atalho ────────────────────────────────────────
 *
 * O botão do compositor de resposta tem o MESMO `aria-label` do compositor
 * principal (`Enviar comentário`), então dentro do card os dois são ambíguos —
 * e o Playwright recusa seletor ambíguo, ainda bem. O `CommentComposer` envia
 * com Enter, então o caminho de teclado resolve a ambiguidade **e** cobre um
 * caminho que nenhum roteiro exercitava.
 *
 * ── Limpeza ───────────────────────────────────────────────────────────────
 *
 * Nenhuma, e pelo mesmo motivo do comentário: cascata do post do teste.
 */
export async function responderEEsperarAninhada(page, { card, aoComentario, texto, timeout = 30000 }) {
  const pai = card.getByText(aoComentario, { exact: false }).first();
  await pai.waitFor({ state: 'visible', timeout: 15000 });

  // ── Por que NÃO se procura o botão "dentro do bloco do pai" ──────────────
  //
  // A primeira versão subia do texto até o `div` que o contém
  // (`card.locator('div').filter({ has: pai }).last()`) para pegar o
  // "Responder" daquele comentário. O CI reprovou com timeout, e a causa está
  // no log: o `has:` do Playwright espera um locator relativo ao de fora, e eu
  // passei um construído a partir do `card` — a cadeia se re-ancorou na página
  // e a interseção nunca casou.
  //
  // A saída não é uma cadeia mais esperta: é **exigir o que se sabe ser
  // verdade**. Este post é o da própria execução e tem exatamente UM
  // comentário, então existe exatamente UM "Responder". Contar antes é o que
  // transforma "cliquei no botão errado" — que passaria verde — numa falha
  // que diz o que aconteceu.
  const botoes = card.getByRole('button', { name: /^Responder$/ });
  const quantos = await botoes.count();
  if (quantos !== 1) {
    throw new Error(
      `esperava UM botao "Responder" no card e achei ${quantos}.\n`
      + '    Zero: o `onReply` parou de ser passado pelo `CommentSection`, ou o\n'
      + '    comentario nao esta na tela — a secao fecha sozinha?\n'
      + '    Mais de um: o post ganhou outro comentario. Este passo assume que\n'
      + '    o post e o da execucao e tem so o comentario dela; se isso mudou,\n'
      + '    o passo precisa escolher o pai de proposito, nao por sorte.');
  }
  await botoes.click();

  const campo = card.getByLabel(/Escreva uma resposta/i);
  await campo.waitFor({ state: 'visible', timeout: 15000 });
  await campo.fill(texto);
  await campo.press('Enter');

  const alvo = card.getByText(texto, { exact: false }).first();
  await alvo.waitFor({ state: 'visible', timeout }).catch(() => {
    throw new Error(
      `a resposta "${texto}" nao apareceu em ${timeout / 1000}s.\n`
      + '    O compositor de resposta envia com Enter (CommentComposer). Se o\n'
      + '    campo aceitou o texto e nada aconteceu, o INSERT falhou: suspeitos\n'
      + '    sao a policy `comments_insert` e a FK composta da SEC-033, que\n'
      + '    exige que o comentario pai seja do MESMO post.');
  });

  // A prova de que é RESPOSTA, e não comentário solto com o mesmo texto.
  const caixaPai = await pai.boundingBox();
  const caixaResposta = await alvo.boundingBox();
  if (!caixaPai || !caixaResposta) {
    throw new Error('nao consegui medir a posicao do comentario ou da resposta na tela.');
  }
  if (caixaResposta.x <= caixaPai.x) {
    throw new Error(
      `a resposta apareceu SEM recuo (x=${caixaResposta.x} contra x=${caixaPai.x} do pai).\n`
      + '    Ela entrou na lista como comentario solto. O texto estar na tela\n'
      + '    nao prova que o `parent_id` chegou — e resposta que vira comentario\n'
      + '    de primeiro nivel nao estoura, nao loga e nao quebra nada (§1.5).\n'
      + '    Confira o `submitReply` do CommentCard e o `isReply` que aplica o\n'
      + '    recuo.');
  }
  return alvo;
}
