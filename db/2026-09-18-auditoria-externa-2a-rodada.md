# `[18/09]` AUDITORIA EXTERNA, 2ª RODADA — relatório

> Um documento externo retestou as correções do pentest e trouxe 3 achados
> novos. Pedido do dono: *"veja e feche tudo"*, mais um reforço explícito de
> escopo: *"não considere 'a função/RLS/trigger está correta' equivalente a 'o
> fluxo do GamerHub está seguro'"*.

---

## 1. A matriz pedida

| ID | Problema | Reteste | E2E | Banco | Bypass | Resultado |
|---|---|---|---|---|---|---|
| N1 | `record_banned_login_attempt(NULL)` | NULL, `''`, espaços e e-mail alheio → todos `Acesso negado` | — | 0 linhas forjadas | procurado em casing/whitespace/RPC: nenhum | 🟢 FECHADO |
| N2 | forjar `was_live` no INSERT | derivado de `is_live` | `e2e/lives.mjs` passo 3 | trigger `BEFORE INSERT OR UPDATE` | PATCH direto relido: não muda | 🟢 FECHADO |
| N3 | strings vazias gerando XP | `length(trim())>0` nos 6 campos | — | bônus 140 → exige conteúdo | Unicode/whitespace cobertos pelo `trim` | 🟢 FECHADO |
| N4 | `expires_at` / cleanup | cliente não grava | `e2e/lives.mjs` passo 4 | trigger pina | `cleanup_expired_posts` sem EXECUTE p/ anon nem authenticated | 🟢 FECHADO |
| N5 | `request_role_demotion` | mensagens idênticas | — | autorização primeiro | **a classe tinha mais 5** → SEC-032 | 🟢 FECHADO |
| N6 | LogsPanel / XSS | não reproduzido | — | — | varredura global: 1 `innerHTML`, sem dado de usuário | 🟢 FECHADO |
| — | XP após soft delete | XP cai corretamente | `e2e/lives.mjs` passo 8 | view filtra | outras métricas auditadas | 🟢 FECHADO |
| — | comentário em post apagado | 403 | — | `post_aceita_interacao` | estendido a likes e live_chat | 🟢 FECHADO |
| **06C** | oráculo de existência (`restore_post`) | **confirmado** | — | SEC-032 | **a classe tinha 6 funções** | 🟢 FECHADO |
| **06L** | `parent_id` cross-post | **confirmado** | — | SEC-033, FK composta | — | 🟢 FECHADO |
| **N7** | live spam + estado inconsistente | **confirmado** | `e2e/lives.mjs` passos 6–7 | SEC-034 | — | 🟢 FECHADO |
| **novo** | apagar post não encerrava a live | achado aqui | `e2e/lives.mjs` passo 7 | SEC-034 | — | 🟢 FECHADO |
| **novo** | `admin_set_role` com o mesmo padrão | achado **pela trava** | — | SEC-032b | EXECUTE já revogado (SEC-026) | 🟢 FECHADO |
| **novo** | `auth.uid()` NULL nos guards | item de 11/09 | — | SEC-035 | `anon` sem EXECUTE | 🟢 FECHADO |

---

## 2. A lição que vale mais do que os achados

A SEC-031 (17/09) corrigiu a ordem autorização/validação em **duas** funções. Eu
tratei como dois casos.

| Quem achou | O quê |
|---|---|
| A auditoria externa | `restore_post` — **que eu escrevi no mesmo dia**, com o lookup antes da autorização |
| A varredura que eu devia ter feito na SEC-031 | `soft_delete_post`, `lift_suspension`, `nominate_staff` |
| **A trava de regressão da SEC-032** | `admin_set_role` |

**Seis. Eu tinha corrigido duas.**

`nominate_staff` era a pior: devolvia *"Usuário já possui cargo de staff"* para
quem não pode indicar ninguém — vazava **cargo**, não só existência.

### A armadilha da varredura, pela 9ª vez

A primeira consulta acusou cinco, e uma era a que eu tinha acabado de corrigir —
porque o **comentário que eu escrevi** cita `'Usuário não encontrado'` em prosa.

Ler prosa como código já me pegou nove vezes. Hoje `semComentarios()` roda antes
de qualquer medida de posição, e isso está dentro da trava.

---

## 3. As duas formas de fechar um oráculo

| Quando | Como | Onde se aplicou |
|---|---|---|
| A permissão **não** depende do alvo | autorização primeiro | `restore_post`, `lift_suspension`, `nominate_staff`, `admin_set_role` |
| A permissão **depende** do alvo | unificar a mensagem | `soft_delete_post` |

O segundo não é preguiça: quem pode apagar depende de **quem é o dono**, e
descobrir o dono exige o lookup. A decisão já existia escrita no `fetchPostById`.

**O requisito do pedido foi respeitado:** *"mantenha mensagens úteis para
usuários autorizados"* — o admin continua recebendo `Post não encontrado`.

---

