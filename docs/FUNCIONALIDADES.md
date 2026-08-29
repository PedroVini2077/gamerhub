# Funcionalidades

> O que cada parte do site faz, do ponto de vista de quem usa. A **moderação**
> tem arquivo próprio ([MODERACAO.md](MODERACAO.md)) por ser o subsistema mais
> complexo do projeto.

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
- Canvas React Three Fiber carregado sob demanda (lazy) com `Suspense`. É o
  maior asset do site (~236 KB gzip, 887 KB descompactados) e é puramente
  decorativo, então `Scene3D` nem baixa o chunk quando não vai ser aproveitado.
  A decisão inteira mora em `lib/cena3D.js`, e os portões são:
  `prefers-reduced-motion`, `navigator.connection.saveData`, `deviceMemory ≤ 1`,
  `hardwareConcurrency ≤ 2` e largura de janela `< 1024px`. Todas as APIs são
  opcionais — quando uma não existe, ela não opina.
- **A escolha do visitante vence o portão.** `BotaoCena3D` deixa ativar ou
  desativar a cena, e a preferência fica no navegador (é de aparelho, não de
  pessoa).
- **`[28/08]` O laço de animação para quando a cena sai da tela.** Um
  `IntersectionObserver` desliga o `frameloop` do `<Canvas>`. Sem isso a cena
  continuava desenhando 60×/s para quem já tinha rolado para longe. Travado por
  `e2e/cena-3d.mjs`.
- **`[29/08]` E a resolução se ajusta ao aparelho enquanto ela ESTÁ na tela.**
  O item acima resolvia só metade: com a cena visível, cada quadro custava ~92 ms
  e a thread principal ficava **99% ocupada** (8.066 ms de bloqueio numa janela
  de 8 s, medido em navegador de verdade). O custo de uma cena WebGL é por
  **pixel**, então a cena passou a começar em `dpr` 0,5 e subir até 1 se os
  quadros couberem em 60 fps — 52 ms de bloqueio na mesma janela. O `antialias`
  saiu. `e2e/cena-3d.mjs` agora reprova bloqueio acima de 800 ms, e
  `lib/resolucaoDaCena.js` tem a regra pura com teste da subida, que nenhum
  navegador sem GPU consegue exercitar.

  > **Correção `[28/08]`:** este trecho listava "conexão 2g/3g" como portão. O
  > `effectiveType` foi **removido** no mesmo dia: era o único que mudava com o
  > tempo, então a mesma máquina trocava de modo entre visitas. Ver
  > [DECISOES.md](DECISOES.md).
- **`LogoBolt`**: raio 3D sólido extrudado (silhueta do ícone Zap da marca),
  cresce de escala 0→1 com `easeOutCubic` ao aparecer; acompanhado por um
  `pointLight` (`flashRef`) que estoura no nascimento (intensidade 14→0) e
  decai rápido — "primeiro a luz, depois a forma se revela". Roda
  continuamente no eixo Y, revelando a profundidade da extrusão; zumbido neon
  suave de `emissiveIntensity` sem flickering.
- **`FloatingShapes`**: formas geométricas 3D wireframe flutuantes nos quatro
  cantos — **gem** (dois icosaedros contra-rotativos, verde-neon), **ring**
  (toro, roxo), **diamond** (octaedro, laranja) e **dodeca** (dodecaedro,
  ciano). Todos com `wireframe: true` e `depthWrite: false` para ficarem
  visualmente atrás do raio. O `LogoBolt` usa `renderOrder={1}` para garantir
  que sempre renderize por cima, independente da posição Z. Cada forma
  materializa com overshoot (`easeOutBack`) em cascata temporal
  (`SHAPE_STAGGER = 0.16s`).
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

**`[29/08]` Link para quem está bloqueado.** Abaixo do CTA, um link discreto —
*"Conta bloqueada? Consulte seu caso"* — que leva ao login. Ele é **igual para
todos** e não identifica ninguém: quem está banido já consegue entrar e ver o
andamento do recurso na `BannedScreen`; o que faltava era saber que isso existe.
Identificar o visitante banido foi descartado por privacidade — ver
[DECISOES.md](DECISOES.md).

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
  registrar um usuário no `auth.users` — isso acontece **antes** de qualquer
  confirmação de e-mail (é assim que o Supabase Auth funciona; não dá pra
  verificar existência de e-mail de forma síncrona no cadastro).
- **Cadastros nunca confirmados** (e-mail inválido/inexistente/digitado
  errado): ficam visíveis pro admin em **Admin → Usuários** ("Cadastros
  pendentes de confirmação"), com opção de remover na hora
  (`admin_get_unconfirmed_users` / `admin_delete_unconfirmed_user`, admin+) —
  sem isso o admin via um "usuário" normal mesmo quando o e-mail nunca existiu.
  São removidos automaticamente depois de **7 dias** sem confirmar
  (`cleanup_unconfirmed_signups`, pg_cron `gamerhub-cleanup-unconfirmed`,
  4h30 UTC) — libera o username pra outra pessoa usar.

### Feed de posts

- Criação de posts (`PostForm`) com:
  - Título + conteúdo; categorias `dica` / `curiosidade` / `news`.
  - Até **10 mídias** por post: imagens (≤5MB) e vídeos (≤10MB — reduzido de
    100MB→25MB→10MB para poupar cota de egress; clipes longos via embed são
    recomendados). As imagens ainda são **comprimidas no browser** antes de
    subir (`lib/image.js`) — o limite de 5MB é do arquivo escolhido, não do que
    vai pro bucket.
  - **Áudio**: upload (≤20MB) ou **gravação pelo microfone** (`AudioRecorder`).
  - **Embeds**: YouTube, Twitch, TikTok (`EmbedPlayer` / `getEmbedInfo`).
    Suporta URLs de `youtube.com/live/` além dos formatos padrão.
  - Marcar embed como **live** (Twitch ou YouTube).
- Exibição (`PostCard`): carrossel de mídias (`MediaCarousel` + lightbox),
  player de áudio (`MediaPlayer`), embeds, likes e comentários.
  - O carrossel só monta quando o card chega **perto da viewport**
    (`LazyVisible`) e o **vídeo só baixa no clique** ("toque para carregar") —
    mídia de post que ninguém rolou até não gasta banda.
  - Curtidas, "eu curti", nº de comentários e a mídia vêm **prontos do feed**
    (busca em lote); o card só faz query própria quando recebe um post solto
    (painel admin/moderação).
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

### Painéis da equipe, banimento, login e auditoria

Tudo o que **a equipe** opera — painéis de admin/super admin/dono,
banimento e desbanimento, bloqueio de login, configuração do site e a
trilha de auditoria — mudou para **[PAINEIS.md](PAINEIS.md)** em 28/08.

O corte é por público: aqui fica o que quem **usa** o site vê; lá, o que
quem **administra** opera.

---

[← voltar para o README](../README.md)
