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

  it('a contagem é DITA pelo script, e é ela que o workflow lê', () => {
    // `[17/09]` A issue #201 foi aberta com este corpo, palavra por palavra:
    //
    //     OK: nenhuma branch orfa. Toda branch tem PR aberto.
    //
    // Uma issue para avisar que está tudo certo. A causa era o workflow
    // reconstruir a contagem por padrão de texto:
    //
    //     n=$(grep -cE '^    [a-zA-Z]' /tmp/relatorio.txt)
    //
    // Quatro espaços e uma letra — que é exatamente como a seção "Com PR
    // aberto — nao sao lixo" imprime. O contador contava as branches que o
    // relatório tinha acabado de declarar LEGÍTIMAS, e o robô abria issue toda
    // semana em que houvesse um PR do dependabot aberto. Ou seja, quase sempre.
    //
    // Isto trava o CONTRATO entre os dois lados, que é onde a deriva mora: o
    // script promete a linha, e o workflow promete lê-la. Cobrir só um lado
    // deixaria o outro livre para voltar ao `grep`.
    const script = readFileSync('scripts/branches-abandonadas.mjs', 'utf8');

    // `semComentarios` NAO e zelo. A primeira versao desta trava afirmou que o
    // `grep -cE` tinha sumido do workflow, e ele falhou — porque casou o
    // `grep -cE` de dentro do COMENTARIO que eu mesmo escrevi ali explicando o
    // bug. E a SEXTA vez que este projeto e mordido por trava que le a PROSA em
    // vez do CODIGO, e a segunda hoje. Por isso o corte vem antes do regex.
    const semComentarios = (yaml) => yaml
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');

    const fluxo = semComentarios(
      readFileSync('.github/workflows/branches-abandonadas.yml', 'utf8'),
    );

    expect(
      /console\.log\(`\\nORFAS=\$\{abandonadas\.length\}`\)/.test(script),
      'O script parou de imprimir a linha `ORFAS=<n>`.\n'
      + '  Ela e o unico numero confiavel do relatorio: o workflow decide com\n'
      + '  ela se abre issue. Sem ela, ele volta a adivinhar por formato de\n'
      + '  texto — que foi o que produziu a issue #201, aberta para dizer que\n'
      + '  estava tudo bem.',
    ).toBe(true);

    expect(
      /sed -n 's\/\^ORFAS=\/\/p'/.test(fluxo),
      'O workflow parou de ler a linha `ORFAS=` do relatorio.\n'
      + '  Se ele voltar a contar linha por `grep`, volta a contar tambem as\n'
      + '  branches da secao "Com PR aberto", que NAO sao lixo — e o robo passa\n'
      + '  a abrir issue toda semana. Alarme que grita a toa ensina a ignorar o\n'
      + '  canal (§0.2, 4a regra), e o canal aqui e a mesma aba de issues por\n'
      + '  onde chega o aviso de documentacao envelhecida.',
    ).toBe(true);

    expect(
      /grep -cE/.test(fluxo),
      'O `grep -cE` voltou ao workflow. Era ele que contava as branches\n'
      + '  legitimas junto com as orfas.',
    ).toBe(false);
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
