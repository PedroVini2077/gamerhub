/*
 * `[08/10]` O SERVICE WORKER — FASE 1: só o que é imutável por construção.
 *
 * ── A regra que governa este arquivo inteiro ────────────────────────────────
 *
 * Service worker é o ÚNICO código deste projeto que sobrevive ao deploy. Um
 * errado serve a versão velha para sempre, e não há conserto pelo servidor: a
 * pessoa fica presa num site quebrado até limpar os dados do navegador. É a
 * falha mais cara que este projeto pode criar.
 *
 * Por isso a Fase 1 cacheia **só o que não pode mudar de conteúdo**: arquivo
 * cujo nome carrega o hash do próprio conteúdo. O Vite nomeia
 * `assets/index-Bz5ALKRR.js`, e esse arquivo é imutável por construção — se o
 * conteúdo mudar, o nome muda junto. Cachear isso para sempre é correto.
 *
 * ── O que ele NUNCA cacheia, e é o que impede o desastre ────────────────────
 *
 * **HTML, nunca.** Toda navegação vai para a rede. O `index.html` é quem aponta
 * para os bundles, então mantendo-o sempre fresco um deploy SEMPRE chega — o
 * HTML novo pede hashes novos, que este worker não tem e busca na rede.
 *
 * Isso elimina a classe inteira de "preso na versão velha" sem precisar de
 * aviso de atualização, de `skipWaiting` cuidadoso nem de janela de migração.
 *
 * **Nada de terceiro.** Só a própria origem. Supabase, Sentry e Cloudflare
 * passam direto — cachear resposta de API aqui seria servir dado velho sem
 * ninguém pedir, e o React Query já cuida disso com regras que a tela conhece.
 *
 * ── O que ele dá em troca ───────────────────────────────────────────────────
 *
 * Segunda visita abre sem baixar o bundle de novo. E isso corta **egress**, que
 * é a cota mais apertada do projeto (§0.2).
 *
 * ── A chave geral, e por que ela mora AQUI ──────────────────────────────────
 *
 * `DESLIGADO = true` + deploy faz este worker apagar todo o cache e se
 * desregistrar sozinho. É o caminho de volta, e ele precisa estar no mesmo
 * arquivo: qualquer outro lugar dependeria do site carregar — e se o site não
 * carrega, não há de onde desligar.
 */

const DESLIGADO = false;

/** Muda junto com o formato do cache. Caches de outro nome são apagados. */
const VERSAO = 'gamerhub-cache-v1';

const PAGINA_OFFLINE = '/offline.html';

/**
 * Só `assets/<nome>-<hash>.<ext>`.
 *
 * As fontes de `public/fonts/` ficam de FORA de propósito: o nome delas não
 * carrega hash, então cacheá-las para sempre serviria uma fonte velha no dia em
 * que uma for trocada — e já houve troca de fonte neste projeto.
 */
const IMUTAVEL = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/;

if (DESLIGADO) {
  // O caminho de volta: apaga tudo e sai de cena.
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (evento) => {
    evento.waitUntil(
      caches.keys()
        .then((nomes) => Promise.all(nomes.map((n) => caches.delete(n))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.claim()),
    );
  });
} else {
  self.addEventListener('install', (evento) => {
    evento.waitUntil(
      caches.open(VERSAO)
        .then((cache) => cache.add(PAGINA_OFFLINE))
        // `skipWaiting` é seguro AQUI porque o HTML nunca é cacheado: a aba
        // velha continua pedindo os hashes velhos, que este worker busca na
        // rede por não tê-los. Sem essa garantia, assumir o controle no meio de
        // uma sessão serviria bundle novo para HTML velho.
        .then(() => self.skipWaiting()),
    );
  });

  self.addEventListener('activate', (evento) => {
    evento.waitUntil(
      caches.keys()
        .then((nomes) => Promise.all(
          nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)),
        ))
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener('fetch', (evento) => {
    const pedido = evento.request;
    if (pedido.method !== 'GET') return;

    const url = new URL(pedido.url);
    if (url.origin !== self.location.origin) return;

    // NAVEGAÇÃO: sempre rede, e a página de offline só quando ela falha.
    // Nunca o contrário — servir HTML do cache é o que prende na versão velha.
    if (pedido.mode === 'navigate') {
      evento.respondWith(
        fetch(pedido).catch(() => caches.match(PAGINA_OFFLINE)),
      );
      return;
    }

    if (!IMUTAVEL.test(url.pathname)) return;

    evento.respondWith(
      caches.match(pedido).then((guardado) => guardado || fetch(pedido).then((resposta) => {
        // Só resposta inteira e boa entra no cache. Guardar um 404 ou um 206
        // seria servir o erro para sempre.
        if (resposta.ok && resposta.status === 200) {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
        }
        return resposta;
      })),
    );
  });
}
