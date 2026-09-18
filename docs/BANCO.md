# Banco de dados

> Tabelas, funções, RLS, storage e realtime. Para as regras de **como** mexer
> no banco com segurança (testar em `ROLLBACK`, faixa de entrada em RPC,
> inversa de toda ação), ver o `CLAUDE.md` §5.

## 🗄️ Banco de dados

Postgres no Supabase (`project_id: yuqbdcoljlvncxdnesxk`). **RLS habilitado em
todas as tabelas públicas.**

### Tabelas

| Tabela                       | Descrição                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| `profiles`                   | Perfil do usuário (1:1 com `auth.users`): username, avatar, bio, role, banimento, redes, preferências. **`[12/09]` `role` e `banned` são `NOT NULL`** — o `CHECK` de `role` sozinho não bastava, porque `NULL = ANY(ARRAY[...])` é NULL e constraint só reprova em `false` explícito (SEC-017) |
| `posts`                      | Posts do feed e lives (texto, mídia legada, áudio, embed, flags de live, `live_kind`, `live_kind_label`) |
| `post_media`                 | Mídias de um post (imagem/vídeo/áudio, posição)                  |
| `post_likes`                 | Likes de posts (único por `post_id+user_id`)                     |
| `comments`                   | Comentários de posts; `parent_id` self-FK para replies em thread |
| `comment_likes`              | Likes em comentários (único por `comment_id+user_id`)            |
| `community_posts`            | Mensagens do mural da comunidade (texto, imagem, reações)        |
| `community_post_likes`       | Likes do mural (único por `post_id+user_id`) — o espelho de `post_likes` |
| `community_post_media`       | Mídias de uma mensagem do mural (url, tipo, posição) — o espelho de `post_media` |
| `notifications`              | Notificações ao usuário (like/comentário/reply)                  |
| `game_keys`                  | Keys e promoções de jogos                                        |
| `live_chat`                  | Mensagens do chat das lives                                      |
| `live_chat_timeouts`         | Silenciamentos de chat (com expiração)                           |
| `live_muted`                 | Silenciamentos (registro complementar)                           |
| `live_reactivation_requests` | Fila de reativação de lives (admin → super admin)                |
| `unban_requests`             | Fila de desbanimento (admin → super admin/owner)                 |
| `staff_nominations`          | Indicação de alguém para a equipe: candidato, quem indicou, cargo pretendido, `eligibility_snapshot` (o retrato dos critérios no dia), período de estágio (`trial_started_at`, `trial_review_date`) e a decisão final |
| `role_change_requests`       | Pedido de mudança de cargo de quem **já** é da equipe: cargo anterior, proposto, motivo e revisão. Separada de `staff_nominations` porque promover quem já entrou não tem estágio |
| `policy_acceptances`         | **A prova do aceite** das políticas: quem, qual documento, qual versão, quando. Append-only por desenho — sem policy de UPDATE nem DELETE, porque registro de consentimento que pode ser reescrito não prova nada. `ON DELETE CASCADE` é a exceção deliberada: a política promete que apagar a conta apaga os dados |
| `contact_messages`           | Mensagens do formulário público `/contato`. **Sem policy de INSERT de propósito** — a única porta é a RPC `enviar_mensagem_de_contato`, e desde `[03/09]` ela também não é mais chamável por `anon` (o captcha). Só `is_staff()` lê e atualiza. `reply_text` guarda o que a equipe respondeu |
| `login_attempts`             | Tentativas de login por e-mail (bloqueio) — sem acesso direto    |
| `admin_logs`                 | Trilha de auditoria                                              |
| `admin_notifications`        | Notificações para admins                                         |
| `admin_notification_reads`   | Marcação de lidas por admin                                      |
| `site_config`                | Configuração global (manutenção, flags, banner, thresholds de moderação) |
| `reports`                    | Denúncias da comunidade. Índice único **parcial**: uma pendente por pessoa e conteúdo — depois de dispensada, dá para denunciar de novo |
| `blocked_words`              | Wordlist de palavras bloqueadas (com severidade)                |
| `violations`                | Infrações confirmadas por moderador (ação, pontos, revisor). **`[12/09]` `points` tem `CHECK 0..10`** (o teto do `ACTION_POINTS` do painel) e a policy de INSERT usa `can_moderate_content(user_id)` — registrar infração é ato de moderação e respeita a hierarquia (SEC-020) |
| `moderation_queue`           | Fila de revisão humana. `trigger_type`: `report`, `wordlist`, `ai`, `escalation`, `links` e — desde 29/08 — `sem_analise`, que significa o oposto dos outros: nenhuma checagem conseguiu olhar o conteúdo |

#### Colunas relevantes em `posts`

| Coluna          | Tipo   | Descrição                                                        |
| --------------- | ------ | ---------------------------------------------------------------- |
| `is_live`       | bool   | Post é uma live ativa                                            |
| `embed_url`     | text   | URL do embed (YouTube/Twitch)                                    |
| `embed_type`    | text   | `'twitch'` ou `'youtube'`                                        |
| `expires_at`    | tstz   | Quando a live expira (encerramento automático)                   |
| `live_kind`     | text   | Tipo de live de jogador: `'gameplay'`, `'react'`, `'outro'`      |
| `live_kind_label` | text | Label livre quando `live_kind = 'outro'` (obrigatório nesse caso) |

Constraints: `CHECK (live_kind IN ('gameplay','react','outro'))` e
`CHECK (live_kind IS DISTINCT FROM 'outro' OR live_kind_label IS NOT NULL)`.

#### Colunas relevantes em `comments`

| Coluna      | Tipo | Descrição                                                        |
| ----------- | ---- | ---------------------------------------------------------------- |
| `parent_id` | uuid | FK self-referencial para comentário pai (NULL = raiz)            |

#### Coluna `hidden_at` (moderação)

`posts`, `comments` e `community_posts` têm `hidden_at timestamptz` (NULL =
visível). Quando preenchida, o conteúdo fica oculto para não-admins via RLS
(soft-hide reversível). Preenchida pelo trigger de denúncias ou manualmente por
um admin; restaurar é só voltar a `NULL`.

