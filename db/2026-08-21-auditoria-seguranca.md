# Auditoria de segurança — 21/08/2026

Varredura completa em 3 fases (frontend → backend → banco) conforme o
`CLAUDE.md`. **Tudo abaixo já está aplicado em produção** — as migrations
estão no histórico do Supabase, não há passo pendente.

Cada falha foi **reproduzida** antes de corrigir e **reverificada** depois, em
transação com `ROLLBACK`. Ao final, um smoke test cobriu 15 fluxos reais do
site (usuário comum, admin e owner) e os advisors do Supabase foram rodados de
novo.

| Antes | Depois |
| ----- | ------ |
| 64 avisos de segurança, 0 erros | **42 avisos, 0 erros** |
| `function_search_path_mutable`: 1 | **0** |
| Funções `SECURITY DEFINER` expostas a `anon`: 14 | **3** (as que o login/XP realmente precisam) |

---

## Falhas críticas

### 1. XSS armazenado via link de post

`getEmbedInfo()` devolvia `{type:'link'}` para **qualquer** string, inclusive
`javascript:alert(...)`. A validação do `PostForm`
(`if (!getEmbedInfo(url))`) era letra morta, porque a função nunca retornava
`null` — e o `EmbedPlayer` renderizava o valor cru como `<a href={url}>`.

Qualquer visitante que clicasse no link de um post executaria script na origem
do site, com o token de sessão do Supabase acessível no `localStorage`
(roubo de conta, inclusive a do dono).

**Correção:** `lib/url.js` (`safeExternalUrl`, via `new URL()` — pega variações
de caixa e espaço que regex ingênuo deixa passar) · `getEmbedInfo` rejeita
não-http(s) · href saneado em `EmbedPlayer`, `RightPanel`, `Keys` e
`MediaCarousel` · `CHECK` constraints no banco (`posts.embed_url`,
`game_keys.promo_url`, `post_media.url`, `community_post_media.url`), porque o
cliente pode ser contornado chamando a REST API direto com a anon key.

### 2. Injeção de mídia em post alheio

A policy de INSERT de `post_media` era `auth.uid() IS NOT NULL`: **qualquer
usuário logado podia pendurar mídia em qualquer post**, inclusive do dono,
apontando a `url` pro próprio servidor e registrando IP/User-Agent de quem
abrisse o feed. `community_post_media` já checava o dono — só o feed estava
aberto.

**Correção:** policy passa a exigir que o autor do post seja quem insere.

### 3. Bloqueio de conta por anônimo

`register_login_attempt(p_email)` é chamável **sem autenticação** (a tela de
login precisa disso) e não valida nada além do email recebido. Um script
anônimo chamando a RPC com o email da vítima bloqueava a conta por 15 min — e,
repetindo depois que o bloqueio expira, chegava ao bloqueio **permanente**, que
só um admin desfaz. Qualquer pessoa trancava a conta de qualquer outra, sem
nunca saber a senha.

**Correção:** a tentativa de login passa a vir **antes** da checagem de
bloqueio. Quem acerta a senha entra e tem o bloqueio limpo; só quem erra
acumula tentativa. O portão anterior nunca protegeu contra ataque real — quem
faz força bruta vai direto no endpoint de auth do Supabase, que tem rate limit
próprio — ele só atrapalhava quem sabe a senha.

### 4. Censura de conteúdo por qualquer usuário

`apply_ai_moderation` e `apply_link_moderation` estavam liberadas para
`authenticated` e **não checam quem chama**; ambas fazem
`UPDATE ... SET hidden_at = now()` no conteúdo informado. Com a moderação por
IA ligada, qualquer usuário logado ocultava qualquer post/comentário/mural.
Comprovado em teste: um usuário comum ocultou um post do dono.

**Correção:** `EXECUTE` revogado do cliente — só as Edge Functions (service
role) precisam delas.

### 5. Vazamento de dados pessoais sem login

`profiles` tinha SELECT `USING (true)` para `public`, o que inclui `anon`:
**qualquer pessoa, sem conta nenhuma**, baixava a tabela inteira de usuários —
`birth_date` (dado coletado justamente por exigência da LGPD), histórico de
moderação de todo mundo (`ban_reason`, `ban_details`, `banned_by_username`,
`ban_count`, `suspended_until`), o `role` de cada um (mapa de quem é
admin/owner) e a lista completa de usernames.

**Correção:** RLS é por linha, não por coluna — a restrição correta é
privilégio de coluna. `anon` fica só com `(id, username)`, que é exatamente o
que a checagem de username duplicado no cadastro precisa.

