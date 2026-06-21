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
- ✅ Exportar logs de auditoria (CSV) no painel do dono — botão "Exportar CSV" na
  aba Logs (`LogsTab`), respeita os filtros ativos, busca até 5000 linhas via
  `owner_get_audit_logs`, gera CSV no cliente (`lib/csv.js`, RFC 4180 + BOM
  UTF-8). Testado o escaping (vírgula/aspas/quebra/objeto/null). *(no README)*

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

## 🛡️ Sistema de Moderação de Conteúdo — FASE 1 ✅ FEITA

> **Status:** **Fase 1 (MVP) implementada e no ar.** Reports + wordlist +
> violations + escalação + aba admin completos. Documentado no README.
> Próximas fases (IA) dependem de chave de API externa do dono — ver abaixo.

### Decisões do dono (já tomadas, não perguntar de novo)

| Questão | Decisão |
|---|---|
| Escopo inicial | **Fase 1 MVP** — reports + wordlist + violations + escalação + aba admin |
| APIs externas | **Só gratuitas** — OpenAI Moderation API (texto + imagem) e Google Safe Browsing |
| Ação automática | **Soft-hide + fila para revisão humana** (reversível, nunca ban direto) |

---

### Fase 1 — MVP ✅ FEITA

Migration `moderation_phase1` aplicada + 9 arquivos de frontend. Build limpo,
RLS conferido. O que entrou:

- ✅ **Tabelas:** `reports`, `blocked_words`, `violations`, `moderation_queue`
  (todas com RLS: reporter vê os próprios; admin+ vê tudo; `blocked_words` tem
  SELECT público pro filtro client-side).
- ✅ **Coluna `hidden_at`** em `posts`, `comments`, `community_posts` (soft-hide
  reversível). Políticas SELECT recriadas (`posts_select`/`comments_select`/
  `community_posts_select`): não-admin não vê conteúdo oculto; admin+ vê com
  banner "⚠ Oculto por denúncias".
- ✅ **Trigger `trigger_report_auto_hide`:** ao atingir `mod_report_threshold`
  (3) denúncias no mesmo conteúdo → preenche `hidden_at` + enfileira em
  `moderation_queue` (sem duplicar item pendente).
- ✅ **Trigger `trigger_violation_escalation` + `apply_mod_auto_ban`:** soma os
  pontos das `violations` do usuário; ao atingir `mod_ban_threshold` (15) → ban
  automático pelo sistema (SECURITY DEFINER, sem caller role, com cascade da
  atividade + log + notificação aos admins). Pontos por ação: warn 1 / hide 2 /
  suspend_1d 5 / suspend_7d 10.
- ✅ **Thresholds em `site_config`:** `mod_report_threshold=3`,
  `mod_ban_threshold=15`, `mod_suspend_threshold=8`.
- ✅ **`moderationService.js`** — createReport, fetchReports, updateReportStatus,
  fetchModerationQueue, resolveQueueItem, fetchBlockedWords, add/removeBlockedWord,
  fetchViolations, addViolation, hideContent, restoreContent.
- ✅ **`useBlockedWords.js`** — React Query (TTL 5min) + `checkContent(text)`.
- ✅ **`ReportModal.jsx`** — modal de denúncia (6 motivos + detalhe), padrão do site.
- ✅ **Botão ⚑ Denunciar** em `PostCard`, `CommentCard`, `MuralCard` (oculto pro
  próprio autor e pra anon) + banner de "oculto por denúncias".
- ✅ **Filtro wordlist síncrono** no `PostForm` e `CommentSection` (bloqueia o
  submit antes de ir pro banco). **Match de palavra inteira** (`lib/wordlist.js`,
  via `\p{L}` nas bordas) — não casa substring (ex.: "ass" não bloqueia
  "classe"/"massa"/"passar"), tolerante a pontuação e case-insensitive. Testado
  (9 casos: substring não casa / palavra inteira casa / acento difere / frase).
- ✅ **Aba "Moderação" no Admin** (`ModerationPanel`) com 4 sub-abas:
  `ModerationQueue` (fila + seleção de ação + ban direto), `ReportsList`
  (denúncias filtráveis por status), `WordlistManager` (CRUD palavrões com
  severidade), `ViolationsPanel` (histórico paginado + filtro por usuário).

