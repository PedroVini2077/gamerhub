# 🎮 GamerHub

> Comunidade gamer brasileira — landing page institucional, feed de posts,
> mural da comunidade, lives com chat em tempo real, sistema de XP/ranks,
> keys & promoções de jogos, e um painel administrativo completo com
> hierarquia de cargos.

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
  - [Landing page institucional](#landing-page-institucional)
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
(tema escuro, verde-neon, roxo e ciano). Visitantes não logados chegam a uma
**landing page institucional** animada com cena 3D; após criar conta e confirmar
o email, acessam a plataforma completa.

Dentro da plataforma, o usuário pode criar posts com texto, imagens, vídeos,
áudio (upload ou gravado) e embeds de YouTube/Twitch/TikTok; interagir via
likes e comentários com suporte a threads; participar do **mural da comunidade**
(mensagens, imagens e reações); assistir e moderar **lives** com chat ao vivo,
incluindo uma seção de **lives de jogadores** (Gameplays / Reacts / Outros);
resgatar **keys** e ver **promoções** de jogos; e evoluir num **sistema de
XP/ranks** com 7 tiers.

A operação é sustentada por uma hierarquia administrativa de quatro níveis
(`user` → `admin` → `super_admin` → `owner`), cada um com poderes crescentes,
toda ação sensível registrada em **logs de auditoria** e protegida por funções
`SECURITY DEFINER` no Postgres.

---

## 🧱 Stack & dependências

**Runtime/produção**

| Dependência              | Versão | Uso                                              |
| ------------------------ | ------ | ------------------------------------------------ |
| `react` / `react-dom`    | 19.x   | UI                                               |
| `react-router-dom`       | 7.x    | Roteamento SPA                                   |
| `@supabase/supabase-js`  | 2.x    | Auth, Postgres, Realtime, Storage                |
| `framer-motion`          | 12.x   | Animações (transições, listas, tabs, landing)    |
| `@react-three/fiber`     | 8.x    | Cena 3D da landing (Canvas/WebGL)                |
| `three`                  | 0.x    | Geometrias e materiais 3D                        |
| `@tanstack/react-query`  | 5.x    | Cache de dados, dedupe de requests, invalidação  |
| `lucide-react`           | 1.x    | Ícones de UI                                     |
| `react-icons`            | 5.x    | Ícones de marca (Discord/Twitch/YouTube — fa6)   |
| `react-hot-toast`        | 2.x    | Toasts/notificações                              |

**Build/dev:** Vite 8, Tailwind 3, PostCSS/Autoprefixer, ESLint 10
(`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`), Vitest.

**Infra:** Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) ·
Deploy na Vercel (`vercel.json` com rewrite SPA e headers de segurança).

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
├── App.jsx                # Rotas, layout, HomeOrLanding, modo manutenção, feature gates
├── main.jsx               # Bootstrap React
├── index.css              # Tema (cores neon, classes .card/.btn/.tag/.input)
├── assets/
│   └── landing/           # Prints reais do site usados na landing (feed, mural, lives,
│                          # ranks, keys) — nomes de usuários censados por privacidade
├── hooks/
│   ├── useAuth.jsx        # Sessão, perfil, detecção de ban, presença online
│   ├── useRole.js         # Deriva flags isOwner/isAdmin/isSuperAdmin/isBanned
│   ├── useRealtime.js     # Helper genérico de subscription Postgres changes
│   ├── useCommentLike.js  # Estado de like de comentário
│   └── useBlockedWords.js # Cache da wordlist + checkContent() (filtro de moderação)
├── lib/
│   ├── supabase.js        # Cliente Supabase
│   ├── queryClient.js     # React Query client (staleTime 30s, retry 1)
│   ├── auditLog.js        # logAudit() -> RPC log_audit_event
│   ├── ranks.js           # Tiers de XP, cálculo de rank, fontes de XP
│   ├── embed.js           # getEmbedInfo() — parsing de URLs YouTube/Twitch/TikTok/Instagram
│   ├── format.js          # Formatação de números (1K, 1M...)
│   ├── password.js        # Força de senha (compartilhado Login/AuthConfirm)
│   ├── date.js            # Cálculo de idade / idade mínima de cadastro
│   ├── motion.js          # Variantes Framer Motion compartilhadas (fade, grid, list)
│   └── landingMotion.js   # Variantes de animação exclusivas da landing (hero, reveal, stagger)
├── services/              # Camada de acesso a dados (Supabase) por domínio
│   ├── postService.js     # Posts, likes, mídia, comentários, lives ativas
│   ├── profileService.js  # Perfis, XP, stats, avatar, preferências
│   ├── communityService.js# Mural da comunidade
│   ├── liveService.js     # Chat de live, silenciamentos
│   ├── keyService.js      # Keys/promos, stats do site
│   ├── authService.js     # Trocar senha/email, deletar conta
│   └── moderationService.js # Denúncias, fila, wordlist, infrações, hide/restore
├── pages/
│   ├── Landing.jsx        # Página pública para visitantes não logados
│   ├── Home.jsx           # Feed principal
│   ├── Login.jsx          # Login / cadastro / recuperação de senha
│   ├── AuthConfirm.jsx    # Confirmação de e-mail / reset de senha (magic link)
│   ├── Community.jsx      # Mural da comunidade
│   ├── Keys.jsx           # Keys grátis & promoções
│   ├── Lives.jsx          # Lista de lives + sub-tabs + player + chat + moderação
│   ├── Ranks.jsx          # Explicação do sistema de XP/ranks
│   ├── Profile.jsx        # Perfil próprio (edição, avatar, stats, XP)
│   ├── UserProfile.jsx    # Perfil público de outro usuário
│   ├── Settings.jsx       # Conta: senha, e-mail, notificações, deletar conta
│   ├── Admin.jsx          # Painel admin / super admin (multi-aba)
│   ├── Owner.jsx          # Painel do fundador (multi-aba)
│   └── NotFound.jsx       # 404
└── components/
    ├── ErrorBoundary.jsx
    ├── auth/              # LoginForm, RegisterForm, RegisterSuccess, ForgotForm, InputWrap
    ├── feed/              # PostCard, PostForm, CommentSection, CommentCard
    ├── community/         # MuralCard, MuralForm
    ├── keys/              # KeyEditor
    ├── lives/             # LivesList, ChatPanel, ModPanel, LiveGoModal
    ├── admin/             # UsersPanel, PostsPanel, LivesPanel, KeysPanel,
    │                      # NotifsPanel, LogsPanel, SuperAdminPanel
    ├── owner/             # PainelTab, UsuariosTab, LogsTab, SiteTab,
    │                      # NotificacoesTab, MetricasTab
    ├── moderation/        # ModerationPanel, ModerationQueue, ReportsList,
    │                      # WordlistManager, ViolationsPanel
    ├── landing/           # Hero, ElectricTitle, IntroLightning, FeatureSection,
    │                      # HighlightsStrip, FinalCTA, LandingNav, LandingFooter,
    │                      # LandingShot, Scene3D
    │   └── scene3d/       # LandingScene, Lightning, SceneObjects (LogoBolt/FloatingShapes)
    └── ui/                # Avatar, AvatarPopup, BanModal, BannedScreen,
                           # ConfirmModal, ReasonModal, ReportModal, SuspendedNotice,
                           # EmbedPlayer, MediaCarousel, MediaLightbox, MediaPlayer,
                           # AudioRecorder, GlobalBanner, FeatureGate,
                           # PageTransition
