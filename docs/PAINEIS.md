# Painéis da equipe

> O que **a equipe** opera: os painéis de admin, super admin e dono, o
> banimento, o bloqueio de login, a configuração do site e a trilha de
> auditoria.
>
> Saiu de [FUNCIONALIDADES.md](FUNCIONALIDADES.md) em 28/08/2026, quando aquele
> arquivo passou de 400 linhas. O corte é por **público**, e não por tamanho:
> este documento responde perguntas de quem administra o site; o outro,
> perguntas de quem usa. Os dois quase nunca são lidos juntos.
>
> A **moderação** tem arquivo próprio ([MODERACAO.md](MODERACAO.md)), e a
> política da IA de mídia está em [MODERACAO-IA.md](MODERACAO-IA.md).

[← voltar para o README](../README.md)

### Painel Admin / Super Admin

`Admin.jsx` — painel multi-aba (acesso de `admin` para cima):

- **Usuários**: busca + filtros por role/banidos; expandir linha para ver
  detalhes; **mudar role** via fluxo de indicação (respeitando hierarquia);
  **banir/desbanir**; **deletar todos os posts** de um usuário; fluxo de
  solicitação de desbanimento.
- **Posts**: listar e deletar posts, em duas sub-abas — "Posts ativos" e
  "Lixeira". Paginado em blocos de 20, **por sub-aba** (`[29/08]`): antes a
  consulta trazia os 20 mais recentes misturados e o botão só existia em
  "ativos", então clicar podia carregar de verdade e não mudar nada na tela.
  A conta do offset mora em `src/lib/paginacaoDePosts.js`, isolada e com teste,
  porque offset errado não estoura — ele pula linhas em silêncio.
- **Moderação**: central de moderação de conteúdo (ver seção abaixo) — fila de
  revisão, denúncias, palavras bloqueadas e histórico de infrações.
  Desde 29/08 a prévia de cada item mostra **imagem e vídeo**, abre texto longo
  por inteiro e traz um botão **"ver no site"** que leva ao conteúdo denunciado
  — inclusive quando ele já está oculto. Ver [MODERACAO.md](MODERACAO.md).
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
- **Tela de banido** (`BannedScreen`): aparece em tempo real numa sessão aberta
  (realtime em `profiles.banned` + polling de reserva no `useAuth`) **e no
  próprio login**. Ela **substitui** o site, não fica por cima: a sessão
  continua viva — é o que torna o recurso possível — mas o feed nunca chega a
  montar. Ao sair, o destino é a landing.
- **Recurso do próprio banido** (`solicitar_revisao_do_proprio_ban`): formulário
  na `BannedScreen`, **um pedido por banimento**, texto de 20 a 1000 caracteres,
  regras todas no banco. A tela também mostra o andamento
  (`meu_pedido_de_revisao`): *Em análise* / *Aprovado* / *Negado*, com a
  resposta da equipe.
- **Fluxo de desbanimento**: `admin` solicita (`request_unban`) → `super_admin`
  ou `owner` aprova (`approve_unban_request`) ou nega (`deny_unban_request`).
  `super_admin`/`owner` também desbanem direto (`unban_user`).
- **Ser desbanido avisa**: os dois caminhos de desbanimento gravam uma
  notificação (`type = 'unban'`) que aparece no sino. Sem ela, "meu recurso foi
  aceito" e "o site parou de me bloquear por algum bug" eram indistinguíveis do
  lado de quem foi desbanido.

### Bloqueio de login por tentativas

Servidor é a **única fonte de verdade** (`check_login_status` /
`admin_unlock_login` / `reset_login_attempts`):

- 5 falhas consecutivas → bloqueio temporário de **15 min**.
- 10+ falhas → bloqueio **permanente** (precisa de super admin para liberar).
- O contador só zera em **login bem-sucedido** (`reset_login_attempts`) — sem
  reversão por tempo (punição intencional).

> **`[28/08]` A contagem está desligada, e isto é honestidade, não falta.** Esta
> seção citava `register_login_attempt`, que **não existe mais** — conferido no
> banco. Ela era chamada pelo *frontend* para reportar a própria falha: força
> bruta real nunca era contada (quem ataca não usa o nosso site), e qualquer um
> podia chamá-la com o email de outra pessoa para **fabricar bloqueio sem saber
> a senha**. Foi removida.
>
> Contar de verdade exige o *Password Verification Hook* do Supabase, que é
> exclusivo do plano Team (a função já está no banco, testada, esperando o
> plano). Enquanto isso, quem barra força bruta é o **rate limit do próprio
> GoTrue**, que é server-side e não depende desta tela. Os limites de 5 e 10
> acima continuam escritos porque a mecânica de bloqueio existe — o que não
> existe hoje é algo que incremente o contador. Ver [BACKLOG.md](../BACKLOG.md).
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
  `log_audit_event`, e por várias funções/triggers do banco. A aba **Logs** do
  painel do dono permite **exportar em CSV** (respeita os filtros de categoria/
  severidade; até 5000 linhas, com BOM UTF-8 pro Excel).
