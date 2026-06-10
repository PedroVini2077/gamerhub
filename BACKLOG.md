# 📋 GamerHub — Backlog & Roadmap

> Lista viva do que **queremos fazer mas ainda não foi feito** — geralmente
> porque é grande, arriscado ou depende de decisão. Nada aqui está pronto.
> Conforme as coisas forem sendo feitas, movemos para o `README.md` (o que
> existe) e marcamos/removemos daqui.
>
> Legenda de status: ⬜ a fazer · 🟡 em andamento · ✅ feito (mover pro README)
> Prioridade: 🔴 crítico · 🟠 importante · 🟢 recomendado · 🔵 futuro

---

## 🔴 Crítico

- ✅ **Escalada de privilégio em `profiles`** — qualquer usuário logado conseguia
  se auto-promover a `owner` / se auto-desbanir via UPDATE direto. Corrigido com
  trigger-guarda `guard_profile_privileged_cols` + RPC `admin_set_role`.
  *(feito — documentar no README quando consolidar a seção de segurança)*

---

## 🟠 Importante

### Banco / Segurança
- ✅ **Owner agora pode aprovar/negar pedidos de desban.** `approve_unban_request`
  e `deny_unban_request` trocaram a checagem de `role = 'super_admin'` estrito
  para `role NOT IN ('super_admin','owner')` — mudança aditiva, não altera o
  caminho do super_admin. Testado em transação com ROLLBACK usando usuários
  reais (owner aprova ✓, owner nega ✓, admin comum continua bloqueado ✓) antes
  de aplicar via migration. *(migration `allow_owner_review_unban_requests`)*
- 🔒 **Proteção contra senha vazada (HIBP) — não disponível agora (precisa
  upgrade pro plano Pro).** Localizada em **Authentication → Sign In/Providers
  → Email → "Prevent use of leaked passwords"** — confirmado visualmente: o
  toggle aparece mas fica travado, com aviso "*Only available on Pro plan and
  above*". A organização (`PedroVini2077's Org`) está no **plano Free**, então
  não é "ação pendente do dono" — é limitação de plano mesmo. Reavaliar se/quando
  decidirem fazer upgrade pro Pro (~US$25/mês).
- ⬜ **Mover extensão `pg_net`** do schema `public` para um schema dedicado.
  *Adiado de propósito: `ALTER EXTENSION ... SET SCHEMA` pode quebrar
  webhooks/triggers que referenciam `net.*`. Baixo benefício × risco real —
  fazer só com janela de teste dedicada.*
- ✅ **Revogar `EXECUTE` de `anon`** nas funções `SECURITY DEFINER` admin/owner e
  de pós-login (defesa em profundidade — `REVOKE ... FROM PUBLIC, anon` + `GRANT
  ... TO authenticated`). Abertas a anon só as do fluxo de login
  (`check_login_status`, `register_login_attempt`) e `get_user_xp`. Testado em
  ROLLBACK. *(documentado no README)*
- ✅ **Endurecer INSERT de `notifications`** — feito: notificações de like/
  comentário agora são geradas por trigger SECURITY DEFINER
  (`notify_post_like` / `notify_post_comment`), respeitando notif_likes/
  notif_comments; policy "sempre-true" removida e INSERT direto do cliente
  retirado de `PostCard`/`CommentSection`. *(documentar no README)*

### Frontend / Arquitetura
- ✅ **Camada de Services (`src/services/`)** — migrado o acesso ao Supabase das
  páginas/componentes para serviços por domínio: `postService`, `profileService`,
  `communityService`, `liveService`, `keyService`, `authService`. (Os painéis
  admin/owner ainda chamam RPCs direto via `supabase.rpc` — tudo bem, são chamadas
  pontuais; consolidar num `adminService`/`ownerService` fica como melhoria futura
  se a duplicação crescer.) *(documentado no README)*

---

## 🟢 Recomendado

### Quebrar arquivos grandes (sem mudar comportamento/visual) — ✅ feito
- ✅ **`Admin.jsx`** → `components/admin/*` (UsersPanel, PostsPanel, LivesPanel,
  KeysPanel, NotifsPanel, LogsPanel, SuperAdminPanel).
- ✅ **`Owner.jsx`** → `components/owner/*` (um arquivo por aba).
- ✅ **`Lives.jsx`** → `LivesList`, `ChatPanel`, `ModPanel`.
- ✅ **`Login.jsx`** → `LoginForm`, `RegisterForm`, `ForgotForm`, `InputWrap`.