#### Coluna `suspended_until` em `profiles` (moderação)

`suspended_until timestamptz` (NULL = não suspenso). Quando `> now()`, o usuário
não cria conteúdo (post/comentário/mural/chat) — imposto pelos `WITH CHECK` de
INSERT. Protegida no `guard_profile_privileged_cols`. Setada por `apply_suspension`.

### ⚠️ `[02/09]` "Negado" se escreve de DUAS formas neste banco

Levantado com `pg_constraint` depois de um bug real, e é a armadilha mais fácil
de cair aqui:

| Tabela | O valor de "negado" |
| --- | --- |
| `unban_requests` | **`denied`** |
| `live_reactivation_requests` | **`denied`** |
| `moderation_queue` | `rejected` |
| `role_change_requests` | `rejected` |
| `staff_nominations` | `rejected` |

**O bug que isso já causou:** a `BannedScreen` testava `rejected` para
`unban_requests`. Nunca batia — quem teve o recurso negado via *"Em análise"*
para sempre, e nada acusava. Quem escreveu tinha visto `rejected` três vezes no
mesmo código.

**Por que NÃO foram unificados:** seria migration em cinco tabelas, com
`UPDATE` em linhas existentes e mudança em toda RPC e tela que as lê — risco
real por ganho zero para quem usa o site. A decisão está em
[DECISOES.md](DECISOES.md).

**O que fazer no lugar:** ao renderizar um status, mapa explícito conferido por
teste, como em `lib/etapasDoCaso.js`. Ternário terminando em `else` é o que
transforma esta pegadinha em bug silencioso (§4).

### Funções (RPCs / triggers)

**Chamadas pelo front (RPC):**

- Auth/segurança: `record_banned_login_attempt`, `delete_own_account(p_senha)`.

  > **`[17/09]` Esta linha listava mais duas, e as duas eram mentira** — não por
  > terem sido apagadas, mas porque o frontend **parou de chamá-las** e a lista
  > ficou. Conferido por `grep` em `src/`: zero chamadas.
  >
  > `check_login_status` foi revogada hoje (SEC-022). `reset_login_attempts`
  > continua no ar e continua sem chamador — proposta de revogação no
  > `BACKLOG.md`.
  >
  > O título da seção é **"Chamadas pelo front"**. Uma função que ninguém chama
  > não pertence a ela, e deixá-la aqui é o que faz alguém procurar no código
  > uma chamada que não existe.

  > **`[12/09]` `delete_own_account` passou a EXIGIR a senha** (SEC-012). Ela era
  > uma linha — `DELETE FROM auth.users WHERE id = auth.uid()` — protegida só por
  > dois `ConfirmModal`, que é validação de cliente e não vale nada contra quem
  > chama a REST direto. A versão sem argumento **foi apagada**: deixá-la no ar
  > manteria a porta aberta ao lado da nova.
  >
  > A senha é conferida por `a_senha_confere`, um auxiliar **interno**
  > (`REVOKE` de `anon` e `authenticated`) que o `confere_a_propria_senha` do
  > cofre também passou a usar — uma implementação só do `crypt` (§4). A trilha
  > é gravada **antes** do `DELETE`, porque depois dele o ator não existe mais.
- Ban: `ban_user`, `unban_user`, `request_unban`, `approve_unban_request`,
  `deny_unban_request`, `admin_unlock_login`, `get_blocked_logins`.
- Recurso do próprio banido: `solicitar_revisao_do_proprio_ban` (um pedido por
  banimento, 20 a 1000 caracteres) e `meu_pedido_de_revisao` (o andamento).
- Contato público `[02/09]`: `enviar_mensagem_de_contato(p_nome, p_email,
  p_assunto, p_mensagem)`. É a **única** porta de entrada de
  `contact_messages`, chamável por `anon`, e carrega sozinha toda a validação:
  faixas de tamanho, lista fechada de assunto, teto de 3 por e-mail em 24 h e
  disjuntor de 60/hora. Os dois limites de vazão devolvem a **mesma** frase, de
  propósito — mensagens diferentes fariam dela um oráculo de enumeração. O
  alarme de enchente mora no trigger `alertar_enchente_de_contato`, e **não**
  dentro da RPC: um `RAISE EXCEPTION` desfaz o `INSERT` de log feito antes
  dele, e a primeira versão gravava um alarme que nunca commitava. Ver
  [`db/2026-09-02-canal-de-contato.md`](../db/2026-09-02-canal-de-contato.md).

  > **`[03/09]` Ela deixou de ser chamável por `anon`.** O captcha (Turnstile)
  > só vale porque a única porta agora é a Edge Function `verify-contact`, que
  > confere o token e chama a RPC com `service_role` — com `anon` alcançando a
  > RPC, bastava um POST direto em `/rest/v1/rpc/` para pular a verificação. O
  > `author_id` passou a ser parâmetro (`p_author_id`) porque `auth.uid()` é
  > nulo quando quem chama é a função. Ver
  > [SEGURANCA.md](SEGURANCA.md).

- Resposta ao contato `[03/09]`: `contato_dados_para_resposta(p_id)` e
  `contato_registrar_resposta(p_id, p_texto)`, as duas `SECURITY DEFINER` com
  `is_staff()` **por dentro** — a Edge Function `responder-contato` as chama com
  a credencial de quem pediu, então uma checagem que morasse só nela seria porta
  decorativa (§1.3). A ordem entre elas é o ponto: o e-mail sai **entre** as
  duas. Registrar antes de enviar reproduziria o defeito que isto conserta — o
  painel dizendo "respondida" com o envio tendo falhado. `reply_text` guarda o
  texto (10 a 4000, com `CHECK`), porque status sem conteúdo é carimbo, não
  histórico.

