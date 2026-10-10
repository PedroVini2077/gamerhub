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

// ── As portas esperadas moram em `portas-do-banco/portas.mjs` ─────────────
//
// `[10/10]` Separadas daqui no corte de 611 linhas — o maior arquivo do
// projeto. Elas são a EXPECTATIVA; aqui ficou a verificação.
import { FECHADAS, ABERTAS, ALVO, RPCS_FECHADAS } from './portas-do-banco/portas.mjs';
import { SUPERFICIE_ANONIMA } from './portas-do-banco/superficie.mjs';


const falhas = [];
const ok = (m) => console.log(`  OK      ${m}`);
const falhou = (m, detalhe) => { console.log(`  FALHOU  ${m}`); falhas.push(detalhe); };

/**
 * `[03/09]` Banco inalcançável não é veredito sobre porta nenhuma.
 *
 * Duas coisas eram tratadas errado aqui, e as duas apareceram no mesmo dia em
 * que o projeto foi pausado:
 *
 * 1. **O `fetch` estourando** subia como `TypeError: fetch failed` cru, com
 *    pilha de `undici` e nenhuma frase em português. Quem esbarrasse nisso teria
 *    que ler o código para descobrir que o problema não era o banco estar
 *    aberto — era não dar para perguntar.
 * 2. **HTTP 5xx** — o gateway da Supabase responde **540** com o projeto
 *    pausado. Um 540 num `select` que deveria dar 401 cairia no `else` e seria
 *    relatado como *"LEITURA ABERTA"*, que é uma acusação grave e falsa.
 *
 * Nos dois casos a saída é 2 (ambiente), não 1 (porta aberta): o CI continua
 * vermelho, porque não dá para afirmar que as portas estão fechadas sem bater
 * nelas — mas o motivo passa a ser **não verificado**, e não um alarme mentindo
 * (`CLAUDE.md` §0.2, 4ª regra).
 */
function desistir(motivo) {
  console.error(`\n  Nao consegui falar com o banco: ${motivo}`);
  console.error('  Isto NAO prova nada sobre as portas — nem que estao');
  console.error('  fechadas, nem que estao abertas. Causa mais comum: o');
  console.error('  projeto Supabase esta PAUSADO (o gateway responde 540).');
  console.error('\n  Para conferir de verdade, o projeto precisa estar ativo.\n');
  process.exit(2);
}

