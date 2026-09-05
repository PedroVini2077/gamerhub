# `[05/09/2026]` Auditoria — FASE 4: a deriva entre o código e o banco

> **O que é este arquivo.** O retrato de um dia. Ele **deve envelhecer**, e o
> varredor de documentação o ignora de propósito. O estado atual do sistema mora
> em `docs/`, não aqui.

## Por que esta fase, e não outra

Não foi escolha de calendário. Horas antes, consertando outra coisa, apareceu um
bug que é **exatamente** o formato de um achado de Fase 4: a XP contava curtidas
de `posts.likes`, uma coluna que nenhum trigger mantém. O frontend contava
certo, o banco contava errado, e **cada lado sozinho parecia saudável** — ler
qualquer um dos dois isoladamente não revelava nada.

Onde nasce um desses, nascem irmãos. A Fase 4 é a varredura desses irmãos.

## Cobertura, com o número real

Os **oito** confrontos da lista do `AUDITORIA.md` foram feitos. Não é amostra:
esta fase é enumeração por natureza, e a lista dela é fechada.

| # | Confronto | Resultado |
| --- | --- | --- |
| 1 | assinaturas de realtime × publicação `supabase_realtime` | **bate** — as 10 do código são as 10 publicadas |
| 2 | tabelas sem policy de UPDATE × telas que dão update | **nenhuma** das 14 recebe update do cliente |
| 3 | policies com `super_admin` sem `owner` | **nenhuma** — a trava das 3 reincidências segurou |
| 4 | hierarquia à mão × `role_rank()` | **bate** — `user 1, admin 2, super_admin 3, owner 4`, e o desconhecido é 0 nos dois |
| 5 | mapas de tipo do JS × valores que o banco grava | **bate** — `content_type` (post, comment, chat) e `trigger_type` (ai, wordlist) |
| 6 | `admin_logs.action` × mapa de ícones | **11 sem ícone** |
| 7 | `admin_notifications.type` × mapa de ícones | **2 sem ícone** |
| 8 | privilégio de coluna × o que a tela lê | **nenhuma** tela pede coluna revogada de `profiles` |
| — | regras duplicadas (bloqueio de login) | **não há duplicação**: o cliente lê o estado que o banco devolve, não recalcula os limiares |
| — | `get_advisors` (segurança) | 0 ERROR · 53 WARN, todos `SECURITY DEFINER` executável |

## O achado: 13 rótulos que o banco produz e a tela não conhecia

**O sintoma seria invisível.** Nada estoura, nada loga, nenhum teste quebra — a
linha só aparece no painel com o ícone genérico. É §1.5 na forma mais pura.

**As 11 de `admin_logs.action`**, cada uma por uma função viva:

| action | escrita por |
| --- | --- |
| `user_unsuspended` | `lift_suspension` |
| `auth_rate_limited` | `contabilizar_falha_de_login` |
| `auto_solicitado` | `solicitar_revisao_do_proprio_ban` |
| `admin_delete_unconfirmed` | `admin_delete_unconfirmed_user` |
| `demotion_approved` · `demotion_rejected` | `decide_role_demotion` |
| `staff_nomination_approved` · `staff_nomination_rejected` | `review_staff_nomination` |
| `staff_trial_confirmed` · `staff_trial_extended` · `staff_trial_reverted` | `decide_staff_trial` |

**As 2 de `admin_notifications.type`:** `security_alert`
(`contabilizar_falha_de_login`) e `user_unsuspended` (`lift_suspension`).

### A causa raiz não era a lista estar errada

Havia uma trava para isto — `ACTIONS_DO_BANCO`, uma lista escrita à mão em
`logMeta.js`, criada justamente porque a varredura do código-fonte não enxerga
action gravada por função do Postgres.

**Ela tinha 11 entradas. O banco produzia 30.**

O defeito não era o conteúdo: era o **formato**. Uma lista que precisa ser
lembrada a cada função nova é a mesma classe de falha que ela deveria resolver —
e ela falhou do jeito mais silencioso possível, ficando verde enquanto
envelhecia.

## A correção: a lista deixou de existir

