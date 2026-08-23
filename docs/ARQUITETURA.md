# Arquitetura

> Como o código está organizado: pastas, rotas, camada de dados e as convenções
> que valem em todo lugar. Para *o que* cada tela faz, ver
> [FUNCIONALIDADES.md](FUNCIONALIDADES.md). Para tabelas e RPCs, ver
> [BANCO.md](BANCO.md).

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
│   ├── image.js           # Compressão/resize client-side antes do upload (economia de egress)
│   ├── storage.js         # Remoção de arquivos do bucket ao deletar post/mural
│   ├── auditLog.js        # logAudit() -> RPC log_audit_event
│   ├── url.js             # safeExternalUrl() — só http(s) vira href (anti-XSS)
│   ├── logMeta.js         # Fonte única de categorias/ícones/retenção dos logs
│   ├── like.js            # Curtida otimista com rollback quando o servidor recusa
│   ├── ranks.js           # Tiers de XP, cálculo de rank, fontes de XP
│   ├── embed.js           # getEmbedInfo() — parsing de URLs YouTube/Twitch/TikTok/Instagram
│   ├── format.js          # Formatação de números (1K, 1M...)
│   ├── password.js        # Força de senha (compartilhado Login/AuthConfirm)
│   ├── date.js            # Cálculo de idade / idade mínima de cadastro
│   ├── csv.js             # Geração + download de CSV (export de logs)
│   ├── wordlist.js        # Match de palavra inteira do filtro de moderação
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
                           # LazyVisible, PageTransition
```

> Fora de `src/`: **`db/`** guarda scripts SQL avulsos para rodar no SQL Editor
> do Supabase (índices, retenção, correções de RPC). Não são migrations
> automáticas — cada arquivo diz como rodar e o que conferir antes.

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


---

[← voltar para o README](../README.md)
