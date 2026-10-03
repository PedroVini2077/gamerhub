/**
 * `[02/10]` O CHAT DA LIVE — o último dos quatro fluxos que ele listou em
 * 18/09, e o único que cabe numa conta só.
 *
 * ── Por que ele merece roteiro, e não só um teste de RLS ────────────────
 *
 * `live_chat` é a tabela mais diferente das outras do site:
 *
 *   - ela **não tem `hidden_at`** — por isso a fila de moderação, ao receber
 *     um item de `chat`, apaga em vez de ocultar, e o rótulo do botão muda
 *     para "Apagar mensagem". Foi um `else` silencioso que mandou item de
 *     `chat` para `community_posts`, onde o id nunca existe, e deixou o card
 *     girando em "Carregando..." para sempre;
 *   - ela é a única que depende de REALTIME para a tela fazer sentido;
 *   - e ela é **append-only sem retenção própria** — quem a limpa é o
 *     `cleanup_old_data()`, 7 dias depois de a live encerrar.
 *
 * Nenhuma dessas três é visível num teste de policy. A pergunta que só o
 * navegador responde é se a mensagem **aparece na lista** depois de enviada.
 *
 * ── A assertiva é RECARREGAR, como em todo o resto ──────────────────────
 *
 * A lista do chat é otimista e alimentada por realtime: a mensagem aparece na
 * tela de quem escreveu antes de o servidor confirmar. Conferir ali prova que
 * o React funciona, não que o `INSERT` passou.
 *
 * ── A limpeza vem de graça, e é por isso que ele é barato ───────────────
 *
 * A mensagem morre com a live: o roteiro de lives apaga o post no fim, e o
 * `ON DELETE CASCADE` leva o chat junto. Não há o que desfazer à mão — foi o
 * que tornou este o fluxo mais seguro dos quatro para automatizar.
 */

/**
 * @param {import('playwright').Page} page
 * @param {{ marca: string, ok: (m: string) => void }} ctx
 */
export async function percorrerChatDaLive(page, { marca, ok }) {
  const texto = `${marca} mensagem de chat`;

  const campo = page.locator('#live-chat-input');
  await campo.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    throw new Error(
      'o campo do chat da live nao apareceu (`#live-chat-input`).\n'
      + '    A live esta no ar — o passo anterior conferiu isso no BANCO —,\n'
      + '    entao ou o `ChatPanel` deixou de montar, ou ele mudou de id.');
  });

  await campo.fill(texto);

  // Só retorna quando o INSERT terminou. Sem esperar, o reload competiria com
  // a escrita em voo e o roteiro ficaria intermitente — pior do que roteiro
  // nenhum, porque ensina a reexecutar até passar.
  const [resposta] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/rest/v1/live_chat') && r.request().method() === 'POST',
      { timeout: 20000 },
    ),
    page.getByRole('button', { name: 'Enviar mensagem' }).click(),
  ]);

  if (!resposta.ok()) {
    throw new Error(
      `o POST de /live_chat voltou ${resposta.status()}.\n`
      + '    A policy de INSERT de `live_chat` exige live NO AR e autor apto —\n'
      + '    se a conta estiver suspensa, ela e recusada aqui e em lugar nenhum\n'
      + '    mais, porque o chat nao tem `hidden_at` para moderar depois.');
  }
  ok('chat da live: mensagem enviada sem erro do servidor');

  // ── A assertiva que importa: RECARREGAR ──────────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await campo.waitFor({ state: 'visible', timeout: 30000 });

  const naLista = page.getByText(texto).first();
  await naLista.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {
    throw new Error(
      `a mensagem "${texto}" NAO sobreviveu ao reload.\n`
      + '    O POST respondeu OK, entao a linha entrou — e sumiu da LEITURA.\n'
      + '    A policy de SELECT de `live_chat` e outra: INSERT aprovado com\n'
      + '    SELECT negado e exatamente o par que faz a tela do autor ficar\n'
      + '    vazia enquanto o dado existe.');
  });
  ok('chat da live: a mensagem PERSISTIU depois de recarregar');
}
