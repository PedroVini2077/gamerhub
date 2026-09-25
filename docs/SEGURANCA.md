# Segurança

> O que protege o quê. O site entrega apenas a `anon key` ao navegador — então
> **toda** regra de verdade vive no banco (RLS, CHECK, trigger, ou RPC com
> checagem). Validação no cliente é conveniência, nunca proteção.

## 🔒 Segurança

- Cliente usa **anon key**; a proteção real está no **RLS** + funções
  `SECURITY DEFINER`.
- Hierarquia de cargos **imposta no banco** (não confia só na UI).
- **Guard de `profiles`** (`guard_profile_privileged_cols`): trigger que bloqueia
  qualquer UPDATE em colunas sensíveis (`role`, `banned`, etc.) feito
  diretamente pelo usuário — auto-promoção/auto-desban impossível por UPDATE
  direto na tabela.
- Funções `SECURITY DEFINER` administrativas/owner têm `EXECUTE` **revogado de
  `anon`** (defesa em profundidade): além da checagem interna por `auth.uid()`,
  usuários não autenticados sequer conseguem invocá-las via RPC. Só permanecem
  abertas a `anon` a checagem de username no cadastro (`username_disponivel`) e
  a contagem de migrations (`contagem_de_migrations`, exceção decidida em
  12/09).

  > **`[17/09]` Esta linha dizia `check_login_status` e `get_user_xp`, e as duas
  > estavam erradas.** Medido: `get_user_xp` é só de `authenticated` há tempo, e
  > `check_login_status` foi **revogada hoje** (SEC-022) — ela era porta morta
  > desde 11/09, quando a tela de login parou de chamá-la.

  > **`[28/08]` `register_login_attempt` foi removida.** Este parágrafo a
  > listava como aberta a `anon`, e conferir no banco mostrou que ela não existe
  > mais. Ela era o contador de falhas que o **frontend** chamava para reportar
  > a própria falha — duas coisas erradas nisso, as duas medidas: quem ataca não
  > usa o nosso frontend, então força bruta real nunca era contada; e, sendo
  > chamável por anônimo, bastava um script chamar com o email da vítima para
  > **fabricar alerta de segurança e marcar a conta como bloqueada sem nunca
  > saber a senha**. As duas RPCs que sobraram são leitura pura.
- Notificações geradas por triggers `SECURITY DEFINER` — INSERT direto do
  cliente removido; banidos não burlam filtros via INSERT de notification.
- RLS consolidada: políticas múltiplas permissivas unificadas; bug "banido ainda
  posta" corrigido (INSERT de posts/community_posts era OR'd — agora AND).
- **Hierarquia de moderação imposta no DELETE** (`can_moderate_content`): admin
  não apaga mais conteúdo de super_admin/owner; owner passou a moderar de fato.
  No cliente, os serviços de delete usam `count: 'exact'` e tratam 0 linhas
  como erro real (acabou o "sucesso" falso quando o RLS bloqueia).
- Bloqueio de login server-side; tela de banido em tempo real **e no próprio
  login**, substituindo o site em vez de cobri-lo (`[28/08]` — antes a sessão
  ficava viva por baixo do overlay e o feed chegava a montar atrás dele).
- `auth_rls_initplan`: `auth.uid()` envolto em `(select auth.uid())` em todas
  as políticas — evita re-avaliação por linha.
- Headers de segurança na Vercel (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, etc.).
- Trilha de auditoria de ações sensíveis.

- **Auditoria completa de 21/08/2026** (3 fases, tudo aplicado em produção —
  ver `db/2026-08-21-auditoria-seguranca.md`). Fechou 5 falhas críticas:
  XSS armazenado via link de post (`javascript:` chegava a um `href`),
  injeção de mídia em post alheio, bloqueio de conta por anônimo, censura de
  conteúdo por qualquer usuário logado e leitura da tabela de usuários
  (incluindo `birth_date` e histórico de ban) **sem login**. Advisors de
  segurança: 64 → 42 avisos, 0 erros.
### `[12/09]` A RÉGUA DE PAPÉIS — `anon` não lê o banco, e isso agora é privilégio

> Decisão do dono, e ela vale para tudo daqui pra frente: *"admin, super admin e
> owner são os que têm poderes no site e acesso às coisas. Agora user e anon não
> pode 'nada'... não quero que anon veja nada — fecha isso para o anon **e para
> qualquer caso a partir de hoje**"*.

**O estado agora:** `anon` tem `SELECT` em **uma** tabela, por **três colunas** —
`site_config (key, value, updated_at)` —, e **nenhum** privilégio de escrita em
lugar nenhum. Antes eram 26 tabelas legíveis e 26 escrevíveis.

**A exceção é única e tem motivo operacional:** `site_config` carrega o modo
manutenção. Sem ela, o site fora do ar perde a capacidade de dizer que está fora
do ar. O grant é **por coluna** de propósito — coluna nova nasce fechada.

**O que o público continua alcançando** são RPCs e Edge Functions
(`username_disponivel`, `check_login_status`, `verify-contact`): privilégio de
FUNÇÃO não é tocado por revoke de TABELA. Conferido em transação.

**Por que isto não era um vazamento, e mesmo assim foi fechado.** Medido antes:
assumindo o papel `anon`, a RLS já barrava tudo que tinha dado dentro —
`admin_logs` tem 2.561 linhas e `anon` via 0. O que foi fechado é a **distância**
entre o que a policy permite hoje e o que o privilégio permitiria amanhã. Essa
distância já tinha sido ocupada uma vez: `live_chat` tinha policy `USING (true)`
**e** grant, e só não vazava porque a tabela está **vazia** — na primeira live,
o chat inteiro seria legível sem conta.

**A trava estrutural:** `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON
TABLES/SEQUENCES FROM anon`. É ela que faz a régua valer para tabela que ainda
não existe, e não só para o retrato de hoje.

**A trava de runtime:** `e2e/portas-do-banco.mjs`, que bate na REST API com a
chave anônima de verdade e exige `HTTP 401`. Ela pega os dois sentidos — porta
que abriu **e** porta que fechou. Foi ela que acusou esta própria mudança e
perguntou se era proposital.

**O que continua em aberto:** um `GRANT ... TO anon` escrito à mão numa migration
futura passa por cima do default, e o `portas-do-banco.mjs` só enxerga as tabelas
que estão na lista dele. Está no `BACKLOG.md`.

- **URLs externas sempre saneadas** (`lib/url.js` → `safeExternalUrl`): só
  `http`/`https` viram `href`. Vale no cliente **e** no banco (`CHECK`
  constraints em `posts.embed_url`, `game_keys.promo_url`, `post_media.url`,
  `community_post_media.url`) — a anon key permite chamar a REST API direto,
  então validação só no frontend não vale nada.
- **`[05/09]` Caminho INTERNO vindo da URL também é saneado** (`lib/url.js` →
  `caminhoInternoSeguro`). Os links dos documentos legais abrem em aba nova, que
  nasce sem histórico, então a origem viaja num `?de=` para o botão "Voltar"
  saber para onde ir. Isso é entrada de usuário: sem checagem seria
  **redirecionamento aberto** — `…/termos?de=//site-falso` mostra o nosso
  domínio na barra e o "Voltar" leva para fora. Só passa caminho que comece com
  **uma** barra: `//host`, `/\host`, `/%2f%2fhost`, esquema absoluto e caractere
  de controle são recusados, e o botão cai na landing. Trava:
  `voltarNaoEhRedirecionador.test.jsx`, provada reinjetando a checagem ingênua.
- **`[10/09]` `anon` NÃO enxerga NADA de `profiles`.** Esta linha dizia que ele
  via `(id, username)`, e **deixou de ser verdade**: a checagem de username
  duplicado no cadastro virou a RPC `username_disponivel`, que responde a mesma
  pergunta sem devolver a lista de perfis, e o grant foi revogado. Conferido no
  `information_schema.column_privileges` — `anon` não aparece para `profiles`.
  O parágrafo abaixo fica como **histórico**, porque explica por que o desenho é
  por RPC e não por RLS.
- **`[10/09]` `game_keys.key_code` deixou de ser legível sem conta** (SEC-001).
  A policy `Public keys` é `SELECT` para `{public}` com `USING (true)` e a
  coluna estava no grant de `anon` — 3 chaves reais eram coletáveis por qualquer
  pessoa da internet. A vitrine (jogo, plataforma, desconto, link) continua
  pública **de propósito**; só o código saiu. Trava: `game_keys` em
  `SUPERFICIE_ANONIMA`, em `e2e/portas-do-banco.mjs`.

  > **A armadilha que quase me enganou, e ela vale para qualquer revoke daqui
  > em diante:** `REVOKE SELECT (coluna)` **não faz nada** enquanto existir
  > grant no nível de TABELA — o grant de tabela cobre todas as colunas. A
  > primeira tentativa rodou sem erro e a falha continuou aberta; só o teste em
  > `ROLLBACK` pegou. O certo é derrubar o grant de tabela e reconceder coluna a
  > coluna.
- **`[10/09]` `TRUNCATE` foi revogado de `anon` e `authenticated`** (SEC-003).
  Estava concedido em **27 de 29 tabelas**, e **RLS não se aplica a TRUNCATE** —
  provado: `anon` truncou `game_keys` de 6 para 0 linhas. Não era 🔴 porque o
  PostgREST não expõe esse verbo e o `DELETE`, que ele expõe, foi testado nas 29
  tabelas e apagou zero (a RLS segurou). Era **defesa em profundidade zero**. A
  origem não é código nosso: é o grant padrão do template do Supabase. O
  `ALTER DEFAULT PRIVILEGES` fecha para as tabelas que ainda vão nascer.
- **`[10/09]` A lixeira do painel MOSTRA o que a hierarquia não deixa apagar**
  (SEC-007). Não é brecha — as duas policies de `posts` estão certas, e é a
  combinação que engana:

  | operação | regra | tipo |
  | --- | --- | --- |
  | ver post com `deleted_at` | `role_rank(...) >= 2` | **plana** |
  | `DELETE` | `can_moderate_content(user_id)` | hierarquia **estrita** |

  O admin enxerga o post do owner na lixeira e não consegue apagá-lo — e a RLS
  recusa com **0 linhas e nenhum erro**. Sem `count: 'exact'`, o site dizia
  *"apagado permanentemente"* e gravava `admin_permanent_delete_post` em
  `admin_logs`: **exclusão que nunca aconteceu, escrita na trilha de auditoria**.
  Medido em `ROLLBACK` — a tela contava 176, o banco apagava 175. Corrigido em
  6 chamadas (a varredura de classe achou 8 `delete()` sem contagem; 4 eram o
  caso legítimo de descurtir). Trava: `apagarConfereLinhas.test.js`.

  **A hierarquia não foi contornada em momento nenhum** — o que falhou foi o
  site relatar o resultado dela.
- **`[10/09]` O período de avaliação de staff ganhou FAIXA e trava no banco**
  (SEC-008). `review_staff_nomination(p_trial_days)` e
  `decide_staff_trial(p_extend_days)` tinham piso e nenhum teto — provado em
  `ROLLBACK` com 3.650.000 dias, que promoveu a `admin` e marcou a revisão para
  **12020-01-20**.

  Importa porque o trial é o que autoriza um super admin a promover **sem o
  fundador** (`owner_set_role` exige `owner`), e o vencimento não é cobrado por
  máquina nenhuma — não há cron sobre `trial_review_date`; quem cobra é uma
  pessoa lendo o `TrialCard`. Hoje: 7 a 180 dias, extensão de 1 a 90, total de
  365 — **e** a constraint `staff_nominations_trial_max_365d`, que mantém o teto
  mesmo se a função for reescrita sem ele.

  **Verificado junto, e passou:** nenhuma função e nenhuma policy tira o
  **cargo** do JWT. A varredura por `request.jwt`/`auth.jwt()` em `pg_proc` e
  `pg_policies` achou só `notify_admin_new_live`, que lê o `sub` (identidade,
  não papel). Um rebaixamento vale na chamada seguinte, sem esperar refresh.
- **`[10/09]` Escrever em conteúdo alheio passou a respeitar a hierarquia**
  (SEC-009). 🟠 As três tabelas de conteúdo tinham `DELETE` com hierarquia
  estrita e `UPDATE` com cargo **plano**:

  | tabela | DELETE | UPDATE (antes) |
  | --- | --- | --- |
  | `posts` | `can_moderate_content(user_id)` | `... OR is_staff()` |
  | `comments` | `can_moderate_content(user_id)` | `role_rank(...) >= 2` |
  | `community_posts` | `can_moderate_content(user_id)` | `role_rank(...) >= 2` |

  Medido em `ROLLBACK`: um admin **reescreveu e ocultou** um post do fundador
  por `PATCH` direto, enquanto o `soft_delete_post` recusava o mesmo post. O
  caminho oficial barrava e o PostgREST passava.

  Hoje as seis usam `can_moderate_content`. A moderação continua alcançando quem
  está abaixo — ocultar é `UPDATE hidden_at`, então esta policy **é** o caminho
  da moderação; o que mudou foi só o alcance. Trava:
  `hierarquiaNoConteudo.test.js`.

  **Verificado no caminho e passou:** `profiles` **não** tem a mesma brecha. O
  `guard_profile_privileged_cols` reverte `role`, `banned` e `suspended_until`
  para **todo** chamador `authenticated`, sem condição de cargo — testado com um
  admin tentando rebaixar, banir e se autopromover: os três `UPDATE` responderam
  "1 linha, sem erro" e **nada mudou**.
