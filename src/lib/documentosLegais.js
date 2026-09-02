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
 * não seja uma data (`CHECK (versao ~ '^\d{4}-\d{2}-\d{2}$')`).
 *
 * ── Quando mexer nestas datas ───────────────────────────────────────────────
 *
 * **Só quando o conteúdo mudar de forma relevante para quem lê** — o que a
 * gente coleta, o que a pessoa pode ou não fazer, o que acontece com a conta.
 * Corrigir uma vírgula não é mudança relevante, e subir a versão por vírgula
 * treina todo mundo a ignorar o pedido de reaceite.
 *
 * ── UMA caixinha, e não três ────────────────────────────────────────────────
 *
 * A decisão de produto: uma marcação só, cobrindo os três documentos, com link
 * para cada um. Três caixinhas separadas não deixam ninguém mais informado —
 * treinam a pessoa a clicar três vezes sem ler, e o consentimento fica pior,
 * não melhor.
 */

/** Os três documentos, com a versão vigente de cada. */
export const DOCUMENTOS = {
  privacidade: {
    rotulo: 'Política de Privacidade',
    caminho: '/privacidade',
    versao: '2026-09-02',
  },
  regras: {
    rotulo: 'Regras da Comunidade',
    caminho: '/regras',
    versao: '2026-09-01',
  },
  termos: {
    rotulo: 'Termos de Uso',
    caminho: '/termos',
    versao: '2026-09-02',
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