Os 13 ícones entraram. Mas o que fecha a classe é que
`src/lib/__tests__/actionsDoBanco.js` passou a **derivar** os valores das
próprias migrations, que são — por decisão registrada — a verdade sobre o
schema.

**Ele lê por posição de coluna, não por regex de literal.** A primeira tentativa
foi pegar todo literal perto de `admin_logs`: devolveu 44 achados, **21 deles
lixo** (nomes de coluna, chaves de jsonb como `reason` e `tamanho`, categorias).
Trava que grita por falso positivo vira ruído, e ruído ensina a ignorar o canal.
Então ele faz o que o Postgres faz: acha a posição de `action` na lista de
colunas do `INSERT` e pega o valor daquela posição, respeitando parênteses
aninhados e aspas escapadas.

O mesmo módulo serve `admin_notifications.type` — porque fechar um lado e deixar
o irmão aberto é literalmente o erro que esta fase existe para não repetir.

**Provado reinjetando**, nos dois: removido o ícone de `user_unsuspended`, a
trava de `admin_logs` falha nomeando-o; removido o de `security_alert`, a de
`admin_notifications` falha nomeando-o.

## O buraco que sobra, dito com todas as letras

`CREATE OR REPLACE` aplicado direto no Supabase, sem passar pelo repositório,
escapa desta trava. É o mesmo buraco que o README de `supabase/migrations` já
descreve, e a resposta é a mesma: **migration que não está lá não existe**.

## As quatro funções alcançáveis por quem NÃO tem conta

Lidas uma a uma, o corpo inteiro. Não é amostra: são quatro.

| Função | O que ela entrega a um estranho | Veredito |
| --- | --- | --- |
| `check_login_status(email)` | o estado de bloqueio daquele email | 🔵 **fica** — só lê `login_attempts`, e uma linha ali nasce na primeira TENTATIVA, exista a conta ou não. Não confirma existência, então não é oráculo de enumeração. A tela de login precisa dela antes de haver sessão |
| `username_disponivel(texto)` | se um apelido já existe | 🔵 **fica** — é por construção: o formulário de cadastro checa disponibilidade antes de existir conta. Valida o formato antes de consultar, e apelido é público de qualquer forma (aparece em todo post) |
| `contagem_de_migrations()` | um inteiro: quantas migrations o projeto tem | 🔵 **fica** — zero dado pessoal, e é o que o portão de números usa |
| `get_user_xp(uuid)` | contagem de posts, comentários e lives de alguém | 🟡 **FECHADA** — ver abaixo |

### `get_user_xp` deixou de ser alcançável por anônimo

**A severidade honesta é baixa**, e vale dizer para não inflar o achado: o que
ela devolve é agregação de dado que já é público. Não vaza email, data de
nascimento nem nada revogado.

**Fechou por duas razões, e nenhuma é "por precaução":**

1. É um endpoint de **cálculo** sem sessão — quatro `COUNT`, um deles com
   `JOIN`, e nada limita quantas vezes por segundo alguém chama. Num plano
   gratuito, computação anônima e ilimitada é cota sendo gasta (§0.2).
2. **Ninguém anônimo precisa dela.** Verificado nos quatro chamadores:
   `Ranks.jsx` usa `user.id`; `useUserXP` só é consumido por `Sidebar` e
   `AvatarPopup`, que só existem logado; `fetchProfileStats` é do perfil; e
   `/u/:username` está atrás de `RequireAuth`. Nenhum e2e ou script de CI a
   chama com a chave anônima.

Superfície que não serve a ninguém só pode ser usada contra o site.
**Testado em `ROLLBACK` antes de aplicar:** assumindo `anon`, a chamada passou a
ser recusada; assumindo `authenticated`, continuou funcionando.

## O que continua NÃO coberto

Os **48** avisos de `authenticated_security_definer_function_executable`. Eles
são o desenho normal deste projeto — RPC feita para quem está logado, com a
checagem de identidade dentro do corpo —, mas *"é o desenho normal"* não é
evidência de que **cada uma** das 48 checa direito. Ler as 48 é trabalho de
Fase 2, não de Fase 4, e não foi feito aqui.