**Pendências menores da Fase 1:**
- ✅ `suspend_1d`/`suspend_7d` **materializam suspensão temporária real** — feito
  (migration `moderation_temp_suspension`): coluna `profiles.suspended_until`,
  RLS de INSERT bloqueia suspenso em post/comentário/mural/chat,
  `apply_suspension(user_id, days)` com hierarquia, coluna protegida no
  trigger-guarda, aviso `SuspendedNotice` na UI. Testado em ROLLBACK (5 casos:
  suspenso não posta / limpo posta / expirado posta / admin suspende comum /
  admin não suspende owner).
- ✅ Denúncia de **mensagens do chat de live** — feito (botão ⚑ no `ChatPanel`,
  `content_type='chat'`). As denúncias caem na aba Denúncias para o admin agir
  com as ferramentas de mod de live; chat não tem auto-hide (é efêmero).
- ✅ Editar os thresholds pela aba **Site** do Owner — feito (`SiteTab` com 3
  campos numéricos: ocultar / suspender / banir).

---

### Fase 2 — Moderação IA de texto ⏸️ EM STANDBY (adiada — sem orçamento agora)

> **Status:** **em standby por decisão do dono** — sem código construído.
> Motivo: a OpenAI exige conta com billing ativado (~US$5 de crédito) para
> liberar **qualquer** quota, mesmo a Moderation API sendo gratuita por chamada.
> Quando testamos com a chave passada, o endpoint retornou **HTTP 429** em toda
> chamada (sem headers `x-ratelimit-*`/`retry-after`, `type: invalid_request_error`)
> — chave válida, mas **conta com quota zero**. O dono não pode pagar nada agora,
> então isso fica parado. **Nada foi escrito/deployado** (regra do CLAUDE.md:
> não entregar código não testável).
>
> **Para retomar no futuro** (qualquer uma destas destrava):
> 1. Ativar billing na OpenAI (platform.openai.com → Settings → Billing,
>    ~US$5), gerar chave nova (a antiga vazou no chat — revogar), guardar como
>    secret `OPENAI_API_KEY` no Supabase (Edge Functions → Secrets) e avisar.
> 2. **OU** avaliar alternativa gratuita sem billing (ver abaixo).
>
> **Alternativas gratuitas a investigar quando retomar** (não exigem cartão):
> - **Modelo local de toxicidade no cliente** — ex. `@tensorflow-models/toxicity`
>   (TensorFlow.js) roda no browser, sem API/custo; porém só inglês e adiciona
>   peso ao bundle. Avaliar custo-benefício.
> - **Perspective API (Google)** — gratuita, suporta português, mas exige
>   solicitar acesso/quota. Sem cartão.
> - **HuggingFace Inference API** — tier gratuito com modelos de toxicidade
>   multilíngues; também via Edge Function.
> - Por ora, a **wordlist síncrona da Fase 1 já cobre o caso mais comum**
>   (palavrões/termos banidos) sem nenhuma dependência externa.

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

### Fase 3 — Moderação IA de imagem (futuro) ⏸️ depende da Fase 2

> Mesma dependência da Fase 2 (chave OpenAI com billing) — fica em standby junto.

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

## 🔬 Auditoria de Custos, Performance & Escalabilidade (jun/2026)

> **Status:** auditoria **só de diagnóstico** — nada implementado, nenhum
> arquivo de lógica alterado. Conduzida com o projeto **pausado**, sem tocar no
> Supabase (pra não gerar egress), a partir do código-fonte +
> `DATABASE_SCHEMA_BACKUP.sql`. Contexto: a org estourou o **Cached Egress**
> (13,3 GB / 5 GB do plano Free) — a lente desta auditoria é **custo de
> recurso**, não feature. Atacar na ordem das ondas (final da seção) ao retomar.
>
> Origem: prompt "Auditoria Completa de Custos, Performance e Escalabilidade".
> Cada item: **problema · impacto hoje · impacto futuro · motivo técnico · plano**.

### 🔴 Crítico (driver direto de egress / risco de estourar cota)

