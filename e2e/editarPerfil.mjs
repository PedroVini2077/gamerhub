/**
 * `[02/10]` EDITAR O PRÓPRIO PERFIL — e a pergunta é a mesma do curtir:
 * **o servidor GUARDOU?**
 *
 * ── Por que este passo existe, e por que ele não é "mais um formulário" ────
 *
 * As colunas de `profiles` são o lugar onde este projeto mais se machucou. A
 * correção de LGPD que revogou colunas (SEC-025) **derrubou postar, comentar,
 * mural e chat** de uma vez, porque as policies de INSERT liam
 * `suspended_until`. Está no `POSTURA.md` como o primeiro dos três casos de
 * "correção de segurança legítima que derrubou o site em silêncio".
 *
 * Privilégio de coluna é por PAPEL, e o formulário escreve **nove** colunas.
 * Revogar uma delas não quebra teste nenhum de `src/`: o build passa, o
 * componente monta, o `updateProfile` existe. O que acontece é a pessoa clicar
 * em Salvar e o dado não ir — e isso só aparece num navegador de verdade, com
 * a chave anônima de verdade, que é o que este roteiro é.
 *
 * ── Por que RECARREGAR é a única assertiva honesta ────────────────────────
 *
 * Mesma lição do `curtir.mjs`. O formulário mantém o que você digitou em
 * estado local, e o `useProfileForm` **de propósito** não repopula o form a
 * cada `refreshProfile()` — senão um poll em segundo plano apagaria o que a
 * pessoa está digitando. Consequência: depois de salvar, a tela mostra o texto
 * novo **venha o que vier do servidor**. Conferir ali não prova nada.
 *
 * O toast também não serve: ele diz "Perfil atualizado!" e a única coisa que
 * o impede de mentir é o `count: 'exact'` do `fromCount` — que é justamente o
 * mecanismo que este roteiro existe para testar, não para confiar.
 *
 * ── A limpeza é PROVADA, não prometida ────────────────────────────────────
 *
 * Ordem do dono sobre os E2E que escrevem em produção: *"um por vez, com
 * limpeza provada"*. Este roteiro guarda os valores originais, escreve os de
 * teste, e no fim **restaura e recarrega para conferir que restaurou**. Se a
 * restauração falhar, ele reprova dizendo o que ficou para trás — perfil de
 * conta de teste com lixo é lixo que gente de verdade pode ver no perfil
 * público.
 *
 * ── O que ele NÃO cobre, dito com todas as letras ─────────────────────────
 *
 * Duas colunas das nove (`bio` e `discord`), escolhidas porque cobrem os dois
 * tratamentos diferentes do `useProfileForm`: `bio` vai crua (string vazia é
 * valor válido ali) e `discord` passa por `trim()` e vira `NULL` se esvaziar.
 * As outras sete seguem um dos dois caminhos.
 *
 * E ele **não** cobre a foto: upload mexe no storage, que tem cota de egress
 * e cujo caminho é `{id}/avatar.ext` — sobrescrever a cada execução do CI é
 * custo recorrente sem achado novo.
 */

/** Marca única por execução: nunca confunde com o que já estava lá. */
export function marcaDePerfil() {
  return `e2e ${Date.now()}`;
}

/**
 * Os campos exercitados, e a MARCA que cada um exige na tela.
 *
 * A `ancora` nao e decoracao: `perfilTemOsCamposDoE2e.test.js` a procura em
 * `src/components/profile/`. Sem isso, renomear um `aria-label` faria este
 * roteiro morrer no CI com um `waiting for locator` mudo, que nao diz a
 * ninguem que o conserto e de uma linha noutro arquivo.
 */
export const CAMPOS = [
  { nome: 'bio',     ancora: 'id="bio"',           seletor: (p) => p.locator('#bio') },
  { nome: 'discord', ancora: "label: 'Discord'",   seletor: (p) => p.getByRole('textbox', { name: 'Discord' }) },
];

async function lerCampos(page) {
  const valores = {};
  for (const c of CAMPOS) valores[c.nome] = await c.seletor(page).inputValue();
  return valores;
}

async function escreverEGravar(page, valores) {
  for (const c of CAMPOS) await c.seletor(page).fill(valores[c.nome]);

  // Só retorna quando o PATCH terminou. Sem isto, o reload seguinte competiria
  // com a escrita em voo e o roteiro ficaria intermitente — pior do que
  // roteiro nenhum, porque ensina a reexecutar até passar.
  const [resposta] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH',
      { timeout: 20000 },
    ),
    page.getByRole('button', { name: /Salvar Perfil/i }).click(),
  ]);
  return resposta;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ base: string, ok: (m: string) => void }} ctx
 */
