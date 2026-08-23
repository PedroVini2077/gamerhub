# Edge Functions

> **Isto é um espelho, e ele pode mentir.** Leia a seção "Como manter isto
> honesto" antes de confiar num arquivo daqui.

## Por que esta pasta existe

Até 23/08/2026 as oito Edge Functions viviam **só no Supabase**. Sem histórico,
sem revisão, sem rollback: o código que decide quem recebe email do site e o que
a moderação por IA oculta nunca passou por um diff.

Isso não é hipótese. Em 23/08, ao abrir a `send-email` pela primeira vez em
semanas, achamos que **qualquer pessoa na internet** disparava email com a marca
do site para qualquer endereço, e que a `moderate-links` tinha uma porta
decorativa que aceitava `Bearer lixo-qualquer`. As duas estavam assim havia
tempo. Um PR teria mostrado as duas linhas.

## O que tem aqui

| Pasta | `verify_jwt` | O que faz |
| --- | --- | --- |
| `send-email/` | não* | Auth Hook do GoTrue: confirmação de cadastro, recuperação de senha, troca de email, magic link. Valida assinatura Standard Webhooks |
| `moderate-text/` | não* | Modera texto de post, comentário, mural e chat pela OpenAI (reserva: HuggingFace) |
| `moderate-image/` | não* | Modera imagem pela OpenAI. Gore **enfileira**, nunca oculta — ver `docs/MODERACAO.md` |
| `moderate-links/` | não* | Checa link contra o Google Safe Browsing |
| `delete-user/` | sim | Exclusão da própria conta |
| `cleanup-orphans/` | sim | Aposentada — limpeza de órfãos do storage, já executada em 06/2026 |
| `cleanup-expired-posts/` | sim | Aposentada — virou `public.cleanup_expired_posts()` no cron |
| `debug-hf/` | sim | Neutralizada — sobra de experimento com Hugging Face |

\* `verify_jwt` desligado nas quatro de cima **de propósito**: o gateway
rejeitaria o preflight `OPTIONS` e quebraria o CORS (e, no caso do auth hook,
o GoTrue não manda JWT nenhum). A validação real é feita **dentro** da função —
`auth.getUser()` nas de moderação, assinatura do webhook na `send-email` — o que
é estritamente mais forte: o gateway aceitaria qualquer JWT do projeto,
inclusive a própria anon key.

## Como manter isto honesto

Estes arquivos foram capturados do que estava implantado em **23/08/2026**. O
Supabase continua sendo quem executa: nada aqui é implantado automaticamente, e
**um deploy pelo dashboard faz o repositório mentir sem que nada mude aqui.**

Duas regras, então:

1. **Mudança em Edge Function começa aqui.** Edite o arquivo, abra o PR,
   implante o conteúdo do arquivo. Nunca o contrário.
2. **Não existe teste que compare este espelho com a produção.** Compará-los
   exigiria um token de gestão do Supabase guardado no CI — trocar uma
   divergência de documentação por uma chave de administração exposta é péssimo
   negócio.

O que **existe** é `e2e/portas-fechadas.mjs`: ele bate nas funções em produção
a cada PR e exige que as portas continuem fechadas. Ele não garante que o código
daqui seja igual ao de lá; garante que a parte que mais dói não regrediu.

## Rodar localmente

Não há setup local neste projeto (sem Supabase CLI). Para inspecionar o que
está de fato implantado, use o MCP do Supabase (`get_edge_function`) ou o
dashboard.