- **`[12/09]` Comparar PAPEL com NULL não barrava nada** (SEC-016/017/018). 🟡
  Cinco funções `SECURITY DEFINER` guardavam o acesso assim:

  ```sql
  IF v_caller_role NOT IN ('super_admin','owner') THEN RAISE EXCEPTION ...
  ```

  Em SQL, `NULL NOT IN (...)` é **NULL**, e `IF NULL THEN` **não dispara**.
  Medido: `select (null::text not in ('super_admin','owner'))` devolve NULL. O
  portão ficava aberto para exatamente um chamador — **quem não tem linha em
  `profiles`**, cujo `SELECT role INTO` deixa a variável nula.

  **O que segurava era acidental, e é o motivo de isto ter virado correção e não
  nota.** Na prova em `ROLLBACK` o guard **passou** e a função seguiu adiante; o
  que a derrubou foi um `NOT NULL` em `admin_logs.admin_username` — uma coluna
  de log que não sabe que está fazendo controle de acesso, e que só alcança
  porque o `INSERT` vem depois do `UPDATE`. A segunda rede era ter 0 usuários
  sem perfil hoje, invariante de um trigger que vive fora destas funções.

  | Função | O guard | Conserto |
  | --- | --- | --- |
  | `unban_user` · `approve_unban_request` · `deny_unban_request` | `NOT IN ('super_admin','owner')` | `is_super()` |
  | `notify_owner` | `NOT IN ('admin','super_admin')` | `is_staff()` — **e isso passou a incluir o `owner`, que estava de fora** |
  | `nominate_staff` | `<> 'super_admin'` | `IS DISTINCT FROM` |

  `is_super()` é NULL-safe **por construção**: `role_rank(NULL)` é 0 (medido) e
  `0 >= 3` é false. Papel ausente passa a negar.

  **O `nominate_staff` é a exceção que explica a regra.** Trocar por
  `is_super()` ali teria deixado o `owner` **indicar** para super admin — e a
  função existe para que ele seja o *avaliador independente* dessas indicações.
  `IS DISTINCT FROM` fecha o NULL preservando o sentido literal. Nasceu junto o
  `is_owner()`, que faltava na família.

  **A irmã, no parâmetro, e aqui o `CHECK` não segura.** `p_new_role NOT IN
  (...)` também não dispara com NULL, e o `UPDATE` grava — porque constraint só
  reprova em `false` **explícito**, e `NULL = ANY(ARRAY[...])` é NULL. Medido:
  o perfil ficou com `role` nulo, `role_rank` 0, **abaixo de `user`**. A trava é
  de nível 1: `profiles.role` e `profiles.banned` viraram **`NOT NULL`**, então
  o estado ruim deixou de ser possível em vez de depender de cada função
  lembrar. Medido antes: 0 perfis afetados, em 5.

  Trava: `guardDePapelNaoAceitaNull.test.js`, que reconstrói a **última**
  definição de cada função a partir de `supabase/migrations/` (legítimo porque o
  portão `espelho-de-migrations.mjs` garante pasta = banco). Provada cinco
  vezes, reinjetando cada bug.
- **`[12/09]` `ban_user` aceitava qualquer texto como motivo** (SEC-014). 🟡 O
  `BanModal` oferece seis motivos numa lista fechada; a RPC aceitava `text`, e o
  site usa a `anon key` — a REST API é chamável direto. Esse texto vai para a
  trilha de auditoria, para a `BannedScreen` da pessoa banida e para a
  notificação de toda a equipe. Virou lista fechada no SQL, com teste de
  contrato varrendo os dois lados: motivo novo no modal e esquecido no banco faz
  o ban falhar **alto**, em vez de gravar um valor que os painéis não agrupam.

  Junto: alvo inexistente fazia `'@' || NULL || ' foi banido'` virar NULL
  inteiro, e como `admin_logs.details` é **nullable** isso **gravava** — trilha
  com uma linha `admin_ban` sem história enquanto ninguém foi banido. Faixas que
  entraram: detalhes ≤ 300 (o `maxLength` do modal, que agora vale de verdade),
  nota ≤ 500, alerta ao owner ≤ 2000, alvo tem que existir, e — no
  `unban_user` — alvo tem que estar **banido**, senão a pessoa recebia aviso de
  um castigo que nunca teve.
- **`[12/09]` `owner_set_site_config` aceitava qualquer chave** (SEC-019). 🔵 O
  `ON CONFLICT (key) DO UPDATE` **cria linha nova** quando a chave não existe, e
  é isso que tornava o erro mudo: um `maintenence_mode` digitado errado
  respondia **sucesso**, punha o toast verde, escrevia na trilha que a
  configuração mudou — e o site, que lê `maintenance_mode`, não fazia nada. Os
  três canais do §1.5 em branco, no painel que tira o site do ar.

  Hoje são **14 chaves em lista fechada**, conferidas em três lugares que batem
  sem sobra: o estado inicial do `SiteTab.jsx`, as linhas da tabela, e o SQL.
  Junto entrou faixa de 500 no valor (`banner_text` vai para a tela de todo
  mundo) e o `is_owner()` no lugar do `role = 'owner'` à mão. Trava:
  `siteConfigChavesFechadas.test.js`, provada nos dois sentidos — porque fechar
  a lista resolve uma deriva e cria outra.
- **`[12/09]` 🟠 Um ADMIN banía o FUNDADOR por um caminho lateral** (SEC-020).
  O achado mais grave da auditoria de 12/09, e o desenho dele é a lição:
  **existiam dois caminhos para banir, e a hierarquia estava escrita só num.**

  Provado em `ROLLBACK`, os dois lados na mesma transação: `ban_user` barrou
  (*"cannot ban equal or higher role"*) e **uma linha em `violations` derrubou
  o fundador** — conta banida, comentários, mural e chat apagados.

  ```sql
  INSERT INTO violations (user_id, points, reason) VALUES ('<owner>', 999, 'forjado');
  ```

  **Cada elo estava certo lendo isolado**, e é por isso que ninguém viu: a
  policy checava **quem escreve** e nunca **contra quem**; `points` tinha tipo e
  nenhuma faixa; o trigger de escalação é aritmética; e `apply_mod_auto_ban` não
  checava cargo porque "quem chama é o sistema". Fase 4 em estado puro.

  **Impacto medido:** há **0 super admins**, e `unban_user` exige `is_super()` —
  banido o fundador, não havia caminho de volta pelo site.

  Três camadas, e a ordem importa:

  | | |
  | --- | --- |
  | `CHECK (points BETWEEN 0 AND 10)` | 10 é o maior valor que o painel produz (`suspend_7d`) |
  | policy → `can_moderate_content(user_id)` | o mesmo auxiliar das seis policies de conteúdo: rank do ator estritamente maior |
  | piso de `role_rank(alvo) >= 2` na escalação automática | **vale mesmo se as outras caírem** — `service_role` ignora RLS |

  A regra de produto que passou a estar escrita: **membro da equipe só é punido
  por decisão humana com hierarquia.** E o desvio é barulhento —
  `auto_ban_barrado` / `auto_suspend_barrado` em `admin_logs`, porque sair em
  silêncio esconderia que alguém da equipe acumulou pontos de banimento.

  Trava: `punicaoRespeitaHierarquia.test.js`, que varre a **classe** (*toda
  função que escreve punição consulta `role_rank`?*) e foi provada três vezes.
- **`[17/09]` A IDA comparava cargo, a VOLTA não** (SEC-021). 🟠 Pedido direto
  do dono: *"não quero que ele tenha poderes pra me desbanir"*.

  | Função | Compara com o cargo do ALVO? |
  | --- | --- |
  | `ban_user` · `apply_suspension` · `lift_suspension` | **sim** |
  | `unban_user` · `approve_unban_request` | **não** — só `IF NOT is_super()` |

  Um `super_admin` **não conseguia banir** o `owner` e **conseguia desbanir**.

  **O que prova que era deriva e não decisão:** `lift_suspension`, a inversa da
  suspensão, **já comparava**. O padrão certo não precisou ser inventado — ele
  já existia no projeto, e só o desbanimento destoava do próprio irmão.

  `is_super()` **continua**, e não foi substituído: a comparação sozinha
  deixaria um `admin` desbanir um `user`, o que hoje ele não pode. A regra passa
  a ser as duas coisas — ser super/owner **e** estar acima do alvo.

  **A contrapartida, aceita por ele:** banido o fundador, **ninguém no site
  desfaz** — nem ele, porque conta banida não entra. A recuperação é pelo banco,
  e a receita está no [`OPERACAO.md`](OPERACAO.md), **ensaiada inteira em
  `ROLLBACK`** (o guard de colunas privilegiadas não alcança o editor de SQL,
  que roda como `postgres` — medido). Deixa de ser buraco e vira decisão
  escrita: restaurar o fundador não é delegável pela interface.

  Junto saiu uma mentira de sistema: o aviso de desbanimento dizia *"Sua conta
  voltou ao normal."* Como o dono decidiu no mesmo dia que **o ban destrói
  mesmo**, a frase era verdade sobre a conta e falsa sobre o conteúdo. Hoje ela
  diz que a conta volta **e que o conteúdo apagado não é recuperado**.

  Trava: `punicaoRespeitaHierarquia.test.js` ganhou o espelho — *quem desfaz
  punição também compara cargo?* —, provada reinjetando os dois bugs.
- **`[17/09]` Duas portas que ninguém usava mais** (SEC-022 e SEC-023),
  achadas ao fechar as 23 funções que faltavam ler.

  **`check_login_status` era oráculo de enumeração esperando a hora.** Qualquer
  pessoa **sem conta** perguntava por **qualquer e-mail** e recebia `attempts`,
  `blocked` e `blocked_until`. Inofensiva **só porque `login_attempts` está
  vazia** — e ela está vazia porque o hook que a alimentaria é de plano pago. A
  proteção não era a função: era a tabela. No dia do upgrade, vira resposta a
  *"este e-mail existe e está sob ataque?"* para quem não tem conta.

  E **ninguém chamava**: varridos `src/`, `supabase/functions/`, `e2e/` e
  `scripts/`. A tela de login parou de usá-la em 11/09 e o grant ficou seis dias
  órfão. Revogada de `anon` e `authenticated`; a função fica, guardada para o
  upgrade. Provado: `HTTP 401` pela REST API com a chave anônima, enquanto
  `username_disponivel` continua `200`.

  **O alarme de "banido tentou entrar" não tinha teto.** O guard de identidade
  está certo (só o próprio e-mail — a brecha de 28/08), mas a pessoa banida
  podia chamar quantas vezes quisesse sobre si mesma, e cada chamada notificava
  **toda a equipe**. Medido sem ninguém atacando: **9 linhas em 28 minutos**.
  Hoje a repetição dentro de 30 min atualiza a linha existente — nove tentativas
  viram **uma linha dizendo "9 vezes"**. 4ª regra do §0.2.
- *(histórico)* **`anon` só enxergava `(id, username)` de `profiles`** — o suficiente para a
  checagem de username duplicado no cadastro (`useAuth.jsx`:
  `select('id').eq('username', …)` antes do `signUp`). RLS é por linha, não por
  coluna; a restrição correta aqui é privilégio de coluna.

  > **`[02/09]` Este parágrafo estava certo, e outros dois documentos o
  > contradiziam.** O `BACKLOG.md` afirmava que *"`profiles` responde 401 ao
  > anônimo"* e a matriz de gatilhos deste mesmo arquivo repetia. Os dois
  > tinham lido um `select=*` negado — que prova só que **alguma** coluna está
  > fechada, porque privilégio no Postgres é por coluna.
  >
  > **A consequência quase foi um estrago.** Eu cheguei a propor ao dono
  > revogar `id`/`username` de `anon`, com a checagem de dependência feita
  > "corretamente" — nenhuma policy usa. Só que **quem lê não era uma policy: é
  > o cadastro**. Revogar ali quebraria a checagem de username duplicado e seria
  > a **quarta** queda do site por revoke bem-intencionado
  > ([POSTURA.md](regras/POSTURA.md) registra as três primeiras). A consulta de
  > "quem lê" daquele arquivo procura policy e função — e este caso mostra que
  > ela precisa incluir o **código do cliente**, que é o que `e2e/portas-do-banco.mjs`
  > agora vigia coluna a coluna, nas duas direções.
  >
  > **O que continua em aberto é outra coisa, e menor:** `anon` consegue
  > **enumerar** — `select=id,username` devolve as 5 linhas, quando o cadastro
  > só precisa perguntar por **um** username. Somado a `site_config.updated_by`,
  > isso liga um UUID de staff a um nome.
  >
  > **A solução certa não é revoke, é RPC** — o padrão que este projeto já usa
  > em `get_public_profile` e `admin_list_users` para exatamente este problema:
  > uma `username_disponivel(p_username)` `SECURITY DEFINER` devolvendo booleano
  > deixa revogar o `SELECT` de `anon` **sem** quebrar o cadastro. Está no
  > `BACKLOG.md` como 🟡, esperando decisão.
- **Guards de coluna privilegiada** em `profiles`
  (`guard_profile_privileged_cols`) e `posts` (`guard_post_privileged_cols`):
  usuário comum não altera `role`/`banned` nem `hidden_at`/`deleted_at`/
  `user_id`. Ambos com `search_path` fixo.

