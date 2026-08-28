/**
 * Rede de captura que existe ANTES do Sentry chegar.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * O `@sentry/react` custa ~40 KB dentro do chunk inicial, que é o que bloqueia
 * a primeira pintura. Carregá-lo sob demanda tira esse peso do caminho crítico
 * — mas cria uma janela entre o app começar a rodar e o Sentry existir. E o
 * `main.jsx` dizia, com razão, que o monitoramento liga antes de tudo **de
 * propósito**: "erro que acontece durante a montagem é justamente o mais
 * grave". Trocar peso por cegueira nesse momento seria péssimo negócio.
 *
 * Este módulo fecha a janela. Ele instala dois ouvintes baratos — nenhuma
 * dependência, alguns bytes — que guardam o que acontecer até o Sentry ficar
 * de pé. Depois disso o Sentry assume, e a fila é despejada nele.
 *
 * A ordem correta em quem usa isto é: `init()` do Sentry primeiro, `encerrar()`
 * depois. Assim as duas redes ficam ativas por um instante em vez de haver um
 * vão entre elas — evento duplicado o Sentry deduplica sozinho; evento perdido
 * ninguém recupera.
 */

// Teto da fila. Bug em laço de render pode disparar centenas de erros antes de
// o Sentry carregar; guardar todos só encheria a memória para depois queimar a
// cota de 5.000 eventos/mês de uma vez. O `tetoDeEventos.js` protege o mesmo
// limite do outro lado, depois que o Sentry existe.
export const LIMITE_DA_FILA = 20;

/**
 * Começa a guardar erros globais.
 *
 * @returns {{ encerrar: () => Array, tamanho: () => number, descartados: () => number }}
 *   `encerrar()` remove os ouvintes e devolve o que foi capturado.
 */
export function iniciarCapturaAntecipada(limite = LIMITE_DA_FILA) {
  const fila = [];
  let descartados = 0;

  const guardar = (erro, origem) => {
    if (fila.length >= limite) { descartados += 1; return; }
    fila.push({ erro, origem });
  };

  const aoErrar = (evento) => {
    // O evento `error` também dispara quando uma imagem ou um script não
    // carrega. Nesses casos o alvo é o elemento, não a janela, e não há
    // exceção nenhuma — reportar isso como bug do site seria ruído.
    if (evento.target && evento.target !== window) return;
    guardar(evento.error instanceof Error ? evento.error : new Error(evento.message || 'erro sem mensagem'), 'window.error');
  };

  const aoRejeitar = (evento) => {
    const motivo = evento.reason;
    guardar(motivo instanceof Error ? motivo : new Error(String(motivo)), 'unhandledrejection');
  };

  window.addEventListener('error', aoErrar);
  window.addEventListener('unhandledrejection', aoRejeitar);

  return {
    tamanho: () => fila.length,
    descartados: () => descartados,
    encerrar() {
      window.removeEventListener('error', aoErrar);
      window.removeEventListener('unhandledrejection', aoRejeitar);
      return fila.splice(0, fila.length);
    },
  };
}
