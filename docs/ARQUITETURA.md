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

## ⚡ O caminho crítico de carregamento

> Levantado por um Lighthouse em produção em 27/08/2026 e corrigido em 28/08.
> O diagnóstico era específico: **o servidor respondia em 30 ms**, o HTML
> chegava rápido, e todo o custo estava no que o navegador fazia depois.

**A conta que engana.** A página inteira transferia 387 KiB, mas o Lighthouse
media 13,9 s de main thread. Os dois números só batem quando se percebe que o
custo de CPU é proporcional ao JavaScript **descompactado**: o chunk da cena 3D
tem 236 KB comprimidos e **887 KB** depois de descompactar. Peso de rede e
trabalho de CPU são contas diferentes.

**As quatro regras que saíram disso:**

| Regra | Onde vive | Por quê |
| --- | --- | --- |
| `lazy()` separa o chunk, **não adia o download** | `landing/Scene3D.jsx` | O componente montava com o Hero, então o pedido saía no primeiro instante. Era caminho crítico com outro nome |
| Decoração cara é **opcional por aparelho** | `Scene3D.decidirModo()` | Tela < 1024px, `saveData`, 2g/3g, ≤ 2 núcleos ou `reduce-motion` recebem a `Scene2D` (SVG + CSS, custo de JS zero) |
| `@import` de CSS externo cria **cadeia serial** | `index.html` | `preconnect` economiza handshake, não descoberta. O CSS de fonte agora é `<link>` com `media="print"`/`onload` |
| `manualChunks` **vence** `import()` dinâmico | `vite.config.js` | Os caminhos casam `/node_modules/<pacote>/` inteiro. A regra antiga (`/react/`) arrastava `@sentry/react` para o `vendor-react` |

**Toda espera precisa de teto absoluto.** As duas esperas introduzidas aqui —
a cena 3D e o Sentry — liberam sozinhas se o gatilho não vier. A primeira
versão da cena esperava o evento `load`, que só dispara quando todo recurso
inicial termina: com o Google Fonts inalcançável, `readyState` ficou em
`interactive` por 9 s e a cena nunca montou. Enfeite que some não gera erro,
não gera log e não quebra teste — é a falha silenciosa do `CLAUDE.md` §1.5.

**Resultado medido no build** (o antes/depois de campo depende de rodar o
Lighthouse no mesmo aparelho):

| | Antes | Depois |
| --- | --- | --- |
| JS inicial (`index` + `vendor-react`) | 541,7 kB | **458,3 kB** |
| Cena 3D no caminho crítico | 887 kB | **0** (depois do ocioso, e só no desktop) |
| Prints da landing | 227 KB | **94 KB** |
| Sentry | dentro do chunk inicial | 85 kB, sob demanda |

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
