import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

/**
 * `[17/09]` As Edge Functions precisam pelo menos ser CÓDIGO VÁLIDO.
 *
 * ── O bug que ela existe para pegar, e ele era real ─────────────────────────
 *
 * `supabase/functions/moderate-text/index.ts` estava com a constante da
 * impressão **dentro de um `import` de várias linhas**:
 *
 *     import {
 *
 *     // A impressao deste codigo...
 *     const IMPRESSAO_DESTE_CODIGO = "89ad5d8ab21747fb";
 *       DIAL_PADRAO, viaOpenAI, viaHuggingFace, type Decisao,
 *     } from "./politica.ts";
 *
 * O arquivo **não compilava**. Foi descoberto só quando a implantação real
 * falhou, em 17/09 — com a mensagem exata que este teste reproduz.
 *
 * ── Por que NENHUM portão pegou, e é isso que importa ───────────────────────
 *
 * | Portão | Por que passou |
 * | --- | --- |
 * | `npm run build` | o Vite compila `src/`. `supabase/functions/` roda em **Deno**, e não entra no build |
 * | `npm run lint` | o ESLint do projeto não cobre essa pasta |
 * | `npm test` | nenhum teste **lia** esses arquivos como código |
 * | `impressaoDasEdges.test.js` | compara **hash de texto** — e texto quebrado tem hash igualzinho a texto válido |
 * | `npm run edges` | pergunta a impressão à função **no ar**. A do ar era a versão velha e sã; a quebrada nunca tinha sido implantada |
 *
 * Ou seja: o repositório carregava um arquivo inválido, tudo verde, **e o único
 * motivo de ninguém notar era que ele nunca tinha sido implantado**. O dia em
 * que fosse, quebraria — e foi exatamente o que aconteceu.
 *
 * ── Por que `node --check` NÃO serve, medido ────────────────────────────────
 *
 * `node --experimental-strip-types --check` devolveu **exit 0** no arquivo
 * quebrado — ele não parseia o TypeScript de verdade nesse modo, e um portão
 * que aprova o caso que existe para pegar é pior do que não ter portão.
 *
 * O que funciona é `module.stripTypeScriptTypes`: para tirar os tipos ele
 * precisa **parsear**, e num arquivo inválido ele **lança**
 * `ERR_INVALID_TYPESCRIPT_SYNTAX` com a mesma frase que o Supabase devolveu na
 * implantação recusada. Sem dependência nova e sem flag experimental —
 * `node:module` é do próprio Node.
 */

const PASTA = 'supabase/functions';

/** Só o que é código; `README.md` e afins ficam de fora. */
function arquivosDeCodigo() {
  const achados = [];
  for (const nome of readdirSync(PASTA).sort()) {
    const dir = join(PASTA, nome);
    if (!statSync(dir).isDirectory()) continue;
    for (const arquivo of readdirSync(dir).sort()) {
      if (!/\.(ts|js|mts|mjs)$/.test(arquivo)) continue;
      achados.push(join(dir, arquivo));
    }
  }
  return achados;
}

describe('as Edge Functions são código válido', () => {
  it('todo arquivo de `supabase/functions/` parseia', () => {
    // Sem a ferramenta, o `catch` abaixo transformaria a AUSENCIA DELA em
    // "arquivo quebrado" — e um `try` mal escrito a transformaria em verde.
    // Falhar aqui, alto, e a unica saida honesta.
    expect(
      typeof stripTypeScriptTypes,
      'O `module.stripTypeScriptTypes` nao existe neste Node.\n'
      + '  Ele chegou no Node 22. Sem ele este teste nao consegue parsear nada,\n'
      + '  e teste que nao consegue testar tem que REPROVAR, nao passar calado.',
    ).toBe('function');

    const arquivos = arquivosDeCodigo();

    // A guarda do `varrerFontes`: pasta renomeada devolve lista vazia, o laço
    // não roda, e o teste fica verde para sempre sem ter lido uma linha.
    expect(
      arquivos.length,
      `Nao achei arquivo de codigo nenhum em ${PASTA}/.\n`
      + '  A pasta foi renomeada ou movida? Sem ela esta trava passa verde sem\n'
      + '  ter parseado nada.',
    ).toBeGreaterThanOrEqual(8);

    const quebrados = [];
    for (const caminho of arquivos) {
      const fonte = readFileSync(caminho, 'utf8');
      try {
        // Para TIRAR os tipos ele precisa PARSEAR — e num arquivo invalido
        // lanca `ERR_INVALID_TYPESCRIPT_SYNTAX`. E o parser, nao um heuristico.
        stripTypeScriptTypes(fonte, { mode: 'strip' });
      } catch (e) {
        quebrados.push(`${caminho} — ${String(e.message).split('\n')[0]}`);
      }
    }

    expect(
      quebrados,
      'Arquivo de Edge Function que NAO COMPILA:\n'
      + `  ${quebrados.join('\n  ')}\n\n`
      + '  Isto nao e estilo: o Supabase RECUSA a implantacao com esta mesma\n'
      + '  mensagem, e a funcao continua rodando a versao velha — em silencio,\n'
      + '  porque `npm run edges` compara a impressao da versao NO AR.\n\n'
      + '  Foi assim que `moderate-text` ficou com a constante da impressao\n'
      + '  dentro de um `import` de varias linhas, e todos os portoes passaram:\n'
      + '  o build so compila `src/`, o lint nao cobre esta pasta, e a trava da\n'
      + '  impressao compara HASH DE TEXTO — texto quebrado tem hash tambem.',
    ).toEqual([]);
  });

  it('a constante da impressão fica no nível de cima do arquivo', () => {
    // A trava acima pega o caso GERAL (não compila). Esta pega o caso
    // ESPECÍFICO que já aconteceu, e com mensagem que diz o que fazer — porque
    // "Expected ',', got 'IMPRESSAO_DESTE_CODIGO'" é verdade mas não ensina.
    const dentroDeImport = [];
    for (const nome of readdirSync(PASTA).sort()) {
      const dir = join(PASTA, nome);
      if (!statSync(dir).isDirectory()) continue;
      const caminho = join(dir, 'index.ts');
      let linhas;
      try { linhas = readFileSync(caminho, 'utf8').split('\n'); } catch { continue; }

      const i = linhas.findIndex((l) => /^const IMPRESSAO_DESTE_CODIGO = /.test(l));
      if (i < 0) continue;
      const antes = linhas.slice(0, i);
      const abertos = antes.filter((l) => /^import\s*\{\s*$/.test(l)).length;
      const fechados = antes.filter((l) => /^\}\s*from\s/.test(l)).length;
      if (abertos > fechados) dentroDeImport.push(`${caminho}:${i + 1}`);
    }

    expect(
      dentroDeImport,
      'A constante `IMPRESSAO_DESTE_CODIGO` esta DENTRO de um `import` aberto:\n'
      + `  ${dentroDeImport.join('\n  ')}\n\n`
      + '  Ela precisa ficar no nivel de cima, DEPOIS dos imports. O script\n'
      + '  `npm run impressao-edges` so SUBSTITUI a linha onde ela ja esta — ele\n'
      + '  nao move nem insere —, entao quem a colocou no lugar errado foi uma\n'
      + '  edicao a mao, e ela nao se conserta sozinha.',
    ).toEqual([]);
  });
});
