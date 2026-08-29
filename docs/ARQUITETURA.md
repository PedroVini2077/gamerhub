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
│   ├── useAuth.jsx        # Sessão, perfil e ações de autenticação. É a raiz da
│   │                      # árvore e o arquivo de maior risco do projeto (§7)
│   ├── useVigiaDeBanimento.js # Realtime + poll de 60 s que detectam ban durante
│   │                      # o uso. Saiu do useAuth em 29/08 — testável isolado
│   ├── usePresenca.js     # Canal de presence: quantos estão online agora
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
│   ├── framesDeVideo.js   # Extrai 3 quadros de um vídeo no navegador, para a
│   │                      # moderação de imagem analisar (ver MODERACAO-IA.md).
│   │                      # Aceita o arquivo local OU a URL já publicada — o
│   │                      # plano B de quando o navegador recusa o `blob:`
│   ├── quadroDesenhado.js # `nadaFoiDesenhado`: quadro transparente prova que o
│   │                      # `drawImage` não teve o que desenhar
│   ├── erroDeMidia.js     # Traduz os 4 `MediaError` — cada um aponta para um
│   │                      # lugar diferente, e uma frase só mentia sobre três
│   ├── paginacaoDePosts.js# Faixa da página por sub-aba no painel de posts
│   ├── resolucaoDaCena.js # Regra pura de resolução adaptativa da cena 3D
│   │                      # (fora do React porque a metade que importa — a
│   │                      # cena SOBE de resolução — não dá para provar num
│   │                      # navegador sem GPU)
│   ├── motion.js          # Variantes Framer Motion compartilhadas (fade, grid, list)
│   └── landingMotion.js   # Variantes de animação exclusivas da landing (hero, reveal, stagger)
├── services/              # Camada de acesso a dados (Supabase) por domínio
│   ├── postService.js     # Posts, likes, mídia, comentários, lives ativas
│   ├── profileService.js  # Perfis, XP, stats, avatar, preferências
│   ├── communityService.js# Mural da comunidade
│   ├── liveService.js     # Chat de live, silenciamentos
│   ├── keyService.js      # Keys/promos, stats do site
│   ├── authService.js     # Trocar senha/email, deletar conta
│   ├── moderationService.js # Denúncias, fila, wordlist, infrações, hide/restore
│   └── moderationAiService.js # As chamadas de IA (Edge Functions), separadas
│                            # do resto em 29/08: o de cima fala com TABELAS e
│                            # devolve `{data,error}` para a tela; este fala com
│                            # EDGE FUNCTIONS por `fetch`, é fire-and-forget, e
│                            # tem que gritar sozinho (§1.5)
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
    │                      # LandingShot, Scene2D, Scene3D, BotaoCena3D
    │   └── scene3d/       # LandingScene (createRoot + extend seletivo), Lightning,
    │                      # SceneObjects (LogoBolt/FloatingShapes), ResolucaoAdaptativa
    └── ui/                # Avatar, AvatarPopup, BanModal, BannedScreen,
                           # ConfirmModal, ReasonModal, ReportModal, SuspendedNotice,
                           # EmbedPlayer, MediaCarousel, MediaLightbox, MediaPlayer,
                           # AudioRecorder, GlobalBanner, FeatureGate,
                           # LazyVisible, PageTransition