---

## Bugs encontrados no caminho

- **Moderação de comentário e mural nunca funcionou.** Essas tabelas não tinham
  policy de `UPDATE` nenhuma e o RLS nega por padrão, então
  `hideContent`/`restoreContent` afetavam 0 linhas em silêncio e o painel dizia
  "ocultado". O service ignorava o retorno. Agora há policy para admin+ e o
  service usa `count: 'exact'`, tratando 0 linhas como erro real.

- **Cadastro nunca confirmado virava usuário normal.** O trigger
  `handle_new_user` cria o perfil no `INSERT` de `auth.users`, antes de
  qualquer confirmação — por isso um email inexistente aparecia no admin como
  usuário comum, e o username ficava preso pra sempre. (Não é possível
  verificar existência de email de forma síncrona no cadastro; isso é
  limitação do protocolo, não do site.) Agora há o card "Cadastros pendentes de
  confirmação" no admin e limpeza automática após 7 dias.

- **FKs que travariam exclusão de conta.** `live_chat_timeouts.created_by` e
  `site_config.updated_by` eram `ON DELETE NO ACTION`: bastava o usuário ter
  mexido na config do site ou silenciado alguém numa live, e
  `delete_own_account` passaria a falhar. Nunca estourou porque as tabelas
  estão vazias. Agora `SET NULL`, preservando o histórico.

---

## Riscos latentes fechados

Coisas que **não** eram exploráveis hoje, mas virariam falha com uma mudança
inocente amanhã:

- **`posts_update` deixava o autor alterar `hidden_at`/`deleted_at`/`user_id`.**
  Só não era explorável porque `posts_select` esconde post moderado do próprio
  autor — proteção *acidental*, que sumiria no dia em que alguém
  (legitimamente) mostrasse ao autor que o post dele foi ocultado. Agora há
  guard explícito (`trg_guard_post_privileged`), mesmo padrão do guard de
  `profiles` que já existia.

- **`guard_profile_privileged_cols` sem `search_path` fixo.** Justamente o
  guard que impede auto-promoção a owner e auto-desbanimento. Função definer
  sem `search_path` resolve nomes conforme o `search_path` de quem dispara — o
  vetor clássico pra sequestrar a resolução e neutralizar o próprio guard.

- **`record_banned_login_attempt` aceitava qualquer email**, permitindo poluir
  a auditoria e disparar alerta falso sobre qualquer pessoa. Agora só aceita o
  email da própria sessão.

- **14 funções de trigger com `EXECUTE` aberto** a `anon`/`authenticated`. Não
  eram exploráveis por RPC (dependem de contexto de trigger), mas não há motivo
  pra estarem expostas. Verificado em teste que o disparo por trigger **não**
  depende de `EXECUTE` — o Postgres checa esse privilégio na criação do
  trigger, não a cada disparo.

---

## Performance (mesma varredura)

- 3 políticas ainda chamavam `auth.uid()` solto, reavaliado **linha a linha**
  (`staff_nominations`, `role_change_requests`, `moderation_queue`). O projeto
  já tinha padronizado `(select auth.uid())` nas demais; estas passaram batido.
- 9 chaves estrangeiras sem índice de cobertura — importa especialmente agora
  que dois FKs viraram `ON DELETE SET NULL` (sem índice, apagar um usuário
  obriga o Postgres a varrer a tabela inteira).

Advisors de performance: **0 erros**, restando apenas `unused_index` (INFO) —
esperado, são índices recém-criados sem histórico de uso.

---

## Migrations aplicadas

```
20260821114255  add_unconfirmed_signup_management
20260821120202  fix_media_injection_and_moderation_rls
20260821120348  enforce_http_only_urls
20260821121647  harden_security_definer_functions
20260821122046  restrict_anon_profile_access_and_fix_fks
20260821122508  harden_trigger_functions_and_guard
20260821122624  fix_rls_initplan_and_missing_fk_indexes
```

## Adendo — leitura do corpo das funções (Fase 2 completa)

Na primeira passada eu enumerei as 52 funções `SECURITY DEFINER` pelos
**metadados** (quem executa, tem `search_path`, usa `auth.uid()`, checa role) e
li o corpo de ~10 — as que a enumeração apontou como suspeitas. As outras 42
foram julgadas pelos metadados. Isso ficou registrado como lacuna, e a leitura
foi feita depois. **Achou mais 6 problemas que os metadados davam como
seguros** — todos com os guards "certos" e erro no meio do código:

