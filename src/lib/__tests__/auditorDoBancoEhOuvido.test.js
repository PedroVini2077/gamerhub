import { describe, it, expect } from 'vitest';

/**
 * `[24/09]` SEC-050 — o auditor do banco só vale se alguém o ouvir, e a lista
 * branca dele só vale se ninguém puder esvaziá-la em silêncio.
 *
 * ── O que aconteceu ───────────────────────────────────────────────────────
 *
 * A `auditoria_de_operadores()` existe desde a SEC-049 e faz três checagens:
 * RPC administrativa sem `exige_operador_ativo()`, função de trigger chamável
 * como RPC, e função alcançável por `anon` fora da lista branca.
 *
 * **Ela tinha `EXECUTE` revogado de todo mundo.** Rodava só quando eu a
 * chamava à mão pelo MCP — auditor que depende de alguém lembrar de perguntar
 * é a mesma classe do §1.5: a informação existe e não chega a lugar nenhum.
 *
 * ── As duas formas de esvaziar isto, e por isso são duas asserções ────────
 *
 * 1. **Tirar o mensageiro do alcance do CI.** Sem `GRANT ... TO anon`, o
 *    portão `portas-do-banco` não consegue chamá-lo e o auditor volta a ser
 *    mudo — verde por ausência, que é o pior verde.
 * 2. **Engordar a lista branca.** A saída mais fácil diante de um achado é
 *    acrescentar o nome à lista e o portão fica verde. Isso é legítimo **às
 *    vezes** (uma porta pública nova de verdade), e é por isso que a trava não
 *    proíbe: ela exige que a mudança seja **deliberada**, batendo com a lista
 *    escrita aqui.
 *
 * ── O que ela NÃO cobre ───────────────────────────────────────────────────
 *
 * Alguém revogando o `GRANT` direto no editor SQL, sem migration. O que ela
 * cobre é o caminho realista — e é o mesmo limite de todas as travas que leem
 * migration, escrito no `docs/TRAVAS.md`.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . tirado o `GRANT ... TO anon` do mensageiro  -> falhou apontando o CI mudo
 *   . acrescentado um nome à lista branca         -> falhou nomeando o intruso
 *   . tirado `contagem_de_achados_de_seguranca`   -> falhou (o auditor se acusa)
 */

import { SQL, auditor } from './lerOAuditorDoBanco';

/**
 * As ÚNICAS portas que o `anon` pode alcançar sem o auditor reclamar.
 *
 * Cada uma tem motivo escrito, e o motivo é o que separa "lista branca" de
 * "lugar onde se escondem achados":
 */
/**
 * `[24/09]` SEC-051 — as funções isentas da checagem de LITERAL de papel.
 *
 * Autorizar com `role = 'owner'` em vez de `is_owner()` é a forma que o
 * `POSTURA.md` proíbe, e era um **ponto cego do próprio auditor**: a heurística
 * procura `role_rank|is_staff|is_super|is_owner` para decidir "isto é
 * administrativo", então quem autoriza por literal não casava com nada.
 *
 * Estas seis ficam isentas **com motivo**, e o motivo é o que impede a lista de
 * virar esconderijo:
 */
const ISENTAS_DO_LITERAL = {
  operador_ativo: 'é a própria maquinaria da guarda — compara papel por desenho',
  owner_get_stats: 'painel do Fundador: a troca por `is_owner()` muda semântica (rank >= 4 vs = owner)',
  owner_get_users: 'idem',
  owner_get_metrics: 'idem',
  owner_get_audit_logs: 'idem',
  owner_get_notifications: 'idem',
};

/**
 * `[25/09]` SEC-053 — as POLICIES isentas da checagem de hierarquia à mão.
 *
 * A 6ª checagem acusa policy que escreve `role_rank(...)` ou um papel literal
 * em vez de `is_staff()`/`is_super()`/`is_owner()`. Um admin BANIDO passava por
 * 23 delas — lia a fila, a trilha inteira e escrevia na wordlist.
 *
 * Estas três ficam de fora pela MESMA razão das cinco funções acima, e a
 * decisão é uma só: trocar `role = 'owner'` por `is_owner()` muda semântica
 * (`rank >= 4` vs `= owner`), e isso é decisão do dono, não limpeza minha.
 *
 * Não são brecha: `operador_ativo()` é sempre true para o `owner`, então aqui
 * não se perde estado de operador nenhum — ao contrário das 23.
 */
const POLICIES_ISENTAS = {
  site_config_owner_delete: "painel do Fundador: `role = 'owner'` literal, troca é decisão de semântica",
  site_config_owner_insert: 'idem',
  site_config_owner_update: 'idem',
};

