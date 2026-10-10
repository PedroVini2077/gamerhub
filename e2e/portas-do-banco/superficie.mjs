/**
 * A SUPERFÍCIE que o anônimo alcança, coluna por coluna.
 *
 * `[10/10]` Separada do roteiro no mesmo corte de 611 linhas. Ela é dado — a
 * lista do que está exposto e o motivo de cada item — e o roteiro é quem
 * compara.
 *
 * O comentário abaixo explica por que ela trava a PIORA e não o estado atual.
 * Ele fica aqui porque é a justificativa da lista, não da verificação.
 */
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

export { SUPERFICIE_ANONIMA };
