/**
 * `[09/10]` COMO INSTALAR, quando o navegador não oferece o convite.
 *
 * ── Por que isto existe ────────────────────────────────────────────────────
 *
 * A entrada "Instalar o app" sumia quando `beforeinstallprompt` não tinha
 * disparado. Parecia o certo — botão que não faz nada é pior do que botão
 * nenhum — e era o erro: **"nada" tem três causas, e a tela não distinguia
 * nenhuma**.
 *
 *     o deploy não chegou                      <- foi o que ele suspeitou
 *     o navegador ainda não ofereceu
 *     o aparelho não pode (iPhone)
 *
 * Ele abriu a gaveta, não viu a entrada, e perguntou se tinha ido para
 * produção. Tinha — conferido pelo hash do chunk. O recurso estava no ar e
 * **invisível**, que é o §1.5 aplicado à própria funcionalidade: nada na tela,
 * nada gravado, nenhum teste falhando.
 *
 * ── Por que PLATAFORMA e não navegador ─────────────────────────────────────
 *
 * Dá para farejar Chrome, Edge, Samsung Internet e Firefox no `userAgent`, e
 * seria uma tabela que envelhece a cada versão — exatamente o que o §0.3 regra 6
 * alerta. Plataforma muda muito mais devagar, e é ela que decide o caminho: no
 * iOS a instalação é pelo botão Compartilhar, no resto é pelo menu do
 * navegador.
 *
 * **Isto não é impressão digital.** O `userAgent` já vai em toda requisição,
 * nada aqui é guardado nem enviado, e o único efeito é qual texto de ajuda
 * aparece. No pior caso cai em `desconhecido`, que é uma receita de verdade.
 *
 * ── `desconhecido` é uma RECEITA, não um `else` ────────────────────────────
 *
 * O §4 proíbe o fallback silencioso, e a diferença está na honestidade do
 * texto: ele não chuta os passos de outra plataforma, ele **diz o que
 * procurar**. Chutar "toque em Compartilhar" para quem está no Windows manda a
 * pessoa procurar um botão que não existe.
 */

/**
 * As receitas. Mapa EXPLÍCITO: chave desconhecida devolve `undefined`, nunca um
 * palpite.
 *
 * @type {Record<string, {titulo: string, passos: string[]}>}
 */
export const RECEITAS = {
  ios: {
    titulo: 'No iPhone e no iPad',
    passos: [
      'Toque no botão Compartilhar, na barra do navegador (o quadrado com a seta para cima).',
      'Role a lista e toque em "Adicionar à Tela de Início".',
      'Confirme em "Adicionar", no canto superior direito.',
    ],
  },
  android: {
    titulo: 'No Android',
    passos: [
      'Toque no menu do navegador (os três pontinhos, ou as três listras).',
      'Procure por "Instalar app" ou "Adicionar à tela inicial".',
      'Confirme, e o GamerHub aparece junto dos seus outros apps.',
    ],
  },
  computador: {
    titulo: 'No computador',
    passos: [
      'Procure o ícone de instalar na barra de endereço, à direita (uma telinha com uma seta).',
      'Se ele não estiver lá, abra o menu do navegador e procure por "Instalar GamerHub".',
      'Confirme, e o site passa a abrir em janela própria.',
    ],
  },
  desconhecido: {
    titulo: 'No seu navegador',
    passos: [
      'Abra o menu do navegador.',
      'Procure por "Instalar", "Instalar app" ou "Adicionar à tela inicial".',
      'Se nenhuma dessas opções existir, este navegador ainda não instala sites.',
    ],
  },
};

/**
 * Qual receita mostrar.
 *
 * @param {string} [ua] o `userAgent`; o padrão é o do navegador atual.
 * @returns {{titulo: string, passos: string[]}}
 */
export function receitaDeInstalacao(ua) {
  const texto = typeof ua === 'string'
    ? ua
    : (typeof navigator === 'undefined' ? '' : navigator.userAgent || '');

  // O iPad moderno se apresenta como Macintosh, e só a existência de toque o
  // separa de um Mac de mesa. Sem esta linha, quem está no iPad recebe os
  // passos do computador e vai procurar um ícone que o Safari não tem.
  const iPadDisfarcado = /Macintosh/i.test(texto)
    && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;

  if (/iPhone|iPad|iPod/i.test(texto) || iPadDisfarcado) return RECEITAS.ios;
  if (/Android/i.test(texto)) return RECEITAS.android;
  if (/Windows|Macintosh|CrOS|X11|Linux/i.test(texto)) return RECEITAS.computador;
  return RECEITAS.desconhecido;
}
