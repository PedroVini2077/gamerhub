# `[18/09]` AUDITORIA EXTERNA, 3ª RODADA — relatório

> Terceiro levantamento externo, com N8–N24. Pedido do dono, na letra: *"tá
> difícil em Claude? Vc fecha e tô achando várias coisas abertas com o
> Claude 👀🤡"*.
>
> Ele está certo, e a resposta honesta não é "fechei mais uma rodada". É que os
> achados reais desta rodada têm **um padrão só**, e o padrão sou eu.

---

## 1. A matriz

| ID | Problema | Verdade? | Como foi medido | Fechado por |
|---|---|---|---|---|
| **N8** | live ocultada/apagada pela equipe continuava pagando 30 XP | **SIM** | `ROLLBACK`, papel `authenticated` real | LIVE-040 |
| **N9** | comentário de post **apagado** continuava pagando 3 XP | **SIM** | idem | LIVE-040 |
| **N10** | comentário de post **oculto** idem | **SIM** | idem | LIVE-040 |
| **N11** | comentário de post fora do ar continuava **legível** | **SIM** | idem | SEC-041 |
| **N12** | live chat idem — a policy era `USING (true)` | **SIM** | idem | SEC-041 |
| N13 | likes idem | **não é falha** — e o próprio relatório diz isso | — | decisão escrita |
| N16 | `lives_realizadas` órfã depois do DELETE físico | **é o desenho** | — | as 3 linhas eram minhas, e foram apagadas |
| N17 | duas sessões do mesmo post multiplicam XP? | **não** | uma linha por sessão; sessão curta não passa no limiar | — |
| N19 | registro criado abaixo de 10 min | **correto** | o limiar é do cálculo, não do registro | — |
| N21 | DELETE físico de live ativa não registra sessão | **correto**, e é o modo de falhar escolhido | — | — |
| N22 | `authenticated` escreve em `lives_realizadas`? | **não** | sem grant nenhum | — |
| N23 | órfãs pertencem ao usuário do teste? | **não** | eram do `claudetester` | — |
| N24 | pedir reativação de live apagada | **bloqueado**, com mensagem genérica | — | — |

**5 confirmados e fechados. 2 respondidos como desenho. 5 verificações que só
confirmaram comportamento correto.**

---

## 2. O padrão, que vale mais do que os cinco achados

A 2ª rodada me ensinou *"varredura de CLASSE, não de caso"* — achei um caso,
não varri, e a auditoria achou os outros cinco.

**Esta rodada é pior, e por isso está escrita primeiro.** Aqui eu não deixei de
varrer depois de achar um caso. Eu **escrevi a regra** e a apliquei em um lugar
só. A regra é de ontem, SEC-028:

> **XP paga pelo que ESTÁ NO AR.** Conteúdo que a moderação tirou não paga.

Existem **quatro** formas de ganhar XP neste site. Eu confirmei **uma**.

| Forma de ganhar XP | Olhava o estado do conteúdo? |
|---|---|
| `posts` | **sim** — foi o que a SEC-028 fez |
| `comments` | só o `hidden_at` do próprio comentário, nunca o **pai** |
| `post_likes` | sim (herdou do `posts`) |
| `lives` | **não**, e eu tinha acabado de tirar essa ligação |

**A pergunta que eu não fiz** era de uma linha: *"quais são TODAS as formas de
ganhar XP, e cada uma olha o estado do conteúdo?"*.

### E o N8 eu não deixei aberto — eu ABRI

Horas antes, a LIVE-036/037 soltou o XP de live do post, para o registro
sobreviver ao cron que apaga a live 15 minutos depois de encerrar. **Isso estava
certo** — sem ele o XP de live durava 15 minutos.

O que eu não vi: ao soltar do **post**, soltei da **moderação**. A moderação age
no post, e o XP tinha deixado de olhar para ele.

Medido em `ROLLBACK`, e é o número que define os três achados de uma vez:

