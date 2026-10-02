#!/usr/bin/env node
/**
 * O PORTÃO DE TIPOS DAS EDGE FUNCTIONS — `npm run tipos`
 *
 * ============================================================================
 * `[02/10]` POR QUE ELE EXISTE, e o bug que o pagou
 * ============================================================================
 *
 * As Edge Functions são TypeScript e **nada neste projeto as compilava**. O
 * `npm run build` só olha `src/`; as travas que "leem" uma Edge Function a
 * leem como TEXTO; e o Supabase implanta sem checar tipo. Então erro de tipo
 * só aparecia em produção.
 *
 * E apareceu. No `radar-de-pautas`:
 *
 *     const corpo = (extra) => ({ ...campos comuns, ...extra });   // montador
 *     if (!res.ok) {
 *       const corpo = (await res.text()).slice(0, 300);            // SOMBRA
 *       return responder(corpo({ status: "cota", error: aviso }));  // TypeError
 *     }
 *
 * A string sombreava o montador, o `TypeError` caía no `try/catch` em volta, e
 * **toda** recusa da Groq chegava na tela como *"A IA respondeu algo que eu nao
 * entendi"* — cota diária inclusive. Nada estourava, e o `admin_logs` ficava
 * CERTO, então só mentia para quem clicou.
 *
 * `deno check` acusa isso em um segundo: **`TS2349 This expression is not
 * callable`**, com o número da linha.
 *
 * ============================================================================
 * AS TRÊS ESCOLHAS, e cada uma tem motivo
 * ============================================================================
 *
 * **1. `--node-modules-dir=auto` em vez de um `deno.json` no repositório.**
 * A checagem precisa resolver `npm:openai`, que o `edge-runtime.d.ts` do
 * Supabase importa. Um `supabase/functions/deno.json` resolveria — e ficaria
 * na árvore que o CLI empacota e implanta. Flag de linha de comando não toca
 * no que vai para produção.
 *
 * **2. Uma função por vez, e o relatório vai até o fim.** Parar no primeiro
 * erro esconderia os outros nove, e quem conserta prefere a lista inteira.
 *
 * **3. Ele CONTA o que olhou, e reprova se não olhou nada.** É a lição do
 * `varrerFontes`: portão que varre pasta vazia não falha nunca e continua
 * imprimindo "nenhuma falha". Renomear `supabase/functions/` deixaria este
 * script verde para sempre sem esta checagem.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = 'supabase/functions';

const funcoes = existsSync(PASTA)
  ? readdirSync(PASTA, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(PASTA, e.name, 'index.ts')))
      .map((e) => e.name)
      .sort()
  : [];

console.log('\n  Tipos das Edge Functions\n');

// O CONTROLE. Sem ele, mover ou renomear a pasta vira "tudo certo" para sempre.
if (funcoes.length === 0) {
  console.error(`  NAO ENCONTREI NENHUMA Edge Function em ${PASTA}/.\n`);
  console.error('  Isto e falha do PORTAO, nao do codigo: ele deveria ter olhado');
  console.error('  10 funcoes e olhou zero. Se a pasta mudou de lugar, ajuste');
  console.error('  PASTA aqui — senao este portao fica verde sobre o nada.\n');
  process.exit(1);
}

let comErro = 0;

for (const nome of funcoes) {
  try {
    // `--no-lock`: o `deno.lock` nasceria na raiz do repositorio a cada
    // execucao, mudaria sozinho, e nao serve a ninguem — o Supabase nao o le
    // ao implantar. Arquivo que aparece sujando o `git status` sem ter dono e
    // ruido, e ruido ensina a ignorar o canal (§0.2, 4a regra).
    execFileSync('deno', ['check', '--no-lock', '--node-modules-dir=auto',
      join(PASTA, nome, 'index.ts')],
      { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
    console.log(`    OK        ${nome}`);
  } catch (e) {
    comErro++;
    console.log(`    FALHOU    ${nome}`);
    // Só as linhas de erro: o `deno check` imprime cada download tambem.
    const saida = String(e.stderr ?? e.stdout ?? e.message)
      .split('\n').filter((l) => !/^\s*(Download|Check|Initialize)/.test(l));
    console.log(saida.map((l) => `      ${l}`).join('\n'));
  }
}

console.log();

if (comErro) {
  console.error(`  ${comErro} de ${funcoes.length} funcao(oes) com erro de tipo.\n`);
  console.error('  Isto REPROVA porque nada mais compila as Edge Functions: o');
  console.error('  `npm run build` so olha src/, as travas as leem como texto, e o');
  console.error('  Supabase implanta sem checar. Erro que passa daqui so aparece');
  console.error('  em producao — foi assim que um `const` sombreou o montador da');
  console.error('  resposta do radar e toda falha da IA virou a mensagem errada');
  console.error('  na tela do dono, com o admin_logs certo (CLAUDE.md §1.5).\n');
  console.error('  Para reproduzir local:  npm run tipos\n');
  process.exit(1);
}

console.log(`  As ${funcoes.length} funcoes passam no \`deno check\`.\n`);
