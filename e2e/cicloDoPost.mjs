/**
 * `[24/09]` O CICLO DE VIDA DE UM POST, num navegador de verdade.
 *
 *     publicar -> curtir -> comentar -> responder -> apagar -> varrer sobras
 *
 * ── Por que ele saiu do `fluxos.mjs` ──────────────────────────────────────
 *
 * O `fluxos.mjs` chegou a 288 linhas de um teto de 300 (§4), e o motivo é que
 * ele acumulou dois trabalhos diferentes: **a sessão** (entrar, alcançar cada
 * rota, ser negado no painel, sair) e **o conteúdo** (o ciclo acima). Os
 * próximos fluxos que faltam da auditoria de 18/09 — chat da live, perfil,
 * notificações, ocultar — não cabiam mais lá dentro.
 *
 * **O corte é MECÂNICO:** os passos são os mesmos, na mesma ordem, com as
 * mesmas mensagens. O que muda é onde moram.
 *
 * ── Uma ordem que NÃO é arbitrária ────────────────────────────────────────
 *
 * Responder vem antes de apagar, e isso já custou um ciclo de CI: a primeira
 * versão do passo de responder ficou DEPOIS do `Deletar post`, e sem post não
 * há comentário para responder. Quem mexer na ordem precisa saber disso.
 *
 * ── A varredura de sobras fica aqui, e é de propósito ─────────────────────
 *
 * Só uma conta LOGADA enxerga o feed, e este é o roteiro que tem sessão. Ela
 * é a defesa contra o padrão de falha catalogado em 01/09: "crio dado de teste
 * que confunde o dono".
 */
import {
  publicarEEsperarNoFeed, REGEX_DE_SOBRA, sobrasAntigas, IDADE_DE_SOBRA_MS,
} from './publicarPost.mjs';
import { comentarEEsperarNaLista, responderEEsperarAninhada } from './comentar.mjs';
import { curtirEConferirPersistencia } from './curtir.mjs';

/**
 * @param {import('playwright').Page} page
 * @param {object} p
 * @param {string}   p.base    URL do site
 * @param {string}   p.marca   marca unica desta execucao
 * @param {Function} p.ok      registra um passo verde no relatorio do chamador
 * @param {import('playwright').Locator} p.main  o `<main>` da pagina
 */
