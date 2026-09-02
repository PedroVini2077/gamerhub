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
  abertas a `anon` a leitura do estado de login (`check_login_status`) e a
  leitura de XP (`get_user_xp`).

  > **`[28/08]` `register_login_attempt` foi removida.** Este parágrafo a
  > listava como aberta a `anon`, e conferir no banco mostrou que ela não existe
  > mais. Ela era o contador de falhas que o **frontend** chamava para reportar
  > a própria falha — duas coisas erradas nisso, as duas medidas: quem ataca não
  > usa o nosso frontend, então força bruta real nunca era contada; e, sendo
  > chamável por anônimo, bastava um script chamar com o email da vítima para
  > **fabricar alerta de segurança e marcar a conta como bloqueada sem nunca
  > saber a senha**. As duas RPCs que sobraram são leitura pura.
- Notificações geradas por triggers `SECURITY DEFINER` — INSERT direto do
  cliente removido; banidos não burlam filtros via INSERT de notification.
- RLS consolidada: políticas múltiplas permissivas unificadas; bug "banido ainda
  posta" corrigido (INSERT de posts/community_posts era OR'd — agora AND).
- **Hierarquia de moderação imposta no DELETE** (`can_moderate_content`): admin
  não apaga mais conteúdo de super_admin/owner; owner passou a moderar de fato.
  No cliente, os serviços de delete usam `count: 'exact'` e tratam 0 linhas
  como erro real (acabou o "sucesso" falso quando o RLS bloqueia).
- Bloqueio de login server-side; tela de banido em tempo real **e no próprio
  login**, substituindo o site em vez de cobri-lo (`[28/08]` — antes a sessão
  ficava viva por baixo do overlay e o feed chegava a montar atrás dele).
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

> **Esta tabela é o levantamento de 27–28/08, não o estado de hoje.** A
> linha riscada já foi resolvida; as seções abaixo contam como. Quem lê só
> a tabela conclui que a RPC ainda existe — foi para isso que o risco
> ficou marcado, e não apagado.

| Superfície | Protegida? |
| --- | --- |
| `/auth/v1/token` (login, cadastro, recuperação) | **Sim** — rate limit próprio do Supabase/GoTrue, server-side |
| `send-email` | **Sim** — exige assinatura Standard Webhooks |
| `moderate-links` / `moderate-text` / `moderate-image` | **Sim** — exigem sessão válida (`auth.getUser()`) |
| `moderate-image` com `falha_de_extracao` (relato do navegador, `[29/08]`) | **Sim** — sessão válida **e** ser dono do conteúdo; e a RPC deduplica 1 h por motivo |
| Trilha de auditoria | **Sim**, desde 27/08 — uma linha por hora por tipo |
| Sentry | **Sim**, desde 27/08 — 20 eventos por sessão |
| **Criar conteúdo** (post, comentário, mural, chat) | **Não.** Nada limita o ritmo. Conferido: nenhuma constraint em `posts` |
| ~~`register_login_attempt`~~ | **Era a pior de todas — e foi APAGADA em 28/08.** Ver abaixo |

### `[29/08]` Funções de trigger fora da API pública — e uma afirmação minha que estava errada

Ao criar a `enfileirar_conteudo_denunciado`, o `get_advisors` acusou
`anon_security_definer_function_executable`. Varri a **classe** (§1.3) e achei
duas funções que devolvem `trigger` com `EXECUTE` para `anon`/`authenticated`:
a minha, nova, e a `log_report_created`, antiga. As duas foram revogadas.

Função de trigger **não precisa de `EXECUTE` para disparar** — o Postgres checa
esse privilégio na criação do trigger, não a cada disparo. Confirmado em
`ROLLBACK` depois do revoke: a denúncia continua enfileirando normalmente.

> **A correção, e ela é minha.** Eu escrevi na migration que o `GRANT`
> "publica a função em `/rest/v1/rpc/<nome>`" e que qualquer um com a anon key
> poderia chamá-la. **Testei depois e é falso:** o PostgREST não expõe função
> que retorna `trigger`, com ou sem `EXECUTE`. Criei uma função de teste,
> concedi `EXECUTE` a `anon`, chamei pela anon key — **404**, o mesmo das
> revogadas.
>
> Cheguei a escrever um teste em `e2e/portas-fechadas.mjs` para travar isso.
> Ele **nunca falharia**, porque as duas situações respondem igual — era
> decoração, não trava (§2), e foi removido.
>
> **O que continua verdadeiro:** o revoke é higiene correta, tira o aviso do
> advisor e é defesa em profundidade se o PostgREST algum dia mudar. **O que
> era falso:** a brecha explorável que eu descrevi. Severidade real: 🔵 baixo,
> não o 🟠 que o texto da migration sugeria.

### `[29/08]` Por que o relato de falha de vídeo NÃO é o `register_login_attempt` de novo

