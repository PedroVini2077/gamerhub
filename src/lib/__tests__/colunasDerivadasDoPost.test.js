import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { varrerFontes } from './varrerFontes';

/**
 * `[18/09]` SEC-027 / SEC-028 / SEC-029 — as travas do pentest de setembro.
 *
 * ── Os cinco achados que esta trava impede de voltar ───────────────────────
 *
 * Um pentest autorizado, com conta comum, encontrou que **toda** coluna de
 * `posts` era gravável pela REST API. Cinco achados saíram de um mecanismo só:
 *
 *   GH-XP-LIVE-001/002/011  `PATCH was_live=true` -> +30 XP sem live nenhuma
 *   Achado 8                `PATCH is_live=true`  -> live falsa no ar
 *   Achado 9                `live_ended_at` no passado com `is_live=true`
 *   Achado 10               `is_live` e `was_live` manipuláveis em separado
 *
 * E dois que o pentest **não** testou, porque só olhou `PATCH`:
 *
 *   `was_live` forjável no **INSERT** — o post nascia valendo os 30 XP
 *   `expires_at` gravável, e a `cleanup_expired_posts` APAGA de verdade por ela
 *
 * ── Por que a trava está aqui e não no banco ───────────────────────────────
 *
 * Mesma razão do `colunasPrivilegiadasDeProfiles.test.js`: conferir privilégio
 * real exigiria credencial de banco no CI, a troca que este projeto já recusou
 * três vezes. As migrations **são** o histórico, e o `espelho-de-migrations`
 * reprova quando a contagem diverge do banco.
 *
 * **O que ela não cobre**, dito para ninguém confiar demais: alguém desfazendo
 * isso direto no editor SQL, sem migration. O que ela cobre é o caminho
 * realista — alguém reescrever o trigger ou a view sem perceber o que caiu
 * junto, e o `get_user_xp` voltar a contar post apagado.
 *
 * ── Provada reinjetando o bug (§2) ────────────────────────────────────────
 *
 * Não basta escrever o teste. Cada bloco abaixo foi conferido tirando a linha
 * que ele protege e vendo a falha nomear o problema:
 *
 *   . removido `NEW.was_live :=` do trigger  -> falhou apontando was_live
 *   . removido `deleted_at IS NULL` da view  -> falhou apontando a contagem
 *   . devolvido `was_live:` ao postService   -> falhou apontando o arquivo
 */

const PASTA = 'supabase/migrations';

/** Comentário de SQL é PROSA, e prosa cita comando. Já me pegou 7 vezes. */
function semComentariosSQL(sql) {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function migrationsEmOrdem() {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) {
    throw new Error(`Nenhuma migration em "${PASTA}" — a pasta mudou de lugar?`);
  }
  return nomes.map(n => ({ nome: n, sql: semComentariosSQL(readFileSync(join(PASTA, n), 'utf8')) }));
}

/** O corpo da ÚLTIMA definição de uma função/view, que é a que vale hoje. */
function ultimaDefinicaoDe(alvo) {
  let corpo = null;
  for (const { sql } of migrationsEmOrdem()) {
    const re = new RegExp(
      `CREATE\\s+OR\\s+REPLACE\\s+(?:FUNCTION|VIEW)\\s+(?:public\\.)?${alvo}\\b[\\s\\S]*?(?=CREATE\\s+OR\\s+REPLACE|DROP\\s+TRIGGER|DROP\\s+POLICY|$)`,
      'gi');
    const achados = sql.match(re);
    if (achados) corpo = achados[achados.length - 1];
  }
  return corpo;
}

