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

## Continua em aberto

- **`profiles`: usuário logado ainda lê `birth_date` e histórico de ban de
  outros.** O vazamento grave (sem login) foi fechado; este exige conta, mas é
  real. A correção certa é mover as leituras privilegiadas para RPCs
  (`get_own_profile`, `admin_get_users`, `get_public_profile`) e restringir as
  colunas também para `authenticated` — mexe em `useAuth.fetchProfile`, que é o
  ponto mais sensível do app, então pede janela dedicada.
- `pg_net` no schema `public` (já no backlog, adiado de propósito).
- Proteção contra senha vazada (HIBP) — exige plano Pro.