## `[23/08]` Auth Hook de email exige assinatura

A `send-email` é o *Auth Hook* do Supabase e, por construção, precisa rodar com
`verify_jwt: false` — o gateway não exige JWT de um webhook. O corpo dela não
conferia nada, e **qualquer pessoa na internet** disparava email com a marca do
GamerHub para qualquer endereço. O pior caminho não é o spam: é queimar a cota
de ~500/dia do Gmail ou fazer o Google travar a conta, e aí **ninguém mais se
cadastra nem recupera senha**.

Agora ela valida a assinatura **Standard Webhooks** que o Supabase manda
(HMAC-SHA256 sobre `${id}.${timestamp}.${corpo}`, janela de 5 minutos contra
replay, comparação em tempo constante). Sem `SEND_EMAIL_HOOK_SECRET` ela recusa
tudo — cadastro parado e barulhento é melhor que hook aberto e silencioso. Toda
recusa devolve o mesmo `401`: dizer de fora *qual* foi o motivo entregaria o
estado da configuração a quem sonda. O motivo real vai para `admin_logs`.

O `token_hash` saiu do log da função junto: ele é a credencial de uso único que
confirma a conta ou troca a senha, e estava sendo gravado em texto puro.

Relatório completo, com a prova e os três testes de verificação:
[`db/2026-08-23-send-email-aberta-para-a-internet.md`](../db/2026-08-23-send-email-aberta-para-a-internet.md).

## `[23/08]` A porta da `moderate-links` era decorativa

Ela fazia `if (!authHeader) 401` e seguia em frente — **sem nunca validar o
token**. Qualquer string em `Authorization` passava, incluindo `Bearer
lixo-qualquer`. Não dava escalada de privilégio (a RPC do fim confere de novo),
mas dava para qualquer pessoa da internet **queimar a cota do Safe Browsing**
do projeto, que é de 10 mil consultas/dia. Estourada, a checagem de link para
de funcionar para todo mundo — e em silêncio, porque a falha da API degrada de
forma graciosa por design.

Agora valida com `auth.getUser()`, como `moderate-text` e `moderate-image`.
Verificado: token inventado → 401; **a própria anon key crua → 401** (mais
estrito que o `verify_jwt` do gateway, que a aceitaria); sessão real → 200.

O caso perigoso passou a gritar junto: link malicioso **detectado** e a RPC não
ocultando devolve `status: "rpc_error"` e vai para `admin_logs`. Era a mesma
forma de falha que manteve a moderação por IA quebrada em 26 de 26 chamadas.

## `[23/08]` As outras duas Edge Functions abertas — resolvidas por remoção

Achar duas com a porta aberta obrigou a olhar as oito que existiam então (§1.3, *varredura de
classe*). Sobraram duas com `verify_jwt: false` e nenhuma checagem no corpo:

**`cleanup-expired-posts`** rodava com `service_role` e **apagava posts**. O
estrago em dados era nulo (idempotente: só fazia o que o agendamento faria de
qualquer jeito), mas cada chamada rodava duas varreduras de `DELETE` em `posts`
— dava para martelar de fora e consumir invocação de Edge Function e carga de
banco de graça, e a resposta ainda contava quantas linhas saíram.

Guardar a porta exigiria um segredo compartilhado com o `pg_cron`, que hoje
chama por `pg_net` **sem cabeçalho nenhum**. Mas o trabalho dela era SQL puro:
virou `public.cleanup_expired_posts()`, com `EXECUTE` revogado de `anon` e
`authenticated`, e o cron passou a chamar o banco direto. **A correção não foi
trancar a porta — foi não ter porta.**

**`debug-hf`** era sobra de um experimento com Hugging Face: baixava uma imagem
de teste e gastava a `HUGGINGFACE_API_KEY` a cada chamada. Nada no site a
chamava. Código morto não é só bagunça — é superfície de ataque que ninguém
revisa, porque ninguém lembra que existe.

> **Não confundir:** a `HUGGINGFACE_API_KEY` continua em uso pelo fallback de
> texto dentro da `moderate-text`. Apagar a `debug-hf` é seguro; apagar o
> **secret** tiraria a reserva do texto (ver [MODERACAO.md](MODERACAO.md)).

As duas foram neutralizadas em 23/08 (corpo devolvendo `410`, `verify_jwt`
ligado) e **apagadas de vez em 27/08** pelo dono. Verificado depois de apagar:
`POST` nas duas → **404**, e a faxina do cron seguiu rodando normalmente
(jobid 1, `succeeded`) — porque o trabalho dela já tinha virado SQL.

`e2e/portas-fechadas.mjs` continua batendo nas duas, agora exigindo **404**:
apagada é o estado mais fechado que existe, mas é um estado que alguém pode
desfazer sem querer. Um `401` ali passaria a ser **regressão**, não segurança —
significaria a função de volta, só que com o gateway ligado.

De quebra, a varredura achou uma mentira na tela: o painel do owner mandava
configurar `HUGGINGFACE_API_KEY` para a moderação por IA, que usa **OpenAI**
desde a troca de provedor. Mensagem errada custa mais tempo do dono do que
mensagem nenhuma (§1.5).

## `[03/09]` Captcha no formulário de contato — e por que o REVOKE é a parte que importa

**O buraco que ele fecha, e estava escrito no SQL desde 02/09:** os limites do
canal de contato (3 mensagens por e-mail em 24 h, disjuntor de 60/hora) impedem
a tabela de virar depósito, mas **não** impedem um robô com muitos endereços de
encher a hora e **fechar o canal para todo mundo**.

**O widget não era a parte difícil.** Enquanto `enviar_mensagem_de_contato`
tivesse `GRANT EXECUTE ... TO anon`, o captcha seria decoração: qualquer um
posta em `/rest/v1/rpc/` e pula a verificação inteira. O site entrega a anon key
por construção — regra que só existe no cliente não existe (§1.3).

Por isso a mudança de verdade é o revoke:

| Antes | Depois |
| --- | --- |
| `anon` e `authenticated` chamavam a RPC direto | só `service_role`, e a única porta é a Edge Function `verify-contact` |
| `author_id` vinha de `auth.uid()` | vem por parâmetro, derivado de um JWT que o Supabase valida — não é forjável, e a função só é executável por `service_role` |

**Antes de revogar, procurei quem lê** (POSTURA.md §1.3 — revoke
bem-intencionado já derrubou este site três vezes): `grep` no `src/` (só o
`contatoService.js`), `pg_policies`, `pg_proc` e triggers. Nenhum outro
dependente. Testado em `ROLLBACK` antes de aplicar: `anon` bloqueado,
`authenticated` bloqueado, `service_role` passa, `author_id` chega, as
validações de conteúdo continuam valendo, e não sobrou overload da versão antiga.

**Provado em produção, com a anon key real:**

    POST /rest/v1/rpc/enviar_mensagem_de_contato
      -> HTTP 401 "permission denied for function enviar_mensagem_de_contato"
    POST /functions/v1/verify-contact  (token de captcha inventado)
      -> HTTP 403 "Nao foi possivel confirmar o captcha"

> O 403 do segundo é o que prova que a `TURNSTILE_SECRET_KEY` está configurada
> **e** sendo usada: sem ela a função seguiria adiante (ver a decisão de falhar
> aberto, abaixo) e o erro teria sido 400, vindo da RPC.

**Falhar aberto, e o quanto isso é estreito.** Se o Cloudflare estiver fora do
ar, a mensagem passa e a falha vai para `admin_logs`. O `/contato` é o canal de
quem está banido ou trancado para fora; barrar todo mundo por uma
indisponibilidade de terceiro cortaria justamente quem mais precisa. Token que o
Cloudflare **recusa** continua recusado, ninguém de fora provoca a queda do
Cloudflare, e os limites do banco continuam por baixo.

**O que o captcha NÃO faz:** ele para robô comum. Não para quem paga serviço de
resolução, nem alguém determinado especificamente contra este site. O disjuntor
de 60/hora continua existindo por isso — defesa em profundidade, não
substituição.

## `[27/08]` Onde está o rate limit — e onde ele não está

Levantado ao conferir o projeto contra uma lista de camadas de engenharia.
**Medido, não deduzido.**

> **Esta tabela é o levantamento de 27–28/08, não o estado de hoje.** A
> linha riscada já foi resolvida; as seções abaixo contam como. Quem lê só
> a tabela conclui que a RPC ainda existe — foi para isso que o risco
> ficou marcado, e não apagado.

| Superfície | Protegida? |
| --- | --- |
| `/auth/v1/token` (login, cadastro, recuperação) | **Sim** — rate limit próprio do Supabase/GoTrue, server-side |
| `send-email` | **Sim** — exige assinatura Standard Webhooks |
| `moderate-links` / `moderate-text` / `moderate-image` | **Sim** — exigem sessão válida (`auth.getUser()`) |
| `moderate-image` com `falha_de_extracao` (relato do navegador, `[29/08]`) | **Sim** — sessão válida **e** ser dono do conteúdo; e a RPC deduplica 1 h por motivo |
| Trilha de auditoria | **Sim**, desde 27/08 — uma linha por hora por tipo |
| Sentry | **Sim**, desde 27/08 — 20 eventos por sessão |
| **Criar conteúdo** (post, comentário, mural, chat) | **Não.** Nada limita o ritmo. Conferido: nenhuma constraint em `posts` |
| ~~`register_login_attempt`~~ | **Era a pior de todas — e foi APAGADA em 28/08.** Ver abaixo |

### `[29/08]` Funções de trigger fora da API pública — e uma afirmação minha que estava errada

Ao criar a `enfileirar_conteudo_denunciado`, o `get_advisors` acusou
`anon_security_definer_function_executable`. Varri a **classe** (§1.3) e achei
duas funções que devolvem `trigger` com `EXECUTE` para `anon`/`authenticated`:
a minha, nova, e a `log_report_created`, antiga. As duas foram revogadas.

Função de trigger **não precisa de `EXECUTE` para disparar** — o Postgres checa
esse privilégio na criação do trigger, não a cada disparo. Confirmado em
`ROLLBACK` depois do revoke: a denúncia continua enfileirando normalmente.

> **A correção, e ela é minha.** Eu escrevi na migration que o `GRANT`
> "publica a função em `/rest/v1/rpc/<nome>`" e que qualquer um com a anon key
> poderia chamá-la. **Testei depois e é falso:** o PostgREST não expõe função
> que retorna `trigger`, com ou sem `EXECUTE`. Criei uma função de teste,
> concedi `EXECUTE` a `anon`, chamei pela anon key — **404**, o mesmo das
> revogadas.
>
> Cheguei a escrever um teste em `e2e/portas-fechadas.mjs` para travar isso.
> Ele **nunca falharia**, porque as duas situações respondem igual — era
> decoração, não trava (§2), e foi removido.
>
> **O que continua verdadeiro:** o revoke é higiene correta, tira o aviso do
> advisor e é defesa em profundidade se o PostgREST algum dia mudar. **O que
> era falso:** a brecha explorável que eu descrevi. Severidade real: 🔵 baixo,
> não o 🟠 que o texto da migration sugeria.

### `[29/08]` Por que o relato de falha de vídeo NÃO é o `register_login_attempt` de novo

O caminho novo permite que o navegador escreva no `admin_logs`, que é
exatamente o que tornou a antiga `register_login_attempt` a pior superfície do
projeto. A diferença é onde a checagem fica, e ela é o motivo de a comparação
não valer:

| | `register_login_attempt` (apagada) | `falha_de_extracao` |
| --- | --- | --- |
| Quem podia chamar | **qualquer um**, sem conta | só sessão válida |
| Sobre quem | **sobre qualquer conta**, informada no corpo | só sobre conteúdo **do próprio chamador** |
| Efeito de forjar | marcava conta alheia como sob ataque | uma linha de log sobre um post que já é seu |
| Ritmo máximo | o que o atacante quisesse | o ritmo em que a pessoa publica |

O ramo do relato fica **depois** da checagem de dono da `moderate-image`, e
existe teste de contrato exigindo que continue assim
(`src/lib/__tests__/relatoDeFalhaDeVideo.test.js`). Se alguém mover o ramo para
cima da checagem, o teste falha nomeando o problema.

**O que sobra de risco:** uma conta legítima pode publicar vídeos em sequência
para gerar linhas. É ruído, não escalada — e a deduplicação de 1 hora por motivo
da própria RPC limita a uma linha por causa por hora.

### O contador de login promete o que não entrega

Duas medições, e as duas contrariam o que o mecanismo aparenta fazer:

- **3 logins com senha errada direto no GoTrue → o contador não saiu de zero.**
  Ele só se move quando o *nosso frontend* educadamente reporta a falha. Um
  atacante de verdade não reporta. **Logo, não protege contra força bruta.**
- **5 chamadas anônimas a `register_login_attempt` → conta marcada como
  bloqueada**, sem senha e sem sessão.

A RPC precisa ser chamável por `anon` (a página de login não está autenticada) e
**incrementa sem verificar se o login falhou**.

**O que isso NÃO é:** não tranca ninguém fora. Uma sessão anterior já mitigou
colocando a tentativa de login *antes* da checagem de bloqueio — **verificado**:
conta marcada como `blocked`, dono entrou com a senha certa, HTTP 200.

