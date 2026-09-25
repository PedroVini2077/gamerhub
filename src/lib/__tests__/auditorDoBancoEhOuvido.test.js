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
};

/**
 * `[25/09]` SEC-054 — as cinco do painel SAÍRAM da lista acima, e o motivo
 * importa: elas não foram perdoadas, elas **deixaram de ter o problema**.
 *
 * O dono decidiu trocar `role = 'owner'` por `is_owner()` nas oito (5 funções +
 * 3 policies), ciente de que um cargo futuro de rank >= 4 herdaria o painel.
 *
 * Com a troca elas mudaram de checagem — passaram a casar com a heurística do
 * SEC-043 ("é administrativa") e a não chamar `exige_operador_ativo()`. Então
 * migraram para o mapa abaixo, com o MESMO motivo de sempre.
 */
const ISENTAS_DA_GUARDA_DE_OPERADOR = {
  is_staff: 'é a própria guarda',
  is_super: 'idem',
  is_owner: 'idem',
  role_rank: 'função pura de ranqueamento',
  can_moderate_content: 'é a própria guarda, no piso de moderação',
  operador_ativo: 'é a própria guarda',
  exige_operador_ativo: 'é a própria guarda, na forma que levanta exceção',
  exige_alvo_apto: 'guarda do ALVO, não de quem chama',
  check_staff_eligibility: 'consulta de elegibilidade, não ação',
  log_audit_event: 'a trilha precisa aceitar registro de quem já foi barrado',
  confere_a_propria_senha: 'é sobre a PRÓPRIA senha — não tem alvo nem cargo',
  pode_publicar: 'guarda do usuário comum, não do operador',
  post_aceita_interacao: 'estado do POST, não de quem chama',
  owner_get_stats: 'painel do Fundador: a guarda arriscaria lockout SEM INVERSA, e ninguém consegue banir o owner pelo produto',
  owner_get_users: 'idem',
  owner_get_metrics: 'idem',
  owner_get_audit_logs: 'idem',
  owner_get_notifications: 'idem',
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

  it('a checagem de POLICY existe e NÃO tem lista de exceção', () => {
    const corpo = auditor();
    const bloco = corpo.match(/pg_policies\s+t[\s\S]*?ORDER\s+BY/i);

    expect(bloco, [
      'A 6ª checagem (SEC-053) sumiu do auditor.',
      '',
      'Foi ela que fechou o caminho por onde um admin BANIDO lia a fila de',
      'moderação, a trilha de 4.102 linhas e escrevia na wordlist.',
    ].join('\n')).toBeTruthy();

    // `[25/09]` SEC-054: a lista de isenção desta checagem foi a ZERO, porque
    // as três policies de `site_config` passaram a usar `is_owner()`. Lista
    // vazia é melhor do que lista com nome — ela não tem onde esconder achado.
    //
    // Se um nome voltar a aparecer aqui, ele precisa vir com motivo escrito na
    // migration E um mapa nesta trava, como as outras duas listas têm.
    const isencao = bloco[0].match(/policyname\s+NOT\s+IN\s*\(([\s\S]*?)\)/i);
    const nomes = isencao ? [...isencao[1].matchAll(/'([a-z0-9_]+)'/gi)].map(m => m[1]) : [];

    expect(nomes, [
      `A checagem de POLICY ganhou isenção para: ${nomes.join(', ')}`,
      '',
      'Hoje ela não tem nenhuma, e isso é deliberado: NENHUMA policy precisa',
      'escrever papel à mão. Isentar uma aqui a silencia — se for legítimo,',
      'escreva o motivo na migration e crie o mapa nesta trava, como',
      '`ISENTAS_DO_LITERAL` e `ISENTAS_DA_GUARDA_DE_OPERADOR` fazem.',
    ].join('\n')).toEqual([]);
  });

  it('a lista de isentas da GUARDA DE OPERADOR é exatamente a escrita aqui', () => {
    // `[25/09]` Esta é a MAIOR das listas de exceção do auditor e era a única
    // sem vigia — ela cresceu de 13 para 18 nomes na SEC-054 e nada teria dito.
    // A trava existe justamente para lista de exceção não engordar em silêncio;
    // deixar a maior de fora era o buraco no meio dela.
    const corpo = auditor();
    const bloco = corpo.match(
      /exige_operador_ativo\(\) \(SEC-043\)[\s\S]*?nome\s+NOT\s+IN\s*\(([\s\S]*?)\)/i);

    expect(bloco, [
      'O bloco de isenção da checagem do SEC-043 sumiu do auditor.',
      '',
      'Sem ele, a própria maquinaria da guarda (`is_staff`, `operador_ativo`…)',
      'se acusa sozinha e o portão nasce vermelho para sempre.',
    ].join('\n')).toBeTruthy();

    const naLista = [...bloco[1].matchAll(/'([a-z0-9_]+)'/gi)].map(m => m[1]).sort();
    const esperado = Object.keys(ISENTAS_DA_GUARDA_DE_OPERADOR).sort();

    expect(naLista, [
      `Na migration: ${naLista.join(', ') || '(vazia)'}`,
      `Nesta trava:  ${esperado.join(', ')}`,
      '',
      'Isentar uma função aqui diz "esta é administrativa e MESMO ASSIM não',
      'precisa perguntar se quem chama está apto". É a exceção mais forte que',
      'o auditor aceita — o nome entra TAMBÉM no mapa',
      '`ISENTAS_DA_GUARDA_DE_OPERADOR`, com o motivo ao lado.',
      '',
      'As cinco do painel do Fundador estão isentas porque guardá-las',
      'arriscaria trancá-lo fora do próprio painel SEM INVERSA — e ninguém',
      'consegue banir o owner pelo produto de qualquer forma.',
    ].join('\n')).toEqual(esperado);
  });
});
