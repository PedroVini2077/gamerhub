# A auditoria das 48 `SECURITY DEFINER`, e a SEC-025 fechada

**Data:** 18/09/2026 · **Duas revogações aplicadas.** O que interessa aqui é o
**método**, porque ele quase me fez derrubar o site.

---

## Os números, conferidos antes de qualquer coisa

| | |
| --- | --- |
| `SECURITY DEFINER` em `public` | **80** |
| executáveis por `authenticated` | **48** ← o número do Advisor **estava correto** |
| executáveis por `anon` | **2** |
| **sem `search_path`** | **0** |

---

## SEC-025 · `authenticated` escrevia as colunas privilegiadas de `profiles`

### O achado foi dele

`PATCH {"role":"user"}` na própria linha, pela Data API → **HTTP 204**. E a
desconfiança certa: *"não assuma que 204 significa que os campos foram
modificados"*.

### O diagnóstico (investigação read-only, relatório próprio)

`authenticated` tinha **UPDATE nas 25 colunas**. O que impedia o estrago era
**um trigger e só ele** — `trg_guard_profile_privileged`, que reverte as nove
privilegiadas quando `current_user` é `authenticated`/`anon`.

**Não havia escalação** (classificação B): medido com papel assumido, o `role`
gravado continuava `user` e `is_staff()`/`is_owner()` seguiam `false`.

**O problema era a camada única.** Trigger desabilitado, renomeado, ou um
caminho onde `current_user` não fosse `authenticated`, e a escalação abriria
**em silêncio**.

### A correção — e por que ela não repete o incidente de antes

```sql
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (bio, birth_date, state, platform, playstyle, favorite_games,
              discord, twitch, youtube, avatar_url, notif_likes, notif_comments)
  ON public.profiles TO authenticated;
```

A POSTURA §1.3 registra que revogar colunas de `profiles` **derrubou o site 3×**.
Aquilo foi **SELECT**; isto é **UPDATE**. Conferido antes de aplicar:

| | |
| --- | --- |
| policies que leem `role`/`banned` | **27** — todas por `SELECT`, nenhuma afetada |
| funções `SECURITY INVOKER` que escrevem em `profiles` | **nenhuma** |
| funções `SECURITY DEFINER` que escrevem | **10** — rodam como `postgres`, seguem executáveis |

**A lista das 12 não é julgamento meu:** é o que o frontend escreve, lido em
`useProfileForm.js`, `useAvatarUpload.js` e `profileService.js`. `username` não
entra — nenhuma tela o altera; ele nasce no `handle_new_user`.

### Validado (ROLLBACK, papel assumido, 6 asserções)

| | |
| --- | --- |
| **0. antes** | UPDATE de `role` **ACEITO** ← sem esta, o teste não prova nada |
| 1. `role` depois | recusado por **PRIVILÉGIO** |
| 2. `banned`/`ban_count`/`suspended_until` | recusado por **PRIVILÉGIO** |
| 3. salvar o perfil | **1 linha** — não quebrou |
| 4. `birth_date` | **1 linha** |
| 5. RPCs administrativas | **10 intactas** |

**Estado em produção:** 12 colunas escrevíveis, **13 bloqueadas**.

### Ganho de lado: a falha passou a GRITAR

Antes: HTTP 204, campo inalterado, ninguém sabe. Agora: **erro de privilégio**,
visível para quem chamar. Trocar silêncio por erro é o §1.5 inteiro.

---

## SEC-026 · A auditoria das 48 — e o corte que quase derrubou o site

O pedido dele foi explícito: *"NÃO revogue as 48 em massa"* e *"não altere uma
função apenas porque o Security Advisor a marcou"*.

### Corte 1 — quem o frontend chama

**9 das 48** não são chamadas por tela nenhuma.

### Corte 2 — o que salvou o site

Se o critério parasse no corte 1, revogar essas 9 teria quebrado tudo, por um
motivo que **não aparece em `grep` de `src/`**:

| Função | policies que a usam |
| --- | --- |
| `is_staff` | **14** |
| `can_moderate_content` | **8** |
| `pode_publicar` | **4** |
| `is_super` | **2** |

