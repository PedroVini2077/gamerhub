#!/usr/bin/env node
/**
 * PORTÃO: número escrito na documentação tem que bater com o projeto.
 *
 * ── O buraco que ele fecha, com o caso ──────────────────────────────────────
 *
 * Em 02/09 o dono perguntou se eu enxergava os splits. Fui conferir e achei
 * outra coisa: `docs/regras/AUDITORIA.md` afirmava *"131 arquivos / 14.362
 * linhas"* e *"~14 mil linhas, isso é lível por inteiro"*. O projeto tinha
 * **301 arquivos e 28.679 linhas** — o dobro.
 *
 * Nenhum dos três portões de documentação viu, e cada um por um motivo
 * diferente, o que mostra que não era descuido de um deles:
 *
 * | Portão | Por que passou |
 * | --- | --- |
 * | "PR tocou documentação?" | tocou, sempre — só nunca a linha errada |
 * | `documentacao-quebrada` | os arquivos citados existiam; o NÚMERO é que não |
 * | `documentacao-envelhecida` | conta commits, não confere afirmação |
 *
 * E o número não é enfeite: *"~14 mil linhas, lível por inteiro"* é a
 * **premissa** da regra que manda ler 100% do código numa auditoria. Planejar
 * uma auditoria com metade do tamanho real é descobrir no meio que não fecha.
 *
 * ── Como funciona ───────────────────────────────────────────────────────────
 *
 * O documento escreve o número dentro de um marcador invisível:
 *
 *     <!--n:src.arquivos-->301<!--/n-->
 *
 * Comentário HTML não aparece no markdown renderizado, então quem lê vê só o
 * número. Este script mede o projeto e reescreve o miolo. No CI ele roda com
 * `--check` e **reprova** se algum estiver diferente.
 *
 * ── As três escolhas, e o porquê de cada uma ────────────────────────────────
 *
 * 1. **Marcador explícito, não varredura de padrão.** Varrer o texto atrás de
 *    "N linhas" pegaria também o histórico legítimo ("918 → 197 linhas"), que
 *    PRECISA continuar congelado. Alarme que grita no lugar certo pelo motivo
 *    errado vira ruído (`CLAUDE.md` §0.2, 4ª regra).
 *
 * 2. **Chave desconhecida é ERRO, não silêncio.** Um `<!--n:src.arquivo-->`
 *    com typo passaria a nunca ser atualizado, e o documento voltaria a
 *    envelhecer sem ninguém notar — fallback silencioso do §4, na pior versão:
 *    a que finge que o portão está cuidando.
 *
 * 3. **Só mede o que está no repositório.** Número de tabela, de policy e de
 *    função `SECURITY DEFINER` vive no banco, e um retrato dele guardado aqui
 *    envelheceria em silêncio — exatamente o problema que este arquivo existe
 *    para matar. Esses continuam sendo medidos na hora, pelas consultas da
 *    Fase 0 da auditoria.
 *
 * Uso:  node scripts/numeros-do-projeto.mjs            (reescreve)
 *       node scripts/numeros-do-projeto.mjs --check    (só confere; CI)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CONFERIR = process.argv.includes('--check');

const EXTENSOES_DE_CODIGO = ['.js', '.jsx'];

/** Todos os arquivos de código sob uma pasta, recursivo. */
function arquivosDe(pasta) {
  const raiz = join(RAIZ, pasta);
  const varrer = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return varrer(caminho);
    return EXTENSOES_DE_CODIGO.some(x => e.name.endsWith(x)) ? [caminho] : [];
  });
  return varrer(raiz);
}

const contarLinhas = (arquivos) => arquivos
  .reduce((n, a) => n + readFileSync(a, 'utf8').split('\n').length - 1, 0);

/** Uma pasta vira duas métricas: quantos arquivos e quantas linhas. */
function pasta(nome, caminho) {
  return {
    [`${nome}.arquivos`]: () => arquivosDe(caminho).length,
    [`${nome}.linhas`]: () => contarLinhas(arquivosDe(caminho)),
  };
}

/**
 * As métricas conhecidas. Acrescentar aqui é o que autoriza um documento a
 * usar a chave — e é de propósito que a lista seja fechada.
 */
