import { garantirSecaoAberta } from '../comentar.mjs';

/**
 * Responder a um comentário, e esperar a resposta ANINHADA aparecer.
 *
 * `[10/10]` Separada de `comentar.mjs` no corte de 317 linhas (teto 300, §4).
 * O corte é por ação: comentar num post e responder a um comentário são dois
 * fluxos com telas, âncoras e esperas diferentes — e a resposta é a que tem a
 * parte frágil, porque depende do `data-comentario` do `CommentCard`.
 *
 * Movida sem mudar comportamento.
 */
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
  // `[25/09]` Esta conferência já errou DUAS vezes, e as duas por olhar a
  // coisa errada:
  //
  //   1a  comparava a POSIÇÃO X dos dois textos. Reprovou uma resposta certa:
  //       o recuo do bloco convive com um avatar menor, e a soma pode dar para
  //       qualquer lado.
  //   2a  subia um número FIXO de níveis a partir do texto. Reprovou outra
  //       resposta certa quando o conteúdo passou a ser desenhado pelo
  //       `TextoFormatado`, que acrescenta um nível.
  //
  // As duas tinham o mesmo defeito de fundo: contrato IMPLÍCITO com o layout.
  // Agora o bloco de um comentário se identifica com `data-comentario`, que é
  // contrato explícito e sobrevive a mudança de aparência.
  const textoDaResposta = texto;
  const blocoDoPai = card.locator('[data-comentario]').filter({ hasText: aoComentario });

  let aninhada = null;
  const prazo = Date.now() + 15000;
  do {
    // O bloco do PAI é o que contém o texto do pai e NÃO é o da resposta —
    // o filtro por texto pega os dois quando a resposta já está dentro dele.
    const quantos = await blocoDoPai.count();
    if (quantos > 0) {
      const noBloco = await blocoDoPai.first().innerText().catch(() => '');
      if (noBloco.includes(textoDaResposta)) { aninhada = { ok: true }; break; }
      aninhada = { ok: false, texto: noBloco.replace(/\s+/g, ' ').slice(0, 220), quantos };
    }
    await page.waitForTimeout(500);
  } while (Date.now() < prazo);

  if (!aninhada?.ok) {
    throw new Error(
      `a resposta "${texto}" NAO esta dentro do bloco do comentario pai (15s).\n`
      + `    blocos [data-comentario] com o texto do pai: ${aninhada?.quantos ?? 0}\n`
      + `    texto do bloco do pai: ${JSON.stringify(aninhada?.texto ?? '(nao achei)')}\n`
      + '    Ela entrou na lista como comentario de primeiro nivel. O texto na\n'
      + '    tela nao prova que o `parent_id` chegou — e resposta que vira\n'
      + '    comentario solto nao estoura, nao loga e nao quebra nada (§1.5).\n'
      + '    Confira o `submitReply` do CommentCard, o `repliesByRoot` do\n'
      + '    CommentSection, e a FK composta da SEC-033.\n'
      + '    Se `data-comentario` sumiu do CommentCard, o problema e aqui, nao la.');
  }

  return alvo;
}
