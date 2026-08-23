# `send-email` aceitava chamada de qualquer pessoa na internet

**Data:** 23/08/2026 · **Severidade:** alta · **Estado:** corrigido e verificado

---

## Como apareceu

Não foi caçada. O backlog tinha um item bem menor — *"`send-email` falha em
silêncio"* — e ao abrir o código para acrescentar o `gritar()`, a primeira
linha do arquivo respondeu uma pergunta que ninguém tinha feito: **quem pode
chamar isto?**

A função é o *Auth Hook* do Supabase: o GoTrue a invoca para mandar confirmação
de cadastro, recuperação de senha, troca de email e magic link. Por construção
ela roda com `verify_jwt: false` — o gateway não pode exigir JWT de um webhook.
E o corpo da função **não conferia nada**.

## A prova

Um `curl` de fora, sem credencial nenhuma:

```bash
curl -X POST https://<projeto>.functions.supabase.co/send-email \
  -H "Content-Type: application/json" \
  -d '{"user":{"email":"alvo@exemplo.com"},
       "email_data":{"token_hash":"qualquer","email_action_type":"recovery"}}'
```

Resposta: **HTTP 200**. E o email de "Redefinir Senha", com a marca do
GamerHub, chegou no endereço escolhido por quem chamou.

## Por que isso importa mais do que parece

Do menor estrago para o pior:

| Estrago | Como |
| --- | --- |
| Spam em nome do site | Qualquer endereço recebe email com a marca do GamerHub |
| Engenharia social | A vítima recebe um "redefina sua senha" **legítimo** que não pediu — o remetente é real, o visual é o do site |
| **Site fora do ar** | ~500 envios/dia é o teto do Gmail. Estourar a cota, ou o Google travar a conta por envio automatizado, para o cadastro e a recuperação de senha **de todo mundo** |

O terceiro é o que decide a severidade: a brecha não é só incômodo, é um
caminho para **derrubar a porta de entrada do site** a partir de fora, sem
nenhuma conta.

## A causa raiz

O Supabase assina o auth hook no formato **Standard Webhooks** — manda
`webhook-id`, `webhook-timestamp` e `webhook-signature`, e o segredo aparece em
*Authentication → Hooks → Send Email Hook*. A função nunca leu esses
cabeçalhos. O segredo **já existia** e estava configurado; ninguém o conferia.

É a mesma classe de "proteção acidental" do `CLAUDE.md` §1.3: parecia seguro
porque o endereço não é divulgado, e endereço não divulgado não é proteção.

## A correção

1. **Verificação de assinatura** (HMAC-SHA256 sobre `${id}.${timestamp}.${corpo}`,
   com Web Crypto — sem dependência nova), incluindo:
   - janela de 5 minutos no carimbo de tempo, contra *replay*;
   - comparação em tempo constante, para não vazar o prefixo correto;
   - aceita mais de uma assinatura no cabeçalho, que é como o Supabase faz
     rotação de segredo.
2. **Resposta única para toda recusa** — sempre `401 Nao autorizado`. Dizer de
   fora *qual* foi o motivo entregaria de graça o estado da configuração a quem
   está sondando. O motivo de verdade vai para `admin_logs`.
3. **Sem segredo configurado, recusa tudo.** É proposital: cadastro parado e
   barulhento é melhor que hook aberto e silencioso.
4. **O `token_hash` saiu do log.** Ele é a credencial de uso único que confirma
   a conta ou troca a senha, e a função gravava a URL inteira em texto puro no
   log. Quem lesse o log no intervalo assumiria a conta.

## E o item original do backlog: o silêncio

Junto veio o que estava na lista. Toda falha ia para `console.error`, que
ninguém abre — `CLAUDE.md` §1.5, fonte de silêncio nº 7. Agora grita em
`admin_logs`, no painel que o dono já olha:

- chamada recusada (com o motivo e se tinha cabeçalho de assinatura);
- `GMAIL_USER`/`GMAIL_APP_PASSWORD` ausentes;
- SMTP recusando o envio — que é o sintoma de senha de app revogada, conta
  travada pelo Google ou cota estourada.

Para isso, `registrar_falha_de_moderacao` foi **generalizada** em
`registrar_falha_de_edge_function(p_funcao, p_detalhe, p_categoria, p_metadata)`.
A antiga continua existindo e delega — os chamadores de hoje (`moderate-text`,
`moderate-image`) não mudam. Correção pela classe, não pelo caso: qualquer Edge
Function que falhe precisa gritar, não só as duas de moderação.

`EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated`; só `service_role`
chama. O texto vai direto para a trilha de auditoria, então não pode ser
escrito por cliente.

## Como foi verificado

| Teste | Resultado |
| --- | --- |
| O mesmo ataque de antes, sem assinatura | **HTTP 401**, e a recusa registrada em `admin_logs` |
| Com os três cabeçalhos, mas assinatura falsa | **HTTP 401**, registrada como `assinatura invalida` |
| Recuperação de senha **de verdade**, pelo GoTrue | `POST /auth/v1/recover` → 200, e o log da função: `[send-email] enviado com sucesso` |

O segundo teste também respondeu uma pergunta que precisava de resposta antes
de dormir tranquilo: ele foi recusado por *assinatura inválida*, e **não** por
*segredo não configurado*. Isso prova que o `SEND_EMAIL_HOOK_SECRET` existe e
está bem formado — ou seja, endurecer a função não podia ter quebrado o
cadastro. O terceiro teste confirmou na prática.

## O que ficou de fora, e por quê

- **Nenhum limite de taxa.** Com a assinatura exigida, quem chama é o GoTrue, e
  o GoTrue já tem o próprio limite por email e por IP. Um teto adicional aqui
  protegeria contra um GoTrue comprometido — cenário em que a conta de email é
  o menor dos problemas.
- **As Edge Functions continuam fora do git.** Esta correção existe só no
  Supabase: sem histórico, sem revisão, sem *rollback*. Está no backlog.