**Função chamada dentro de policy precisa de `EXECUTE` para o papel que a
dispara.** Sem o grant, a policy inteira falha — para todo mundo.

### Corte 3 — quem chama de fora do frontend

| Função | Quem chama | Veredito |
| --- | --- | --- |
| `contagem_de_migrations` | o `espelho-de-migrations.mjs`, no CI, com a chave anônima | preservar |
| `contato_dados_para_resposta` | Edge `responder-contato`, com o **JWT de quem pediu** | preservar |
| `contato_registrar_resposta` | idem — o código avisa que `service_role` *"abriria a função para qualquer usuário logado"* | preservar |
| `is_owner` | outras duas funções | preservar (conservador; ganho seria zero) |

### Sobrou UMA

`admin_set_role` — órfã nas quatro frentes: nenhuma tela, policy, função ou
Edge Function. Quem muda cargo no painel é `owner_set_role`
(`useOwnerUserActions.js`).

E há um motivo de produto junto: ela permite que um `admin` promova alguém a
`admin`. Nenhuma tela oferece isso, e o caminho previsto é a indicação
(`nominate_staff` → `review_staff_nomination` → `decide_staff_trial`), com
período de avaliação e rank 3.

**Validado:** antes chamável (parava só no guard interno) → depois recusada por
privilégio → e `owner_set_role` **continua** chamável.

---

## A classificação das 48, nas quatro categorias dele

| Categoria | Quantas | Quais |
| --- | --- | --- |
| **1.** Operação legítima do usuário | 13 | `get_own_profile` · `delete_own_account` · `confere_a_propria_senha` · `request_unban` · `solicitar_revisao_do_proprio_ban` · `meu_pedido_de_revisao` · `record_banned_login_attempt` · `get_public_profile` · `get_user_xp` · `username_disponivel` · `log_audit_event` · `notify_user` · `notify_owner` |
| **2.** Administrativa **com guard interno**, e o painel chama | 28 | `ban_user` · `unban_user` · `apply_suspension` · `lift_suspension` · `approve_unban_request` · `deny_unban_request` · `soft_delete_post` · `restore_post` · `owner_*` (7) · `admin_*` (4) · `decide_*` · `review_staff_nomination` · `nominate_staff` · `request_role_demotion` · `check_staff_eligibility` · `get_blocked_logins` · … |
| **3.** Administrativa **sem necessidade** → revogada | **1** | `admin_set_role` |
| **4.** Infraestrutura de policy / chamador externo | 6 | `is_staff` · `is_super` · `is_owner` · `can_moderate_content` · `pode_publicar` · `contagem_de_migrations` (+ as 2 de contato) |

**A categoria 2 é a maior de propósito.** O Advisor marca todas elas, e em
nenhuma o alerta indica defeito: são RPCs que o painel **precisa** chamar, e a
autorização mora **dentro** delas — `role_rank`, hierarquia, lista fechada,
proteção do `owner`. Revogá-las quebraria a administração sem ganhar segurança.

---

## Advisor: 48 → 47, e o que ele revelou de quebra

A `admin_set_role` saiu da lista. Os 47 restantes são as categorias 1, 2 e 4 —
**exposição necessária**, não defeito.

> **Achado novo do Advisor**, que eu não tinha visto: **`auth_leaked_password_protection`
> está DESLIGADO**. É uma checagem do Supabase contra o HaveIBeenPwned, e é
> **ação de painel dele**. Registrado no `BACKLOG.md` com passo a passo.

---

## O que NÃO foi feito, e por quê

- **Não revoguei as outras 47.** Cada uma tem chamador identificado, guard
  interno, ou é infraestrutura de policy.
- **Não mexi em `search_path`** — as 80 já têm, medido.
- **Não troquei nenhuma para `SECURITY INVOKER`.** Elas existem justamente
  porque precisam passar por cima da RLS de forma controlada.
- **A trava não lê o banco.** Ela lê as migrations — um `GRANT` no editor SQL
  passaria sem ser visto. Contra isso valem o espelho de migrations e a
  disciplina do `BANCO.md`.
