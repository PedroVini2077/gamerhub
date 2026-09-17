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
 * O site lê estas ANTES de qualquer login. Revogar uma delas não dá erro
 * visível: a landing simplesmente para de funcionar direito, em silêncio.
 *
 * ── `[10/09]` Este portão acusou, e a acusação estava DESATUALIZADA ─────────
 *
 * Ele reprovou o PR dizendo que `site_config` e `blocked_words` tinham
 * "FECHADO". Investigado antes de mexer em qualquer linha, porque a regra é que
 * portão que grita costuma estar certo — e aqui ele não estava:
 *
 * | O que ele sondava | O que o site faz de verdade |
 * | --- | --- |
 * | `site_config?select=*` → **401** | `select('value')` e `select('key, value')` → **200** |
 *
 * A causa é a mesma pegadinha que já custou tempo nesta base: **privilégio no
 * Postgres é por COLUNA**, e `select=*` falha inteiro se UMA coluna for negada.
 * O SEC-005 negou só `updated_by`. Provado com a requisição real do anônimo:
 * as três consultas que a landing faz devolvem 200 com dado.
 *
 * **A sonda passou a pedir as COLUNAS QUE O SITE LÊ.** É mais estrita, não
 * menos: se amanhã alguém revogar `value`, isto reprova — e o `select=*`
 * reprovaria por uma coluna que ninguém usa.
 *
 * ── `blocked_words` SAIU desta lista, e o motivo é de escopo ────────────────
 *
 * Ela nunca foi lida por anônimo. Os quatro lugares que chamam
 * `useBlockedWords` (`MuralForm`, `CommentSection`, `useLiveChat`,
 * `usePostComposer`) e o painel de moderação vivem **todos** atrás de
 * `RequireAuth` — conferido rota a rota no `App.jsx`. O SEC-004 fechou para
 * `anon` de propósito, e `authenticated` manteve as 5 colunas.
 *
 * **O que se perde, e está dito com todas as letras:** este arquivo roda com a
 * chave anônima, então ele deixa de conseguir vigiar `blocked_words`. O risco
 * que a linha guardava — a lista sumir e o filtro passar a aprovar tudo em
 * silêncio — continua existindo do lado logado, e agora **sem portão**. Está
 * registrado no `BACKLOG.md`.
 */
const ABERTAS = [
  {
    tabela: 'site_config',
    // As colunas que o site REALMENTE lê: `FeatureGate` pede `value`,
    // `GlobalBanner` e `useConfigDoSite` pedem `key, value`.
    colunas: 'key,value',
    porque: 'a landing lê o modo manutenção e os feature gates daqui; '
      + 'sem isto o site não sabe se deve se mostrar',
  },
];

/**
 * RPCs que o anônimo não pode executar.
 *
 * 404 e 401 são as duas recusas legítimas, e a diferença importa:
 *   404 -> `REVOKE ... FROM PUBLIC, anon`: o PostgREST nem lista a função
 *   401 -> a função é visível, mas o `EXECUTE` foi negado
 * Qualquer 2xx aqui é escalada de privilégio.
 *
 * ── ⚠️ `[17/09]` O 404 DESTA LISTA É AMBÍGUO, e isso enfraquece o verde ─────
 *
 * Achado ao acrescentar as três RPCs do contador de login. Este roteiro chama
 * cada função com **corpo vazio**, e o PostgREST devolve **404 para função com
 * parâmetro obrigatório** — porque não acha a sobrecarga, não porque o
 * privilégio foi negado. Os dois 404 são indistinguíveis daqui.
 *
 * A prova, medida contra produção com a chave anônima de verdade:
 *
 *     username_disponivel  {}                        -> 404
 *     username_disponivel  {"p_username":"zzteste"}  -> 200   <- ABERTA
 *
 * `username_disponivel` é aberta **de propósito** (é a checagem de nome no
 * cadastro). Posta nesta lista por engano, ela passaria como "revogada".
 *
 * **O que isso quer dizer na prática:** para as entradas com parâmetro
 * obrigatório — que são quase todas as de cima — este roteiro hoje prova menos
 * do que o número final sugere. Se alguém der `GRANT` em `ban_user` amanhã, o
 * 404 de assinatura chega antes e o teste continua verde.
 *
 * **O que continua provado:** as três do contador foram conferidas **uma a
 * uma, com o argumento certo**, e as três responderam `401` — recusa de
 * privilégio, não de assinatura. E `reset_login_attempts` não tem parâmetro,
 * então o 404/401 dela nunca foi ambíguo.
 *
 * **Por que não consertei aqui:** a correção é mandar o argumento nomeado de
 * cada função, e isso muda o que este roteiro FAZ contra produção — passaria a
 * invocar `ban_user`, `soft_delete_post` e afins de verdade caso alguma
 * estivesse aberta. Existe caminho seguro (UUID zerado, que não casa com
 * ninguém), mas é decisão do dono e está no `BACKLOG.md` com a análise.
 * Isto NÃO é brecha — nenhuma porta abriu. É vigia cego, que é §1.5.
 */