const METRICAS = {
  ...pasta('src', 'src'),
  ...pasta('src.lib', 'src/lib'),
  ...pasta('src.components', 'src/components'),
  ...pasta('src.hooks', 'src/hooks'),
  ...pasta('src.pages', 'src/pages'),
  ...pasta('src.services', 'src/services'),

  /** Arquivos de teste unitário — a rede que o `npm test` roda. */
  'testes.arquivos': () => arquivosDe('src')
    .filter(a => /\.test\.(js|jsx)$/.test(a)).length,

  /** Roteiros de navegador de verdade, em `e2e/`. */
  'e2e.roteiros': () => readdirSync(join(RAIZ, 'e2e'))
    .filter(f => f.endsWith('.mjs')).length,

  /** Os portões e utilitários de linha de comando. */
  'scripts.total': () => readdirSync(join(RAIZ, 'scripts')).length,

  /**
   * O piso de testes que o CI exige, LIDO do `ci.yml`.
   *
   * Ele é medido no workflow e não aqui de propósito: rodar a suíte inteira só
   * para conferir um número da documentação custaria minutos em todo PR. O que
   * este número trava é a **divergência entre o portão e o texto** — em 02/09 o
   * `OPERACAO.md` dizia "piso de 168" e o `ci.yml` exigia 222, com 437 testes
   * reais. Os três números diferentes, e nenhum errado por si só: ninguém
   * comparava.
   */
  'testes.piso': () => {
    const ci = readFileSync(join(RAIZ, '.github/workflows/ci.yml'), 'utf8');
    const achado = ci.match(/^\s*piso=(\d+)\s*$/m);
    if (!achado) throw new Error('nao achei `piso=N` em .github/workflows/ci.yml');
    return Number(achado[1]);
  },

  /**
   * Migrations versionadas — a única receita que recria o banco.
   *
   * O número importa porque o README manda aplicar "todas em ordem": se ele
   * disser 136 e existirem 142, quem for recriar o banco para no meio sem saber.
   */
  migrations: () => readdirSync(join(RAIZ, 'supabase/migrations'))
    .filter(f => f.endsWith('.sql')).length,

  /** Edge Functions publicadas na Supabase. */
  'edge.funcoes': () => readdirSync(join(RAIZ, 'supabase/functions'), { withFileTypes: true })
    .filter(e => e.isDirectory()).length,

  /** O tamanho da própria documentação — ela também cresce sem ninguém ver. */
  'docs.arquivos': () => documentos().length,
  'docs.linhas': () => documentos()
    .reduce((n, d) => n + readFileSync(join(RAIZ, d), 'utf8').split('\n').length - 1, 0),
};

/** Todo `.md` rastreado pelo git — o que não está versionado não é documentação. */
function documentos() {
  return execFileSync('git', ['ls-files', '*.md'], { cwd: RAIZ, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
}

/** 28679 -> "28.679", que é como o número aparece escrito nos documentos. */
const formatar = (n) => n.toLocaleString('pt-BR');

const MARCADOR = /<!--n:([a-z0-9.]+)-->(.*?)<!--\/n-->/gs;

const problemas = [];
const desatualizados = [];
let reescritos = 0;
let ocorrencias = 0;
const usadas = new Set();

for (const doc of documentos()) {
  const caminho = join(RAIZ, doc);
  const antes = readFileSync(caminho, 'utf8');

  const depois = antes.replace(MARCADOR, (inteiro, chave, valorEscrito) => {
    ocorrencias += 1;
    usadas.add(chave);

    const medir = METRICAS[chave];
    if (!medir) {
      problemas.push(
        `\`${doc}\` usa a chave \`${chave}\`, que NAO existe.\n`
        + '    Chave desconhecida nunca seria atualizada, e o documento voltaria\n'
        + '    a envelhecer em silencio — com o agravante de parecer vigiado.\n'
        + `    Chaves validas: ${Object.keys(METRICAS).join(', ')}`,
      );
      return inteiro;
    }

    const atual = formatar(medir());
    if (atual !== valorEscrito) {
      desatualizados.push({ doc, chave, escrito: valorEscrito, atual });
    }
    return `<!--n:${chave}-->${atual}<!--/n-->`;
  });

  if (depois !== antes && !CONFERIR) {
    writeFileSync(caminho, depois);
    reescritos += 1;
  }
}

console.log('\n  Números do projeto — o que a documentação afirma × o que é\n');

if (problemas.length) {
  console.error(`  ${problemas.length} chave(s) invalida(s):\n`);
  problemas.forEach(p => console.error(`  ─ ${p}\n`));
  process.exit(1);
}

if (desatualizados.length === 0) {
  console.log(`  OK: ${ocorrencias} número(s) conferido(s) em ${documentos().length} documentos.`);
  console.log(`  Métricas conhecidas: ${Object.keys(METRICAS).length} · em uso: ${usadas.size}\n`);
  process.exit(0);
}

for (const { doc, chave, escrito, atual } of desatualizados) {
  console.log(`  ${doc}  ${chave}: escrito "${escrito}", é "${atual}"`);
}

if (CONFERIR) {
  console.error(
    `\n  ${desatualizados.length} número(s) da documentação nao batem com o projeto.\n`
    + '\n  Rode `npm run numeros` para corrigir, e ENTAO leia o que estava em volta:\n'
    + '  numero errado quase nunca vem sozinho. O caso que originou este portao era\n'
    + '  "~14 mil linhas, livel por inteiro" — o numero estava velho E a frase que\n'
    + '  dependia dele tinha deixado de ser verdade.\n',
  );
  process.exit(1);
}

console.log(`\n  ${desatualizados.length} número(s) atualizado(s) em ${reescritos} documento(s).`);
console.log('  Confira o texto EM VOLTA de cada um: a frase que citava o número\n'
  + '  pode ter deixado de ser verdade junto com ele.\n');
