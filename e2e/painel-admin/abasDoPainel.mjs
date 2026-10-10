/**
 * As oito abas do painel renderizam, e a de Posts lista de verdade.
 *
 * `[10/10]` Extraído de `painel-admin.mjs` no corte de 449 linhas (teto 300,
 * §4). Movido SEM mudar comportamento: o bloco fechava sobre `page`, `aba`,
 * `ok` e `ABAS`, e agora os recebe — é a única diferença.
 *
 * **O comentário longo lá dentro fica.** Ele registra um teste que passou MESES
 * mentindo: o contador de linhas usava um seletor que nunca casava, dava zero
 * sempre, e o ramo `else` ("sem botão de carregar mais") registrava isso como
 * SUCESSO. Só caiu quando o banco passou de 20 posts.
 */
export async function conferirAbasDoPainel({ page, aba, ok, ABAS }) {
// ── 3. As abas renderizam ─────────────────────────────────────────────────
for (const nomeDaAba of ABAS) {
  try {
    await aba(page, nomeDaAba).click({ timeout: 15000 });
    // Espera algo além do esqueleto: a aba tem que produzir conteúdo.
    await page.waitForFunction(
      () => document.querySelector('main')?.innerText.trim().length > 80,
      { timeout: 15000 });
    ok(`aba "${nomeDaAba}" renderizou`);
  } catch (e) {
    await morrer(`abrir a aba "${nomeDaAba}"`, e);
  }
}

// ── 3b. Paginação e notificações ──────────────────────────────────────────
//
// Estas duas ficaram de fora da primeira versão, e a falta delas apareceu na
// hora errada: ao planejar a migração do `useAdminData` para React Query,
// ficou claro que as partes mais arriscadas — a paginação com estado local
// (`loadMorePosts`/`loadMoreKeys`) e o canal lateral que escreve as
// notificações no estado do pai — eram exatamente as que NENHUM teste tocava.
//
// Refatorar camada de dados sem cobrir as duas seria refatorar no escuro.
// Continua tudo somente leitura: clicar em "Carregar mais" só busca mais
// linhas, não altera nada.

// Paginação: a lista tem que CRESCER. Contar antes e depois é o que separa
// "o botão existe" de "o botão funciona" — um `onClick` quebrado deixaria o
// botão lá, clicável, sem trazer nada.
await aba(page, 'Posts').click();

// `[17/09]` Aqui havia `waitForTimeout(2000)` — espera FIXA, e ela reprovou
// este job DUAS vezes (12/09 e 17/09) com a mesma assinatura:
//
//     declara -1 ativo(s), estado vazio na tela: false
//
// Os dois valores juntos dizem exatamente o que aconteceu: a aba não tinha
// renderizado NEM o contador, NEM o estado vazio, NEM uma linha. É o terceiro
// caso que o comentário abaixo já previa — "a aba nao renderizou" —, e a
// causa não é o painel: é a espera de 2 s ter acabado antes dele.
//
// Em 12/09 eu tratei isso como lentidão do CI, re-rodei e vi verde. A causa
// estava certa e a conclusão, incompleta: espera por TEMPO num teste de
// navegador não é cautela, é um sorteio — ela passa na máquina rápida e
// reprova na lenta, pelo mesmo código. Alarme que depende de sorte ensina a
// ignorar o canal (§0.2, 4ª regra).
//
// Agora espera-se a CONDIÇÃO: a aba terminou quando mostra pelo menos uma
// das três coisas que ela tem obrigação de mostrar. Em runner rápido isso
// resolve em milissegundos; em runner lento, espera o quanto precisar.
await page.waitForFunction(() => {
  const main = document.querySelector('main');
  if (!main) return false;
  const txt = main.innerText;
  return main.querySelector('[data-post-row]') !== null
      || /nenhum post ativo/i.test(txt)
      || /Posts ativos\s*\d+/.test(txt);
}, null, { timeout: 20000 }).catch(() => {
  // O `catch` não engole: ele só deixa a asserção de baixo produzir a
  // mensagem boa, que diz o que o painel declarou e o que estava na tela.
  // Estourar aqui daria um `TimeoutError` cru, que não ensina nada.
});

const carregarMais = page.getByRole('button', { name: /carregar mais/i }).first();
const linhas = () => page.locator('main [data-post-row]').count();

// `[29/08]` O SELETOR É CONFERIDO ANTES DE QUALQUER COISA, e esta linha é a
// correção de um teste que passou meses mentindo.
//
// O contador usava `main tbody tr, main [data-post-row]`. Nenhum dos dois
// casava: a lista de posts é de `<div class="card">`, não de tabela, e o
// atributo não existia no componente. O contador dava ZERO — sempre.
//
// E ninguém percebeu porque o ramo de baixo (`else`) era o que rodava: com
// menos de uma página de posts o botão "Carregar mais" nem aparece, e o teste
// registrava "sem botao" como SUCESSO. Ele passava sem nunca ter contado uma
// linha na vida. Quando o banco passou de 20 posts, o botão surgiu e a
// asserção caiu com `0 linhas antes, 0 depois`.
//
// Exigir linhas ANTES de olhar o botão fecha esse esconderijo: com ou sem
// paginação, o teste agora prova que sabe enxergar um post.
// `[30/08]` ZERO TEM DUAS CAUSAS OPOSTAS, e confundi-las custou um CI
// vermelho por motivo nenhum.
//
// Em 30/08 este teste reprovou com o site legitimamente VAZIO: o dono tinha
// esvaziado a lixeira ("20 posts da lixeira apagados permanentemente"), e o
// painel mostrava "Nenhum post ativo" — funcionando perfeitamente. O teste
// dependia de existir dado em PRODUÇÃO, e alarme que grita à toa ensina a
// ignorar o canal (§0.2, 4ª regra).
//
// Mas aceitar zero de graça reabriria o buraco descrito acima. A saída é
// perguntar ao PRÓPRIO PAINEL quantos posts ele diz ter:
//
//   declara N > 0 e não acho linha   -> seletor quebrou. FALHA (a trava original)
//   declara 0 (ou nada) e mostra vazio -> site vazio. O painel está certo
//   não mostra o vazio e não há linha  -> a aba não renderizou. FALHA
//
// `declarados <= 0` e não `=== 0` porque com o site vazio o painel não
// imprime número nenhum ao lado de "Posts ativos" — o regex devolve -1. Ler
// isso como "declara zero" seria chute; aqui é o oposto: ausência de número
// só passa ACOMPANHADA do estado vazio explícito na tela.
//
// Assim a trava continua pegando a regressão de seletor sempre que houver
// dado, e para de mentir quando não houver.
const linhasVisiveis = await linhas();
const textoAba = await page.locator('main').innerText();
const declarados = Number(textoAba.match(/Posts ativos\s*(\d+)/)?.[1] ?? -1);
const mostraVazio = /nenhum post ativo/i.test(textoAba);

// `[02/09]` O ramo tolerante saiu. Ele existia porque o teste dependia de o
// banco ter post; agora ele CRIA o próprio, então a aba tem obrigação de
// listar pelo menos um. Zero linhas voltou a significar uma coisa só: o
// seletor quebrou.
//
// Manter a tolerância aqui seria deixar aberto o buraco original — o
// contador dava zero e o teste registrava sucesso.
if (linhasVisiveis === 0) {
  throw new Error(
    'nenhuma linha de post com [data-post-row], e este teste CRIOU um post\n'
    + `  antes de abrir o painel (o painel declara ${declarados} ativo(s), estado\n`
    + `  vazio na tela: ${mostraVazio}).\n`
    + '  Ou a aba nao carregou, ou o atributo saiu do PostsPanel — e sem ele o\n'
    + '  teste de paginacao passa a contar zero e vira decoracao.');
}
ok(`aba Posts lista ${linhasVisiveis} post(s)`);

// `[29/08]` MEDE O TOTAL CARREGADO, e não as linhas visíveis. Segunda
// correção do mesmo teste, e a causa é diferente da primeira.
//
// A aba Posts tem duas sub-abas — "Posts ativos" e "Lixeira" — e mostra só
// uma por vez. Na época, a paginação NÃO era por sub-aba: `fetchAll` trazia
// os 20 posts mais recentes MISTURADOS, e `loadMorePosts` os próximos 20,
// também misturados.
//
// Resultado observado no CI: 8 ativos, 14 na lixeira. O botão aparecia porque
// faltavam posts a carregar, mas os que vinham eram antigos — e antigos aqui
// estão quase todos apagados. A lista de ATIVOS não mudava, e contar só ela
// dava "8 antes, 8 depois" com a paginação funcionando perfeitamente.
//
// AINDA NO MESMO DIA a causa de fundo foi corrigida: cada sub-aba passou a
// paginar a si mesma (`lib/paginacaoDePosts.js`), então hoje o contador da
// sub-aba visível também cresceria. A soma FICA assim mesmo por dois motivos:
// ela continua verdadeira nos dois desenhos, e é a medida do que o botão de
// fato altera — quantos posts o painel tem em mãos.
const totalCarregado = async () => {
  const txt = await page.locator('main').innerText();
  const ativos = Number(txt.match(/Posts ativos\s*(\d+)/)?.[1] ?? -1);
  const lixeira = Number(txt.match(/Lixeira\s*(\d+)/)?.[1] ?? -1);
  if (ativos < 0 || lixeira < 0) {
    throw new Error(
      'nao consegui ler os contadores das sub-abas ("Posts ativos" / '
      + '"Lixeira"). Se os rotulos mudaram, atualize este teste — sem eles a '
      + 'medicao da paginacao volta a ser cega.');
  }
  return ativos + lixeira;
};

if (await carregarMais.count() > 0) {
  const antes = await totalCarregado();
  await carregarMais.click();
  await page.waitForTimeout(3000);
  const depois = await totalCarregado();
  if (depois <= antes) {
    throw new Error(
      `"Carregar mais" nao trouxe nada: ${antes} posts carregados antes, `
      + `${depois} depois. O botao existe mas a paginacao parou de funcionar.`);
  }
  ok(`paginacao de posts funciona (${antes} -> ${depois} posts carregados)`);
} else {
  // Menos posts que uma página inteira: não há o que paginar, e exigir o
  // botão aqui transformaria "banco pequeno" em teste vermelho. Mas agora
  // este ramo só é alcançado depois de o teste ter contado linhas de verdade.
  ok('paginacao de posts: sem botao (menos de uma pagina de posts)');
}

// Notificações: elas não vêm de uma consulta própria — são escritas no estado
// do painel pelo `useAdminData`, num canal lateral. Se esse fio se romper, a
// aba fica eternamente vazia sem erro nenhum.
await aba(page, 'Notificações').click();
await page.waitForTimeout(2500);
const textoNotifs = await page.locator('main').innerText();
if (!/nenhuma notificação ainda/i.test(textoNotifs) && textoNotifs.trim().length < 120) {
  throw new Error(
    'a aba de Notificacoes nao mostrou nem notificacao nem o texto de lista vazia. '
    + 'O canal que alimenta as notificacoes provavelmente se rompeu.');
}
ok('aba de Notificacoes com estado definido (lista ou vazio explicito)');
}