describe('SEC-027 — o ciclo de vida do post é DERIVADO, não declarado', () => {
  const guarda = ultimaDefinicaoDe('guard_post_privileged_cols');

  it('o trigger existe e é a fonte da proteção', () => {
    expect(guarda, [
      'A função `guard_post_privileged_cols` sumiu das migrations.',
      'Ela é a ÚNICA coisa que impede um usuário comum de escrever `was_live`,',
      '`expires_at`, `created_at` e `live_ended_at` por PATCH direto na REST API.',
      'Sem ela, os achados GH-XP-LIVE-001/002/011 e 8/9/10 do pentest reabrem.',
    ].join('\n')).toBeTruthy();
  });

  // Cada coluna com o motivo pelo qual ela NÃO pode vir do cliente. A mensagem
  // é o que alguém vai ler daqui a seis meses — ela tem que ensinar, não só
  // acusar (§2).
  const PINADAS = [
    ['was_live',      'vale +30 XP de live; declarável = XP de graça (GH-XP-LIVE-001)'],
    ['expires_at',    'a `cleanup_expired_posts` APAGA de verdade por ela — some a janela de 30 dias da moderação'],
    ['live_ended_at', 'quem grava é o `trg_set_live_ended_at`; vindo do cliente dá live "no ar" que já terminou (achado 9)'],
    ['created_at',    'data de nascimento não se escolhe'],
    ['user_id',       'trocar o dono do post transfere autoria'],
    ['hidden_at',     'é ação de MODERAÇÃO — o autor desfazendo anula a punição'],
    ['deleted_at',    'idem: o autor restauraria o que a equipe apagou'],
  ];

  it.each(PINADAS)('o trigger fixa `%s`', (coluna, porque) => {
    expect(guarda, [
      `O trigger deixou de fixar \`${coluna}\`.`,
      `Por que isso importa: ${porque}.`,
      '',
      'Acrescente `NEW.' + coluna + ' := OLD.' + coluna + ';` no ramo de UPDATE',
      'de `guard_post_privileged_cols` (ou o equivalente no ramo de INSERT).',
    ].join('\n')).toMatch(new RegExp(`NEW\\.${coluna}\\s*:=`));
  });

  it('`was_live` é MONOTÔNICO — acende com a live e não apaga sozinho', () => {
    expect(guarda, [
      'O `was_live` deixou de ser derivado de `is_live`.',
      'Ele precisa ser `OLD.was_live OR NEW.is_live`: uma vez que a live',
      'aconteceu, ela aconteceu — e ele NUNCA pode acender sozinho, que era',
      'exatamente o ataque do pentest (PATCH was_live=true sem live).',
    ].join('\n')).toMatch(/NEW\.was_live\s*:=\s*OLD\.was_live\s+OR/i);
  });

  it('o trigger cobre INSERT, não só UPDATE', () => {
    const sqlTodo = migrationsEmOrdem().map(m => m.sql).join('\n');
    const criacoes = sqlTodo.match(/CREATE\s+TRIGGER\s+trg_guard_post_privileged[\s\S]*?;/gi) || [];
    const ultima = criacoes[criacoes.length - 1] || '';
    expect(ultima, [
      'O `trg_guard_post_privileged` voltou a ser só `BEFORE UPDATE`.',
      '',
      'Era assim que ele estava quando o pentest rodou, e por isso o INSERT',
      'ficou aberto: o `createPost` manda o corpo inteiro, então bastava um',
      'POST direto na REST API com `was_live: true` para nascer com +30 XP.',
      'Testar só o PATCH deixa METADE do buraco aberto.',
      '',
      'Ele precisa ser `BEFORE INSERT OR UPDATE`.',
    ].join('\n')).toMatch(/BEFORE\s+INSERT\s+OR\s+UPDATE/i);
  });
});