- **`admin_notifications`** + **`admin_notification_reads`**: notificações para
  a equipe (audiência `all_admins`, `super_admin` ou `owner`), com controle de
  lidas por admin. Geradas por triggers (`notify_admin_new_user`,
  `notify_admin_new_live`, `notify_admin_reactivation_request`) e por funções de
  ban/segurança.
- **`notifications`**: notificações para o **usuário final** (sino do header).
  Tipos: `like`, `comment` e `moderation`. Sempre geradas no banco, por trigger
  `SECURITY DEFINER` (`notify_post_like`, `notify_post_comment`,
  `notify_comment_like`) ou pela RPC `notify_user` — o cliente **não** insere
  direto. Respeitam `profiles.notif_likes` / `profiles.notif_comments`.
  - `notif_likes` cobre curtida em **post e em comentário**; `notif_comments`
    cobre comentário no post **e resposta a comentário** — os rótulos de
    Configurações dizem isso.
  - O sino revalida quando a aba volta ao foco e ao ser aberto. `notifications`
    **não** está na publicação de realtime de propósito (seria uma conexão
    permanente por usuário logado para um evento raro).

#### Cobertura da trilha de auditoria

`src/lib/logMeta.js` é a **fonte única** de categorias, ícones e rótulos usada
pelos dois painéis (admin e dono). Categorias: `auth`, `security`, `content`,
`live`, `profile`, `admin`, `system`.

> Ao criar um `logAudit()` novo — ou uma função no banco que escreva em
> `admin_logs` — registre a action em `logMeta.js`. O teste
> `src/lib/__tests__/logMeta.test.js` varre o código-fonte e **falha** se
> alguma action ou categoria ficar sem entrada. Foi exatamente essa deriva que
> deixou metade dos eventos com ícone genérico e escondeu as categorias `live`
> e `profile` do filtro.

Ações que passaram a ser auditadas (antes não deixavam rastro nenhum):
mudança de configuração do site (`site_config_changed` — modo manutenção,
ligar/desligar seções, banner), alterações no filtro de palavras
(`wordlist_added` / `wordlist_removed`) e decisões da fila de moderação
(`moderation_approved` / `moderation_rejected`).

#### Retenção

`cleanup_old_data()` (em `db/2026-08-otimizacao.sql`, agendada por
`db/2026-08-logs-e-notificacoes.sql`) apaga diariamente: `admin_logs` com mais
de **90 dias**, notificações **lidas** com mais de 30 dias, `login_attempts` já
expirados com mais de 30 dias e chat de live **encerrada** com mais de 7 dias.
Bloqueio permanente e live em andamento nunca são tocados. Os dois painéis de
log avisam o prazo na tela (`LOG_RETENTION_DAYS`) — mantenha o valor em sincronia
com o SQL; há teste cobrindo isso.


---

## `[05/09]` O cofre na entrada do painel do Fundador

Abrir `/owner` passou a pedir um código antes de mostrar o painel.

| | |
| --- | --- |
| **primeira vez neste navegador** | ele pede para você criar o código, e repetir |
| **depois** | pede o código |
| **enquanto a aba estiver aberta** | não pede de novo |
| **fechou a aba** | pede na próxima vez |

**O código é por aparelho e fica só nele.** Não vai para o banco, não é enviado
a lugar nenhum, e o que fica guardado é um resumo dele — não o código. Cada
computador ou celular seu tem o seu; esquecer o de um não tranca os outros.

**Ele é uma tranca de tela, não uma segunda senha do sistema.** Serve para
quem senta na frente do seu computador com a sua sessão aberta. Quem tem a
sessão em si continua alcançando as funções pela API — o que impede isso são as
regras do banco, que não dependem desta tela. A explicação inteira, com o que
ele protege e o que não protege, está em [SEGURANCA.md](SEGURANCA.md).

**Se você esquecer o código:** tem um link **"Esqueci o código deste
navegador"** embaixo do botão. Ele apaga o código guardado ali e pede um novo na
hora. Como o cofre não guarda permissão nenhuma, isso não abre porta que já não
estivesse aberta — e sem esse caminho uma tranca cenográfica poderia trancar de
verdade, que é a pior combinação possível.