async function pegar(caminho, opcoes = {}) {
  let r;
  try {
    r = await fetch(`${URL_BASE}${caminho}`, {
      headers: { ...cabecalhos, ...(opcoes.headers ?? {}) },
      method: opcoes.method ?? 'GET',
      body: opcoes.body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    desistir(`${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`);
  }
  if (r.status >= 500) desistir(`HTTP ${r.status} em ${caminho}`);
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
for (const { tabela, colunas, porque } of ABERTAS) {
  // Pede as COLUNAS QUE O SITE LÊ, e não `select=*`: privilégio é por coluna,
  // e `*` reprovaria por uma coluna que ninguém usa. Ver o bloco em `ABERTAS`.
  const { status, corpo } = await pegar(`/rest/v1/${tabela}?select=${colunas}&limit=1`);
  const linhas = Array.isArray(corpo) ? corpo.length : null;

  if (status === 200 && linhas > 0) {
    ok(`${tabela.padEnd(18)} continua legível pelo visitante (${colunas})`);
  } else {
    falhou(`${tabela.padEnd(18)} FECHOU (HTTP ${status}, ${linhas} linha(s))`,
      `\`${tabela}\` PAROU de responder a \`select=${colunas}\` para o visitante.\n`
      + `    Por que ela precisa estar aberta: ${porque}.\n`
      + '    Isto quase certamente foi um revoke bem-intencionado. Em\n'
      + '    docs/regras/POSTURA.md estao TRES quedas do site pela mesma causa —\n'
      + '    correcao de seguranca legitima que derrubou funcionalidade EM SILENCIO.\n'
      + '    Antes de revogar, procure quem le (a consulta esta naquele arquivo).');
  }
}

// ── 3. RPCs privilegiadas ──────────────────────────────────────────────────
for (const [funcao, estrago, corpo] of RPCS_FECHADAS) {
  // Guarda contra a trava virar decoração de novo: entrada sem corpo voltaria a
  // mandar `{}` e a colher o 404 de assinatura, que é exatamente o defeito que
  // esta rodada corrigiu. Falhar alto é melhor do que aprovar em silêncio.
  if (!corpo) {
    falhou(`rpc ${funcao.padEnd(20)} SEM CORPO na lista`,
      `\`${funcao}\` nao tem argumentos declarados em RPCS_FECHADAS.\n`
      + '    Sem eles a chamada vai com `{}`, e funcao com parametro\n'
      + '    obrigatorio responde 404 por ASSINATURA — que este teste contaria\n'
      + '    como "revogada". Declare os argumentos, com alvo inofensivo.');
    continue;
  }

  const { status } = await pegar(`/rest/v1/rpc/${funcao}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  if (status === 401 || status === 403) {
    ok(`rpc ${funcao.padEnd(24)} execução negada (HTTP ${status})`);
  } else if (status === 404) {
    // Com a assinatura casando, 404 deixou de significar "revogada" e passou a
    // significar "nao existe". As duas são aceitáveis — o que não pode é ser
    // chamável —, mas a mensagem tem que dizer a verdade sobre qual é.
    ok(`rpc ${funcao.padEnd(24)} nao existe, ou o nome do argumento mudou (404)`);
  } else {
    falhou(`rpc ${funcao.padEnd(24)} ACEITOU CHAMADA ANÔNIMA (HTTP ${status})`,
      `\`${funcao}\` respondeu ${status} a uma chamada SEM CONTA, com os\n`
      + '    argumentos CERTOS — entao ela passou do privilegio.\n'
      + `    O que isso permitiria: ${estrago}.\n`
      + '    Mesmo que a funcao cheque `auth.uid()` por dentro, ela nao devia\n'
      + '    ser CHAMAVEL: `REVOKE ... FROM PUBLIC, anon` e a primeira porta,\n'
      + '    e a checagem interna e a segunda (CLAUDE.md §5).\n'
      + '    Um 400 aqui tambem e falha: erro de VALIDACAO so acontece depois\n'
      + '    de o EXECUTE ter passado.');
  }
}

// ── 4. A porta que estava ENTREABERTA, e o teste não via ───────────────────

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

// ── 5. O auditor do banco, ouvido pelo CI ──────────────────────────────────
//
// `[24/09]` SEC-050. A `auditoria_de_operadores()` ja existia desde a SEC-049 e
// fazia tres checagens — RPC administrativa sem a guarda do operador, funcao de
// trigger chamavel como RPC, e funcao alcancavel por `anon` fora da lista
// branca. Só que ela tinha `EXECUTE` revogado de TODO MUNDO: rodava apenas
// quando eu a chamava a mao. Auditor que depende de alguem lembrar de perguntar
// e a mesma classe do §1.5.
//
// O `contagem_de_achados_de_seguranca()` e o mensageiro dela: devolve um
// NUMERO, nunca os nomes. Abrir o auditor direto entregaria a lista das funcoes
// fracas para qualquer um na internet — um mapa de onde bater.
//
// Isto e DETECCAO, nao prevencao: funcao nova continua nascendo alcancavel pelo
// `anon`, porque fechar o `pg_default_acl` foi medido em 24/09 e **nao da** (o
// default do `supabase_admin` responde `permission denied`). O que mudou e que
// a brecha passa a reprovar o PR no mesmo dia, em vez de viver ate alguem
// perguntar.
{
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/contagem_de_achados_de_seguranca`, {
    method: 'POST', headers: { ...cabecalhos, 'Content-Type': 'application/json' }, body: '{}',
  });
  const corpo = await r.text();

  if (r.status !== 200) {
    falhou(`o auditor do banco nao respondeu (HTTP ${r.status})`,
      'A RPC `contagem_de_achados_de_seguranca` deveria ser chamavel com a\n'
      + '    anon key — e o unico jeito de o CI ouvir o auditor sem credencial\n'
      + `    de banco. Resposta: ${corpo.slice(0, 160)}\n`
      + '    Se ela foi revogada de proposito, este passo precisa sair junto,\n'
      + '    com o motivo escrito — senao o portao vira alarme falso.');
  } else if (Number(corpo) !== 0) {
    falhou(`o auditor do banco achou ${corpo} problema(s)`,
      'Um destes SEIS nasceu desde o ultimo PR:\n'
      + '      . RPC administrativa que NAO chama `exige_operador_ativo()` (SEC-043)\n'
      + '      . RPC que autoriza por LITERAL de papel (SEC-051)\n'
      + '      . funcao de TRIGGER chamavel como RPC (SEC-042)\n'
      + '      . funcao alcancavel por ANON fora da lista branca\n'
      + '      . tabela com GRANT e ZERO policies (SEC-052)\n'
      + '      . POLICY com hierarquia escrita a mao (SEC-053)\n\n'
      + '    O numero nao diz QUAIS de proposito — nomes viram mapa para quem\n'
      + '    chamar de fora. Para ver, rode pelo MCP como `postgres`:\n'
      + '      select * from auditoria_de_operadores();\n\n'
      + '    Se o achado for intencional (uma porta publica nova, por exemplo),\n'
      + '    o lugar de registrar isso e a lista branca DENTRO do auditor, com\n'
      + '    o motivo ao lado — nao aqui.');
  } else {
    ok('auditor do banco: 0 achados (6 checagens: funcao, tabela e policy)');
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
