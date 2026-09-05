/**
 * Os documentos que a pessoa aceita ao criar conta — e a VERSÃO de cada um.
 *
 * ── Por que versão, e não só um "aceitou: sim" ──────────────────────────────
 *
 * Porque a pergunta que interessa nunca é *"ela aceitou?"*. É *"ela aceitou
 * O QUÊ, e quando?"*. Sem versão, mudar a política em janeiro apagaria o
 * sentido de todo aceite dado em dezembro: o registro passaria a dizer que a
 * pessoa concordou com um texto que ela nunca viu.
 *
 * A versão é a data da última mudança de conteúdo do documento. Ela é gravada
 * junto do aceite em `policy_acceptances`, e o banco recusa qualquer coisa que
 * não seja uma data com sufixo opcional de revisão
 * (`CHECK (versao ~ '^\d{4}-\d{2}-\d{2}(-\d+)?$')`).
 *
 * O sufixo `-2` existe porque um documento pode mudar **duas vezes no mesmo
 * dia**, e sem ele a segunda mudança seria inexprimível — foi exatamente o que
 * aconteceu com a política de privacidade em 02/09.
 *
 * ── Quando mexer nestas datas ───────────────────────────────────────────────
 *
 * **Só quando o conteúdo mudar de forma relevante para quem lê** — o que a
 * gente coleta, o que a pessoa pode ou não fazer, o que acontece com a conta.
 * Corrigir uma vírgula não é mudança relevante, e subir a versão por vírgula
 * treina todo mundo a ignorar o pedido de reaceite.
 *
 * ── A `impressao`, e o buraco real que ela fecha ────────────────────────────
 *
 * A regra acima já existia, estava certa, e **falhou mesmo assim**. Em 02/09 o
 * dono aceitou a política na versão `2026-09-02` às 19:58; horas depois o bloco
 * *"por quanto tempo guardamos seu dado"* foi reescrito de "falta definir" para
 * uma tabela com seis prazos — e a versão não se moveu. O registro passou a
 * dizer que ele concordou com um texto que nunca viu, que é precisamente o que
 * versionar o aceite existe para impedir.
 *
 * Não faltava regra: faltava **alguém percebendo que o texto mudou**. A
 * `impressao` é o sha256 do arquivo de conteúdo do documento, e o teste de
 * contrato compara os dois. Mudou o arquivo e não mexeu aqui? O teste falha.
 *
 * **Ela obriga a DECISÃO, não a subir versão** — essa distinção é o ponto.
 * Forçar versão nova a cada vírgula produziria o dano que o parágrafo de cima
 * descreve. Ao falhar, o teste apresenta as duas saídas:
 *
 * | A mudança foi… | O que fazer |
 * | --- | --- |
 * | relevante para quem lê | subir `versao` **e** `impressao` — todo mundo reaceita |
 * | cosmética (vírgula, acento) | subir **só** a `impressao` — ninguém é incomodado |
 *
 * ── UMA caixinha, e não três ────────────────────────────────────────────────
 *
 * A decisão de produto: uma marcação só, cobrindo os três documentos, com link
 * para cada um. Três caixinhas separadas não deixam ninguém mais informado —
 * treinam a pessoa a clicar três vezes sem ler, e o consentimento fica pior,
 * não melhor.
 */

/**
 * Os três documentos, com a versão vigente e a impressão do conteúdo.
 *
 * `conteudo` é o arquivo que o teste de contrato lê para calcular a impressão.
 * Ele está aqui, e não no teste, porque o teste precisa poder dizer QUAL
 * arquivo mudou — e porque documento novo sem entrada aqui deve falhar em vez
 * de passar despercebido.
 *
 * ── `mudou`: o que a última versão mudou, em uma linha ──────────────────────
 *
 * `[03/09]` O dono viu o aviso de reaceite e reportou como bug: *"apareceu duas
 * vezes pra mim, sendo que aceitei uma vez já"*. O banco mostra que as duas
 * aparições estavam certas — a primeira porque ele nunca tinha aceitado, a
 * segunda porque a versão da política subiu horas depois.
 *
 * **O comportamento estava certo e a tela não explicava isso.** Um segundo
 * pedido idêntico ao primeiro é indistinguível de um sistema quebrado, e quem
 * lê conclui a coisa errada — que é o §1.5 do lado da mensagem: a tela não
 * mentia, mas também não contava o suficiente para ser entendida.
 *
 * O texto tem que ser curto e concreto ("o que mudou para MIM"), não jurídico.
 * Ausente é aceitável: primeiro aceite não tem "o que mudou".
 */
