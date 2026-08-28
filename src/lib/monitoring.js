import { criarLimitador } from './tetoDeEventos';
import { iniciarCapturaAntecipada, LIMITE_DA_FILA } from './capturaAntecipada';

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

// Teto por sessão. Sem ele, um bug em laço de render manda centenas de eventos
// em minutos, queima a cota de 5.000/mês e o Sentry passa a descartar TUDO em
// silêncio pelo resto do mês — ver `tetoDeEventos.js`.
const limitador = criarLimitador();

// ---------------------------------------------------------------------------
// Carregamento sob demanda
//
// O `@sentry/react` vivia no chunk inicial, que é o que bloqueia a primeira
// pintura. Agora ele é buscado por `import()` dinâmico, num chunk próprio,
// depois que o navegador respira.
//
// A regra que NÃO pode ser quebrada nessa troca é a do `main.jsx`: o
// monitoramento liga antes de tudo de propósito, porque erro durante a
// montagem é o mais grave. Por isso a `capturaAntecipada` entra no lugar dele
// desde o primeiro instante e entrega tudo o que pegou quando o Sentry sobe.
// Peso sai do caminho crítico; cobertura não.
// ---------------------------------------------------------------------------

// Módulo do Sentry depois de carregado. Enquanto for `null`, tudo o que
// chegar por `registrarErro`/`identificarUsuario` fica guardado abaixo.
let sentry = null;
let usuarioPendente;              // `undefined` = ninguém chamou ainda
const errosPendentes = [];        // { erro, contexto } de antes do carregamento

// Teto para a espera: se o navegador nunca ficar ocioso, o Sentry entra assim
// mesmo. Monitoramento que nunca liga é a falha silenciosa que ele existe para
// combater — a mesma armadilha que a cena 3D tinha (ver `landing/Scene3D.jsx`).
const TETO_DE_ESPERA_MS = 2000;
const ESPERA_SEM_IDLE_MS = 800;

function agendarQuandoOcioso(tarefa) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(tarefa, { timeout: TETO_DE_ESPERA_MS });
  } else {
    window.setTimeout(tarefa, ESPERA_SEM_IDLE_MS);
  }
}

async function carregarSentry(captura) {
  let modulo;
  try {
    // Desestruturar em vez de guardar o namespace inteiro NÃO é estilo: é o
    // que mantém o tree-shaking ligado. Com `const m = await import(...)` e
    // `m.captureException` depois, o Rollup não consegue provar quais exports
    // são usados e mantém o pacote todo — medido, o chunk foi de ~90 KB para
    // 475 KB. Ao acrescentar uma função do Sentry aqui, acrescente na lista.
    const { init, captureException, captureMessage, setUser } = await import('@sentry/react');
    modulo = { init, captureException, captureMessage, setUser };
  } catch (erro) {
    // Sem rede, bloqueador de anúncio ou chunk que sumiu depois de um deploy.
    // Não dá para reportar a falha do reporter — mas ela não pode sumir calada,
    // e a fila é liberada para não segurar memória para sempre.
    console.error('[monitoring] não consegui carregar o Sentry:', erro);
    captura.encerrar();
    return;
  }

  modulo.init(opcoesDoSentry());
  sentry = modulo;

  // Ordem importa: o `init()` acima já instalou os ouvintes do Sentry, então
  // encerrar a captura agora deixa as duas redes ativas por um instante em vez
  // de abrir um vão. Duplicata o Sentry deduplica; evento perdido, não.
  const capturados = captura.encerrar();
  for (const { erro, origem } of capturados) {
    modulo.captureException(erro, { extra: { capturado_antes_do_sentry: true, origem } });
  }
  if (captura.descartados() > 0) {
    modulo.captureMessage(
      `${captura.descartados()} erros descartados antes do Sentry carregar (fila cheia)`,
      'warning',
    );
  }

  if (usuarioPendente !== undefined) aplicarUsuario(modulo, usuarioPendente);
  for (const { erro, contexto } of errosPendentes.splice(0, errosPendentes.length)) {
    modulo.captureException(erro, contexto ? { extra: contexto } : undefined);
  }
}

function aplicarUsuario(modulo, profile) {
  if (!profile?.id) { modulo.setUser(null); return; }
  modulo.setUser({ id: profile.id, username: profile.username });
}

/** Liga o monitoramento. Chamado uma vez, no `main.jsx`. */
export function iniciarMonitoramento() {
  // Em desenvolvimento o erro já aparece no console e no overlay do Vite.
  // Mandar pro Sentry só gastaria cota com bug que eu mesmo acabei de escrever.
  if (!import.meta.env.PROD) return;

  // Síncrono, na primeira linha: a partir daqui nenhum erro global se perde.
  const captura = iniciarCapturaAntecipada();
  agendarQuandoOcioso(() => { carregarSentry(captura); });
}

function opcoesDoSentry() {
  return {
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
      // A limpeza vem ANTES do teto: mesmo o evento que vira aviso já sai sem
      // token, e mesmo o que for descartado nunca chega a existir com token.
      return limitador.filtrar(evento);
    },
  };
}

/**
 * Identifica quem está usando, para o erro vir com contexto.
 *
 * Só o `id` e o `username` — nunca email, nunca data de nascimento. São as
 * mesmas colunas que qualquer visitante já vê num perfil público.
 *
 * Chamada antes de o Sentry carregar, ela guarda o perfil e aplica depois —
 * o `App.jsx` chama assim que a sessão resolve, o que costuma acontecer antes.
 */
export function identificarUsuario(profile) {
  if (!import.meta.env.PROD) return;
  if (!sentry) { usuarioPendente = profile ?? null; return; }
  aplicarUsuario(sentry, profile);
}

/**
 * Registra um erro que o código tratou mas que ainda assim é defeito.
 *
 * Use onde hoje há um `console.error` sozinho — ele serve para depurar, não é
 * tratamento (§1.5).
 *
 * Antes de o Sentry carregar, o erro entra na fila em vez de sumir. A fila tem
 * o mesmo teto da captura antecipada, pelo mesmo motivo: bug em laço não pode
 * encher a memória nem queimar a cota de uma vez.
 */
export function registrarErro(erro, contexto) {
  if (!import.meta.env.PROD) {
    console.error('[monitoring]', erro, contexto);
    return;
  }
  if (!sentry) {
    if (errosPendentes.length < LIMITE_DA_FILA) errosPendentes.push({ erro, contexto });
    return;
  }
  sentry.captureException(erro, contexto ? { extra: contexto } : undefined);
}
