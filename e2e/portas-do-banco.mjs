/**
 * GATILHO DO BANCO — o que um estranho consegue fazer no Postgres.
 *
 * ── Por que este arquivo existe ─────────────────────────────────────────────
 *
 * Auditoria de 01/09: **nenhum job do CI tocava o banco**. O
 * `portas-fechadas.mjs` bate nas Edge Functions; o resto olha `src/` e a
 * documentação. O Postgres — onde a segurança de verdade mora, porque o site
 * usa a `anon key` e qualquer um chama a REST API direto — era a única camada
 * sem verificação automática nenhuma.
 *
 * Pior: mudança de banco é feita por MCP e **não deixa rastro no repositório**
 * (`CLAUDE.md` §5). Um `GRANT` a mais some junto com a conversa. Nenhum
 * portão que leia arquivos jamais veria isso.
 *
 * ── As DUAS direções, e a segunda é a que já derrubou o site ────────────────
 *
 * 1. **O que é fechado continua fechado.** Tabela sensível e RPC privilegiada
 *    recusam o anônimo.
 *
 * 2. **O que é aberto continua aberto.** Esta é a que falta em todo lugar. Em
 *    `docs/regras/POSTURA.md` estão registradas TRÊS quedas do site causadas
 *    por correção de segurança legítima: revogar colunas de `profiles` parou
 *    post, comentário, mural e chat; apagar policies de storage parou o upload
 *    de foto. Nos três casos o site quebrou **em silêncio**, e ninguém tinha
 *    como saber antes de um humano clicar.
 *
 * Um portão que só conferisse a direção 1 aprovaria com prazer o revoke que
 * derruba o site inteiro.
 *
 * ── O que ele NÃO cobre, e é honesto dizer ──────────────────────────────────
 *
 * Ele é caixa-preta e roda com a `anon key`. Não enxerga policy, não enxerga
 * `search_path` de `SECURITY DEFINER`, não enxerga o que um usuário LOGADO
 * consegue fazer. Ele responde uma pergunta só, e responde bem: **o que um
 * estranho sem conta alcança?** As outras camadas continuam sendo trabalho de
 * auditoria (§6), não deste script.
 *
 * Uso:  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node e2e/portas-do-banco.mjs
 */

const URL_BASE = process.env.VITE_SUPABASE_URL;
const CHAVE = process.env.VITE_SUPABASE_ANON_KEY;

if (!URL_BASE || !CHAVE) {
  console.error('\n  VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao obrigatorios.');
  console.error('  Sem eles o teste passaria sem ter testado nada — e teste que');
  console.error('  passa sem testar e pior do que teste nenhum (§1.5).\n');
  process.exit(2);   // 2 = ambiente errado, != 1 = site com problema
}

