# 📋 GamerHub — Backlog & Roadmap

> Lista viva do que **queremos fazer mas ainda não foi feito** — geralmente
> porque é grande, arriscado ou depende de decisão. Nada aqui está pronto.
> Conforme as coisas forem sendo feitas, movemos para o `README.md` (o que
> existe) e marcamos/removemos daqui.
>
> Legenda de status: ⬜ a fazer · 🟡 em andamento · ✅ feito (mover pro README)
> Prioridade: 🔴 crítico · 🟠 importante · 🟢 recomendado · 🔵 futuro

---

## 🎯 Fila da faxina — status em 22/08/2026

> Atualizada ao fim da rodada de faxina. O que foi feito está com o resultado
> medido; o que sobrou tem o motivo explícito.

### ✅ Fechados nesta rodada

- ✅ **Teste de fumaça das rotas.** `e2e/smoke.mjs` abre 12 rotas num Chromium
  de verdade e exige: HTTP < 400, tela não-branca, conteúdo esperado, zero
  exceção de JS e zero `console.error`. **12/12 OK.** Rode com
  `npm run test:e2e` (precisa de `npm run build` + `vite preview` antes).
  *Era a validação devida desde o upgrade do react-router (correção de CSRF).*
- ✅ **Página em branco sem explicação** — achado pelo próprio teste acima. Sem
  as variáveis de ambiente o `createClient` lançava na carga do módulo e o site
  virava uma tela branca, com o motivo só no console. Agora mostra o que falta
  e onde arrumar. Testados os dois lados (é arquivo de alto risco, §7).
- ✅ **`pg_net` fora do `public`.** O plano registrado era impossível — a
  extensão **não suporta `SET SCHEMA`**. E nada no banco usava `net.` (zero
  funções, zero triggers, zero dependentes, sem schema de webhooks). Removida.
  O advisor `extension_in_public` **sumiu**. Reversível com `CREATE EXTENSION`.
- ✅ **C3-b — publicação `supabase_realtime` enxugada.** Saíram `post_media`
  (ninguém assinava) e `admin_logs` (tabela de auditoria de alto volume
  transmitida a todo admin conectado, mesmo com a aba de logs fechada).
  Substituído por `hooks/useVisiblePoll.js`: poll de 30s **só com a aba
  visível**, revalidando no `visibilitychange`.
- ✅ **IA ocultava conteúdo sem deixar rastro.** `apply_ai_moderation` não
  gravava em `admin_logs`. Agora grava `ai_moderation_hidden` com score.
- ✅ **Categoria `moderation` invisível no filtro** — mesmo bug que `live` e
  `profile` já tiveram. Registrada.
- ✅ **14 actions sem ícone, e o teste não pegava.** Duas causas: as chamadas
  viraram helpers locais (`log(`, `done(`) num refactor meu, saindo do alcance
  da varredura; e actions geradas por função do Postgres nunca aparecem em
  `src/`. Corrigido nos dois lados + `ACTIONS_DO_BANCO`.

