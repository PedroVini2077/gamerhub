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
 * A conferência é **estrutural**: o bloco do comentário pai tem de CONTER o
 * texto da resposta, porque é isso que o aninhamento é — o `CommentCard` da
 * resposta é renderizado dentro do `CommentCard` do pai.
 *
 * Comparar a POSIÇÃO dos dois textos foi a primeira tentativa e estava errada:
 * o recuo do bloco convive com um avatar menor na resposta, a soma pode dar
 * para qualquer lado, e o CI reprovou uma resposta que estava certa.
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
  // Reabre a seção se ela fechou — ver `garantirSecaoAberta`. E tenta de novo
  // por até 20s, porque o fechamento acontece DEPOIS de a lista aparecer: a
  // primeira versão deste passo viu o comentário, contou os botões no instante
  // seguinte e achou zero.
  const pai = card.getByText(aoComentario, { exact: false }).first();
  const botoes = card.getByRole('button', { name: /^Responder$/ });

  let quantos = 0;
  const limite = Date.now() + 20000;
  do {
    await garantirSecaoAberta(card);
    if (await pai.isVisible().catch(() => false)) quantos = await botoes.count();
    if (quantos === 1) break;
    await page.waitForTimeout(500);
  } while (Date.now() < limite);

  // ── Por que se CONTA o botão em vez de caçar o do comentário pai ────────
  //
  // A primeira versão subia do texto até o `div` que o contém
  // (`card.locator('div').filter({ has: pai }).last()`) e deu timeout. Eu
  // culpei o `has:` do Playwright — e essa explicação estava ERRADA, coisa que
  // a instrumentação mostrou depois: o card não tinha botão "Responder"
  // NENHUM, porque a seção de comentários tinha se fechado sozinha. Cadeia
  // nenhuma acharia o que não estava lá.
  //
  // Fica como está porque é melhor do jeito certo: este post é o da própria
  // execução e tem exatamente UM comentário, então existe exatamente UM
  // "Responder". Contar antes transforma "cliquei no botão errado" — que
  // passaria verde — numa falha que diz o que aconteceu.
  if (quantos !== 1) {
    // Instrumentar em vez de chutar (§1.2). Sem a lista, "achei 0" manda
    // procurar no `onReply` — e pode ser o nome acessivel, o botao estar
    // escondido, ou a secao ter fechado. A lista responde as tres de uma vez.
    const nomes = await card.getByRole('button').evaluateAll(
      (bs) => bs.map((b) => JSON.stringify((b.getAttribute('aria-label') || b.innerText || '').trim())),
    ).catch(() => ['(nao consegui listar)']);

    throw new Error(
      `esperava UM botao "Responder" no card e achei ${quantos}.\n`
      + `    Botoes que existem no card: ${nomes.join(', ')}\n`
      + '    Zero por 20s, mesmo reabrindo a secao a cada meio segundo: o\n'
      + '    `onReply` parou de ser passado pelo `CommentSection`, o comentario\n'
      + '    nao volta para a lista, ou o nome acessivel mudou — a lista acima\n'
      + '    diz qual dos tres.\n'
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

  // ── A prova de que é RESPOSTA, e não comentário solto ────────────────────
  //
  // `[24/09]` A primeira versão comparava a posição X dos DOIS textos e exigia
  // que a resposta estivesse mais à direita. O CI reprovou com `x=321` contra
  // `x=335` — e a resposta estava CERTA: conferido no banco, ela tinha
  // `parent_id`. O recuo do bloco (`pl-6`) convive com um avatar MENOR na
  // resposta (24px contra 28), e a soma dos dois pode dar para qualquer lado.
  // Eu tinha transformado um detalhe de layout em veredito.
  //
  // A pergunta certa não é "está mais à direita?", é **"está DENTRO do bloco
  // do comentário pai?"** — que é literalmente o que o aninhamento é: o
  // `CommentCard` da resposta é renderizado dentro do `CommentCard` do pai.
  //
  // A subida é de 3 níveis, e a estrutura está em `CommentCard.jsx`:
  //
  //     <div ... pl-6 se for resposta>   <- raiz do CommentCard   (3 acima)
  //       <div class="flex items-start"> <- a linha               (2 acima)
  //         <AvatarPopup/>
  //         <div class="flex-1 min-w-0"> <- a coluna              (1 acima)
  //           <p>conteúdo</p>            <- o texto
  //
  // Se essa estrutura mudar, isto estoura — e estourar é o certo: quem mexeu
  // precisa reconferir o que significa "aninhada" depois da mudança.
  // Re-resolve o `pai` a cada tentativa: a lista se remonta sozinha (ver
  // `garantirSecaoAberta`), e um elemento capturado antes da remontagem
  // responde pela árvore VELHA, onde a resposta ainda não existe.
  const medirAninhamento = () => pai.evaluate((elPai, textoDaResposta) => {
    const raiz = elPai.parentElement?.parentElement?.parentElement;
    if (!raiz) return { erro: 'nao achei a raiz do CommentCard 3 niveis acima do <p>' };
    return {
      contem: raiz.innerText.includes(textoDaResposta),
      noDocumento: elPai.isConnected,
      recuoDaRaiz: raiz.getBoundingClientRect().x,
      recuoDaLinha: raiz.querySelector('div')?.getBoundingClientRect().x ?? null,
      textoDaRaiz: raiz.innerText.replace(/\s+/g, ' ').slice(0, 300),
    };
  }, texto);

  let aninhada = await medirAninhamento();
  const prazo = Date.now() + 15000;
  while (!aninhada.contem && !aninhada.erro && Date.now() < prazo) {
    await page.waitForTimeout(500);
    aninhada = await medirAninhamento();
  }

  if (aninhada.erro) throw new Error(`${aninhada.erro} — a estrutura do CommentCard mudou.`);

  if (!aninhada.contem) {
    throw new Error(
      `a resposta "${texto}" NAO esta dentro do bloco do comentario pai (15s).\n`
      + `    pai ainda no documento: ${aninhada.noDocumento}\n`
      + `    raiz em x=${aninhada.recuoDaRaiz}, linha em x=${aninhada.recuoDaLinha}\n`
      + `    texto da raiz do pai: ${JSON.stringify(aninhada.textoDaRaiz)}\n`
      + '    Ela entrou na lista como comentario de primeiro nivel. O texto na\n'
      + '    tela nao prova que o `parent_id` chegou — e resposta que vira\n'
      + '    comentario solto nao estoura, nao loga e nao quebra nada (§1.5).\n'
      + '    Confira o `submitReply` do CommentCard, o `repliesByRoot` do\n'
      + '    CommentSection, e a FK composta da SEC-033.');
  }

  return alvo;
}
