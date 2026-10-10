/**
 * A aba NEWS pelo navegador: criar rascunho, e NÃO poder publicar.
 *
 * `[10/10]` Extraído de `painel-admin.mjs` no corte de 449 linhas (teto 300,
 * §4). Movido SEM mudar comportamento — recebe `page`, `aba`, `ok` e
 * `marcaDeTeste`, que antes vinham do fechamento.
 *
 * **Por que é pelo NAVEGADOR:** nasceu de um bug que o dono achou. `conteudo`
 * era `NOT NULL` e criar matéria estava quebrado — eu tinha provado leitura e
 * corte editorial em ROLLBACK, as duas COM `conteudo`, e nunca rodei o insert
 * que o painel executa. A conta do CI é `admin`, então o mesmo passo cobre a
 * outra metade de graça: o botão **Publicar não pode aparecer**.
 */
export async function conferirAbaDeNews({ page, aba, ok, marcaDeTeste }) {
// ── `[25/09]` A aba NEWS: criar rascunho, e NÃO poder publicar ────────────
//
// Este passo nasceu de um bug que o DONO achou minutos depois de eu entregar
// o painel: `criarRascunho` não mandava `conteudo`, a coluna era `NOT NULL`,
// e criar matéria estava simplesmente QUEBRADO. Eu tinha provado o caminho de
// leitura e o corte editorial em ROLLBACK — com `conteudo` preenchido nos
// dois — e nunca rodei o INSERT que o painel executa. Provei o caminho que eu
// tinha na cabeça, não o que o código faz (§1.2).
//
// Por isso a prova agora é pelo NAVEGADOR: é o único lugar onde o INSERT que
// roda é o de verdade.
//
// E o mesmo passo cobre a outra metade, de graça: esta conta é `admin`, então
// "Publicar" NÃO pode aparecer. Se aparecer, o corte editorial virou enfeite.
// A guarda existe porque a PRIMEIRA versão deste passo ficou depois da
// limpeza, que navega para `/` — e o clique na aba virou um timeout de 30 s
// dizendo `waiting for locator`, sem nunca mencionar que a página era outra.
// Estado suposto é o que o §1.5 chama de falha muda: a informação existe na
// URL e não chega em forma utilizável.
if (!page.url().includes('/admin')) {
  throw new Error(
    `o passo do News esperava estar em /admin, e esta em ${page.url()}.\n`
    + '    Algum passo anterior navegou para fora e nao voltou. O bloco do '
    + 'News precisa ficar ANTES da limpeza, que vai para o feed.');
}
await aba(page, 'News').click();
const tituloDaMateria = `${marcaDeTeste('[painel ')} materia automatica`;
await page.getByLabel('Título da matéria').fill(tituloDaMateria);
await page.getByRole('button', { name: /criar rascunho/i }).click();

// O editor abre com o título no campo — é como o painel confirma que criou.
const campoTitulo = page.getByLabel('Título', { exact: true });
try {
  await campoTitulo.waitFor({ state: 'visible', timeout: 20000 });
} catch {
  const naTela = await page.locator('main').innerText();
  throw new Error(
    'criar rascunho NAO abriu o editor.\n'
    + `    O que a tela diz: ${naTela.replace(/\s+/g, ' ').slice(0, 300)}\n\n`
    + '    Suspeito principal: uma coluna de `news_articles` que e NOT NULL e '
    + 'que o `criarRascunho` nao manda. Foi exatamente isso com `conteudo` '
    + 'em 25/09 — e a mensagem do Postgres aparece em vermelho no card.');
}
ok('rascunho de materia criado pelo painel');

if (await page.getByRole('button', { name: /^Publicar$/ }).count()) {
  throw new Error(
    'o botao PUBLICAR apareceu para uma conta `admin`.\n'
    + '    O corte editorial (decisao do dono, 25/09) diz que publicar e de '
    + 'super admin e owner. O banco ainda recusaria, mas a tela estaria '
    + 'oferecendo o que o servidor vai negar — e isso e a tela mentindo.');
}
ok('PUBLICAR nao e oferecido a admin');

await page.getByRole('button', { name: /mandar para revisao|mandar para revisão/i }).click();
await page.getByText(/mandado para revis/i).waitFor({ timeout: 20000 });
ok('materia mandada para revisao');

// A matéria FICA: admin não apaga (só super). A retenção diária do
// `cleanup_old_data()` limpa rascunho de teste com mais de 2 h — mesma
// disciplina dos posts do CI.

}