```

### Rotas

| Rota                | Página       | Proteção                                         |
| ------------------- | ------------ | ------------------------------------------------ |
| `/`                 | Landing      | pública (visitantes) — ou Home se logado         |
| `/login`            | Login        | pública                                          |
| `/auth/confirm`     | AuthConfirm  | pública (magic link)                             |
| `/community`        | Community    | `FeatureGate: feature_community`                 |
| `/keys`             | Keys         | `FeatureGate: feature_keys`                      |
| `/lives`, `/lives/:id` | Lives     | `FeatureGate: feature_lives`                     |
| `/ranks`            | Ranks        | pública                                          |
| `/profile`          | Profile      | requer login                                     |
| `/u/:username`      | UserProfile  | pública                                          |
| `/settings`         | Settings     | requer login                                     |
| `/admin`            | Admin        | redireciona não-admins                           |
| `/owner`            | Owner        | redireciona não-owner                            |
| `*`                 | NotFound     | —                                                |

A rota raiz `/` usa o componente `HomeOrLanding` que decide entre `Landing` e
`Home` com base no estado de autenticação — visitantes veem a landing page,
usuários logados veem o feed diretamente.

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
role_rank(target)`), não apenas na UI. A mudança de cargo segue um **fluxo de
indicação/avaliação** (não troca instantânea): um admin/super admin indica,
outro avalia, o dono tem override de emergência para qualquer cargo.

