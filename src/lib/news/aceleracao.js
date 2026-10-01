/**
 * `[01/10]` FASE 3 do radar — o sinal de "isto está crescendo?" na tela.
 *
 * ── O que este sinal mede, e a diferença NÃO é detalhe ────────────────────
 *
 * O plano previa Google Trends. **Trends mede o mundo PROCURANDO; isto mede
 * os veículos que nós escolhemos PUBLICANDO.** É um sinal mais estreito e
 * mais honesto, e é por isso que a dica de cada selo fala em "veículos" e
 * nunca em "buscas" ou "interesse".
 *
 * Quem lê "3x o normal" precisa poder refazer a conta: são as menções em
 * `news_items_raw` hoje contra a média dos dias anteriores. Nenhum "87 de
 * relevância" — o plano pedia *"sem score mágico"* exatamente por isso.
 *
 * ── Por que a tela valida um texto que o servidor acabou de produzir ──────
 *
 * Mesma regra da editoria e da confiabilidade: valor que a tela não conhece
 * não vira selo. Aqui ela é ainda mais necessária, porque o sinal é o único
 * dos três que tem uma forma VARIÁVEL (`4x o normal`) — e aceitar texto
 * livre do servidor numa `className` é como esse tipo de coisa vira XSS de
 * classe em outro projeto.
 *
 * ── A outra metade está em `radar-de-pautas/aceleracao.ts` ────────────────
 *
 * São duas cópias do mesmo vocabulário, e `radarSinalDeAceleracao.test.js`
 * reprova se divergirem. O lado perigoso é o servidor ganhar um rótulo novo
 * que a tela descarta: o sinal some, e nada estoura (§1.5).
 */

/** O que o `rotuloDaAceleracao` do servidor pode produzir, sem o `Nx`. */
export const SINAIS = {
  'novo e forte': {
    rotulo: 'novo e forte',
    dica: 'Nenhum veículo tinha mencionado isto antes de hoje, e hoje vários mencionaram.',
    classe: 'text-neon-green',
  },
  crescendo: {
    rotulo: 'crescendo',
    dica: 'Mais veículos falando disto hoje do que nos dias anteriores.',
    classe: 'text-neon-green/70',
  },
  novo: {
    rotulo: 'novo',
    dica: 'Primeira vez que este termo aparece nas fontes que acompanhamos.',
    classe: 'text-neon-cyan/70',
  },
  esfriando: {
    rotulo: 'esfriando',
    dica: 'Falavam mais disto nos dias anteriores do que hoje — pauta em queda.',
    classe: 'text-gray-500',
  },
};

/** `4x o normal`, `12x o normal`. O servidor arredonda; a tela só confere. */
const MULTIPLICADOR = /^(\d{1,3})x o normal$/;

/**
 * Traduz o sinal cru num selo desenhável, ou `null`.
 *
 * `null` para texto desconhecido é deliberado: um sinal que a tela não sabe
 * explicar é pior do que sinal nenhum, porque o editor decidiria a pauta em
 * cima de uma palavra sem significado definido.
 */
export function seloDoSinal(sinal) {
  if (typeof sinal !== 'string' || !sinal) return null;
  if (Object.hasOwn(SINAIS, sinal)) return SINAIS[sinal];

  const m = sinal.match(MULTIPLICADOR);
  if (!m) return null;
  return {
    rotulo: sinal,
    dica: `${m[1]}x mais menções hoje do que a média dos dias anteriores, nas fontes que acompanhamos.`,
    classe: 'text-neon-green',
  };
}