### Banco / Performance (impacto cresce com o volume — hoje é pequeno)
- ℹ️ **`unused_index` (advisor)**: ~15 índices (quase todos de FK) aparecem como
  "não usados". **Mantidos de propósito** — são índices de chave estrangeira /
  colunas de join que passam a ser usados conforme o volume cresce. Removê-los
  agora prejudicaria escalabilidade. Não é dívida; é precaução.
- ✅ **`auth_rls_initplan`**: `auth.uid()` envolvido em `(select auth.uid())`
  em todas as políticas. Verificado em ROLLBACK (anon/user/admin). *(feito)*
- ✅ **`multiple_permissive_policies`**: consolidadas em `posts`, `community_posts`,
  `comments`, `profiles` (UPDATE) e `admin_logs` (SELECT). **Bônus de segurança:**
  o INSERT de `posts`/`community_posts` tinha 2 políticas permissivas OR'd que
  anulavam a regra "banido não posta" — agora é AND numa só política (furo
  fechado, validado em ROLLBACK e em produção). **`site_config` SELECT** também
  consolidado: a policy `ALL` do owner virou `INSERT/UPDATE/DELETE`, deixando o
  SELECT só com `select_all`. *(feito)*
- ✅ **Listagem de buckets públicos** (`avatars`, `post-media`): removidas as
  policies amplas de SELECT em `storage.objects` que permitiam listar todos os
  arquivos. Acesso por URL pública (CDN) continua — app só usa `getPublicUrl` +
  `upload`, nunca `.list()`. *(feito)*
- ✅ **Paginação no Admin** — `fetchAll` carregava `posts`/`game_keys` por
  inteiro sem teto (landmine de escalabilidade: hoje são poucas linhas, mas
  cresce com o uso). Agora pagina em blocos de 20 com botão "Carregar mais"
  (`PostsPanel`/`KeysPanel` + `loadMorePosts`/`loadMoreKeys` em `Admin.jsx`,
  via `.range()` + contagem exata `head: true` pros `StatCard`s continuarem
  certos). **`UsersPanel` continua carregando a lista inteira** de propósito —
  busca por username, filtro por role e os badges de contagem dependem do
  dataset completo, e a base de usuários cresce bem mais devagar; só ganhou um
  teto de segurança (`limit(1000)`) pra nunca ficar 100% sem limite. Mudança
  zero-impacto hoje (9 posts/6 keys < 20 = botão nem aparece). *(feito)*
- ✅ **Egress de mídia (alerta de cota do Supabase)** — vídeos brutos até 100MB
  sendo servidos sem compressão estouravam o "cached egress bandwidth" do plano
  free (16 arquivos `.mp4`, 260MB, até 49MB cada). Reduzido o teto de upload de
  vídeo em `PostForm` de **100MB → 25MB** (com dica pro usuário preferir colar
  link do YouTube/Twitch/TikTok pra clipes longos — usa `EmbedPlayer`, sem
  consumir storage/egress do site) e adicionado `cacheControl: 31536000` (1
  ano) nos uploads de `post-media` — caminhos são únicos por post/timestamp
  (nunca sobrescritos), então cache longo no CDN é seguro e reduz egress
  repetido. *(feito — compressão de vídeo client-side ficou de fora: exigiria
  ferramenta pesada tipo ffmpeg.wasm, peso/risco não compensa agora)*

### Qualidade de código
- ✅ Consolidar helpers duplicados: força de senha → `lib/password.js`; idade /
  data mínima de nascimento → `lib/date.js`. *(feito)*
- ✅ Padronizar senha mínima em **8** caracteres (Settings agora alinhado ao
  Login; validação de email no Settings via regex completa). *(feito)*
- ✅ Acessibilidade: `aria-label` nos botões só-ícone do `PostForm`; `alt` nas
  imagens de prévia/thumbnail. *(feito)*
- ✅ Guarda de cancelamento em `PostCard` (evita setState após desmontar / race
  entre respostas de mídia/likes). *(feito)*