**O que sobra** é poluição de `admin_logs` e `admin_notifications` com alertas
de segurança fabricados: qualquer um gera "conta bloqueada" para qualquer email.
Mesma classe do `edge_function_error` — fadiga de alarme.

### `[28/08]` Corrigido — o contador passou a contar o que acontece

A correção não foi remendar a RPC: foi **tirar a decisão do cliente**.

`public.hook_de_verificacao_de_senha(event jsonb)` é o **Password Verification
Hook** do Supabase. O GoTrue chama o banco a cada verificação de senha e entrega
o próprio veredicto (`{user_id, valid}`). Errou a senha, conta; acertou, o
histórico é zerado. Nada que o frontend faça move esse número.

A porta forjável foi **apagada**: `register_login_attempt` não existe mais, e a
contagem vive em `contabilizar_falha_de_login`, com `EXECUTE` revogado de `anon`
e de `authenticated`. A tela de login agora só **lê**, por `check_login_status`.

> **`[17/09]` Esta última frase deixou de ser verdade, e o jeito como ela morreu
> vale mais do que a correção.** Ela era fato em 28/08. Em **11/09** a tela de
> login parou de chamar `check_login_status` — e ninguém voltou aqui, porque
> apagar uma chamada não estoura nada. Hoje (SEC-022) a função foi **revogada**
> de `anon` e `authenticated`: não é mais "a tela só lê", é *ninguém lê*.
>
> Frase datada envelhece sem avisar quando o "agora" dela sobrevive ao fato
> (§1.4). Quem ler daqui a seis meses procuraria a leitura no código e não a
> acharia.

**O hook devolve sempre `decision: 'continue'`, e isso é decisão de produto.**
Recusar ali transformaria o contador num portão de verdade — e portão desses é
negação de serviço contra a conta: bastaria errar a senha de alguém 10 vezes
para trancar a pessoa do lado de fora. Contra força bruta quem protege é o rate
limit do próprio GoTrue, que é server-side. O papel deste contador é **avisar a
equipe**, e para avisar ele precisava primeiro parar de mentir.

> O `EXCEPTION WHEN OTHERS` que engole tudo dentro do hook é a única vez que
> engolir erro é o certo neste projeto (contra a §4): um defeito ali travaria o
> **login do site inteiro**, inclusive o do dono. Contabilidade de tentativa não
> vale esse risco.

Verificado em transação com `ROLLBACK`, 8 checagens: falha conta 1→2→3, acerto
apaga a linha, evento malformado devolve `continue`, e nem `anon` nem
`authenticated` conseguem chamar qualquer uma das duas funções.