O `owner` tem um rank especial de **Fundador** (laranja), exibido na página
`Ranks` fora da escala de XP normal.

---

## ✨ Funcionalidades

### Landing page institucional

`Landing.jsx` — página pública exibida para visitantes não autenticados (não
logados) ao acessar `/`. Decide-se em `HomeOrLanding` no `App.jsx` com base no
estado de autenticação.

**Cena 3D do Hero** (`Scene3D` + `scene3d/`):
- Canvas React Three Fiber carregado sob demanda (lazy) com `Suspense`.
- **`LogoBolt`**: raio 3D sólido extrudado (silhueta do ícone Zap da marca),
  cresce de escala 0→1 com `easeOutCubic` ao aparecer; acompanhado por um
  `pointLight` (`flashRef`) que estoura no nascimento (intensidade 14→0) e
  decai rápido — "primeiro a luz, depois a forma se revela". Roda
  continuamente no eixo Y, revelando a profundidade da extrusão; zumbido neon
  suave de `emissiveIntensity` sem flickering.
- **`FloatingShapes`**: objetos gamer 3D flutuantes nos cantos — **console**
  (núcleo escuro entre painéis neon, estilo torre), **headset** (arco + conchas
  + microfone), **gabinete de PC** (torre com vidro escuro + fans RGB em anéis
  neon) e **caveira** (crânio + órbitas + dentes). Montados com primitivas e
  caixas arredondadas (`roundedBoxGeometry`), materiais neon emissivos com
  recortes escuros pra leitura. Cada um "materializa" com overshoot
  (`easeOutBack`) em cascata temporal (`SHAPE_STAGGER = 0.16s`).
- **`Lightning`**: raios 3D animados cruzando a cena.

**Intro de abertura** (`IntroLightning`):
- Overlay `fixed inset-0 z-[60]` que cobre tudo no primeiro carregamento.
- SVG de raio principal + bifurcação desenhado via `pathLength` 0→1 (0.3s).
- Flash verde em tela inteira: radial gradient `opacity [0, 0.85, 0]` em 0.34s.
- Bola de clarão expandindo: `scale [0, 0.9, 2.4]` + `opacity [0, 1, 0]` em 0.72s.
- Overlay some (`opacity 0`) em 0.45s, chama `onComplete` — libera o conteúdo do Hero.
- Todo o conteúdo do Hero (eyebrow, título, subtítulo, CTA) fica em
  `animate={introDone ? 'animate' : 'initial'}` até a intro terminar.

**`ElectricTitle`** — título "GAMERHUB" com eletricidade:
- Aparece com blur+letterSpacing animados via variante `heroTitle`.
- **"HUB"** pisca com animação CSS `animate-electric-buzz` (neon mal aterrado).
- SVG com 5 arcos zigue-zague de cores/durações/atrasos variados (`ARCS`).
- Os arcos só entram no DOM depois que `onAnimationComplete` dispara (título
  terminou de se formar) — evita o flash de traços estáticos visíveis durante
  a animação de entrada. `animationFillMode: 'backwards'` garante que os arcos
  com delay fiquem em `opacity: 0` durante a espera (não aparecem todos de
  uma vez e somem um a um).

**Seções de features** (`FeatureSection`):
- Cada seção tem ícone, eyebrow, título, descrição e botão "Saiba mais" que
  abre/fecha painel animado com mais detalhes (`expandPanel`).
