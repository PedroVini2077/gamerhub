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
| `profiles`                   | Perfil do usuário (1:1 com `auth.users`): username, avatar, bio, role, banimento, redes, preferências |
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
| `violations`                | Infrações confirmadas por moderador (ação, pontos, revisor)     |
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

- Auth/segurança: `check_login_status`, `reset_login_attempts`,
  `record_banned_login_attempt`, `delete_own_account`.
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
  notificação.
- `apply_suspension(user_id, days)` (SECURITY DEFINER) — suspende temporariamente
  (valida hierarquia, seta `suspended_until`, gera log + notificação).

Quase todas as funções de mutação sensível são `SECURITY DEFINER` com
`search_path` fixo e **checagem de role explícita via `auth.uid()`**. Helpers:
- `role_rank(text)` — ranqueia os cargos (user 1 → owner 4).
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

> ⚠️ A coluna `posts.likes` existe no schema mas **nenhum trigger a mantém** —
> está zerada. Nada no app a lê. Não volte a usá-la sem antes criar o trigger;
> era ela que fazia as curtidas do perfil aparecerem sempre 0.

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