- 🟡 **Padronizar tratamento de erro nas queries** (envelopar respostas dos
  services num formato único `{ data, error }`). *Avaliado: hoje os 6 services
  (`postService`, `profileService`, etc.) retornam formatos diferentes —
  alguns só `data`, alguns `{ data, error }`, alguns `{ url, error }`, alguns
  nada. Mudar a **assinatura** de ~30 funções espalhadas por ~10 componentes é
  refactor estrutural de verdade: qualquer `const { data } = await fetchX()`
  que vire `{ data, error }` quebra silenciosamente se o consumidor não for
  ajustado junto — exatamente o tipo de mudança que o CLAUDE.md pede plano +
  aprovação antes (não é "aditiva e segura", é mudar contrato). Além disso o
  React Query já absorve a maior parte do tratamento de erro nas páginas
  migradas. Fica para quando fizer sentido revisar os services como um todo —
  não uma "leva" de consolidação casual.*
- ✅ **Skeletons de loading** — trocados os últimos textos `"Carregando..."` em
  listas por skeletons (`animate-pulse` + `bg-dark-700 rounded`, no padrão já
  usado em `Home`/`UsuariosTab`/`LogsTab`): `NotifsPanel`, `SuperAdminPanel`
  (bloqueados + pedidos de desban), `Admin.jsx` (loading geral) e `Lives.jsx`.
  Os "Carregando..." que sobraram são labels de botão (`Salvando...`,
  `Atualizar`, `Carregar mais`) — esses são textuais por natureza, não viram
  skeleton. *(feito)*
- 🟡 **Baseline de lint** (`npm run lint`): **0 erros, 34 warnings** (era 45).
  Os erros
  que sobravam eram regras de "React Compiler readiness" do preset
  (`set-state-in-effect`, `refs`, `purity`, `immutability`) + `react-refresh`,
  disparando em padrões idiomáticos/funcionando. Como o projeto **não usa o
  React Compiler**, foram **rebaixadas a `warn`** no `eslint.config.js` (decisão
  consciente, reversível — ver comentário lá). Correções limpas já feitas: dead
  code removido, `getEmbedInfo` → `lib/embed.js`, `MediaCarousel` sem effect.
  *Falta (gradual):* migrar data-fetch pra **React Query** (resolve os 16
  `set-state-in-effect` + 16 `exhaustive-deps` de verdade) e os poucos
  `refs/purity` validando um a um. Sem pressa — não são bugs, são estilo.

---

## 🔵 Futuro

- 🟡 **Cache de dados — React Query** (`@tanstack/react-query`): dedupe de
  requests, invalidação, sincronização entre componentes. **Em migração
  gradual.** Fundação pronta (`lib/queryClient.js` + `QueryClientProvider` no
  `App.jsx`; defaults: `staleTime 30s`, `refetchOnWindowFocus false` pra poupar
  egress, `retry 1`).
  Migrados: `Keys`, `Ranks` (read-only); `Home`, `Community` (realtime via
  `useRealtime` invalidando/recarregando a query); abas do Owner —
  `PainelTab`, `MetricasTab`, `NotificacoesTab` (realtime + refetch),
  `LogsTab` (paginação server-side virou parte da `queryKey`), `UsuariosTab`;
  `Header` (notificações — `markAllRead` usa `queryClient.setQueryData` pra
  manter o update otimista local), `Sidebar` (stats compactos) e `RightPanel`
  (keys/promos + stats — duas queries independentes).
  Resultado: lint **45 → 34 warnings**, `set-state-in-effect`/`exhaustive-deps`
  caíram bastante — *de verdade*, não escondido (o padrão `useEffect`+`setState`
  que disparava os warnings deixou de existir nesses arquivos).
  **Ficam de fora de propósito** (avaliados e descartados, não esquecidos):
  - `Lives` — chat/presença/timeouts/timers são event-driven e mutáveis, não
    mapeiam pra `useQuery`; forçar traria ganho marginal e risco de quebrar o
    chat ao vivo.
  - `SiteTab` (Owner) — é editor de config com estado local otimista
    (toggle → salva na hora), não uma lista de leitura; migrar exigiria
    `useMutation` + updates otimistas pra ganho nenhum.
  - **`Admin.jsx`** — ~10 funções de fetch interdependentes (`fetchAll` +
    `fetchLiveMod`/`fetchLogs`/`fetchNotifications`/`fetchBlockedLogins`/
    `fetchUnbanRequests`...), um canal realtime único que despacha por aba
    ativa (`tabRef`/`logCatRef`) e a paginação nova (`loadMorePosts`/
    `loadMoreKeys`) já integrada no fluxo. Migrar é refatoração estrutural
    grande com risco real de quebrar banimento/moderação/notificações — pede
    plano dedicado e aprovação antes, não cabe nesta leva gradual.
  *Resta (com plano à parte, não cabe nesta leva):* `Admin.jsx`.
