/**
 * `[25/09]` Ler o auditor do banco a partir das MIGRATIONS — só a leitura.
 *
 * Extraído de `auditorDoBancoEhOuvido.test.js`, que passou de 300 linhas ao
 * ganhar a 6ª checagem (§4). É movimentação mecânica: nenhuma asserção mudou
 * de lugar, nenhum comportamento mudou.
 *
 * O que fica AQUI é a máquina de leitura. O que fica LÁ são as três listas de
 * exceção — porque elas são a **expectativa declarada** do teste, e expectativa
 * longe da asserção é expectativa que ninguém relê.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const PASTA = 'supabase/migrations';

/** Comentário de SQL é PROSA, e prosa cita comando. Já me pegou 10 vezes. */
export const semComentariosSQL = (sql) =>
  sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

export const SQL = (() => {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) throw new Error(`Nenhuma migration em "${PASTA}".`);
  return nomes.map(n => semComentariosSQL(readFileSync(join(PASTA, n), 'utf8'))).join('\n');
})();

/**
 * `[25/09]` As definições do auditor, em ordem de migration.
 *
 * ── O defeito que esta função tinha, e ele já estava NO AR ────────────────
 *
 * A marcação era literal: `\$fn\$[\s\S]*?\$fn\$`. A SEC-052 passou a escrever
 * a função com `$function$` (é o que o `pg_get_functiondef` devolve, e é de lá
 * que o espelho da migration sai). A partir daquele PR esta trava **parou de
 * ler o auditor de verdade** e passou a conferir a versão da SEC-051 — verde,
 * confiante, e olhando para um retrato velho.
 *
 * É o §1.5 aplicado à própria esteira: nada estourou, nada logou, e a trava
 * simplesmente deixou de cobrir o que ela existe para cobrir. Mesma família do
 * portão de números que cegava o relatório de documentação.
 *
 * ── As duas mudanças ──────────────────────────────────────────────────────
 *
 * 1. A marcação passa a CAPTURAR o rótulo do dólar (`$fn$`, `$function$`, o
 *    que for) e exigir o mesmo na abertura e no fechamento. Trocar o rótulo
 *    deixa de cegar a trava.
 * 2. A contagem é conferida contra os ARQUIVOS que definem a função. Se uma
 *    definição voltar a ficar invisível por qualquer motivo de forma, o número
 *    não bate e a trava reprova — em vez de ler a penúltima em silêncio.
 */
export function definicoesDoAuditor() {
  const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?auditoria_de_operadores[\s\S]*?\bAS\s+(\$[A-Za-z_]*\$)[\s\S]*?\1/gi;
  return SQL.match(re) ?? [];
}

/** Quantos ARQUIVOS de migration definem o auditor. A referência da contagem. */
export function arquivosQueDefinemOAuditor() {
  return readdirSync(PASTA).filter(n => n.endsWith('.sql')).filter(n => (
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?auditoria_de_operadores/i
      .test(semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')))
  ));
}

/** O corpo da última definição do auditor. */
export function auditor() {
  const achados = definicoesDoAuditor();
  const arquivos = arquivosQueDefinemOAuditor();

  if (achados.length === 0) {
    throw new Error(
      'A `auditoria_de_operadores` sumiu das migrations, ou a marcação mudou.\n'
      + '  Sem ela esta trava não olha nada e fica verde para sempre.');
  }
  if (achados.length !== arquivos.length) {
    throw new Error(
      `Esta trava enxerga ${achados.length} definição(ões) do auditor, mas `
      + `${arquivos.length} arquivo(s) o definem:\n`
      + arquivos.map(a => `    ${a}`).join('\n')
      + '\n\n  Alguma definição ficou INVISÍVEL para a marcação — e a trava passaria'
      + '\n  a conferir uma versão velha, verde e errada. Foi exatamente isso que'
      + '\n  aconteceu quando a SEC-052 trocou `$fn$` por `$function$`.'
      + '\n  Conserte a marcação em `definicoesDoAuditor()`, não a migration.');
  }
  return achados[achados.length - 1];
}