- ⬜ **C1 — Imagens de post e mural sobem SEM compressão/resize.**
  - *Problema:* o avatar é comprimido (`Profile.jsx` → canvas 400px, JPEG 0.85),
    mas imagens de post (`PostForm.jsx`) e de mural (`MuralForm.jsx`) vão **cruas**
    pro bucket, só com teto de tamanho (5MB). Uma foto de celular de 4MB é
    servida em resolução total pelo CDN.
  - *Impacto hoje:* cada visualização baixa o arquivo full-res → é o **maior
    driver de egress** depois do vídeo (que já limitamos pra 10MB).
  - *Impacto futuro:* cresce linearmente com (nº de imagens × nº de
    visualizações). É exatamente o padrão que estourou a cota.
  - *Motivo técnico:* sem resize/recompressão client-side, o tamanho do arquivo
    = tamanho do egress por view; sem `WebP` perde-se ~30% extra.
  - *Plano:* extrair a `compressImage` do `Profile.jsx` para `lib/image.js`
    (reutilizável), aplicar em `PostForm`/`MuralForm` antes do upload
    (resize p/ ~1280px no maior lado, JPEG/WebP qualidade ~0.8). Aditivo, baixo
    risco. **Maior ganho de egress por esforço.**

- ⬜ **C2 — N+1 de queries no feed/mural + coluna `posts.likes` morta.**
  - *Problema:* cada `PostCard` dispara, ao montar, **3 queries** (contagem de
    likes + status de like + `post_media`). Feed de 30 posts = **~90 requests**.
    O mural tem o mesmo padrão (`MuralCard`, ~3/card). Pior: existe a coluna
    desnormalizada `posts.likes integer DEFAULT 0` mas **nenhum trigger a
    mantém** — o feed conta `post_likes` ao vivo (N+1), enquanto
    `fetchProfileStats` e `owner_get_metrics` ("top posts") **ordenam/somam por
    `posts.likes`, que está sempre 0** (stats de likes do perfil e ranking de
    posts hoje estão errados/zerados).
  - *Impacto hoje:* ~90 requests por carga de feed = carga de DB + egress de API
    multiplicada por cada usuário que abre a home.
  - *Impacto futuro:* escala com (posts × usuários). É o gargalo de banco nº 1.
  - *Motivo técnico:* dado relacional buscado por item em vez de em lote/join;
    desnormalização existente não conectada.
  - *Plano (resolve as duas coisas de uma vez):*
    1. Trigger `AFTER INSERT/DELETE ON post_likes` que mantém `posts.likes`
       (e equivalente p/ `community_post_likes`). Backfill único dos contadores.
    2. Feed passa a **ler `posts.likes` direto** (zero query de contagem por card)
       e a trazer `post_media(*)` **aninhado no select** do feed (1 query em vez
       de 30). Status "eu curti" em **lote** (1 query `in(post_ids)`).
    3. `fetchProfileStats`/`owner_get_metrics` passam a usar o contador correto.
  - *Cuidado:* mudar o shape do retorno do feed exige ajustar `PostCard` junto
    — pede plano + validação (regra do CLAUDE.md). Fazer gradual.

- ⬜ **C3 — Realtime `event:'*'` sem filtro em tabelas quentes + publicação inchada.**
  - *Problema:* `useRealtime('posts', ...)` (Home) escuta **todas** as mudanças
    de `posts` (INSERT/UPDATE/DELETE) e transmite pra **todos** os clientes no
    feed — mas o handler só usa INSERT/DELETE. Toda edição de post, e (depois do
    C2) toda mudança de `posts.likes`, viraria broadcast pra todo mundo. Além
    disso a publicação `supabase_realtime` inclui `post_media` e `admin_logs`
    (tabela de auditoria de alto volume) — `admin_logs` só interessa a um punhado
    de admins, mas é publicada globalmente. `profiles` usa **REPLICA IDENTITY
    FULL** (manda a linha inteira a cada update).
  - *Impacto hoje:* baixo (poucos usuários), mas é **egress de realtime que
    cresce com (mudanças × conexões)** — o tipo de custo que não aparece até
    escalar e aí dói.
  - *Impacto futuro:* com N usuários no feed, cada like/edição = N mensagens.
  - *Motivo técnico:* `postgres_changes` sem `event`/`filter` específico assina
    o fluxo inteiro da tabela.
  - *Plano:* (a) `useRealtime` aceitar `event` e `filter` opcionais; Home assinar
    só `INSERT`; (b) revisar a publicação — tirar `post_media` (a UI já refaz via
    retry) e `admin_logs` (o painel admin pode usar refetch/poll dedicado);
    (c) avaliar `REPLICA IDENTITY` default + filtro no watch de ban (só precisa
    de `id` + `banned`). Validar cada passo isolado.

