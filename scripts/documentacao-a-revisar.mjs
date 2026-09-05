#!/usr/bin/env node
/**
 * A LISTA DE LEITURA da sessão: quais documentos abrir, e por quê.
 *
 * ── O pedido, e por que ele não se resolve lendo tudo ───────────────────────
 *
 * Do dono em 02/09: *"toda a documentação do projeto, não falo algumas, todas!
 * todas devem estar atualizadas, e em uma única sessão, então quero que vc
 * atualize tudo e de um jeito de ler toda a documentação ou as que fizerem
 * sentido para aquela sessão"*.
 *
 * A parte difícil é a última. São <!--n:docs.arquivos-->26<!--/n--> documentos
 * e <!--n:docs.linhas-->9.443<!--/n--> linhas: ler tudo por precaução a cada
 * sessão consome contexto que deveria ir para o trabalho (§0.1), e o efeito
 * colateral é conhecido — quando a leitura fica cara demais, ela deixa de
 * acontecer, e aí nenhum documento é lido.
 *
 * Este script responde a pergunta certa: **quais documentos o trabalho DESTA
 * sessão tornou suspeitos?** Ele cruza o que mudou no git com o mapa de
 * territórios e devolve uma lista curta, cada linha dizendo o que mudou embaixo
 * dela.
 *
 * ── A diferença para o `documentacao-envelhecida.mjs` ───────────────────────
 *
 * | | Pergunta | Quando | O que faz |
 * | --- | --- | --- | --- |
 * | `envelhecida` | que documento ficou para trás **no geral**? | dia 1º | abre issue |
 * | **este** | que documento **eu** tornei suspeito **agora**? | durante a sessão | imprime lista |
 *
 * O primeiro olha o histórico inteiro e é lento de agir. Este olha o trabalho
 * em curso e serve para agir antes do PR — que é o momento em que a §6.2 regra
 * 1 exige a documentação junto.
 *
 * Uso:  npm run docs            (o que MINHA sessão tornou suspeito)
 *       npm run docs -- --tudo  (o estado de TODOS, para varredura completa)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TERRITORIO, coberta } from './territorio.mjs';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const TUDO = process.argv.includes('--tudo');

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

/**
 * O que esta sessão mexeu: não commitado + o que a branch tem além da `main`.
 *
 * As duas metades importam. Só o não commitado perderia o trabalho que já virou
 * commit nesta mesma sessão; só o diff contra a `main` perderia o que ainda
 * está no diretório — e é justamente esse que está a tempo de ser corrigido.
 */
function mexidoNaSessao() {
  const naoCommitado = git('status', '--porcelain').split('\n')
    .filter(Boolean).map(l => l.slice(3).trim());

  const base = git('merge-base', 'HEAD', 'origin/main') || git('merge-base', 'HEAD', 'main');
  const commitado = base
    ? git('diff', '--name-only', `${base}..HEAD`).split('\n').filter(Boolean)
    : [];

  return [...new Set([...naoCommitado, ...commitado])];
}

/** Há quantos dias o documento não é tocado — o sinal mais barato que existe. */
function diasParado(doc) {
  const quando = git('log', '-1', '--format=%ct', '--', doc);
  if (!quando) return null;
  return Math.floor((Date.now() / 1000 - Number(quando)) / 86400);
}

/** Números escritos no documento que não batem mais com o projeto. */
function numerosSuspeitos(doc) {
  const caminho = join(RAIZ, doc);
  if (!existsSync(caminho)) return 0;
  return (readFileSync(caminho, 'utf8').match(/<!--n:[a-z0-9.]+-->/g) ?? []).length;
}

const mexido = TUDO ? null : mexidoNaSessao();
const linhas = [];

for (const [doc, caminhos] of Object.entries(TERRITORIO)) {
  if (!existsSync(join(RAIZ, doc))) continue;

  const tocadoNaSessao = mexido?.includes(doc) ?? false;

  // O que ESTA sessão mexeu dentro do território deste documento.
  const dentroDoTerritorio = (mexido ?? [])
    .filter(f => coberta(f, caminhos))
    .filter(f => !f.endsWith('.md'));

  if (TUDO) {
    linhas.push({ doc, dias: diasParado(doc), numeros: numerosSuspeitos(doc), motivo: null });
  } else if (dentroDoTerritorio.length > 0) {
    linhas.push({
      doc,
      dias: diasParado(doc),
      numeros: numerosSuspeitos(doc),
      motivo: dentroDoTerritorio,
      tocadoNaSessao,
    });
  }
}

if (TUDO) {
  console.log(`\n  Todos os ${linhas.length} documentos mapeados, por idade\n`);
  linhas.sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));
  for (const l of linhas) {
    const n = l.numeros ? ` · ${l.numeros} número(s) vigiado(s)` : '';
    console.log(`  ${String(l.dias ?? '?').padStart(4)} dias  ${l.doc}${n}`);
  }
  console.log(
    '\n  Idade sozinha NAO quer dizer desatualizado — um documento pode estar\n'
    + '  certo ha meses. Ela diz onde a chance e maior. Sem `--tudo`, este\n'
    + '  script responde a pergunta melhor: o que ESTA sessao tornou suspeito.\n',
  );
  process.exit(0);
}

console.log('\n  Documentação que ESTA sessão tornou suspeita\n');

if (linhas.length === 0) {
  console.log('  Nenhuma: o que foi mexido não está no território de documento nenhum.');
  console.log('  (Se isso parece errado, a pasta pode estar fora do mapa —');
  console.log('   `node scripts/territorio-coberto.mjs` responde.)\n');
  process.exit(0);
}

for (const { doc, dias, motivo, tocadoNaSessao, numeros } of linhas) {
  const marca = tocadoNaSessao ? 'JA TOCADO' : 'NAO TOCADO';
  console.log(`  [${marca}]  ${doc}   (parado há ${dias} dias)`);
  for (const m of motivo.slice(0, 6)) console.log(`      mudou: ${m}`);
  if (motivo.length > 6) console.log(`      …e mais ${motivo.length - 6}`);
  if (numeros) console.log(`      ${numeros} número(s) vigiado(s) — \`npm run numeros\` confere`);
  console.log('');
}

const naoTocados = linhas.filter(l => !l.tocadoNaSessao);
if (naoTocados.length) {
  console.log(
    `  ${naoTocados.length} documento(s) com o territorio mexido e o texto intacto.\n`
    + '\n  Isso NAO quer dizer que estao errados — quer dizer que ninguem olhou.\n'
    + '  A §6.2 camada 3 e explicita: proibido decidir de memoria. Abra a secao\n'
    + '  alvo e confira contra o sistema; se continuar verdadeira, otimo.\n',
  );
} else {
  console.log('  Todos os documentos suspeitos já foram tocados nesta sessão.\n');
}
