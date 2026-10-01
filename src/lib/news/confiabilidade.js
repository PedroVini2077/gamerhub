/**
 * `[01/10]` FASE 2 do radar — como a MANCHETE se apresenta.
 *
 * ── O que este rótulo diz, e o que ele NÃO diz ────────────────────────────
 *
 * Ele **não** afirma que a notícia é verdadeira. O modelo que classifica vê
 * título e 160 caracteres de resumo — ele está lendo manchete, não apurando.
 * `confirmado` quer dizer *"a manchete se apresenta como anúncio oficial"*, e
 * nada além disso.
 *
 * Por isso a tela escreve **"como a manchete se apresenta"** ao lado dos
 * selos, em vez de deixar o editor concluir que o site conferiu. Rótulo que
 * parece verificação e não é seria a mesma família do endereço inventado que
 * o radar fechou no formato por número: promessa de apuração sem apuração.
 *
 * ── Por que QUATRO, e onde estão os outros dois ───────────────────────────
 *
 * O plano define seis, com `tendencia` ("aumento de atenção") e `discussao`
 * ("comunidade falando"). Nenhuma fonte de hoje produz esses dois: as quinze
 * são veículo jornalístico. Eles entram na Fase 3, com Trends e comunidade.
 *
 * ── A outra metade deste arquivo está no servidor ─────────────────────────
 *
 * `CONFIABILIDADE`, em `supabase/functions/radar-de-pautas/contrato.ts`, é o
 * `enum` que o modelo recebe. São **duas** cópias (esta e aquela), e
 * `vocabularioDoRadarNaoDeriva.test.js` reprova se divergirem — o lado
 * perigoso é o servidor ganhar um valor que a tela não conhece: a pauta
 * apareceria **sem selo**, e nada estouraria.
 */
export const CONFIABILIDADE = {
  confirmado: {
    rotulo: 'Confirmado',
    dica: 'A manchete relata anúncio oficial, lançamento ou dado divulgado.',
    classe: 'border-neon-green/40 text-neon-green',
  },
  relato: {
    rotulo: 'Relato',
    dica: 'O veículo relata como fato apurado, sem citar oficialidade.',
    classe: 'border-dark-400 text-gray-400',
  },
  rumor: {
    rotulo: 'Rumor',
    dica: 'A manchete se apresenta como rumor, boato ou "segundo fontes".',
    classe: 'border-yellow-400/40 text-yellow-400',
  },
  vazamento: {
    rotulo: 'Vazamento',
    dica: 'A manchete relata material vazado, leak ou arquivo encontrado.',
    classe: 'border-orange-400/40 text-orange-400',
  },
};

/** `true` só para rótulo que a tela sabe desenhar. */
export const confiabilidadeValida = (v) => Object.hasOwn(CONFIABILIDADE, v);

/**
 * Só `rumor` e `vazamento` pedem cautela editorial de verdade.
 *
 * `confirmado` e `relato` são o caso comum; pintar os quatro de cor forte
 * faria o alerta deixar de alertar — a 4ª regra do §0.2 aplicada a selo.
 */
export const pedeCautela = (v) => v === 'rumor' || v === 'vazamento';