export async function percorrerEdicaoDePerfil(page, { base, ok }) {
  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#bio').waitFor({ state: 'visible', timeout: 30000 });

  const original = await lerCampos(page);
  const marca = marcaDePerfil();
  // `discord` tem CHECK no banco: `^@?[A-Za-z0-9._#-]{1,64}$` — **sem espaco**.
  // A 1a versao mandava `disc-e2e 1759…` e o CI reprovou com a frase certa na
  // tela: "informe so o @ ou o nome de usuario, nao o link inteiro". Dado de
  // teste tambem passa pelas regras do produto.
  // Conferido contra TODAS as constraints de `profiles` (02/10), para nao
  // gastar outra rodada de CI: `bio` tem teto de 300 (o campo corta em 200) e
  // `discord` tem o formato acima mais teto de 64. Nenhum outro alcanca estes
  // dois campos.
  const teste = {
    bio: `bio de teste ${marca}`,
    discord: `e2e${marca.replace(/\D/g, '')}`,
  };

  const resposta = await escreverEGravar(page, teste);
  if (!resposta.ok()) {
    // `[02/10]` A mensagem AFIRMAVA a causa — "privilegio de coluna revogado" —
    // e a causa real era outra: o CHECK de formato do campo de rede social, que
    // a propria tela dizia em portugues. Mensagem de erro que afirma a causa
    // errada manda investigar o lugar errado, e e pior do que "erro
    // desconhecido" (§1.5). Agora ela REPORTA o que a tela disse e lista as
    // hipoteses como hipoteses.
    const naTela = (await page.locator('[role="status"]').allInnerTexts().catch(() => []))
      .map((t) => t.trim()).filter(Boolean);
    throw new Error(
      `o PATCH de /profiles voltou ${resposta.status()}.\n`
      + (naTela.length
        ? `    A TELA DISSE: ${naTela.join(' | ')}\n`
        : '    A tela nao mostrou aviso nenhum.\n')
      + '\n'
      + '    Se a frase acima explica, siga por ela. Se nao houver frase, as duas\n'
      + '    hipoteses, nesta ordem:\n'
      + '      - CHECK de formato num dos campos (`profiles_redes_sao_handles`\n'
      + '        exige handle, nao URL, e nao aceita espaco);\n'
      + '      - privilegio de COLUNA revogado — e por PAPEL, e o formulario\n'
      + '        escreve NOVE colunas. Foi a classe da SEC-025, que tirou postar,\n'
      + '        comentar, mural e chat do ar de uma vez.');
  }
  ok('perfil  salvou sem erro do servidor');

  // ── A assertiva que importa: RECARREGAR ─────────────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#bio').waitFor({ state: 'visible', timeout: 30000 });
  const depois = await lerCampos(page);

  for (const c of CAMPOS) {
    if (depois[c.nome] !== teste[c.nome]) {
      throw new Error(
        `\`${c.nome}\` nao PERSISTIU.\n`
        + `    escrevi: ${teste[c.nome]}\n`
        + `    voltou : ${depois[c.nome] || '(vazio)'}\n`
        + '    O formulario mostrou o texto novo e o toast disse "Perfil\n'
        + '    atualizado!" — os dois mentem quando o UPDATE afeta 0 linhas,\n'
        + '    porque a RLS nega em SILENCIO (0 linhas, nenhum erro).\n'
        + '    O `count: \'exact\'` do `fromCount` em services/profileService.js\n'
        + '    e o que deveria pegar isso. Se este passo falhou, ou ele saiu,\n'
        + '    ou a policy de UPDATE de `profiles` mudou.');
    }
  }
  ok('perfil  o dado PERSISTIU depois de recarregar');

  // ── Limpeza PROVADA ─────────────────────────────────────────────────────
  await escreverEGravar(page, original);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#bio').waitFor({ state: 'visible', timeout: 30000 });
  const restaurado = await lerCampos(page);

  const falhou = CAMPOS.filter((c) => restaurado[c.nome] !== original[c.nome]);
  if (falhou.length) {
    throw new Error(
      `a RESTAURACAO falhou em: ${falhou.map((c) => c.nome).join(', ')}.\n`
      + '    O perfil da conta de teste ficou com texto de robo, e ele aparece\n'
      + '    no perfil PUBLICO. Restaure a mao antes de reexecutar:\n'
      + falhou.map((c) => `      ${c.nome} = ${original[c.nome] || '(vazio)'}`).join('\n'));
  }
  ok('perfil  restaurou os valores originais (limpeza provada)');
}