- ✅ **A moderação por IA detectava e nunca aplicava — 26 de 26 chamadas.**
  `apply_ai_moderation` só tem `EXECUTE` para `service_role`, mas as Edge
  Functions montavam o cliente com a anon key + o JWT do usuário, ou seja
  chamavam como `authenticated`. Toda chamada morria em `permission denied`.
  Ficou invisível porque o erro estava só num `console.error` dentro de uma
  chamada *fire-and-forget*. **A IA acertava** (`harassment=0.888` no log) e o
  ocultamento nunca acontecia. Corrigido em `moderate-text` v9 / `moderate-image`
  v6, junto de 3 brechas que a correção teria aberto — ver
  **`db/2026-08-22-moderacao-ia-nunca-aplicou.md`**. (PR #36)
- ✅ **Texto de moderação vinha do cliente.** Bastava mandar o `content_id` de um
  post alheio junto de uma frase ofensiva para derrubar o post de outra pessoa.
  A função agora **lê o texto da própria linha** e só aceita pedido do autor ou
  da equipe.
- ✅ **Token nunca era validado.** As duas funções têm `verify_jwt` desligado e
  só checavam a *presença* do header `Authorization` — qualquer string passava.
  Agora validam com `auth.getUser()`.
- ✅ **SSRF em `moderate-image`.** Baixava qualquer URL vinda do corpo da
  requisição: quem chamava escolhia o destino do `fetch` que sai de dentro da
  infra da Supabase. Restrito ao storage do próprio projeto.
- ✅ **Cobertura da lista de palavras.** O seed de 161 termos não tinha `cu` nem
  nada em volta, nem os xingamentos banais (`idiota`, `burro`, `cala a boca`),
  nem abreviações (`vtmnc`, `fdc`, `krlh`). ~150 termos adicionados. Corrigida
  também a incoerência de `vai se matar` ser `high` e `se mata` ser `medium`.
  Dois falso-positivos meus removidos na revisão: `vai morrer` como `high` num
  site de **jogos** é censura de fala normal de partida, e `privacy` é palavra
  inglesa comum.
- ✅ **Regra de quem modera a live estava duplicada** em `pages/Lives.jsx` e
  `hooks/useLiveChat.js`, e as duas cópias precisavam concordar entre si **e**
  com a policy de `live_chat_timeouts`. Virou `canModerateLive` em
  `lib/roles.js` com teste travando as 5 combinações. *(O botão "Mod" aparecer
  para usuário comum dono da própria live **não é bug** — espelha exatamente
  `is_staff() OR auth.uid() = posts.user_id`.)*
- ✅ 🔴 **Suspensão era irreversível — admin silenciava para sempre e nem o
  fundador desfazia.** Provado em ROLLBACK com papéis reais: (1) um `admin`
  (rank 2) chamou `apply_suspension(alvo, 36500)` e foi **aceito** — suspenso
  até **2126**, porque `p_days` não tinha teto; (2) o `owner` tentou desfazer
  com UPDATE direto, o comando **passou sem erro** e o trigger
  `guard_profile_privileged_cols` reverteu **em silêncio**; (3) **não existia
  nenhuma função** para tirar suspensão. Somando: suspensão virava banimento
  permanente pulando toda a hierarquia do ban (onde só super_admin/owner
  desbanem). Corrigido com teto de 1–30 dias em `apply_suspension` (mais que
  isso é caso de ban, que tem reversão) e a RPC `lift_suspension`, com a mesma
  regra de hierarquia via `role_rank()`, log, notificação ao usuário e aviso aos
  admins. No painel: badge "suspenso", filtro "Suspensos" e botão "Remover
  suspensão" — antes o admin **nem via** quem estava suspenso, embora
  `admin_list_users` já devolvesse o dado.
- ✅ **Item ficava preso na fila para sempre depois do ban.** `ban_user` faz
  `DELETE FROM posts WHERE user_id = …` e nunca tocava em `moderation_queue`:
  os itens daquele usuário seguiam `pending` apontando para linhas que não
  existem mais, mostrando "Conteúdo não existe mais" sem jeito de sair.
  Corrigido pela classe, não pelo caso — o problema não era do `ban_user`, era
  de **qualquer** caminho que apague conteúdo (autor apagando, admin apagando,
  exclusão de conta, cascade). Trigger `AFTER DELETE` nas 4 tabelas de conteúdo
  resolve a fila e as denúncias juntas. `moderation_queue` e `reports` não têm
  FK para o conteúdo (o `content_id` aponta para 4 tabelas diferentes), por isso
  nada limpava sozinho. Os 2 itens presos foram limpos no mesmo migration.
- ✅ **Item de `chat` na fila caía na tabela errada.** `setHiddenAt` usava
  `else → community_posts`, e a fila **recebe** itens de chat. O painel dizia
  "sem permissão" para um caso que é "esta tabela não tem como ocultar".

### 🛠️ Ferramental — o que já está armado e o que falta

> Levantamento de 23/08 sobre "que braços externos existem pra ajudar".
> Conclusão: o gargalo do projeto nunca foi qualidade de modelo — foi
> **observabilidade** (ninguém sabia que estava quebrado) e **cobertura de
> teste em caminho autenticado**. O ferramental abaixo ataca exatamente isso, e
> os quatro itens somados custam **R$ 0**.

**✅ Já armado**

- ✅ **CI no GitHub Actions** (`.github/workflows/ci.yml`) — `lint`, `test`,
  `build` e `npm audit` a cada PR e a cada push na `main`. Até então isso
  rodava porque eu lembrava; agora a definição de pronto (§2) é verificada por
  máquina. Público é ilimitado; privado são 2.000 min/mês e o nosso gasto é
  ~3 min por PR.
- ✅ **Dependabot** (`.github/dependabot.yml`) — PR semanal agrupado por
  patch/minor. **Major fica de fora de propósito**: já quebrou o site uma vez
  (o upgrade do react-router que motivou o teste de fumaça).
- ✅ **Guarda contra suíte que encolhe em silêncio.** O CI quebrando é o caso
  fácil — fica vermelho e alguém olha. O perigoso é o CI **passar sem testar
  nada**: arquivo renomeado para fora do padrão, `describe.skip` esquecido,
  glob de config alterado. O `vitest` sairia com 0 e o PR ficaria verde — a
  mesma falha silenciosa da §1.5, dentro da ferramenta que deveria pegá-la.
  Piso de 125 testes no `ci.yml`, provado nos dois sentidos (dispara com 12,
  passa com 134). **Ao adicionar testes, subir o piso junto.**
- ✅ **Sentry ligado** (`lib/monitoring.js`) — só erro, sem tracing e sem
  Session Replay, que são os que comem cota. `sendDefaultPii: false` e um
  `beforeSend` que **remove `access_token`/`refresh_token` da URL** antes de
  qualquer coisa sair: o Supabase devolve esses tokens no fragmento em
  confirmação de email e recuperação de senha, e sem a limpeza um erro nessas
  telas mandaria uma sessão válida para dentro do relatório.
  Ligado no `ErrorBoundary`, que até então só fazia `console.error` — a tela
  "Algo deu errado" aparecia e ninguém do outro lado ficava sabendo.
  **Custo medido: +27,8 KB gzip** (507 → 535 KB de JS total).
  O DSN fica no código de propósito: é público por natureza, e depender de uma
  variável na Vercel significaria que esquecer de configurá-la num deploy
  futuro apagaria o monitoramento sem ninguém perceber.

**⬜ Falta — depende de uma ação do dono, e cada um destrava algo**

- ⬜ 🟠 **Variáveis do repositório, pra ligar o teste de fumaça no CI.**
  O job `fumaca` já está escrito e fica pulado enquanto elas não existirem.
  *Settings → Secrets and variables → Actions → **Variables** → New variable:*
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. São **variables**, não
  secrets — a anon key é pública por natureza.
  **Por que importa:** o runner do GitHub alcança o `supabase.co`, e o meu
  ambiente não. É o CI que consegue rodar o que eu não consigo.
- ⬜ 🟢 **Sentry nas Edge Functions.** O frontend já está coberto. As três
  funções (`moderate-text`, `moderate-image`, `moderate-links`) hoje devolvem
  `status` no corpo — o que resolve para quem testa, mas ainda não avisa
  ninguém sozinho. Precisa do SDK Deno do Sentry, é escopo próprio.
- ⬜ 🟢 **Conferir a cota do Sentry depois do primeiro mês.** Free são 5.000
  eventos/mês. Se estourar, o Sentry **descarta em silêncio** — a mesma classe
  de falha que ele existe para acabar. Com 3 usuários não chega perto, mas
  quando a base crescer isto precisa de um olhar.
- ⬜ 🟠 **Conta de teste descartável.** A peça que mais destrava: E2E
  autenticado, a migração do `Admin.jsx` pra React Query e o
  `REPLICA IDENTITY` de `profiles` estão todos parados pela mesma falta.

**❌ Avaliado e descartado, com o motivo**

- ❌ **CodeQL** — US$ 30 por committer/mês, e entrega pouco além do `npm audit`
  para o tamanho deste projeto.
- ❌ **Agregadores de IA** (TypingMind, Monica, MagAI, Team-GPT) — são
  interfaces de **conversa**: não rodam migration, não leem `pg_policies`, não
  abrem PR. Seriam um passo atrás do MCP do Supabase e do GitHub, que já estão
  conectados.
- ❌ **Plugins de terceiros do Claude Code** — o marketplace passou de 200,
  mas plugins executam código arbitrário com o privilégio do usuário e a
  Anthropic não audita servidores MCP. Os dois que importariam aqui (Supabase e
  GitHub) já estão conectados.
- ❌ **PC dedicado** — o CI resolve as mesmas duas limitações do meu ambiente
  (navegador que não alcança o Supabase, realtime que não observo) de graça e
  sem máquina ligada.
- ✅ **Segunda opinião manual em mudança de risco** — não é ferramenta, é
  hábito: antes de aplicar migration que mexe em RLS, hierarquia ou
  `SECURITY DEFINER`, colar o SQL em outro modelo e perguntar "o que pode dar
  errado aqui?". Custo zero, dois minutos, pega ponto cego.

### ⬜ Aberto — precisa de decisão ou janela própria

- ⬜ 🟠 **A IA oculta e não avisa o autor.** Quando `apply_ai_moderation` ou o
  trigger da lista de palavras ocultam algo, o autor não recebe **nada**: o post
  some da timeline dele sem aviso, sem ponto e sem explicação, e fica assim até
  um admin abrir a fila. Do lado de quem postou é indistinguível de um bug — e a
  reação natural é postar de novo. *A notificação só existe quando o admin
  aprova o item na fila* (`notify_user` → sino). Correção é um `INSERT` numa
  função que já existe. **É o buraco mais visível pro usuário final.**
- ⬜ 🟠 **Aprovar na fila sem marcar ação dá zero ponto, em silêncio.** Em
  `ModerationQueue.jsx` a violação só é criada `if (decision === 'approved' &&
  action)`. Toda a escalação automática (8 pontos → suspensão de 7 dias, 15 →
  ban) depende de lembrar de marcar. Se o hábito virar "aprovar e seguir",
  ninguém nunca acumula nada e a punição automática **existe mas nunca dispara**.
  O painel devia exigir a ação, ou no mínimo avisar que aquilo não gera ponto.
- ⬜ 🟢 **Aviso genérico.** "Seu post foi ocultado por violar as regras" não diz
  qual regra. Dizer "por linguagem ofensiva" / "por assédio" educa em vez de só
  punir. Polimento, não falha.
- ⬜ 🟠 **`profiles` no realtime × colunas revogadas — suspeita, não fato.**
  `profiles` está publicada com `REPLICA IDENTITY FULL` (a linha INTEIRA vai no
  payload), mas **10 colunas** foram revogadas de `authenticated` na correção de
  LGPD: `ban_count`, `ban_details`, `ban_reason`, `banned_at`, `banned_by`,
  `banned_by_username`, `birth_date`, `notif_comments`, `notif_likes`,
  `suspended_until`. Nas outras 9 tabelas publicadas, `authenticated` tem SELECT
  em 100% das colunas — `profiles` é a única exceção.
  **Eu não sei** como o Realtime da Supabase trata privilégio de COLUNA (o
  `CLAUDE.md` §1.1 já usava exatamente este caso como exemplo de limite de
  conhecimento). Se ele descartar a mensagem inteira, a detecção de ban por
  realtime está morta e só o poll de 60s segura — o que degrada em silêncio.
  *Como confirmar, e não dá pra fazer daqui:* abrir o site com uma conta,
  banir por outra, e cronometrar. Sumiu na hora = realtime vivo; demorou até
  1 min = só o poll. **Não mexer antes de medir** — `useAuth` é o arquivo de
  maior risco do projeto (§7).
- ⬜ 🟠 **Usuário banido não tem como pedir revisão.** A `BannedScreen` mostra o
  motivo e desloga em 6s: sem botão, sem formulário, sem contato. O
  `request_unban` exige `role = 'admin'` — ou seja, **só um admin abre o pedido
  em nome de outra pessoa**. Isso é coerente com a hierarquia (admin bane mas
  não desbane; super_admin/owner desbanem direto), mas deixa o banido sem
  nenhum canal: o recurso depende de um admin lembrar de abrir sozinho.
  *Mexe em quem pode chamar a RPC — pede aprovação do dono antes.*
- ⬜ 🟠 **Moderação de imagem só cobre pornografia.** O
  `Falconsai/nsfw_image_detection` é binário `nsfw`/`normal`, treinado em porn:
  **não** pega sangue, gore, automutilação, símbolo de ódio nem droga. Plano:
  trocar por `omni-moderation-latest` da OpenAI, que **também aceita imagem**,
  usa a chave já configurada e o endpoint de moderação é gratuito — devolve
  `violence/graphic`, `self-harm`, `sexual` e `sexual/minors` numa chamada só.
  *A confirmar antes de implementar:* que o endpoint continua gratuito e quais
  categorias valem **para imagem** (nem todas valem — não chutar).
  **O jogo de cintura do gore é o ponto central:** nenhum modelo distingue gore
  de Doom de gore real. A saída não é o modelo, é o destino da nota — duas
  faixas, igual à lista de palavras:
  | Categoria | Ação |
  | --- | --- |
  | `sexual/minors`, `sexual`, `self-harm*` | oculta na hora |
  | **`violence/graphic`** | **só enfileira — nunca oculta** |
  Obrigatório num site de jogos: **a maioria das imagens é print de jogo**. Auto-
  ocultar `violence/graphic` derrubaria metade do conteúdo legítimo no primeiro
  dia — seria o falso-positivo do `vai morrer` em escala.
  *Falta no banco:* `apply_ai_moderation` só sabe "oculta e enfileira"; não
  existe "enfileira sem ocultar". Precisa de um parâmetro a mais — aditivo, não
  mexe no caminho que já funciona.
  *Medir antes de escolher o limiar:* rodar prints reais de jogo pelo modelo e
  olhar as notas. Limiar chutado é o que gera falso positivo.
  **Medição real (23/08):** o dono postou foto de um rapaz sem camisa na praia
  com o limiar em 0.05. O log mostra o pipeline inteiro funcionando —
  `POST 200`, imagem baixada, `nsfw_score=0.000`. **Não é bug: é o modelo.**
  Para ele, "sem camisa" é `normal`, e nenhum limiar acima de zero pega 0.000.
  A via de ocultar por imagem foi provada em `ROLLBACK` separadamente
  (`apply_ai_moderation` com `mod_ai_image_threshold` oculta e enfileira), então
  o que falta é só cobertura de modelo — exatamente o que a troca resolve.
- ⬜ **C3-c — `profiles` com `REPLICA IDENTITY FULL`.** *Não mexi de propósito.*
  O `useAuth` lê `payload.new?.banned` para detectar ban, e é o arquivo de
  maior risco do projeto (§7): quebrar derruba o site. É ganho de performance
  **teórico hoje** (2 usuários) contra risco real num controle de segurança.
  *O que falta para fechar com segurança:* uma conta de teste descartável para
  rodar o fluxo ban → detecção → tela de banido ponta a ponta em navegador,
  antes e depois da troca. Com isso, é meia hora.
- ✅ **Canal `admin-realtime` dividido por tempo de vida.** Era um canal só,
  sempre ligado, assinando `posts` com `event:'*'` global. Agora são dois: um
  PERSISTENTE (notificações + pedidos de desban, que precisam chegar em
  qualquer aba) e um SOB DEMANDA (`posts`, timeouts de chat, reativações) que
  só existe enquanto a aba de moderação de lives está aberta.
- ⬜ **Proteção contra senha vazada (HIBP).** É configuração de painel, não dá
  para mexer por SQL/MCP: **Authentication → Sign In/Providers → Email →
  "Prevent use of leaked passwords"**. Era bloqueado no plano Free; vale
  reconferir agora que o projeto saiu da restrição. Checagem de 1 minuto.
- ⬜ **Migrar `Admin.jsx` para React Query.** Ficou mais viável depois do split
  (os fetchers estão em `useAdminData` e nos hooks de domínio) e resolveria de
  verdade os 3 `exhaustive-deps` hoje suprimidos. *Por que não foi feito:* é
  refatoração da camada de dados do painel administrativo — banimento,
  moderação, notificações — e **o painel fica atrás de login, então o teste de
  fumaça não o exercita**. Fazer sem conseguir abrir a tela seria exatamente o
  risco que o backlog já apontava. Destrava junto com a conta de teste.
- ⬜ **Padronizar `{ data, error }` nos services.** ~30 funções, 6 services.
  **Muda contrato** — pede plano + aprovação (§7), não entra de carona.
- ⬜ **Migração para TypeScript.** Grande, decisão do dono.
- ⬜ **E2E dos fluxos** (login, postar, banir). A infra agora existe
  (`playwright` + `e2e/`); falta uma conta de teste descartável.
- ⬜ **Moderação de vídeo.** Adiada a pedido. Nota que muda a conta: dá para
  extrair frames no navegador com `<video>` + `canvas` (API nativa, sem
  ffmpeg.wasm) e mandar pela moderação de imagem que já existe — **custo zero**.
  A premissa "vídeo = gastar mais" não se sustenta.

### 📉 Baseline de lint: 16 → 12 warnings (corrigindo, não suprimindo)

Fechados de verdade, sem `disable`:

- ✅ `Login.jsx` e `LoginForm.jsx` tinham a **mesma** expressão de bloqueio
  escrita à mão nos dois. Viraram `lib/loginBlock.js` — de quebra saiu o
  `Date.now()` do corpo do render.
- ✅ `BannedScreen`: `doSignOut` virou `useCallback`.
- ✅ `CommentSection`: `fetchCommentList` virou `useCallback` por `postId`.

**Os 12 restantes ficam de pé, e isso é decisão consciente.** São quase todos
`set-state-in-effect` do preset de "React Compiler readiness" — o projeto **não
usa** o React Compiler, e a regra já foi rebaixada a `warn` de propósito.
Inspecionei um a um os que ainda não tinha olhado (`UsersPanel`, `EmbedPlayer`,
`ModerationQueue`): são o padrão legítimo de buscar dado assíncrono num efeito;
a regra não enxerga através do `await`. Matá-los exigiria suprimir com
`disable`, o que é maquiar o número, não melhorar o código.

Um deles merece nota: `useAuth.jsx` tem um `react-refresh/only-export-components`
porque exporta o hook `useAuth` ao lado do `AuthProvider`. A correção é mover o
hook para outro arquivo — mas **28 arquivos importam dali**, e é o ponto mais
crítico do projeto. Conforto de dev (hot reload) não paga esse churn.

### 🔵 Só quando o volume crescer (registrado, não urgente)

- ⬜ RPC de engajamento agregado · presence em canal único · paginação/
  virtualização em listas longas · bundle 3D · mídia no Cloudflare R2.

---

## ✅ Auditoria completa de 21/08/2026 — CONCLUÍDA

As 3 fases (frontend → backend → banco) foram rodadas e **todas as correções
estão aplicadas em produção**. Relatório detalhado, com o que foi reproduzido
e como foi verificado: **`db/2026-08-21-auditoria-seguranca.md`**.

Resumo: 5 falhas críticas fechadas (XSS armazenado, injeção de mídia em post
alheio, bloqueio de conta por anônimo, censura por qualquer usuário logado,
vazamento de dados pessoais sem login), 3 bugs achados no caminho (moderação
de comentário/mural que nunca funcionou, cadastro não confirmado virando
usuário normal, FKs que travariam exclusão de conta) e 4 riscos latentes
fechados. Advisors: 64 → 42 avisos, 0 erros.

**Continua em aberto** (ver detalhes no relatório):
- ⬜ C3-b/c: enxugar a publicação `supabase_realtime`, revisar
  `REPLICA IDENTITY FULL` de `profiles`.
- ⬜ `pg_net` no schema `public` (adiado de propósito, ver acima).
- ⬜ RPC de engajamento agregado quando o volume crescer.

**Fechado depois** (estava listado como aberto e já não está):
- ✅ `profiles`: as colunas sensíveis (`birth_date`, `ban_reason`,
  `ban_details`, `banned_at`, `ban_count`) foram revogadas de `authenticated` e
  as leituras privilegiadas passaram para RPC (`get_own_profile`,
  `admin_list_users`, `get_public_profile`). Conferido em 21/08/2026:
  `information_schema.column_privileges` devolve **0** dessas colunas com
  SELECT para `authenticated`.
- ✅ `Admin.jsx` foi de 918 → 647 linhas (PR #19). Segue acima do limite e a
  continuação está na seção de splits abaixo.

---

## 🧩 Split de arquivos grandes — em andamento

Regra em `CLAUDE.md` §4: >300 linhas divide, >500 é dívida obrigatória.
Procedimento: extrair **sem mudar comportamento** → `build`+`lint`+`test` a
cada extração → **um commit por extração** → melhorar a lógica só depois e
separado.

**Feito**
- ✅ `Admin.jsx` 918 → 647 (PR #19). 4 componentes + 5 hooks de domínio
  (`useAdminLogs`, `useLiveModeration`, `useAdminNotifications`,
  `useBlockedLogins`, `useUnbanRequests`).
- ✅ `PostCard.jsx` 379 → 286 (PR #20). `EditCountdown` +
  `usePostEngagement` (curtidas, mídia, retry e guarda de cancelamento).
- ✅ `Lives.jsx` 375 → 195. `useLivesList` (lista + realtime + debounce, com
  `reload` imediato para quem acabou de criar a live) e `useLiveChat`
  (mensagens, timeouts, presence, os 3 canais, encerramento).
- ✅ `Profile.jsx` 387 → 72. Hooks `useProfileForm` (os 9 campos viraram um
  objeto com `setField`), `useAvatarUpload` e `useProfileStats` (ganhou guarda
  de cancelamento e passou a depender de `user?.id`, não do objeto `user`);
  JSX quebrado em `AvatarModal`, `ProfileIdentityCard`, `PlayerStatsCard`,
  `PersonalInfoCard`, `GamingCard` e `SocialLinksCard`.

- ✅ `CargosTab.jsx` 324 → 92. `useCargoDecisions` + `CargoSection`,
  `NominationCard`, `TrialCard`, `DemotionCard`, `EligibilityChecklist`,
  `CandidateHeader` e `DecisionButton` (que estava copiado 7×).
- ✅ `PostForm.jsx` 311 → 79. `usePostComposer` + `EmbedComposer`,
  `ComposerToolbar`, `MediaPreviewGrid`, `AudioAttachment`. Fechou de quebra
  um vazamento de memória real (ver abaixo).
- ✅ `UsuariosTab.jsx` 305 → 77. `useOwnerUserActions` + `UserRow`,
  `UserFilters` e `RoleOverride`.

- ✅ `Admin.jsx` 647 → 197. `useAdminData`, `useAdminRealtime`,
  `useAdminContentActions`, `useAdminLiveActions`, `useAdminStaffActions` +
  `AdminModals`, `AdminTabContent`, `AdminTabs` e `UnlockLoginModal` (que
  estava inline no meio do JSX). Achou de quebra a brecha da trilha de
  auditoria (ver abaixo).

**Fila: vazia.** Nenhum arquivo de `src/` passa de 300 linhas.

**Anotado no caminho**
- ✅ `PostCard`: a limpeza da contagem de exclusão reagia às mesmas deps do
  effect de engajamento — um refetch do feed no meio da contagem parava o
  `interval` sem resetar o estado, congelando o aviso "Excluindo post em Ns..."
  na tela e deixando o post NUNCA ser excluído. Corrigido extraindo
  `hooks/useDeleteCountdown.js`, onde a limpeza roda só no desmonte. 6 testes,
  incluindo o da regressão (re-render com props novas no meio da contagem).

---

## 🔴 Crítico

- ✅ **Projeto Supabase despausado e saudável.** O dono resolveu a restrição de
  serviço e reativou o projeto. Verificado em 21/08/2026 via MCP
  (`get_project`): `status: ACTIVE_HEALTHY`, Postgres 17.6, região `sa-east-1`,
  5 jobs pg_cron ativos (`gamerhub-cleanup`, `gamerhub-cleanup-unconfirmed`,
  `cleanup-expired-posts`, `expire-lives`, `expire-lives-every-minute`).
  *Histórico, caso volte a acontecer: a org tinha entrado em restrição de
  serviço depois de estourar o egress (267%), e o "Resume" ficava bloqueado até
  upgrade ou liberação manual da Supabase. As otimizações de egress das Ondas 1
  e 2 atacaram justamente a causa.*
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

### Quebrar arquivos grandes (1ª rodada, 2026) — ✅ feita
> A rodada atual, bem mais profunda, está na seção **🧩 Split de arquivos
> grandes** no topo deste arquivo. Esta aqui é o histórico da primeira.
- ✅ **`Admin.jsx`** → `components/admin/*` (UsersPanel, PostsPanel, LivesPanel,
  KeysPanel, NotifsPanel, LogsPanel, SuperAdminPanel).
- ✅ **`Owner.jsx`** → `components/owner/*` (um arquivo por aba).
- ✅ **`Lives.jsx`** → `LivesList`, `ChatPanel`, `ModPanel`.
- ✅ **`Login.jsx`** → `LoginForm`, `RegisterForm`, `ForgotForm`, `InputWrap`.

### Banco / Performance (impacto cresce com o volume — hoje é pequeno)
- ℹ️ **`unused_index` (advisor)**: ~15 índices (quase todos de FK) aparecem como
  "não usados". **Mantidos de propósito** — são índices de chave estrangeira /
  colunas de join que passam a ser usados conforme o volume cresce. Removê-los
  agora prejudicaria escalabilidade. Não é dívida; é precaução. *(Os 7 índices
  de `db/2026-08-otimizacao.sql`, aplicados em 20/08, caem na mesma categoria
  — recém-criados, ainda sem histórico de uso no advisor.)*
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
  vídeo em `PostForm` de **100MB → 10MB** (baixou de novo depois da medição;
  o número real está em `MAX_MB` no `usePostComposer`) (com dica pro usuário preferir colar
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
- 🟡 **Baseline de lint** (`npm run lint`): **0 erros, 20 warnings** (era 45 →
  34 → 20). Os erros
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
  (`src/lib/__tests__/`: ranks/XP, password, date, embed, format, url,
  roleLabels, objectUrls — 69 testes).
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
- ✅ **Soft delete** de posts (campo `deleted_at` em vez de delete físico — RPCs `soft_delete_post`/`restore_post`, banner vermelho para admins, botão restaurar no PostsPanel).
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

### Fase 2 — Moderação IA de texto ✅ FEITA (OpenAI, com HuggingFace de reserva)

> **Status:** `moderate-text` **v9** no ar. Provedor principal: **OpenAI
> `omni-moderation-latest`** — nota **por categoria**, não um número só de
> "toxicidade". O HuggingFace (`unitary/multilingual-toxic-xlm-roberta`) ficou
> como fallback caso a `OPENAI_API_KEY` suma.
>
> *Por que trocou:* o modelo antigo era cego pra conteúdo sexual. Medimos "quer
> trocar nudes, mando foto pelada" em **0.136** (passava batido) enquanto
> "caralho que jogo foda" dava **0.943** e era ocultado. Exatamente o inverso do
> que este site quer ser.
>
> **Política em duas camadas:** pisos fixos por categoria (`sexual/minors` 0.10,
> `sexual` 0.40, `harassment/threatening` 0.50, …) que o painel **não afrouxa**,
> mais o dial `mod_ai_text_threshold` (0.7) para o resto.
>
> Cobre post, comentário, mural **e chat de live**. Fire-and-forget: não bloqueia
> o envio. Chat não oculta (é efêmero) — só enfileira.
>
> **A RPC é chamada com `service_role` e o texto é lido do banco** — ver
> `db/2026-08-22-moderacao-ia-nunca-aplicou.md` para o porquê de cada uma das
> duas coisas. Secrets: `OPENAI_API_KEY` (+ `HUGGINGFACE_API_KEY` de reserva).

---

### Fase 2b — Lista de palavras no banco ✅ FEITA

> Antes o filtro existia **só no cliente** — e o site usa a anon key, então
> bastava chamar a REST API direto pra pular tudo. Agora o trigger
> `checar_palavras_bloqueadas` roda em `posts`, `comments`, `community_posts` e
> `live_chat`:
>
> | Severidade | O que acontece |
> | --- | --- |
> | `high` | nasce **oculto** + vai pra fila (em `live_chat` só enfileira) |
> | `medium` | publica normal, mas **vai pra fila** do admin |
> | `low` | ignorado |
>
> Match de **palavra inteira** com bordas `[[:alpha:]]` (acento-aware) e escape
> de metacaracteres de regex. ~310 termos, PT e EN, incluindo abreviações e leet.

---

### Fase 3 — Moderação IA de imagem ✅ FEITA (só pornografia — ampliar)

> **Status:** `moderate-image` **v6** no ar. Modelo:
> `Falconsai/nsfw_image_detection` (HuggingFace). Threshold em `site_config` →
> `mod_ai_image_threshold` (0.85). Até 4 imagens por post. Fire-and-forget.
> Só baixa URL do storage do próprio projeto (era SSRF).
>
> ⚠️ **Cobertura estreita:** o modelo é binário `nsfw`/`normal`, treinado em
> pornografia. **Não** detecta sangue, gore, automutilação, símbolo de ódio nem
> droga. A ampliação está registrada na seção **⬜ Aberto** do topo deste
> arquivo (trocar por `omni-moderation-latest`, com `violence/graphic`
> enfileirando em vez de ocultar).
>
> *Para testar sem postar conteúdo real:* baixar o campo "Limite — imagem" na
> aba Site do Owner para ~0.05, postar uma foto de praia e devolver a 0.85
> depois. Referência medida: imagem comum pontuou **0.001**.

---

### Fase 4 — Moderação de vídeo ⬜ (adiada — **e não é cara**)

> **A premissa original desta seção estava errada** e ficou registrada aqui como
> lembrete de não repetir o erro. Dizia "custoso, depende de upgrade do plano" e
> apontava `ffmpeg.wasm`. Não precisa: dá para extrair frames **no navegador**
> com `<video>` + `canvas` (API nativa, zero dependência, zero servidor) e
> mandar pela moderação de imagem que já existe. **Custo zero.**

- Amostrar N frames do vídeo no cliente antes do upload
- Mandar os frames pela `moderate-image` já existente
- Ganha de graça a ampliação da Fase 3 (gore/automutilação) quando ela for feita
- Adiada a pedido do dono, não por custo

---

### Fase 5 — Google Safe Browsing ✅ FEITA

> **Status:** implementado. Edge Function `moderate-links` (v1) no ar.
> Verifica `embed_url` de posts contra MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE.
> Fire-and-forget. URL perigosa → soft-hide + fila admin com `trigger_type='links'`.
> **Secret necessária:** `GOOGLE_SAFE_BROWSING_KEY` em Supabase → Edge Functions → Secrets.
> Sem a chave configurada, a função retorna `safe: true` sem erros (graceful skip).
> Como obter a chave: console.cloud.google.com → APIs → Safe Browsing API → Credentials (grátis, 1M req/dia).

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

> **Status (atualizado em ago/2026): a maior parte já foi implementada.**
> A auditoria original (jun/2026) foi só diagnóstico, feita com o projeto
> pausado, a partir do código-fonte + `DATABASE_SCHEMA_BACKUP.sql`. Contexto: a
> org estourou o **Cached Egress** (13,3 GB / 5 GB do plano Free) — a lente
> desta seção é **custo de recurso**, não feature.
>
> Origem: prompt "Auditoria Completa de Custos, Performance e Escalabilidade".
> Cada item: **problema · impacto hoje · impacto futuro · motivo técnico · plano**.

#### O que foi feito em ago/2026

Onda 1 e Onda 2 estão **fechadas**; Onda 3 está parcial. Tudo validado com
`npm run build` + `npm run lint` + `npm test`, e o SQL testado num Postgres
local em transação com `ROLLBACK` antes de virar arquivo.

| Item | Onde |
| ---- | ---- |
| C1 — compressão de imagem no upload | `lib/image.js`, usado em post/mural/avatar |
| C2 — fim do N+1 (mídia aninhada + curtidas/comentários em lote) | `postService`, `communityService`, `PostCard`, `MuralCard`, `CommentSection` |
| C3-a — realtime só nos eventos usados + filtro por live | `useRealtime`, `Home`, `Community`, `Lives` |
| A1 — poll de ban 20s→60s, só com aba visível | `useAuth` |
| A3 — `cacheControl` de 1 ano no avatar | `profileService` |
| M1 — colunas explícitas no lugar de `SELECT *` | `postService`, `communityService` |
| M2 — stats do perfil contando de `post_likes` | `profileService`, `UserProfile` |
| M3 — 3D nem baixa em conexão lenta / saveData / device fraco | `Scene3D` |
| B2 — retry de mídia só quando o lote vem vazio | `PostCard`, `MuralCard` |
| **Extra** — vídeo só baixa no clique | `MediaCarousel` |
| **Extra** — carrossel só monta perto da viewport | `LazyVisible` |
| **Extra** — Sidebar e RightPanel dividem o cache de stats | `keyService.SITE_STATS_KEY` |
| **Extra** — Landing e Home viram lazy | `App.jsx` |
| A2 + índices + fix do "top posts" | `db/2026-08-otimizacao.sql` — ✅ aplicado em produção em 20/08/2026 |
| Notificações/logs (ver seção de polimento abaixo) | `db/2026-08-logs-e-notificacoes.sql` — ✅ aplicado em produção em 20/08/2026 |

> ✅ **Os dois arquivos SQL foram aplicados em produção** (20/08/2026), via MCP
> do Supabase, função por função, com verificação depois de cada uma. A
> limpeza (`cleanup_old_data`) já rodou uma vez manualmente (removeu 8
> notificações lidas antigas + 3 tentativas de login expiradas — números
> batendo exatamente com a dimensão prévia) e está **agendada via pg_cron**
> para todo dia às 4h UTC (`gamerhub-cleanup`, confirmado `active: true` em
> `cron.job`). Os 7 índices novos foram confirmados existentes em
> `pg_indexes`. `get_advisors` (security + performance) rodado depois — ver
> nota abaixo.

#### O que ficou em aberto (próximos passos)

- ⬜ **RPC de engajamento agregado.** `attachEngagement` traz as *linhas* de
  `post_likes`/`comments` do feed e conta no cliente. Para o volume de hoje
  isso é ordens de grandeza melhor que as ~90 queries de antes, mas o payload
  cresce com o total de curtidas/comentários da janela do feed. Quando um post
  passar da casa dos milhares de curtidas, trocar por uma RPC que agrega no
  banco e devolve `{post_id, likes, comments, liked_by_me}`. O shape que o
  `PostCard` consome não muda — é troca só dentro do service.
- ⬜ **C3-b/c — publicação `supabase_realtime` e `REPLICA IDENTITY`.** Tirar
  `post_media` e `admin_logs` da publicação e revisar o `REPLICA IDENTITY FULL`
  de `profiles`. Mexem em detecção de ban e sincronização de mídia — pedem
  janela de teste dedicada, não entram junto com outra coisa.
- ⬜ **Canal `admin-realtime` assina `posts` e `admin_logs` com `event:'*'`
  global.** Todo admin com o painel aberto recebe mensagem de cada post e de
  cada log do site, mesmo com a aba fechada — só é usado quando `tab` é
  `lives`/`logs`. Público pequeno (só admins), então ficou de fora agora;
  ideal é assinar sob demanda por aba.
- ⬜ **B1 — presence num canal global único** (`gamerhub-presence`): segue
  como estava. Irrelevante hoje; revisitar se "online agora" passar de algumas
  centenas.
- ✅ **`owner_get_metrics.total_xp`** era declarado e devolvido sem nunca
  receber valor (vinha `null`). Corrigido na auditoria de 21/08/2026;
  reconferido no corpo da função em 21/08/2026.

### 🔴 Crítico (driver direto de egress / risco de estourar cota)

- ✅ **C1 — Imagens de post e mural sobem SEM compressão/resize.**
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

- ✅ **C2 — N+1 de queries no feed/mural + coluna `posts.likes` morta.**
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

- 🟡 **C3 — Realtime `event:'*'` sem filtro em tabelas quentes + publicação inchada.** *(a) feito — feed/mural/lives já filtram por evento; falta (b) enxugar a publicação `supabase_realtime` e (c) revisar `REPLICA IDENTITY` de `profiles`.*
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

- ✅ **A1 — Polling de ban a cada 20s, por usuário.**
  - *Problema:* `useAuth` já tem subscription realtime no próprio `profile` pra
    detectar ban, **e ainda** roda `setInterval(fetchProfile, 20000)` como
    fallback — um `SELECT * FROM profiles` por usuário a cada 20s.
  - *Impacto futuro:* 1.000 usuários logados = ~50 queries/s permanentes só de
    fallback de ban, 24/7, mesmo sem ninguém fazer nada.
  - *Motivo técnico:* fallback redundante com o realtime no caminho feliz.
  - *Plano:* subir o intervalo p/ 60s **e** só pollar com a aba visível
    (`document.visibilityState`); ou disparar o revalidate só no `visibilitychange`.
    Mudança pequena e segura. (Já está no backlog como "afinar detecção de ban".)

- ✅ **A2 — Zero retenção em tabelas de log/efêmeras (sem pg_cron).** *Aplicado em produção em 20/08/2026 — `cleanup_old_data()` agendada via pg_cron todo dia às 4h UTC.*
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

- ✅ **A3 — Avatar sem `cacheControl` (re-download de hora em hora).**
  - *Problema:* `uploadAvatar` (`profileService.js`) não passa `cacheControl` →
    usa o default do Supabase (~1h). Os uploads de `post-media` já usam 1 ano.
  - *Impacto:* o avatar de cada usuário é re-baixado do CDN ~1×/hora por viewer —
    egress recorrente e evitável (avatar aparece em todo card do feed).
  - *Motivo técnico:* sem `cacheControl` longo, o CDN revalida cedo.
  - *Plano:* `cacheControl: '31536000'` no upload de avatar — o cache-buster
    `?t=${Date.now()}` que já gravamos na URL garante a invalidação na troca.
    Fix de 1 linha, ganho recorrente.

### 🟡 Médio impacto

- ✅ **M1 — `SELECT *` no feed e no perfil.** `POST_SELECT` e `fetchProfile`
  trazem todas as colunas (inclusive `ban_details`, `ban_reason`, campos que a
  UI não usa no card). *Plano:* enumerar só as colunas necessárias por contexto —
  reduz payload/egress de cada request. Baixo risco, gradual.
- ✅ **M2 — `fetchUserLikesCount` redundante / stats inconsistentes.** Recalcula
  likes a partir de `post_likes` quando deveria usar o contador desnormalizado
  (depende do C2). Some junto com o C2. *Plano:* unificar a fonte de verdade dos
  contadores após o trigger do C2.
- ✅ **M3 — Bundle 3D ~880KB (≈237KB gzip).** O chunk `LandingScene` (three +
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
- ✅ **B2 — Retry de mídia** no `PostCard`/`MuralCard` (até 4×/3×) dispara queries
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

- **✅ Onda 1 — Egress rápido, baixo risco (aditivo puro):** *feita em ago/2026.*
  C1 (compressão de imagem em post/mural) · A3 (cacheControl no avatar) ·
  C3-a (realtime do feed só `INSERT`) · A1 (poll 20s→60s + visibilidade).
- **✅ Onda 2 — Carga de banco:** *feita em ago/2026, **sem** precisar de
  migration.* O plano original era criar trigger pra manter `posts.likes` e o
  feed ler o contador. Na hora de implementar isso se mostrou pior: `posts` tem
  triggers em `AFTER UPDATE` (`on_post_event`, `trg_notify_new_live`) e cada
  curtida passaria a disparar essa cadeia. A solução adotada resolve o mesmo
  problema pelo lado do cliente — mídia **aninhada no select** e curtidas /
  comentários resolvidos em **2 queries em lote** por feed, sem tocar no
  caminho de escrita. `posts.likes` segue morta e nada no app a lê.
- **🟡 Onda 3 — Retenção & realtime estrutural:** *A2 e os índices aplicados em
  produção (20/08/2026); a limpeza já rodou uma vez e está agendada via
  pg_cron todo dia às 4h UTC (`gamerhub-cleanup`).*
  Continua **em aberto** o C3-b/c (enxugar a publicação `supabase_realtime`
  tirando `post_media`/`admin_logs`, revisar o `REPLICA IDENTITY FULL` de
  `profiles`): mexem em detecção de ban e sincronização de mídia, então pedem
  janela de teste dedicada.
- **Onda 4 — Estrutural / futuro (decisão do dono):**
  Migração de mídia pro **Cloudflare R2** (10GB egress grátis/mês, egress
  ilimitado R2↔Cloudflare CDN) — solução definitiva se o site crescer ·
  M3 (aligeirar bundle 3D) · B1 (presence em escala).

---

## 🧹 Polimento geral — logs, notificações e robustez (ago/2026)

> Varredura pedida pelo dono ("olha tudo oq dá pra melhorar"), focada em: os
> logs registram mesmo o site inteiro? as notificações batem? Tudo abaixo já
> foi **feito e validado** (build + lint + 50 testes; o SQL rodado num Postgres
> 16 local em transação com ROLLBACK).

### Furos encontrados e corrigidos

**Trilha de auditoria — o que NÃO era registrado**
- ✅ Mudança de configuração do site (`SiteTab`) não gerava log nenhum. Dava pra
  ligar o modo manutenção ou desligar a Comunidade inteira sem deixar rastro.
  Agora grava `site_config_changed` com valor antigo → novo (severidade
  `warning` nas chaves de alto impacto).
- ✅ Alterações no filtro de palavras (`WordlistManager`) não eram registradas.
- ✅ Decisões da fila de moderação (ocultar/restaurar conteúdo) não eram
  registradas — só o status ficava na própria fila.
- ✅ Edição de post gerava log **duplicado** (o cliente e o trigger
  `log_post_event` gravavam o mesmo evento). O cliente agora só registra o caso
  que o trigger ignora de propósito (edição que só mexeu no marcador de live).
- ✅ Categorias `live` e `profile` não existiam nos filtros dos dois painéis —
  esses logs eram gravados mas **invisíveis** para quem filtrasse.
- ✅ ~20 actions caíam no ícone genérico por deriva entre o código e os mapas
  locais de cada painel. Unificado em `src/lib/logMeta.js`, com **teste que
  varre o código-fonte e falha se alguma action ficar sem registro**.

**Notificações — o que não batia**
- ✅ O painel do fundador filtrava `admin_notifications` por uma whitelist de 5
  tipos. Suspensão, banimento automático, suspensão automática, pedido de
  desban, desban aprovado, live reativada, pedido de reativação e tentativa de
  login de banido **nunca apareciam**. A whitelist saiu — tipo novo aparece
  sozinho.
- ✅ O mesmo painel filtrava logs pela action `set_role`, que só `owner_set_role`
  grava. Troca de cargo feita por admin/super_admin grava `admin_role_changed`
  — ou seja, a troca de cargo mais comum do site nunca aparecia.
- ✅ `owner_set_role` gravava "Role alterada para admin pelo fundador", **sem
  dizer para quem**. Agora nomeia o alvo e guarda o cargo anterior.
- ✅ Usuário **suspenso** não era avisado: só os admins recebiam notificação. Ele
  descobria ao tentar postar. Agora recebe notificação com o prazo.
- ✅ Desban **negado** não notificava ninguém (a aprovação notificava). O admin
  que pediu nunca sabia do resultado.
- ✅ O sino não atualizava sozinho — `notifications` não está no realtime e a
  query herdava `refetchOnWindowFocus: false`. Agora revalida ao voltar o foco
  e ao abrir o painel.
- ✅ `markAllRead` ignorava erro: o badge zerava na tela e voltava sozinho depois.
- ✅ Audiência `owner` não entrava na lista do `/admin` — alertas enviados pela
  equipe via `notify_owner` só apareciam no painel do fundador.
- ✅ Rótulos de Configurações diziam "Likes nos posts" / "comentarem no seu
  post", mas as preferências também cobrem curtida em comentário e resposta a
  comentário.

**Robustez**
- ✅ Curtir falhava em silêncio nos três lugares (post, mural, comentário): o
  coração acendia e o número subia mesmo quando o servidor recusava. Extraído
  `lib/like.js` com rollback + aviso, coberto por testes.
- ✅ Erro no upload de mídia era ignorado: a linha ia pro banco mesmo assim e o
  post ficava com imagem quebrada **para sempre**, apontando pra um arquivo que
  nunca existiu. Agora a mídia que falha não é registrada e o usuário é avisado.

**Interface**
- ✅ Zero emojis na UI (regra do `CLAUDE.md`): 🚫 📢 🔒 👑 ✦ ⚠️ ⚑ ✓ e as setas
  de paginação viraram ícones Lucide. Removido também o campo `icon` morto de
  `lib/embed.js`, que carregava emojis e não era usado em lugar nenhum.
- ✅ Acessibilidade: 20 botões só-ícone ganharam nome acessível (fechar modais,
  enviar, atualizar, play/pause, copiar key, menu) e os botões de curtir
  ganharam `aria-label` + `aria-pressed` (antes o leitor de tela só ouvia o
  número).
- ✅ `index.html`: título real, `description` e tags Open Graph/Twitter — o link
  do site era compartilhado sem título nem descrição.

### Ainda em aberto

- ✅ **`db/2026-08-otimizacao.sql` e `db/2026-08-logs-e-notificacoes.sql`
  aplicados em produção em 20/08/2026**, função por função via MCP do
  Supabase, com verificação depois de cada uma: os 7 índices confirmados em
  `pg_indexes`, `cleanup_old_data()` rodada uma vez (removeu 8 notificações
  lidas antigas + 3 tentativas de login expiradas — bateu com a dimensão
  prévia) e agendada via pg_cron (`gamerhub-cleanup`, `active: true`, todo dia
  às 4h UTC). `get_advisors` (security + performance) rodado depois: nenhum
  achado novo de nível alto/crítico; os únicos avisos ligados às 7 funções
  recriadas e aos 7 índices novos são do mesmo tipo já esperado/documentado
  no projeto (RPC exposta a `authenticated` com checagem interna por
  `auth.uid()`, e índice "não usado" por ter acabado de ser criado).
- ✅ **`Admin.jsx`** — era ~918 linhas, hoje **197**. Painéis, 5 hooks de
  domínio, os modais, as abas e o despacho de conteúdo foram todos extraídos.
  Nenhum arquivo de `src/` passa de 300 linhas.
- ⬜ **Denúncia criada (`reports`) não gera log de auditoria.** Fica só na
  tabela `reports`. Não foi adicionado de propósito: qualquer usuário pode
  denunciar, e logar isso em `admin_logs` inflaria a trilha. Reavaliar se a
  moderação sentir falta.
- ⬜ **Canal `admin-realtime` assina `posts` e `admin_logs` com `event:'*'`
  global** — ver seção da auditoria de custos.

---

## 💡 Ideias soltas (a avaliar)

> Espaço pra jogar ideias de feature que surgirem, sem compromisso. Quando
> decidir fazer, promover pra uma seção acima com prioridade.

- 💡 **Área própria de moderação de live, estilo YouTube Studio.** Ideia do dono
  ao ver mensagem de chat caindo na mesma fila de post e comentário: *"por mais
  que faça sentido, não faz mais sentido uma área à parte para moderador de
  lives?"*. O incômodo é real e tem base — chat é **ao vivo e efêmero**, e a
  fila de moderação é assíncrona por natureza: quando o admin abre o painel, a
  live já acabou. As ferramentas que importam ali (silenciar, apagar na hora,
  ver quem está falando) já existem no `ModPanel`, dentro da live.
  *Não é para agora* — é feature nova, e o dono deixou claro que a prioridade é
  polir o que existe. Registrado para não se perder.
