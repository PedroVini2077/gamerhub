import { registrarErro } from './monitoring';

/**
 * `[08/10]` O REGISTRO do service worker — e as três recusas dele.
 *
 * O worker em si mora em `public/sw.js`, fora do bundle, porque ele precisa ser
 * servido da RAIZ para alcançar o site inteiro. Este arquivo só decide **quando
 * ligá-lo**, e cada recusa abaixo existe por um motivo concreto.
 *
 * ── 1. Só em produção ──────────────────────────────────────────────────────
 *
 * Em desenvolvimento o Vite serve os módulos sem hash e recarrega a quente. Um
 * worker no meio disso serviria arquivo velho e faria parecer que a edição não
 * pegou — o tipo de confusão que custa horas e não tem nada a ver com o bug que
 * a pessoa estava caçando.
 *
 * ── 2. Só se o navegador tiver ─────────────────────────────────────────────
 *
 * `serviceWorker` não existe em aba anônima de alguns navegadores nem em
 * contexto sem HTTPS. A ausência não é erro: o site funciona igual sem cache.
 *
 * ── 3. Só depois do `load` ─────────────────────────────────────────────────
 *
 * Registrar durante o carregamento disputa banda com o próprio site, e o ganho
 * do worker é todo na PRÓXIMA visita. Adiar não atrasa nada e não cria espera:
 * `load` sempre dispara, inclusive quando algum recurso falha (§0.3, regra 3).
 *
 * ── O que acontece quando falha, e por que isso não para nada ──────────────
 *
 * Falha de registro NÃO é tratada como erro do site: ele continua funcionando
 * exatamente como antes, só sem cache. Mas também não some em silêncio — vai
 * para o Sentry, porque "o PWA parou de instalar" é coisa que ninguém
 * descobriria de outro jeito (§1.5).
 */
export function registrarServicoDeCache() {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((erro) => {
      registrarErro(erro, { onde: 'registrarServicoDeCache' });
    });
  });
}