export const DOCUMENTOS = {
  privacidade: {
    rotulo: 'Política de Privacidade',
    caminho: '/privacidade',
    /* `[04/09]` Só a IMPRESSÃO subiu, e a versão NÃO — decisão consciente.
     *
     * `[05/09]` A VERSÃO SUBIU, e desta vez todo mundo reaceita.
     *
     * O que mudou no texto: a tabela "o que fica guardado no seu navegador"
     * ganhou **três linhas** — as chaves do cofre do painel do Fundador
     * (`lib/cofre.js`).
     *
     * Por que RELEVANTE e não cosmética, e a decisão foi do dono: eu tinha
     * proposto deixá-las só na lista técnica, porque elas nascem apenas no
     * aparelho de quem tem o cargo de fundador — listá-las descreve para
     * milhares de pessoas um armazenamento que existe para uma. Ele decidiu
     * citar, e a razão dele é mais forte: aquela tabela abre dizendo "listados
     * abaixo". **Lista que se declara completa e não é deixa de ser verdade**,
     * e política de privacidade menos verdadeira custa mais do que três linhas.
     *
     * Mudança no texto que a pessoa lê = versão nova = reaceite. É exatamente a
     * regra que a rodada de 02/09 criou, depois de eu ter reescrito o bloco de
     * retenção sem subir a versão — e o registro de aceite passar a apontar
     * para um texto que ninguém tinha lido.
     *
     * A data visível (`ATUALIZADO_EM`) subiu junto: deixá-la em 02/09 com o
     * texto mudado seria a mesma mentira, só que na cara do leitor.
     *
     * Histórico da decisão anterior, de 04/09, mantido porque explica por que a
     * versão NÃO subiu naquela vez: a tabela ganhou duas linhas das marcas da
     * tela de boas-vindas, da mesma natureza das sete que já estavam ali —
     * sinalizador local, nada sai do aparelho, nada é pessoal. */
    versao: '2026-09-05',
    conteudo: [
      'src/components/privacidade/conteudoDaPrivacidade.js',
      // `[05/09]` As duas listas declaradas saíram para cá quando o arquivo foi
      // dividido. Elas SEGUEM sob a impressão: fora dela, acrescentar uma chave
      // de armazenamento sem tocar na tabela visível deixaria a página
      // afirmando uma lista completa que não é (§1.5).
      'src/components/privacidade/listasDeclaradas.js',
    ],
    /* `[05/09]` A impressao mudou e a VERSAO NAO, e a decisao esta provada, nao
     * suposta: o arquivo foi DIVIDIDO — as duas listas declaradas foram para
     * `listasDeclaradas.js` — e conferi byte a byte que `BLOCOS`,
     * `CHAVES_DECLARADAS` e `TERCEIROS_DECLARADOS` sairam identicos. Nenhuma
     * palavra que alguem le mudou, entao ninguem precisa reaceitar.
     *
     * Subir a versao aqui seria o dano oposto ao de 02/09: pedir reaceite por
     * uma mudanca de arquivo treina todo mundo a clicar sem ler. */
    impressao: 'c44a1204bd904102',
    mudou: 'a lista do que fica guardado no seu navegador ficou completa: entraram as três chaves do cofre do painel da equipe, que só existem no aparelho de quem é da equipe',
  },
  regras: {
    rotulo: 'Regras da Comunidade',
    caminho: '/regras',
    versao: '2026-09-01',
    conteudo: ['src/components/regras/conteudoDasRegras.js'],
    impressao: '88f4042d95a218cb',
  },
  termos: {
    rotulo: 'Termos de Uso',
    caminho: '/termos',
    versao: '2026-09-02',
    conteudo: ['src/components/termos/conteudoDosTermos.js'],
    impressao: 'd2240fc92349715c',
  },
};

/**
 * A lista fechada que o `CHECK` da tabela aceita, na mesma ordem.
 *
 * Existe para o teste de contrato poder comparar os dois lados: documento novo
 * aqui sem entrada no `CHECK` faria o aceite ser recusado pelo banco com uma
 * mensagem que ninguém entende (§6 FASE 4).
 */
export const DOCUMENTOS_DO_BANCO = ['privacidade', 'regras', 'termos'];

/** O que vai para o banco quando alguém aceita: um par por documento. */
export function aceitesParaGravar(userId) {
  return Object.entries(DOCUMENTOS).map(([documento, { versao }]) => ({
    user_id: userId,
    documento,
    versao,
  }));
}

/**
 * Quais documentos esta pessoa ainda não aceitou na versão vigente.
 *
 * ── Três respostas, não duas ────────────────────────────────────────────────
 *
 * | Devolve | Quer dizer |
 * | --- | --- |
 * | `[]` | está tudo aceito — não avisa nada |
 * | `['termos', …]` | falta aceitar — avisa |
 * | **`null`** | **não deu para saber** (a consulta falhou) |
 *
 * O `null` é o que separa "ela não aceitou" de "eu não consegui perguntar", e
 * misturar os dois produziria o pior comportamento possível: um aviso pedindo
 * reaceite toda vez que a rede falhasse, para quem já tinha aceitado tudo.
 * É a mesma lição do `preferenciaDeSom.js` — dois estados diferentes não podem
 * virar um valor só (§4).
 *
 * @param {Array<{documento: string, versao: string}>|null|undefined} aceites
 * @returns {string[]|null}
 */
export function documentosPendentes(aceites) {
  if (!Array.isArray(aceites)) return null;
  const jaAceito = new Set(aceites.map(a => `${a.documento}@${a.versao}`));
  return Object.entries(DOCUMENTOS)
    .filter(([chave, { versao }]) => !jaAceito.has(`${chave}@${versao}`))
    .map(([chave]) => chave);
}
