/**
 * As PORTAS esperadas do banco — o que o anônimo não pode e o que ele pode.
 *
 * `[10/10]` Separadas do roteiro no corte de `portas-do-banco.mjs` (611 linhas,
 * o maior do projeto, contra o teto de 300 do §4). O corte é por
 * responsabilidade: aqui está a EXPECTATIVA (quais portas, e por quê) e lá
 * ficou a VERIFICAÇÃO (bater na REST API com a chave anônima e comparar).
 *
 * **As duas direções importam, e é por isso que `ABERTAS` existe.** Porta que
 * abriu é brecha; porta que FECHOU já derrubou o site três vezes — revogar
 * colunas de `profiles` parou post, comentário, mural e chat. Um portão que só
 * olhasse um lado seria metade de um portão.
 */
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
  // `[18/09]` SEC-028. Não é tabela, é VIEW — e por isso ela é mais perigosa,
  // não menos: view roda com os direitos do DONO (`security_invoker` é falso
  // por padrão), então ela ATRAVESSA a RLS. Exposta na REST API, entregaria o
  // XP e a contagem de posts/likes/comentários de todo mundo numa chamada só,
  // sem login. Quem lê a view são as três RPCs `SECURITY DEFINER`.
  ['xp_dos_usuarios', 'o XP e a atividade de todos os perfis, de uma vez'],
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

export { FECHADAS, ABERTAS, ALVO, RPCS_FECHADAS };