O caminho novo permite que o navegador escreva no `admin_logs`, que é
exatamente o que tornou a antiga `register_login_attempt` a pior superfície do
projeto. A diferença é onde a checagem fica, e ela é o motivo de a comparação
não valer:

| | `register_login_attempt` (apagada) | `falha_de_extracao` |
| --- | --- | --- |
| Quem podia chamar | **qualquer um**, sem conta | só sessão válida |
| Sobre quem | **sobre qualquer conta**, informada no corpo | só sobre conteúdo **do próprio chamador** |
| Efeito de forjar | marcava conta alheia como sob ataque | uma linha de log sobre um post que já é seu |
| Ritmo máximo | o que o atacante quisesse | o ritmo em que a pessoa publica |

O ramo do relato fica **depois** da checagem de dono da `moderate-image`, e
existe teste de contrato exigindo que continue assim
(`src/lib/__tests__/relatoDeFalhaDeVideo.test.js`). Se alguém mover o ramo para
cima da checagem, o teste falha nomeando o problema.

**O que sobra de risco:** uma conta legítima pode publicar vídeos em sequência
para gerar linhas. É ruído, não escalada — e a deduplicação de 1 hora por motivo
da própria RPC limita a uma linha por causa por hora.

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

### `[28/08]` O hook está pronto e **não pode ser ligado no plano Free**

Conferido no painel: em *Authentication → Hooks*, o **Password Verification
Attempt hook** aparece cinza, com *"Team or Enterprise Plan required"*. A
organização está no plano `free` (confirmado via API). Eu tinha afirmado o
caminho do painel sem checar a disponibilidade — era inferência vestida de fato
(§1.1), e está corrigido aqui.

**Um segundo caminho também está fechado.** `auth.audit_log_entries`, onde o
GoTrue poderia registrar tentativa de login, está **vazia — zero linhas desde
sempre**. Não dá para contar falha real por ali.

**O que isso deixa de pé, e é preciso ser exato:**

| | Estado |
| --- | --- |
| Fabricar alerta de segurança para qualquer email | **Fechado.** A RPC forjável foi apagada; `anon` recebe 404 |
| Contar falha de login real | **Impossível no plano Free** |
| Proteção contra força bruta | **Existe, e nunca foi nossa** — é o rate limit do GoTrue, server-side |

O que sobra do lado do site é uma tabela `login_attempts` que ninguém mais
preenche. Por isso a tela de login **parou de mostrar "N tentativas até o
bloqueio"**: com o contador parado, aquele aviso dizia "5 tentativas" para
sempre, sem nunca descer. Contador que não conta é pior que contador nenhum.

As funções `hook_de_verificacao_de_senha` e `contabilizar_falha_de_login` ficam
no banco, prontas e com `EXECUTE` revogado de todo mundo exceto o
`supabase_auth_admin`. Se o projeto um dia subir de plano, ligar o hook é um
clique. Superfície de ataque: nenhuma — ninguém consegue chamá-las.

> A política de segurança e os pontos de melhoria são revisados periodicamente
> pelo plano de auditoria em 3 fases descrito no `CLAUDE.md`.

---


---

[← voltar para o README](../README.md)

---

## `[01/09]` A matriz de gatilhos — o que cobre cada área, e o que NÃO cobre

> Pedido do dono: *"todo lugar onde dê pra colocar um gatilho pra vc lembrar oq
> falta, quero que vc ponha, desde do front até o banco de dados"*, com a forma
> exigida sendo **gatilho → obrigação → evidência**.

A pergunta que encontra brecha não é "existe portão?" — é **"existe caminho
para alterar esta área sem acionar nenhum?"**. As outras só descrevem.