| A moderação faz | XP do autor |
|---|---|
| ocultar um **post comum** | 1 → **0** ✓ |
| ocultar uma **live** | 1 → **1** ✗ |
| apagar uma **live** | 1 → **1** ✗ |

---

## 3. LIVE-040 — invalidar, não apagar

`lives_realizadas` é a testemunha de que a live aconteceu. Apagar a linha
destruiria o **fato** junto com a punição, e tornaria a restauração impossível.
`invalidada_em` separa *"aconteceu"* de *"conta para XP"*.

**E tem inversa**, como o `BANCO.md` exige de toda ação de estado: restaurar o
post devolve o XP. Sem isso um engano da moderação seria permanente — foi
exatamente o caso da `apply_suspension` sem `lift_suspension`.

| O que acontece com o post | A live |
|---|---|
| a equipe **oculta** | invalidada |
| a equipe **restaura** | volta a contar — só desfaz o que a ocultação causou |
| **outra pessoa** que não o autor apaga | invalidada |
| o **autor** apaga o próprio post | continua contando |
| o **cron** apaga fisicamente | continua contando |

### A linha do autor é deliberada, e o relatório externo discorda dela

O N8 do documento descreve um caso mais amplo: *"soft delete de live pode gerar
XP mesmo com o post deletado"*, incluindo o autor apagando o próprio post.

**Eu não fechei essa parte, e o motivo é que o post de live é EFÊMERO POR
CONSTRUÇÃO.** Medido, não suposto — o cron `expire-lives`:

```sql
DELETE FROM public.posts
 WHERE was_live = true AND is_live = false
   AND live_ended_at < now() - interval '15 minutes'
```

O post de uma live **vai** ser apagado, sempre, 15 minutos depois de acabar.
Então *"post apagado ⇒ perde o XP"* não transfere de post comum para live: para
a live, o post sumir é o **fim normal**, não uma punição.

A consequência de fechar o caso do autor seria absurda na tela: apagar a própria
live às 12:00 custaria 30 XP, e esperar até 12:15 para o cron apagar não custaria
nada. **A regra que sobrou é coerente: moderação tira XP, ciclo de vida não.**

### O modo de falhar — a decisão mais importante da rodada

A primeira versão invalidava também no `DELETE` físico, distinguindo cron de
moderação por `auth.uid()` ser `NULL`. **O teste reprovou**, e como ele reprovou
vale mais que o resultado: `RESET role` não limpa `request.jwt.claims`, então o
"cron" de mentira ainda tinha um admin dentro e invalidou o registro.

Isso expôs a fragilidade do **desenho**, não do teste:

| Erro | Consequência |
|---|---|
| não invalidar quando devia | um banido guarda XP que não usa |
| invalidar quando não devia | **o site inteiro perde XP de live 15 min depois de cada live**, calado, para sempre |

O `DELETE` físico nunca invalida. A trava reprova se alguém acrescentar `DELETE`
ao gatilho.

> Conferido depois, e confirma a escolha: o cron faz `DELETE` **físico**, não
> soft delete. O gatilho é `AFTER UPDATE`, então ele nem dispara ali.

---

## 4. SEC-041 — ler não é o mesmo que escrever

A `post_aceita_interacao` nasceu na SEC-029 fechando o **INSERT**. Ninguém
perguntou pelo **SELECT**, e as duas policies estavam assim:

| Policy | Como estava |
|---|---|
| `comments_select` | `hidden_at IS NULL OR role_rank >= 2` |
| `"Todos veem chat"` | **`USING (true)`** |

Medido com papel `authenticated` real: depois de apagar o post, o comum lia
**1 comentário** e **1 mensagem de chat**, enquanto o **post** devolvia 0 linhas.

**Por que passou por três auditorias:** a `comments_select` *parecia* olhar
moderação. Ela olhava a moderação do **próprio comentário**. A `live_chat` não
tinha disfarce nenhum.