/**
 * `[17/09]` O ALVO INEXISTENTE — por que cada chamada leva argumento agora.
 *
 * Até hoje este roteiro mandava `{}` em todas. Com corpo vazio o PostgREST
 * devolve **404 para função com parâmetro obrigatório**, porque não acha a
 * sobrecarga — e o teste contava isso como "revogada". Quase todas as entradas
 * desta lista têm parâmetro, então o "49/49" provava muito menos do que
 * parecia. Prova de que era falso:
 *
 *     username_disponivel  {}                        -> 404   (parece fechada)
 *     username_disponivel  {"p_username":"zzteste"}  -> 200   <- ABERTA
 *
 * ── Por que mandar o argumento é SEGURO, e isto foi conferido ───────────────
 *
 * A pergunta certa é: e se a porta estiver aberta? A função executa. Foi por
 * isso que eu não tinha consertado sozinho — e o dono liberou depois de eu
 * mostrar que existe caminho sem efeito colateral.
 *
 * O PostgREST resolve a assinatura, **depois** checa `EXECUTE`, e só então
 * executa. E o `ban_user` — a mais perigosa da lista — tem TRÊS barreiras
 * antes de qualquer escrita, lidas no `pg_proc`:
 *
 *   1. `EXECUTE` revogado                     -> 401 (é o que este teste mede)
 *   2. `role_rank(v_caller_role) <= 1`        -> `anon` não tem perfil, e
 *                                                `role_rank(NULL)` é 0
 *   3. `IF v_target_username IS NULL`         -> 'Usuario nao encontrado.'
 *
 * O `ALVO` abaixo é o UUID zerado, que **não corresponde a ninguém**. Mesmo que
 * as duas primeiras barreiras caíssem de uma vez, a terceira barra antes de
 * tocar em qualquer linha.
 *
 * ── A exceção que exige cuidado, e ela é uma só ─────────────────────────────
 *
 * `enviar_mensagem_de_contato` NÃO tem alvo: ela CRIA linha. Se a porta abrir,
 * o argumento válido vira uma mensagem de verdade no canal. Por isso o texto
 * dela se identifica: a linha que aparecer é obviamente do CI, e nesse caso ela
 * é um **alarme a mais**, não um dano — a porta ter aberto é o problema, e a
 * mensagem é o aviso.
 *
 * ── O que mudou na leitura do resultado ─────────────────────────────────────
 *
 * Com a assinatura casando, `401` passa a ser a recusa esperada (medido:
 * `check_login_status` com o argumento certo responde 401, não 404). Um `404`
 * agora significa outra coisa — a função não existe mais —, e por isso a
 * mensagem dele mudou.
 */
const ALVO = '00000000-0000-0000-0000-000000000000';

