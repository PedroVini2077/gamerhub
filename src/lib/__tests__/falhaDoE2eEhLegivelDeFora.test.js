import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrerFontes } from './varrerFontes';

/**
 * `[03/10]` A falha de um roteiro E2E tem de ser legível FORA do log do job.
 *
 * ── O buraco, e ele custou duas rodadas de CI ─────────────────────────────
 *
 * O log de um job do GitHub é servido de **outro host** (blob storage). Quem
 * lê a API não alcança. Dois roteiros novos falharam, e o diagnóstico de cada
 * um dependeu de uma pessoa abrir o navegador, achar o job e colar o texto.
 *
 * Isso transforma "o CI reprovou" em **"espere por alguém"** — o oposto do que
 * um portão existe para fazer, e exatamente a classe do §1.5: a informação
 * existe, está correta, e não chega em forma utilizável.
 *
 * ── A saída, e por que é anotação ────────────────────────────────────────
 *
 * Anotação de erro (`::error::`) vive em
 * `/repos/{owner}/{repo}/check-runs/{id}/annotations`, aparece no topo do PR, e
 * é lida pela API como qualquer outro dado. O log continua tendo o texto
 * inteiro da tela; a anotação leva a CAUSA e o endereço.
 *
 * ── As duas formas de isto voltar a quebrar ──────────────────────────────
 *
 * **(1)** `anotarNoCI` sumir do `salvarEvidencia` — e aí volta tudo para o log
 * inalcançável, sem nada acusar: os roteiros continuam reprovando igual.
 *
 * **(2)** Um roteiro chamar `salvarEvidencia` **sem `causa`**. A anotação sai
 * dizendo "ver o log", que é precisamente a resposta que não serve. Esta é a
 * silenciosa: o mecanismo está lá, funciona, e entrega vazio.
 *
 * ── O que ela NÃO cobre ──────────────────────────────────────────────────
 *
 * Os roteiros que chamam `salvarEvidencia(page)` sem opções nenhumas —
 * `navegacao`, `conteudo-visivel`, `artes-da-arena`. Eles falham com asserção
 * própria e texto curto, e exigir `causa` deles seria atrito sem ganho. A
 * lista está aqui embaixo, com nome, e cresce só com decisão.
 *
 * ── Provada reinjetando o bug (§2) ───────────────────────────────────────
 *
 * Ver o relatório da sessão.
 */

const UTIL = 'e2e/util.mjs';

/**
 * Roteiros LONGOS, de vários passos, onde a causa não se deduz do nome do job.
 * Os curtos ficam de fora com o motivo escrito no cabeçalho acima.
 */
const EXIGEM_CAUSA = [
  'e2e/fluxos.mjs',
  'e2e/duasContas.mjs',
  'e2e/painel-admin.mjs',
  // `[03/10]` Entrou depois de uma rodada em que ELE falhou e a anotacao saiu
  // vazia: eu tinha listado tres roteiros longos e esquecido o quarto, que e
  // justamente o que acabara de ganhar um passo novo (o chat).
  'e2e/lives.mjs',
];

describe('a falha do E2E é legível fora do log do job', () => {
  it('`salvarEvidencia` emite anotação de erro no CI', () => {
    const util = readFileSync(UTIL, 'utf8');
    expect(util.length, `${UTIL} veio vazio`).toBeGreaterThan(500);
    expect(
      /::error title=/.test(util) && /GITHUB_ACTIONS/.test(util),
      'o `salvarEvidencia` parou de emitir `::error::` no CI.\n'
      + '    Sem a anotacao, a falha volta a existir SO no log do job — que e\n'
      + '    servido de outro host e nao se le pela API. O portao continua\n'
      + '    reprovando e ninguem consegue saber por que sem abrir o navegador.',
    ).toBe(true);
  });

  for (const roteiro of EXIGEM_CAUSA) {
    it(`\`${roteiro}\` passa a CAUSA, não só a tela`, () => {
      const fonte = readFileSync(roteiro, 'utf8');
      const chamadas = [...fonte.matchAll(/salvarEvidencia\([^)]*\)/g)].map((m) => m[0]);
      expect(chamadas.length, `${roteiro} nao chama salvarEvidencia — o caminho mudou?`)
        .toBeGreaterThan(0);
      const semCausa = chamadas.filter((c) => !c.includes('causa'));
      expect(
        semCausa,
        `${roteiro} chama \`salvarEvidencia\` sem \`causa\`:\n`
        + semCausa.map((c) => `      ${c}`).join('\n') + '\n'
        + '\n'
        + '    A anotacao sai dizendo "ver o log" — exatamente a resposta que\n'
        + '    nao serve, porque o log e o que nao se alcanca. O mecanismo fica\n'
        + '    la, funcionando, e entregando vazio.',
      ).toEqual([]);
    });
  }

  it('a lista de roteiros longos não está vazia', () => {
    // Lista vazia faria o `for` acima nao rodar e o teste ficar verde para
    // sempre — a classe que o `varrerFontes` existe para impedir.
    expect(EXIGEM_CAUSA.length).toBeGreaterThan(0);
    // E os arquivos existem de verdade: renomear um deles sem ajustar aqui
    // deixaria a lista apontando para o nada.
    const naPasta = new Set(varrerFontes('e2e', { extensoes: /\.mjs$/ }));
    for (const r of EXIGEM_CAUSA) {
      expect(naPasta.has(r), `${r} nao existe mais em e2e/`).toBe(true);
    }
  });
});