**Por que importa:** ocultar um post costuma ser por causa da **conversa**, não
do texto do post — e o `EmbedPlayer` some junto com o post, então a única coisa
que continuava legível era exatamente o que a equipe quis tirar do ar.

Prova, em `ROLLBACK`:

```
A_comum_le_comentario_VIVO    = 1     (não quebrou)
B_comum_le_comentario_APAGADO = 0     (N11 fechado)
C_comum_le_chat_VIVO          = 1     (não quebrou)
D_comum_le_chat_APAGADO       = 0     (N12 fechado)
E_EQUIPE_le_comentario_APAGADO= 1     (moderação intacta)
F_EQUIPE_le_chat_APAGADO      = 1     (moderação intacta)
```

### `post_likes` ficou de FORA, com a conta na mesa

O relatório levantou o mesmo ponto (N13) e concluiu que não é falha. Concordo:

1. **curtida não carrega conteúdo** — o que vaza é *"fulano curtiu o post X"*,
   para quem já tem o id do post;
2. **`post_likes` é a leitura mais quente do site** — o `attachEngagement` busca
   as curtidas de 30 posts de uma vez, em **todo** carregamento de feed.

Trocar o caminho mais quente do app por um vazamento de valor ≈ zero é a conta
errada. Está escrito na migration e travado por teste, para não voltar como
*"esqueceram"*.

---

## 5. N16 — as 3 órfãs eram minhas

O relatório disse: *"a base possui 3 registros órfãos; 1 é elegível pelo limiar
de XP. Não foram removidos por falta de evidência de que sejam artefatos desta
bateria"*. Foi a decisão certa da parte dele — ele não tinha como saber.

Eu tinha. Conferido id, dono, título e duração antes de tocar em qualquer coisa:

| id | dono | título | duração |
|---|---|---|---|
| `36e43ae0-…` | `claudetester` | `[e2e-live 1789749084649] live automatica` | 93,0 min |
| `1ce28254-…` | `claudetester` | `[e2e-live 1789749466633] live automatica` | 0,2 min |
| `a84fa913-…` | `claudetester` | `[e2e-live 1789752412381] live automatica` | 0,1 min |

**As três são do `e2e/lives.mjs` de hoje**, na conta de teste. Nenhuma é de
produção. Apagadas nesta sessão (§5: dado de teste que eu crio, eu apago).

Releitura em statement próprio — porque o `SELECT` da mesma consulta do `DELETE`
enxerga o snapshot **anterior** e não prova nada (§1.5):

```
linhas_agora = 0   orfas_agora = 0   lives_no_xp(claudetester) = 1 -> 0
```

**A de 93 minutos tem explicação, e não é bug recorrente.** O post nasceu às
16:31; a coluna `posts.live_started_at` só passou a existir às 16:52, com a
LIVE-036. Quando a sessão foi registrada às 18:04, o trigger caiu no fallback
para `created_at`. Artefato de migration, não de desenho — as runs seguintes
produzem sessões de segundos, que nunca passam no limiar de 10 minutos.

> **O que sobra registrado no `BACKLOG.md`:** cada execução do `e2e/lives.mjs`
> acrescenta uma linha permanente em `lives_realizadas`. Hoje é ~1 por PR e não
> custa nada, mas é tabela append-only sem retenção (§6.1 item 5).

---

## 6. O que a FAXINA achou depois — e era da própria rodada

A bateria do §6.1 rodou ao fechar o bloco, e o `get_advisors` acusou duas
funções de **trigger** chamáveis como RPC por `anon`:

```
registrar_live_realizada            (LIVE-036, 5 horas antes)
invalidar_lives_do_post_moderado    (LIVE-040, 2 horas antes)
```

**As duas são minhas, e a classe já estava documentada** — o `AUDITORIA.md`,
Fase 4, lista esse padrão desde o `checar_palavras_bloqueadas`. Varredura da
classe inteira: duas, e todo o resto já estava fechado.

