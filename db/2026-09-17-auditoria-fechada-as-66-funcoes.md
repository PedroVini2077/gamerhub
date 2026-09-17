# `[17/09]` A auditoria de funções FECHOU — 66 de 66

## Por que este relatório existe

Ele perguntou: *"tinha sobrado itens da auditoria... vc já terminou tudo?"*.

**Não tinha.** O relatório de 12/09 declarava o piso fechado (26 de 26 das que
escrevem e são alcançáveis por quem tem conta) e **23 funções por ler**. Este
documento fecha as 23.

## Método, declarado

| | |
| --- | --- |
| universo | **66** funções `SECURITY DEFINER` que **não** são gatilho |
| corpo lido por inteiro | **todas as que escrevem** + todas as alcançáveis por `anon` |
| guard + formato de retorno conferidos | as de leitura pura triviais (`get_own_profile`, `pode_publicar`) |
| método | leitura de `pg_proc.prosrc`, e prova em `ROLLBACK` no que virou correção |

Superfície, medida hoje: **3** alcançáveis por `anon`, **47** por
`authenticated`, **15** só por `service_role`/`postgres`.

---

## 🟡 SEC-022 · `check_login_status` era porta MORTA, aberta ao anônimo

Qualquer pessoa **sem conta** perguntava por **qualquer e-mail** e recebia
`attempts`, `blocked`, `permanent` e `blocked_until`.

**Por que era inofensiva, e por que isso não bastava.** `login_attempts` está
vazia e continua vazia — o hook que a alimentaria é de plano pago. A função
respondia sempre `attempts: 0` para qualquer endereço.

**A proteção não era a função: era a tabela estar vazia.** No dia do upgrade ela
vira um **oráculo de enumeração** para quem não tem conta — *"este e-mail tem
tentativas registradas?"* responde se o endereço existe **e** se está sob
ataque. §1.3: seguro por efeito colateral é sorte esperando expirar.

**E ninguém chamava.** Varridos `src/`, `supabase/functions/`, `e2e/` e
`scripts/`: **zero chamadas**. A tela de login parou de usá-la em **11/09**,
quando a promessa de bloqueio saiu de lá. O grant ficou seis dias órfão.

**Conserto:** `REVOKE` de `anon` e `authenticated`. A função **fica** — ela é
correta e faz parte do conjunto guardado para o upgrade. Sai o acesso.

**Provado contra o ambiente real:** `POST /rest/v1/rpc/check_login_status` com a
chave anônima devolve **HTTP 401**; `username_disponivel`, que **deve**
continuar aberta, devolve **200**. `e2e/portas-do-banco.mjs`: 46/46.

---

## 🟡 SEC-023 · o alarme de "banido tentou entrar" não tinha teto

`record_banned_login_attempt` gravava em `admin_logs` **e** notificava **toda a
equipe** a cada chamada, sem limite.

**O guard de identidade está certo**, e foi conferido: só dá para reportar o
**próprio** e-mail. Não é forjável — foi a brecha fechada em 28/08. O problema é
que a pessoa banida pode chamar quantas vezes quiser **sobre si mesma**, e ela
tem motivo para insistir.

**Medido, sem ninguém atacando:**

| E-mail | Vezes | Janela |
| --- | --- | --- |
| um | **9** | **28 minutos** |
| outro | 2 | 34 segundos |
| total | 22 | num site com 5 contas |

Isso é o que **uso normal** produz. Uma pessoa irritada faz dezenas.

É a 4ª regra do §0.2: *"alarme que grita à toa é o mesmo problema, do outro
lado"*. Foi assim que `edge_function_error` virou a 2ª ação mais frequente da
trilha com **68 de 68** falsos.

**O conserto não é deixar de avisar.** Dentro de 30 minutos a repetição
**atualiza a linha existente**, e o contador entra na história. Provado em
`ROLLBACK`:

```
9 tentativas  ->  1 linha de log  ·  1 notificação
detalhe: "Conta banida tentou fazer login: @claudetester (9 vezes em 30 min)"
e-mail alheio: "Acesso negado." (o guard de 28/08 intacto)
```

Nove tentativas viram **uma linha dizendo "9 vezes"**, e não nove dizendo
"1 vez" — o mesmo desenho do `lib/tetoDeEventos.js`.

### ⚠️ Uma divergência que EU criei hoje, e ela é decisão dele

Ao ler `registrar_falha_de_edge_function` **depois** de aplicar o SEC-023,
descobri que ela já resolve o mesmo problema — e escolheu o **caminho oposto**,
com a razão escrita no código:

> *"Suprimido de propósito. A trilha é append-only, então não dá para
> incrementar um contador na linha existente sem mudar essa natureza —
> consequência aceita: a linha diz QUE aconteceu, não quantas vezes."*

Agora existem **duas soluções diferentes para o mesmo problema** no mesmo banco:

| Função | Estratégia | O que ganha | O que perde |
| --- | --- | --- | --- |
| `registrar_falha_de_edge_function` | **suprime** a repetição | trilha estritamente append-only | a contagem |
| `record_banned_login_attempt` (hoje) | **atualiza** a linha | "9 vezes" é sinal de verdade | a linha deixa de ser imutável |

**O argumento do append-only é legítimo**, e eu não o considerei antes de
escrever — li aquela função depois. Trilha de auditoria cujas linhas mudam é
evidência mais fraca.

**O argumento a favor de atualizar** é que aqui a contagem **é** a informação:
"alguém banido tentou 1 vez" e "tentou 30 vezes em meia hora" são fatos
diferentes, e o segundo é o que interessa. E a linha alterada descreve um evento
**do sistema**, não uma ação humana.

**Não decidi sozinho.** Está no `BACKLOG.md` como decisão dele. Alinhar as duas
é barato nos dois sentidos; o que não pode é ficar como está, com duas respostas
para a mesma pergunta (§4, fonte única).

---

## O que foi lido e está CERTO — sem achado

Vale registrar, porque auditoria que só lista defeito não diz o que está de pé.

**Exemplares, e servem de modelo:**

- **`enviar_mensagem_de_contato`** — faixa em **todos** os campos, assunto em
  lista fechada, teto por remetente (3/24 h) **e** disjuntor global (60/h),
  mais a notificação que impede a mensagem de cair numa tabela que ninguém abre.
  É o §5 inteiro num lugar só.
- **`request_role_demotion`** — rank, não-próprio, não-owner, cargo proposto tem
  que ser **inferior**, quem pede tem que estar **acima** do alvo, motivo ≥ 10
  caracteres, sem duplicata pendente.
- **`decide_role_demotion`** — rank ≥ 3, decisão em lista fechada, e **quem
  pediu não pode decidir**: separação de funções de verdade.
- **`solicitar_revisao_do_proprio_ban`** — faixa 20..1000, exige estar banido, e
  a anti-duplicata é **por episódio de banimento** (compara com `banned_at`),
  não global — quem for banido de novo pode recorrer de novo.
- **`contabilizar_falha_de_login`** — só grava a trilha na **transição** para
  bloqueado, nunca na repetição. O comentário explica: *"sem isso a trilha
  encheria a cada tentativa de conta já travada"*.
- **as três `cleanup_*`** — retenção por tabela, bloqueio **permanente** nunca
  apagado, live em andamento nunca tocada, e `DELETE` em vez de `TRUNCATE` **de
  propósito**, para o trigger `AFTER DELETE` limpar a fila de moderação.
- **`apply_ai_moderation`** — distingue *"ocultou"* de *"só mandou revisar"* na
  trilha e na severidade, e **só avisa o autor se ocultou de verdade**.

**Conferidas e corretas, sem nota:** `username_disponivel` (faixa + a tela de
cadastro precisa dela) · `contagem_de_migrations` (exceção decidida em 12/09) ·
`admin_delete_unconfirmed_user` (restrita a conta nunca confirmada) ·
`request_unban` · `a_senha_confere` · `confere_a_propria_senha` ·
`contato_dados_para_resposta` · `hook_de_verificacao_de_senha` ·
`handle_user_confirmed` · os três `owner_get_*`.

**`get_user_xp` não tem guard, e está certo assim:** devolve só agregados (xp,
posts, curtidas, comentários, lives) que a página de Ranks já mostra
publicamente. O `profile_bonus` revela se a pessoa preencheu bio/avatar/redes —
todos visíveis no perfil público.

---

## Cobertura final

| | |
| --- | --- |
| funções `SECURITY DEFINER` não-gatilho | **66** |
| lidas | **66** |
| achados nesta rodada | **2** (SEC-022, SEC-023) — os dois corrigidos e provados |
| divergência aberta | **1**, e é decisão dele |

**A auditoria de funções está fechada.** O que continua aberto é o que sempre
esteve: as Fases 1 (frontend) e 3 (banco) da rodada, e as decisões de produto
que não são minhas.
