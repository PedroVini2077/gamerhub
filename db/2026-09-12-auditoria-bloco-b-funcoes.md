# `[12/09]` BLOCO B — o corpo das funções que ESCREVEM

> Continuação dos blocos [A](2026-09-12-auditoria-profunda-bloco-a.md) e
> [A2](2026-09-12-auditoria-bloco-a2-anon-fechado.md).

## O método, e por que ele não é `grep`

Ordem do dono no pedido da auditoria: *"NÃO faça uma caça superficial por
palavras como SECURITY DEFINER, role, admin ou owner. Leia o fluxo completo."*

As 43 funções restantes foram **classificadas** por consulta (escrevem? qual
barreira?) só para decidir a **ordem de leitura** — a classificação é `grep` e
não vale como veredito. O que vale é o corpo lido.

| | escrevem | só leem |
| --- | --- | --- |
| barreira: só identidade (`auth.uid()`) | **4** | 3 |
| barreira: staff | 11 | 5 |
| barreira: super/owner | 13 | 6 |

**Este relatório cobre 9 das 43** — as 4 que escrevem com a barreira mais fraca,
e 5 das 11 de staff. As 34 restantes seguem no próximo bloco.

## As 4 que escrevem com só identidade

| Função | Veredito |
| --- | --- |
| `solicitar_revisao_do_proprio_ban` | ✅ **exemplar** — checa nulo, faixa de 20–1000 caracteres, se está de fato banido, e duplicata. É o modelo do §5 aplicado inteiro |
| `record_banned_login_attempt` | ✅ confere que o e-mail pedido é o **do próprio chamador** antes de gravar |
| `reset_login_attempts` | ✅ apaga só a linha do próprio e-mail |
| `delete_own_account` | 🟡 **ACHADO** — ver abaixo |

### 🟡 SEC-012 · apagar a conta é irreversível e NÃO pede a senha

O corpo inteiro é uma linha:

```sql
DELETE FROM auth.users WHERE id = auth.uid();
```

**O que está certo:** `id = auth.uid()` com `auth.uid()` NULL não casa com
ninguém, então sessão sem identidade não apaga nada. Não é o bug de `<>` com
NULL que o §5 descreve.

**O que está errado é a ausência.** A ação mais destrutiva e **irreversível** do
site inteiro acontece atrás de um `ConfirmModal` — validação de cliente, que o
§1.3 diz explicitamente não valer nada, porque a `anon key` permite chamar
`/rest/v1/rpc/delete_own_account` direto. Uma sessão deixada aberta num
computador alheio apaga a conta com **uma requisição**.

**E o projeto já tem a peça certa, usada no lugar menos grave.** O
`ResetDoCofre` — que redefine o código do cofre do Fundador, ação
**reversível** — confere a senha **no servidor** via
`confere_a_propria_senha`. A trava mais forte está na ação menos destrutiva.

**Solução:** `delete_own_account(p_senha text)` chamando
`confere_a_propria_senha` antes do `DELETE`, e a tela pedindo a senha. É o
padrão que já existe; não há mecanismo novo a inventar.

**NÃO EXECUTADO.** Muda o contrato de uma RPC e a tela (§7 🟡), e §7 🔴 manda
alertar antes em qualquer coisa que envolva perda de dado de usuário. Esperando
decisão.

## 5 das 11 que escrevem com barreira de staff

| Função | Veredito |
| --- | --- |
| `admin_delete_unconfirmed_user` | ✅ `role_rank >= 2`, e só apaga quem tem `confirmed_at IS NULL` — não alcança conta ativa. Loga |
| `admin_unlock_login` | ✅ `role_rank >= 3`. É a função que já teve o bug de barrar o próprio fundador; hoje `>= 3` inclui `owner` (rank 4) |
| `request_unban` | ✅ `is_staff()`, confere que o alvo está banido e que não há pedido pendente. Loga e notifica |
| `notify_owner` | 🔵 lista de papel à mão — ver abaixo |
| `notify_user` | 🟡 **ACHADO** — ver abaixo |