- Imagens reais do site (`LandingShot`) com usernames censados por privacidade.
- Seções cobertas: Feed, Mural, Lives, Keys & Promos, Ranks & XP.
- Animações de reveal ao entrar na viewport (`fadeUpReveal` + `VIEWPORT`).

**Outros componentes**: `HighlightsStrip` (stats/destaques), `FinalCTA`
(chamada pra ação final), `LandingNav` (navegação pública), `LandingFooter`.

**`lib/landingMotion.js`** — variantes Framer Motion exclusivas da landing:
`heroTitle`, `heroFade`, `fadeUpReveal`, `staggerContainer`, `expandPanel`.
Separadas de `lib/motion.js` (que é o restante do site) para manter a
assinatura visual mais "show" da primeira impressão sem contaminar as
transições discretas das páginas internas.

### Autenticação & contas

- **Cadastro** com e-mail/senha, `username`, data de nascimento (mínimo 13 anos
  — LGPD), estado (UF) e plataforma. Confirmação de e-mail via magic link
  (`AuthConfirm`).
- **Tela pós-cadastro persistente** (`RegisterSuccess`): substitui o toast
  temporário por uma tela dedicada que permanece enquanto o usuário não clica
  "Voltar para o login" — deixa claro que a confirmação de e-mail é obrigatória
  e avisa que pedir reenvio invalida o link anterior.
- **Email de confirmação** resistente a dark mode — template em Edge Function
  com cores explícitas (não herda tema escuro do cliente de email).
