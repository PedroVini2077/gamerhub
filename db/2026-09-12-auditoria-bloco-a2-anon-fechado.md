# `[12/09]` BLOCO A2 — `anon` deixou de ler o banco

> Continuação direta do [BLOCO A](2026-09-12-auditoria-profunda-bloco-a.md).
> Aqui a régua deixou de ser proposta e virou estado do banco.

## A decisão do dono, que é maior do que o achado

Palavras dele, e elas mudam o padrão do projeto e não só este caso:

> *"Admin, super admin e owner são os que têm poderes no site e acesso às
> coisas. Agora user e anon não pode 'nada', nada que dê poder a eles ou ver
> coisas sensíveis. Não quero que anon veja nada — fecha isso para o anon **e
> para qualquer caso a partir de hoje**."*

A proposta do BLOCO A era revogar **3 tabelas**. A régua dele manda revogar
**tudo**, e é o que foi feito.

## O que estava aberto — medido, não suposto

| | |
| --- | --- |
| tabelas em que `anon` tinha `SELECT` | **26 de 29** |
| tabelas em que `anon` tinha `INSERT`/`UPDATE`/`DELETE` | **26 de 29** |

Entre elas: `admin_logs` (2.561 linhas), `moderation_queue`, `violations`,
`reports`, `unban_requests`, `staff_nominations`, `role_change_requests`,
`notifications`, `login_attempts`.

### O que isso NÃO era, e por que a distinção importa

**Não era um vazamento em curso.** Assumindo o papel `anon` e contando linha por
linha nas 29 tabelas, só três devolviam alguma coisa:

| Tabela | Linhas que `anon` via |
| --- | --- |
| `site_config` | 14 |
| `game_keys` | 6 |
| `community_post_media` | 1 |

**A RLS estava segurando o resto.** `admin_logs` tem 2.561 linhas e `anon` via
**0**; `posts` tem 275 e via 0; `moderation_queue` tem 20 e via 0.

**Então por que fechar?** Porque privilégio e policy são duas travas, e o
projeto estava contando com uma só. A distância entre *"o que a policy permite
hoje"* e *"o que o privilégio permitiria"* é o espaço onde o próximo erro cabe —
e ele já tinha cabido: `live_chat` tem policy `USING (true)` **e** grant para
`anon`. Ela não vazava porque está **vazia**. No dia da primeira live, o chat
inteiro passaria a ser legível sem conta, sem ninguém mexer em nada.

## O que foi aplicado

Migration `anon_nao_le_nada_exceto_site_config`:

1. `REVOKE ALL` de `anon` nas **29 tabelas**;
2. `GRANT SELECT (key, value, updated_at) ON site_config TO anon` — **a única
   exceção**, e por COLUNA, não por tabela: coluna nova nasce fechada;
3. `ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON TABLES/SEQUENCES FROM anon` — é
   isto que atende o *"para qualquer caso a partir de hoje"*. Sem ele a régua
   valeria para o retrato de hoje, e a próxima tabela nasceria aberta.

### Por que `site_config` é a única

É a única tabela que uma tela de deslogado lê (`useConfigDoSite`), e ela carrega
o **modo manutenção** e os portões de funcionalidade. Sem ela, o site fora do ar
perde a capacidade de dizer que está fora do ar.

Tudo o mais que o público usa passa por **RPC** (`username_disponivel`,
`check_login_status`) ou **Edge Function** (`verify-contact`) — e privilégio de
função não é tocado por revoke de tabela. Conferido em transação, não deduzido.

`/keys`, `/community` e `/lives` estão **todas** atrás de `RequireAuth`: os
grants de `game_keys` e `community_post_media` não serviam a tela nenhuma.

## A validação, em três camadas

### 1. Em `ROLLBACK`, antes de aplicar (§5) — com um usuário REAL

A primeira rodada usou um uuid inventado e deu `posts = 0`. **Isso teria validado
o teste errado**, então foi refeita com um perfil que existe:

| | antes | depois |
| --- | --- | --- |
| posts | 275 | **275** |
| comments | 62 | **62** |
| game_keys | 6 | **6** |
| notifications | 2 | **2** |
| community_posts | 1 | **1** |

Idêntico, linha por linha. E `authenticated` **não é membro de `anon`**
(conferido em `pg_auth_members`), que é o que garante que revogar de um não
alcança o outro.

### 2. Depois de aplicar, no banco de produção

| Pergunta | Resposta |
| --- | --- |
| `anon` ainda lê alguma tabela? | só `site_config` (14 linhas) |
| `anon` ainda escreve em alguma? | **NADA** |
| as RPCs de cadastro e login funcionam? | **OK** |
| o usuário real perdeu alguma linha? | nenhuma |

### 3. Pela porta da frente, com a chave anônima de verdade

`e2e/portas-do-banco.mjs`: **46/46 portas no lugar**, e as novas respondendo
**HTTP 401** — resposta observada, não inferida. `e2e/smoke.mjs`: **18/18 rotas**
de pé como visitante.

**O que NÃO foi validado aqui:** os fluxos autenticados em navegador
(`e2e/fluxos.mjs`) exigem as credenciais que só existem no CI. Rodam lá. O que
esta sessão provou do lado logado foi no **banco** — que é a camada que a
mudança toca.

## A trava — e ela pegou a mudança sozinha

`portas-do-banco.mjs` acusou as cinco colunas de `game_keys` fechando e fez a
pergunta certa: *"isso pode ser BOM — se foi proposital, tire a coluna de `pode`
aqui"*. Foi proposital, e a expectativa foi atualizada **com o motivo escrito**.

Junto entraram `live_chat` e `live_chat_timeouts`, que não estavam na lista.
Elas estão lá agora justamente porque **não vazavam por estarem vazias** — a
única trava possível contra esse tipo de porta é uma que a teste mesmo vazia.

## O que fica em aberto, e é honesto dizer

**`GRANT ... TO anon` escrito à mão numa migration futura passa por cima do
`ALTER DEFAULT PRIVILEGES`.** O que pega isso é o `portas-do-banco.mjs`, e ele
só enxerga as tabelas que estão na lista dele. Uma tabela nova, com grant
explícito, ficaria fora dos dois. Registrado no `BACKLOG.md`.
