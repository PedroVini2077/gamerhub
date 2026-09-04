/**
 * O carregamento do Cloudflare Turnstile — script de terceiro, sob demanda.
 *
 * ── Por que a chave PÚBLICA mora aqui, e não numa variável de ambiente ──────
 *
 * Mesmo raciocínio já registrado para o DSN do Sentry (ver `lib/monitoring.js`
 * e OPERACAO.md): ela é pública por natureza — vai no bundle e aparece no HTML
 * de qualquer visitante, é assim que o Turnstile funciona. Depender da Vercel
 * significaria que esquecer de configurá-la num deploy futuro **apagaria o
 * captcha sem ninguém notar**, construindo a falha silenciosa que ele existe
 * para evitar (§1.5).
 *
 * A que precisa de cofre é a SECRET, e ela nunca passa por aqui: vive em
 * Supabase → Edge Functions → Secrets, e só a `verify-contact` a lê.
 *
 * ── Por que sob demanda ─────────────────────────────────────────────────────
 *
 * O script é de terceiro e só serve a UMA página. Carregá-lo no `index.html`
 * colocaria uma conexão a mais no caminho crítico de toda visita, inclusive na
 * landing, para uma tela que quase ninguém abre (§0.3).
 */

export const CHAVE_PUBLICA_TURNSTILE = '0x4AAAAAAEmSuW6upq2OeC4X';

const URL_DO_SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Teto absoluto para a espera (§0.3, regra 3).
 *
 * "Adiar até o script carregar" cria o caso em que ele nunca carrega — rede que
 * bloqueia o domínio do Cloudflare, extensão agressiva, operadora ruim. Sem
 * teto, o formulário ficaria em "carregando" para sempre, sem erro, sem log e
 * sem teste: falha silenciosa pura.
 */
const TETO_MS = 12000;

let promessa = null;

/**
 * Carrega o script uma única vez por sessão e resolve quando a API global
 * existir. Rejeita no teto ou no erro de rede — quem chama PRECISA tratar,
 * porque é o caso em que a pessoa fica sem conseguir enviar.
 */
export function carregarTurnstile() {
  if (promessa) return promessa;

  promessa = new Promise((resolve, reject) => {
    if (window.turnstile) { resolve(window.turnstile); return; }

    const relogio = setTimeout(() => {
      // A promessa fica rejeitada, mas o `promessa` volta a ser nulo: assim o
      // botão "tentar de novo" da tela realmente tenta de novo, em vez de
      // receber para sempre a mesma rejeição em cache.
      promessa = null;
      reject(new Error('O Cloudflare nao respondeu a tempo.'));
    }, TETO_MS);

    const script = document.createElement('script');
    script.src = URL_DO_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      clearTimeout(relogio);
      if (window.turnstile) resolve(window.turnstile);
      else { promessa = null; reject(new Error('O script carregou sem a API do Turnstile.')); }
    };
    script.onerror = () => {
      clearTimeout(relogio);
      promessa = null;
      reject(new Error('Nao foi possivel carregar a verificacao do Cloudflare.'));
    };
    document.head.appendChild(script);
  });

  return promessa;
}
