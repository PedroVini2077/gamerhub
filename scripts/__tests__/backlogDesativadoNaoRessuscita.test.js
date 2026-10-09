import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[09/10]` O BLOCO DESATIVADO não pode voltar a ser fila.
 *
 * ── O caso que o originou ──────────────────────────────────────────────────
 *
 * Em 17/09 ele escreveu no `BACKLOG.md`: *"ligar o contador de tentativas não
 * dá, é pago esqueceu?"*. Em 09/10 eu listei o mesmo contador para ele como
 * *"só depende de mim"* — **depois de reler a fila**.
 *
 * Não faltava informação: o item dizia, por extenso e com link para a
 * documentação, que o hook é `Teams and Enterprise`. **Faltava lugar.** Ele
 * morava numa seção chamada *"precisa de ação ou decisão do dono"*, marcado
 * 🟠, e o `inicio-de-sessao.sh` imprime todo `- ⬜` com 🔴/🟠 como prioridade
 * da sessão. O gatilho feito para eu não esquecer era o que o ressuscitava.
 *
 * ── Por que a marca é `- ⏸️` e não um título bonito ───────────────────────
 *
 * Porque **duas máquinas leem este arquivo procurando `^- ⬜`**: o contador de
 * itens abertos e o gatilho de sessão. Trocar a marca desliga as duas de uma
 * vez, sem regra nova e sem depender de eu lembrar (§9.8, pergunta 5).
 *
 * É por isso que esta trava confere as DUAS pontas. Um `- ⬜` escrito aqui
 * dentro ressuscita o item; e um gatilho que passe a imprimir `- ⏸️` também —
 * e esse segundo não deixaria rastro nenhum no `BACKLOG.md`.
 */

const RAIZ = join(import.meta.dirname, '../..');
const BACKLOG = readFileSync(join(RAIZ, 'BACKLOG.md'), 'utf8');
const GATILHO = readFileSync(join(RAIZ, 'scripts/inicio-de-sessao.sh'), 'utf8');

const TITULO = '## ⏸️ `[09/10]` DESATIVADO';

/** O trecho entre o título do bloco e o próximo `## `. */
function blocoDesativado() {
  const i = BACKLOG.indexOf(TITULO);
  if (i === -1) return null;
  const resto = BACKLOG.slice(i + TITULO.length);
  const fim = resto.search(/^## /m);
  return fim === -1 ? resto : resto.slice(0, fim);
}

describe('o bloco de itens desativados não ressuscita sozinho', () => {
  it('o bloco existe, e não está vazio', () => {
    const bloco = blocoDesativado();
    expect(
      bloco,
      'o bloco DESATIVADO sumiu do `BACKLOG.md`.\n'
      + 'Sem ele, item parado por custo volta para a fila — e volta marcado,\n'
      + 'porque é exatamente o que o gatilho de sessão imprime primeiro.',
    ).not.toBeNull();

    const itens = (bloco.match(/^- ⏸️/gm) ?? []).length;
    expect(
      itens,
      'o bloco DESATIVADO ficou sem nenhum item.\n'
      + 'Bloco vazio não falha nunca e continua parecendo que alguém o mantém\n'
      + '— se os itens voltaram a ser fila, isso tem de ser uma decisão escrita.',
    ).toBeGreaterThan(0);
  });

  it('nenhum item aqui dentro usa `- ⬜`', () => {
    const bloco = blocoDesativado();
    const intrusos = (bloco.match(/^- ⬜.*/gm) ?? []);

    expect(
      intrusos,
      `${intrusos.length} item(ns) do bloco DESATIVADO voltaram a ser \`- ⬜\`:\n`
      + intrusos.map((l) => `  ${l.slice(0, 90)}`).join('\n')
      + '\n\nEssa marca é o que o contador soma e o que o gatilho de sessão\n'
      + 'imprime. Um item desativado escrito assim volta a aparecer como\n'
      + 'prioridade da sessão, e eu volto a oferecê-lo como se desse para fazer.',
    ).toEqual([]);
  });

  it('o gatilho de sessão continua lendo `- ⬜`, e SÓ ele', () => {
    // A outra ponta, e a que não deixa rastro no BACKLOG: se o gatilho passar a
    // imprimir `- ⏸️`, o bloco continua perfeito e os itens voltam assim mesmo.
    expect(
      /grep -E '\^- ⬜\.\*\(🔴\|🟠\)' BACKLOG\.md/.test(GATILHO),
      'o gatilho de sessão deixou de filtrar por `^- ⬜`.\n'
      + 'Ele é metade do mecanismo: a marca `- ⏸️` só desativa um item porque\n'
      + 'este grep não a enxerga.',
    ).toBe(true);

    expect(
      /⏸️/.test(GATILHO),
      'o gatilho de sessão passou a conhecer a marca `- ⏸️`.\n'
      + 'Item desativado volta a ser impresso como prioridade da sessão — e\n'
      + 'desta vez sem nada no `BACKLOG.md` para denunciar.',
    ).toBe(false);
  });

  it('todo item desativado está sob um motivo declarado', () => {
    const bloco = blocoDesativado();
    const secoes = (bloco.match(/^### .*/gm) ?? []);

    expect(
      secoes.length,
      'o bloco DESATIVADO perdeu as subseções de motivo.\n'
      + '"Desativado" sem motivo é indistinguível de esquecido: daqui a três\n'
      + 'meses ninguém sabe se foi custo, prioridade ou desistência.',
    ).toBeGreaterThan(0);

    // Nenhum item pode vir ANTES da primeira subseção: ali ele ficaria sem
    // motivo nenhum, e é a posição em que um item colado às pressas cai.
    const antesDaPrimeira = bloco.slice(0, bloco.indexOf(secoes[0]));
    expect(
      (antesDaPrimeira.match(/^- ⏸️/gm) ?? []).length,
      'há item desativado ANTES da primeira subseção de motivo.\n'
      + 'É onde cai o item colado às pressas — e ele fica sem dizer por que\n'
      + 'está parado, que é a única informação que torna o bloco reabrível.',
    ).toBe(0);
  });
});