- ⬜ **Paginação / virtualização** em listas longas (usuários, logs, posts, chat).
  *(Admin já pagina posts/keys — ver seção Performance acima.)*
- ⬜ **Migração para TypeScript** (introduz a pasta `types/`).
- 🟡 **Testes** — Vitest configurado; **unitários da lógica pura prontos**
  (`src/lib/__tests__/`: ranks/XP, password, date, embed, format — 30 testes).
  **Integração das RPCs/RLS validada** (manual, em transação `DO`/`ROLLBACK`,
  simulando `authenticated` + claims JWT — nada tocou produção). Cobertura:
  - `register_login_attempt`/`check_login_status`: bloqueio temp na 5ª, sem
    double-count durante o bloqueio, permanente na 10ª, normalização de email.
  - `ban_user`/`unban_user`: hierarquia (comum não bane; admin não bane igual/
    superior; admin bane comum com cascade total da atividade; só super_admin+
    desbane).
  - Guarda de privilégio + RLS de `profiles`: sem auto-promoção a owner, sem
    auto-desban, edição da própria bio ok, edição de perfil alheio bloqueada.
  - `get_user_xp`: fórmula conferida (posts/likes/comentários/lives + bônus).
  - `admin_set_role`/`owner_set_role`: todas as fronteiras de autorização.
  *(scripts não commitados — regra do CLAUDE.md de script de teste avulso.)*
  *Falta:* E2E dos fluxos críticos (login, postar, banir). Crescer gradualmente.
- ⬜ **Soft delete** de posts (campo `deleted_at` em vez de delete físico).
- ⬜ **2FA** no login.
- ⬜ Afinar detecção de ban (hoje realtime + polling de 20s como fallback).
- ⬜ Exportar logs de auditoria (CSV) no painel do dono.

---

## 🎯 Features aprovadas

- ✅ **Likes em comentários** — tabela `comment_likes` (RLS espelhando
  `post_likes`, SELECT público + INSERT/DELETE da própria linha) + trigger
  `notify_comment_like` (SECURITY DEFINER, respeita `notif_likes`, ignora
  self-like). Service `fetchCommentLikeStatus`/`likeComment`/`unlikeComment`,
  hook `useCommentLike`, botão de coração no `CommentCard`. Testado em ROLLBACK
  com dados reais antes de aplicar.
- ✅ **Responder comentários** (threads/replies) — coluna `comments.parent_id`
  (self-FK, `ON DELETE CASCADE`) + índice. `notify_post_comment` atualizado:
  resposta notifica o autor do comentário pai ("respondeu seu comentário");
  comentário raiz continua notificando o dono do post. UI achatada em 1 nível
  (respostas de respostas viram irmãs sob a raiz) com composer inline.
  Testado em ROLLBACK (raiz/reply/self-reply/cascade) antes de aplicar.

---

---

## 🛡️ Sistema de Moderação de Conteúdo — EM ANDAMENTO

> **Status:** Arquitetura definida, perguntas respondidas, **Fase 1 aprovada para
> implementação.** A sessão acabou antes de começar o código — retomar daqui.

### Decisões do dono (já tomadas, não perguntar de novo)

| Questão | Decisão |
|---|---|
| Escopo inicial | **Fase 1 MVP** — reports + wordlist + violations + escalação + aba admin |
| APIs externas | **Só gratuitas** — OpenAI Moderation API (texto + imagem) e Google Safe Browsing |
| Ação automática | **Soft-hide + fila para revisão humana** (reversível, nunca ban direto) |

---

### Onde paramos

Apresentamos o plano detalhado da Fase 1 e o dono aprovou. A sessão expirou
antes de escrever uma linha de código. Na próxima sessão: **começar a
implementação direto, sem perguntas** — o plano está aqui.

---

### Fase 1 — MVP (implementar agora) 🟡

#### Banco de dados — migrations a criar