### 🟡 SEC-013 · `notify_user` manda qualquer coisa para qualquer um, sem rastro

```sql
IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
  RAISE EXCEPTION 'Access denied: admin required';
END IF;
INSERT INTO notifications (user_id, type, message) VALUES (p_user_id, p_type, p_message);
```

A barreira de cargo está correta. O que falta é tudo o mais:

| Falta | Consequência |
| --- | --- |
| **registro em `admin_logs`** | um admin manda mensagem a qualquer pessoa e **não fica rastro nenhum** |
| faixa em `p_message` (§5) | texto sem teto |
| lista fechada em `p_type` | tipo desconhecido cai no mapa de ícones da tela — a família do *fallback silencioso* (§4) |
| conferir se `p_user_id` existe | `INSERT` aceita uuid que não é ninguém |

**O impacto real, e ele NÃO é XSS.** Conferido: não existe
`dangerouslySetInnerHTML` em lugar nenhum do projeto, então a mensagem é
renderizada como texto. O que sobra é **engenharia social com a voz do sistema**
— *"sua conta foi comprometida, faça X"* chegando como notificação oficial — e,
pior, **sem trilha**. Toda a filosofia de auditoria deste projeto é que ação de
equipe deixa rastro; esta não deixa.

**Severidade 🟡 e não 🟠** porque exige cargo de admin, que é papel de confiança.
O defeito central é de **prestação de contas**, não de invasão.

### 🔵 Cinco funções ainda escrevem a hierarquia À MÃO

O `CLAUDE.md` é explícito: *"Hierarquia nunca se escreve à mão. Existe
`role_rank()`, `is_staff()` e `is_super()`. Lista literal é bug esperando
acontecer — foi assim três vezes."* Achei **cinco sobreviventes**:

| Função | O que está escrito | Inclui `owner`? |
| --- | --- | --- |
| `unban_user` | `NOT IN ('super_admin','owner')` | **sim** |
| `approve_unban_request` | `NOT IN ('super_admin','owner')` | **sim** |
| `deny_unban_request` | `NOT IN ('super_admin','owner')` | **sim** |
| `notify_owner` | `NOT IN ('admin','super_admin')` | **não** |
| `owner_get_stats` | `role IN ('admin','super_admin')` | é **contagem**, não guarda |

**E aqui eu tenho que ser preciso, porque a manchete seria enganosa.** As três
primeiras **funcionam hoje** — a lista inclui `owner`. Isto **não é** a falha de
14 policies de antes, que *omitiam* o `owner`. É o **padrão** que produziu
aquela falha, ainda vivo, sem nada impedindo a sexta ocorrência de errar.

- `notify_owner` exclui `owner`: o fundador não consegue mandar alerta **para o
  próprio owner**. O efeito prático é nulo (é avisar a si mesmo), mas é
  literalmente a mesma linha de código que causou as três quedas.
- `owner_get_stats` conta `role IN ('admin','super_admin')` — isso é uma
  **métrica**, não permissão. O painel do Fundador diz "N admins" **sem contar o
  fundador**. Pode ser proposital; é decisão de produto, não de segurança.

**Por que não corrigi agora:** trocar guarda de cinco funções é mudança de
comportamento em RPC sensível (§7 🟡), e o ganho hoje é higiene. O que **falta e
vale mais** é uma trava que reprove lista literal em `prosrc` — sem ela, esta
mesma seção reaparece na próxima auditoria.

## `[12/09]` CORREÇÃO do achado das "listas à mão" — a minha varredura era rasa

A seção acima diz *"cinco funções escrevem a hierarquia à mão"*. **A varredura
que produziu esse número procurava `IN ('admin','super_admin')` e nada mais** —
então ela não via `<> 'super_admin'` nem `role = 'owner'`. Refeita com um
casamento mais largo, o quadro é outro, e mais útil:

| O que está escrito | Onde | Veredito |
| --- | --- | --- |
| `NOT IN ('super_admin','owner')` | `unban_user`, `approve_unban_request`, `deny_unban_request` | 🔵 **é `is_super()` escrito à mão** — deveria usar o auxiliar |
| `role = 'owner'` | **9 funções** (`owner_get_*`, `owner_set_*`…) | ✅ **correto, e não tem alternativa** |
| `NOT IN ('admin','super_admin')` | `notify_owner` | 🔵 exclui o `owner`, com efeito prático nulo |
| `v_caller_role <> 'super_admin'` | `nominate_staff` | ✅ **deliberado**, e a mensagem de erro explica |
| `role IN ('admin','super_admin')` | `owner_get_stats` | métrica, não permissão |

### O que a varredura rasa escondia, e é o achado de verdade

**`role = 'owner'` não é hierarquia — é UM papel específico.** `is_super()` é
`role_rank >= 3`, o que inclui `super_admin`; usá-lo numa função só do fundador
**abriria** o acesso. As 9 estão certas.

**O que falta é um `is_owner()`.** Ele não existe: medido, `is_staff()` e
`is_super()` existem e `is_owner()` **não**. É por isso que nove funções
escrevem `role = 'owner'` à mão — não por descuido, mas porque não há o que
usar. O risco é o de sempre: nove cópias da mesma decisão divergem na primeira
vez que alguém mudar o nome do papel.

**E `nominate_staff` é o oposto de um bug.** Ela exige `super_admin` literal
para indicar a super admin, excluindo o fundador **de propósito** — a mensagem
de erro diz por quê: *"o fundador é o avaliador independente dessas
indicações"*. É separação de funções, e teria sido "corrigida" por uma varredura
automática. Registrado aqui para ninguém a consertar.

## As 4 de cargo e ban — todas passam, e duas com sobra

| Função | O que ela faz de certo |
| --- | --- |
| `apply_suspension` | faixa de 1–30 **com checagem de nulo**, rank > 1, hierarquia estrita, loga, avisa a equipe **e o alvo** |
| `lift_suspension` | mesma hierarquia, confere que a pessoa ESTÁ suspensa, e tem comentário no SQL dizendo que usa `role_rank` de propósito |
| `admin_set_role` | sete guardas: alvo existe, não é você, papel válido, alvo não é o fundador, seu cargo é maior que o do alvo **e** ≥ ao que você está dando |
| `decide_role_demotion` | `FOR UPDATE` na linha (barra decisão dupla por corrida) e **quem pediu não pode decidir** — separação de funções de verdade |

## As de BAN — dois achados, e o segundo é de arquitetura

### 🟡 `ban_user` — a trilha pode ficar SEM O MOTIVO

`p_reason` não tem validação nenhuma: nem nulo, nem tamanho. E o log é montado
por concatenação:

```sql
'@' || v_target_username || ' foi banido por @' || v_caller_username
  || '. Motivo: ' || p_reason
```

**Em SQL, `'texto' || NULL` é NULL** — medido, não deduzido. E
`admin_logs.details` **aceita NULL** (conferido no `information_schema`). Então
um ban com motivo nulo grava uma linha de trilha **com o detalhe inteiro vazio**:
some o alvo, some quem baniu, some o motivo.

A mesma coisa acontece na `admin_notifications` que avisa a equipe.

**É o §1.5 na forma mais pura:** a ação acontece, a trilha existe, e ela não diz
nada. E é o §5 na letra — *toda entrada de RPC precisa de FAIXA, não só de tipo*.

**Conserto:** `IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE`, e
`coalesce` nas concatenações como defesa em profundidade.

### 🟡 A INVERSA do ban existe para a marca, não para o CONTEÚDO

`ban_user` faz, além de marcar o perfil:

```sql
DELETE FROM posts           WHERE user_id = p_user_id;
DELETE FROM comments        WHERE user_id = p_user_id;
DELETE FROM community_posts WHERE user_id = p_user_id;
DELETE FROM live_chat       WHERE user_id = p_user_id;
```

**`DELETE` de verdade, não `soft_delete`.** O projeto TEM o caminho reversível —
`soft_delete_post` marca `deleted_at` justamente para a moderação poder voltar
atrás, e existe `restore_post`. O ban não usa nenhum dos dois.