| # | Função | Problema |
| - | ------ | -------- |
| 1 | `check_staff_eligibility` | **Não checava quem chama.** Qualquer usuário logado passava o uuid de outra pessoa e recebia `ban_count`, `currently_banned` e o motivo do bloqueio. Era um contorno parcial da restrição de colunas de `profiles` aplicada logo antes. |
| 2 | `admin_unlock_login` | Exigia `role = 'super_admin'` **estrito** — o **fundador não conseguia desbloquear login nenhum**. Mesma classe de bug já corrigida em `approve/deny_unban_request`; esta passou batido. Agrava porque, se o dono ficar bloqueado e for o único a poder agir, não há recuperação pelo app. |
| 3 | `soft_delete_post` | Só checava `rank >= 2`, sem hierarquia: **um admin apagava post do fundador**. O delete definitivo já respeitava `can_moderate_content` — o soft delete era o contorno. |
| 4 | `restore_post` | Mesmo furo no sentido inverso: qualquer admin restaurava qualquer post, desfazendo moderação de alguém acima dele. |
| 5 | `decide_staff_trial` | No `revert`, rebaixava para `'user'` **sempre**. Como só um admin pode ser indicado a super_admin, reverter a avaliação apagava também o cargo de admin que a pessoa já tinha. Agora volta ao cargo anterior real. |
| 6 | `owner_get_metrics` | `total_xp` era declarado e devolvido **sem nunca receber valor** — o painel do fundador sempre mostrou XP total nulo. Comprovado depois do fix: dando 30 de XP a um usuário, o total saiu de 0 para 30. |

**Lição registrada no `CLAUDE.md`:** enumeração por metadados prova *cobertura*,
não *corretude*. A Fase 2 passou a exigir a leitura do corpo de toda função de
risco, com registro de quantas de quantas foram lidas.

---

## Continua em aberto

- **`profiles`: usuário logado ainda lê `birth_date` e histórico de ban de
  outros.** O vazamento grave (sem login) foi fechado; este exige conta, mas é
  real. A correção certa é mover as leituras privilegiadas para RPCs
  (`get_own_profile`, `admin_get_users`, `get_public_profile`) e restringir as
  colunas também para `authenticated` — mexe em `useAuth.fetchProfile`, que é o
  ponto mais sensível do app, então pede janela dedicada.
- `pg_net` no schema `public` (já no backlog, adiado de propósito).
- Proteção contra senha vazada (HIBP) — exige plano Pro.

---

## Adendo — 21/08/2026: trilha de auditoria forjável

Achado **depois** do relatório principal, ao dividir o `Admin.jsx`. Não foi
pego pelas 3 fases porque a policy "parecia certa" na Fase 3 (existe, restringe
por role) — o furo estava no que ela **não** checa.

### Policy antiga

```sql
WITH CHECK ( auth.uid() IN (select id from profiles
                            where role = ANY(ARRAY['admin','super_admin'])) )
```

Checa se quem chama é admin. **Não checa** se as colunas de identidade da linha
(`admin_id`, `actor_id`) são de quem está chamando.

### Dois problemas, ambos reproduzidos em ROLLBACK

| # | Problema | Evidência |
|---|----------|-----------|
| 1 | Qualquer admin forja log em nome de outra pessoa, inclusive do fundador | `2_admin_forja_como_owner -> "FALHOU: conseguiu forjar log em nome do fundador"` |
| 2 | Ações do fundador não deixam rastro — `owner` fora da lista, RLS nega e o cliente descartava o erro | `1_owner_grava_log -> "BLOQUEADO -> acao do fundador NAO deixa rastro"` |

O problema 2 é o mesmo padrão do `admin_unlock_login`, que já tinha barrado o
próprio fundador: lista de papéis escrita sem lembrar que `owner` existe.

### Correção

Migration `fix_admin_logs_insert_forgery_and_owner_gap`:

- policy exige `admin_id = auth.uid() AND actor_id = auth.uid()`, e inclui `owner`;
- `REVOKE INSERT ON admin_logs FROM anon` (a RLS já barrava — mas o privilégio
  não deveria existir);
- cliente: `logAction` (INSERT direto) deletado; tudo passa por `logAudit` →
  RPC `log_audit_event`, SECURITY DEFINER, que deriva a identidade de `auth.uid()`.

Conferido antes de apertar: as 19 funções SECURITY DEFINER que gravam em
`admin_logs` rodam como dona da tabela e `admin_logs` não tem
`FORCE ROW LEVEL SECURITY` — continuam funcionando.