const RPCS_FECHADAS = [
  ['ban_user', 'banir qualquer usuário',
    { p_user_id: ALVO, p_reason: 'spam', p_details: 'teste de porta do CI' }],
  ['unban_user', 'desbanir quem a equipe baniu',
    { p_user_id: ALVO }],
  ['owner_set_role', 'se promover a fundador',
    { p_target_user_id: ALVO, p_new_role: 'admin' }],
  ['apply_suspension', 'silenciar qualquer usuário',
    { p_user_id: ALVO, p_days: 1 }],
  ['lift_suspension', 'tirar a suspensão de quem a equipe puniu',
    { p_user_id: ALVO }],
  ['soft_delete_post', 'apagar post alheio',
    { p_post_id: ALVO }],
  // Só parâmetro OPCIONAL: para esta, `{}` já casava a assinatura, e o
  // resultado dela nunca foi ambíguo.
  ['admin_list_users', 'listar todos os usuários com dado pessoal', {}],
  ['log_audit_event', 'forjar linha na trilha de auditoria',
    { p_action: 'teste_de_porta_do_ci', p_details: 'se esta linha existe, a porta abriu' }],
  // `[03/09]` Esta é diferente das de cima: ela não dá privilégio nenhum, e
  // por isso ficou aberta de propósito até hoje. O que ela dá é VOLUME — encher
  // o formulário de contato e fechar o canal para todo mundo pelo disjuntor de
  // 60/hora. É a porta que o captcha fecha, e o captcha só vale enquanto ela
  // estiver fechada: com ela aberta, basta um POST direto aqui para pular a
  // verificação inteira (§1.3).
  ['enviar_mensagem_de_contato', 'pular o captcha e encher o canal de contato',
    // A única da lista que CRIA linha em vez de agir sobre um alvo. O texto se
    // identifica de propósito: se ela aparecer no canal, a porta abriu.
    {
      p_nome: 'Teste automatico do CI',
      p_email: 'ci@exemplo.invalido',
      p_assunto: 'PORTA ABERTA: esta RPC aceitou chamada anonima',
      p_mensagem: 'Mensagem gerada por e2e/portas-do-banco.mjs. Se ela chegou '
        + 'ate aqui, `enviar_mensagem_de_contato` voltou a ser chamavel sem '
        + 'conta, e o captcha do formulario deixou de valer.',
    }],

  // ── `[17/09]` As três portas mortas do contador de login ─────────────────
  //
  // As três foram revogadas no mesmo dia, pelo mesmo motivo: **ninguém as
  // chama**, e a única coisa que as mantinha inofensivas era `login_attempts`
  // estar vazia — o hook que a encheria é de plano pago.
  //
  // Isso é "protecao acidental", que a POSTURA §1.3 manda tratar como sorte
  // esperando expirar. O dono foi quem cobrou: *"independente da brecha, ser
  // exploravel ou nao, podendo quebrar hoje ou nao, era pra ser fechada na
  // hora"*. Ele estava certo — eu tinha deixado a terceira como proposta.
  //
  // O QUE ESTA LINHA COBRE, E O QUE NAO COBRE — dito para ninguem confiar
  // demais no verde: este roteiro bate com a chave ANONIMA. Ele prova que
  // quem nao tem conta nao alcanca as tres. A `reset_login_attempts` estava
  // aberta a `authenticated`, e cobrir ESSE lado exigiria uma credencial de
  // usuario no CI — a mesma troca ja recusada aqui e no alerta de cota. O
  // estado de `authenticated` foi provado em ROLLBACK (6 asercoes) e conferido
  // no `pg_proc`; o que roda sozinho e a metade anonima.
  ['check_login_status', 'perguntar por qualquer e-mail sem ter conta (SEC-022)',
    { p_email: 'ci@exemplo.invalido' }],
  // A única sem parâmetro NENHUM: o resultado dela nunca foi ambíguo.
  ['reset_login_attempts', 'apagar o proprio historico de tentativas (SEC-024)', {}],
  ['contabilizar_falha_de_login', 'fabricar bloqueio sem saber a senha',
    { p_email: 'ci@exemplo.invalido' }],
];

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

  // `[10/09]` SEC-001, achado e fechado na auditoria de seguranca.
  //
  // `key_code` era legivel SEM CONTA: a policy `Public keys` e SELECT para
  // {public} com USING (true), e a coluna estava no grant de `anon`. Provado
  // assumindo o papel anon em ROLLBACK — 3 chaves reais, as de is_promo=false.
  //
  // A contradicao que definia o achado: a TELA exige login (`/keys` esta atras
  // de RequireAuth, o RightPanel so existe logado), e a POLICY nao exigia nada.
  // O filtro `!k.is_promo` acontecia no JavaScript, sobre um `select('*')` —
  // e quem chama o REST direto nao passa pelo nosso codigo (§1.3).
  //
  // CUIDADO ao "consertar" isso com REVOKE de coluna: nao funciona. Enquanto
  // existir grant no nivel de TABELA, ele cobre todas as colunas e o privilegio
  // de coluna e irrelevante. A primeira tentativa rodou SEM ERRO e nao mudou
  // nada — so o teste em ROLLBACK pegou. A correcao e derrubar o grant de
  // tabela e reconceder coluna a coluna.
  // `[10/09]` SEC-004 e SEC-005 — a superficie anonima que nao servia a ninguem.
  //
  // A wordlist inteira (322 palavras + severidade) era legivel SEM CONTA: o
  // mapa exato do que o filtro pega. Quem le de verdade e `useBlockedWords`
  // (aviso antes de publicar) e o `WordlistManager` — os dois exigem conta.
  blocked_words: {
    pode: [],
    naoPode: ['word', 'severity', 'created_by'],
    estrago: 'a wordlist inteira, com a severidade de cada palavra — o mapa de '
      + 'como contornar o filtro',
  },

  // `site_config.updated_by` estava ABERTO no backlog desde 01/09. Fechou
  // agora porque duas coisas mudaram: profiles foi revogado de anon (o UUID ja
  // nao vira nome) e nenhuma das telas publicas le essa coluna.
  //
  // `key` e `value` PRECISAM continuar abertos: FeatureGate, GlobalBanner e
  // MaintenancePage rodam para o visitante. Estao em `pode` para pegar a queda
  // silenciosa — um revoke amplo que feche a landing junto.
  site_config: {
    pode: ['key', 'value'],
    naoPode: ['updated_by'],
    estrago: 'o UUID de quem mexeu na configuracao do site',
  },

  game_keys: {
    // `[12/09]` A VITRINE FECHOU, e isto e mudanca de politica, nao regressao.
    //
    // O comentario anterior dizia "a vitrine continua publica de proposito".
    // Deixou de ser verdade: o dono definiu a regua de papeis em 12/09 —
    // *"nao quero que anon veja nada"* — e `/keys` sempre esteve atras de
    // `RequireAuth`, entao ninguem deslogado alcancava essa vitrine de qualquer
    // forma. O grant existia sem tela que o usasse.
    //
    // A trava fez exatamente o trabalho dela: acusou as cinco colunas fechando
    // e perguntou se foi proposital. Foi.
    pode: [],
    naoPode: ['key_code', 'id', 'game_title', 'platform', 'is_promo',
      'discount_percent'],
    estrago: 'as chaves de jogo de verdade, e a vitrine inteira — que agora so '
      + 'existe para quem tem conta',
  },

  // `[12/09]` As tabelas de LIVE. Elas nao estavam nesta lista, e o motivo de
  // entrarem agora e o achado SEC-011: as tres tinham policy `USING (true)` E
  // grant para `anon`. Nao vazavam porque estao VAZIAS — no dia da primeira
  // live, o chat inteiro seria legivel sem conta. Estao aqui para que a porta
  // nao reabra em silencio.
  live_chat: {
    pode: [],
    naoPode: ['id', 'message', 'user_id', 'post_id'],
    estrago: 'a conversa inteira de todas as lives, sem conta',
  },
  live_chat_timeouts: {
    pode: [],
    naoPode: ['id', 'user_id', 'created_by', 'post_id'],
    estrago: 'qual moderador silenciou quem — metadado de moderacao publico',
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