**O resultado é uma assimetria em duas dimensões**, e as duas contrariam a regra
do `BANCO.md` (*"toda ação de estado precisa da INVERSA"*):

| | quem pode | é reversível? |
| --- | --- | --- |
| marcar como banido | **admin** (rank 2) | sim — `unban_user` |
| apagar todo o conteúdo | **admin** (rank 2) | **NÃO** |
| desbanir | **super_admin** (rank 3) | — |

Ou seja: **quem destrói é um nível ABAIXO de quem desfaz**, e a parte que ele
destrói é justamente a que não tem volta. Um desbanimento devolve a conta e não
devolve nada do que a pessoa escreveu — e ela não é avisada disso: a notificação
diz *"sua conta voltou ao normal"*.

**Isto pode ser intencional** — banir para purgar é uma política defensável, e
por isso não é 🟠. Mas se for, precisa estar escrito, e a mensagem de
desbanimento precisa parar de prometer o que não entrega. **É decisão de
produto, e é do dono.**

### 🔵 `unban_user` não confere se a pessoa está banida

`lift_suspension` confere (*"Este usuario nao esta suspenso"*) — medido.
`unban_user` **não**. Desbanir quem não está banido "funciona": os `UPDATE`
rodam sem efeito, e a pessoa **recebe uma notificação** dizendo que o banimento
dela foi revisto e removido. Aviso sobre um castigo que ela nunca teve.

## Cobertura declarada

| | |
| --- | --- |
| funções `SECURITY DEFINER` alcançáveis | **31 lidas por inteiro de 50** (7 no BLOCO A + 24 aqui) |
| das que ESCREVEM com barreira mais fraca | **4 de 4** |
| das que escrevem com barreira de staff | 5 de 11 |
| das que escrevem com barreira super/owner | 8 de 13 |
| listas de papel à mão | **5 de 5** enumeradas |

**Este bloco está PARCIAL, não concluído.** Faltam **19** funções: 4 que
escrevem (`decide_staff_trial`, `deny_unban_request`, `review_staff_nomination` e
`contato_registrar_resposta` já lida) e 15 que só leem.

---

# BLOCO C — a classe do NULL, e o que ela custou

> Escrito depois de aplicar. As correções deste bloco estão **no ar** e foram
> testadas em `ROLLBACK` antes disso — o roteiro completo, com as 16 asserções,
> está reproduzido abaixo.

## O achado que virou uma classe inteira

Fui atrás de um item do BLOCO B (o `unban_user` não conferir se a pessoa está
banida) e a leitura do corpo mostrou outra coisa, maior:

```sql
IF v_caller_role NOT IN ('super_admin','owner') THEN
  RAISE EXCEPTION 'Access denied: super_admin required';
END IF;
```

**Medido, não deduzido:**

```
select (null::text not in ('super_admin','owner'));   -->  NULL
select (null::text <> 'super_admin');                 -->  NULL
select ('x' || null::text);                           -->  NULL
select role_rank(null);                               -->  0
```

`IF NULL THEN ... END IF` **não dispara**. Então o portão está aberto para
exatamente um perfil de chamador: **quem não tem linha em `profiles`**. O
`SELECT role INTO v_caller_role` não acha nada, a variável fica NULL, e o guard
vira um comentário.

## A prova, e ela CORRIGIU a minha hipótese

Montei o ataque em `ROLLBACK`: um `sub` no JWT sem perfil correspondente,
chamando `unban_user` contra um alvo banido descartável.

Eu previ *"o guard passa e o desbanimento acontece"*. **Metade estava certa.** O
guard passou e a função seguiu adiante — mas o que a derrubou foi outra coisa:

```
1_unban_sem_perfil = OK: bloqueado — null value in column "admin_username"
                     of relation "admin_logs" violates not-null constraint
3_alvo_ainda_banido = sim (guard segurou)
```

O que segurou foi um **`NOT NULL` numa coluna de log**, que recebeu o nome do
chamador (NULL). Isso é §1.3 na letra — *"desconfiar de proteção acidental. Se
algo só está seguro por efeito colateral de outra regra, isso não é proteção; é
sorte esperando expirar"*. Duas coisas seguravam, e as duas são acidentais:

| O que segurava | Por que não conta como proteção |
| --- | --- |
| `NOT NULL` em `admin_logs.admin_username` | é uma coluna de **log**. Ela não sabe que está fazendo controle de acesso, e qualquer migration futura pode afrouxá-la. E ela só alcança porque o `INSERT` vem **depois** do `UPDATE` na mesma função — trocar a ordem abriria tudo |
| 0 usuários de auth sem perfil hoje (medido: 5 auth / 5 perfis) | é um invariante do trigger `handle_new_user`, que vive **fora** destas funções |

## A varredura de classe — cinco funções, três consertos diferentes

```sql
select p.proname, prosrc ~* 'role_rank|is_staff\(\)|is_super\(\)' as tem_rede
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and prosrc ~* '(NOT IN|<>|!=)\s*\(?\s*''(owner|super_admin|admin)''';
```

| Função | O guard | Conserto | Por quê |
| --- | --- | --- | --- |
| `unban_user` | `NOT IN ('super_admin','owner')` | `is_super()` | queria dizer "super **ou acima**" |
| `approve_unban_request` | idem | `is_super()` | idem |
| `deny_unban_request` | idem | `is_super()` | idem |
| `notify_owner` | `NOT IN ('admin','super_admin')` | `is_staff()` | idem — **e isso incluiu o `owner`, que estava de fora** |
| `nominate_staff` | `<> 'super_admin'` | `IS DISTINCT FROM` | queria dizer **exatamente** super_admin, e isso é desenho |

**`is_super()` é NULL-safe por construção**, e essa é a razão de ele ser a
resposta certa e não uma checagem de `IS NULL` colada em cada função:

```
role_rank(NULL) --> 0    (o CASE cai no ELSE)
is_super()      --> 0 >= 3 --> false
```

Papel ausente passa a **negar**, que é a direção segura. É também a regra que o
projeto já tinha escrita — *"hierarquia nunca se escreve à mão"* — e estas cinco
eram as últimas a violá-la.

**O caso do `nominate_staff` merece nota**, porque foi onde quase errei: trocar
por `is_super()` ali teria deixado o `owner` **indicar** para super admin, e a
própria mensagem da função explica que *"o fundador é o avaliador independente
dessas indicações"*. `is_super()` teria destruído a separação de papéis enquanto
consertava o NULL. `IS DISTINCT FROM` preserva o sentido literal e fecha o NULL.

**`notify_owner` mudou de comportamento, de propósito.** O guard excluía o
`owner` de uma função de equipe — ele recebia "Acesso negado". `is_staff()`
(rank ≥ 2) o inclui. É o mesmo padrão que já mordeu três vezes aqui: lista de
papéis escrita à mão esquecendo o `owner`.

## A irmã: o mesmo NULL no PARÂMETRO — e o CHECK não segura

A varredura encontrou o outro lado. O guard que valida o papel que o **cliente
manda**:

```sql
IF p_new_role NOT IN ('user','admin','super_admin') THEN RAISE ...
UPDATE profiles SET role = p_new_role WHERE ...
```

Com `p_new_role = NULL` o IF não dispara e o `UPDATE` grava NULL. **E o CHECK da
coluna aprova**, o que é o detalhe que engana:

```sql
CHECK (role = ANY (ARRAY['user','admin','super_admin','owner']))
```

Constraint só reprova em **`false` explícito**. `NULL = ANY(...)` é NULL, e NULL
não é false. Medido em `ROLLBACK`:

```
1_check_aceita_null   = SIM: role virou NULL, o CHECK nao barrou
2_rank_do_perfil_nulo = role_rank=0
3_owner_set_role_null = FALHOU: aceitou NULL como cargo
4_cargo_depois        = (NULL)
```

**Um perfil de papel nulo tem rank 0 — abaixo de `user`, que é 1.** É um estado
que nenhuma tela, policy ou função sabe que existe. O `admin_set_role` chamado
sobre um perfil assim responde *"Usuário não encontrado"*, que é mensagem falsa
(§1.5): manda procurar o usuário em vez do estado.

