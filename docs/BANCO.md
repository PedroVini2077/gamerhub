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
| `notifications`              | Notificações ao usuário (like/comentário/reply)                  |
| `game_keys`                  | Keys e promoções de jogos                                        |
| `live_chat`                  | Mensagens do chat das lives                                      |
| `live_chat_timeouts`         | Silenciamentos de chat (com expiração)                           |
| `live_muted`                 | Silenciamentos (registro complementar)                           |
| `live_reactivation_requests` | Fila de reativação de lives (admin → super admin)                |
| `unban_requests`             | Fila de desbanimento (admin → super admin/owner)                 |
| `login_attempts`             | Tentativas de login por e-mail (bloqueio) — sem acesso direto    |
| `admin_logs`                 | Trilha de auditoria                                              |
| `admin_notifications`        | Notificações para admins                                         |
| `admin_notification_reads`   | Marcação de lidas por admin                                      |
| `site_config`                | Configuração global (manutenção, flags, banner, thresholds de moderação) |
| `reports`                    | Denúncias da comunidade (tipo/id do conteúdo, motivo, status)    |
| `blocked_words`              | Wordlist de palavras bloqueadas (com severidade)                |
| `violations`                | Infrações confirmadas por moderador (ação, pontos, revisor)     |
| `moderation_queue`           | Fila de revisão humana (origem: denúncia/wordlist/IA/escalação) |

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

### Funções (RPCs / triggers)

**Chamadas pelo front (RPC):**

- Auth/segurança: `register_login_attempt`, `check_login_status`,
  `reset_login_attempts`, `record_banned_login_attempt`, `delete_own_account`.
- Ban: `ban_user`, `unban_user`, `request_unban`, `approve_unban_request`,
  `deny_unban_request`, `admin_unlock_login`, `get_blocked_logins`.
- XP: `get_user_xp`.
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

Publicação `supabase_realtime` inclui: `posts`, `post_media`, `profiles`,
`community_posts`, `live_chat`, `live_chat_timeouts`, `admin_logs`,
`admin_notifications`, `site_config`. Usada para feed, mural, chat de lives,
detecção de ban, banner/manutenção e sincronização dos painéis.

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