- **Login** com detecção de bloqueio por tentativas (ver
  [bloqueio de login](#bloqueio-de-login-por-tentativas)) e contagem regressiva
  ao vivo quando bloqueado.
- Botão **"Voltar para a página inicial"** na tela de login (leva para a
  Landing sem precisar de conta).
- **Recuperação de senha** por e-mail; indicador de força de senha.
- **Configurações** (`Settings`): trocar senha, trocar e-mail (com confirmação),
  preferências de notificação (likes/comentários) e **deletar a própria conta**
  (RPC `delete_own_account`, com dupla confirmação).
- Trigger `handle_new_user` cria automaticamente a linha em `profiles` ao
  registrar um usuário no `auth.users`.

### Feed de posts

- Criação de posts (`PostForm`) com:
  - Título + conteúdo; categorias `dica` / `curiosidade` / `news`.
  - Até **10 mídias** por post: imagens (≤5MB) e vídeos (≤25MB — reduzido de
    100MB para poupar cota de egress; clipes longos via embed são recomendados).
  - **Áudio**: upload (≤20MB) ou **gravação pelo microfone** (`AudioRecorder`).
  - **Embeds**: YouTube, Twitch, TikTok (`EmbedPlayer` / `getEmbedInfo`).
    Suporta URLs de `youtube.com/live/` além dos formatos padrão.
  - Marcar embed como **live** (Twitch ou YouTube).
- Exibição (`PostCard`): carrossel de mídias (`MediaCarousel` + lightbox),
  player de áudio (`MediaPlayer`), embeds, likes e comentários.
- **Edição com janela de 30 minutos** (contador regressivo).
- **Retry de mídia** com backoff caso a mídia ainda não tenha subido.
- Feed (`Home`): busca por texto, filtro por categoria, aviso de "novos posts"
  em tempo real, limite de 30 posts.
- Posts com `live_kind` (lives de jogadores) são **excluídos do feed** — só
  aparecem na aba Lives.

### Comentários, likes e notificações

- **Comentários** (`CommentSection` / `CommentCard`): abrir/fechar, criar,
  deletar (autor ou admin), contagem, envio com Enter.
- **Respostas em thread** (replies): coluna `comments.parent_id` (self-FK com
  `ON DELETE CASCADE`). UI achatada em 1 nível (respostas de respostas viram
  irmãs sob o comentário raiz), com composer inline ao clicar "Responder".
- **Likes em comentários** (`comment_likes`): toggle por usuário, exibido com
  coração em `CommentCard`.
- **Likes em posts**: toggle por usuário (constraint única `post_id+user_id`).
- **Notificações ao usuário** (`notifications`):
  - Like num post → notifica o autor (se `notif_likes`).
  - Comentário num post → notifica o autor do post (se `notif_comments`).
  - Resposta a um comentário → notifica o autor do comentário pai.
  - Like num comentário → notifica o autor do comentário (se `notif_likes`).
  - Geradas por triggers `SECURITY DEFINER` (não pelo front diretamente).
  - Sino no `Header` mostra não-lidas e permite marcar todas como lidas.

### Mural da comunidade

- `Community` + `MuralForm` / `MuralCard`: mural de mensagens da galera.
- Suporte a **imagens** no mural (upload de foto).
- **Reações** com emojis (clique para reagir, contagem agrupada).
- Paginação: exibe 50 itens por vez.
- Modal de exclusão com confirmação; contador de mensagens no cabeçalho.
- Em tempo real (Supabase Realtime). Banidos não postam (RLS).

### Lives + chat em tempo real

A aba `Lives` exibe duas categorias de conteúdo lado a lado via **sub-tabs**:

**Sub-tabs:**
- **Da comunidade** — lives de posts comuns (sem `live_kind`).
- **Gameplays** — `live_kind = 'gameplay'`.
- **Reacts** — `live_kind = 'react'`.
- **Outros** — `live_kind = 'outro'` (com label livre definido pelo autor).

**Lives de jogadores** (`LiveGoModal`):
- Botão "Ficar ao vivo" na aba Lives abre um modal `createPortal`.
- O usuário informa: título, link da live (Twitch ou YouTube detectado
  automaticamente), e tipo (Gameplay / React / Outro).
- Para "Outro": campo de texto livre (`kindLabel`) é obrigatório — ex.:
  "Speedrun", "Ranqueada", "Just Chatting".
- Internamente cria um post com `is_live = true`, `live_kind` e
  `live_kind_label`. Reutiliza toda a infraestrutura existente de
  chat/moderação/presença/player.
- `LivesList` exibe badge de plataforma + badge de `live_kind`.

**Player e chat:**
- `Lives` lista posts com `is_live = true`; player `EmbedPlayer` embutido.
- **`EmbedPlayer` padronizado**: `VideoPlayer` compartilhado entre Twitch e
  YouTube — mesmo cabeçalho "AO VIVO", link para a plataforma, tratamento de
  `expires_at` (hook `useExpired`), tela "Live encerrada". Antes o YouTube não
  tinha esse tratamento, apenas a Twitch.
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
um rank especial de **Fundador** (laranja), fora da escala de XP — com card
visual exclusivo na página `Ranks`. A página `Ranks` mostra o rank atual,
progresso do sub-rank, breakdown de XP e a tabela de fontes. O rank também
aparece como **borda do avatar** e no `AvatarPopup`.

### Perfis

- **Perfil próprio** (`Profile`): edição de bio, nascimento, estado, plataforma,
  estilo de jogo, jogos favoritos e redes (Discord/Twitch/YouTube); **upload de
  avatar** com compressão para 400×400 JPEG; stats (posts, likes recebidos, XP)
  e visualização de rank/progresso.
- **Perfil público** (`UserProfile`, rota `/u/:username`): mesmos dados em modo
  leitura + posts do usuário (excluídas as lives de jogador); cálculo de idade a
  partir da data de nascimento.
- `AvatarPopup`: card flutuante com resumo do perfil ao clicar num avatar,
  incluindo atalho para banir (se o viewer tiver hierarquia para isso).

### Painel Admin / Super Admin

`Admin.jsx` — painel multi-aba (acesso de `admin` para cima):

- **Usuários**: busca + filtros por role/banidos; expandir linha para ver
  detalhes; **mudar role** via fluxo de indicação (respeitando hierarquia);
  **banir/desbanir**; **deletar todos os posts** de um usuário; fluxo de
  solicitação de desbanimento.
- **Posts**: listar e deletar posts (paginado em blocos de 20).
- **Moderação**: central de moderação de conteúdo (ver seção abaixo) — fila de
  revisão, denúncias, palavras bloqueadas e histórico de infrações.
- **Mod de Lives**: usuários silenciados (com tempo restante), lives ativas
  (encerrar), lives encerradas (solicitar reativação), fila de solicitações.
- **Keys & Promos**: adicionar/editar/remover keys e promoções (paginado).
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
  (`useDeferredValue`), e-mail, mudar role (`owner_set_role`), ban/unban;
  pode também **aprovar/negar pedidos de desbanimento**.
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
  ou `owner` aprova (`approve_unban_request`) ou nega (`deny_unban_request`).
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
- `mod_report_threshold`, `mod_suspend_threshold`, `mod_ban_threshold` —
  gatilhos do sistema de moderação (ajustáveis na aba Site).

### Logs de auditoria & notificações de admin

- **`admin_logs`**: trilha de auditoria (ação, detalhes, categoria, severidade,
  ator, metadata JSON). Escrito pelo front via `logAudit()` →
  `log_audit_event`, e por várias funções/triggers do banco.
- **`admin_notifications`** + **`admin_notification_reads`**: notificações para
  admins (audiência `all_admins` ou `super_admin`), com controle de lidas por
  admin. Geradas por triggers (`notify_admin_new_user`, `notify_admin_new_live`,
  `notify_admin_reactivation_request`) e por funções de ban/segurança.

### Moderação de conteúdo

Sistema de moderação com **denúncias da comunidade**, **filtro de palavras** e
**revisão humana**, com ações sempre **reversíveis** (soft-hide, nunca delete
automático). Fluxo: filtro barato síncrono → ocultação automática por denúncias
→ fila de revisão do admin → escalação de infrações.

- **Denunciar** (`ReportModal`): botão ⚑ em posts, comentários e mural (oculto
  para o próprio autor e para visitantes). 6 motivos (spam, ódio, conteúdo
  adulto, assédio, desinformação, outro) + detalhe opcional. Cada usuário só
  denuncia o mesmo conteúdo uma vez (`UNIQUE (reporter_id, content_type,
  content_id)`).
- **Filtro de palavras** (`blocked_words` + `useBlockedWords`): wordlist com
  severidade, lida no cliente (cache React Query 5min) e checada **antes de
  enviar** post/comentário (`checkContent` faz matching parcial). Bloqueio
  síncrono, sem custo de API.
- **Ocultação automática** (`hidden_at` + trigger `trigger_report_auto_hide`):
  ao atingir `mod_report_threshold` (3) denúncias, o conteúdo é ocultado
  (soft-hide) e entra na fila. As políticas RLS de SELECT escondem conteúdo
  oculto de não-admins; admins+ veem com banner "⚠ Oculto por denúncias".
- **Fila de revisão** (`moderation_queue` + `ModerationQueue`): admin vê preview
  do conteúdo + denúncias, escolhe uma ação (aviso / ocultar / suspender) e
  decide **confirmar a ocultação**, **restaurar** o conteúdo ou **banir** o
  autor direto.
- **Infrações e escalação** (`violations` + trigger `trigger_violation_escalation`):
  cada ação confirmada vira pontos (warn 1, hide 2, suspend_1d 5, suspend_7d 10).
  Ao somar `mod_ban_threshold` (15) pontos, `apply_mod_auto_ban` **bane o usuário
  automaticamente** (com cascade da atividade, log e notificação aos admins).
- **Suspensão temporária** (`profiles.suspended_until` + `apply_suspension`): as
  ações `suspend_1d`/`suspend_7d` **bloqueiam o usuário de criar conteúdo** (post,
  comentário, mural, chat) pelo período, via RLS (os `WITH CHECK` de INSERT
  excluem `banned` **ou** `suspended_until > now()`). O usuário continua
  navegando/lendo — diferente do ban, que tranca o site. A UI mostra um aviso
  (`SuspendedNotice`) no lugar do campo de criação. A coluna é protegida no
  `guard_profile_privileged_cols` (o suspenso não limpa sozinho).
- **Painel** (`ModerationPanel`, aba Admin) com sub-abas: **Fila**, **Denúncias**
  (filtráveis por status), **Palavrões** (CRUD) e **Infrações** (histórico
  paginado, filtro por usuário).

Thresholds ficam em `site_config` (`mod_report_threshold`, `mod_ban_threshold`,
`mod_suspend_threshold`), editáveis pela aba **Site** do painel do Owner.

---

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
  dono pela pasta `auth.uid()/...`.
- **`post-media`** (público): imagens/vídeos/áudios dos posts; upload por
  autenticados, delete pelo dono do post. `cacheControl: 31536000` (1 ano)
  — paths únicos por post/timestamp, nunca sobrescritos, cache longo seguro.

> Os buckets são públicos para leitura via URL (CDN), mas **não** permitem
> *listar* arquivos — o acesso por URL pública continua funcionando.

### Realtime

Publicação `supabase_realtime` inclui: `posts`, `post_media`, `profiles`,
`community_posts`, `live_chat`, `live_chat_timeouts`, `admin_logs`,
`admin_notifications`, `site_config`. Usada para feed, mural, chat de lives,
detecção de ban, banner/manutenção e sincronização dos painéis.

### React Query

Cache client-side via `@tanstack/react-query` (`lib/queryClient.js`):
`staleTime 30s`, `refetchOnWindowFocus false`, `retry 1`.

Migrados: `Keys`, `Ranks`, `Home`, `Community`, abas do Owner (`PainelTab`,
`MetricasTab`, `NotificacoesTab`, `LogsTab`, `UsuariosTab`), `Header`
(notificações), `Sidebar` (stats), `RightPanel` (keys/promos + stats).

---

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
  abertas a `anon` as do fluxo de login (`check_login_status`,
  `register_login_attempt`) e a leitura de XP (`get_user_xp`).
- Notificações geradas por triggers `SECURITY DEFINER` — INSERT direto do
  cliente removido; banidos não burlam filtros via INSERT de notification.
- RLS consolidada: políticas múltiplas permissivas unificadas; bug "banido ainda
  posta" corrigido (INSERT de posts/community_posts era OR'd — agora AND).
- **Hierarquia de moderação imposta no DELETE** (`can_moderate_content`): admin
  não apaga mais conteúdo de super_admin/owner; owner passou a moderar de fato.
  No cliente, os serviços de delete usam `count: 'exact'` e tratam 0 linhas
  como erro real (acabou o "sucesso" falso quando o RLS bloqueia).
- Bloqueio de login server-side; tela de banido em tempo real.
- `auth_rls_initplan`: `auth.uid()` envolto em `(select auth.uid())` em todas
  as políticas — evita re-avaliação por linha.
- Headers de segurança na Vercel (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, etc.).
- Trilha de auditoria de ações sensíveis.

> A política de segurança e os pontos de melhoria são revisados periodicamente
> pelo plano de auditoria em 3 fases descrito no `CLAUDE.md`.

---

## 🎨 Convenções de código

Detalhadas no `CLAUDE.md`. Resumo:

- **Animações** via variantes compartilhadas em `src/lib/motion.js` para o site
  (`fadeTab`, `gridContainer`/`gridCard`, `listContainer`/`listItem`); variantes
  exclusivas da landing em `src/lib/landingMotion.js` (`heroTitle`, `heroFade`,
  `fadeUpReveal`, `staggerContainer`, `expandPanel`). Não duplicar.
  Transição de página global com `PageTransition` + `AnimatePresence`.
- **Ícones**: Lucide para UI; `react-icons/fa6` para marcas.
- **Modais** estilizados via `createPortal` (sem `window.prompt/confirm`).
- Tema em `src/index.css` (classes `.card`, `.btn-neon/.btn-solid/.btn-purple`,
  `.tag-*`, `.input-gamer`).
- **Arquivos pequenos**: ~300 linhas como guia; extrair UI repetida em
  componentes, lógica em hooks/utils, acesso a dados em services.
- **Testes** unitários da lógica pura em `src/lib/__tests__/` (Vitest).
  RPCs/RLS validadas em transação `DO`/`ROLLBACK` antes de aplicar em produção.
