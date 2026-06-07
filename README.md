# 🎮 GamerHub

> Comunidade gamer brasileira — feed de posts, mural da comunidade, lives com
> chat em tempo real, sistema de XP/ranks, keys & promoções de jogos, e um
> painel administrativo completo com hierarquia de cargos.

Aplicação web single-page (SPA) construída com **React + Vite + Tailwind** no
front e **Supabase (Postgres)** no back. Em produção, em uso contínuo.

---

## 📑 Índice

- [Visão geral](#-visão-geral)
- [Stack & dependências](#-stack--dependências)
- [Como rodar](#-como-rodar)
- [Estrutura de pastas](#-estrutura-de-pastas)
- [Hierarquia de cargos (roles)](#-hierarquia-de-cargos-roles)
- [Funcionalidades](#-funcionalidades)
  - [Autenticação & contas](#autenticação--contas)
  - [Feed de posts](#feed-de-posts)
  - [Comentários, likes e notificações](#comentários-likes-e-notificações)
  - [Mural da comunidade](#mural-da-comunidade)
  - [Lives + chat em tempo real](#lives--chat-em-tempo-real)
  - [Keys & promoções](#keys--promoções)
  - [Sistema de XP e Ranks](#sistema-de-xp-e-ranks)
  - [Perfis](#perfis)
  - [Painel Admin / Super Admin](#painel-admin--super-admin)
  - [Painel do Dono (Owner)](#painel-do-dono-owner)
  - [Banimento & desbanimento](#banimento--desbanimento)
  - [Bloqueio de login por tentativas](#bloqueio-de-login-por-tentativas)
  - [Configuração do site](#configuração-do-site)
  - [Logs de auditoria & notificações de admin](#logs-de-auditoria--notificações-de-admin)
- [Banco de dados](#-banco-de-dados)
- [Segurança](#-segurança)
- [Convenções de código](#-convenções-de-código)

---

## 🌐 Visão geral

O GamerHub é uma rede social temática para gamers, com estética "neon/cyber"
(tema escuro, verde-neon, roxo e ciano). O usuário pode criar posts com texto,
imagens, vídeos, áudio (upload ou gravado) e embeds de YouTube/Twitch/TikTok;
interagir via likes e comentários; participar do mural da comunidade; assistir
e moderar **lives** com chat ao vivo; resgatar **keys** e ver **promoções** de
jogos; e evoluir num **sistema de XP/ranks** com 7 tiers.

A operação é sustentada por uma hierarquia administrativa de quatro níveis
(`user` → `admin` → `super_admin` → `owner`), cada um com poderes crescentes,
toda ação sensível registrada em **logs de auditoria** e protegida por funções
`SECURITY DEFINER` no Postgres.

---

## 🧱 Stack & dependências

**Runtime/produção**

| Dependência            | Versão | Uso                                              |
| ---------------------- | ------ | ------------------------------------------------ |
| `react` / `react-dom`  | 19.x   | UI                                               |
| `react-router-dom`     | 7.x    | Roteamento SPA                                    |
| `@supabase/supabase-js`| 2.x    | Auth, Postgres, Realtime, Storage                |
| `framer-motion`        | 12.x   | Animações (transições de página, listas, tabs)   |
| `lucide-react`         | 1.x    | Ícones de UI                                      |
| `react-icons`          | 5.x    | Ícones de marca (Discord/Twitch/YouTube — fa6)   |
| `react-hot-toast`      | 2.x    | Toasts/notificações                              |

**Build/dev:** Vite 8, Tailwind 3, PostCSS/Autoprefixer, ESLint 10
(`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`).

**Infra:** Supabase (Postgres + Auth + Realtime + Storage) · Deploy na Vercel
(`vercel.json` com rewrite SPA e headers de segurança).

---

## ▶️ Como rodar

```bash
npm install
npm run dev       # ambiente de desenvolvimento (Vite)
npm run build     # build de produção -> dist/
npm run preview   # serve o build localmente
npm run lint      # ESLint
npm test          # Vitest — testes unitários da lógica pura (run único)
npm run test:watch# Vitest em modo watch
```

> **Testes:** a lógica pura crítica (XP/ranks, força de senha, idade, parsing de
> embed, formatação) tem cobertura unitária em `src/lib/__tests__/`. São testes
> sem DOM/rede — rápidos e determinísticos — que travam o comportamento correto
> contra regressões. Rodar `npm test` antes de entregar mudanças nessa lógica.

### Variáveis de ambiente

Criar um `.env` na raiz:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> ⚠️ O cliente usa **apenas a anon key** (pública por design). Toda a segurança
> de dados depende das políticas **RLS** e das funções `SECURITY DEFINER` no
> Supabase.

---

## 📁 Estrutura de pastas

```
src/
├── App.jsx                # Rotas, layout, modo manutenção, feature gates
├── main.jsx               # Bootstrap React
├── index.css              # Tema (cores neon, classes .card/.btn/.tag/.input)
├── assets/                # Imagens estáticas (hero, etc.)
├── hooks/
│   ├── useAuth.jsx        # Sessão, perfil, detecção de ban, presença online
│   ├── useRole.js         # Deriva flags isOwner/isAdmin/isSuperAdmin/isBanned
│   └── useRealtime.js     # Helper genérico de subscription Postgres changes
├── lib/
│   ├── supabase.js        # Cliente Supabase
│   ├── auditLog.js        # logAudit() -> RPC log_audit_event
│   ├── ranks.js           # Tiers de XP, cálculo de rank, fontes de XP
│   ├── format.js          # Formatação de números (1K, 1M...)
│   ├── password.js        # Força de senha (compartilhado Login/AuthConfirm)
│   ├── date.js            # Cálculo de idade / idade mínima de cadastro
│   └── motion.js          # Variantes Framer Motion compartilhadas
├── services/              # Camada de acesso a dados (Supabase) por domínio
│   ├── postService.js     # Posts, likes, mídia, comentários, lives ativas
│   ├── profileService.js  # Perfis, XP, stats, avatar, preferências
│   ├── communityService.js# Mural da comunidade
│   ├── liveService.js     # Chat de live, silenciamentos
│   ├── keyService.js      # Keys/promos, stats do site
│   └── authService.js     # Trocar senha/email, deletar conta
├── pages/
│   ├── Home.jsx           # Feed principal
│   ├── Login.jsx          # Login / cadastro / recuperação de senha
│   ├── AuthConfirm.jsx    # Confirmação de e-mail / reset de senha (magic link)
│   ├── Community.jsx      # Mural da comunidade
│   ├── Keys.jsx           # Keys grátis & promoções
│   ├── Lives.jsx          # Lista de lives + player + chat + moderação
│   ├── Ranks.jsx          # Explicação do sistema de XP/ranks
│   ├── Profile.jsx        # Perfil próprio (edição, avatar, stats, XP)
│   ├── UserProfile.jsx    # Perfil público de outro usuário
│   ├── Settings.jsx       # Conta: senha, e-mail, notificações, deletar conta
│   ├── Admin.jsx          # Painel admin / super admin (multi-aba)
│   ├── Owner.jsx          # Painel do fundador (multi-aba)
│   └── NotFound.jsx       # 404
└── components/
    ├── ErrorBoundary.jsx
    ├── auth/              # LoginForm, RegisterForm, ForgotForm, InputWrap
    ├── feed/              # PostCard, PostForm, CommentSection
    ├── community/         # MuralCard, MuralForm
    ├── keys/             # KeyEditor
    ├── lives/            # LivesList, ChatPanel, ModPanel
    ├── admin/            # UsersPanel, PostsPanel, LivesPanel, KeysPanel,
    │                     # NotifsPanel, LogsPanel, SuperAdminPanel
    ├── owner/            # PainelTab, UsuariosTab, LogsTab, SiteTab,
    │                     # NotificacoesTab, MetricasTab
    ├── layout/           # Header, Sidebar, RightPanel
    └── ui/               # Avatar, AvatarPopup, BanModal, BannedScreen,
                          # ConfirmModal, ReasonModal, EmbedPlayer,
                          # MediaCarousel, MediaLightbox, MediaPlayer,
                          # AudioRecorder, GlobalBanner, FeatureGate,
                          # PageTransition
```

### Rotas

| Rota             | Página       | Proteção                                   |
| ---------------- | ------------ | ------------------------------------------ |
| `/`              | Home         | pública                                    |
| `/login`         | Login        | pública                                    |
| `/auth/confirm`  | AuthConfirm  | pública (magic link)                       |
| `/community`     | Community    | `FeatureGate: feature_community`           |
| `/keys`          | Keys         | `FeatureGate: feature_keys`                |
| `/lives`, `/lives/:id` | Lives  | `FeatureGate: feature_lives`               |
| `/ranks`         | Ranks        | pública                                    |
| `/profile`       | Profile      | requer login                               |
| `/u/:username`   | UserProfile  | pública                                    |
| `/settings`      | Settings     | requer login                               |
| `/admin`         | Admin        | redireciona não-admins                     |
| `/owner`         | Owner        | redireciona não-owner                      |
| `*`              | NotFound     | —                                          |

Páginas pesadas são **lazy-loaded** (code-splitting). Há **transição de página
global** (Framer Motion) e **modo manutenção** que bloqueia o site para todos
exceto o owner, reagindo em tempo real à `site_config`.

---

## 👑 Hierarquia de cargos (roles)

Definida em `profiles.role` e ranqueada pela função SQL `role_rank()`:

| Role          | Rank | Pode…                                                                          |
| ------------- | ---- | ------------------------------------------------------------------------------ |
| `user`        | 1    | postar, comentar, curtir, mural, ver lives/chat, editar próprio perfil         |
| `admin`       | 2    | tudo de user + banir `user`, moderar chat de lives, gerenciar keys/promos, solicitar desbanimento e reativação de live, ver notificações/logs |
| `super_admin` | 3    | tudo de admin + banir/desbanir direto, aprovar/negar desbanimentos e reativações, desbloquear logins, banir `admin` |
| `owner`       | 4    | acesso total + painel do Dono: alterar roles, feature flags, banner, manutenção, métricas globais; imune a ban/alteração de role |

A hierarquia é **imposta no banco** (funções checam `role_rank(caller) >
role_rank(target)`), não apenas na UI.

---

## ✨ Funcionalidades

### Autenticação & contas

- **Cadastro** com e-mail/senha, `username`, data de nascimento (mínimo 13 anos
  — LGPD), estado (UF) e plataforma. Confirmação de e-mail via magic link
  (`AuthConfirm`).
- **Login** com detecção de bloqueio por tentativas (ver
  [bloqueio de login](#bloqueio-de-login-por-tentativas)) e contagem regressiva
  ao vivo quando bloqueado.
- **Recuperação de senha** por e-mail; indicador de força de senha.
- **Configurações** (`Settings`): trocar senha, trocar e-mail (com confirmação),
  preferências de notificação (likes/comentários) e **deletar a própria conta**
  (RPC `delete_own_account`, com dupla confirmação).
- Trigger `handle_new_user` cria automaticamente a linha em `profiles` ao
  registrar um usuário no `auth.users`.

### Feed de posts

- Criação de posts (`PostForm`) com:
  - Título + conteúdo; categorias `dica` / `curiosidade` / `news`.
  - Até **10 mídias** por post: imagens (≤5MB) e vídeos (≤100MB).
  - **Áudio**: upload (≤20MB) ou **gravação pelo microfone** (`AudioRecorder`).
  - **Embeds**: YouTube, Twitch, TikTok (`EmbedPlayer` / `getEmbedInfo`).
  - Marcar embed da Twitch como **live**.
- Exibição (`PostCard`): carrossel de mídias (`MediaCarousel` + lightbox),
  player de áudio (`MediaPlayer`), embeds, likes e comentários.
- **Edição com janela de 30 minutos** (contador regressivo).
- **Retry de mídia** com backoff caso a mídia ainda não tenha subido.
- Feed (`Home`): busca por texto, filtro por categoria, aviso de "novos posts"
  em tempo real, limite de 30 posts.

### Comentários, likes e notificações

- **Comentários** (`CommentSection`): abrir/fechar, criar, deletar (autor ou
  admin), contagem, envio com Enter.
- **Likes**: toggle por usuário (constraint única `post_id+user_id`).
- **Notificações ao usuário** (tabela `notifications`): geradas quando alguém
  curte ou comenta seu post (respeitando `notif_likes` / `notif_comments` do
  perfil). Sino no `Header` mostra não-lidas e permite marcar todas como lidas.

### Mural da comunidade

- `Community` + `MuralForm` / `MuralCard`: mural de mensagens curtas da galera,
  em tempo real, limite de 50 itens. Banidos não postam (RLS).

### Lives + chat em tempo real

- `Lives` lista posts com `is_live = true`; player de Twitch/YouTube embutido.
- **Chat ao vivo** (`live_chat`) em tempo real (Supabase Realtime).
- **Contagem de espectadores** via Supabase Presence.
- **Moderação**: silenciar usuários por tempo determinado
  (`live_chat_timeouts`, durações pré-definidas), encerrar a live, deletar
  mensagens (autor da mensagem, dono da live ou admin).
- **Encerramento automático** quando aplicável; trigger `set_live_ended_at`
  grava `live_ended_at`; `was_live` marca quem já transmitiu (usado no XP).
- **Reativação de live**: admin solicita → super admin aprova/nega
  (`live_reactivation_requests`).

### Keys & promoções

- `Keys` (público, via `feature_keys`): aba de **keys grátis** (com botão de
  copiar código) e aba de **promoções** (desconto %, link, validade).
- CRUD feito por admins no painel (`KeyEditor` / `KeyForm` em `Admin`),
  gravado em `game_keys`.

### Sistema de XP e Ranks

XP calculado **no servidor** pela RPC `get_user_xp` (fonte de verdade):

| Fonte                           | XP               |
| ------------------------------- | ---------------- |
| Por post                        | +20              |
| Por like recebido               | +5               |
| Por comentário feito            | +3               |
| Bônus por live (além do post)   | +30              |
| Bio preenchida                  | +50 (único)      |
| Avatar                          | +30 (único)      |
| Plataforma definida             | +15 (único)      |
| Conectar Discord/Twitch/YouTube | +15 cada (único) |

**7 tiers** (`src/lib/ranks.js`), cada um com 4 sub-ranks (I–IV), cor e ícone:
Recruta → Veterano → Guerreiro → Elite → Predador → Lenda → Deus. O `owner` tem
um rank especial de **Fundador** (laranja), fora da escala de XP. A página
`Ranks` mostra o rank atual, progresso do sub-rank, breakdown de XP e a tabela
de fontes. O rank também aparece como **borda do avatar** e no `AvatarPopup`.

### Perfis

- **Perfil próprio** (`Profile`): edição de bio, nascimento, estado, plataforma,
  estilo de jogo, jogos favoritos e redes (Discord/Twitch/YouTube); **upload de
  avatar** com compressão para 400×400 JPEG; stats (posts, likes recebidos, XP)
  e visualização de rank/progresso.
- **Perfil público** (`UserProfile`, rota `/u/:username`): mesmos dados em modo
  leitura + posts do usuário; cálculo de idade a partir da data de nascimento.
- `AvatarPopup`: card flutuante com resumo do perfil ao clicar num avatar,
  incluindo atalho para banir (se o viewer tiver hierarquia para isso).

### Painel Admin / Super Admin

`Admin.jsx` — painel multi-aba (acesso de `admin` para cima):

- **Usuários**: busca + filtros por role/banidos; expandir linha para ver
  detalhes; **mudar role** (respeitando hierarquia); **banir/desbanir**;
  **deletar todos os posts** de um usuário; fluxo de solicitação de
  desbanimento.
- **Posts**: listar e deletar posts.
- **Mod de Lives**: usuários silenciados (com tempo restante), lives ativas
  (encerrar), lives encerradas (solicitar reativação), fila de solicitações.
- **Keys & Promos**: adicionar/editar/remover keys e promoções.
- **Notificações**: feed de `admin_notifications` (novo usuário, nova live,
  alertas de segurança…), marca como lida ao visualizar.
- **Logs**: `admin_logs` filtráveis por categoria, com severidade e ator.
- **Super Admin** (aba exclusiva): **logins bloqueados** (desbloqueio com
  contagem regressiva de 10s anti-clique acidental); **aprovar/negar
  desbanimentos**; **aprovar/negar reativações de live**.

Subscriptions de realtime mantêm o painel sincronizado (usando refs para
evitar closures velhas nos callbacks).

### Painel do Dono (Owner)

`Owner.jsx` — exclusivo do `owner`, alimentado por RPCs `owner_*`:

- **Painel**: visão geral (usuários, online agora, admins, banidos, posts hoje /
  30d, keys) + gráfico de cadastros (14 dias) — `owner_get_stats`.
- **Usuários**: lista completa (`owner_get_users`) com busca não-bloqueante
  (`useDeferredValue`), e-mail, mudar role (`owner_set_role`), ban/unban.
- **Audit Logs**: `owner_get_audit_logs` paginado, filtro por categoria e
  severidade.
- **Site**: banner global (texto/cor/toggle), modo manutenção e **feature
  flags** (keys, lives, community) — via `owner_set_site_config`.
- **Notificações**: últimas 50 (`owner_get_notifications`), em tempo real.
- **Métricas**: ativos 7d, inativos 30d, XP total; ranking de top usuários por
  XP e top posts por likes — `owner_get_metrics`.

### Banimento & desbanimento

- **Banir** (`ban_user`): valida hierarquia, marca `banned`, registra motivo /
  detalhes / quem baniu / quando, incrementa `ban_count` (reincidência) e
  **apaga toda a atividade** do usuário (posts, comments, community_posts,
  live_chat). Gera log + notificação de admin.
- **Tela de banido** (`BannedScreen`): mostrada em tempo real ao usuário banido
  (realtime na coluna `profiles.banned` + polling de fallback no `useAuth`).
- **Fluxo de desbanimento**: `admin` solicita (`request_unban`) → `super_admin`
  aprova (`approve_unban_request`) ou nega (`deny_unban_request`).
  `super_admin`/`owner` também desbanem direto (`unban_user`).

### Bloqueio de login por tentativas

Servidor é a **única fonte de verdade** (`register_login_attempt` /
`check_login_status` / `admin_unlock_login`):

- 5 falhas consecutivas → bloqueio temporário de **15 min**.
- 10+ falhas → bloqueio **permanente** (precisa de super admin para liberar).
- O contador só zera em **login bem-sucedido** (`reset_login_attempts`) — sem
  reversão por tempo (punição intencional).
- Ao atingir bloqueio, gera log de segurança detalhado + notificação geral aos
  admins. Super admin desbloqueia pela aba Super Admin.

### Configuração do site

Tabela `site_config` (chave/valor), editável só pelo owner via
`owner_set_site_config`, lida por todos e propagada em **tempo real**:

- `maintenance_mode` — bloqueia o site (exceto owner).
- `feature_keys`, `feature_lives`, `feature_community` — feature flags que
  ligam/desligam seções (via `FeatureGate`).
- Banner global (`GlobalBanner`): texto, cor e visibilidade.

### Logs de auditoria & notificações de admin

- **`admin_logs`**: trilha de auditoria (ação, detalhes, categoria, severidade,
  ator, metadata JSON). Escrito pelo front via `logAudit()` →
  `log_audit_event`, e por várias funções/triggers do banco.
- **`admin_notifications`** + **`admin_notification_reads`**: notificações para
  admins (audiência `all_admins` ou `super_admin`), com controle de lidas por
  admin. Geradas por triggers (`notify_admin_new_user`, `notify_admin_new_live`,
  `notify_admin_reactivation_request`) e por funções de ban/segurança.

---

## 🗄️ Banco de dados

Postgres no Supabase (`project_id: yuqbdcoljlvncxdnesxk`). **RLS habilitado em
todas as tabelas públicas.**

### Tabelas

| Tabela                       | Descrição                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| `profiles`                   | Perfil do usuário (1:1 com `auth.users`): username, avatar, bio, role, banimento, redes, preferências |
| `posts`                      | Posts do feed (texto, mídia legada, áudio, embed, flags de live) |
| `post_media`                 | Mídias de um post (imagem/vídeo/áudio, posição)                  |
| `post_likes`                 | Likes (único por `post_id+user_id`)                              |
| `comments`                   | Comentários de posts                                             |
| `community_posts`            | Mensagens do mural da comunidade                                 |
| `notifications`              | Notificações ao usuário (like/comentário)                       |
| `game_keys`                  | Keys e promoções de jogos                                        |
| `live_chat`                  | Mensagens do chat das lives                                      |
| `live_chat_timeouts`         | Silenciamentos de chat (com expiração)                          |
| `live_muted`                 | Silenciamentos (registro complementar)                          |
| `live_reactivation_requests` | Fila de reativação de lives (admin → super admin)               |
| `unban_requests`             | Fila de desbanimento (admin → super admin)                      |
| `login_attempts`             | Tentativas de login por e-mail (bloqueio) — sem acesso direto   |
| `admin_logs`                 | Trilha de auditoria                                             |
| `admin_notifications`        | Notificações para admins                                         |
| `admin_notification_reads`   | Marcação de lidas por admin                                      |
| `site_config`                | Configuração global (manutenção, flags, banner)                 |

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

**Triggers:**

- `handle_new_user` / `handle_user_confirmed` (em `auth.users`) — cria perfil.
- `notify_admin_new_user` (profiles INSERT) — notifica admins.
- `notify_admin_new_live`, `set_live_ended_at`, `log_post_event` (posts).
- `notify_admin_reactivation_request` (live_reactivation_requests INSERT).

Quase todas as funções de mutação sensível são `SECURITY DEFINER` com
`search_path` fixo e **checagem de role explícita via `auth.uid()`**. Helper
`role_rank(text)` ranqueia os cargos.

### Storage (buckets)

- **`avatars`** (público): avatar do usuário; upload/update/delete restritos ao
  dono pela pasta `auth.uid()/...`.
- **`post-media`** (público): imagens/vídeos/áudios dos posts; upload por
  autenticados, delete pelo dono do post.

> Os buckets são públicos para leitura via URL (CDN), mas **não** permitem
> *listar* arquivos (a policy ampla de SELECT em `storage.objects` foi removida)
> — o acesso por URL pública continua funcionando.

### Realtime

Publicação `supabase_realtime` inclui: `posts`, `post_media`, `profiles`,
`community_posts`, `live_chat`, `live_chat_timeouts`, `admin_logs`,
`admin_notifications`, `site_config`. Usada para feed, mural, chat de lives,
detecção de ban, banner/manutenção e sincronização dos painéis.

---

## 🔒 Segurança

- Cliente usa **anon key**; a proteção real está no **RLS** + funções
  `SECURITY DEFINER`.
- Hierarquia de cargos **imposta no banco** (não confia só na UI).
- Funções `SECURITY DEFINER` administrativas/owner têm `EXECUTE` **revogado de
  `anon`** (defesa em profundidade): além da checagem interna por `auth.uid()`,
  usuários não autenticados sequer conseguem invocá-las via RPC. Só permanecem
  abertas a `anon` as do fluxo de login (`check_login_status`,
  `register_login_attempt`) e a leitura de XP (`get_user_xp`).
- Bloqueio de login server-side; tela de banido em tempo real.
- Headers de segurança na Vercel (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, etc.).
- Trilha de auditoria de ações sensíveis.

> A política de segurança e os pontos de melhoria são revisados periodicamente
> pelo plano de auditoria em 3 fases descrito no `CLAUDE.md`.

---

## 🎨 Convenções de código

Detalhadas no `CLAUDE.md`. Resumo:

- **Animações** via variantes compartilhadas em `src/lib/motion.js`; transição
  de página global com `PageTransition` + `AnimatePresence`.
- **Ícones**: Lucide para UI; `react-icons/fa6` para marcas.
- **Modais** estilizados via `createPortal` (sem `window.prompt/confirm`).
- Tema em `src/index.css` (classes `.card`, `.btn-neon/.btn-solid/.btn-purple`,
  `.tag-*`, `.input-gamer`).