🟡 **Médio, e não mais**: só o `owner` alcança o `owner_set_role`. Não é
escalada de privilégio — é um pé de ferro que o dono pode disparar sozinho pela
REST API, cujo estrago não tem tela que mostre nem caminho óbvio de volta.

> **Uma leitura minha foi contaminada e eu a refiz.** O primeiro roteiro
> imprimiu `nulos_hoje_em_producao = 1` — mas ele contava **dentro** da
> transação, depois de eu mesmo ter nulado o perfil de teste. Medido de novo
> fora: **0 perfis com `role` nulo e 0 com `banned` nulo**, em 5. Registrado
> porque quase virou um alarme falso num relatório.

## A trava é de NÍVEL 1 — o dado errado virou impossível

```sql
ALTER TABLE profiles ALTER COLUMN role   SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN banned SET NOT NULL;
```

Cabia uma checagem de `IS NULL` dentro das duas RPCs — **nível 4** na tabela do
§2, e a próxima RPC que escrevesse em `role` nasceria sem ela. `NOT NULL` na
coluna vale para todo caminho que existe **e para os que ainda não existem**.

As duas colunas já tinham DEFAULT (`'user'` e `false`), então nada precisou
mudar no cadastro — verificado em `ROLLBACK` que o trigger `handle_new_user`
continua criando o perfil com `role=user banned=false`.

A checagem explícita entrou **também**, mas por outro motivo: sem ela a
mensagem que chega no toast do painel é o texto cru do Postgres.

### E ela pegou um erro MEU, escrito na hora

Na primeira migration eu escrevi o guard novo do `unban_user` assim:

```sql
IF NOT v_target_banned THEN RAISE EXCEPTION 'Este usuario nao esta banido.';
```

`banned` era **nullable**. `NOT NULL` (o valor) é NULL, o IF não dispara, e o
desbanimento seguiria — **exatamente a regra que eu estava fechando, violada no
código do conserto**. Corrigido para `IS NOT TRUE`, e a coluna virou `NOT NULL`.

## SEC-014 — `ban_user` aceitava qualquer texto como motivo

O `BanModal` oferece **seis** motivos numa lista fechada. A RPC aceitava `text`.
O site usa a `anon key`, então a REST API é chamável direto — e esse texto vai
para a trilha de auditoria, para a `BannedScreen` da pessoa banida e para a
notificação de toda a equipe.

Junto, dois buracos de alvo inexistente. `'@' || NULL || ' foi banido'` é NULL
inteiro, e como `admin_logs.details` é **NULLABLE** isso **grava**: a trilha
ganha uma linha `admin_ban` sem história nenhuma enquanto o `UPDATE` afetou 0
linhas e ninguém foi banido. Sucesso na tela, nada no banco, mentira no log.

Faixas que entraram: motivo em lista fechada · detalhes ≤ 300 (o `maxLength` do
modal, que agora vale de verdade) · nota de desbanimento ≤ 500 · alerta ao owner
≤ 2000 · alvo tem que existir · alvo tem que estar banido.

## O roteiro em ROLLBACK — 16 asserções, todas verdes

| | |
| --- | --- |
| `A1` chamador sem perfil → `unban_user` | **`Access denied: super_admin required`** (antes: erro de constraint) |
| `A2` chamador sem perfil → `notify_owner` | `Acesso negado.` |
| `A3` admin (rank 2) → `unban_user` | `Access denied: super_admin required` |
| `B1` motivo inventado | `Motivo invalido: motivo inventado.` |
| `B2` alvo inexistente | `Usuario nao encontrado.` |
| `B3` detalhes com 301 caracteres | `Os detalhes devem ter no maximo 300 caracteres.` |
| `B4` **ban válido** | banido |
| `C1` admin → `notify_owner` | enviou |
| `C2` **owner → `notify_owner`** | enviou (antes era "Acesso negado") |
| `D1` desbanir inexistente | `Usuario nao encontrado.` |
| `D2` desbanir quem não está banido | `Este usuario nao esta banido.` |
| `D3` **desban válido** | desbanido |
| `D4` chamada com 1 argumento | o `DEFAULT` de `p_note` sobreviveu |
| `E1` estado final | `banned=false` |
| `E2` trilha | 2 linhas, **0 com `details` NULL** |
| `E3` aviso à pessoa | 1 notificação |