> ### `[11/09]` O TÍTULO ACIMA DIZ "CORRIGIDO", E O CONTADOR ESTÁ DESLIGADO
>
> Queixa do dono: *"não tá contando os logins errado e tá aparecendo apenas o
> erro de credenciais inválidas"*. **Ele está certo.**
>
> Medido, não deduzido — três fontes independentes:
>
> | O que olhei | O que achei |
> | --- | --- |
> | `select count(*) from login_attempts` | **0 linhas**, `max(updated_at)` = *nunca* |
> | logs do GoTrue, 24 h | **9 logins** em `/token`, e o único `run_hook` registrado é o da `send-email` |
> | `pg_proc` + `routine_privileges` | a função **existe** e tem `GRANT` para `supabase_auth_admin` |
>
> **A causa NÃO é "faltou clicar", e eu afirmei isso antes de conferir.** Meu
> primeiro diagnóstico foi *"falta apontar o hook em `Authentication → Hooks`"*.
> Está errado: o `Password Verification Attempt` **não existe no plano Free**.
> A tabela da [documentação de Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
> marca esse hook como `Teams and Enterprise`, enquanto quatro outros aparecem
> como `Free, Pro`.
>
> **O projeto já sabia disso, num comentário em `src/pages/Login.jsx`:**
> *"Contar de verdade exigiria o Password Verification Hook, que é exclusivo do
> plano Team"*. Eu li o banco, os logs e o `pg_proc` — e não li o comentário que
> estava no caminho do código que eu estava diagnosticando. É o §1.4 pelo
> avesso: o documento estava certo, e quem envelheceu foi a minha leitura.
>
> Ficou **14 dias** escrito como "Corrigido" por um motivo diferente do que eu
> supus: não foi um clique esquecido, foi uma migration entregue para um plano
> que o projeto não tem.
>
> **Por que nada acusou, e é a lição.** É §1.5 em estado puro: o silêncio aqui é
> indistinguível de "ninguém errou a senha". Tabela vazia é a resposta certa nos
> dois mundos, e nenhum dos portões do projeto olhava para a diferença.
>
> **A função em si está boa** — reprovado o palpite de que houvesse defeito
> nela. Provado em `ROLLBACK` hoje, com o hook chamado exatamente como o GoTrue
> o chama: 4 erradas levam `attempts` a 4 sem bloquear, a 5ª bloqueia por **15
> minutos**, acertar apaga a linha, e evento lixo ou usuário inexistente
> devolvem `continue`. Ligar o hook **não** pode trancar ninguém: ele responde
> `continue` sempre e engole exceção, como o parágrafo acima explica.
>
> **A trava que eu ia escrever não pode existir**, e isso precisa estar dito:
> ela erraria a senha de propósito e conferiria que o contador andou. No Free o
> contador nunca anda, então ela reprovaria para sempre — portão que grita por
> algo que ninguém pode resolver ensina a ignorar o canal (§0.2, 4ª regra).
>
> **O que sobra é uma decisão de produto, e está no `BACKLOG.md`:** ou o site
> para de prometer na tela um bloqueio que não acontece, ou o projeto sobe de
> plano. Contar do lado do cliente está fora — foi exatamente a brecha fechada
> em 28/08, em que qualquer um forjava o bloqueio de qualquer e-mail.

### `[28/08]` O hook está pronto e **não pode ser ligado no plano Free**

Conferido no painel: em *Authentication → Hooks*, o **Password Verification
Attempt hook** aparece cinza, com *"Team or Enterprise Plan required"*. A
organização está no plano `free` (confirmado via API). Eu tinha afirmado o
caminho do painel sem checar a disponibilidade — era inferência vestida de fato
(§1.1), e está corrigido aqui.

**Um segundo caminho também está fechado.** `auth.audit_log_entries`, onde o
GoTrue poderia registrar tentativa de login, está **vazia — zero linhas desde
sempre**. Não dá para contar falha real por ali.

**O que isso deixa de pé, e é preciso ser exato:**

| | Estado |
| --- | --- |
| Fabricar alerta de segurança para qualquer email | **Fechado.** A RPC forjável foi apagada; `anon` recebe 404 |
| Contar falha de login real | **Impossível no plano Free** |
| Proteção contra força bruta | **Existe, e nunca foi nossa** — é o rate limit do GoTrue, server-side |

O que sobra do lado do site é uma tabela `login_attempts` que ninguém mais
preenche. Por isso a tela de login **parou de mostrar "N tentativas até o
bloqueio"**: com o contador parado, aquele aviso dizia "5 tentativas" para
sempre, sem nunca descer. Contador que não conta é pior que contador nenhum.

As funções `hook_de_verificacao_de_senha` e `contabilizar_falha_de_login` ficam
no banco, prontas e com `EXECUTE` revogado de todo mundo exceto o
`supabase_auth_admin`. Se o projeto um dia subir de plano, ligar o hook é um
clique. Superfície de ataque: nenhuma — ninguém consegue chamá-las.

> A política de segurança e os pontos de melhoria são revisados periodicamente
> pelo plano de auditoria em 3 fases descrito no `CLAUDE.md`.

---


---

[← voltar para o README](../README.md)

---

## `[01/09]` A matriz de gatilhos — o que cobre cada área, e o que NÃO cobre

> Pedido do dono: *"todo lugar onde dê pra colocar um gatilho pra vc lembrar oq
> falta, quero que vc ponha, desde do front até o banco de dados"*, com a forma
> exigida sendo **gatilho → obrigação → evidência**.

A pergunta que encontra brecha não é "existe portão?" — é **"existe caminho
para alterar esta área sem acionar nenhum?"**. As outras só descrevem.

| Área | Portão | **O que ele EXIGE de quem mexe** | Existe caminho sem acionar? |
| --- | --- | --- | --- |
| Auth/autorização | `useAuth.test.js`, `roles.test.js`, `fluxos.mjs` | que `/admin` e `/owner` continuem negados a `role='user'`, provado num navegador | **sim** — policy no banco não passa por nenhum deles |
| Banco e RLS | `portas-do-banco.mjs`, `tabelasSemUpdate.test.js` | que porta fechada siga fechada, porta aberta siga aberta, e que ninguém escreva `update` em tabela sem policy | **sim, em parte** — ver "o buraco que fica" |
| Dado sensível | `portas-do-banco.mjs` | que `posts` e `admin_logs` respondam 401 ao anônimo, e que de `profiles` o anônimo leia **exatamente `id` e `username`** — nem uma coluna a mais, nem a menos | sim — não vê o que um **logado** alcança |
| Privacidade | `conteudoDaPrivacidade.test.js` | que chave nova no navegador, terceiro novo e cookie **entrem na política** antes de existirem | não, para o que ele conhece |
| Admin/staff | `painel-admin.mjs` | que o painel liste, pagine e negue — com dado que o próprio teste cria | sim — cobre a tela, não a permissão no banco |
| Edge Functions | `portas-fechadas.mjs`, na **produção** | que as 6 portas recusem chamada sem credencial — e, na `verify-contact`, que o captcha esteja mesmo sendo conferido (403, não 400) | não, e é de propósito: as functions não estão no git |
| Fluxos críticos | `fluxos.mjs` | publicar → conferir → apagar → sair, e nenhum lixo de teste sobrando | sim — cobre o caminho feliz de uma conta comum |
| Testes | piso de testes, `rotasE2E.test.js`, **`varrerFontes`** | que rota nova tenha teste de navegador, e que trava que varre arquivo **prove que varreu** | não |
| Segredo/config | `segredos-vazados.mjs` | que nenhum arquivo rastreado tenha chave privada, `service_role`, token ou senha | não, para os padrões que ele conhece |
| CI/CD | portão de deploy da Vercel | que branch nova entre no `vercel.json` | não |
| Documentação | `documentacao-quebrada`, `mapa-de-arquivos`, `documentacao-envelhecida` | que arquivo novo entre no `ARQUITETURA.md` e que nenhum doc cite arquivo morto | não |
| Conteúdo visível | `conteudo-visivel.mjs` | que nada com tamanho real fique em `opacity: 0` numa janela de celular | não |
| Navegação | `navegacao.mjs` | topo ao trocar de página, âncora funcionando das duas páginas, e voltar preservando o lugar | não |
| Fronteira de `lazy()` | `orcamento-de-bytes.mjs` | que o chunk dos painéis (`Admin`, `Owner`) continue existindo separado — se um `lazy()` virar `import` estático o arquivo some, nada quebra, e o código da equipe passa a viajar no pacote de todo visitante anônimo | não |

**A coluna do meio é a que faltava**, e o dono tinha razão em cobrá-la: sem
dizer o que o portão **exige**, "existe portão" vira contagem — e contagem não
orienta quem vai mexer na área.

### O que a auditoria de 01/09 mediu, e o que ela desmentiu

Rodando `get_advisors` e consultando `pg_proc`/`pg_policies` diretamente:

| Classe verificada | Resultado |
| --- | --- |
| `SECURITY DEFINER` sem `search_path` | **zero** — a classe está fechada |
| Tabela sem RLS ligada | **zero** |
| Tabela sem policy de UPDATE | 13 — e **nenhuma** recebe `update` no código hoje |
| `SECURITY DEFINER` chamável por `anon` | 2: `check_login_status`, `get_user_xp` |

**O WARN de `check_login_status` NÃO se confirmou como brecha.** A suspeita era
oráculo de enumeração de e-mail. Medido: `login_attempts` tem **0 linhas** com 5
usuários reais — a tabela só ganha linha em tentativa **falha**, então a função
devolve `{attempts: 0, blocked: false}` para e-mail existente e inexistente do
mesmo jeito. Ela não distingue os dois casos. Ela **precisa** ser pública: a tela
de login consulta o bloqueio antes de autenticar.

> Registrado porque lint que acusa não é prova de brecha, e tratar WARN como
> vulnerabilidade é o mesmo erro de tratar verde como garantia.

### O buraco que FICA, e por que não fechei

As duas classes mais perigosas do banco — **policy** e **privilégio de coluna** —
só se verificam com acesso administrativo ao Postgres. Pôr a `service_role` nos
secrets do CI daria a um runner público a chave que ignora toda a RLS: trocar
uma incerteza de monitoramento por uma credencial exposta é a conta ruim de
sempre (§0.2).

Então elas continuam sendo trabalho de **auditoria** (§6), rodadas por MCP. As
consultas estão em [`regras/AUDITORIA.md`](regras/AUDITORIA.md) e a de policy de
UPDATE está repetida no cabeçalho de `lib/tabelasSemUpdate.js`, junto da lista
que ela gera.

---

## `[01/09]` A varredura de classe — o que ela encontrou nas minhas próprias travas

A parte B da auditoria (§ do `BACKLOG.md`) manda varrer as classes de erro pelo
código, e não tratar achado como caso isolado. A classe mais grave é **"teste
que não consegue falhar"** — está no catálogo desde 30/08 e eu já a repeti duas
vezes.

**O que a varredura mediu:** das 9 travas que leem arquivos, **6 não conferiam
que leram algum**. Todas com o mesmo desenho:

```js
const arquivos = varrer('src/algum/caminho');   // e se voltar vazio?
const infratores = arquivos.filter(...);
expect(infratores).toEqual([]);                 // passa. sempre.
```

Renomeie a pasta e a trava fica **verde para sempre**, sem nunca mais ler uma
linha. Não é hipótese: é o mesmo mecanismo do teste de portas RPC e do de banco
fora do ar, os dois que já me pegaram.

**O conserto é de classe, não de caso:** `src/lib/__tests__/varrerFontes.js`
**estoura** quando não encontra arquivo. A guarda mora no varredor e não em cada
teste de propósito — guarda que depende de alguém lembrar de escrever é o mesmo
que não ter guarda.

**Provada** movendo `scene3d/` para fora: a trava do raio parou de passar e
disse por quê, em vez de seguir verde.

---

## `[05/09]` O cofre do painel do Fundador NÃO é um controle de segurança

Isto está escrito aqui exatamente porque o contrário seria fácil de acreditar.
O painel do Fundador ganhou uma tela de cofre com código, e ela **parece** uma
segunda camada de autorização. Não é.

| Ameaça | O cofre protege? |
| --- | --- |
| alguém sentado no computador do dono, com a sessão aberta, clicando | **sim** — é a única coisa para a qual ele existe |
| alguém com a sessão roubada chamando a RPC direto pela API | **não**, e nada no navegador protegeria |
| alguém que abre o DevTools e apaga o `localStorage` | **não** — apaga e define um código novo |

**A autorização real está no banco e sempre esteve:** `is_super()`, a hierarquia
de `role_rank()` e as policies. É isso que impede um `admin` de mexer em cargo.
Se alguém apagar `src/lib/cofre.js` inteiro amanhã, **nenhuma permissão do site
muda** — some só a tela.

**Por que aceitar uma tranca que não tranca.** Porque a ameaça que ela cobre é
real e não tinha resposta nenhuma: o computador do dono, aberto, com a sessão
viva. Para essa, um código pedido antes de mostrar o painel é exatamente a
medida certa.

**O que estaria errado é ela se apresentar como mais do que é.** Por isso o
aviso está impresso **na própria tela**, embaixo do campo, e não só neste
documento: *"esta tranca é visual e vale só neste navegador"*. Cofre que parece
proteger e não protege é pior do que cofre nenhum — ele muda o comportamento de
quem confia nele.

**A versão de verdade** — código conferido numa RPC contra um hash, tabela de
desbloqueio, e toda RPC de owner exigindo desbloqueio ativo — está descrita em
[VISAO-DE-FUTURO.md](VISAO-DE-FUTURO.md), junto do risco que ela traz: **ficar
trancado para fora**, que precisa de caminho de recuperação pensado antes de
existir.

**A defesa que vale mais por hora de trabalho, se a preocupação for sessão
roubada, continua sendo 2FA na conta do Supabase** — não uma segunda senha
guardada no mesmo aparelho que a primeira.

### O que é conferido por teste

`src/lib/__tests__/cofre.test.js` cobre o comportamento local — define, confere,
abre por aba, esquece — e um caso que nada na tela denunciaria: **o código nunca
pode ser gravado em texto puro**. Se alguém "simplificar" o hash, a tela
continua abrindo igual e só o teste percebe. Provado reinjetando o vazamento.


---

## `[05/09]` `get_user_xp` deixou de ser alcançável por quem não tem conta

`PUBLIC` e `anon` tinham `EXECUTE`, então qualquer requisição sem sessão chamava
`/rest/v1/rpc/get_user_xp` com um UUID qualquer.

**A severidade honesta é 🔵 baixa**, e isso está escrito para o achado não ser
inflado: o que ela devolve é agregação de dado que já é público — contagem de
posts, comentários e lives. Não vaza email, data de nascimento nem nada
revogado.

**Fechou por duas razões concretas, não por precaução:**

1. É um endpoint de **cálculo** sem sessão — quatro `COUNT`, um com `JOIN`, sem
   limite de quantas vezes por segundo. Num plano gratuito, computação anônima
   e ilimitada é cota sendo gasta (§0.2).
2. **Nenhum caminho anônimo precisava dela.** Verificado nos quatro chamadores:
   `Ranks.jsx` usa `user.id`; `useUserXP` só é consumido por `Sidebar` e
   `AvatarPopup`, que só existem logado; `fetchProfileStats` é do perfil; e
   `/u/:username` está atrás de `RequireAuth`.

Superfície que não serve a ninguém só pode ser usada contra o site. **Testado em
`ROLLBACK` antes de aplicar:** como `anon` a chamada passou a ser recusada, como
`authenticated` continuou funcionando.

**As outras três funções alcançáveis sem conta continuam abertas, e por quê:**
`check_login_status` (só lê `login_attempts`, e a linha nasce na tentativa —
não confirma se a conta existe), `username_disponivel` (o cadastro precisa dela
antes de haver sessão, e apelido é público) e `contagem_de_migrations` (devolve
um inteiro). O raciocínio de cada uma está em
`db/2026-09-05-fase4-deriva-codigo-banco.md`.


---

## `[05/09]` FASE 2 — dois achados no corpo das funções privilegiadas

### 🟠 O fundador era barrado do painel de logins bloqueados

`get_blocked_logins` checava `role = 'super_admin'` **literal**, e o `owner` —
que está acima na hierarquia — recebia `Access denied`. Comprovado em `ROLLBACK`
com o JWT do fundador.

**É a terceira vez que esta mesma classe morde este projeto**: antes foram 14
policies sem `owner` e o `admin_unlock_login` barrando o próprio fundador. A
regra existe e está escrita. O que falhou foi o **alcance da varredura**: a
consulta de classe daquela vez procurava em `pg_policies` e parou ali — as
funções nunca foram varridas com o mesmo critério.

Corrigido para `is_super()`. E a lição operacional fica registrada: varredura de
classe tem que cobrir **policies, funções e código**, não um dos três.

### 🟠 A trilha de auditoria era forjável por quem tem conta

`log_audit_event` é executável por `authenticated` **por desenho** — o cliente
registra os próprios eventos. Mas aceitava qualquer `action`, `details` e
`severity`.

**Comprovado em `ROLLBACK`:** um perfil `role = 'user'` gravou
`action = 'admin_ban'`, `severity = 'critical'`, com o texto que quisesse.

| | |
| --- | --- |
| **risco** | escrever na trilha que a equipe usa para decidir |
| **impacto** | não é escalada — o `actor_id` vem de `auth.uid()` e ninguém se passa por outro. É envenenar a fonte de verdade da moderação e disparar alarme falso de propósito |
| **solução** | lista **fechada** de actions, cargo para as de equipe, severidade alta só de equipe |

**Onde a trava mora, e por que não é no banco.** A recusa do banco existe, mas
em produção ela é **invisível**: `lib/auditLog.js` engole o erro de propósito,
então uma action nova esquecida na lista simplesmente não se registra — ninguém
vê, nada é gravado, nenhum teste de comportamento quebra. As três respostas
"nada" do §1.5. Por isso quem realmente segura é
`src/lib/__tests__/trilhaNaoEhForjavel.test.js`, que reprova no CI.

### O limite desta passada, dito com todas as letras

As **34** funções não alcançáveis por `anon`/`authenticated` não foram lidas uma
a uma. Não há caminho pela API para chamá-las — mas *"não é chamável"* é uma
afirmação sobre os `GRANT`s de hoje, e um `GRANT` novo derruba essa premissa em
silêncio.

---

## `[18/09]` PENTEST DE SETEMBRO — 15 achados relatados, 4 mecanismos reais

> Um pentest autorizado rodou contra produção com uma **conta comum** e relatou
> 15 achados. O pedido do dono foi *"pesquise mais a fundo ainda pra ver se vc
> acha algo a mais que isso e conserte tudo na hora"*.

### Os 15 achados eram 4 mecanismos

Contar achados engana. Quase todos vinham da mesma causa, e é a causa que se
corrige — corrigir achado a achado deixa o próximo aparecer amanhã.

| Mecanismo | Achados que ele explica | Fechado por |
| --- | --- | --- |
| `posts` dava `UPDATE`/`INSERT` a `authenticated` nas **22 colunas**, e a policy `posts_update` não tem `WITH CHECK`. O trigger guardava **3** colunas e nada de live | XP-LIVE-001, 8, 9, 10, 11 | SEC-027 |
| `get_user_xp` contava `posts`/`comments`/`post_likes` **sem filtrar** `deleted_at` nem `hidden_at` | XP-LIVE-003, XP-001, XP-002, 7 | SEC-028 |
| Existiam **3 fórmulas de XP** independentes | 12 | SEC-028 |
| Autorização checada **depois** da validação de entrada | 15 | SEC-031 |

### O que a investigação DESMENTIU do relatório

Achado relatado não é achado confirmado. Três não sobreviveram à verificação:

| Achado | Veredito | Evidência |
| --- | --- | --- |
| **10** — "dá para doar o post para outra conta" | **NÃO EXISTE** | o `PATCH` retorna 204, mas `trg_guard_post_privileged` reverte `user_id`. Lendo o valor final, o dono continua o mesmo |
| **13** — "XP de terceiro é vulnerabilidade" | **NÃO É** | XP é público por desenho: a página de perfil e a de Ranks mostram o XP alheio. Nada a corrigir |
| **14** — "oráculo de existência via `get_user_xp`" | **FRACO demais para valer** | conta real sem atividade e uuid inexistente devolvem o **mesmo** `0`. A resposta não distingue |

> **O erro que quase entrou no relatório, e a lição que ele repete.** A primeira
> rodada de teste marcou o achado 10 como *"BRECHA CONFIRMADA"* porque olhou
> `ROW_COUNT > 0`. O `UPDATE` **é** aceito; o trigger desfaz depois. É a fonte
> de silêncio nº 3 do §1.5 — *"o comando passou sem erro, e o guarda reverteu
> por baixo"* — aplicada ao próprio teste de segurança.
>
> **`ROW_COUNT` não prova efeito. Só o valor relido prova.**

### O que o pentest NÃO encontrou, e foi achado aqui

| Novo | Achado | Severidade |
| --- | --- | --- |
| **N1** | `record_banned_login_attempt(NULL)` fura o guard de identidade e planta linha **forjada** na trilha de segurança, **sem teto** | 🟠 Alto |
| **N2** | `was_live` é forjável no **INSERT**, não só no `PATCH` — o post nasce valendo +30 XP | 🟠 Alto |
| **N3** | `discord`/`twitch`/`youtube`/`avatar_url` aceitam **string vazia** e pagavam bônus. Medido: **95 → 140 XP** escrevendo `''` | 🟡 Médio |
| **N4** | `expires_at` gravável pelo autor + `cleanup_expired_posts` faz `DELETE` real por ela = caminho para destruir conteúdo sob moderação | 🟡 Médio |
| **N5** | `request_role_demotion` distinguia conta que existe de conta que não existe, para **qualquer logado** | 🔵 Baixo |
| **N6** | `LogsPanel` renderizava `{log.details}` cru — `details` nulo virava linha **em branco** no painel | 🔵 Baixo |

**N1 e N6 são a mesma coisa vista de dois lados.** O dono perguntou por que
havia logs sem título nenhum no painel. A resposta não era formatação: em SQL,
`v_caller_email <> NULL` devolve `NULL`, `false OR NULL` devolve `NULL`, e um
`IF NULL` **não dispara**. O guard deixava passar, e como `'texto' || NULL` é
`NULL`, a linha nascia sem detalhe.

> Esta armadilha **já estava escrita** em [`regras/BANCO.md`](regras/BANCO.md),
> na seção *"Toda entrada de RPC precisa de FAIXA"*. A regra existia, o guard
> foi escrito depois dela, e caiu no mesmo buraco. Por isso a correção saiu com
> **teste**, não só com a linha corrigida.

### A varredura de classe (§1.3) — onde MAIS o padrão existia

O relatório trouxe **um** caso de "interagir com conteúdo que não existe":
comentar em post apagado. Três tabelas penduram linha em `posts.id`, e as três
tinham o mesmo buraco:

```
comments    -> comentar em post apagado/oculto     (o único relatado)
post_likes  -> curtir post apagado/oculto
live_chat   -> mandar mensagem no chat de live apagada
```

Corrigir só a primeira deixaria duas iguais no ar — foi assim que 14 policies
ficaram sem `owner`, três vezes seguidas.

### A armadilha evitada, e ela teria derrubado o site

A correção "óbvia" para o mecanismo 1 era revogar as colunas de `posts` de
`authenticated`. **`hidden_at` e `deleted_at` não podem ser revogadas:** a
moderação grava `hidden_at` por `UPDATE` direto de tabela
(`moderationService.js`, `setHiddenAt`), e admin também é `authenticated`.
Revogar teria quebrado o painel inteiro — a classe exata do erro do SEC-025.

Quem separa admin de usuário comum nessas duas colunas é o `role_rank >= 2`
dentro do próprio trigger, que já fazia isso.

### O que continua em aberto, e é decisão de produto

`was_live` hoje significa *"o autor marcou uma caixa no formulário de edição"*,
não *"uma live aconteceu"*. A SEC-027 tornou o campo **derivado e não-gravável
pelo cliente**, o que mata toda manipulação via REST — mas **marcar a caixa na
UI continua valendo 30 XP**, porque tirar isso muda o produto, não fecha uma
brecha. Está no `BACKLOG.md` como decisão do dono.

---

## `[18/09]` AUDITORIA EXTERNA, 2ª RODADA — e a lição é sobre CLASSE

> Um documento de auditoria externa retestou as correções do pentest e trouxe 3
> achados novos. Os três eram reais. **Mas o que importa aqui não são os três —
> é que a varredura que eles obrigaram encontrou mais três.**

### A falha de método, e ela é minha

A SEC-031 (17/09) moveu autorização para antes de validação em **duas** funções.
Eu tratei como dois casos isolados e segui em frente.

O §1.3 é explícito: *"ao achar um bug, perguntar sempre: onde MAIS esse mesmo
padrão existe?"*. Não perguntei. No dia seguinte:

| Quem achou | O quê |
| --- | --- |
| A auditoria externa | `restore_post` — que **eu escrevi no mesmo dia**, com o lookup antes da autorização |
| A varredura que eu deveria ter feito na SEC-031 | `soft_delete_post`, `lift_suspension`, `nominate_staff` |
| **A trava de regressão da própria SEC-032** | `admin_set_role` — que a varredura do banco não viu, porque o `EXECUTE` dela está revogado |

**Seis funções, e eu tinha corrigido duas.** Corrigir caso a caso protege contra
o passado; varrer a classe protege contra o próximo.

> A `nominate_staff` era a pior: devolvia *"Usuário já possui cargo de staff"*
> para quem não pode indicar ninguém — vazava **cargo**, não só existência.

### A armadilha da varredura, pela 9ª vez

A primeira versão da consulta acusou **cinco**, e uma delas era a que eu tinha
acabado de corrigir. Motivo: o comentário que eu escrevi na SEC-031 **cita**
`'Usuário não encontrado'` em prosa, e a busca leu comentário como código.

Ler prosa como se fosse código já me pegou **nove vezes** neste projeto. A
regra, agora em todas as travas que olham SQL: **tirar comentário ANTES de
qualquer medida de posição.**

### Duas formas de fechar um oráculo, e a escolha não é de gosto

| Quando | Como |
| --- | --- |
| A permissão de quem chama **não** depende do alvo | **Autorização primeiro.** Quem está autorizado continua recebendo a mensagem útil |
| A permissão **depende** do alvo (ex.: "só o dono apaga") | **Unificar a mensagem.** "Não existe" e "não é seu" passam a dizer o mesmo |

O segundo caso é o `soft_delete_post`, e a decisão já existia neste projeto,
escrita no `fetchPostById`: *"dizer 'existe, mas você não pode ver' já é vazar a
existência"*.

### Os outros dois achados

**06L — a resposta que sumia da tela.** A FK de `parent_id` garantia que o pai
existe, não que ele está no **mesmo post**. O efeito não é vazamento (o
`fetchComments` filtra por `post_id`): é que o `rootIdOf` do `CommentSection`
para quando o pai não está na lista e devolve o id do próprio órfão — que não é
raiz, e por isso **nunca renderiza**. O `fetchCommentCount` conta. O contador diz
3, a thread mostra 2. Fechado com FK **composta** — trava de 1ª força.

**N7 — a live em estado impossível.** `set_live_ended_at` gravava a data de fim e
nunca a limpava na reativação: `is_live = true` **e** `live_ended_at = 12:46`.
Fechado com o ramo que falta + um `CHECK`, porque trigger é 3ª força e constraint
é 1ª.

> **O que apareceu investigando isso, e ninguém tinha pedido:** apagar o post
> **não encerrava a live**. O `fetchActiveLives` não filtrava `deleted_at`, e a
> `posts_select` libera conteúdo apagado a partir de `role_rank >= 2` — então a
> live apagada continuava listada como "AO VIVO" **para a equipe**, que é quem
> mais olha essa tela.

### O spam de notificação — a 4ª regra do §0.2 aplicada

Cada `false → true` disparava `live_reactivated` para todos os admins, sem teto.
Medido: **36 das 116** notificações de admin eram de live (31%), geradas por um
teste alternando o mesmo post.

A pergunta da 4ª regra é *"quem pode disparar isto?"*. Podia qualquer um. Hoje
tem dedup de 30 minutos e vira contador: **5 ciclos geram 3 linhas, não 11.**

### Um item do BACKLOG que estava aberto embaixo do meu nariz

`soft_delete_post` e `restore_post` não tratavam `auth.uid()` NULL — a **mesma**
armadilha da SEC-030, registrada desde 11/09 com prova anexada. Eu reescrevi as
duas funções nesta sessão sem ler o item.

Não é explorável hoje (`anon` não tem `EXECUTE`), e é exatamente por isso que
não podia ficar: proteção que depende só de um `GRANT` é a "proteção acidental"
do §1.3. Fechado na SEC-035, com duas camadas (`IS NULL` explícito **e**
`IS DISTINCT FROM`).

### O E2E que passou a existir

Nenhuma dessas travas roda num navegador. `e2e/lives.mjs` é o primeiro teste da
esteira que confere a **tela** contra o **estado persistido** usando o token real
do usuário — não `SET LOCAL role` numa transação.

A diferença importa: a transação prova a RLS; o token prova o caminho inteiro
(PostgREST, JWT, policy, trigger). E ele inclui o ataque de PATCH nas colunas
privilegiadas feito como o navegador faria, com releitura obrigatória — porque
`204` não prova nada, o que já transformou um "achado confirmado" em falso
positivo uma vez.

---

## `[18/09]` 3ª RODADA — a auditoria externa achou a MESMA regra pela metade, três vezes

Um terceiro levantamento trouxe N8–N24. O padrão dos que eram reais é único, e
ele não é sobre uma brecha: é sobre **eu escrever uma regra e aplicá-la em um
lugar só**.

| ID | O que estava aberto | Fechado por |
| --- | --- | --- |
| **N8** | live ocultada ou apagada pela equipe continuava pagando 30 XP | LIVE-040 |
| **N9** | comentário de post **apagado** continuava pagando 3 XP | LIVE-040 |
| **N10** | comentário de post **oculto** idem | LIVE-040 |
| **N11** | comentário de post fora do ar continuava **legível** por conta comum | SEC-041 |
| **N12** | mensagem de live chat idem — a policy era `USING (true)` | SEC-041 |
| **N13** | curtidas | **não é falha**, e a decisão está medida e escrita |
| **N16** | `lives_realizadas` órfã depois do post apagado | **é o desenho**, não achado |

### A regra que eu tinha escrito, e cumprido pela metade

> **XP paga pelo que ESTÁ NO AR.** Conteúdo que a moderação tirou não paga em
> **nenhuma** forma — post, comentário ou live.

A SEC-028 (17/09) escreveu essa frase e aplicou em `posts`. No dia seguinte:

| Quem abriu o buraco | Como |
| --- | --- |
| **eu, na LIVE-036/037** | soltei o XP de live do post para o registro sobreviver ao cron. Ao soltar do **post**, soltei da **moderação** — que age no post |
| **eu, na SEC-028** | filtrei `comments.hidden_at` e parei ali. O comentário nunca olhou o **pai** |

Medido em `ROLLBACK`, e é o número que define os três achados de uma vez:

| A moderação faz | XP do autor |
| --- | --- |
| ocultar um **post comum** | 1 → **0** ✓ |
| ocultar uma **live** | 1 → **1** ✗ |
| apagar uma **live** | 1 → **1** ✗ |

**A lição é a mesma da 2ª rodada, e ela voltou porque eu não a apliquei
inteira:** varredura de **classe**, não de caso (§1.3). Ao escrever "o XP conta
só o que está no ar", a pergunta seguinte era *"quais são TODAS as formas de
ganhar XP, e cada uma olha o estado do conteúdo?"*. São quatro (post,
comentário, curtida, live) e eu confirmei **uma**.