const cabecalhos = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` };

/**
 * FECHADAS — o anônimo não pode ler linha nenhuma.
 *
 * Duas respostas são aceitas, e elas vêm de mecanismos diferentes:
 *   401  -> privilégio revogado no nível do papel (o `GRANT` não existe)
 *   200 com zero linhas -> a RLS filtrou tudo
 *
 * A primeira é mais forte. A segunda basta, mas depende da policy continuar
 * certa — por isso o teste reporta qual das duas está valendo, e uma queda de
 * 401 para 200 aparece no log mesmo sem reprovar.
 */
const FECHADAS = [
  ['admin_logs', 'a trilha de auditoria inteira: quem baniu quem, e por quê'],
  ['moderation_queue', 'todo conteúdo denunciado, com o texto original'],
  ['profiles', 'e-mail, cargo, estado de ban e suspensão de todo mundo'],
  ['posts', 'inclusive os ocultados pela moderação e os excluídos'],
  ['login_attempts', 'quais e-mails existem e quem está sob ataque'],
  ['unban_requests', 'o texto do recurso de quem foi banido'],
];

/**
 * ABERTAS DE PROPÓSITO — e que precisam CONTINUAR abertas.
 *
 * O site lê estas duas antes de qualquer login. Revogar uma delas não dá erro
 * visível: a landing simplesmente para de funcionar direito, em silêncio.
 */
const ABERTAS = [
  ['site_config', 'a landing lê o modo manutenção e os feature gates daqui; '
    + 'sem isto o site não sabe se deve se mostrar'],
  ['blocked_words', 'o filtro de palavrão do cliente carrega a lista daqui '
    + '(`useBlockedWords`); sem ela o filtro passa a aprovar tudo em silêncio'],
];

/**
 * RPCs que o anônimo não pode executar.
 *
 * 404 e 401 são as duas recusas legítimas, e a diferença importa:
 *   404 -> `REVOKE ... FROM PUBLIC, anon`: o PostgREST nem lista a função
 *   401 -> a função é visível, mas o `EXECUTE` foi negado
 * Qualquer 2xx aqui é escalada de privilégio.
 */
const RPCS_FECHADAS = [
  ['ban_user', 'banir qualquer usuário'],
  ['unban_user', 'desbanir quem a equipe baniu'],
  ['owner_set_role', 'se promover a fundador'],
  ['apply_suspension', 'silenciar qualquer usuário'],
  ['lift_suspension', 'tirar a suspensão de quem a equipe puniu'],
  ['soft_delete_post', 'apagar post alheio'],
  ['admin_list_users', 'listar todos os usuários com dado pessoal'],
  ['log_audit_event', 'forjar linha na trilha de auditoria'],
];

const falhas = [];
const ok = (m) => console.log(`  OK      ${m}`);
const falhou = (m, detalhe) => { console.log(`  FALHOU  ${m}`); falhas.push(detalhe); };

async function pegar(caminho, opcoes = {}) {
  const r = await fetch(`${URL_BASE}${caminho}`, {
    headers: { ...cabecalhos, ...(opcoes.headers ?? {}) },
    method: opcoes.method ?? 'GET',
    body: opcoes.body,
    signal: AbortSignal.timeout(15000),
  });
  let corpo = null;
  try { corpo = await r.json(); } catch { /* 204, ou corpo não-JSON */ }
  return { status: r.status, corpo };
}

console.log('\n  Portas do banco — o que um estranho sem conta alcança\n');

// ── 1. Tabelas que precisam recusar ────────────────────────────────────────
for (const [tabela, estrago] of FECHADAS) {
  const { status, corpo } = await pegar(`/rest/v1/${tabela}?select=*&limit=1`);
  const linhas = Array.isArray(corpo) ? corpo.length : null;

  if (status === 401 || status === 403) {
    ok(`${tabela.padEnd(18)} recusa no privilégio (HTTP ${status})`);
  } else if (status === 200 && linhas === 0) {
    ok(`${tabela.padEnd(18)} a RLS filtra tudo (HTTP 200, 0 linhas)`);
  } else {
    falhou(`${tabela.padEnd(18)} LEITURA ABERTA (HTTP ${status}, ${linhas} linha(s))`,
      `LEITURA ABERTA em \`${tabela}\` para quem NAO TEM CONTA.\n`
      + `    O que isso entrega: ${estrago}.\n`
      + '    Conferir o GRANT do papel `anon` e a policy de SELECT da tabela.');
  }
}

// ── 2. Tabelas que precisam CONTINUAR abertas ──────────────────────────────
for (const [tabela, porque] of ABERTAS) {
  const { status, corpo } = await pegar(`/rest/v1/${tabela}?select=*&limit=1`);
  const linhas = Array.isArray(corpo) ? corpo.length : null;

  if (status === 200 && linhas > 0) {
    ok(`${tabela.padEnd(18)} continua legível pelo visitante`);
  } else {
    falhou(`${tabela.padEnd(18)} FECHOU (HTTP ${status}, ${linhas} linha(s))`,
      `\`${tabela}\` PAROU de ser legível pelo visitante.\n`
      + `    Por que ela precisa estar aberta: ${porque}.\n`
      + '    Isto quase certamente foi um revoke bem-intencionado. Em\n'
      + '    docs/regras/POSTURA.md estao TRES quedas do site pela mesma causa —\n'
      + '    correcao de seguranca legitima que derrubou funcionalidade EM SILENCIO.\n'
      + '    Antes de revogar, procure quem le (a consulta esta naquele arquivo).');
  }
}

// ── 3. RPCs privilegiadas ──────────────────────────────────────────────────
for (const [funcao, estrago] of RPCS_FECHADAS) {
  const { status } = await pegar(`/rest/v1/rpc/${funcao}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  if (status === 404) {
    ok(`rpc ${funcao.padEnd(20)} revogada (nem aparece)`);
  } else if (status === 401 || status === 403) {
    ok(`rpc ${funcao.padEnd(20)} execução negada (HTTP ${status})`);
  } else {
    falhou(`rpc ${funcao.padEnd(20)} ACEITOU CHAMADA ANÔNIMA (HTTP ${status})`,
      `\`${funcao}\` respondeu ${status} a uma chamada SEM CONTA.\n`
      + `    O que isso permitiria: ${estrago}.\n`
      + '    Mesmo que a funcao cheque `auth.uid()` por dentro, ela nao devia\n'
      + '    ser CHAMAVEL: `REVOKE ... FROM PUBLIC, anon` e a primeira porta,\n'
      + '    e a checagem interna e a segunda (CLAUDE.md §5).');
  }
}

