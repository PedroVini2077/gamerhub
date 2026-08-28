# Segurança

> O que protege o quê. O site entrega apenas a `anon key` ao navegador — então
> **toda** regra de verdade vive no banco (RLS, CHECK, trigger, ou RPC com
> checagem). Validação no cliente é conveniência, nunca proteção.

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

- **Auditoria completa de 21/08/2026** (3 fases, tudo aplicado em produção —
  ver `db/2026-08-21-auditoria-seguranca.md`). Fechou 5 falhas críticas:
  XSS armazenado via link de post (`javascript:` chegava a um `href`),
  injeção de mídia em post alheio, bloqueio de conta por anônimo, censura de
  conteúdo por qualquer usuário logado e leitura da tabela de usuários
  (incluindo `birth_date` e histórico de ban) **sem login**. Advisors de
  segurança: 64 → 42 avisos, 0 erros.
- **URLs externas sempre saneadas** (`lib/url.js` → `safeExternalUrl`): só
  `http`/`https` viram `href`. Vale no cliente **e** no banco (`CHECK`
  constraints em `posts.embed_url`, `game_keys.promo_url`, `post_media.url`,
  `community_post_media.url`) — a anon key permite chamar a REST API direto,
  então validação só no frontend não vale nada.
- **`anon` só enxerga `(id, username)` de `profiles`** — o suficiente para a
  checagem de username duplicado no cadastro. RLS é por linha, não por coluna;
  a restrição correta aqui é privilégio de coluna.
- **Guards de coluna privilegiada** em `profiles`
  (`guard_profile_privileged_cols`) e `posts` (`guard_post_privileged_cols`):
  usuário comum não altera `role`/`banned` nem `hidden_at`/`deleted_at`/
  `user_id`. Ambos com `search_path` fixo.

## `[23/08]` Auth Hook de email exige assinatura

A `send-email` é o *Auth Hook* do Supabase e, por construção, precisa rodar com
`verify_jwt: false` — o gateway não exige JWT de um webhook. O corpo dela não
conferia nada, e **qualquer pessoa na internet** disparava email com a marca do
GamerHub para qualquer endereço. O pior caminho não é o spam: é queimar a cota
de ~500/dia do Gmail ou fazer o Google travar a conta, e aí **ninguém mais se
cadastra nem recupera senha**.

Agora ela valida a assinatura **Standard Webhooks** que o Supabase manda
(HMAC-SHA256 sobre `${id}.${timestamp}.${corpo}`, janela de 5 minutos contra
replay, comparação em tempo constante). Sem `SEND_EMAIL_HOOK_SECRET` ela recusa
tudo — cadastro parado e barulhento é melhor que hook aberto e silencioso. Toda
recusa devolve o mesmo `401`: dizer de fora *qual* foi o motivo entregaria o
estado da configuração a quem sonda. O motivo real vai para `admin_logs`.

O `token_hash` saiu do log da função junto: ele é a credencial de uso único que
confirma a conta ou troca a senha, e estava sendo gravado em texto puro.

Relatório completo, com a prova e os três testes de verificação:
[`db/2026-08-23-send-email-aberta-para-a-internet.md`](../db/2026-08-23-send-email-aberta-para-a-internet.md).

## `[23/08]` A porta da `moderate-links` era decorativa

Ela fazia `if (!authHeader) 401` e seguia em frente — **sem nunca validar o
token**. Qualquer string em `Authorization` passava, incluindo `Bearer
lixo-qualquer`. Não dava escalada de privilégio (a RPC do fim confere de novo),
mas dava para qualquer pessoa da internet **queimar a cota do Safe Browsing**
do projeto, que é de 10 mil consultas/dia. Estourada, a checagem de link para
de funcionar para todo mundo — e em silêncio, porque a falha da API degrada de
forma graciosa por design.

Agora valida com `auth.getUser()`, como `moderate-text` e `moderate-image`.
Verificado: token inventado → 401; **a própria anon key crua → 401** (mais
estrito que o `verify_jwt` do gateway, que a aceitaria); sessão real → 200.

O caso perigoso passou a gritar junto: link malicioso **detectado** e a RPC não
ocultando devolve `status: "rpc_error"` e vai para `admin_logs`. Era a mesma
forma de falha que manteve a moderação por IA quebrada em 26 de 26 chamadas.

## `[23/08]` As outras duas Edge Functions abertas — resolvidas por remoção

Achar duas com a porta aberta obrigou a olhar as oito que existiam então (§1.3, *varredura de
classe*). Sobraram duas com `verify_jwt: false` e nenhuma checagem no corpo:

**`cleanup-expired-posts`** rodava com `service_role` e **apagava posts**. O
estrago em dados era nulo (idempotente: só fazia o que o agendamento faria de
qualquer jeito), mas cada chamada rodava duas varreduras de `DELETE` em `posts`
— dava para martelar de fora e consumir invocação de Edge Function e carga de
banco de graça, e a resposta ainda contava quantas linhas saíram.

Guardar a porta exigiria um segredo compartilhado com o `pg_cron`, que hoje
chama por `pg_net` **sem cabeçalho nenhum**. Mas o trabalho dela era SQL puro:
virou `public.cleanup_expired_posts()`, com `EXECUTE` revogado de `anon` e
`authenticated`, e o cron passou a chamar o banco direto. **A correção não foi
trancar a porta — foi não ter porta.**

**`debug-hf`** era sobra de um experimento com Hugging Face: baixava uma imagem
de teste e gastava a `HUGGINGFACE_API_KEY` a cada chamada. Nada no site a
chamava. Código morto não é só bagunça — é superfície de ataque que ninguém
revisa, porque ninguém lembra que existe.

