import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACEITOS } from '../advisories-aceitos.mjs';

/**
 * `[02/10]` Exceção de advisory é DECISÃO, não silenciamento.
 *
 * ── Por que isto existe ────────────────────────────────────────────────────
 *
 * O portão de dependências passou a aceitar exceções porque apareceu um
 * advisory **sem conserto disponível** (`braces`, cuja última versão publicada
 * é a vulnerável). Portão que não pode ser satisfeito é a 4ª regra do §0.2 pelo
 * avesso — ele não grita à toa, grita o que ninguém pode calar, e aí alguém o
 * desliga inteiro.
 *
 * **E lista de exceção é exatamente o mecanismo que apodrece sozinho.** Ela
 * começa com uma entrada justificada e, dois meses depois, tem quatro que
 * ninguém lembra por que estão lá — com o agravante de o portão continuar
 * verde, parecendo que alguém olhou.
 *
 * ── As três coisas que cada entrada tem de responder ───────────────────────
 *
 *   motivo      por que não dá para consertar, e por que o risco é aceitável
 *   desde       quando foi aceito — sem data não dá para saber o que envelheceu
 *   sai_quando  o que faz a exceção deixar de existir
 *
 * A terceira é a que separa decisão de desistência. Sem ela, "aceito" vira
 * "para sempre", e ninguém escreveu isso.
 *
 * ── E o próprio script reprova quando o advisory SOME ──────────────────────
 *
 * Coberto lá, não aqui: se um aceito deixa de aparecer no `npm audit`, o
 * portão falha pedindo que a entrada saia. É o que impede o cemitério.
 */

describe('exceção de advisory é decisão escrita', () => {
  it('a lista não está vazia nem virou texto solto', () => {
    // Lista vazia faria o `for` abaixo não rodar nenhuma vez e o teste ficar
    // verde para sempre — a classe que o `varrerFontes` existe para impedir.
    expect(Array.isArray(ACEITOS), 'ACEITOS deixou de ser uma lista').toBe(true);
    expect(ACEITOS.length, 'ACEITOS veio vazio — o import quebrou?').toBeGreaterThan(0);
  });

  for (const a of ACEITOS) {
    describe(`${a.id} (${a.pacote})`, () => {
      it('diz POR QUE não dá para consertar', () => {
        expect(
          (a.motivo ?? '').length,
          `${a.id} nao tem motivo escrito, ou ele e curto demais para explicar\n`
          + '    por que o risco e aceitavel. Exececao sem motivo e silenciamento.',
        ).toBeGreaterThan(80);
      });

      it('tem DATA, para dar para saber o que envelheceu', () => {
        expect(
          a.desde,
          `${a.id} esta sem \`desde\`. Sem data nao da para perguntar "isto ainda\n`
          + '    faz sentido?" — e foi assim que cinco itens mortos sobreviveram no\n'
          + '    backlog por meses.',
        ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('diz O QUE faz a exceção acabar', () => {
        expect(
          (a.sai_quando ?? '').length,
          `${a.id} nao diz quando sai. Esta e a linha que separa DECISAO de\n`
          + '    desistencia: sem ela, "aceito" vira "para sempre" e ninguem\n'
          + '    escreveu isso.',
        ).toBeGreaterThan(30);
      });
    });
  }

  it('o portão do CI chama ESTE script — senão nada disto roda', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(
      /advisories-aceitos\.mjs/.test(ci),
      'o CI parou de chamar `scripts/advisories-aceitos.mjs`.\n'
      + '    A lista de excecoes continua no repositorio e ninguem a confere —\n'
      + '    e, pior, vulnerabilidade NOVA deixa de reprovar.',
    ).toBe(true);
  });
});
