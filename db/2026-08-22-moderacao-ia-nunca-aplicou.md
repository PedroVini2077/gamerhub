# 2026-08-22 — A moderação por IA detectava e nunca aplicava

## Sintoma relatado

> "vc me disse que a publicação seria apagada, e não foi, da uma olhada melhor
> nessa moderação, tem coisa passando desapercebida"

Post com **"Você é um lixo, ninguém gosta de você"** publicado normalmente:
visível no feed, sem entrada na fila de moderação, sem registro no log.

## Causa raiz

A IA **acertou**. Quem falhou foi a linha seguinte.

Log da Edge Function, 18:21:00:

```
[moderate-text] openai post/c94a5de3 flagged=true harassment=0.888 (dial 0.7)
[moderate-text] RPC error: permission denied for function apply_ai_moderation
```

`apply_ai_moderation` só tem `EXECUTE` para `service_role`:

```
quem_executa = {service_role, supabase_admin, postgres}
```

Mas a Edge Function montava o cliente com a **anon key + o JWT do usuário**, ou
seja, chamava a RPC como `authenticated`. Toda chamada morria no mesmo ponto.

**Não era um caso isolado.** Varrendo o log do dia inteiro: **26 de 26**
chamadas de `moderate-text` e **todas** as de `moderate-image` terminaram em
`permission denied`. A moderação por IA nunca ocultou nada em produção.

O erro ficou invisível porque estava só num `console.error` dentro de uma
chamada *fire-and-forget* — o cliente descarta a resposta por design.

## Por que não foi só dar GRANT

`apply_ai_moderation(content_type, content_id, score)` **recebe o score de quem
chama**. Liberar `EXECUTE` para `authenticated` daria a qualquer pessoa logada
o poder de ocultar qualquer conteúdo do site mandando `score = 1` direto na
REST API. A restrição estava certa; o cliente errado é que era o problema.

## Correção

`moderate-text` v9 e `moderate-image` v6:

1. **A RPC passa a ser chamada com `service_role`** (chave que só existe no
   servidor). O cliente com o JWT do usuário continua existindo, mas só para
   identificar quem chamou.
2. **O texto passa a ser lido do banco**, não do corpo da requisição. Isto
   fecha um buraco que a correção acima abriria: com `service_role` na mão,
   bastaria mandar o `content_id` de um post alheio junto de uma frase
   ofensiva para derrubar o post de outra pessoa.
3. **O token passa a ser validado de verdade** (`auth.getUser()`). Antes só se
   checava a *presença* do header `Authorization` — qualquer string passava, e
   as funções têm `verify_jwt` desligado.
4. **Só o autor da linha, ou a equipe, pede a moderação dela** (403 caso
   contrário).
5. **`moderate-image` só baixa URL do próprio storage do projeto.** Antes
   aceitava qualquer URL do corpo — um SSRF: quem chamava escolhia o destino
   do `fetch` que sai de dentro da infra da Supabase.
6. **Falha da RPC volta no corpo da resposta** (`status: "rpc_error"`), não só
   no console. Foi o `console.error` solitário que escondeu isto o tempo todo.

## Como foi provado

Teste em `BEGIN … ROLLBACK`, assumindo cada papel:

| # | Verificação | Resultado |
| --- | --- | --- |
| 1 | `service_role` executa a RPC | OK: executou |
| 2 | post fica oculto | OK: oculto |
| 3 | entra na fila de revisão | OK: 1 item pendente |
| 4 | grava na trilha de auditoria | OK: log gravado |
| 5 | `authenticated` continua **negado** | OK: permission denied |

Na função já publicada, via `curl`:

| Caso | Esperado | Obtido |
| --- | --- | --- |
| Token forjado (`Bearer token.falso`) | 401 | **401** |
| Sem header `Authorization` | 401 | 401 |
| `content_type` inválido | 400 | 400 |

O 401 do primeiro caso é o que prova que a `SUPABASE_SERVICE_ROLE_KEY` está
presente no ambiente: a checagem dela vem **antes** da validação do token, e
teria devolvido 500 se faltasse.

**O que não consegui executar:** a chamada real ponta a ponta pelo navegador —
não tenho um JWT de usuário desta instância. As duas pontas estão provadas
(a IA detecta; `service_role` aplica), o elo do meio é o `admin.rpc()` em
runtime. Se ele falhar, agora aparece como `status: "rpc_error"` na resposta,
em vez de sumir.

## Conteúdo que estava no ar

Os 4 posts que a IA marcou (harassment 0.888–0.891) e não conseguiu ocultar
foram processados pelo mesmo caminho, em produção: os 4 estão ocultos e na
fila.

---

# Segundo achado: cobertura da lista de palavras

O mesmo teste expôs que `vai tomar no cu` passava limpo — nem oculto, nem
enfileirado. O trigger `checar_palavras_bloqueadas` estava correto; faltava a
palavra. O seed de 161 termos não tinha `cu` nem nada em volta dele, nem os
xingamentos mais banais (`idiota`, `burro`, `cala a boca`), nem as abreviações
correntes (`vtmnc`, `fdc`, `krlh`).

Junto veio uma incoerência de severidade: **`vai se matar` era `high`** (oculta)
e **`se mata` / `mata se` eram `medium`** (só enfileira). Mesma incitação
escrita de dois jeitos, tratamento diferente. Promovidas para `high`.

## Falso positivo que eu mesmo criei e removi

Na primeira versão coloquei `vai morrer` como `high`. Num site de **jogos**
isso é fala normal de partida ("esse boss vai morrer rápido") — e `high`
oculta na hora, ou seja, seria censura de conteúdo legítimo. Removido.
`te mato`, `morre logo` e `vou te achar` foram rebaixados para `medium` pelo
mesmo motivo. `privacy` foi erro puro (é a palavra inglesa comum, além do nome
da plataforma adulta) — removido.

## Depois da correção

| Texto | Resultado |
| --- | --- |
| `vai tomar no cu` | visível + fila (`medium`, termo "cu") |
| `seu idiota, cala a boca` | visível + fila (`medium`, termo "idiota") |
| `vai se matar, seu retardado` | **oculto** + fila (`high`) |
| `Cuidado com a garganta do mapa em Atlanta: o boss vai morrer rápido...` | intocado, sem fila |

O último é o controle contra falso positivo: `garganta` contém `anta`,
`Atlanta` contém `anta`, e a frase tem `vai morrer` — nenhum dos três dispara.
