import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { classificar } from '../branches-abandonadas.mjs';

/**
 * A varredura de branches — e a armadilha que ela mesma pode virar.
 *
 * ── Por que a trava não é sobre "estar atrás" ───────────────────────────────
 *
 * `[11/09]` O pedido do dono foi *"eu vivo vendo os bots e as outras branch's
 * desatualizadas"*. Medido: 9 branches do Dependabot, até 119 commits atrás —
 * e só **2 PRs abertos**. Sete eram restos de PR já fechado.
 *
 * "Atrás da main" sozinho não separa nada: toda branch fica atrás no instante
 * em que alguém mergeia outra coisa. O critério que decide é **existe PR
 * aberto para ela?**.
 *
 * ── O risco que ESTE script cria, e que a trava fecha ───────────────────────
 *
 * Ele sugere apagar branch. Se a branch de trabalho combinada no `CLAUDE.md`
 * §8 sair da lista de protegidas — por renomeação, por exemplo —, o relatório
 * passaria a sugerir apagar justamente onde o trabalho vive.
 *
 * Isso é pior do que o problema original: o entulho é chato, apagar a branch
 * ativa é perda.
 */
describe('varredura de branches abandonadas', () => {
  it('separa órfã de quem tem PR aberto', () => {
    const { orfas, emFila } = classificar(
      ['dependabot/a', 'dependabot/b', 'claude/trabalho'],
      ['dependabot/b'],
      ['claude/trabalho'],
    );
    expect(orfas).toEqual(['dependabot/a']);
    expect(emFila).toEqual(['dependabot/b']);
  });

  it('nunca sugere apagar a `main`', () => {
    const { orfas } = classificar(['main', 'qualquer'], []);
    expect(
      orfas,
      'A `main` entrou na lista de branches a apagar. Ela precisa estar em '
      + 'PROTEGIDAS, em scripts/branches-abandonadas.mjs.',
    ).toEqual(['qualquer']);
  });

  it('a branch de trabalho do CLAUDE.md §8 está protegida', () => {
    // Lida do CLAUDE.md, e não escrita aqui: duas cópias do mesmo nome
    // divergiriam no dia em que a branch mudar (§4, fonte única).
    const claude = readFileSync('CLAUDE.md', 'utf8');
    const nome = claude.match(/`(claude\/[a-zA-Z0-9/_-]+)`/)?.[1];
    expect(nome, 'não achei a branch de trabalho citada no CLAUDE.md §8').toBeTruthy();

    const { orfas } = classificar([nome], []);
    expect(
      orfas,
      `A branch de trabalho (${nome}) seria sugerida para apagar. Entre um merge `
      + 'e o `--force-with-lease` que a realinha, ela fica atrás da main e SEM '
      + 'PR aberto — exatamente a assinatura de uma órfã. Acrescente o nome em '
      + 'PROTEGIDAS, em scripts/branches-abandonadas.mjs.',
    ).toEqual([]);
  });
});