export async function percorrerCicloDoPost(page, { base, marca, ok, main }) {
  const TITULO = `${marca} post automatico`;
  const CORPO  = 'Publicado pelo teste automatizado. Se este post ficou no ar, o E2E falhou na limpeza.';
  const COMENTARIO = `${marca} comentario automatico`;
  const RESPOSTA   = `${marca} resposta automatica`;

  // ── 4. Publicar → conferir → apagar ─────────────────────────────────────
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // O post aparecendo no feed prova a ida INTEIRA: o INSERT passou pela RLS,
  // os triggers rodaram sem estourar, e o feed releu.
  //
  // `[02/09]` O passo virou helper compartilhado com o `painel-admin.mjs` — as
  // duas copias eram identicas, e as duas precisavam da mesma melhoria: dizer
  // O QUE A TELA DISSE quando o post nao aparece.
  await publicarEEsperarNoFeed(page, { marca, titulo: TITULO, corpo: CORPO });
  const tituloNoFeed = page.locator('h2', { hasText: marca });
  ok('post publicado e visível no feed');

  // `.card` é a raiz do PostCard: garante que o botão é o do post desta
  // execução, nunca o de um vizinho.
  const card = page.locator('.card').filter({ has: tituloNoFeed });

  // ── 4a. Curtir → recarregar → descurtir → recarregar ────────────────────
  //
  // `[24/09]` Primeiro dos fluxos que ele listou em 18/09. A curtida e
  // otimista, entao a tela mente por design entre o clique e a resposta — o
  // que prova alguma coisa e o RELOAD. O porque de cada passo esta no
  // `curtir.mjs`, inclusive por que o DESCURTIR e o lado perigoso.
  await curtirEConferirPersistencia(page, { base, marca });
  ok('curtida gravada e removida de verdade (conferido depois de recarregar)');

  // ── 4b. Comentar no próprio post ────────────────────────────────────────
  //
  // `[05/09]` Este passo nasceu de um número, não de um bug relatado: a
  // produção tinha 150 posts e ZERO comentários, e NENHUM roteiro comentava.
  // "Comentar funciona" era suposição minha — e as duas piores falhas deste
  // projeto (moderação de comentário quebrada por meses, IA falhando em 26 de
  // 26) eram exatamente isto: caminho sem usuário e sem teste.
  //
  // Vai no próprio post do teste porque o comentário some junto com ele:
  // `comments_post_id_fkey` é ON DELETE CASCADE, verificado no banco. Comentar
  // no post de outra pessoa deixaria lixo que o passo 4d não apanha.
  await comentarEEsperarNaLista(page, { card, texto: COMENTARIO });
  ok('comentário publicado e visível na lista');

  // ── 4b-bis. A BUSCA acha o post recém-publicado ─────────────────────────
  //
  // `[24/09]` A prova de ponta a ponta da busca nova: FTS no Postgres -> RPC
  // `buscar_posts` -> RLS -> `POST_SELECT` -> tela. Nenhum pedaço dessa
  // corrente tinha cobertura de navegador.
  //
  // Busca pelo NÚMERO da marca (`[e2e 1790…]`), e não por palavra do texto:
  // o número é único por execução, então o resultado não depende de quantos
  // posts existem no banco nem de quais. O `to_tsvector` transforma o número
  // num lexema próprio — conferido no banco antes de escrever isto.
  const numeroDaMarca = marca.match(/(\d{10,})/)?.[1];
  if (!numeroDaMarca) {
    throw new Error(
      `nao consegui extrair o numero da marca "${marca}".\n`
      + '    O `marcaDeTeste` escreve `[prefixo <epoch>]`. Se o formato mudou,\n'
      + '    este passo precisa de outro termo de busca — um que continue\n'
      + '    sendo unico por execucao.');
  }

  await page.goto(`${base}/busca?q=${numeroDaMarca}`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });

  const achado = page.locator('h2', { hasText: marca }).first();
  await achado.waitFor({ state: 'visible', timeout: 30000 }).catch(async () => {
    const naTela = await page.locator('main').innerText().catch(() => '(sem main)');
    throw new Error(
      `a busca por "${numeroDaMarca}" nao achou o post desta execucao.\n`
      + `    O que a tela disse: ${JSON.stringify(naTela.slice(0, 200))}\n`
      + '\n'
      + '    Como ler isso:\n'
      + '      "Nada encontrado"  -> a corrente quebrou em algum ponto. Suspeitos,\n'
      + '                            do banco para a tela: a coluna gerada `busca`\n'
      + '                            nao indexou, a RPC `buscar_posts` nao\n'
      + '                            devolveu, ou a RLS escondeu o post.\n'
      + '      "Buscando..."      -> a consulta nao voltou; e rede ou erro na RPC.\n'
      + '      "Escreva algo"     -> o `?q=` nao chegou ao componente.');
  });
  ok('a busca achou o post recém-publicado');

  // ── 4c. Responder ao próprio comentário ─────────────────────────────────
  //
  // `[24/09]` Segundo dos fluxos de 18/09. O cabeçalho do `comentar.mjs` dizia
  // desde 05/09 que a resposta aninhada NÃO era coberta — era verdade, e ficou
  // verdade por 19 dias. A assertiva que importa é o RECUO: resposta que entra
  // na lista como comentário solto não estoura nada.
  //
  // ANTES de apagar o post, e isso não é detalhe: a primeira versão deste
  // passo ficou DEPOIS do `Deletar post` e o CI reprovou no passo 22 — sem
  // post, não há comentário para responder. Ancorar no marcador errado é o
  // tipo de erro que só o roteiro rodando de verdade mostra.
  // Volta ao feed: os passos seguintes mexem no card de lá, e a busca deixou
  // a navegação em `/busca`.
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await card.waitFor({ state: 'visible', timeout: 30000 });

  await responderEEsperarAninhada(page, { card, aoComentario: COMENTARIO, texto: RESPOSTA });
  ok('resposta aninhada publicada e recuada sob o comentário pai');

  await card.getByRole('button', { name: 'Deletar post' }).click();
  await page.getByRole('button', { name: /^Deletar$/ }).click();

  // A exclusão só acontece quando a contagem de 5s zera (janela pra cancelar).
  // A conta de teste é `role = 'user'`: para ela o post soft-deletado some do
  // feed. Para admin ele continuaria visível com o aviso "Post excluído" — por
  // isso o passo 3 existe e por isso o E2E não pode rodar com conta de staff.
  await tituloNoFeed.first().waitFor({ state: 'detached', timeout: 30000 });
  ok('post apagado e fora do feed depois da contagem');

  // ── 4d. NENHUM post de teste sobrando de execuções anteriores ────────────
  //
  // `[01/09]` Padrão de falha meu, catalogado: "crio dado de teste que confunde
  // o dono". Já aconteceu duas vezes — uma fila de moderação com itens falsos
  // marcados como se a IA tivesse detectado, e um post de e2e que ficou no ar
  // porque o teste morreu antes do passo que apaga.
  //
  // Até agora a única defesa era eu lembrar de conferir. Isto passa a olhar
  // sozinho: se o feed tiver marca `[e2e` que não seja a desta execução, é
  // lixo de uma rodada que quebrou no meio.
  //
  // Por que aqui e não num script próprio: só uma conta LOGADA enxerga o feed
  // (o anônimo leva 401), e este é o único teste que tem sessão.
  // `[11/09]` O filtro era `/\[e2e /` escrito à mão, e por isso NÃO enxergava
  // o `[painel `. Um post do teste de painel ficou visível no site desde 10/09
  // com este detector ligado e verde. Agora o padrão vem de
  // `PREFIXOS_DE_TESTE`, que é a lista única.
  //
  // `[11/09]` E o filtro passou a ser por IDADE, porque ver os dois prefixos
  // sozinho produziu alarme falso: o job `painel de admin` roda EM PARALELO
  // contra o mesmo banco, e o post dele estava no feed legitimamente. O
  // porquê do corte de 30 min está em `IDADE_DE_SOBRA_MS`.
  const titulos = await main.locator('h2').filter({ hasText: REGEX_DE_SOBRA })
    .filter({ hasNotText: marca }).allInnerTexts();
  const sobras = sobrasAntigas(titulos);
  if (sobras.length > 0) {
    throw new Error(
      `${sobras.length} post(s) de teste sobrando no feed de execucoes anteriores:\n`
      + sobras.map((t) => `    ${t}`).join('\n') + '\n'
      + '  Alguma rodada morreu antes do passo que apaga, e o lixo ficou no ar\n'
      + '  para quem usa o site. Apague pelo painel admin (aba Posts) e veja\n'
      + '  POR QUE aquela rodada quebrou — o post sobrando e o sintoma, nao a causa.\n'
      + `  (So conta o que tem mais de ${IDADE_DE_SOBRA_MS / 60000} min: o job do\n`
      + '   painel roda em paralelo, e o post DELE nao e sobra.)');
  }
  ok('nenhum post de teste sobrando de execuções anteriores');
}
