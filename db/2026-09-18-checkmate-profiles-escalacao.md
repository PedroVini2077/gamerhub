# CHECKMATE: a escalação de privilégio em `profiles` — investigação

**Data:** 18/09/2026 · **Pedido dele:** investigação **read-only**, sem alterar
`role`, `banned`, privilégios, Supabase, migration ou commit de correção.

> **NADA FOI ALTERADO.** As duas provas rodaram em `BEGIN … ROLLBACK`. Este
> arquivo é o registro do diagnóstico, não um conserto.

---

## A resposta: **classificação B — a cadeia NÃO fecha**

**B) Exposição de escrita sem impacto de autorização.**

A desconfiança dele estava certa (*"não assuma que HTTP 204 significa que todos
os campos foram modificados"*), e a razão do 204 é exatamente a que ele
suspeitou. Mas a cadeia de escalação quebra no terceiro elo.

---

## 1. GRANTS — o grant é amplo demais, e isso é o achado real

`authenticated` tem **UPDATE em todas as 25 colunas** de `public.profiles`,
incluindo as nove privilegiadas:

| Coluna | UPDATE `authenticated` | SELECT `authenticated` |
| --- | --- | --- |
| `role` | **SIM** | SIM |
| `banned` | **SIM** | SIM |
| `ban_count` | **SIM** | — |
| `suspended_until` | **SIM** | — |
| `banned_by` · `ban_reason` · `ban_details` · `banned_at` · `banned_by_username` | **SIM** | — |
| `role_changed_at` | **SIM** | SIM |

`anon` não tem UPDATE em coluna nenhuma.

### O que explica o erro 42501 que ele viu

O **SELECT é por coluna**; o **UPDATE não é**. `ban_count`, `suspended_until`
e `ban_reason` não têm `SELECT` para `authenticated` — por isso
`Prefer: return=representation` respondeu *"permission denied for table
profiles"*. O PostgREST tentou **ler de volta** colunas que ele não pode ler.

**Campos legítimos de edição do usuário** (o que o frontend manda em
`profileService.updateProfile`): `username`, `bio`, `avatar_url`, `platform`,
`playstyle`, `state`, `favorite_games`, `discord`, `twitch`, `youtube`, e as
preferências `notif_likes`/`notif_comments`.

---

## 2. POLICY — sem `WITH CHECK`, e isso funciona A FAVOR

```
profiles_update · UPDATE · {authenticated}
USING:      (auth.uid() = id) OR is_staff()
WITH CHECK: (nenhum)
```

Sem `WITH CHECK`, o PostgreSQL aplica a expressão do `USING` **também à linha
nova**. Testado:

| Tentativa | Resultado |
| --- | --- |
| trocar o próprio `id` para o de outra pessoa | `new row violates row-level security policy` |
| escrever na linha de outro (`id <> meu`) | **0 linhas** |

---

## 3. TRIGGERS — é um só que segura tudo

| Trigger | Quando | `SECURITY DEFINER` |
| --- | --- | --- |
| `profiles_guard_idade_minima` | BEFORE INSERT/UPDATE | sim |
| **`trg_guard_profile_privileged`** | **BEFORE UPDATE** | **não** (INVOKER) |
| `trg_notify_new_user` | AFTER INSERT | sim |

```sql
if current_user in ('authenticated','anon') then
  new.role := old.role;               new.banned := old.banned;
  new.ban_reason := old.ban_reason;   new.ban_details := old.ban_details;
  new.banned_by := old.banned_by;     new.banned_by_username := old.banned_by_username;
  new.banned_at := old.banned_at;     new.ban_count := old.ban_count;
  new.suspended_until := old.suspended_until;
end if;
```

**Cobre as nove.** É a fonte de silêncio nº 3 do §1.5 — *"o comando passou sem
erro, e o guarda reverteu por baixo"*.

---

## 4. CADEIA DE AUTORIDADE — `profiles.role` É a fonte, confirmado

```
role_rank('user')=1 · ('admin')=2 · ('super_admin')=3 · ('owner')=4 · else 0
is_staff() = role_rank((SELECT role FROM profiles WHERE id = auth.uid())) >= 2
is_super() = ... >= 3        is_owner() = ... >= 4
```

A hipótese dele sobre a cadeia estava **estruturalmente correta**. Ela só não se
realiza porque o elo da escrita não persiste.

---

## 5. A PROVA — `ROLLBACK`, papel de um usuário comum REAL

| | Resultado |
| --- | --- |
| UPDATE direto `role='owner'` | **aceito, sem erro** ← o HTTP 204 dele |
| `role` gravado depois | **`user`** |
| `is_staff()` | **false** |
| `is_owner()` | **false** |
| `admin_set_role(self,'owner')` | bloqueado: *"Acesso negado: admin necessário"* |
| `owner_set_role(self,'owner')` | bloqueado: *"apenas o fundador pode alterar roles"* |
| `current_user` durante o PATCH | **`authenticated`** ← o guarda alcança |

---

## 6. O VETOR QUE A HIPÓTESE NÃO PREVIA — e é o mais interessante

Existem **10 funções `SECURITY DEFINER` que escrevem em `profiles` e são
executáveis por `authenticated`**. Dentro delas, `current_user` é **`postgres`**
— **o trigger não alcança nenhuma**:

```
admin_set_role · owner_set_role · ban_user · unban_user · apply_suspension
lift_suspension · approve_unban_request · decide_role_demotion
decide_staff_trial · review_staff_nomination
```

Essa é a porta que **não** passa pelo guarda, e portanto a segurança delas
depende **inteiramente** do guard interno de cada uma.

Lidos os guards das quatro que mexem em `role`:

| Função | Barreira |
| --- | --- |
| `admin_set_role` | `role_rank(caller) < 2` → nega · não altera a própria role · lista fechada de papéis · alvo `owner` protegido · hierarquia caller > alvo · não promove acima de si |
| `owner_set_role` | só o fundador |
| `review_staff_nomination` | `role_rank(caller) < 3` → nega · não analisa a própria indicação · `super_admin` só pelo fundador |
| `decide_staff_trial` | `role_rank(caller) < 3` → nega · mesmas travas |

Duas testadas em `ROLLBACK`: **bloqueadas**.

---

## 7. IMPACTO — a classificação, e o que a sustenta

**Um usuário comum PODE emitir o UPDATE, e NÃO pode fazê-lo persistir.**

| Elo | Estado |
| --- | --- |
| 1. usuário comum faz UPDATE da própria linha | ✅ permitido (grant + policy) |
| 2. o comando inclui `role` | ✅ aceito, HTTP 204 |
| 3. **o valor persiste** | ❌ **o trigger reverte** |
| 4. `role_rank` muda | ❌ não acontece |
| 5. `is_staff()/is_super()/is_owner()` mudam | ❌ medido: `false` |
| 6. acesso administrativo | ❌ |

**Não é C.** Não há escalação, e não é "falta evidência" (D): a evidência foi
produzida e é negativa.

---

## O que me incomoda, e é o motivo de isto virar prioridade

**A proteção é de CAMADA ÚNICA.**

O grant diz *"pode escrever `role`"*. Só um trigger diz *"não"*. Se ele for
desabilitado (`ALTER TABLE … DISABLE TRIGGER`), renomeado, ou se nascer um
caminho em que `current_user` não seja `authenticated`, **a escalação abre na
hora e em silêncio** — sem erro, sem log, sem teste vermelho.

Isso viola *least privilege* e *deny by default*. E é **o mesmo princípio** do
outro pedido dele (as 48 `SECURITY DEFINER`): a correção é **revogar `UPDATE`
das nove colunas privilegiadas**, deixando `authenticated` com as que o usuário
de fato edita.

**O ganho:** o trigger deixa de ser a única barreira e vira a **segunda**. Duas
camadas independentes, que é o que defesa em profundidade quer dizer.

**Não executado** — ele pediu diagnóstico primeiro, e a correção entra junto com
a proposta das 48.

---

## Números conferidos de passagem (o outro prompt)

| | |
| --- | --- |
| funções `SECURITY DEFINER` em `public` | **80** |
| executáveis por `authenticated` | **48** ← o número do Security Advisor **está correto** |
| executáveis por `anon` | **2** |
| **sem `search_path`** | **0** |