## 4. 06L — o comentário que sumia da tela

A hipótese do relatório era vazamento de conteúdo. **Não vaza.** O que acontece:

```js
const rootIdOf = (c) => {
  let cur = c;
  while (cur.parent_id && byId[cur.parent_id]) cur = byId[cur.parent_id];
  return cur.id;            // para aqui quando o pai NÃO está na lista
};
const rootList = comments.filter(c => !c.parent_id);
```

O órfão tem `parent_id`, então não entra em `rootList`. E o `rootIdOf` devolve o
id **dele mesmo**, então ele é arquivado num balde que nada renderiza.

**O comentário existe, é buscado (custa egress) e nunca aparece.** Mas o
`fetchCommentCount` conta. Contador diz 3, thread mostra 2 — §1.5 puro.

Fechado com FK **composta** `(parent_id, post_id) → (id, post_id)`: trava de 1ª
força, o dado errado passa a ser impossível.

---

## 5. N7 — e o que apareceu investigando

`set_live_ended_at` gravava a data de fim e **nunca a limpava** na reativação:
`is_live = true` **e** `live_ended_at = 12:46` ao mesmo tempo.

**O que ninguém pediu e apareceu:** apagar o post **não encerrava a live**.
`fetchActiveLives` não filtrava `deleted_at`, e a `posts_select` libera conteúdo
apagado a partir de `role_rank >= 2` — a live apagada continuava "AO VIVO" **para
a equipe**.

**O spam:** cada `false → true` notificava todos os admins, sem teto.

| | antes | depois |
|---|---|---|
| notificações de admin que eram de live | **36 de 116** (31%) | com teto |
| 5 ciclos de alternância | 11 linhas | **3 linhas**, com `vezes=5` |
| posts em estado impossível | 1 | **0**, e agora barrado por `CHECK` |

---

## 6. O E2E, que era o reforço do pedido

`e2e/lives.mjs` — o primeiro teste da esteira que confere a **tela** contra o
**estado persistido** com o **token real** do usuário.

| Passo | O que prova |
|---|---|
| 2 | criar live pela interface |
| 3 | o banco concorda com a tela (`is_live`, `was_live` derivado, sem data de fim) |
| **4** | **PATCH nas colunas privilegiadas como o navegador faria — e releitura obrigatória** |
| 5 | encerrar pela interface grava a data |
| 6 | reativar limpa a data (sem estado impossível) |
| 7 | apagar encerra e tira da lista |
| 8 | XP não conta a live apagada |

**Limitação declarada:** eu **não rodei** este teste aqui. O sandbox não tem
`E2E_EMAIL`/`E2E_PASSWORD` — elas são secrets do GitHub. Ele roda no CI, no mesmo
job do `fluxos`. O que rodou aqui foi a camada de banco, em `ROLLBACK`.

**O que ainda falta de E2E** (registrado no `BACKLOG.md`): likes, live chat,
respostas em thread, perfil, notificações na tela, ocultar (≠ apagar), e usuário
comum × moderador na mesma tela.

---

## 7. Varreduras globais que o pedido exigia

| Varredura | Resultado |
|---|---|
| `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `DOMParser`, `document.write` | **1 ocorrência**: `lib/supabase.js`, interpolando duas strings literais do próprio código. Sem dado de usuário, URL ou banco. Não é XSS |
| Views expostas | **1 view** (`xp_dos_usuarios`), `security_invoker` não setado (roda como dono, atravessa RLS) e **sem grant** para `anon`/`authenticated`. `portas-do-banco` exige 401 nela |
| `SECURITY DEFINER` × existência antes de autorização | 6 encontradas, 6 fechadas |
| Funções que interagem com post sem checar o pai | 3 (`comments`, `post_likes`, `live_chat`) — todas fechadas na SEC-029 |

---

## 8. Artefatos de laboratório

O relatório declarou os artefatos. Conferi **id, texto e posts** antes de tocar
em qualquer coisa:

| Apagado | Por quê |
|---|---|
| `5814a9d8-...` `[PENTEST 06L]` | era a **única** linha que violava a FK composta nova |
| `cbb4bd23-...` `SEC-TEST live spam` | era a **única** em estado impossível; normalizado (`is_live = false`), não apagado |

Nenhum outro artefato foi removido. **Nenhum dado de produção foi tocado.**

---

## 9. Definição de pronto

| | |
|---|---|
| `npm run build` | limpo |
| `npm run lint` | **0 erros**, 13 warnings (não aumentou) |
| `npm test` | **762 passando**, 98 arquivos — 3 execuções seguidas, sem flake |
| mudanças de banco em `ROLLBACK` | sim, as 5 |
| espelho de migrations | 193 = 193 |
| backlog | 5 itens concluídos **saíram**; 2 novos entraram |

**Travas novas:** 9 asserções, e a principal varre a **classe** em vez de listar
casos — provada reinjetando o bug no `restore_post` e vendo a falha nomeá-lo.