### 🟠 Alto impacto

- ⬜ **A1 — Polling de ban a cada 20s, por usuário.**
  - *Problema:* `useAuth` já tem subscription realtime no próprio `profile` pra
    detectar ban, **e ainda** roda `setInterval(fetchProfile, 20000)` como
    fallback — um `SELECT * FROM profiles` por usuário a cada 20s.
  - *Impacto futuro:* 1.000 usuários logados = ~50 queries/s permanentes só de
    fallback de ban, 24/7, mesmo sem ninguém fazer nada.
  - *Motivo técnico:* fallback redundante com o realtime no caminho feliz.
  - *Plano:* subir o intervalo p/ 60s **e** só pollar com a aba visível
    (`document.visibilityState`); ou disparar o revalidate só no `visibilitychange`.
    Mudança pequena e segura. (Já está no backlog como "afinar detecção de ban".)

- ⬜ **A2 — Zero retenção em tabelas de log/efêmeras (sem pg_cron).**
  - *Problema:* `admin_logs`, `login_attempts`, `notifications` e `live_chat`
    crescem **sem teto**. Chat de lives encerradas há meses continua no banco. Não
    há nenhum job pg_cron de limpeza.
  - *Impacto hoje:* pequeno; *futuro:* infla `Storage Size` do banco (já em 21%),
    deixa queries/índices mais lentos e aumenta o custo de backup.
  - *Motivo técnico:* tabelas append-only sem TTL.
  - *Plano:* job(s) pg_cron de limpeza: `admin_logs` > 90 dias, `login_attempts`
    resolvidos > 30 dias, `notifications` lidas > 30 dias, `live_chat` de lives
    encerradas > 7 dias. Tudo reversível e parametrizável. Rodar primeiro como
    `SELECT count(*)` pra dimensionar antes de deletar.

- ⬜ **A3 — Avatar sem `cacheControl` (re-download de hora em hora).**
  - *Problema:* `uploadAvatar` (`profileService.js`) não passa `cacheControl` →
    usa o default do Supabase (~1h). Os uploads de `post-media` já usam 1 ano.
  - *Impacto:* o avatar de cada usuário é re-baixado do CDN ~1×/hora por viewer —
    egress recorrente e evitável (avatar aparece em todo card do feed).
  - *Motivo técnico:* sem `cacheControl` longo, o CDN revalida cedo.
  - *Plano:* `cacheControl: '31536000'` no upload de avatar — o cache-buster
    `?t=${Date.now()}` que já gravamos na URL garante a invalidação na troca.
    Fix de 1 linha, ganho recorrente.

### 🟡 Médio impacto

- ⬜ **M1 — `SELECT *` no feed e no perfil.** `POST_SELECT` e `fetchProfile`
  trazem todas as colunas (inclusive `ban_details`, `ban_reason`, campos que a
  UI não usa no card). *Plano:* enumerar só as colunas necessárias por contexto —
  reduz payload/egress de cada request. Baixo risco, gradual.
- ⬜ **M2 — `fetchUserLikesCount` redundante / stats inconsistentes.** Recalcula
  likes a partir de `post_likes` quando deveria usar o contador desnormalizado
  (depende do C2). Some junto com o C2. *Plano:* unificar a fonte de verdade dos
  contadores após o trigger do C2.
- ⬜ **M3 — Bundle 3D ~880KB (≈237KB gzip).** O chunk `LandingScene` (three +
  fiber) é o maior asset. **Já é lazy** (`Scene3D` só carrega na landing e
  respeita `prefers-reduced-motion`) e é servido pela **Vercel, não pelo
  Supabase** — então **não** pesa no egress que estourou. Fica como melhoria de
  UX/performance de carregamento, não de custo Supabase. *Plano (opcional):*
  importar só o necessário de three, simplificar geometrias.