### N11 e N12 — ler não é o mesmo que escrever, e a policy sabia só metade

A `post_aceita_interacao` foi criada na SEC-029 para o **INSERT**: não dá para
comentar embaixo do que a moderação tirou. Ninguém perguntou pelo **SELECT**.

Medido com papel `authenticated` real: depois de apagar o post, o comum lia
**1 comentário** e **1 mensagem de chat**, enquanto o **post** devolvia 0 linhas.

Isso importa porque ocultar um post costuma ser por causa da **conversa**, não
do texto do post — e o `EmbedPlayer` some junto com o post, então a única coisa
que continuava legível era exatamente o que a equipe quis tirar do ar.

Detalhe de RLS que vale registrar: `comments_select` **parecia** olhar
moderação (`hidden_at IS NULL OR role_rank >= 2`), e por isso passou por três
auditorias. Ela olhava a moderação do **próprio comentário**. A `live_chat` era
`USING (true)` sem disfarce nenhum.

### N13 — o achado que eu concordo que NÃO é achado

Curtidas ficaram de fora da SEC-041, e a decisão é medida:

1. **curtida não carrega conteúdo** — o que vaza é *"fulano curtiu o post X"*,
   para quem já tem o id do post;
2. **`post_likes` é a leitura mais quente do site** — o `attachEngagement` busca
   as curtidas de 30 posts de uma vez, em **todo** carregamento de feed.

Trocar o caminho mais quente do app por um vazamento de valor ≈ zero é a conta
errada. Está escrito na migration e travado por teste, para não voltar como
*"esqueceram"*.

### N16 — `lives_realizadas` órfã é o DESENHO, não o defeito

O levantamento apontou que a linha sobrevive ao post apagado. Ela sobrevive **de
propósito**: o cron apaga a live 15 minutos depois de encerrar, e uma FK levaria
junto a única testemunha de que a transmissão aconteceu. Sem isso, **o XP de
live durava 15 minutos** — foi o bug de 18/09, não a correção dele.

### O modo de falhar, que foi a decisão mais importante da rodada

A primeira versão da invalidação também agia no `DELETE` físico, distinguindo
cron de moderação por `auth.uid()` ser `NULL`. **O teste reprovou**, e como ele
reprovou vale mais que o resultado: `RESET role` não limpa
`request.jwt.claims`, então o "cron" de mentira ainda tinha um admin dentro.

Isso expôs a fragilidade do **desenho**. Os dois erros não são simétricos:

| Erro | Consequência |
| --- | --- |
| não invalidar quando devia | um banido guarda XP que não usa |
| invalidar quando não devia | **o site inteiro perde XP de live 15 min depois de cada live**, calado, para sempre |

O `DELETE` físico nunca invalida. A trava reprova se alguém acrescentar `DELETE`
ao gatilho, e a mensagem conta esta história inteira — porque quem esbarrar nela
daqui a seis meses vai achar que é uma omissão.

---

## `[18/09]` SEC-042 — a faxina da própria rodada achou o que a rodada criou

O `get_advisors`, rodado na bateria de faxina (§6.1) depois da LIVE-040, acusou
duas funções de **trigger** chamáveis como RPC por `anon` e `authenticated`:

```
registrar_live_realizada            (LIVE-036, hoje)
invalidar_lives_do_post_moderado    (LIVE-040, hoje)
```

**As duas são minhas, das últimas cinco horas.** E a classe já estava escrita no
`AUDITORIA.md`, Fase 4 — o `checar_palavras_bloqueadas` tinha passado por isso
antes. Varredura da classe inteira: **duas**, e todo o resto já estava fechado.
A higiene do projeto estava certa; quem furou fui eu.

### Severidade 🔵 BAIXO, dito para não inflar o achado

Chamada como RPC, uma função de trigger não tem `NEW` nem `OLD` e estoura em
*"record new is not assigned yet"*. Não dá para forjar live nem invalidar XP por
ali. Fecha mesmo assim porque *"só é inofensiva enquanto o corpo não mexer em
nada antes de tocar em `NEW`"* é a proteção acidental do §1.3.

### O que eu **não** deduzi do manual

O `BANCO.md` diz que revogar `EXECUTE` não desliga o trigger. Se isso estivesse
errado, eu teria desligado o registro de live inteiro **sem nada estourar**.
Medido em `ROLLBACK`, com o revoke dentro da transação:

```
1_trigger_de_registro_ainda_dispara ...... OK: gravou
2_trigger_de_invalidacao_ainda_dispara ... OK: invalidou
3_rpc_registrar (papel authenticated) .... OK: negado
4_rpc_invalidar (papel authenticated) .... OK: negado
```

### A causa raiz é maior do que as duas funções

`pg_default_acl` do schema `public`, para função criada pelo papel `postgres` —
que é o papel do `apply_migration`:

```
{postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
```

**Toda função nova nasce com `EXECUTE` para `anon`.** Para **tabela** o projeto
já fechou esse padrão no SEC-005 — é o que faz a régua de papéis funcionar, com
coluna nova nascendo fechada. Para **função**, não.

O estado de hoje continua limpo: conferido, são **3** funções alcançáveis por
`anon`, as três intencionais — `contagem_de_migrations` (o portão de espelho do
CI usa a anon key), `username_disponivel` (o cadastro precisa) e `role_rank(text)`,
que é função pura e não toca dado.

Fechar na raiz com `ALTER DEFAULT PRIVILEGES` é mudança de contrato de todo
trabalho futuro no schema (§7 🟡), então está **proposta ao dono** no
`BACKLOG.md`, com o modo de falhar dos dois lados na mesa. Até lá, quem segura a
classe é `src/lib/__tests__/funcaoDeTriggerNaoEhRpc.test.js`.