🔵 **BAIXO**, e o número está aqui para não inflar: função de trigger chamada
como RPC não tem `NEW` nem `OLD` e estoura em *"record new is not assigned yet"*.
Não dá para forjar live nem invalidar XP por ali. Fechada mesmo assim (SEC-042),
porque *"é inofensiva enquanto o corpo não mexer em nada antes de tocar em NEW"*
é a proteção acidental do §1.3.

### A causa raiz é maior do que as duas, e vai para o dono decidir

`pg_default_acl` do schema, para função criada pelo `postgres` — o papel do
`apply_migration`:

```
{postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
```

**Toda função nova nasce com `EXECUTE` para `anon`.** Para tabela isso foi
fechado no SEC-005; para função, não. O estado de hoje está limpo — 3 funções
alcançáveis por `anon`, as três intencionais —, mas a proteção depende de alguém
lembrar do revoke, que é exatamente o que falhou hoje.

Fechar na raiz muda o contrato de todo trabalho futuro no schema (§7 🟡), então
está **proposto** no `BACKLOG.md` em vez de executado. Até a decisão, a trava
`funcaoDeTriggerNaoEhRpc.test.js` segura a classe.

> **Por que isto está no relatório e não escondido:** a faxina achou um defeito
> que a correção da mesma sessão introduziu. Omitir isso faria o relatório
> parecer mais limpo e seria exatamente o §1.1 sendo violado.

---

## 7. Definição de pronto

| | |
|---|---|
| `npm run build` | limpo |
| `npm run lint` | **0 erros**, 13 warnings (não aumentou) |
| `npm test` | **778 passando**, 100 arquivos |
| mudanças de banco em `ROLLBACK` | sim, as 3 (7 + 6 + 4 asserções) |
| espelho de migrations | 201 = 201 |
| dado de teste criado nesta sessão | apagado, com releitura |

**Travas novas:** `xpSegueOQueEstaNoAr.test.js` (11 asserções) e
`funcaoDeTriggerNaoEhRpc.test.js` (3). Cada uma provada **reinjetando o bug** e
vendo a falha nomeá-lo:

| Bug reinjetado | O teste que caiu |
|---|---|
| tirado `invalidada_em IS NULL` da view | *não conta LIVE invalidada (N8)* |
| tirado `po.deleted_at IS NULL` do bloco de comments | *o comentário só conta se ELE e o PAI estiverem no ar* |
| trocado `AFTER UPDATE` por `AFTER UPDATE OR DELETE` | *o gatilho NUNCA dispara no DELETE físico* |
| devolvido `USING (true)` na `live_chat` | as duas asserções da policy |
| tirado o `REVOKE` da `invalidar_lives_do_post_moderado` | *`invalidar_lives_do_post_moderado` tem o REVOKE na propria migration* — e a falha imprime o comando que falta |

---

## 8. O que continua aberto, dito com todas as letras

- **O popup de confirmação** ao encerrar/excluir a live, e a tela onde o autor
  pede reativação. O banco está pronto para os dois desde a LIVE-038; é trabalho
  de frontend e não entrou nesta rodada.
- **A 4ª decisão de live** (a live tem prazo?) — respondida ao dono nesta
  sessão, esperando a escolha dele.
- **O E2E não rodou aqui.** `E2E_EMAIL`/`E2E_PASSWORD` são secrets do GitHub e
  não existem neste sandbox. O que rodou aqui foi a camada de banco, em
  `ROLLBACK`, e a suíte de travas. O `e2e/lives.mjs` roda no CI.
- **Marcar a caixa "é uma live" continua valendo 30 XP** sem prova de que alguém
  transmitiu. O limiar de duração encareceu a farra (30 XP por 10 minutos de
  relógio, contra 20 XP por post instantâneo), mas não a fechou. É decisão de
  produto, já no `BACKLOG.md`.