> **Não confundir:** a `HUGGINGFACE_API_KEY` continua em uso pelo fallback de
> texto dentro da `moderate-text`. Apagar a `debug-hf` é seguro; apagar o
> **secret** tiraria a reserva do texto (ver [MODERACAO.md](MODERACAO.md)).

As duas foram neutralizadas em 23/08 (corpo devolvendo `410`, `verify_jwt`
ligado) e **apagadas de vez em 27/08** pelo dono. Verificado depois de apagar:
`POST` nas duas → **404**, e a faxina do cron seguiu rodando normalmente
(jobid 1, `succeeded`) — porque o trabalho dela já tinha virado SQL.

`e2e/portas-fechadas.mjs` continua batendo nas duas, agora exigindo **404**:
apagada é o estado mais fechado que existe, mas é um estado que alguém pode
desfazer sem querer. Um `401` ali passaria a ser **regressão**, não segurança —
significaria a função de volta, só que com o gateway ligado.

De quebra, a varredura achou uma mentira na tela: o painel do owner mandava
configurar `HUGGINGFACE_API_KEY` para a moderação por IA, que usa **OpenAI**
desde a troca de provedor. Mensagem errada custa mais tempo do dono do que
mensagem nenhuma (§1.5).

## `[27/08]` Onde está o rate limit — e onde ele não está

Levantado ao conferir o projeto contra uma lista de camadas de engenharia.
**Medido, não deduzido.**

| Superfície | Protegida? |
| --- | --- |
| `/auth/v1/token` (login, cadastro, recuperação) | **Sim** — rate limit próprio do Supabase/GoTrue, server-side |
| `send-email` | **Sim** — exige assinatura Standard Webhooks |
| `moderate-links` / `moderate-text` / `moderate-image` | **Sim** — exigem sessão válida (`auth.getUser()`) |
| Trilha de auditoria | **Sim**, desde 27/08 — uma linha por hora por tipo |
| Sentry | **Sim**, desde 27/08 — 20 eventos por sessão |
| **Criar conteúdo** (post, comentário, mural, chat) | **Não.** Nada limita o ritmo. Conferido: nenhuma constraint em `posts` |
| **`register_login_attempt`** | **Não**, e é pior que isso — ver abaixo |

### O contador de login promete o que não entrega

Duas medições, e as duas contrariam o que o mecanismo aparenta fazer:

- **3 logins com senha errada direto no GoTrue → o contador não saiu de zero.**
  Ele só se move quando o *nosso frontend* educadamente reporta a falha. Um
  atacante de verdade não reporta. **Logo, não protege contra força bruta.**
- **5 chamadas anônimas a `register_login_attempt` → conta marcada como
  bloqueada**, sem senha e sem sessão.

A RPC precisa ser chamável por `anon` (a página de login não está autenticada) e
**incrementa sem verificar se o login falhou**.

**O que isso NÃO é:** não tranca ninguém fora. Uma sessão anterior já mitigou
colocando a tentativa de login *antes* da checagem de bloqueio — **verificado**:
conta marcada como `blocked`, dono entrou com a senha certa, HTTP 200.

**O que sobra** é poluição de `admin_logs` e `admin_notifications` com alertas
de segurança fabricados: qualquer um gera "conta bloqueada" para qualquer email.
Mesma classe do `edge_function_error` — fadiga de alarme.

### `[28/08]` Corrigido — o contador passou a contar o que acontece

A correção não foi remendar a RPC: foi **tirar a decisão do cliente**.

`public.hook_de_verificacao_de_senha(event jsonb)` é o **Password Verification
Hook** do Supabase. O GoTrue chama o banco a cada verificação de senha e entrega
o próprio veredicto (`{user_id, valid}`). Errou a senha, conta; acertou, o
histórico é zerado. Nada que o frontend faça move esse número.

A porta forjável foi **apagada**: `register_login_attempt` não existe mais, e a
contagem vive em `contabilizar_falha_de_login`, com `EXECUTE` revogado de `anon`
e de `authenticated`. A tela de login agora só **lê**, por `check_login_status`.

**O hook devolve sempre `decision: 'continue'`, e isso é decisão de produto.**
Recusar ali transformaria o contador num portão de verdade — e portão desses é
negação de serviço contra a conta: bastaria errar a senha de alguém 10 vezes
para trancar a pessoa do lado de fora. Contra força bruta quem protege é o rate
limit do próprio GoTrue, que é server-side. O papel deste contador é **avisar a
equipe**, e para avisar ele precisava primeiro parar de mentir.

> O `EXCEPTION WHEN OTHERS` que engole tudo dentro do hook é a única vez que
> engolir erro é o certo neste projeto (contra a §4): um defeito ali travaria o
> **login do site inteiro**, inclusive o do dono. Contabilidade de tentativa não
> vale esse risco.

Verificado em transação com `ROLLBACK`, 8 checagens: falha conta 1→2→3, acerto
apaga a linha, evento malformado devolve `continue`, e nem `anon` nem
`authenticated` conseguem chamar qualquer uma das duas funções.

**Falta um passo, e ele é de painel:** *Authentication → Hooks → Password
Verification* apontando para `public.hook_de_verificacao_de_senha`. Enquanto
isso não for feito, o hook existe e não é chamado — ninguém consegue fabricar
alerta (isso já está fechado), mas falha real também não é contada. Está no
`BACKLOG.md`.

> A política de segurança e os pontos de melhoria são revisados periodicamente
> pelo plano de auditoria em 3 fases descrito no `CLAUDE.md`.

---


---

[← voltar para o README](../README.md)