> **Correção `[29/08]`:** esta lista citava `register_login_attempt`, e a função
> **não existe mais** — conferido no `pg_proc`, não deduzido. Ela era chamada
> pelo *frontend* para reportar a própria falha de login: força bruta real nunca
> era contada (quem ataca não usa o nosso site), e qualquer um podia chamá-la
> com o email de outra pessoa para **bloquear a conta sem saber a senha**.
>
> Este mesmo fantasma apareceu em **quatro** documentos diferentes. Ao remover
> uma função, `grep -rn` no `docs/` inteiro faz parte do trabalho.
- XP: `get_user_xp`. **`[05/09]` As curtidas vêm de `post_likes`, não da coluna
  `posts.likes`** — essa coluna **não existe mais** (apagada em 05/09): nunca
  foi mantida por trigger nenhum, a soma dava 0 para todo mundo, e a presença
  dela no schema fez três lugares diferentes escreverem `SUM(likes)` ao longo do
  tempo. A auto-curtida não conta.
  **Executável só por `authenticated`** desde 05/09: `anon` e `PUBLIC` saíram,
  porque nenhum caminho anônimo a chamava e ela é cálculo (quatro `COUNT`) sem
  sessão. Ver [SEGURANCA.md](SEGURANCA.md).
- Auditoria: `log_audit_event`.
- Owner: `owner_get_stats`, `owner_get_users`, `owner_get_audit_logs`,
  `owner_get_notifications`, `owner_get_metrics`, `owner_set_role`,
  `owner_set_site_config`.
- Cargos: `admin_set_role` (fluxo de indicação), funções de avaliação/
  rebaixamento; override de emergência exclusivo do owner.

**Triggers:**

- `handle_new_user` / `handle_user_confirmed` (em `auth.users`) — cria perfil.
  `[11/09]` O `handle_new_user` passou a gravar **também o aceite dos
  documentos**, lendo `raw_user_meta_data->'aceites'`. Motivo: logo após o
  `signUp` não há sessão, então o cliente é `anon` e a RLS de
  `policy_acceptances` recusa a escrita — todo cadastro novo ficava sem a prova
  do consentimento. Entrada inválida é pulada (nunca derruba o cadastro), e cada
  item é validado contra os dois `CHECK` da tabela antes de entrar. Ver
  [PRIVACIDADE.md](PRIVACIDADE.md).
- `guard_profile_privileged_cols` (profiles UPDATE) — impede auto-promoção de
  role/auto-desban direto via UPDATE na tabela.
- `notify_admin_new_user` (profiles INSERT) — notifica admins.
- `notify_admin_new_live`, `set_live_ended_at`, `log_post_event` (posts).
- `notify_post_like` (post_likes INSERT) — notificação de like (SECURITY DEFINER).
- `notify_post_comment` (comments INSERT) — notificação de comentário e reply
  (SECURITY DEFINER, distingue raiz vs. resposta).
- `notify_comment_like` (comment_likes INSERT) — notificação de like em
  comentário (SECURITY DEFINER).
- `notify_admin_reactivation_request` (live_reactivation_requests INSERT).
- `handle_report_auto_hide` (reports INSERT, SECURITY DEFINER) — ao atingir
  `mod_report_threshold` denúncias, oculta o conteúdo (`hidden_at`) e enfileira
  em `moderation_queue`.
- `handle_violation_escalation` (violations INSERT, SECURITY DEFINER) — soma os
  pontos do usuário e chama `apply_mod_auto_ban` ao atingir `mod_ban_threshold`.
- `apply_mod_auto_ban(user_id, points)` (SECURITY DEFINER) — ban automático pelo
  sistema (sem caller role): marca `banned`, apaga a atividade, gera log +
  notificação. **`[12/09]` Ela NUNCA alcança a equipe** (`role_rank(alvo) >= 2`):
  staff só é punido por decisão humana com hierarquia, e o desvio vai para
  `admin_logs` como `auto_ban_barrado` em vez de um `RETURN` mudo. Sem esse
  piso, uma linha em `violations` banía o fundador — ver SEC-020 em
  [SEGURANCA.md](SEGURANCA.md).
- `apply_suspension(user_id, days)` (SECURITY DEFINER) — suspende temporariamente
  (valida hierarquia, seta `suspended_until`, gera log + notificação).

Quase todas as funções de mutação sensível são `SECURITY DEFINER` com
`search_path` fixo e **checagem de role explícita via `auth.uid()`**. Helpers:
- `role_rank(text)` — ranqueia os cargos (user 1 → owner 4). **Papel
  desconhecido ou NULL vira 0**, abaixo de `user` — e isso não é descuido do
  `ELSE`: é o que torna toda a família abaixo NULL-safe, porque o piso nega.
- `is_staff()` (rank ≥ 2) · `is_super()` (rank ≥ 3) · **`is_owner()`** (rank ≥ 4,
  `[12/09]`). São a forma correta de perguntar por cargo, e **o motivo é
  mecânico, não estilo**: `v_caller_role NOT IN ('super_admin','owner')` não
  barra nada quando o papel é NULL, porque `NULL NOT IN (...)` é NULL e o `IF`
  não dispara. Cinco funções tinham esse buraco (SEC-016/018 em
  [SEGURANCA.md](SEGURANCA.md)).

  Quando o sentido for **exatamente um cargo** e não "aquele ou acima" — é o
  caso do `nominate_staff`, onde o owner é o avaliador e por isso não indica —
  use `IS DISTINCT FROM`, que trata NULL como diferente. Nunca `<>` sozinho.
- `can_moderate_content(author_id)` — retorna `true` só se o rank do ator
  (`auth.uid()`) for **estritamente maior** que o do autor. Usado nas políticas
  RLS de DELETE de `posts`, `comments`, `community_posts` e `live_chat` pra
  impor a hierarquia: o autor sempre apaga o próprio conteúdo; admin modera só
  quem está abaixo (owner > super_admin > admin > user). Fecha o furo em que
  admin apagava conteúdo de super_admin/owner e em que o owner não conseguia
  moderar nada (e via "sucesso" falso, porque RLS bloqueado não é erro).

### Storage (buckets)

