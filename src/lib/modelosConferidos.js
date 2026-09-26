/**
 * `[26/09]` Os modelos de IA conferidos **no plano que este projeto usa**.
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * O dono clicou em "Redigir rascunho" pela primeira vez e recebeu
 * **`A IA não respondeu (HTTP 404)`**.
 *
 * O modelo era `llama-3.3-70b-versatile`. Eu tinha conferido que ele era
 * **modelo de produção** na Groq — e não conferi a coisa que importava: **se o
 * plano grátis o serve**. Ele é Enterprise. O Groq responde `404`, e não `403`,
 * quando o modelo existe mas a conta não o alcança; por isso a mensagem não
 * dizia "sem acesso".
 *
 * **A evidência passou pelas minhas mãos e eu li errado.** Ao buscar os limites
 * de taxa, a tabela do plano grátis **não listava** aquele modelo, e eu
 * registrei aquilo como *"a página não tem a informação"* em vez de *"o modelo
 * não está no plano grátis"*. É o §1.1 na veia: inferência vestida de fato.
 *
 * ── A pergunta que passa a ser obrigatória ─────────────────────────────────
 *
 * Não é *"este modelo existe?"* nem *"é de produção?"*. É:
 *
 *   **este modelo aparece na tabela de limites DO PLANO QUE NÓS PAGAMOS?**
 *
 * É a única pergunta cuja resposta prevê o `404`.
 */

/**
 * Mapa explícito. Modelo fora daqui reprova a trava — e "fora daqui" inclui o
 * modelo que existe, é bom e é de produção, mas que a nossa conta não alcança.
 */
export const MODELOS_CONFERIDOS = {
  'openai/gpt-oss-120b': {
    conferido: '2026-09-26',
    plano: 'grátis',
    limite: '1.000 requisições/dia',
    metodo: 'lido na tabela de limites do PLANO GRÁTIS em console.groq.com/docs/rate-limits',
    usado_em: ['redigir-materia', 'radar-de-pautas'],
  },
  'openai/gpt-oss-20b': {
    conferido: '2026-09-26',
    plano: 'grátis',
    limite: '1.000 requisições/dia',
    metodo: 'mesma tabela; fica como reserva se o 120B ficar lento ou sair',
    usado_em: [],
  },
};

/**
 * Os REPROVADOS, com o motivo — para ninguém reintroduzir o que já falhou.
 */
export const MODELOS_REPROVADOS = {
  'llama-3.3-70b-versatile':
    'É modelo de PRODUÇÃO na Groq, e mesmo assim devolve HTTP 404 para a nossa '
    + 'conta: está marcado como Enterprise e não aparece na tabela do plano '
    + 'grátis. Medido em 26/09, no primeiro uso real.',
  'llama-3.1-8b-instant':
    'Desligado pela Groq em 16/08/2026 — a própria documentação aponta '
    + '`openai/gpt-oss-20b` como substituto.',
};

/** O modelo pode ser usado pelo plano deste projeto? */
export const modeloConferido = (id) => Object.hasOwn(MODELOS_CONFERIDOS, id);
