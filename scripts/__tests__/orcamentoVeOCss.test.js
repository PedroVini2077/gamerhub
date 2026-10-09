import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[09/10]` O ORÇAMENTO DE BYTES PRECISA ENXERGAR O CSS.
 *
 * ── O buraco, e quanto tempo ele existiu ───────────────────────────────────
 *
 * Desde 28/08 o portão lia o `<script type="module">` e os
 * `<link rel="modulepreload">` do `dist/index.html`. A folha de estilo entra
 * por `<link rel="stylesheet">` — e **nunca foi contada**.
 *
 * Ou seja: o mecanismo que existe para impedir regressão de desempenho não
 * via o arquivo que **bloqueia a pintura**. Nada aparece na tela antes de o
 * CSS chegar; ele pesa mais por byte do que quase todo JS.
 *
 * ── Como apareceu ─────────────────────────────────────────────────────────
 *
 * A migração para o Tailwind 4 levou o CSS de 15,7 para 19,0 kB gzip (+22%) e
 * o portão deu **verde**. É o §1.5 dentro da própria ferramenta de vigilância,
 * com o agravante de 11/09: verde que parece "alguém olhou".
 *
 * ── Por que uma trava, e não só a linha no script ─────────────────────────
 *
 * Porque as duas formas de isto morrer são silenciosas. A medição pode ser
 * apagada numa limpeza — e o portão continua imprimindo "OK". Ou a regex pode
 * deixar de casar quando o Vite mudar o HTML, e aí ela mede ZERO e aprova,
 * que é a mesma vacuidade que o `varrerFontes` existe para fechar.
 */

const SCRIPT = join(import.meta.dirname, '../orcamento-de-bytes.mjs');
const fonte = () => readFileSync(SCRIPT, 'utf8');

describe('o orçamento de bytes enxerga o CSS', () => {
  it('ele procura a folha de estilo no HTML', () => {
    expect(
      /rel="stylesheet"[^/]*href=.*\\\.css/.test(fonte()),
      'o orçamento de bytes parou de procurar o `<link rel="stylesheet">`.\n'
      + 'Ele volta a medir só JavaScript — e CSS é o que BLOQUEIA A PINTURA.\n'
      + 'Foi assim que a migração do Tailwind 4 engordou o site em 3,4 kB gzip\n'
      + 'com o portão verde.',
    ).toBe(true);
  });

  it('tem teto próprio para o CSS, e ele REPROVA', () => {
    const js = fonte();

    const teto = js.match(/const TETO_CSS_GZIP_KB = (\d+);/);
    expect(
      teto,
      'o teto de CSS sumiu do orçamento.\n'
      + 'Medir sem teto é imprimir um número que ninguém confere — exatamente\n'
      + 'o que o painel do fornecedor faz (§0.2, 3ª regra).',
    ).not.toBeNull();

    expect(
      /cssGzip \/ 1024 > TETO_CSS_GZIP_KB[\s\S]{0,80}falhas\.push/.test(js),
      'o teto de CSS existe mas não REPROVA mais.\n'
      + 'Número impresso e não conferido é pior do que número nenhum: ele dá a\n'
      + 'impressão de vigilância sobre algo que ninguém está olhando.',
    ).toBe(true);
  });

  it('zero folha de estilo é ERRO, não aprovação', () => {
    // A morte silenciosa: o Vite muda o HTML, a regex para de casar, o script
    // soma zero byte e imprime "OK". Mesma proteção que os chunks já tinham.
    expect(
      /folhas\.length === 0[\s\S]{0,400}?process\.exit\(2\)/.test(fonte()),
      'o orçamento deixou de tratar "nenhuma folha encontrada" como ERRO.\n'
      + 'Sem isso, uma mudança no HTML gerado faz o portão medir ZERO e\n'
      + 'aprovar para sempre — a vacuidade que o `varrerFontes` fecha.',
    ).toBe(true);
  });
});