> **O `D4` existe por causa de um erro que o Postgres me poupou.** Meu primeiro
> `CREATE OR REPLACE` omitia `DEFAULT NULL::text`, e ele recusou: *"cannot
> remove parameter defaults"*. Três destas funções têm parâmetro opcional que o
> cliente usa. Sem essa recusa, eu teria quebrado as chamadas de um argumento.

## As travas, provadas uma a uma reinjetando o bug

`src/lib/__tests__/guardDePapelNaoAceitaNull.test.js`. Ela lê
`supabase/migrations/` e reconstrói a **última** definição de cada função — o
que é legítimo porque o portão `espelho-de-migrations.mjs` já garante que a
pasta e o banco têm o mesmo conteúdo (conferido: **173 = 173**). Migration
antiga com o código velho é história, não estado, e não reprova.

| Bug reinjetado | A trava disse |
| --- | --- |
| `NOT IN` de volta no `unban_user` | *"`unban_user` (definida por último em …213000…) voltou a comparar o papel do chamador"* |
| `IS NULL` fora do `owner_set_role` | *"valida `p_new_role` com NOT IN e sem checar IS NULL antes"* |
| `DROP NOT NULL` em `banned` | *"profiles.role NOT NULL: true · profiles.banned NOT NULL: false"* |
| 7º motivo só no `BanModal` | *"Os motivos de ban DIVERGIRAM"*, com as duas listas |
| `notify_owner` renomeada | *"Não achei a definição final de `notify_owner`"* |

> **Uma reinjeção "falhou" e o motivo é o desenho funcionando.** Injetei o bug
> na migration `210000` e a trava continuou verde — porque a `213000` redefine
> `unban_user` depois. "Último vence" estava certo; eu é que tinha mirado na
> definição errada.

## O que este bloco NÃO fez

- **SEC-015** (o ban apaga conteúdo de forma irreversível; `admin` destrói e
  `super_admin` desfaz; a notificação promete *"sua conta voltou ao normal"*)
  continua **aberto**. É decisão de produto e é do dono.
- **`deny_unban_request` não avisa a pessoa.** A aprovação avisa; a negativa
  não. Quem recorreu fica sem resposta. 🔵 — anotado no `BACKLOG.md`.
- Continuam faltando **19 de 50** funções para ler.

---

# BLOCO D — a leitura das funções que faltavam

Enumeradas **66** funções `SECURITY DEFINER` que não são gatilho (a consulta
exclui `pg_trigger`). Deste bloco saíram uma correção e três anotações.

## O que eu suspeitei e estava ERRADO

`reset_login_attempts()` — sem argumentos, escreve, e é chamável por qualquer
`authenticated`. Pelo nome e pela assinatura, parecia o caso clássico de
"qualquer pessoa logada zera o contador de força bruta de todo mundo". Lida por
inteiro, ela é:

```sql
DELETE FROM public.login_attempts
WHERE email = lower((SELECT email FROM auth.users WHERE id = auth.uid()));
```

Escopo do **próprio** email, tirado do `auth.uid()` e não de parâmetro. Não há
o que forjar. Registrado porque quase virou achado: a assinatura assustava e o
corpo desmentiu (§1.1 — inferência não é fato).

Conferidas junto e **corretas**: `admin_unlock_login` (`role_rank < 3`,
NULL-safe, e o `owner` passa porque rank 4 ≥ 3) · `restore_post` (rank + a
mesma hierarquia estrita do `soft_delete_post`) · `notify_user` (faixa de 500,
tipo em lista fechada, alvo tem que existir, e grava na trilha).

## 🔵 SEC-019 · `owner_set_site_config` aceita QUALQUER chave — e é MUDO