describe('SEC-028 — o XP conta só o que existe', () => {
  const view = ultimaDefinicaoDe('xp_dos_usuarios');

  it('a view existe e é a fonte única do XP', () => {
    expect(view, [
      'A view `xp_dos_usuarios` sumiu das migrations.',
      'Ela existe para que `get_user_xp`, `owner_get_users` e `owner_get_metrics`',
      'parem de calcular XP cada uma por conta — o achado 12 do pentest.',
    ].join('\n')).toBeTruthy();
  });

  it('não conta post apagado nem oculto', () => {
    expect(view, [
      'A view voltou a contar post apagado ou oculto.',
      '',
      'Isso reabre QUATRO achados de uma vez (XP-001, XP-002, XP-LIVE-003, 7):',
      'apagar o próprio post não devolvia os 20 XP, e — o pior — comentário',
      'OCULTADO PELA MODERAÇÃO continuava pagando. Ocultar virava punição sem',
      'efeito, inclusive para o XP que leva a `check_staff_eligibility`.',
      '',
      'O bloco de `posts` precisa de `deleted_at IS NULL AND hidden_at IS NULL`.',
    ].join('\n')).toMatch(/FROM\s+posts\s+WHERE\s+deleted_at\s+IS\s+NULL\s+AND\s+hidden_at\s+IS\s+NULL/i);
  });

  // O bloco de `comments` da view tem trava PRÓPRIA, em
  // `xpSegueOQueEstaNoAr.test.js`: a LIVE-040 mostrou que a regra tem DUAS
  // metades (o comentário e o post pai) e esta aqui cobria só a primeira.

  it('o bônus de perfil exige conteúdo, não só campo não-nulo', () => {
    // `IS NOT NULL` sozinho pagava por string vazia: medido em ROLLBACK,
    // escrever '' em quatro campos levou o bônus de 95 para 140, o teto.
    const usaIsNotNullSolto = /(bio|avatar_url|platform|discord|twitch|youtube)\s+IS\s+NOT\s+NULL\s+THEN/i.test(view);
    expect(usaIsNotNullSolto, [
      'O bônus de perfil voltou a testar só `IS NOT NULL`.',
      '',
      'String vazia passa nesse teste. Medido em ROLLBACK com papel',
      '`authenticated` real: escrever \'\' em discord, twitch, youtube e',
      'avatar_url levou o bônus de 95 para 140 — o teto — sem preencher nada.',
      '',
      'Use `length(trim(COALESCE(campo,\'\'))) > 0`.',
    ].join('\n')).toBe(false);
  });

  it('a view NÃO é exposta a anon nem a authenticated', () => {
    const sqlTodo = migrationsEmOrdem().map(m => m.sql).join('\n');
    const concede = /GRANT[\s\S]{0,80}?\bON\s+(?:TABLE\s+)?(?:public\.)?xp_dos_usuarios\b[\s\S]{0,60}?TO[^;]*\b(anon|authenticated)\b/i.test(sqlTodo);
    expect(concede, [
      'Alguém deu GRANT em `xp_dos_usuarios` para anon ou authenticated.',
      '',
      'A view roda com os direitos do DONO (`security_invoker` é falso por',
      'padrão), então ela ATRAVESSA a RLS: exposta na REST API, ela entrega o',
      'XP e a contagem de todo mundo de uma vez.',
      '',
      'A régua de papéis do BANCO.md é clara: o público alcança FUNÇÃO, nunca',
      'tabela ou view. Quem lê a view são as três RPCs `SECURITY DEFINER`.',
    ].join('\n')).toBe(false);
  });
});

describe('SEC-029 — não se interage com conteúdo que não existe', () => {
  const sqlTodo = migrationsEmOrdem().map(m => m.sql).join('\n');

  // As TRÊS tabelas que penduram linha em `posts.id`. O pentest só testou a
  // primeira; corrigir só ela deixaria duas iguais no ar (§1.3, varredura de
  // classe — foi assim que 14 policies ficaram sem `owner`, três vezes).
  const FILHAS = ['comments_insert', 'live_chat_insert', 'User insere proprio like'];

  it.each(FILHAS)('a policy `%s` confere se o post pai existe', (policy) => {
    const re = new RegExp(`CREATE\\s+POLICY\\s+"?${policy}"?[\\s\\S]*?;`, 'gi');
    const achados = sqlTodo.match(re) || [];
    const ultima = achados[achados.length - 1] || '';
    expect(ultima, [
      `A policy \`${policy}\` deixou de conferir o post pai.`,
      '',
      'Sem `post_aceita_interacao(post_id)` no WITH CHECK, dá para comentar,',
      'curtir ou mandar mensagem em post APAGADO ou OCULTO (GH-CONTENT-001).',
      'O conteúdo é gravado, nenhuma tela o mostra, e ele fica sem caminho de',
      'moderação — a fila mostra o pai, não o órfão.',
    ].join('\n')).toMatch(/post_aceita_interacao\s*\(\s*post_id\s*\)/i);
  });

  it('o helper tem EXECUTE para authenticated', () => {
    // Função chamada DENTRO de policy precisa de EXECUTE para o papel que a
    // dispara. Sem o grant a policy inteira falha — para TODO MUNDO. Foi a
    // lição do SEC-026.
    expect(sqlTodo, [
      'O `post_aceita_interacao` perdeu o `GRANT EXECUTE ... TO authenticated`.',
      '',
      'Função chamada DENTRO de uma policy precisa de EXECUTE para o papel que',
      'dispara a policy. Sem ele a policy não falha "para o invasor" — ela falha',
      'para todo mundo, e comentar/curtir/conversar param no site inteiro.',
    ].join('\n')).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(?:public\.)?post_aceita_interacao[^;]*authenticated/i);
  });
});

