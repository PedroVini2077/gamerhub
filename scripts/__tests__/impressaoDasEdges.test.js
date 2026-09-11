import { describe, it, expect } from 'vitest';

import { funcoes, calcular, escrita, PASTA } from '../impressao-das-edges.mjs';

/**
 * A impressão escrita em cada Edge Function bate com o código dela.
 *
 * ── O elo que ESTE teste cobre, e o que ele NÃO cobre ───────────────────────
 *
 * A vigilância das Edge Functions tem dois elos, e cada um tem o seu guarda:
 *
 * | Elo | Pergunta | Quem reprova |
 * | --- | --- | --- |
 * | código ↔ impressão escrita | editei a função e a impressão ficou velha? | **este teste**, no `npm test` |
 * | impressão escrita ↔ produção | implantei o que editei? | `scripts/edges-implantadas.mjs`, no CI |
 *
 * Separados de propósito: o primeiro é offline e determinístico, e tem que
 * reprovar mesmo sem rede. O segundo depende de produção estar de pé.
 *
 * ── Por que este teste é o que impede a fraude do número escrito à mão ──────
 *
 * Sem ele, a impressão viraria uma constante como qualquer outra — e aí ela
 * reproduziria o problema que deveria pegar: eu mudo o corpo da função, esqueço
 * de regerar, produção e repositório concordam num valor velho, e o portão fica
 * verde exatamente no caso em que ele precisava gritar.
 */
describe('impressão das Edge Functions', () => {
  const lista = funcoes();

  // Sem isto, renomear `supabase/functions` deixaria `lista` vazia e os `it`
  // de baixo passariam por vacuidade — a trava viraria decoração para sempre.
  // É o mesmo cuidado do `varrerFontes.js`.
  it('encontrou as funções na pasta', () => {
    expect(
      lista.length,
      `Nenhuma Edge Function encontrada em ${PASTA}/. Se a pasta mudou de lugar, `
      + 'ajuste PASTA em scripts/impressao-das-edges.mjs — senão este arquivo '
      + 'inteiro passa a aprovar tudo sem olhar nada.',
    ).toBeGreaterThanOrEqual(8);
  });

  it.each(lista)('%s: a impressão escrita bate com o código', (nome) => {
    const atual = escrita(nome);
    expect(
      atual,
      `${nome} não tem o marcador de impressão. Toda Edge Function precisa de\n`
      + '  `const IMPRESSAO_DESTE_CODIGO = "";` e do ramo de GET que o devolve —\n'
      + '  senão ela fica FORA da vigilância, e "editei e esqueci de implantar"\n'
      + '  volta a passar despercebido nela. Receita em supabase/functions/README.md.',
    ).not.toBeNull();

    expect(
      atual,
      `A impressão de ${nome} está velha: o código mudou e ela não.\n`
      + '  Rode `npm run impressao-edges` e commite o resultado.\n'
      + '  (E depois IMPLANTE a função — impressão nova no repositório com\n'
      + '   produção velha é justamente o que o portão do CI vai acusar.)',
    ).toBe(calcular(nome));
  });
});