```sql
INSERT INTO site_config (key, value, ...) VALUES (p_key, p_value, ...)
ON CONFLICT (key) DO UPDATE SET value = p_value, ...
```

`p_key text`, sem faixa. E o `ON CONFLICT ... DO UPDATE` é o que torna isso
silencioso em vez de barulhento: chave desconhecida **não** dá erro, ela
**cria linha nova**.

**O caminho da falha.** O dono digita `maintenence_mode` — ou um refactor
renomeia uma chave num lado só. A RPC responde **sucesso**. O painel mostra o
toast verde. A trilha de auditoria registra *"@dono alterou maintenence_mode:
'false' para 'true'"*. Tudo confirma, do lado de quem clicou. Mas o site lê
`maintenance_mode`, essa linha continua `false`, e **o site não entra em
manutenção**.

Nada estoura, nada aparece na tela, nada vai para log de erro, nenhum teste
quebra — os três canais do §1.5 em branco, no painel cuja função é tirar o site
do ar e devolvê-lo.

**Conserto: lista fechada de 14 chaves.** Elas foram conferidas em **três**
lugares e batem sem sobra de nenhum lado — o estado inicial do `SiteTab.jsx`, as
14 linhas que existem hoje na tabela, e agora o SQL.

Junto: `is_owner()` no lugar do `role = 'owner'` escrito à mão (era mais uma
cópia da mesma decisão, §4), e faixa de 500 no valor — `banner_text` e
`pause_reason` vão para a tela de todo mundo, e `text` aceita megabytes.

**🔵 Baixo, e o número importa:** só o `owner` alcança esta função. Não é brecha
de privilégio; é um comando de painel que pode mentir que funcionou.

**Validado em `ROLLBACK`**, 6 asserções: chave com typo recusada nomeando a
chave · chave nula recusada · valor de 501 recusado · **as 14 chaves reais
aceitas** · admin recusado · a tabela continuou com 14 linhas, sem linha morta.

**Trava** (`siteConfigChavesFechadas.test.js`), provada nos **dois** sentidos —
porque fechar a lista no banco cria uma deriva nova, não só resolve uma:

| Bug reinjetado | A trava disse |
| --- | --- |
| `feature_torneios` só no painel | *"As chaves DIVERGIRAM"*, com as duas listas e o `+ feature_torneios` |
| a lista fechada some do SQL | *"não valida mais `p_key` com uma lista fechada"* |

## O que fica anotado, e por que não virou correção agora

- **`notify_user` aceita 9 tipos; o `NOTIF_META` estiliza 4.** Os outros cinco
  (`warning`, `info`, `success`, `error`, `system`, `role`) caem no sino
  genérico. Isso **não é bug**: o `DESCONHECIDO` é fallback deliberado e
  visível, escrito para não fingir que era outra coisa. Mas a lista da RPC
  promete mais do que a tela sabe desenhar, e escolher ícone é decisão de
  design. Backlog.
- **`restore_post` restaura post que não está apagado**, sem erro. O `UPDATE`
  não tem `AND deleted_at IS NOT NULL`. Efeito nulo e nenhuma mentira na tela —
  é a irmã fraca do que o `unban_user` tinha. Backlog.
- **`KEY_LABEL[key] || key`** no `SiteTab.jsx` é fallback silencioso pelo
  formato (§4), mas benigno: o padrão é a própria chave, que informa. Com a
  lista agora fechada nos dois lados, o caso deixou de ser alcançável.

## Cobertura declarada — acumulada dos quatro blocos

| | |
| --- | --- |
| funções `SECURITY DEFINER` não-gatilho | **66** enumeradas |
| lidas por inteiro | **43** |
| das que ESCREVEM e são alcançáveis por `authenticated` | **26 de 26** — o piso do §6 está fechado |
| das que só `service_role` alcança | 6 de 14 |
| das que só leem | 11 de 26 |

**As 23 que faltam não são o piso.** São 8 de `service_role` (moderação
automática, limpeza agendada, o hook de senha — alcançáveis só por Edge
Function) e 15 de leitura pura. Ainda assim: **este bloco está parcial**, e o
que falta está nomeado, não arredondado.