const PORTAS_PUBLICAS = {
  contagem_de_migrations: 'o portão `espelho-de-migrations` a chama COM A ANON KEY',
  username_disponivel: 'a tela de cadastro roda sem conta',
  role_rank: 'função pura, sem leitura de dado, e usada dentro de policy',
  contagem_de_achados_de_seguranca: 'o mensageiro do próprio auditor — devolve número, não nome',
};

describe('SEC-050 — o auditor do banco é ouvido, e a lista branca é deliberada', () => {
  it('o mensageiro existe e o CI consegue chamá-lo', () => {
    expect(SQL, [
      'O `contagem_de_achados_de_seguranca` sumiu das migrations.',
      '',
      'Ele é o único jeito de o CI ouvir o auditor sem credencial de banco.',
      'Sem ele, a `auditoria_de_operadores` volta a rodar só quando alguém',
      'lembra de perguntar — e ninguém lembra.',
    ].join('\n')).toMatch(/FUNCTION\s+(?:public\.)?contagem_de_achados_de_seguranca/i);

    expect(SQL, [
      'O mensageiro perdeu o `GRANT ... TO anon`.',
      '',
      'O portão `e2e/portas-do-banco.mjs` o chama com a ANON KEY — é o mesmo',
      'caminho que o `contagem_de_migrations` já usa, e existe justamente para',
      'não precisar de `service_role` no CI.',
      '',
      'Sem o grant o portão recebe 401, e o auditor fica MUDO. Verde por',
      'ausência é o pior verde que existe (§6.3).',
    ].join('\n')).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.contagem_de_achados_de_seguranca\(\)\s+TO\s+anon/i);
  });

  it('o auditor continua FECHADO — ele diz nomes', () => {
    // `[24/09]` A primeira versão desta asserção procurava um REVOKE em TODAS
    // as migrations juntas — e passava mesmo com um GRANT novo, porque achava o
    // REVOKE da SEC-049. Reinjetei o bug e ela ficou verde: era decoração.
    //
    // É a fragilidade de âncora que o `docs/TRAVAS.md` descreve, cometida por
    // mim no dia seguinte a escrevê-la. O que vale é o ÚLTIMO estado, não a
    // existência de um estado bom em algum lugar do histórico.
    const movimentos = [...SQL.matchAll(
      /(GRANT|REVOKE)\s+EXECUTE\s+ON\s+FUNCTION\s+public\.auditoria_de_operadores\s*\(\)\s+(?:TO|FROM)\s+([^;]+);/gi)];

    expect(movimentos.length, [
      'Nenhum GRANT nem REVOKE de `auditoria_de_operadores` nas migrations.',
      'Sem isso esta asserção não olha nada.',
    ].join('\n')).toBeGreaterThan(0);

    const [, verbo, alvos] = movimentos[movimentos.length - 1];
    const ultimo = `${verbo.toUpperCase()} ... ${alvos.trim()}`;

    expect(/^REVOKE/.test(verbo.toUpperCase()) && /anon/i.test(alvos), [
      `O ÚLTIMO movimento de privilégio da \`auditoria_de_operadores\` é: ${ultimo}`,
      '',
      'Ela devolve os NOMES das funções fracas. Alcançável pelo `anon`, entrega',
      'para qualquer um na internet o mapa de onde bater — que é exatamente o',
      'motivo de existir um mensageiro separado que só devolve número.',
      '',
      'Se a intenção era abrir de propósito, o mensageiro deixa de fazer',
      'sentido e o desenho inteiro precisa ser repensado, não só esta linha.',
    ].join('\n')).toBe(true);
  });

  it('a lista branca do `anon` é exatamente a escrita aqui', () => {
    const corpo = auditor();
    const bloco = corpo.match(
      /has_function_privilege\('anon'[\s\S]*?proname\s+NOT\s+IN\s*\(([\s\S]*?)\)/i);

    expect(bloco, [
      'O bloco da lista branca do `anon` sumiu do auditor, ou mudou de forma.',
      'Sem ele esta trava não olha nada.',
    ].join('\n')).toBeTruthy();

    const naLista = [...bloco[1].matchAll(/'([a-z0-9_]+)'/gi)].map(m => m[1]).sort();
    const esperado = Object.keys(PORTAS_PUBLICAS).sort();

    const intrusos = naLista.filter(n => !esperado.includes(n));
    const sumidos = esperado.filter(n => !naLista.includes(n));

    expect(intrusos, [
      `Nome(s) novo(s) na lista branca do anon: ${intrusos.join(', ')}`,
      '',
      'Acrescentar um nome aqui **silencia** o auditor para aquela função. Às',
      'vezes é legítimo — uma porta pública nova de verdade. Mas então o nome',
      'entra TAMBÉM no mapa `PORTAS_PUBLICAS` desta trava, **com o motivo',
      'escrito ao lado**.',
      '',
      'Sem isso, a lista branca vira o lugar onde os achados se escondem — e o',
      'verde do portão passa a significar "ninguém olhou".',
    ].join('\n')).toEqual([]);

    expect(sumidos, [
      `Nome(s) removido(s) da lista branca: ${sumidos.join(', ')}`,
      '',
      'Se a porta deixou de ser pública, ótimo — mas tire o nome do mapa',
      '`PORTAS_PUBLICAS` desta trava no MESMO PR, senão ela passa a exigir uma',
      'exceção que não existe mais.',
      '',
      'Atenção ao `contagem_de_achados_de_seguranca`: sem ele na lista, o',
      'auditor **se acusa sozinho** e o portão nasce vermelho para sempre.',
    ].join('\n')).toEqual([]);
  });

  it('a lista de isentas do LITERAL é exatamente a escrita aqui', () => {
    const corpo = auditor();
    const bloco = corpo.match(
      /LITERAL de papel[\s\S]*?nome\s+NOT\s+IN\s*\(([\s\S]*?)\)/i);

    expect(bloco, [
      'O bloco de isenção da checagem de LITERAL sumiu do auditor.',
      '',
      'Sem ele a SEC-051 deixa de existir, e função que autoriza com',
      "`role = 'owner'` volta a ser invisível para as outras três checagens —",
      'que foi exatamente o ponto cego que a SEC-051 fechou.',
    ].join('\n')).toBeTruthy();

    const naLista = [...bloco[1].matchAll(/'([a-z0-9_]+)'/gi)].map(m => m[1]).sort();
    const esperado = Object.keys(ISENTAS_DO_LITERAL).sort();

    expect(naLista, [
      `Na migration: ${naLista.join(', ') || '(vazia)'}`,
      `Nesta trava:  ${esperado.join(', ')}`,
      '',
      'Isentar uma função aqui **silencia** o auditor para ela. Às vezes é',
      'legítimo — mas então o nome entra TAMBÉM no mapa `ISENTAS_DO_LITERAL`',
      'desta trava, **com o motivo escrito ao lado**.',
      '',
      'As cinco do painel do Fundador estão isentas por duas razões medidas:',
      'trocar o literal por `is_owner()` muda semântica, e pôr a guarda de',
      'operador arriscaria trancar o fundador FORA do próprio painel, sem',
      'inversa. As duas estão propostas no BACKLOG — não decididas.',
    ].join('\n')).toEqual(esperado);
  });

  it('a lista de POLICIES isentas é exatamente a escrita aqui', () => {
    const corpo = auditor();
    const bloco = corpo.match(
      /pg_policies\s+t[\s\S]*?policyname\s+NOT\s+IN\s*\(([\s\S]*?)\)/i);

    expect(bloco, [
      'O bloco de isenção da 6ª checagem (SEC-053) sumiu do auditor.',
      '',
      'Sem ele a checagem de POLICY com hierarquia à mão deixa de existir — e',
      'foi ela que fechou o caminho por onde um admin BANIDO lia a fila de',
      'moderação, a trilha inteira e escrevia na wordlist.',
    ].join('\n')).toBeTruthy();

    const naLista = [...bloco[1].matchAll(/'([a-z0-9_]+)'/gi)].map(m => m[1]).sort();
    const esperado = Object.keys(POLICIES_ISENTAS).sort();

    expect(naLista, [
      `Na migration: ${naLista.join(', ') || '(vazia)'}`,
      `Nesta trava:  ${esperado.join(', ')}`,
      '',
      'Isentar uma policy aqui **silencia** o auditor para ela. A lista existe',
      'porque três policies do painel do Fundador usam papel LITERAL, e trocar',
      "por `is_owner()` muda semântica — decisão do dono, proposta no BACKLOG.",
      '',
      'Qualquer nome novo aqui precisa entrar TAMBÉM no mapa `POLICIES_ISENTAS`',
      'desta trava, com o motivo ao lado. Senão a lista vira o lugar onde os',
      'achados se escondem — que é o que a SEC-050 existe para impedir.',
    ].join('\n')).toEqual(esperado);
  });
});
