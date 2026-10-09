import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[09/10]` A FALHA DO VITEST PRECISA SER LEGÍVEL DE FORA DO LOG.
 *
 * ── O caso, de hoje ───────────────────────────────────────────────────────
 *
 * Um teste meu passava local e falhava no CI. A causa era real — ele importa
 * um componente que alcança `lib/supabase.js`, que **estoura na importação**
 * sem `VITE_SUPABASE_URL`; eu tenho `.env.local` e o Vite o carrega nos
 * testes, o CI não tem.
 *
 * **O problema não foi o bug: foi não conseguir vê-lo.** Tudo que a API do
 * GitHub devolvia era:
 *
 *     failure: Process completed with exit code 1
 *
 * O log do job vive em `productionresultssa9.blob.core.windows.net`, outro
 * host, que a API não alcança. Diagnosticar virou reproduzir a condição no
 * escuro — `mv .env.local /tmp` e rodar de novo.
 *
 * ── Por que a anotação de 03/10 não cobria isto ───────────────────────────
 *
 * Ela nasceu para os roteiros de E2E, via `salvarEvidencia`. O `vitest` ficou
 * de fora, e ninguém notou porque teste unitário quase sempre falha local
 * primeiro. Quando ele falha **só** no CI, é exatamente quando mais se
 * precisa do texto — e era quando menos havia.
 *
 * ── O custo era zero, e é isso que torna a ausência indefensável ──────────
 *
 * O relatório JSON **já era gerado** para a guarda do piso de testes. A
 * anotação só o lê. Não há processo novo, dependência nova nem tempo novo.
 */

const CI = readFileSync(join(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8');

describe('a falha do vitest é legível fora do log do job', () => {
  it('o CI anota QUAL teste falhou', () => {
    expect(
      /Qual teste falhou/.test(CI) && /::error file=/.test(CI),
      'o passo que anota os testes falhos sumiu do CI.\n'
      + 'Sem ele, uma falha que só acontece no CI devolve "exit code 1" e mais\n'
      + 'nada — o log vive em outro host, que a API do GitHub não alcança.\n'
      + 'Isso transforma "o CI reprovou" em "espere por alguém abrir o navegador".',
    ).toBe(true);
  });

  it('ele roda JUSTAMENTE quando falha', () => {
    const passo = CI.slice(CI.indexOf('Qual teste falhou'));
    expect(
      /if:\s*failure\(\)/.test(passo.slice(0, 200)),
      'o passo perdeu o `if: failure()`.\n'
      + 'Sem ele, ou roda sempre (e gasta tempo em PR verde) ou não roda no\n'
      + 'único momento em que serve.',
    ).toBe(true);
  });

  it('o relatório JSON continua sendo gerado — ele é a fonte', () => {
    expect(
      /--outputFile=vitest-report\.json/.test(CI),
      'o relatório JSON do vitest sumiu do comando de teste.\n'
      + 'Ele alimenta DUAS coisas: a guarda do piso (a suíte não pode encolher\n'
      + 'em silêncio) e a anotação de qual teste falhou. Sem ele as duas ficam\n'
      + 'mudas, e a segunda falha justamente no dia ruim.',
    ).toBe(true);
  });

  it('zero teste falho vira AVISO, não silêncio', () => {
    // O `vitest` também sai 1 quando um arquivo de teste não IMPORTA — e aí
    // `assertionResults` vem vazio. Sem este ramo, a anotação não imprimiria
    // nada e o diagnóstico voltaria à estaca zero, com o agravante de o
    // mecanismo parecer estar funcionando.
    const passo = CI.slice(CI.indexOf('Qual teste falhou'));
    expect(
      /falhos\.length === 0[\s\S]{0,400}?::warning::/.test(passo),
      'o caso "reprovou sem nenhum teste falho" deixou de avisar.\n'
      + 'Ele acontece quando um ARQUIVO de teste nem importa — foi exatamente\n'
      + 'o caso de hoje. Sem o aviso, a anotação fica vazia e parece que o\n'
      + 'mecanismo funcionou.',
    ).toBe(true);
  });
});