| Área | Portão | **O que ele EXIGE de quem mexe** | Existe caminho sem acionar? |
| --- | --- | --- | --- |
| Auth/autorização | `useAuth.test.js`, `roles.test.js`, `fluxos.mjs` | que `/admin` e `/owner` continuem negados a `role='user'`, provado num navegador | **sim** — policy no banco não passa por nenhum deles |
| Banco e RLS | `portas-do-banco.mjs`, `tabelasSemUpdate.test.js` | que porta fechada siga fechada, porta aberta siga aberta, e que ninguém escreva `update` em tabela sem policy | **sim, em parte** — ver "o buraco que fica" |
| Dado sensível | `portas-do-banco.mjs` | que `posts` e `admin_logs` respondam 401 ao anônimo, e que de `profiles` o anônimo leia **exatamente `id` e `username`** — nem uma coluna a mais, nem a menos | sim — não vê o que um **logado** alcança |
| Privacidade | `conteudoDaPrivacidade.test.js` | que chave nova no navegador, terceiro novo e cookie **entrem na política** antes de existirem | não, para o que ele conhece |
| Admin/staff | `painel-admin.mjs` | que o painel liste, pagine e negue — com dado que o próprio teste cria | sim — cobre a tela, não a permissão no banco |
| Edge Functions | `portas-fechadas.mjs`, na **produção** | que as 5 portas recusem chamada sem credencial | não, e é de propósito: as functions não estão no git |
| Fluxos críticos | `fluxos.mjs` | publicar → conferir → apagar → sair, e nenhum lixo de teste sobrando | sim — cobre o caminho feliz de uma conta comum |
| Testes | piso de testes, `rotasE2E.test.js`, **`varrerFontes`** | que rota nova tenha teste de navegador, e que trava que varre arquivo **prove que varreu** | não |
| Segredo/config | `segredos-vazados.mjs` | que nenhum arquivo rastreado tenha chave privada, `service_role`, token ou senha | não, para os padrões que ele conhece |
| CI/CD | portão de deploy da Vercel | que branch nova entre no `vercel.json` | não |
| Documentação | `documentacao-quebrada`, `mapa-de-arquivos`, `documentacao-envelhecida` | que arquivo novo entre no `ARQUITETURA.md` e que nenhum doc cite arquivo morto | não |
| Conteúdo visível | `conteudo-visivel.mjs` | que nada com tamanho real fique em `opacity: 0` numa janela de celular | não |
| Navegação | `navegacao.mjs` | topo ao trocar de página, âncora funcionando das duas páginas, e voltar preservando o lugar | não |
| Cena 3D | `cena-3d.mjs`, `ritmoDoRaio.test.js` | que o laço pare fora da tela, e que ninguém agende contra o relógio que o R3F zera | não |

**A coluna do meio é a que faltava**, e o dono tinha razão em cobrá-la: sem
dizer o que o portão **exige**, "existe portão" vira contagem — e contagem não
orienta quem vai mexer na área.

### O que a auditoria de 01/09 mediu, e o que ela desmentiu

Rodando `get_advisors` e consultando `pg_proc`/`pg_policies` diretamente:

| Classe verificada | Resultado |
| --- | --- |
| `SECURITY DEFINER` sem `search_path` | **zero** — a classe está fechada |
| Tabela sem RLS ligada | **zero** |
| Tabela sem policy de UPDATE | 13 — e **nenhuma** recebe `update` no código hoje |
| `SECURITY DEFINER` chamável por `anon` | 2: `check_login_status`, `get_user_xp` |

**O WARN de `check_login_status` NÃO se confirmou como brecha.** A suspeita era
oráculo de enumeração de e-mail. Medido: `login_attempts` tem **0 linhas** com 5
usuários reais — a tabela só ganha linha em tentativa **falha**, então a função
devolve `{attempts: 0, blocked: false}` para e-mail existente e inexistente do
mesmo jeito. Ela não distingue os dois casos. Ela **precisa** ser pública: a tela
de login consulta o bloqueio antes de autenticar.

> Registrado porque lint que acusa não é prova de brecha, e tratar WARN como
> vulnerabilidade é o mesmo erro de tratar verde como garantia.

### O buraco que FICA, e por que não fechei

As duas classes mais perigosas do banco — **policy** e **privilégio de coluna** —
só se verificam com acesso administrativo ao Postgres. Pôr a `service_role` nos
secrets do CI daria a um runner público a chave que ignora toda a RLS: trocar
uma incerteza de monitoramento por uma credencial exposta é a conta ruim de
sempre (§0.2).

Então elas continuam sendo trabalho de **auditoria** (§6), rodadas por MCP. As
consultas estão em [`regras/AUDITORIA.md`](regras/AUDITORIA.md) e a de policy de
UPDATE está repetida no cabeçalho de `lib/tabelasSemUpdate.js`, junto da lista
que ela gera.

---

## `[01/09]` A varredura de classe — o que ela encontrou nas minhas próprias travas

A parte B da auditoria (§ do `BACKLOG.md`) manda varrer as classes de erro pelo
código, e não tratar achado como caso isolado. A classe mais grave é **"teste
que não consegue falhar"** — está no catálogo desde 30/08 e eu já a repeti duas
vezes.

**O que a varredura mediu:** das 9 travas que leem arquivos, **6 não conferiam
que leram algum**. Todas com o mesmo desenho:

```js
const arquivos = varrer('src/algum/caminho');   // e se voltar vazio?
const infratores = arquivos.filter(...);
expect(infratores).toEqual([]);                 // passa. sempre.
```

Renomeie a pasta e a trava fica **verde para sempre**, sem nunca mais ler uma
linha. Não é hipótese: é o mesmo mecanismo do teste de portas RPC e do de banco
fora do ar, os dois que já me pegaram.

**O conserto é de classe, não de caso:** `src/lib/__tests__/varrerFontes.js`
**estoura** quando não encontra arquivo. A guarda mora no varredor e não em cada
teste de propósito — guarda que depende de alguém lembrar de escrever é o mesmo
que não ter guarda.

**Provada** movendo `scene3d/` para fora: a trava do raio parou de passar e
disse por quê, em vez de seguir verde.