**1. Tabela `reports`**
```sql
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post','comment','mural','chat')),
  content_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','hate','nsfw','harassment','misinformation','other')),
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at timestamptz DEFAULT now()
);
-- RLS: reporter vê só seus próprios; admin+ veem tudo
```

**2. Tabela `blocked_words`**
```sql
CREATE TABLE blocked_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text UNIQUE NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);
-- RLS: SELECT público (anon/auth) pra funcionar no cliente; INSERT/UPDATE/DELETE só admin+
```

**3. Tabela `violations`** (histórico de infrações confirmadas por um moderador)
```sql
CREATE TABLE violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text,
  content_id uuid,
  reason text,
  action_taken text CHECK (action_taken IN ('warn','hide','suspend_1d','suspend_7d','ban')),
  points int NOT NULL DEFAULT 1,
  reviewed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
-- RLS: usuário vê só as próprias; admin+ veem tudo
```

**4. Tabela `moderation_queue`** (itens aguardando revisão humana)
```sql
CREATE TABLE moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('report','wordlist','ai')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
-- RLS: só admin+ lê/escreve
```

**5. Coluna `hidden_at`** nas tabelas de conteúdo
```sql
ALTER TABLE posts ADD COLUMN hidden_at timestamptz;
ALTER TABLE comments ADD COLUMN hidden_at timestamptz;
ALTER TABLE mural_posts ADD COLUMN hidden_at timestamptz;
-- Conteúdo com hidden_at != null fica invisível para não-admins
-- Admins+ veem com banner "⚠ Oculto por denúncias"
```

**6. Trigger de auto-hide** (3 reports = oculta + enfileira)
```sql
-- Trigger em `reports` que conta reports do mesmo content_id
-- Quando count >= [threshold em site_config], preenche hidden_at
-- e insere em moderation_queue com trigger_type='report'
```

**7. Sistema de pontos e escalação** (via `violations`)
```
warn     = 1pt
hide     = 2pt
suspend_1d = 5pt
suspend_7d = 10pt
ban      = direto (via ban_user existente)

Thresholds configuráveis em site_config (chaves: mod_warn_threshold,
mod_suspend_threshold, mod_ban_threshold)
Trigger em violations: ao INSERT, soma pontos do user_id e aplica escalação
automática chamando ban_user() se atingir o threshold de ban.
```

#### Frontend — componentes a criar

**`src/services/moderationService.js`** (novo)
- `fetchReports(filters)` — lista de denúncias com filtros
- `createReport({ contentType, contentId, reason, details })` — submete denuncia
- `fetchModerationQueue(status)` — fila de revisão paginada
- `approveHide(queueId, contentType, contentId)` — confirma ocultação
- `restoreContent(contentType, contentId)` — desfaz ocultação
- `fetchBlockedWords()` — lista para cache no cliente
- `addBlockedWord(word, severity)` — admin+
- `removeBlockedWord(wordId)` — admin+
- `fetchViolations(userId?)` — histórico de infrações

**`src/hooks/useBlockedWords.js`** (novo)
- Wrapper React Query: busca `blocked_words`, TTL 5min
- Exporta `checkContent(text)` → `{ blocked: bool, word: string | null }`
- Usado no PostForm e CommentSection antes de submeter

**`src/components/ui/ReportModal.jsx`** (novo)
- Modal no padrão do site (`createPortal`)
- Props: `contentType`, `contentId`, `onClose`
- Radio buttons de motivo + textarea de detalhes
- Submit chama `createReport` + toast de confirmação
- Não mostra para anon nem para o próprio autor do conteúdo

**`src/components/moderation/ModerationQueue.jsx`** (novo)
- Lista de itens da fila (cards com preview do conteúdo + dados do report)
- Actions: "Confirmar ocultação" | "Restaurar" | "Banir usuário"
- Paginação (blocos de 20)

**`src/components/moderation/WordlistManager.jsx`** (novo)
- CRUD de palavras bloqueadas (tabela + form inline)
- Colunas: palavra, severidade, data, criador, ações

**`src/components/moderation/ViolationsPanel.jsx`** (novo)
- Histórico de infrações filtráveis por usuário/tipo/período

#### Modificações em arquivos existentes

