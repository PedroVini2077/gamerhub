#!/usr/bin/env node
/**
 * PORTÃO: vulnerabilidade `high`/`critical` reprova — menos as ACEITAS por
 * escrito, e a lista das aceitas **não pode apodrecer**.
 *
 * ── Por que ele nasceu, com o caso ──────────────────────────────────────────
 *
 * Em 02/10 apareceu `GHSA-vfj7-8cjw-p6xm` em `braces`, transitiva do
 * Tailwind 3 (`tailwindcss → chokidar/fast-glob → micromatch → braces`).
 *
 * **Não existe versão corrigida.** `braces` está em 3.0.3, a última publicada,
 * e o advisory cobre `<=3.0.3`. O que o `npm audit fix` oferece é subir o
 * Tailwind para 4 — que não corrige o `braces`: ele **remove a cadeia**,
 * porque o Tailwind 4 usa outro motor. É reescrita, com a configuração em CSS.
 *
 * Resultado: o portão ficou vermelho em algo **sem conserto disponível**. E
 * portão que não pode ser satisfeito é a 4ª regra do §0.2 pelo avesso — ele não
 * grita à toa, ele grita o que ninguém pode calar, e aí alguém o desliga.
 *
 * ── O que ele NÃO é ────────────────────────────────────────────────────────
 *
 * **Não é jeito de silenciar advisory chato.** A exceção exige motivo escrito,
 * data e a condição de saída, e `advisoriesAceitosTemMotivo.test.js` reprova
 * entrada sem as três.
 *
 * ── A parte que impede a lista de apodrecer ─────────────────────────────────
 *
 * Ele reprova TAMBÉM quando um advisory aceito **deixa de aparecer**. Sem
 * isso, a lista viraria um cemitério de exceções para problemas que já não
 * existem — e a próxima pessoa a ler não saberia quais ainda valem.
 *
 * Uso:  node scripts/advisories-aceitos.mjs
 */
import { execFileSync } from 'node:child_process';

/**
 * Cada entrada é uma DECISÃO, não um silenciamento. Quem acrescentar aqui
 * responde as três perguntas, e o teste cobra.
 */
export const ACEITOS = [
  {
    id: 'GHSA-vfj7-8cjw-p6xm',
    pacote: 'braces',
    desde: '2026-10-02',
    motivo:
      'Nao existe versao corrigida: `braces` esta em 3.0.3, a ultima publicada, e o '
      + 'advisory cobre <=3.0.3. E dependencia de BUILD (tailwindcss -> chokidar/fast-glob '
      + '-> micromatch -> braces): ela nao vai para o navegador e nao processa entrada de '
      + 'usuario. O ataque e exaustao de pilha com padrao glob aninhado, e quem escolhe os '
      + 'nossos globs e o `tailwind.config.js` — ou seja, exige quem ja tem escrita no repo.',
    sai_quando:
      'O Tailwind 4 entrar (item no BACKLOG). Ele troca o motor e a cadeia inteira some — '
      + 'nao e patch do braces, e remocao da dependencia.',
  },
];

const PERIGOSAS = new Set(['high', 'critical']);
const DE_REDE = /audit endpoint returned an error|service unavailable|ENOTFOUND|ETIMEDOUT|socket hang up/i;

function auditar() {
  try {
    return { json: execFileSync('npm', ['audit', '--json'], { encoding: 'utf8' }) };
  } catch (e) {
    // `npm audit` sai com 1 quando ACHA algo — a saída ainda é o JSON válido.
    const saida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    if (DE_REDE.test(saida)) return { indisponivel: saida };
    if (e.stdout) return { json: e.stdout };
    return { indisponivel: saida || String(e) };
  }
}

const r = auditar();

// "Não consegui verificar" ≠ "verifiquei e está ruim". A primeira AVISA e
// segue; foi um 503 do registro que reprovou o PR #154 com tudo verde.
if (r.indisponivel) {
  console.log('\n  npm audit NAO RODOU — o registro do npm nao respondeu.');
  console.log('  Isto nao diz nada sobre as dependencias. Rode de novo mais tarde.\n');
  process.exit(0);
}

const dados = JSON.parse(r.json);
const encontrados = new Map();   // id do advisory -> pacote

for (const [pacote, v] of Object.entries(dados.vulnerabilities ?? {})) {
  if (!PERIGOSAS.has(v.severity)) continue;
  for (const via of v.via) {
    if (typeof via === 'object' && via.url) {
      const id = via.url.split('/').pop();
      if (!encontrados.has(id)) encontrados.set(id, pacote);
    }
  }
}

const aceitos = new Set(ACEITOS.map((a) => a.id));
const novos = [...encontrados].filter(([id]) => !aceitos.has(id));
const sumiram = ACEITOS.filter((a) => !encontrados.has(a.id));

console.log('\n  Auditoria de dependencias\n');
for (const a of ACEITOS) {
  const estado = encontrados.has(a.id) ? 'aceito' : 'SUMIU';
  console.log(`    [${estado}]  ${a.id}  ${a.pacote}  (desde ${a.desde})`);
}

if (novos.length) {
  console.error(`\n  ${novos.length} vulnerabilidade(s) high/critical SEM decisao escrita:\n`);
  for (const [id, pacote] of novos) console.error(`    ${id}  em  ${pacote}`);
  console.error('\n  Conserte (`npm audit fix`, ou um `overrides` no package.json).');
  console.error('  Se NAO houver conserto, acrescente em ACEITOS neste arquivo com');
  console.error('  motivo, data e a condicao de saida — o teste cobra as tres.\n');
  process.exit(1);
}

if (sumiram.length) {
  console.error(`\n  ${sumiram.length} advisory(s) ACEITO(S) nao aparece(m) mais:\n`);
  for (const a of sumiram) console.error(`    ${a.id}  em  ${a.pacote}`);
  console.error('\n  Tire-o(s) de ACEITOS. Lista de excecao que guarda problema morto');
  console.error('  deixa de dizer quais ainda valem — e a proxima pessoa confia nela.\n');
  process.exit(1);
}

console.log('\n  Nenhuma vulnerabilidade high/critical fora das aceitas.\n');