// ── 4. A porta que estava ENTREABERTA, e o teste não via ───────────────────
//
// Em 02/09 a sondagem manual desmentiu o verde deste próprio arquivo. O bloco
// 1 acima pergunta `select=*`, e `profiles` responde 401 a isso — então a linha
// dava OK e o SEGURANCA.md passou a afirmar que "profiles responde 401 ao
// anônimo". A afirmação é falsa por coluna:
//
//     GET /rest/v1/profiles?select=*            -> 401
//     GET /rest/v1/profiles?select=id,username  -> 200, as 5 linhas
//
// Privilégio no Postgres é POR COLUNA. Um `select=*` negado prova só que
// ALGUMA coluna está fechada — nunca que a tabela está.
//
// Por que isto NÃO reprova hoje: a exposição de `id`+`username` é item 🟡 em
// aberto no BACKLOG.md, esperando decisão do dono sobre o revoke (revoke de
// coluna já derrubou este site três vezes). Portão vermelho por item conhecido
// e não decidido bloquearia todo PR e viraria ruído (§0.2, 4ª regra).
//
// O que ele trava é a PIORA: a superfície é exatamente estas duas colunas, e
// qualquer coluna a mais reprova.
const SUPERFICIE_ANONIMA = {
  profiles: {
    // `[03/09]` `id` e `username` saíram de `pode` e entraram aqui: o item 🟡
    // foi fechado. O que os mantinha abertos era a checagem de username
    // duplicado no cadastro, que virou a RPC `username_disponivel` — ela
    // responde a mesma pergunta sem devolver a lista de perfis.
    pode: [],
    naoPode: ['id', 'username', 'avatar_url', 'role', 'banned', 'banned_at',
      'suspended_until', 'birth_date', 'bio', 'created_at'],
    estrago: 'a lista de todos os usuarios, com o UUID e o nome de cada um — o '
      + 'que liga site_config.updated_by a uma pessoa',
  },
};

for (const [tabela, { pode, naoPode, estrago }] of Object.entries(SUPERFICIE_ANONIMA)) {
  for (const coluna of naoPode) {
    const { status } = await pegar(`/rest/v1/${tabela}?select=${coluna}&limit=1`);
    if (status === 401 || status === 403) {
      ok(`${tabela}.${coluna.padEnd(18)} continua negada (HTTP ${status})`);
    } else {
      falhou(`${tabela}.${coluna.padEnd(18)} ABRIU PARA O ANÔNIMO (HTTP ${status})`,
        `A coluna \`${tabela}.${coluna}\` passou a ser legível SEM CONTA.\n`
        + `    O que a tabela entrega quando isso acontece: ${estrago}.\n`
        + '    Um `select=*` negado NAO prova tabela fechada — o privilegio do\n'
        + '    Postgres e por COLUNA, e foi exatamente assim que a exposicao de\n'
        + '    id+username passou meses invisivel para este portao.\n'
        + '    Conferir: GRANT SELECT (coluna) ON profiles TO anon.');
    }
  }

  // A inversa. Sem ela, um revoke amplo fecharia as duas colunas e o teste
  // ficaria VERDE — que é a queda silenciosa descrita no bloco ABERTAS.
  for (const coluna of pode) {
    const { status } = await pegar(`/rest/v1/${tabela}?select=${coluna}&limit=1`);
    if (status === 200) {
      ok(`${tabela}.${coluna.padEnd(18)} legível (estado conhecido, item 🟡)`);
    } else {
      falhou(`${tabela}.${coluna.padEnd(18)} FECHOU (HTTP ${status})`,
        `\`${tabela}.${coluna}\` deixou de ser legivel pelo anonimo.\n`
        + '    Isso pode ser BOM — e o revoke do item 🟡 do BACKLOG.md. Se foi\n'
        + '    proposital, tire a coluna de `pode` aqui e feche o item.\n'
        + '    Se NAO foi, um revoke amplo pegou junto o que nao devia: veja as\n'
        + '    tres quedas do site por essa causa em docs/regras/POSTURA.md.');
    }
  }
}

// ── Veredicto ──────────────────────────────────────────────────────────────
if (falhas.length > 0) {
  console.error(`\n  ${falhas.length} porta(s) do banco fora do lugar:\n`);
  falhas.forEach(f => console.error(`  ─ ${f}\n`));
  process.exit(1);
}
const colunas = Object.values(SUPERFICIE_ANONIMA)
  .reduce((n, s) => n + s.pode.length + s.naoPode.length, 0);
console.log(`\n  ${FECHADAS.length + ABERTAS.length + RPCS_FECHADAS.length + colunas}/`
  + `${FECHADAS.length + ABERTAS.length + RPCS_FECHADAS.length + colunas} portas do banco no lugar.\n`);