- **`avatars`** (público): avatar do usuário; upload/update/delete restritos ao
  dono pela pasta `auth.uid()/...`. `cacheControl: 31536000` (1 ano) — a troca
  de avatar continua aparecendo na hora porque a URL salva leva um
  cache-buster `?t=<timestamp>`.
- **`post-media`** (público): imagens/vídeos/áudios dos posts e do mural;
  upload por autenticados, delete pelo dono do arquivo (pasta = `auth.uid()`).
  `cacheControl: 31536000` (1 ano) — paths únicos por post/timestamp, nunca
  sobrescritos, cache longo seguro.
- **Limpeza ao deletar**: `deletePost` / `deleteMuralPost` removem os arquivos
  do Storage junto com o post (`lib/storage.js`, best-effort — a policy só
  permite apagar arquivo próprio, então post deletado por admin pode deixar
  órfão; aceitável e raro). Antes dessa limpeza, **nenhum** delete removia o
  arquivo — o bucket acumulou 330 MB de órfãos (zerados em 2026-06-12 via
  edge function `cleanup-orphans`, hoje um stub desativado).

- **Compressão no upload** (`lib/image.js`): toda imagem de post, mural e avatar
  é redimensionada e recomprimida no browser **antes** de subir (1600px /
  WebP com fallback JPEG; avatar em 256px). O arquivo gravado no bucket é o que
  o CDN serve a **cada** visualização, então cortar na origem é o maior ganho de
  banda que existe: uma foto de celular de ~4 MB vira ~200 KB. GIF e SVG passam
  intactos (canvas mataria a animação), e se a compressão falhar ou aumentar o
  arquivo, o original é usado — upload nunca quebra por causa da otimização.

> Os buckets são públicos para leitura via URL (CDN), mas **não** permitem
> *listar* arquivos — o acesso por URL pública continua funcionando.

### Realtime

**A publicação `supabase_realtime` tem estas 10 tabelas** — lido de
`pg_publication_tables` em 02/09, não da memória:

`admin_notifications` · `community_posts` · `live_chat` · `live_chat_timeouts` ·
`live_reactivation_requests` · `moderation_queue` · `posts` · `profiles` ·
`site_config` · `unban_requests`

Usada para feed, mural, chat de lives, detecção de ban, banner/manutenção,
as duas filas de recurso e a sincronização dos painéis.

> **`[02/09]` Esta lista estava errada em cinco das dez linhas**, e a correção
> importa mais do que a lista. Ela dizia que `post_media` e `admin_logs` eram
> publicadas — **não são** —, e não citava `live_reactivation_requests`,
> `moderation_queue` nem `unban_requests`, que **são**.
>
> As três que faltavam foram publicadas justamente para corrigir o bug da Fase 4
> registrado no `CLAUDE.md`: assinatura de realtime em tabela não publicada
> conecta, responde `SUBSCRIBED` e **nunca recebe evento**. O banco foi
> corrigido; este parágrafo não foi junto e ficou afirmando o estado antigo.
>
> **A trava que existe é `src/lib/realtimeTables.js`**, e ela confere o que
> importa: toda tabela **assinada pelo código** precisa estar publicada. O que
> ela não faz — nem deve — é conferir se este texto em português está certo.
> Documento não é executável; por isso a regra §1.4 manda ler o `pg_publication_tables`
> antes de afirmar, e não este parágrafo.

`useRealtime(table, cb, { events, filter })` aceita **quais** eventos assinar e
um filtro do lado do servidor. Isso importa em custo: cada mudança na tabela
vira uma mensagem para **cada** cliente conectado. Por isso:

- feed e mural assinam só `INSERT`/`DELETE` (o handler ignora `UPDATE`);
- o chat de live filtra por `post_id=eq.<live>` no `INSERT`/`UPDATE` — antes o
  cliente recebia o chat de **todas** as lives e descartava no JS. O `DELETE`
  fica sem filtro de propósito: no payload de delete só vem a PK, então um
  filtro por `post_id` nunca casaria e mensagem apagada por mod não sumiria da
  tela dos outros;
- a lista de lives filtra o `INSERT` por `is_live=eq.true` (antes qualquer post
  criado no site recarregava a lista de quem estava em `/lives`) e faz debounce.

### Custo de banda & carga de banco

O plano Free estourou a cota de **Cached Egress** em jun/2026, o que travou o
projeto. As decisões abaixo existem por causa disso e devem ser preservadas:

| Prática | Por quê |
| ------- | ------- |
| Compressão no upload (`lib/image.js`) | Tamanho no bucket = banda por visualização |
| `cacheControl` de 1 ano nos dois buckets | Evita revalidação horária no CDN |
| Vídeo com "toque para carregar" | `preload="metadata"` baixava pedaço de **todo** vídeo do feed |
| `LazyVisible` no carrossel | Mídia fora da viewport não gasta banda |
| Vídeo limitado a 10 MB (imagem 5 MB, áudio 20 MB) | Clipes longos vão por embed do YouTube/Twitch/TikTok |
| Contadores em lote no feed/mural | Ver "N+1" abaixo |
| Colunas explícitas no lugar de `SELECT *` | Payload menor em toda linha de todo feed |

**Fim do N+1 no feed/mural:** cada `PostCard` disparava 3 queries próprias
(contagem de likes, "eu curti?" e contagem de comentários) mais uma de mídia —
um feed de 30 posts fazia ~120 requests. Hoje o feed traz `post_media`
**aninhado no select** e resolve curtidas/comentários em **2 queries em lote**,
independentemente do tamanho da lista (mesma ideia no mural). Os cards mantêm o
fallback individual para onde o post chega solto (painel admin, moderação).

> ⚠️ **`[05/09]` A coluna `posts.likes` foi APAGADA.** Ela existia no schema sem
> trigger nenhum que a mantivesse — zerada desde sempre —, e foi justamente essa
> aparência de contador que fez **três lugares diferentes** somarem ela ao longo
> do tempo: `fetchProfileStats`, `owner_get_metrics` e `get_user_xp`. Era ela
> que fazia as curtidas do perfil e a XP aparecerem sempre 0.
>
> Não recrie o contador: conte de `post_likes`, que é a fonte de verdade.
> `xpNaoLeColunaMorta.test.js` reprova quem voltar a somar.