describe('SEC-030 — o NULL que furava o guard', () => {
  const fn = ultimaDefinicaoDe('record_banned_login_attempt');

  it('recusa `p_email` nulo ANTES de comparar', () => {
    expect(fn, [
      'O `record_banned_login_attempt` voltou a aceitar `p_email = NULL`.',
      '',
      'Em SQL, `email <> NULL` devolve NULL (não `true`), e `false OR NULL`',
      'devolve NULL — um `IF NULL` NÃO DISPARA. Era por aí que qualquer pessoa',
      'logada plantava linha forjada na trilha de segurança, SEM TETO (a',
      'deduplicação compara `NULL = NULL`, que nunca casa).',
      '',
      'Foi a causa dos logs em branco que o dono viu no painel: `texto || NULL`',
      'é NULL, então o `details` nascia vazio.',
      '',
      'A defesa é perguntar por NULL explicitamente, ANTES de qualquer',
      'comparação: `IF p_email IS NULL OR v_email = \'\' THEN RAISE ...`',
    ].join('\n')).toMatch(/IF\s+p_email\s+IS\s+NULL/i);
  });
});

describe('SEC-031 — autorização antes de validação de entrada', () => {
  it('`request_role_demotion` checa o cargo antes de dizer se o alvo existe', () => {
    const fn = ultimaDefinicaoDe('request_role_demotion');
    const posAutorizacao = fn.search(/role_rank\s*\(\s*v_caller_role\s*\)\s*<\s*2/i);
    const posExistencia  = fn.search(/Usuário não encontrado/i);
    expect(posAutorizacao, [
      'A checagem de cargo voltou a vir DEPOIS de "Usuário não encontrado".',
      '',
      'Nessa ordem, qualquer pessoa logada distingue uuid que existe de uuid que',
      'não existe pelas duas mensagens diferentes — um laço em cima disso',
      'enumera contas. Era um oráculo LIMPO, e o pentest não o encontrou.',
      '',
      'Autorização primeiro. Sempre.',
    ].join('\n')).toBeLessThan(posExistencia);
  });
});

describe('o cliente não declara mais coluna derivada', () => {
  it('`postService` não manda `was_live` nem `expires_at` para o banco', () => {
    const fontes = varrerFontes('src/services');
    const post = fontes.find(f => f.endsWith('postService.js'));
    expect(post, 'src/services/postService.js sumiu — o caminho mudou?').toBeTruthy();

    // Só o CÓDIGO: o arquivo explica nos comentários por que os campos saíram,
    // e citar o nome ali não pode reprovar o teste. Ler prosa como se fosse
    // código já me pegou sete vezes neste projeto.
    const codigo = readFileSync(post, 'utf8')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');

    for (const campo of ['was_live', 'expires_at']) {
      expect(codigo, [
        `O \`postService.js\` voltou a mandar \`${campo}\` no corpo.`,
        '',
        'Quem define essas colunas é o banco (SEC-027). Mandá-las daqui não muda',
        'o que o site faz — o trigger sobrescreve —, mas obriga a manter o',
        'privilégio de escrita nelas, e é esse privilégio que o pentest usou.',
      ].join('\n')).not.toMatch(new RegExp(`${campo}\\s*:`));
    }
  });
});