---

## `[19/09]` SEC-043 — o estado do operador virou parte da autorização

4ª rodada de auditoria externa. Os achados N43–N48 pareciam seis bugs; são
**um**, e a forma dele é uma **assimetria que o projeto já tinha resolvido do
outro lado**.

### A causa-raiz em quatro linhas

```
pode_publicar()         ->  NOT banned AND NOT suspended     usada no INSERT
is_staff()              ->  role_rank >= 2                   só cargo
is_super()              ->  role_rank >= 3                   só cargo
can_moderate_content()  ->  rank(caller) > rank(autor)       só cargo
```

O projeto aplicou o estado operacional a **publicar** e nunca a **moderar**.

### Medido antes, com papel `authenticated` real e o valor RELIDO

Não "sem exceção" — o valor **persistido** depois da chamada:

| | O que o operador punido conseguiu |
|---|---|
| **N43** | admin **banido** suspendeu um usuário |
| **N44** | admin **banido** baniu um usuário |
| **N46** | super_admin **banido** desbaniu, e destravou login |
| **N47** | admin **suspenso** suspendeu e baniu |

> **Correção ao relatório:** N45 e N48 (troca de cargo) **não reproduzem hoje**.
> `admin_set_role` está sem `EXECUTE` desde a SEC-026 e `owner_set_role` exige o
> fundador. O relatório os deu como reproduzidos; medido, não estão.

### A porta que o ataque contra a própria correção encontrou

A 1ª versão guardava só as RPCs. O admin banido moderou assim mesmo:

```sql
UPDATE posts SET hidden_at = now() WHERE id = ...   -- PERSISTIU
```

É o caminho do `moderationService.setHiddenAt`: **UPDATE direto, RLS, sem RPC
nenhuma**. Fechar só a RPC teria deixado a moderação inteira aberta pela porta
ao lado — e o relatório teria dito "corrigido". Por isso a guarda entra nos três
**helpers**, e daí **24 policies** a herdam de uma vez.

### A política, e de onde ela veio

Não foi inventada — está no `MODERACAO.md`:

> *"Suspensão… bloqueia o usuário de **criar conteúdo**… continua navegando/lendo
> — diferente do ban, que **tranca o site**."*

| Estado do operador | Pode operar? |
|---|---|
| **banido** | não, em nada |
| **suspenso** | não age; o site público continua aberto a ele |
| **owner** | isento |

**Onde eu estendi a documentação, e digo para poder ser contestado:** a doc fala
do usuário comum; suspender um **operador** nunca foi definido. Decidi que
suspensão tira também a **leitura administrativa** — "continua navegando" é
sobre o site público, não sobre o painel, e quem está punido por abuso não
deveria seguir lendo e-mail de usuário. É temporário e reversível, então errar
para o lado restritivo custa pouco.

### Por que o owner é isento, e a razão foi medida

```
role_rank('owner') = 4   ·   maior rank não-owner = 2
ban_user exige rank(caller) > rank(alvo)
```

**Ninguém consegue banir o owner pelo produto.** Isentá-lo não abre caminho no
modelo de ameaça; **não** isentá-lo cria um travamento sem volta, porque não
existe autoridade acima dele para restaurar o acesso.

### Por que `role_rank()` não mudou

Ele também calcula o rank do **alvo**. Misturar o estado do chamador ali faria
"banir alguém banido" mudar de significado. `role_rank` continua puro.

### O que esta correção NÃO cobre

Uma RPC administrativa **nova** não entra sozinha na lista da SEC-043. A trava
pega a lista **encolhendo**, não ficando para trás — para isso seria preciso ler
o banco no CI, credencial que este projeto já recusou três vezes. Está no
`BACKLOG.md` como risco residual.

Trava: `src/lib/__tests__/estadoDoOperador.test.js`, 31 asserções.

---

## `[19/09]` SEC-044 / SEC-045 — a decisão parou de confiar em snapshot

Sete achados (N25, N26, N27, N32, N38, N39, N41) descrevem a mesma coisa por
sete ângulos: **uma autorização criada para um estado antigo agindo sobre um
estado novo.**

O projeto já tinha o princípio certo em outro lugar — o N40 (perder privilégio
no meio do fluxo) foi PASS porque a autorização do **chamador** é recalculada na
decisão. Faltava aplicar o mesmo ao **alvo** e ao **estado**:

| | Como estava |
|---|---|
| autorização do chamador | recalculada → **N40 PASS** |
| estado do alvo | snapshot → N25/N26/N27 falham |
| geração do banimento | inexistente → **N41 falha** |

### N41, o pior deles — medido

```
BAN A -> pedido de revisão -> unban -> BAN B -> aprovar o pedido velho
resultado: "REMOVIDO — pedido velho matou ban novo"
```

A assimetria que revela o bug: `unban_user` **já** conferia `IF v_target_banned
IS NOT TRUE THEN RAISE`. `approve_unban_request` não conferia nada. Duas portas
para o mesmo ato, uma trancada.

### Por que a geração é `ban_count` e não `banned_at`

Minha primeira versão usou `banned_at`, e **o teste reprovou**:

> `now()` em PostgreSQL é a hora da **transação**, não do comando.

Dois bans na mesma transação recebem o mesmo instante, a guarda compara dois
valores iguais e passa. **Ela teria ficado no código parecendo proteger** — que
é pior do que não existir. `ban_count` é incrementado por `ban_user` e por
`apply_mod_auto_ban`: muda por banimento, não por relógio.

A geração é **derivada por trigger**, não declarada — assim os dois caminhos de
criação (`request_unban` e `solicitar_revisao_do_proprio_ban`) ficam cobertos
sem tocar em nenhum dos dois.

### N33/N42 — a regra de produto, escrita para ser contestada

Medido: suspenso 10 dias → banido → desbanido. Resultado: `banned = false` e
`suspended_until` ainda no futuro. O admin vê "desbanido", a pessoa continua sem
publicar, e **ninguém sabe por quê** — §1.5 exato.

**A regra:** o ban **absorve** a suspensão, e o unban limpa as duas. Quem quiser
manter reaplica, que é ato visível com log e hierarquia. A alternativa
(restaurar o saldo da suspensão) é defensável; escolhi limpar porque o modo de
falhar do silêncio é pior.

### N34 — a corrida deixou de ser hipótese

`request_unban` fazia `IF EXISTS ... INSERT`, sem nada atômico no meio. Não
precisei reproduzir concorrência: um **índice único parcial** torna dois
pendentes para o mesmo alvo **impossíveis**. Trava de 1ª força.

### N25 e N27 quase viraram PASS sem teste

Na primeira tentativa a nomeação nem chegou a ser criada (o candidato não tinha
elegibilidade), e os *"Indicação não encontrada"* seguintes eram **artefato do
meu teste**, não prova de proteção. O achado é sobre a **decisão**, então a
linha passou a ser inserida direto e as funções de decisão foram exercidas de
verdade.

### `exige_alvo_apto` só roda no caminho que AVANÇA

`reject`, `revert` e `extend` não revalidam **de propósito**: negar a indicação
de alguém que foi banido no meio precisa continuar possível, senão a fila trava
com itens que ninguém consegue encerrar.

Travas: `decisaoRevalidaEstado.test.js` (10 asserções) e a exceção documentada
de `exige_alvo_apto` em `autorizacaoAntesDeExistencia.test.js` — ela não é porta
de entrada (`EXECUTE` revogado), então não é oráculo de enumeração.

---

## `[19/09]` SEC-046 a SEC-049 — o que eu achei sozinho, fora da lista

### SEC-046 — o N3 estava fechado para ESPAÇO e aberto para UNICODE

O levantamento deu N3 (*"campos vazios geravam XP"*) como **PASS**, e o teste
dele estava certo — o alcance é que era menor do que parecia:

> `trim()` do PostgreSQL remove **branco ASCII**. Só isso.

| | |
|---|---|
| `length(trim('   '))` | **0** ← o que foi testado |
| `length(trim(U+200B))` | **1** ← ZERO WIDTH SPACE |
| `length(trim(U+00A0))` | **1** ← NO-BREAK SPACE |
| `length(trim(U+FEFF))` | **1** ← BOM |

**Exploração medida:** colando invisível em bio/avatar/discord/twitch/youtube,
`profile_bonus` foi de **0 → 125**. Com `platform` o teto seria 140 — o bônus
inteiro, **sem nada aparecer na tela**. E XP alimenta o
`check_staff_eligibility` (≥ 1000 vira admin).

🟠 **ALTO**: explorável por qualquer conta, sem ferramenta — copiar e colar.

`texto_visivel()` responde a pergunta certa e fica em **um** lugar; antes a
regra estava repetida seis vezes na view.

### SEC-047 — o CI era o único workflow sem `permissions`

Cinco dos seis workflows declaram o privilégio do `GITHUB_TOKEN`. O `ci.yml`,
justamente o que roda código vindo de PR, não declarava.

**Não é vulnerabilidade confirmada, e não vou vender como tal:**

| Cenário | Por quê |
|---|---|
| PR de **fork** | o gatilho é `pull_request` (não `pull_request_target`) → o GitHub **não entrega secret** e o token já vem somente-leitura |
| PR de **colaborador** | os secrets existem, mas quem tem escrita já podia exfiltrá-los. Não é escalada |

O que fecha é defesa em profundidade e a **inconsistência**. Nenhum job precisa
de escrita — o resumo do PR usa `GITHUB_STEP_SUMMARY`, que não passa por token.
Junto: `persist-credentials: false` nos 6 checkouts.

### SEC-048 — os handles que viram `href`, e a senha errada que era muda

`discord`, `twitch` e `youtube` são interpolados em `href` e **não tinham
CHECK nenhum**. Não é redirecionamento aberto (o host é literal) — o que dava
para fazer era `bio` de 5.000 caracteres viajando em todo carregamento de
perfil, e link torto na tela.

> **Lista branca, não lista negra.** A primeira versão barrava `@fulano`, que é
> handle **legítimo** do YouTube — minha própria regressão pegou.

E `delete_own_account`: a análise estrutural mostrou tudo certo (auth.uid
obrigatório, bcrypt, `a_senha_confere` sem `EXECUTE`, log antes de apagar), mas
**sem limite de tentativa e sem rastro**. Não inventei um teto (é decisão de
produto): a tentativa errada passou a **gritar** em `admin_logs`.

> **O teste dinâmico de senha errada NÃO foi executado** — foi bloqueado pela
> ferramenta. O que existe é análise estrutural, e digo isso com todas as
> letras.

### SEC-049 — um auditor que pergunta ao BANCO

A SEC-043 guardava uma **lista de 25 nomes escrita à mão**, e eu registrei o
risco residual no próprio PR. **Registrar o risco não é fechar o risco.**

`auditoria_de_operadores()` pergunta ao Postgres quais funções administrativas
ficaram sem guarda. Na **primeira execução** achou duas — **as duas minhas**:

| | |
|---|---|
| `request_unban` | eu esqueci na lista da SEC-043 (pus a irmã `request_role_demotion` e não pus ela) |
| `texto_visivel` | nasceu alcançável por `anon` — o padrão que **eu mesmo documentei** na SEC-042, repetido 20 minutos depois |

Uso: `SELECT * FROM auditoria_de_operadores();` — zero linhas = superfície
limpa. Fica fora do CI pelo mesmo motivo do `npm run edges`: consultar
`pg_proc` exige credencial de banco.

---

## `[24/09]` SEC-050 — o auditor existia, e ninguém conseguia ouvi-lo

A `auditoria_de_operadores()` foi criada na SEC-049 e faz **três** checagens de
classe: RPC administrativa sem `exige_operador_ativo()` (SEC-043), função de
trigger chamável como RPC (SEC-042), e função alcançável por `anon` fora da
lista branca.

**Ela tinha `EXECUTE` revogado de `anon` e de `authenticated`.** Rodava só
quando eu a chamava à mão pelo MCP. Auditor que depende de alguém lembrar de
perguntar é a mesma classe do §1.5: a informação existe e não chega a lugar
nenhum.

### O mensageiro devolve NÚMERO, nunca nome

| Função | Devolve | Quem alcança |
| --- | --- | --- |
| `auditoria_de_operadores()` | os **nomes** | ninguém — só `postgres` |
| `contagem_de_achados_de_seguranca()` | um **inteiro** | `anon` e `authenticated` |

Abrir o auditor direto entregaria, para qualquer um na internet, a lista das
funções fracas do site — um mapa de onde bater. **O que o mensageiro expõe,
dito com todas as letras:** um inteiro que vale 0 quando está tudo certo. Quem
chamar de fora aprende *"existem N problemas"*, nunca quais.

**Por que pelo `anon` e não por credencial de banco no CI.** Já existe
precedente que funciona: o portão `espelho-de-migrations` chama
`contagem_de_migrations()` com a anon key. Pôr `service_role` no CI seria trocar
incerteza de monitoramento por credencial exposta.

### Isto é DETECÇÃO, não prevenção — e a diferença foi medida

A prevenção na raiz seria fechar o `pg_default_acl` para que função nova
nascesse fechada. Medido em 24/09, em `ROLLBACK`:

