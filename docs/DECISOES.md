# Decisões

> **Para que serve:** guardar o que foi decidido e, principalmente, **o que foi
> descartado e por quê**. Sem isto, a mesma discussão volta daqui a dois meses
> e alguém "conserta" uma decisão que era proposital.
>
> Não é backlog (aquilo é [checklist do que falta](../BACKLOG.md)) nem histórico
> (isso está no `git log`, nos PRs e em `db/AAAA-MM-DD-*.md`). É o **porquê**.
>
> Toda entrada leva data. Decisão sem data não dá para saber se ainda vale.

---

## Ferramental

### `[23/08]` CI no GitHub Actions em vez de disciplina

`build`, `lint` e `test` rodavam porque alguém lembrava. Agora rodam a cada PR.
Público é ilimitado; privado são 2.000 min/mês contra ~3 min por PR.

**Junto veio o piso de 125 testes.** O CI quebrando é o caso fácil — fica
vermelho e alguém olha. O perigoso é ele **passar sem testar nada**: arquivo de
teste renomeado, `describe.skip` esquecido, glob de config alterado. Ao
adicionar testes, subir o piso junto.

### `[23/08]` O E2E autenticado roda com conta comum, nunca de staff

Parece limitação e é o contrário: com `role = 'user'` o teste pode **exigir**
que `/admin` e `/owner` não mostrem nada, o que é uma checagem de permissão num
navegador de verdade — a única camada que faltava (RLS e RPC já são validadas
em transação com ROLLBACK). Com conta de admin, além de perder isso, o post
soft-deletado continuaria visível com o aviso "Post excluído" e o passo de
exclusão não teria como se provar.

**O que ele não cobre, de propósito:** banimento e moderação. Precisariam de
uma segunda conta como vítima e são destrutivos.

### `[23/08]` Só em PR, porque escreve no banco de produção

O teste publica e apaga um post de verdade. Repetir no push da `main` depois do
merge duplicaria a escrita sem cobrir nada novo. Não existe ambiente de staging
— criar um segundo projeto Supabase custaria mais atenção do que protege com
3 usuários.

### `[23/08]` Dependabot ignora atualizações **major** de propósito

Patch e minor entram agrupados, semanalmente, teto de 3 PRs. Major fica de fora
porque **já quebrou o site uma vez** — foi o upgrade do react-router que
motivou o teste de fumaça existir. Major entra na mão, com changelog lido.

### `[23/08]` DSN do Sentry fica no código, não em variável de ambiente

Ele é público por natureza (vai no bundle que qualquer visitante baixa), então
guardá-lo como segredo não protegeria nada. E se dependesse da Vercel, bastaria
esquecer de configurá-lo num deploy futuro para o monitoramento sumir **sem
ninguém perceber** — construindo exatamente a falha silenciosa que ele existe
para acabar.

### `[23/08]` `send-email` recusa tudo se o segredo do hook sumir

A alternativa era continuar enviando e só avisar. Foi descartada: deixaria o
hook aberto para a internet por tempo indeterminado, que é exatamente a brecha
que acabou de ser fechada. **Cadastro parado e barulhento é melhor que hook
aberto e silencioso** — o parado alguém conserta hoje; o aberto ninguém vê.

Toda recusa devolve o mesmo `401`, sem dizer o motivo. Distinguir "assinatura
inválida" de "segredo não configurado" na resposta seria contar de graça o
estado da configuração a quem está sondando. O motivo vai para `admin_logs`.

### `[23/08]` Sem limite de taxa próprio na `send-email`

Com a assinatura exigida, quem chama é o GoTrue — que já tem limite por email e
por IP. Um teto adicional aqui só protegeria contra um GoTrue comprometido,
cenário em que a conta de email é o menor dos problemas.

### `[23/08]` Falha das Edge Functions vai para `admin_logs`, **não** para o Sentry

O backlog pedia "Sentry nas Edge Functions". Foi feito diferente:

1. sem dependência nova numa função que está no **caminho crítico da moderação**;
2. cai no painel que o dono **já olha**, em português, junto do resto da trilha;
3. o Sentry do frontend já cobre o outro lado — a chamada que nem chega a sair.

Se a operação crescer, o Sentry no Deno vira complemento, não troca.

### `[23/08]` Descartados, com o motivo

| O quê | Por que não |
| --- | --- |
| **CodeQL** | US$30 por committer/mês, e entrega pouco além do `npm audit` no tamanho deste projeto |
| **Agregadores de IA** (TypingMind, Monica, MagAI) | São interfaces de **conversa**: não rodam migration, não leem `pg_policies`, não abrem PR. Seriam um passo atrás do MCP do Supabase e do GitHub, que já estão conectados |
| **Plugins de terceiros do Claude Code** | Executam código arbitrário com o privilégio do usuário, e a Anthropic não audita servidores MCP. Os dois que importariam aqui já estão conectados |
| **PC dedicado para desenvolvimento** | O CI resolve as mesmas duas limitações do ambiente remoto (navegador que não alcança o Supabase, realtime que não se observa), de graça e sem máquina ligada |

**O que vale de multi-modelo:** segunda opinião **manual** antes de aplicar
migration que mexe em RLS, hierarquia ou `SECURITY DEFINER`. Colar o SQL em
outro modelo e perguntar "o que pode dar errado aqui?". Custo zero, dois
minutos, pega ponto cego. Não vale automatizar.

---

## Moderação

### `[23/08]` `violence/graphic` enfileira e **nunca** oculta

É a decisão mais importante do subsistema. Nenhum modelo distingue gore de Doom
de gore real, e **a maioria das imagens do site é print de jogo**. Auto-ocultar
derrubaria metade do conteúdo legítimo no primeiro dia.

