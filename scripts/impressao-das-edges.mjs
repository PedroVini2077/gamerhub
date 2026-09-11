// A IMPRESSÃO de cada Edge Function — o número que denuncia deriva.
//
// ── O buraco que isto fecha ─────────────────────────────────────────────────
//
// `[10/09]` As duas correções da `send-email` ficaram **5 dias mortas** em
// produção enquanto a documentação, um comentário no `e2e/portas-fechadas.mjs`
// e o próprio código as descreviam como vivas. Ninguém mentiu: é o §9.9 puro —
// *commit não é deploy*. `scripts/espelho-de-migrations.mjs` já fazia esta
// pergunta para migrations; para as 8 Edge Functions não existia equivalente.
//
// ── Por que IMPRESSÃO, e não um número de versão escrito à mão ──────────────
//
// Uma constante `VERSAO = '2026-09-11'` tem o defeito de reproduzir o próprio
// problema que deveria pegar: eu edito o corpo da função, esqueço de subir a
// data, e os dois lados passam a concordar num número velho. O portão fica
// verde exatamente no caso que ele existe para pegar.
//
// A impressão é derivada do CÓDIGO. Não dá para esquecer de mudá-la, porque não
// é escrita à mão — e o `npm test` reprova quando a escrita no arquivo não bate
// com a calculada. É o mesmo padrão do `impressao` de `lib/documentosLegais.js`,
// e a razão é a mesma: número que alguém digita, alguém esquece.
//
// ── A circularidade, e como ela se resolve ──────────────────────────────────
//
// A impressão mora DENTRO do arquivo que ela resume, então incluí-la no cálculo
// seria morder o próprio rabo. A linha da constante é **normalizada** antes de
// hashear: some o valor, fica o esqueleto. Tudo o mais do arquivo entra.
//
// Entram também os arquivos IRMÃOS da pasta (`politica.ts`,
// `email-template.ts`): eles vão no mesmo bundle, e uma mudança neles muda o
// que roda em produção tanto quanto uma no `index.ts`.
//
// Uso:
//   node scripts/impressao-das-edges.mjs             grava as impressões
//   node scripts/impressao-das-edges.mjs --conferir  só confere (não escreve)

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const PASTA = 'supabase/functions';

/** O nome da constante, e a linha inteira que a declara. */
const NOME = 'IMPRESSAO_DESTE_CODIGO';
const LINHA = new RegExp(`^const ${NOME} = "([0-9a-f]*)";$`, 'm');

/** Quantos caracteres do sha256. 16 já são 64 bits — colisão não é o risco aqui. */
const TAMANHO = 16;

/** As funções que existem no repositório, em ordem estável. */
export function funcoes() {
  return readdirSync(PASTA)
    .filter((n) => statSync(join(PASTA, n)).isDirectory())
    .sort();
}

/**
 * A impressão CALCULADA de uma função: todos os arquivos da pasta, com a linha
 * da própria constante neutralizada.
 *
 * Ordem alfabética e nome do arquivo dentro do hash: sem isso, renomear um
 * arquivo sem mudar uma linha passaria despercebido.
 */
export function calcular(nome) {
  const dir = join(PASTA, nome);
  const h = createHash('sha256');
  for (const arquivo of readdirSync(dir).sort()) {
    const caminho = join(dir, arquivo);
    if (!statSync(caminho).isFile()) continue;
    const texto = readFileSync(caminho, 'utf8').replace(LINHA, `const ${NOME} = "";`);
    h.update(arquivo).update('\0').update(texto).update('\0');
  }
  return h.digest('hex').slice(0, TAMANHO);
}

/** A impressão ESCRITA no `index.ts`, ou `null` se a função ainda não tem uma. */
export function escrita(nome) {
  const caminho = join(PASTA, nome, 'index.ts');
  const m = readFileSync(caminho, 'utf8').match(LINHA);
  return m ? m[1] : null;
}

/** Grava a impressão calculada. Devolve `true` se o arquivo mudou. */
function gravar(nome) {
  const caminho = join(PASTA, nome, 'index.ts');
  const antes = readFileSync(caminho, 'utf8');
  if (!LINHA.test(antes)) return false;
  // Zera antes de calcular: senão o valor velho entraria no hash pela porta dos
  // fundos e a impressão dependeria da anterior, virando uma corrente.
  const novo = calcular(nome);
  const depois = antes.replace(LINHA, `const ${NOME} = "${novo}";`);
  if (depois === antes) return false;
  writeFileSync(caminho, depois);
  return true;
}

if (!process.env.VITEST && import.meta.url === `file://${process.argv[1]}`) {
  const soConferir = process.argv.includes('--conferir');
  const semMarcador = [];
  const desatualizadas = [];
  let gravadas = 0;

  for (const nome of funcoes()) {
    const atual = escrita(nome);
    if (atual === null) { semMarcador.push(nome); continue; }
    const esperada = calcular(nome);
    if (atual === esperada) continue;
    if (soConferir) desatualizadas.push({ nome, atual, esperada });
    else if (gravar(nome)) gravadas++;
  }

  console.log('\n  Impressao das Edge Functions\n');

  if (semMarcador.length) {
    console.log('  SEM MARCADOR — estas funcoes nao podem ser vigiadas:');
    for (const n of semMarcador) console.log(`    ${n}`);
    console.log(`\n  Acrescente no index.ts de cada uma:\n`);
    console.log(`    const ${NOME} = "";`);
    console.log('    // e o ramo de GET que a devolve — ver supabase/functions/README.md\n');
    process.exit(1);
  }

  if (desatualizadas.length) {
    console.log('  DESATUALIZADA(S) — o codigo mudou e a impressao nao:\n');
    for (const d of desatualizadas) {
      console.log(`    ${d.nome.padEnd(20)} escrita ${d.atual}  calculada ${d.esperada}`);
    }
    console.log('\n  Rode `npm run impressao-edges` e commite o resultado.\n');
    process.exit(1);
  }

  console.log(soConferir
    ? `  OK: as ${funcoes().length} impressoes batem com o codigo.\n`
    : `  ${gravadas} impressao(oes) atualizada(s) de ${funcoes().length} funcao(oes).\n`);
}
