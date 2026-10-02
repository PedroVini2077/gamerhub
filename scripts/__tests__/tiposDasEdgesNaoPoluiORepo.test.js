import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[02/10]` O PORTÃO DE TIPOS não pode sujar o repositório — e sujou.
 *
 * ── O que aconteceu, com número ───────────────────────────────────────────
 *
 * `scripts/tipos-das-edges.mjs` nasceu rodando `deno check
 * --node-modules-dir=auto` **com o repositório como raiz**. O Deno precisa
 * instalar para resolver `npm:openai` (que os tipos do
 * `jsr:@supabase/functions-js` importam), e instalou **no `node_modules/` do
 * projeto**. O Vite então arrastou `openai` para o pacote:
 *
 *     depois de `npm run tipos` ....  790,6 kB  /  239,0 kB gzip   REPROVA
 *     depois de `npm ci` limpo .....  749,8 kB  /  227,8 kB gzip   passa
 *
 * **41 kB de código que ninguém importou**, no carregamento inicial.
 *
 * ── Por que ESTE teste existe, e não só o portão de bytes ─────────────────
 *
 * O `npm run fim` pegou — e é o caso bonito de um portão salvando o outro.
 * Mas **o CI não teria pegado**: lá o orçamento de bytes roda *antes* do
 * `npm run tipos`, na mesma esteira. O sintoma só aparece em quem builda
 * depois, que é a pessoa na máquina dela.
 *
 * Então o que se trava aqui é o DESENHO: a checagem roda numa cópia em
 * `/tmp`, e o `node_modules` do Deno nasce e morre lá.
 *
 * É trava de **texto-fonte** (4ª força da tabela do §2), e isso está dito em
 * vez de disfarçado: a prova de verdade seria rodar o script e olhar o
 * `node_modules`, e o `deno` não existe quando o `npm test` roda — ele entra
 * no CI num passo posterior. Trava que precisa de ferramenta ausente é trava
 * que não roda.
 */

const FONTE = readFileSync('scripts/tipos-das-edges.mjs', 'utf8');

describe('o portao de tipos roda fora do repositorio', () => {
  it('a varredura leu o script de verdade', () => {
    // Sem isto, renomear o script deixaria tudo abaixo verde sobre uma string
    // vazia — a classe "teste que nao consegue falhar" (varrerFontes).
    expect(FONTE.length, 'scripts/tipos-das-edges.mjs sumiu ou mudou de nome')
      .toBeGreaterThan(1000);
  });

  it('cria um diretorio TEMPORARIO e roda com `cwd` nele', () => {
    expect(FONTE, 'a checagem precisa de um diretorio em /tmp (`mkdtempSync` + '
      + '`tmpdir`): o Deno INSTALA para resolver `npm:openai`, e sem isso ele '
      + 'instala no node_modules do projeto — foram 41 kB de `openai` entrando '
      + 'no pacote do site, medidos pelo orcamento de bytes')
      .toMatch(/mkdtempSync\(\s*join\(\s*tmpdir\(\)/);
    expect(FONTE, 'o `deno check` precisa rodar com `cwd` na copia; sem isso o '
      + 'Deno sobe a arvore, acha o package.json do projeto e usa ELE como raiz')
      .toMatch(/cwd:\s*copia/);
  });

  it('nao aponta o `--node-modules-dir` para a raiz do repositorio', () => {
    // O flag em si nao e o problema: o problema e onde a raiz cai. Dentro da
    // copia ele vem do `deno.json`, que mora la.
    const naLinhaDoCheck = FONTE.split('\n')
      .filter((l) => /execFileSync\('deno'|'check'/.test(l))
      .join(' ');
    expect(naLinhaDoCheck, '`--node-modules-dir` na chamada do `deno check` faz a '
      + 'raiz ser o diretorio de onde o script roda — o repositorio. Deixe o '
      + '`deno.json` da copia decidir isso.')
      .not.toMatch(/--node-modules-dir/);
  });

  it('apaga a copia mesmo quando a checagem falha', () => {
    expect(FONTE, 'sem `finally`, uma funcao que nao compila deixa um '
      + 'node_modules inteiro em /tmp a cada execucao')
      .toMatch(/\}\s*finally\s*\{[\s\S]*rmSync\(copia/);
  });

  it('o caminho do erro volta a ser o do REPOSITORIO', () => {
    expect(FONTE, 'o `deno check` imprime o caminho da COPIA. Sem reescrever, o '
      + 'erro manda quem conserta para um diretorio temporario que ja foi '
      + 'apagado — mensagem de erro tem que ser verdadeira (§1.5)')
      .toMatch(/\.join\(PASTA\)/);
  });
});