```

**Fora de `src/`** — atualizado em 28/08, porque esta nota só citava `db/`:

| Pasta | O que guarda |
| --- | --- |
| `supabase/migrations/` | **A verdade sobre o schema.** As migrations que recriam o banco do zero |
| `supabase/functions/` | Espelho das Edge Functions em produção. Editar aqui e implantar, nunca o contrário — os testes de contrato leem daqui |
| `scripts/` | Portões que rodam no CI: orçamento de bytes, documentação quebrada, ignorar deploy da Vercel; e o relatório de documentação envelhecida |
| `e2e/` | Testes em navegador de verdade: rotas, fluxos autenticados, painel de admin, portas das Edge Functions, e o laço da cena 3D |
| `docs/regras/` | As seções grandes do `CLAUDE.md`, puxadas por `@import` — valem como se estivessem lá dentro |
| `db/` | Scripts SQL avulsos para o SQL Editor e os relatórios de auditoria (`AAAA-MM-DD-*.md`). Não são migrations |

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
tinha 236 KB comprimidos e **887 KB** depois de descompactar (hoje, depois da
troca por `createRoot`, são 183 KB e 708 KB). Peso de rede e
trabalho de CPU são contas diferentes.

**As quatro regras que saíram disso:**

| Regra | Onde vive | Por quê |
| --- | --- | --- |
| `lazy()` separa o chunk, **não adia o download** | `landing/Scene3D.jsx` | O componente montava com o Hero, então o pedido saía no primeiro instante. Era caminho crítico com outro nome |
| Decoração cara é **opcional por aparelho** | `Scene3D.decidirModo()` | Tela < 1024px, `saveData`, 2g/3g, ≤ 2 núcleos ou `reduce-motion` recebem a `Scene2D` (SVG + CSS, custo de JS zero) |
| `@import` de CSS externo cria **cadeia serial** | `index.html` | `preconnect` economiza handshake, não descoberta. O CSS de fonte agora é `<link>` com `media="print"`/`onload` |
| `manualChunks` **vence** `import()` dinâmico | `vite.config.js` | Os caminhos casam `/node_modules/<pacote>/` inteiro. A regra antiga (`/react/`) arrastava `@sentry/react` para o `vendor-react` |
| **O custo de uma cena WebGL é por PIXEL**, não por byte nem por objeto | `scene3d/ResolucaoAdaptativa.jsx` + `lib/resolucaoDaCena.js` | Cinco chamadas de desenho por quadro, e ainda assim a thread principal ficava 99% ocupada. Ver a medição abaixo |

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

### `[29/08]` A conta que faltava: o custo por PIXEL da cena 3D

As otimizações acima mexeram em **bytes**, e o dono continuou vendo 58 no
PageSpeed do desktop, com 31,3 s de thread principal — dos quais 30.182 ms em
"Other". Byte não explicava aquilo.

Medido num navegador de verdade (`PerformanceObserver` de `longtask`, janela de
8 s com o Hero na tela, build de produção):

| Configuração | Quadros | Long tasks | Thread bloqueada |
| --- | --- | --- | --- |
| `dpr [1, 1.5]` + `antialias` (como estava) | 88 | 88 | **8.066 ms de 8.000 ms** |
| `dpr 1`, sem `antialias` | 133 | 132 | 7.897 ms |
| `dpr 0,75` | 182 | 9 | 468 ms |
| `dpr 0,5` | 243 | **0** | **0 ms** |
| resolução adaptativa (como está) | 236 | 1 | 52 ms |

A thread principal ficava **99% ocupada** enquanto a cena estivesse visível, e
cada quadro isolado passava dos 50 ms que definem uma long task — a mesma conta
do TBT. Não é um degrau, é um penhasco, porque o custo é proporcional a pixel.

Isso também resolve a contradição dos dois PageSpeed do dono: o do **celular**
marcou TBT **0 ms** e o do **desktop**, 31 s. Não é inconsistência de medição —
a cena não sobe abaixo de 1024px (`lib/cena3D.js`), então o celular nunca pagou
por ela.

**Por que adaptativo e não um número fixo:** a medição acima é em rasterização
por software (SwiftShader), que é o que o Lighthouse, o PageSpeed e qualquer
máquina com GPU bloqueada usam. Numa máquina com GPU, cinco chamadas de desenho
não custam nada — cravar 0,5 puniria quem não tem problema nenhum. A cena
começa no degrau mais barato e sobe se os quadros couberem em 60 fps; se
descer uma vez, não volta a subir (resolução piscando é pior de olhar do que
resolução baixa e estável).

**Travado nos dois lados:** `e2e/cena-3d.mjs` reprova se a cena bloquear a
thread principal acima de 800 ms na janela de 2 s (medido: 0 ms com a correção,
2.151 ms com o bug reinjetado), e `src/lib/__tests__/resolucaoDaCena.test.js`
cobre a subida, que nenhum navegador sem GPU deste ambiente consegue exercitar.

### `[29/08]` E o que sobrou depois disso era CARGA, não laço

Com o laço resolvido, um A/B da landing com e sem a cena, sob freio de CPU de
4×, isolou o que restava:

| | Long tasks | Thread principal |
| --- | --- | --- |
| landing **sem** a cena 3D | 2 | 177 ms |
| landing **com** a cena | 6 | 697 ms |

A cena respondia por **520 ms**, e o laço já dava zero long tasks — ou seja, era
tudo parse e execução dos 888 kB. Isso mudou a natureza do item de chunk que
estava no backlog como 🔵 "bytes para rede lenta": ele passou a ser o gargalo
que sobrava.

A troca de `<Canvas>` por `createRoot` (o `<Canvas>` traz o sistema de eventos
de ponteiro, que esta cena nunca usa) deu **888 → 708 kB** e **520 → 428 ms**.
Os dois números andando juntos confirmam a proporcionalidade. O raciocínio
completo e a correção da explicação antiga estão em
[DESEMPENHO.md](DESEMPENHO.md).

**No mesmo lote:** o `HUB` do título da landing — que é o **elemento de LCP** —
animava `text-shadow`, que não roda no compositor. Era o "1 elemento animado"
do aviso "Evitar animações não compostas": o maior texto da página repintado na
thread principal, 60 vezes por segundo, para sempre. Agora o brilho é estático
e só a `opacity` anima.

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