Com o destino sendo a fila, um limiar errado gera **fila maior** — nunca
censura. Isso também tirou a medição prévia do caminho crítico: o erro virou
reversível.

`sexual`, `sexual/minors` e `self-harm*` continuam ocultando.

### `[23/08]` O texto moderado vem do banco, não do cliente

Aceitar o texto do corpo da requisição permitia mandar o `content_id` de um
post alheio junto de uma frase ofensiva e **derrubar o post de outra pessoa**.

### `[23/08]` `apply_ai_moderation` só é executável por `service_role`

Ela recebe o score de quem chama. Liberá-la para `authenticated` daria a
qualquer pessoa logada o poder de ocultar qualquer conteúdo mandando score 1.
Foi por isso que o conserto do "permission denied" **não** foi um `GRANT`.

### `[23/08]` "Sem punição" é uma escolha explícita, não o padrão

Aprovar um item sem marcar ação dava zero ponto **em silêncio**, e a escalação
automática (8 pontos suspende, 15 bane) só é alimentada por esses cliques. Com
o hábito de "aprovar e seguir", a punição existia no papel e nunca disparava.

### `[23/08]` `high` no chat de live é **recusado**, não ocultado

`live_chat` não tem `hidden_at`, e a mensagem já foi lida por quem estava na
sala no instante em que apareceu — esconder depois não repara nada. Nos outros
tipos, `high` oculta e vai para a fila.

### `[23/08]` Suspensão limitada a 1–30 dias

Sem teto, um `admin` suspendia até o ano 2126 e nem o fundador desfazia (o
trigger-guarda revertia o `UPDATE` manual em silêncio) — virava banimento
permanente pulando toda a hierarquia do ban. Mais que 30 dias é caso de
banimento, que tem reversão própria.

### `[20/08]` Denúncia criada **não** gera log de auditoria

Qualquer usuário pode denunciar; logar isso em `admin_logs` inflaria a trilha
até ninguém mais ler. Reavaliar se a moderação sentir falta de rastrear quem
denuncia demais.

### `[22/08]` Ação automática é sempre **reversível**

Soft-hide, nunca delete automático. O moderador humano tem a palavra final.

---

## Realtime e custo

### `[22/08]` O que ficou **fora** do realtime, e por quê

`comments`, `post_likes`, `comment_likes`, `community_post_likes`: são as
tabelas mais quentes do site. Publicá-las significaria uma mensagem para **cada
pessoa com o feed aberto** a cada curtida — o custo cresce com
(curtidas × leitores), que é exatamente o padrão que estourou a cota de egress.

`notifications`: o sino revalida ao voltar o foco e ao abrir o painel —
indistinguível na prática.

`admin_logs`: tabela de auditoria de alto volume, que era transmitida a todo
admin conectado mesmo com a aba fechada. Trocada por poll só com a aba visível.

`post_media`: ninguém assinava; a UI já refaz a busca.

A lista viva está em `src/lib/realtimeTables.js`, com teste que falha se alguém
assinar tabela não publicada.

### `[21/08]` Índices "não usados" são mantidos de propósito

O advisor aponta ~15. Quase todos são de chave estrangeira e passam a ser
usados conforme o volume cresce. Removê-los agora prejudicaria escalabilidade —
não é dívida, é precaução.

### `[20/08]` `posts.likes` está morta e nada a lê

A coluna existe mas nenhum trigger a mantém. O plano original era criar esse
trigger; na hora de implementar mostrou-se pior, porque `posts` tem triggers em
`AFTER UPDATE` e cada curtida passaria a disparar essa cadeia. O feed resolve
curtidas e comentários em **2 consultas em lote**, sem tocar no caminho de
escrita.

---

## Código

### `[22/08]` Os warnings de lint que ficam de pé

**0 erros, 12 warnings**, e isso é decisão consciente. São quase todos
`set-state-in-effect` do preset de "React Compiler readiness" — o projeto **não
usa** o React Compiler, e a regra foi rebaixada a `warn` de propósito. São o
padrão legítimo de buscar dado assíncrono num efeito; a regra não enxerga
através do `await`. Matá-los exigiria suprimir com `disable`, o que é maquiar o
número, não melhorar o código.

Um merece nota: `useAuth.jsx` tem um `react-refresh/only-export-components`
porque exporta o hook ao lado do provider. A correção é mover o hook para outro
arquivo — mas **28 arquivos importam dali**, e é o ponto mais crítico do
projeto. Conforto de hot reload não paga esse churn.

### `[23/08]` `verify_jwt` desligado nas Edge Functions

O gateway rejeitaria o preflight `OPTIONS`, quebrando o CORS. A validação real
é feita **dentro** da função com `auth.getUser()`, que é estritamente mais
forte: o gateway aceitaria qualquer JWT do projeto, inclusive a própria anon key.

---

## Infraestrutura

### `[23/08]` Envio de email por conta Google dedicada

Antes usava a conta pessoal do dono. O problema não era aparência: uma senha de
app dá acesso **SMTP e IMAP** à conta inteira, e ela estava guardada nos
secrets do Supabase. Uma conta dedicada e vazia limita o raio de explosão de um
vazamento.

Domínio próprio + Resend resolveria de vez (`nao-responda@…`), mas custa ~R$40/
ano e não se justifica com 3 usuários. Registrado no backlog.

### `[23/08]` O motivo da pausa é lido **antes** de o banco cair

Se o banco caiu, o motivo não pode vir de lá. O app lê `site_config.pause_reason`
enquanto está online e guarda no navegador. Consequência aceita: pausa
planejada mostra o motivo real; queda inesperada mostra texto genérico. Não há
como fugir disso sem hospedar o aviso fora do Supabase.

---

[← voltar para o README](../README.md)
