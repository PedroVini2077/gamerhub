import * as Sentry from '@sentry/react';

// ---------------------------------------------------------------------------
// Observabilidade — a implementação prática da §1.5 do CLAUDE.md
//
// O problema que isto resolve: hoje, quando algo quebra para um usuário às 3 da
// manhã, NINGUÉM fica sabendo. Foi assim que a moderação por IA ficou quebrada
// em 26 de 26 chamadas por semanas — detectando certo, falhando ao aplicar, e
// gritando num `console.error` que ninguém abre.
// ---------------------------------------------------------------------------

// O DSN fica NO CÓDIGO de propósito, e não numa variável de ambiente.
//
// 1. DSN é público por natureza: ele vai no bundle que qualquer visitante
//    baixa. Guardá-lo como segredo não protegeria nada.
// 2. Se dependesse de uma variável na Vercel, bastaria alguém esquecer de
//    configurá-la num deploy futuro para o monitoramento sumir SEM ninguém
//    perceber — construindo exatamente a falha silenciosa que ele existe para
//    acabar.
const DSN = 'https://7d09a2675cfaafa38e34e4abc9731879@o4511958235807744.ingest.us.sentry.io/4511958248914944';

// Ruído que não é bug do site e só gastaria a cota de 5.000 eventos/mês.
const IGNORAR = [
  // Chunk velho depois de um deploy novo: `main.jsx` já recarrega a página.
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  // Extensão de navegador e tradutor automático mexendo no DOM.
  /ResizeObserver loop/i,
  /extension context invalidated/i,
  // Rede do usuário caiu no meio de uma requisição — não é defeito nosso.
  /NetworkError when attempting to fetch/i,
  /Load failed/i,
];

const ORIGENS_IGNORADAS = [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//];

/**
 * Remove token da URL antes de qualquer coisa sair daqui.
 *
 * O Supabase devolve `#access_token=...` na confirmação de email e na
 * recuperação de senha. Sem esta limpeza, um erro nessas telas mandaria um
 * token de sessão VÁLIDO para dentro do relatório — e o projeto acabou de
 * passar por um endurecimento de LGPD justamente para não vazar dado.
 */
function limparUrl(url) {
  if (typeof url !== 'string') return url;
  return url.replace(/[#?][^\s]*/g, m =>
    /access_token|refresh_token|token=|code=|apikey/i.test(m) ? '#[removido]' : m);
}

/** Liga o monitoramento. Chamado uma vez, no `main.jsx`. */
export function iniciarMonitoramento() {
  // Em desenvolvimento o erro já aparece no console e no overlay do Vite.
  // Mandar pro Sentry só gastaria cota com bug que eu mesmo acabei de escrever.
  if (!import.meta.env.PROD) return;

  Sentry.init({
    dsn: DSN,
    environment: 'production',

    // Sem `browserTracingIntegration` e sem Session Replay de propósito: os dois
    // são os que consomem cota e banda. Aqui interessa só ERRO — que é o que
    // estava invisível.
    tracesSampleRate: 0,

    // LGPD: nada de IP, cookie ou cabeçalho por padrão.
    sendDefaultPii: false,
    maxBreadcrumbs: 30,

    ignoreErrors: IGNORAR,
    denyUrls: ORIGENS_IGNORADAS,

    beforeSend(evento) {
      if (evento.request?.url) evento.request.url = limparUrl(evento.request.url);
      if (evento.breadcrumbs) {
        evento.breadcrumbs = evento.breadcrumbs.map(b => (
          b?.data?.url ? { ...b, data: { ...b.data, url: limparUrl(b.data.url) } } : b
        ));
      }
      return evento;
    },
  });
}

/**
 * Identifica quem está usando, para o erro vir com contexto.
 *
 * Só o `id` e o `username` — nunca email, nunca data de nascimento. São as
 * mesmas colunas que qualquer visitante já vê num perfil público.
 */
export function identificarUsuario(profile) {
  if (!import.meta.env.PROD) return;
  if (!profile?.id) { Sentry.setUser(null); return; }
  Sentry.setUser({ id: profile.id, username: profile.username });
}

/**
 * Registra um erro que o código tratou mas que ainda assim é defeito.
 *
 * Use onde hoje há um `console.error` sozinho — ele serve para depurar, não é
 * tratamento (§1.5).
 */
export function registrarErro(erro, contexto) {
  if (!import.meta.env.PROD) {
    console.error('[monitoring]', erro, contexto);
    return;
  }
  Sentry.captureException(erro, contexto ? { extra: contexto } : undefined);
}