### `[10/09]` O autovacuum NÃO analisa tabela pequena — e `profiles` era uma

Achado da Fase 3 da auditoria, e apareceu porque um número era **impossível**:
`pg_stat_user_tables` dizia que `profiles` tinha **0 linhas**, e `profiles` tem
**5**. Conferido: `last_analyze` **e** `last_autoanalyze` eram **NULL** — a
tabela nunca tinha sido analisada desde que existe.

**Não é defeito do Postgres, é o limiar dele.** O autovacuum só analisa depois de
`autovacuum_analyze_threshold` (50) + 10% das linhas — com 5 linhas e pouca
escrita, `profiles` nunca chegou perto de disparar. O mesmo valia para
`notifications`, `reports` e mais sete.

**Por que importa nesta tabela mais do que em qualquer outra:** `profiles` é
lida em **toda policy de RLS** (`role_rank((SELECT role FROM profiles WHERE id =
auth.uid()))`). São **29.013 varreduras sequenciais** acumuladas nela. Com 5
linhas o plano seria o mesmo de qualquer jeito — o risco é o planejador seguir
acreditando em "0 linhas" **conforme o site crescer**, que é exatamente o tipo
de coisa que só dói quando já dói.

**O que foi feito:** `ANALYZE` em 10 tabelas. Não altera dado nenhum, só
estatística. `profiles` 0 → 5, `notifications` 0 → 21, `reports` 0 → 2.

> **Se o site crescer e uma consulta ficar lenta sem motivo aparente, olhe isto
> primeiro:** `select relname, n_live_tup, last_analyze, last_autoanalyze from
> pg_stat_user_tables where schemaname='public'`. Estatística mentindo faz o
> planejador escolher o plano errado, e nada nisso aparece como erro.

### React Query

Cache client-side via `@tanstack/react-query` (`lib/queryClient.js`):
`staleTime 30s`, `refetchOnWindowFocus false`, `retry 1`.

Migrados: `Keys`, `Ranks`, `Home`, `Community`, abas do Owner (`PainelTab`,
`MetricasTab`, `NotificacoesTab`, `LogsTab`, `UsuariosTab`), `Header`
(notificações), `Sidebar` (stats), `RightPanel` (keys/promos + stats).

Convenções:

- Queries cujo resultado depende de **quem** está vendo (feed e mural trazem
  "eu curti" no lote) levam o `user.id` na `queryKey` — senão o cache vazaria
  entre usuários.
- `Sidebar` e `RightPanel` mostram os mesmos três contadores do site e
  compartilham a chave `SITE_STATS_KEY` (`staleTime` de 5 min). Antes eram duas
  chaves diferentes = as mesmas 3 contagens feitas 2×.

---


---

[← voltar para o README](../README.md)

---

## `[18/09]` A VIEW `xp_dos_usuarios` — a fonte única do XP

Primeira **view** do schema, criada pela SEC-028 depois de o pentest de setembro
encontrar que existiam **três** fórmulas de XP independentes (`get_user_xp`,
`owner_get_users`, `owner_get_metrics`).

| | |
| --- | --- |
| **O que devolve** | por perfil: `posts`, `lives`, `likes`, `comentarios`, `profile_bonus` |
| **Quem lê** | as três RPCs `SECURITY DEFINER` acima. **Mais ninguém** |
| **Grant** | **nenhum**. Nem `anon`, nem `authenticated` |
| **A fórmula** | `posts*20 + lives*30 + likes*5 + comentarios*3 + profile_bonus` |
| **Bônus de perfil** | bio 50 · avatar 30 · platform 15 · discord 15 · twitch 15 · youtube 15 (teto 140) |

### Por que ela NÃO pode receber grant

Uma view roda com os direitos do **dono**, não de quem consulta
(`security_invoker` é `false` por padrão no Postgres). Ou seja: **ela atravessa
a RLS**. Exposta na REST API, entregaria o XP e a contagem de atividade de todo
mundo numa chamada só — e sem login, se o grant fosse para `anon`.

Isso é a régua de papéis desta pasta aplicada a um objeto novo: *o público
alcança **função**, nunca tabela nem view*. O `e2e/portas-do-banco.mjs` exige
`HTTP 401` nela, então a porta não reabre em silêncio.

### O que ela filtra, e por que isso É a correção

```sql
posts       WHERE deleted_at IS NULL AND hidden_at IS NULL
comments    WHERE c.hidden_at IS NULL AND po.deleted_at IS NULL AND po.hidden_at IS NULL
post_likes  -> só de post vivo, e `l.user_id <> po.user_id` (self-like nunca valeu)
lives       WHERE invalidada_em IS NULL AND duração >= live_minutos_para_xp()
```

Sem esses filtros, **ocultar conteúdo era punição sem efeito**: a moderação
tirava o post da tela e o autor ficava com o XP — inclusive o XP que conta para
`check_staff_eligibility` (≥ 1000 para virar admin).

#### `[18/09]` A regra em uma linha, porque eu a apliquei pela METADE três vezes

> **XP paga pelo que ESTÁ NO AR** — post, comentário, curtida ou live. Conteúdo
> que a moderação tirou não paga em **nenhuma** forma.

A SEC-028 escreveu essa regra e aplicou em `posts`. No dia seguinte uma
auditoria externa achou três buracos nela, e **os três eram meus**:

| | O que continuava pagando | De onde veio |
| --- | --- | --- |
| **N8** | a **live** ocultada ou apagada pela equipe | a LIVE-036/037 soltou o XP de live do post para ele sobreviver ao cron — e, ao soltar do post, soltou da moderação, que age no post |
| **N9** | comentário cujo **post pai foi apagado** | a SEC-028 filtrou `comments.hidden_at` e parou ali |
| **N10** | comentário cujo **post pai foi ocultado** | idem |

Medido em `ROLLBACK` antes da LIVE-040, e é o número que define o achado:

| A moderação faz | XP do autor |
| --- | --- |
| ocultar um **post comum** | 1 → **0** ✓ |
| ocultar uma **live** | 1 → **1** ✗ |
| apagar uma **live** | 1 → **1** ✗ |

**A trava:** `src/lib/__tests__/xpSegueOQueEstaNoAr.test.js` lê a última
definição da view nas migrations e exige as quatro condições. Provada
reinjetando cada uma e vendo a falha nomear o achado.

### O bônus de perfil exige CONTEÚDO, não campo não-nulo

`IS NOT NULL` sozinho pagava por **string vazia**. Medido em `ROLLBACK` com
papel `authenticated` real: escrever `''` em `discord`, `twitch`, `youtube` e
`avatar_url` levou o bônus de **95 para 140** — o teto — sem preencher nada.
Hoje é `length(trim(COALESCE(campo,'')))> 0` nos seis campos.

> `platform` já estava protegida pelo `CHECK check_platform`, que só aceita a
> lista fechada de plataformas. Foi o único dos seis que resistiu ao teste.

---

## `[18/09]` `post_aceita_interacao(uuid)` — e a regra sobre função DENTRO de policy

```sql
post_aceita_interacao(p_post_id) -> boolean   -- o post existe, não está apagado nem oculto
```

Usada no `WITH CHECK` de **três** policies de INSERT: `comments_insert`,
`live_chat_insert` e `User insere proprio like`. Sem ela dava para comentar,
curtir e conversar embaixo de conteúdo que a moderação já tirou do ar.

**Ela é `SECURITY DEFINER` de propósito.** Um `EXISTS` cru sobre `posts` dentro
da policy passaria pela RLS de `posts`, que já esconde apagado e oculto — e o
resultado seria o mesmo **hoje**. Mas ficaria dependendo de um efeito colateral
da policy de SELECT de outra tabela: bastaria alguém afrouxar aquele SELECT para
reabrir isto aqui, em silêncio. É a "proteção acidental" que o §1.3 manda
desconfiar.

> **A regra que vale para qualquer função nova usada em policy:** ela precisa de
> `GRANT EXECUTE` para o papel que **dispara** a policy. Sem isso a policy não
> falha "para o invasor" — ela falha **para todo mundo**. Foi a lição do
> SEC-026, onde revogar 9 funções "sem chamador no frontend" teria derrubado 28
> policies (`is_staff` em 14, `can_moderate_content` em 8, `pode_publicar` em 4,
> `is_super` em 2).

---

## `[18/09]` SEC-041 — a mesma função, agora também no `SELECT`

A `post_aceita_interacao` nasceu fechando o **INSERT**: não dá para comentar
embaixo do que a moderação tirou do ar. A auditoria seguinte perguntou a outra
metade, e ela estava aberta: **dá para LER?**

| Policy | Como estava | O que o comum lia de um post apagado |
| --- | --- | --- |
| `comments_select` | `hidden_at IS NULL OR role_rank >= 2` | **1 comentário** |
| `live_chat_select` (era `"Todos veem chat"`) | **`USING (true)`** | **1 mensagem** |

Medido com papel `authenticated` real, em `ROLLBACK`: o **post** devolvia 0
linhas e a conversa embaixo dele devolvia 1 cada. Nenhuma das duas policies
perguntava pelo **post pai**.

**Por que isso não é teoria.** Ocultar um post costuma ser por causa da
**conversa**, não do texto do post. E o `EmbedPlayer` some junto com o post, de
modo que a única coisa que continuava legível pela REST API era exatamente o que
a equipe quis tirar do ar.

Hoje as duas exigem `post_aceita_interacao(post_id)`, com a escapatória
`role_rank(...) >= 2` — sem ela a fila de moderação ficaria cega justamente para
o conteúdo que precisa julgar, que é trocar um buraco por outro (SEC-025).

### `post_likes` ficou de FORA, e a decisão é medida

A mesma auditoria levantou o ponto para curtidas e concluiu que não é falha.
Concordo, por dois motivos somados:

1. **curtida não carrega conteúdo.** O que vaza é *"fulano curtiu o post X"*,
   para quem já tem o id do post;
2. **`post_likes` é a leitura mais quente do site.** O `attachEngagement` busca
   as curtidas de 30 posts de uma vez, em **todo** carregamento de feed. Uma
   policy com subconsulta por linha ali custa caro para sempre.

Trocar o caminho mais quente do app por um vazamento de valor próximo de zero é
a conta errada. Está escrito no SQL da migration e travado por teste, para não
voltar como *"esqueceram"* na próxima auditoria.

---

## `[18/09]` As colunas de `posts` que o cliente NÃO declara

O `trg_guard_post_privileged` passou a ser `BEFORE INSERT OR UPDATE` (era só
`UPDATE`) e a fixar sete colunas para quem tem `role_rank < 2`:

| Coluna | Por que não pode vir do cliente |
| --- | --- |
| `was_live` | vale +30 XP de live. **Derivado**: `OLD.was_live OR NEW.is_live`, e monotônico |
| `expires_at` | a `cleanup_expired_posts` faz `DELETE` **real** por ela — some a janela de 30 dias da moderação |
| `live_ended_at` | quem grava é o `trg_set_live_ended_at`; vindo do cliente dá live "no ar" que já terminou |
| `created_at` | data de nascimento não se escolhe |
| `user_id` | trocar o dono transfere autoria |
| `hidden_at` · `deleted_at` | são **ações de moderação** — o autor desfazendo anula a punição |

**`is_live` continua gravável pelo autor nos dois sentidos**, de propósito: o
formulário de edição do `PostCard` deixa marcar o próprio post como live, e
tirar isso mudaria o produto em vez de fechar uma brecha.

### Por que o `GRANT` das colunas NÃO foi revogado junto

Seria a segunda camada, e a tentação é óbvia. Mas `hidden_at` e `deleted_at`
**não podem** ser revogadas de `authenticated`: a moderação grava `hidden_at`
por `UPDATE` direto de tabela (`moderationService.js`, `setHiddenAt`), e admin
também é `authenticated`. Revogar teria derrubado o painel — a classe exata do
erro do SEC-025.

