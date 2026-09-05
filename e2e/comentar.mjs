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
 * **Não** prova a moderação do comentário nem a resposta aninhada — essas são
 * outras telas, e prometer cobertura que não existe é pior do que não ter (§1.1).
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