### Verificação pós-correção

```
1_owner_proprio_log -> OK: agora registra
2_admin_forja       -> OK: bloqueado
3_admin_proprio_log -> OK: continua funcionando
4_rpc_owner         -> OK
```

Reverificado contra produção depois da migration. `get_advisors` (security):
só WARN, nenhum ERROR, nada novo.

### Lição para a próxima auditoria

Na Fase 3, não basta perguntar *"a tabela tem policy de INSERT?"*. Para tabela
que grava **quem fez o quê**, perguntar também: *"a policy amarra a identidade
gravada à identidade de quem chama?"* — e *"a lista de papéis inclui `owner`?"*.

---

## Adendo 2 — 22/08/2026: dois endurecimentos que quebraram o site em silêncio

Achados quando o dono testou os fluxos logados pela primeira vez desde a
auditoria. **Nenhum dos dois veio das mudanças daquele dia; os dois vieram
de correções de segurança legítimas desta mesma auditoria**, que derrubaram
funcionalidade sem ninguém perceber.

O motivo de terem passado é sempre o mesmo: **nenhum teste automatizado alcança
caminho autenticado**. Build, lint, unitários e teste de rotas não exercitam
postar, comentar nem enviar foto.

### Bug 1 — ninguém conseguia criar conteúdo nenhum

*Sintoma:* "criar post, qualquer tipo, dá erro na tabela profile".

*Reproduzido* assumindo o papel do dono:

```
INSERT INTO posts ... -> ERRO: permission denied for table profiles
```

*Causa:* as policies de INSERT de `posts`, `comments`, `community_posts` e
`live_chat` checavam suspensão lendo `profiles.suspended_until` numa subconsulta
direta. Essa coluna foi **revogada de `authenticated`** junto com as outras
sensíveis (LGPD). O Postgres reporta falta de privilégio de **coluna** como
*"permission denied for table"*, o que despistou o diagnóstico.

Post, comentário, mural e chat — a superfície inteira de criação — estavam
mortos. A tabela `posts` estava vazia, o que confirma.

*Correção:* helper `pode_publicar()` `SECURITY DEFINER` (mesmo padrão de
`can_moderate_content`), e as 4 policies passam a chamá-lo. Quem chama não
precisa mais enxergar `suspended_until`.

*Verificado em ROLLBACK:* os 4 tipos de conteúdo voltam; postar em nome de
outro continua bloqueado; banido continua bloqueado; suspenso continua
bloqueado; suspensão expirada volta a poder; `anon` não executa a função.

### Bug 2 — upload de foto de perfil falhava

*Sintoma:* "dá erro ao fazer upload de foto".

*Reproduzido* na API real, e isolado em duas etapas:

| Teste | Resultado |
|---|---|
| `INSERT` direto em `storage.objects` como `authenticated` | OK — a policy do objeto está certa |
| `SELECT` em `storage.buckets` como `authenticated` | **0 linhas** |
| upload de avatar **sem** `x-upsert` | 200 OK |
| upload de avatar **com** `x-upsert` | 400 RLS violation |

*Causa (duas camadas):* a faxina de storage removeu as policies amplas de SELECT
— correto, elas deixavam qualquer um listar arquivo de todo mundo — mas levou
junto (a) a leitura da lista de **buckets**, que a API precisa para validar o
upload, e (b) a leitura dos **próprios** arquivos, de que o caminho de `upsert`
depende para decidir entre inserir e substituir. O site usa `upsert: true` no
avatar de propósito, para não acumular lixo no bucket.

*Correção:* duas policies mínimas — buckets **públicos** visíveis (o nome do
bucket já aparece em toda URL de imagem), e cada usuário enxerga **apenas a
própria pasta**.

*Verificado na API real:* upsert de avatar 200 OK; listar a pasta de outro
usuário devolve `[]`; listar a própria funciona. A proteção original está
intacta.

### Lição para a próxima auditoria

Revogar privilégio de coluna e apagar policy de SELECT são correções certas,
mas **quebram o que lê aquilo por baixo** — policy de RLS, trigger
`SECURITY INVOKER`, e a própria API do Storage. Antes de revogar, procurar
quem lê:

```sql
-- policies que leem a coluna que vai ser revogada
select tablename, policyname from pg_policies
 where coalesce(with_check, qual) ilike '%nome_da_coluna%';

-- triggers SECURITY INVOKER que leem a tabela
select t.tgname, p.proname, p.prosecdef from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
 where not t.tgisinternal and p.prosrc ilike '%nome_da_tabela%';
```