As demais (`was_live`, `expires_at`, `created_at`, `live_ended_at`) podem ser
revogadas, e **vão** ser: o revoke ficou fora desta rodada porque o cliente
ainda mandava `was_live` no corpo até o deploy, e revogar antes quebraria
publicar post na janela entre a migration e o deploy. Está no `BACKLOG.md`.

### A ordem dos triggers, que aqui não é detalhe

Em `BEFORE` do mesmo evento o Postgres dispara por ordem **alfabética de nome**:

```
trg_guard_post_privileged  <  trg_set_live_ended_at  <  trg_wordlist_posts
```

É o que faz o guard fixar `live_ended_at := OLD` e o `trg_set_live_ended_at`
gravar `now()` **depois**, no encerramento legítimo — e o que deixa o
`trg_wordlist_posts` marcar `hidden_at` num INSERT mesmo com o guard zerando
`deleted_at` antes. Renomear qualquer um dos três muda a ordem.

---

## `[18/09]` LIVE-041 — o prazo da live, e o modo de segurança do guard

`expires_at` era feature **meio construída**, e só o escritor faltava:

| Já existia | Onde |
| --- | --- |
| a tela mostra "até HH:MM" no card, e o player marca a live como encerrada | `LivesList.jsx`, `EmbedPlayer.jsx` |
| o cron lê a coluna, em dois jobs | `expire-lives`, `expire-lives-every-minute` |
| o cliente **não** escreve | o guard pina desde a SEC-027 |

Nenhuma linha de `posts` tinha valor ali. Na prática: uma live esquecida no ar
ocupava o topo do feed por **24 horas** com um embed morto — regra que existia
desde junho e nunca esteve escrita.

### O desenho: o cliente declara INTENÇÃO, o banco calcula o VALOR

```
live_duracao_minutos  ->  o autor escolhe ("minha live dura 2h")
expires_at            ->  o guard deriva: now() + duração
```

Mesmo princípio do `was_live`. Devolver `expires_at` ao cliente reabriria o
achado do pentest: a `cleanup_expired_posts` **APAGA de verdade** por essa
coluna, então escrevê-la é destruir conteúdo sob moderação pulando a janela de
30 dias.

A faixa é `CHECK` e não validação de tela — o site usa a anon key:

| | |
| --- | --- |
| **15 min** | abaixo disso não é transmissão, é engano de clique |
| **1440 min** | 24h, o **mesmo** teto que o cron já impunha. O número não é novo; ele só deixou de ser invisível |

### A reativação reconta do zero

Se o prazo ficasse congelado, a live reativada voltaria **já vencida** e o cron
a mataria no minuto seguinte — reativar viraria um clique que não faz nada
(§1.5). O ramo `false → true` recalcula `now() + duração`.

### O guard NÃO é `SECURITY DEFINER`, e isso quase me custou a SEC-027 inteira

Eu escrevi `SECURITY DEFINER` no rascunho. A função decide se está diante de um
usuário comum **lendo `current_user`**:

```sql
v_comum := current_user IN ('authenticated','anon') AND role_rank(...) < 2;
```

Com o privilégio do dono, `current_user` vira `postgres`, `v_comum` fica sempre
falso, e **toda a pinagem para de rodar**: `was_live`, `expires_at`,
`deleted_at`, `hidden_at` e `user_id` voltam a aceitar valor forjado por PATCH.

**E nada estoura.** O trigger continua disparando, o INSERT continua passando.
Seria a correção de segurança inteira revertida por uma palavra, dentro de um
commit que dizia "prazo de live".

> **Se algum dia o guard precisar de privilégio elevado** para uma leitura nova,
> o caminho é uma função auxiliar `SECURITY DEFINER` chamada por ele (com
> `REVOKE`, ver SEC-042) — **não** mudar o modo do guard.

Trava: `src/lib/__tests__/prazoDaLive.test.js`, 5 asserções.

---

## `[18/09]` LIVE-042 — o pedido de reativação passou a deixar rastro

`solicitar_reativacao_da_propria_live` foi escrita (LIVE-038) dizendo no próprio
comentário que "espelha o `solicitar_revisao_do_proprio_ban`". Espelhava em tudo
menos numa coisa:

| RPC | grava em `admin_logs`? |
| --- | --- |
| `solicitar_revisao_do_proprio_ban` | **sim** |
| `solicitar_reativacao_da_propria_live` | **não** |

O dono via a notificação de admin, mas a **trilha** — o lugar onde ele procura
"o que aconteceu neste site" — não tinha linha nenhuma. Notificação se marca
como lida e some; trilha fica.

**Quem grava é a RPC, não o cliente.** Um `logAudit` do lado de cá pode ser
recusado pelo banco (foi), pode ser pulado e pode ser forjado — e `logAudit`
engole o erro de propósito (§1.5). Na RPC a linha entra na **mesma transação**
do pedido: ou os dois existem, ou nenhum.

`severity = 'info'`, porque pedir reativação é o sistema **funcionando**. Marcar
como alerta seria a mentira que o §0.2 (4ª regra) proíbe.

> Como isto apareceu: as travas `trilhaNaoEhForjavel` e `logMeta` reprovaram
> juntas ao ligar a tela. Elas estavam medindo outra coisa — que o cliente
> registrava uma action que o banco recusa — e foi ao investigar **por que** o
> banco recusava que o buraco real apareceu.

---

## `[18/09]` `lives_realizadas` — a testemunha de que a live aconteceu

> **Por que ela existe, e ela não foi criada por capricho.** O XP deste site é
> **contado na hora**, somando linhas que existem no instante em que a tela
> abre. E um cron apaga **fisicamente** toda live encerrada há mais de 15
> minutos, desde junho.
>
> As duas decisões nunca se encontraram. Consequência medida: **o XP de live
> durava 15 minutos.** Ninguém escolheu isso — caiu por efeito colateral.

