# Edge Functions

> **Isto é um espelho, e ele pode mentir.** Leia a seção "Como manter isto
> honesto" antes de confiar num arquivo daqui.

## Por que esta pasta existe

Até 23/08/2026 as Edge Functions viviam **só no Supabase**. Sem histórico,
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
| `responder-contato/` | não* | `[03/09]` A equipe responde uma mensagem do formulário de contato, e o e-mail sai com a cara do site. A checagem de equipe é do BANCO (`is_staff()` nas duas RPCs), chamadas com a credencial de quem pediu |
| `verify-contact/` | não* | `[03/09]` A única porta do formulário público de contato: confere o token do Cloudflare Turnstile e só então chama a RPC com `service_role` |
| `delete-user/` | sim | Exclusão da própria conta |
| `cleanup-orphans/` | sim | Aposentada — limpeza de órfãos do storage, já executada em 06/2026 |

**Apagadas em 27/08/2026** e removidas deste espelho: `cleanup-expired-posts`
(o trabalho dela virou `public.cleanup_expired_posts()` no cron, jobid 1, que
segue rodando de hora em hora) e `debug-hf` (sobra de experimento).
`e2e/portas-fechadas.mjs` continua batendo nas duas e **exige 404** — apagada é
o estado mais fechado possível, mas é um estado que alguém pode desfazer sem
querer.

> O secret `HUGGINGFACE_API_KEY` **não** foi apagado junto, e não deve ser: ele
> ainda é o fallback de texto dentro da `moderate-text`.

\* `verify_jwt` desligado nas seis de cima **de propósito**: o gateway
rejeitaria o preflight `OPTIONS` e quebraria o CORS (e, no caso do auth hook,
o GoTrue não manda JWT nenhum). A validação real é feita **dentro** da função —
`auth.getUser()` nas de moderação, assinatura do webhook na `send-email` — o que
é estritamente mais forte: o gateway aceitaria qualquer JWT do projeto,
inclusive a própria anon key.

A `verify-contact` é o caso diferente da lista, e vale entender por quê: ela é
**pública de propósito** — o formulário de contato existe para quem não tem
conta, então exigir sessão fecharia a porta na cara de quem ela atende. O que
faz o papel do porteiro ali é o **captcha**, e ele só vale porque a RPC do outro
lado deixou de ser chamável por `anon`. As duas coisas são uma só: ver
`docs/SEGURANCA.md`.

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

---

## `[11/09]` A IMPRESSÃO — como saber se o que está no ar é este código

### Por que existe

As duas correções da `send-email` ficaram **5 dias mortas** em produção enquanto
a documentação, um comentário no `e2e/portas-fechadas.mjs` e o próprio código as
descreviam como vivas. Ninguém escreveu nada errado: é o §9.9 puro, *commit não
é deploy*. `scripts/espelho-de-migrations.mjs` já fazia essa pergunta para
migrations; para as Edge Functions não existia equivalente.

### Como funciona

Cada `index.ts` carrega uma constante, e um ramo de `GET` que a devolve:

```ts
const IMPRESSAO_DESTE_CODIGO = "ed63a8793e53a519";

if (req.method === "GET") {
  return new Response(JSON.stringify({ impressao: IMPRESSAO_DESTE_CODIGO }), {
    headers: { "Content-Type": "application/json" },
  });
}
```

O valor é **derivado do código**, nunca digitado: `npm run impressao-edges`
calcula o sha256 de todos os arquivos da pasta — inclusive os irmãos como
`politica.ts` e `email-template.ts`, que vão no mesmo bundle — com a linha da
própria constante neutralizada, para não morder o próprio rabo.

Uma constante `VERSAO = '2026-09-11'` escrita à mão teria o defeito de
reproduzir o problema: editar o corpo, esquecer de subir a data, e os dois lados
passam a concordar num número velho.

### Os dois elos, e quem guarda cada um

| Elo | Pergunta | Quem reprova |
| --- | --- | --- |
| código ↔ impressão escrita | editei a função e a impressão ficou velha? | `npm test` (`impressaoDasEdges.test.js`) |
| impressão escrita ↔ produção | implantei o que editei? | `npm run edges` (`edges-implantadas.mjs`) |

### Por que um GET, e não a API de gerenciamento

A API de gerenciamento devolve o `ezbr_sha256` de cada função implantada — e
exige um **token de gerenciamento** guardado como segredo do CI. Trocar
incerteza de monitoramento por credencial exposta é a conta ruim do `CLAUDE.md`
§0.2, a mesma que deixou o alerta de cota do Sentry de fora.

O `GET` revela um hash de 16 caracteres: **não revela código**, não aceita
entrada, não toca banco e não gasta provedor. Na `send-email` ele sai **antes**
do `motivoParaRecusar`, de propósito — senão cada visita do portão viraria uma
linha de "chamada recusada" em `admin_logs`, que foi a fadiga de alarme de 27/08.

### O estado de hoje, dito com todas as letras

Só a `cleanup-orphans` está implantada com o marcador. As outras 7 esperam um
`SUPABASE_ACCESS_TOKEN` — ver o item no `BACKLOG.md`. **O portão ainda não está
no CI** justamente por isso.

### Ao criar uma função nova

1. Acrescente o marcador e o ramo de `GET` (receita acima).
2. `npm run impressao-edges` e commite.
3. Implante.
4. `npm run edges` para conferir.

Sem o passo 1 a função fica **fora** da vigilância — e o `npm test` reprova,
porque a trava exige o marcador em toda função da pasta.