### 🔵 Baixo impacto

- ⬜ **B1 — Presence global num canal único** (`gamerhub-presence`): todo usuário
  online entra no mesmo canal; cada `sync` recalcula o estado. Cresce com
  usuários simultâneos (tendência O(N) de tráfego de presença). Hoje irrelevante;
  revisitar se "online agora" passar de algumas centenas.
- ⬜ **B2 — Retry de mídia** no `PostCard`/`MuralCard` (até 4×/3×) dispara queries
  extras quando a mídia demora a subir. Aceitável; o C2 (media aninhada no feed)
  reduz a necessidade.
- ℹ️ **B3 — Busca/filtro client-side** sobre os 30 posts carregados: não é custo,
  é limitação funcional (já consta no backlog como "busca server-side no feed").

---

### 🏆 Ranking — 10 maiores consumidores potenciais de recurso

> Estimativa **qualitativa** do ganho ao otimizar cada um (lente: egress + carga
> de banco). Ordem = prioridade de ataque.

| # | Item | Recurso | Ganho esperado ao otimizar |
|---|------|---------|----------------------------|
| 1 | C1 — Imagens sem compressão | Egress (Storage CDN) | **Altíssimo** — corta o maior driver de egress restante |
| 2 | C2 — N+1 no feed + `posts.likes` morta | DB + Egress de API | **Altíssimo** — ~90 → ~2 requests por feed |
| 3 | C3 — Realtime `*` + publicação inchada | Egress de Realtime | **Alto (escala)** — evita explosão com nº de conexões |
| 4 | A2 — Sem retenção (pg_cron) | Storage de banco | **Alto (longo prazo)** — segura o crescimento do DB |
| 5 | A1 — Polling de ban 20s | DB (queries constantes) | **Alto (escala)** — remove carga de fundo por usuário |
| 6 | A3 — Avatar sem cacheControl | Egress (CDN) | **Médio** — corta re-download horário, fix trivial |
| 7 | M1 — `SELECT *` | Egress de payload | **Médio** — payloads menores em todo fetch |
| 8 | B1 — Presence global | Realtime | **Médio (só em escala)** |
| 9 | M3 — Bundle 3D | Egress Vercel (não Supabase) | **Médio (UX)** — não afeta a cota que estourou |
| 10 | B2 — Retry de mídia | DB | **Baixo** — somado ao C2 quase some |

---

### 🗺️ Plano de implementação (ondas — atacar nesta ordem ao retomar)

Cada onda é **aditiva, validável e reversível**; testar (build + ROLLBACK no
Supabase quando mexer em banco) ao fim de cada uma antes da próxima.

- **Onda 1 — Egress rápido, baixo risco (aditivo puro):**
  C1 (compressão de imagem em post/mural) · A3 (cacheControl no avatar) ·
  C3-a (realtime do feed só `INSERT`) · A1 (poll 20s→60s + visibilidade).
  *→ ataca direto o que estourou a cota, sem mudar contrato de dados.*
- **Onda 2 — Carga de banco (precisa de migration + ajuste de UI casado):**
  C2 (trigger de `posts.likes` + backfill → feed lê contador + `post_media`
  aninhada + like-status em lote) · M2 (unificar stats) · M1 (`SELECT` enxuto).
  *→ derruba o N+1; exige plano dedicado e validação (muda shape do feed).*
- **Onda 3 — Retenção & realtime estrutural:**
  A2 (jobs pg_cron de limpeza) · C3-b/c (enxugar publicação `supabase_realtime`,
  revisar `REPLICA IDENTITY`).
  *→ segura o crescimento de longo prazo do banco e do realtime.*
- **Onda 4 — Estrutural / futuro (decisão do dono):**
  Migração de mídia pro **Cloudflare R2** (10GB egress grátis/mês, egress
  ilimitado R2↔Cloudflare CDN) — solução definitiva se o site crescer ·
  M3 (aligeirar bundle 3D) · B1 (presence em escala).

---

## 💡 Ideias soltas (a avaliar)

> Espaço pra jogar ideias de feature que surgirem, sem compromisso. Quando
> decidir fazer, promover pra uma seção acima com prioridade.

- _(adicionar aqui conforme surgirem)_