| Arquivo | O que muda |
|---|---|
| `src/pages/Admin.jsx` | Nova aba "Moderação" com sub-abas: Fila / Denúncias / Wordlist / Violações |
| `src/components/feed/PostCard.jsx` | Botão "⚑ Denunciar" no menu (oculto para o próprio autor); hidden_at → banner cinza |
| `src/components/feed/CommentCard.jsx` | Idem |
| `src/components/community/MuralCard.jsx` | Idem |
| `src/components/PostForm.jsx` (ou onde está o form de criar post) | Validação wordlist antes de submeter via `checkContent()` |
| `src/services/postService.js` | `fetchFeedPosts` filtra `hidden_at IS NULL` pra não-admins |
| `src/services/communityService.js` | Idem pra mural |

#### Ordem de implementação recomendada

1. Banco (migrations: tabelas → colunas hidden_at → trigger de auto-hide → trigger de escalação → RLS)
2. `moderationService.js` + `useBlockedWords.js`
3. Filtro wordlist no PostForm / CommentSection
4. `ReportModal.jsx` + botão "Denunciar" nos cards
5. Ocultar conteúdo com `hidden_at != null` (feed / mural / perfil)
6. Admin: aba Moderação com ModerationQueue + WordlistManager + ViolationsPanel
7. Build + teste manual completo antes de commitar

---

### Fase 2 — Moderação IA de texto (futuro / gratuito) ⬜

Usar **OpenAI Moderation API** (gratuita, sem limite de uso documentado,
suporta português):
- Endpoint: `POST https://api.openai.com/v1/moderations`
- Payload: `{ "model": "omni-moderation-latest", "input": "<texto>" }`
- Retorna categorias: `hate`, `harassment`, `sexual`, `violence`, `self-harm`,
  `illicit`, etc. com scores 0–1
- Chamada via **Supabase Edge Function** (não expor a API key no cliente)
- Fluxo: POST de conteúdo → Edge Function chama Moderation API → se score
  alto (> threshold) → insere em `moderation_queue` com `trigger_type='ai'`
  e aplica soft-hide
- Edge Function existente `send-email` serve de referência de padrão

Thresholds configuráveis em `site_config`. Moderação assíncrona (não bloqueia
o POST do usuário — conteúdo aparece, se reprovado é ocultado após ~1-2s).

---

### Fase 3 — Moderação IA de imagem (futuro / gratuito) ⬜

**OpenAI Moderation API (omni-moderation-latest)** também suporta imagens
via URL pública:
```json
{
  "model": "omni-moderation-latest",
  "input": [{"type": "image_url", "image_url": {"url": "<public_url>"}}]
}
```
- Imagens do `post-media` têm `getPublicUrl` → URL passável direto
- Mesma Edge Function da Fase 2 aceita `input` como array misto

---

### Fase 4 — Moderação de vídeo (futuro — custoso) ⬜

- Frame sampling: extrair 1 frame/segundo via ffmpeg.wasm (pesado) ou
  via Edge Function com biblioteca de extração
- Cada frame enviado para a Moderation API de imagem
- Alternativa: só moderar thumbnail (mais leve, menos cobertura)
- Depende de decisão sobre upgrade do plano Supabase para mais recursos

---

### Fase 5 — Google Safe Browsing (futuro / gratuito) ⬜

Para links postados (embed_url, links no texto):
- API gratuita (1M requests/dia): verifica se URL é phishing/malware/unwanted
- Também assíncrono via Edge Function
- Posts com link perigoso: hidden + notificação ao admin

---

### Notas de arquitetura importantes

- **Sempre soft-hide, nunca delete automático.** O moderador humano tem a
  palavra final. Ação automática reversível.
- **`site_config` como centro de configuração:** thresholds de reports para
  auto-hide, thresholds de pontos para escalação, toggle de cada fase ativa/
  inativa — tudo lá, editável pelo dono sem deploy.
- **A Edge Function de moderação IA não precisa de tier pago do Supabase** —
  Edge Functions estão disponíveis no plano Free (500k invocações/mês).
- **OpenAI Moderation API é grátis e multilíngue** — funciona bem em
  português, não exige Fine-tuning.
- **Reutilizar `ban_user()` existente** — a função já existe, já tem hierarquia,
  já faz cascade. O trigger de escalação só precisa chamá-la.

---

## 💡 Ideias soltas (a avaliar)

> Espaço pra jogar ideias de feature que surgirem, sem compromisso. Quando
> decidir fazer, promover pra uma seção acima com prioridade.

- _(adicionar aqui conforme surgirem)_