| Tentativa | Resultado |
| --- | --- |
| `ALTER DEFAULT PRIVILEGES FOR ROLE postgres … REVOKE … FROM anon` | pega, mas é insuficiente |
| a função nova continua aberta | ela nasce com `=X/postgres` — **PUBLIC** tem `EXECUTE` |
| `… REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` | **não pega** — o ACL volta inalterado |
| `… FOR ROLE supabase_admin …` | **`permission denied to change default privileges`** |

Existem **dois** `pg_default_acl` de função em `public`, e o do `supabase_admin`
é intocável com a credencial que eu tenho. Então função nova **continua
nascendo alcançável pelo `anon`** — a diferença é que agora o CI reprova no
mesmo dia, em vez de a brecha viver até alguém perguntar.

> **O estado de hoje:** das 100 funções em `public`, **3** são alcançadas pelo
> `anon`, e as três têm motivo escrito na lista branca do auditor. A
> `contagem_de_migrations` é uma delas porque **o próprio portão do CI a chama
> com a anon key** — conferido no script, não suposto. Revogá-la quebraria o CI.

Trava: `src/lib/__tests__/auditorDoBancoEhOuvido.test.js`, provada com 4
reinjeções — e a **segunda delas achou um defeito meu**: a asserção original
procurava o `REVOKE` em todas as migrations juntas e passava mesmo com um
`GRANT` novo, porque encontrava o `REVOKE` da SEC-049. Era decoração. Hoje ela
olha o **último** movimento de privilégio, não a existência de um bom em algum
lugar do histórico.

---

## `[25/09]` SEC-053 — o BANIMENTO não alcançava as policies

🟠 **Alto.** Explorável por quem tem conta, e o alvo é a própria ferramenta que
existe para conter um moderador que se voltou contra o site.

### O que um admin BANIDO ainda conseguia fazer

Medido em `ROLLBACK`, com papel `authenticated` real e `banned = true`:

| | admin banido, ANTES | usuário comum | admin banido, DEPOIS |
| --- | --- | --- | --- |
| lê a fila de moderação | **20 itens** | 0 | 0 |
| lê a trilha de auditoria | **4.102 linhas** | 0 | 0 |
| lê denúncias | **2** | 0 | 0 |
| lê avisos da equipe | **207** | 0 | 0 |
| **escreve na wordlist** | **conseguiu** | bloqueado | bloqueado |
| mexe na fila | **20 linhas** | 0 linhas | 0 linhas |
| vê post oculto/apagado | **16** | 0 | 0 |
| vê comentário oculto | **14** | 0 | 0 |

Depois da correção o banido é **idêntico a um usuário comum** — rebaixado, não
trancado. O admin **ativo** e o **owner** continuam com tudo, e isso foi medido
na mesma transação: é a regressão que já derrubou o site três vezes.

### A causa

`is_staff()` e `is_super()` **já embutem** `operador_ativo()`:

```sql
is_staff()  =  role_rank(...) >= 2  AND  operador_ativo()
```

23 policies reimplementavam só a **primeira metade** à mão — `role_rank(...) >=
2`, ou `ARRAY['admin','super_admin','owner']` — e perdiam a segunda.

O `POSTURA.md` já dizia *"hierarquia nunca se escreve à mão"*, e a razão
registrada lá era outra: esquecer o `owner`, três vezes. **Esta é a terceira
razão, e é pior** — não falta um cargo, falta a pergunta *"quem chama ainda
está apto?"*.

### Por que isso não era teórico

`ban_user` **não revoga sessão**. Ele escreve `banned = true` em `profiles` e
mais nada — conferido no corpo da função. O token que o moderador já tem
continua válido e o refresh continua funcionando, porque o GoTrue não conhece
`profiles`. Não há janela curta: há acesso contínuo, pela REST API, sem passar
pela tela.

### O padrão de fundo: a mesma regra, aplicada pela metade

A SEC-043 (19/09) fez exatamente esta correção — nas **RPCs**. As policies
ficaram para trás, e nada apontou isso por seis dias porque **o auditor do banco
não olhava policy**: as cinco checagens dele liam função e tabela.

Auditor que não olha uma superfície não fica só incompleto — ele **imprime zero
sobre ela**, que é pior, porque ensina a confiar num sinal que não sustenta nada.

### A trava

6ª checagem em `auditoria_de_operadores()`, ouvida pelo CI via
`contagem_de_achados_de_seguranca()`. Provada reinjetando: devolver **uma**
policy ao padrão antigo leva a contagem de 0 a 1, nomeando
`moderation_queue.modq_select`.

### O que ficou de fora, e por quê

- **As três policies de `site_config`** usam `role = 'owner'` literal. Eu cheguei
  a trocá-las por `is_owner()` e **desfiz no mesmo dia**: a SEC-051 já registrou
  essa troca como decisão de semântica do dono (`is_owner()` é `rank >= 4`; o
  literal é `= 'owner'`), e fazer em silêncio o oposto do que este documento diz
  seria envelhecê-lo por dentro. Estão isentas com o motivo, e a decisão está no
  `BACKLOG.md` junto com as cinco funções.
- **`blocked_words_select` continua `USING (true)`.** Fechá-la apagaria o aviso
  que o compositor dá antes de enviar — quatro telas leem a lista pelo cliente.
  É decisão de produto, no `BACKLOG.md` com as três saídas.

### E a trava do próprio auditor estava CEGA há um PR

Ao cobrir a 6ª checagem, descobri que `auditorDoBancoEhOuvido.test.js` procurava
o corpo do auditor por `$fn$` literal. A SEC-052 passou a escrevê-lo com
`$function$` — e desde aquele PR a trava vinha conferindo a versão da **SEC-051**,
verde e confiante, olhando um retrato velho.

Hoje ela captura o rótulo do dólar, qualquer que seja, **e confere o número de
definições que enxerga contra o número de arquivos que definem a função**. Se
uma voltar a ficar invisível, a contagem não bate e ela reprova em vez de ler a
penúltima em silêncio.

---

## `[24/09]` SEC-051 — o auditor não via autorização escrita por LITERAL

Saiu da **parte 1 da auditoria profunda**: o pedido era transformar em regressão
os quatro `400 Acesso negado` que o dono reproduziu adulterando o `role` no
DevTools. Ao conferir as quatro funções, uma delas não usava `role_rank`,
`is_staff`, `is_super` nem `is_owner`:

```sql
-- owner_get_stats
IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
```

**Isso não é vulnerabilidade** — o efeito é correto, só o fundador passa. É a
*forma* que o `POSTURA.md` proíbe, e que já causou três falhas aqui.

### O que importa é que era um ponto cego do próprio auditor

A heurística da SEC-049 procura `role_rank|is_staff|is_super|is_owner` para
decidir *"isto é administrativo"*. Função que autoriza por literal **não casa
com nenhum deles** — logo era invisível para as três checagens.

Eu havia registrado esse risco residual no `BACKLOG.md` **na mesma manhã**:
*"uma RPC administrativa que decidisse permissão por outro caminho não seria
vista"*. A varredura de classe achou **seis**.

| Função | O que é |
| --- | --- |
| `operador_ativo` | a própria maquinaria da guarda — compara papel por desenho |
| `owner_get_stats` · `owner_get_users` · `owner_get_metrics` · `owner_get_audit_logs` · `owner_get_notifications` | o painel do **próprio** fundador |

### Por que as cinco NÃO foram consertadas aqui

Duas razões, e as duas dizem para não agir sozinho:

1. **A troca por `is_owner()` não é mecânica.** `is_owner()` é
   `role_rank(...) >= 4`; o literal é `= 'owner'`. Hoje dão o mesmo resultado,
   mas um cargo futuro de rank 5 passaria num e não no outro. É decisão de
   semântica — §7 🟡.
2. **Pôr `exige_operador_ativo()` nelas seria pior.** Ninguém consegue banir o
   fundador: `ban_user` e `apply_suspension` têm hierarquia estrita e ele é o
   topo. Guardar a leitura do painel dele criaria o risco de **trancá-lo fora do
   próprio painel, sem inversa** — a classe do erro da `apply_suspension` sem
   `lift_suspension`.

As duas estão propostas no `BACKLOG.md`. Até lá os nomes ficam na lista de
exceção **com o motivo escrito na migration**, e a trava
`auditorDoBancoEhOuvido.test.js` reprova se a lista crescer em silêncio.

**O que muda de verdade:** função **nova** que autorize por literal passa a ser
vista. O ponto cego fecha para o futuro, que é onde ele doía.

---

## `[24/09]` A CSP entrou — e o que destravou foi medir, não coragem

O item ficou aberto desde 19/09 com um motivo honesto: **CSP errada derruba o
site**. React+Vite gera estilo inline, e Supabase, Sentry, Google Fonts e os
embeds de live precisam estar liberados por nome; um `default-src` apertado
demais apaga a tela inteira — a classe do erro do SEC-025.

A resposta certa não era evitar. Era **medir num navegador de verdade antes de
publicar**.

### A política

| Diretiva | Valor | Por quê |
| --- | --- | --- |
| `script-src` | `'self'` | **é a que importa.** Nenhum script externo, nenhum inline |
| `frame-src` | youtube · youtube-nocookie · player.twitch · clips.twitch | as três origens que o `EmbedPlayer` realmente usa — lidas no código |
| `connect-src` | `'self'` · `*.supabase.co` · `wss://*.supabase.co` · sentry · vitals | REST, realtime, erro e métrica |
| `style-src` | `'self' 'unsafe-inline'` + fonts.googleapis | o `unsafe-inline` é obrigatório: React e Framer Motion escrevem estilo inline |
| `img-src` / `media-src` | `'self' data: blob: https:` | o `avatar_url` do usuário é uma URL arbitrária; apertar aqui quebraria foto de perfil |
| `base-uri` · `object-src` · `frame-ancestors` · `form-action` | `'self'` / `'none'` | fecham sequestro de base, plugin, clickjacking e post para fora |

### Como foi verificada — e o controle sem o qual a medição mentiria

`e2e/politica-de-conteudo.mjs` sobe o `dist` com a política **lida do
`vercel.json`** e carrega 6 rotas públicas num Chromium. Resultado: **0
violações, 0 erros de página**.

Rota pública não exercita `frame-src` nem `connect-src`, então ele **sonda as
duas**: cria um iframe para cada origem de embed e dispara `fetch` para as
origens permitidas.

> **A armadilha que quase me pegou.** Na primeira execução o `fetch` para o
> Supabase falhou com `Failed to fetch` e **zero violações de CSP**. Concluir
> *"a CSP bloqueou"* teria sido inferência vestida de fato (§1.1) — o ambiente
> não tem saída de rede na página.
>
> Por isso existe o **controle**: uma origem que a política proíbe de verdade.
> Ela falha **com** violação no console; as outras falharam **sem**. A diferença
> é a prova de que o que barrou as outras foi a rede, não a política.

### O que ela NÃO cobre

**Rota autenticada.** O roteiro não faz login, então feed, lives, perfil e
painel não passam por ele. O risco é baixo e nomeável: essas telas não
introduzem origem nova — usam o mesmo Supabase e os mesmos embeds que a sonda já
cobre. Domínio novo tem de ser somado ali.

Provado reinjetando **quatro** políticas quebradas: youtube fora do `frame-src`,
`script-src 'none'`, `style-src` sem `unsafe-inline`, e a CSP apagada do
`vercel.json`.

> **Este roteiro errou DUAS vezes antes de ficar de pé, e as duas foram o mesmo
> engano meu: usar "carregou?" como evidência.**
>
> | Versão | O que eu media | Como quebrou |
> | --- | --- | --- |
> | 1ª | `iframe.contentWindow` | continua **verdadeiro** num frame barrado — ele aponta para `about:blank`. Reinjetar "youtube fora do `frame-src`" passou **verde** |
> | 2ª | `contentWindow` **ou** violação no console | o CI reprovou com o Twitch "bloqueado" — lá a rede **não alcança** twitch.tv, e o iframe não carrega **por rede** |
> | 3ª | só a violação no console | o CI **reprovou de novo**: `page.on('console')` recebe mensagem dos **iframes** também, e a Twitch tem CSP própria. No runner o embed carrega de verdade, e as mensagens **dela** chegavam como se fossem nossas |
> | 4ª | idem, filtrando por origem da mensagem | **reprovou ainda assim** — e aqui a recusa era *verdadeira*: com rede, `player.twitch.tv/?channel=x` **redireciona**, e a CSP se aplica ao destino. A sonda estava testando o comportamento da **Twitch**, não a nossa política |
>
> **A saída foi separar duas perguntas que eu estava misturando:**
>
> | Pergunta | Como se responde |
> | --- | --- |
> | a política **lista** as origens do `EmbedPlayer`? | **estático** — lê a CSP do `vercel.json`. Não depende de terceiro, e CI e local concordam sempre |
> | o navegador **cumpre** a política? | **navegador** — o controle, com uma origem que não está na lista |
>
> Estático prova o **conteúdo**; o controle prova o **cumprimento**. Nenhum dos
> dois depende de a Twitch estar no ar.
>
> As quatro versões erraram pelo mesmo motivo de fundo: **eu aceitei um sinal
> barato no lugar da evidência certa**, e três vezes esse sinal dependia de um
> terceiro responder. Vale registrar porque a mesma tentação vai aparecer na
> próxima trava que dependa de navegador.
>
> As três versões erraram pelo mesmo motivo de fundo: **eu aceitei um sinal
> barato no lugar da evidência certa.** Vale registrar porque a mesma tentação
> vai aparecer na próxima trava que dependa de navegador.