| | |
| --- | --- |
| **O que guarda** | `user_id`, `post_id`, `titulo`, `live_kind`, `iniciada_em`, `encerrada_em`, `invalidada_em`, `invalidada_motivo` |
| **Quem escreve** | os triggers `registrar_live_realizada` e `invalidar_lives_do_post_moderado` (os dois `AFTER UPDATE` em `posts`) |
| **Quem lê** | a view `xp_dos_usuarios` |
| **Grant** | **nenhum** — nem `anon`, nem `authenticated` |
| **Uma linha por** | **SESSÃO**, não por post |

### Por que NÃO tem foreign key para `posts`

Uma FK levaria o registro junto quando o post fosse apagado — que é exatamente
o que esta tabela existe para impedir. O `post_id` fica como referência solta,
de propósito.

### Por que isto NÃO é o erro do `posts.likes`

A regra deste documento diz que contador desnormalizado desincroniza no primeiro
caminho que alguém esquecer — foi por isso que `posts.likes` foi apagada.

**A diferença está no que a fonte faz depois.** `posts.likes` duplicava uma
fonte que **continuava existindo** (`post_likes`), então as duas divergiam. Aqui
a fonte é **apagada de propósito**: não há o que duplicar, e esta tabela é a
única testemunha. É registro de evento, não contador espelhado.

### Uma linha por SESSÃO, e isso protege sozinho

Reativar e encerrar de novo grava uma segunda linha — foram duas transmissões.
E o abuso se auto-limita: uma reativação de dois segundos vira uma sessão de
dois segundos, que não passa na regra de duração.

### `[18/09]` `invalidada_em` — como a moderação alcança uma live que já acabou

A LIVE-036 soltou o registro do post para ele sobreviver ao cron. Isso o soltou
da **moderação** junto (achado N8) — a equipe ocultava a live e o XP ficava.

**A invalidação não apaga a linha, e a escolha é deliberada.** A tabela é a
testemunha de que a live aconteceu; apagá-la destruiria o fato junto com a
punição, e tornaria a restauração impossível. `invalidada_em` separa
*"aconteceu"* de *"conta para XP"*.

**E ela tem INVERSA**, como este documento exige de toda ação de estado:
restaurar o post limpa a invalidação e devolve o XP. Sem isso, um engano da
moderação seria permanente — foi o caso da `apply_suspension` sem
`lift_suspension`.

| O que acontece com o post | A live |
| --- | --- |
| a equipe **oculta** | invalidada (`ocultada pela moderacao`) |
| a equipe **restaura** | volta a contar — só desfaz o que a ocultação causou |
| **outra pessoa** que não o autor apaga | invalidada (`apagada pela equipe`) |
| o **autor** apaga o próprio post | continua contando — a live aconteceu |
| o **cron** apaga fisicamente | continua contando (ver abaixo) |

#### O `DELETE` físico NUNCA invalida, e esta é a parte que importa

A primeira versão também invalidava no `DELETE`, distinguindo cron de moderação
por `auth.uid()` ser `NULL`. **O teste reprovou** — e o modo como reprovou vale
mais do que o resultado: `RESET role` não limpa `request.jwt.claims`, então o
"cron" de mentira ainda tinha um admin dentro.

Isso expôs a fragilidade do **desenho**, não do teste. Os dois modos de errar
não são equivalentes:

| Erro | Consequência |
| --- | --- |
| não invalidar quando devia | um banido guarda XP que não usa |
| invalidar quando não devia | **o site inteiro perde XP de live 15 min depois de cada live**, em silêncio, para sempre |

Como `ban_user` apaga conteúdo fisicamente, o XP de quem foi banido sobrevive.
É aceitável: a conta está banida. A trava em
`xpSegueOQueEstaNoAr.test.js` **reprova** se alguém acrescentar `DELETE` ao
gatilho, e a mensagem conta esta história inteira.

### `posts.live_started_at` — por que `created_at` não servia

Duração precisa do início da **sessão**, não do nascimento do post. Sem essa
coluna, uma live reativada pela equipe três dias depois teria "duração de três
dias" e passaria em qualquer regra de tempo mínimo.

---

## `[18/09]` O ciclo de vida da live, de ponta a ponta

| Quem | Pode | Não pode |
| --- | --- | --- |
| **autor** | abrir a live · **encerrar** a própria · pedir reativação | reativar |
| **equipe** (`role_rank >= 2`) | tudo acima · **reativar** · decidir os pedidos | — |
| **cron** (5 em 5 min) | encerrar live vencida ou com +24h · apagar live encerrada há +15 min | apagar live com **pedido pendente** |

### `solicitar_reativacao_da_propria_live(uuid, text)`

A porta do autor. É RPC e não policy porque a tabela `live_reactivation_requests`
continua **fechada** — as regras ("é o dono, a live é dele, já acabou, não há
pedido pendente") ficam num lugar que dá para ler, em vez de dentro de um
`WITH CHECK`.

Espelha o `solicitar_revisao_do_proprio_ban`, inclusive a marca
`auto_solicitado` — sem ela o painel mostraria *"@joao pediu reativação da live
de @joao"* sem explicar por que o solicitante é o próprio dono.

> **O cron precisou mudar junto.** Sem a cláusula que segura o post com pedido
> pendente, a porta seria decorativa: a equipe não reativa o que já foi apagado.

### `live_minutos_para_xp()` e a chave `live_xp_minutos`

Quanto tempo uma live precisa durar para contar como live no XP. Padrão **10
minutos**, e o número mora no `site_config` porque é chute honesto — não existe
uma única live real no banco para medir.

| Camada | O que faz |
| --- | --- |
| `owner_set_site_config` | **recusa** valor fora de 1..600, com mensagem |
| `live_minutos_para_xp()` | volta 10 se a chave sumir ou vier inválida |
| `SiteTab.jsx` | o campo onde o dono troca |

O piso de leitura **não é o fallback silencioso do §4**: o valor errado é
impossível de gravar, e o piso existe para um valor ruim nunca derrubar o XP de
todo mundo numa tela que só lê.
