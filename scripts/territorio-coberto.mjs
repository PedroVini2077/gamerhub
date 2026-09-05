#!/usr/bin/env node
/**
 * PORTÃO: nenhuma parte do sistema pode ficar sem documento responsável.
 *
 * ── O buraco que ele fecha ──────────────────────────────────────────────────
 *
 * O relatório `documentacao-envelhecida.mjs` avisa quando um documento fica
 * para trás do território dele. Só que ele **só enxerga o que está no mapa** —
 * e o mapa é escrito à mão. Pasta que ninguém mapeou não fica "atrasada":
 * fica invisível, que é pior, porque o relatório verde passa a significar
 * "nada a olhar" quando na verdade significa "não olhei ali".
 *
 * Aconteceu, e o caso é exato: `src/components/privacidade/` — onde mora o
 * TEXTO DA POLÍTICA DE PRIVACIDADE — não estava em território nenhum. O PR
 * #140 reescreveu o bloco de retenção da política e nenhum portão esperava que
 * `docs/PRIVACIDADE.md` fosse junto. Os três portões de documentação deram
 * verde sobre uma mudança em documento legal.
 *
 * ── Por que ele REPROVA, e o irmão não ──────────────────────────────────────
 *
 * `documentacao-envelhecida` responde uma pergunta de julgamento ("este texto
 * ainda é verdade?") e por isso abre issue em vez de reprovar. Este responde
 * uma pergunta objetiva: **a pasta está no mapa, ou não está?** Sem julgamento
 * no meio, portão vermelho é honesto.
 *
 * ── A saída de emergência, e por que ela é explícita ────────────────────────
 *
 * Uma pasta pode legitimamente não ter documento — `src/assets` é conteúdo, não
 * comportamento. Para essas existe `SEM_DONO`, que exige o **motivo escrito**.
 * O que não pode existir é a terceira opção: pasta que ninguém decidiu nada
 * sobre e que some do radar (`CLAUDE.md` §4, fallback silencioso).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TERRITORIO, GRANULARIDADE, coberta } from './territorio.mjs';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/**
 * Pastas que NÃO precisam de documento, com o motivo.
 *
 * Cada linha aqui é uma decisão consciente, e é isso que a diferencia de um
 * esquecimento. Acrescentar sem motivo escrito é transformar o portão em
 * carimbo.
 */
const SEM_DONO = {
  'src/assets': 'mídia e som — conteúdo, não comportamento. O crédito das '
    + 'licenças é travado por conteudoDoSobre.test.js, não por documento.',
};

const TODOS_OS_CAMINHOS = Object.values(TERRITORIO).flat();

/** Expande a granularidade declarada nas unidades concretas de hoje. */
function unidades() {
  const lista = [];
  for (const { pasta, tipo } of GRANULARIDADE) {
    const absoluto = join(RAIZ, pasta);
    if (!existsSync(absoluto)) continue;

    if (tipo === 'inteira') { lista.push(pasta); continue; }

    for (const e of readdirSync(absoluto, { withFileTypes: true })) {
      if (tipo === 'subpastas' && e.isDirectory()) lista.push(`${pasta}/${e.name}`);
      if (tipo === 'arquivos' && e.isFile() && /\.(js|jsx)$/.test(e.name)) {
        lista.push(`${pasta}/${e.name}`);
      }
    }
  }
  return lista;
}

/** Território que aponta para caminho que não existe mais — mapa apodrecendo. */
function territoriosMortos() {
  const mortos = [];
  for (const [doc, caminhos] of Object.entries(TERRITORIO)) {
    for (const c of caminhos) {
      if (!existsSync(join(RAIZ, c))) mortos.push({ doc, caminho: c });
    }
  }
  return mortos;
}

const orfas = unidades().filter(u => !(u in SEM_DONO) && !coberta(u, TODOS_OS_CAMINHOS));
const mortos = territoriosMortos();

console.log('\n  Cobertura do mapa de territórios\n');

if (orfas.length === 0 && mortos.length === 0) {
  const total = unidades().length;
  console.log(`  OK: ${total} unidade(s) do sistema, todas com documento responsável`);
  console.log(`  (${Object.keys(SEM_DONO).length} dispensada(s) com motivo escrito).\n`);
  process.exit(0);
}

if (orfas.length) {
  console.error(`  ${orfas.length} parte(s) do sistema sem documento responsável:\n`);
  for (const o of orfas) console.error(`  ─ ${o}`);
  console.error(
    '\n    Nenhum documento se considera dono destas pastas, entao mexer nelas\n'
    + '    NAO faz portao nenhum pedir que a documentacao acompanhe. Foi assim\n'
    + '    que uma mudanca no TEXTO DA POLITICA DE PRIVACIDADE passou verde.\n\n'
    + '    Escolha uma das duas, em scripts/territorio.mjs:\n'
    + '      1. acrescente a pasta ao TERRITORIO do documento que a descreve;\n'
    + '      2. se ela realmente nao tem documento, declare em SEM_DONO\n'
    + '         (em territorio-coberto.mjs) COM O MOTIVO.\n',
  );
}

if (mortos.length) {
  console.error(`  ${mortos.length} território(s) apontando para caminho que não existe:\n`);
  for (const m of mortos) console.error(`  ─ ${m.doc} -> ${m.caminho}`);
  console.error(
    '\n    O caminho foi renomeado ou apagado. Enquanto ele estiver aqui, o\n'
    + '    documento parece vigiado e nao esta: o relatorio pula caminho que\n'
    + '    nao existe. Atualize em scripts/territorio.mjs.\n',
  );
}

process.exit(1);
