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

### `[24/08]` Contas de teste com cargo: o que decidir antes de criar

**Eu consigo mudar cargo sozinho.** O guard `guard_profile_privileged_cols` só
reverte `role`/`banned`/`suspended_until` quando `current_user` é
`authenticated` ou `anon`; pelo MCP eu rodo como `postgres`, então o guard não
me alcança e um `UPDATE` direto passa. Também consigo criar usuário no
`auth.users`. Ou seja, a pergunta não é "dá?", é "deve?".

**Não promover a `claudetester`.** Ela é `user` de propósito: o passo 3 do
`e2e/fluxos.mjs` usa exatamente ela para provar que `/admin` e `/owner` são
**negados**. Promovê-la apagaria a única checagem de permissão que roda num
navegador de verdade.

**O que o cargo destravaria**, e é real: o `Admin.jsx` e o `Owner.jsx` são as
duas telas maiores do projeto e **nenhum teste de navegador as abre** — é o
motivo de o item do React Query estar travado. Fila de moderação, banimento,
suspensão e logs só são exercitados por SQL em transação.

**O que ele custa, e é o que precisa de decisão sua:** a senha de uma conta
de staff passaria a viver nos Secrets do GitHub. Quem obtiver esse secret
modera, oculta e bane. Hoje o pior caso de um vazamento é uma conta comum
descartável; com staff, o raio de explosão muda de categoria.

**Recomendação:** uma conta `admin`, nunca `owner`. `admin` já abre o painel e
a fila; `owner` acumula encerrar live, mexer em cargo e configuração do site —
poder demais para uma senha que mora em CI. As ações de `owner` continuam
sendo validadas em `ROLLBACK`, que é onde já são hoje.

**Pendente:** o dono decide se cria. Registrado no backlog.

### `[27/08]` Os deploys duplicados eram um Deploy Hook por cima da integração

Fechando a investigação de 23–24/08 com **fato**, não mais hipótese. A URL do
webhook do GitHub era:

```
https://api.vercel.com/v1/integrations/deploy/prj_…/…
```

O `/deploy/prj_` confirma: era um **Deploy Hook**, montado como webhook do
GitHub **em cima** da integração nativa da Vercel (`Connected May 16`). Cada
push disparava os dois caminhos.

Isso também explica a foto do dono aparecendo em alguns deploys e não em
outros: deploy criado por Deploy Hook é atribuído a quem criou o hook; o da
integração nativa vem com o triângulo da Vercel. Era a mistura exata do painel.

**Correção da minha própria conta:** eu tinha escrito no `CLAUDE.md` §0.2 que
os deploys de produção do dia foram "~12 contra ~88 de preview". Se cada merge
valia 2 ou mais, os ~12 merges renderam bem mais que 12. A conclusão (o preview
era desperdício) continua de pé; a proporção estava errada.

O webhook do GitHub já foi apagado. Falta apagar o **Deploy Hook** do lado da
Vercel — está no backlog, e não é só limpeza: a URL é uma senha, e ela foi
colada num chat.

### `[23/08]` Abrir mão dos previews da Vercel

Batemos no teto de 100 deploys/dia do plano Free com 3 usuários no site. A
branch de trabalho deixou de deployar.

**O que se perde:** uma URL clicável por PR. **Por que sai barato:** ninguém
clicava. Quem revisa branch aqui é o CI — build, lint, 168 testes, as rotas num
Chromium de verdade, o E2E autenticado com login/publicação/exclusão, e as
portas das Edge Functions. O preview era uma segunda opinião mais fraca que a
primeira, e custava 3 a 5 deploys por PR.

**Duas ideias descartadas, porque atacam o alvo errado** — as duas vieram de
fora e vão voltar:

| Ideia | Por que não resolve |
| --- | --- |
| "Mergear menos vezes na main" | Os deploys de produção eram ~12 no dia. O teto é 100. O grosso era preview de branch |
| "Usar branch de teste e só mandar pra main o que estiver sólido" | Já é o que se faz — a `claude/*` **é** a branch de teste. O problema era ela deployar também |

**Por que duas camadas** (`deploymentEnabled` **e** `ignoreCommand`): não está
confirmado se um build *pulado* ainda conta na cota diária de deploys. A
primeira impede o deploy de nascer; a segunda economiza build quando ele
nasce. Na dúvida entre duas camadas e uma incerteza, ficam as duas.

**O script erra para o lado de construir.** Se não conseguir comparar com o
commit anterior, ele constrói. Pular por engano deixaria o site velho no ar em
silêncio, que é pior do que gastar um deploy.

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

> **`[27/08]` A regra vale para npm, não para GitHub Actions.** O `ignore` do
> `dependabot.yml` está dentro do bloco `package-ecosystem: npm`; o bloco de
> `github-actions` não tem nenhum. Foi assim que o `actions/checkout` v5→**v7**
> e o `setup-node` v5→**v7** chegaram como PR — e foram aceitos.
>
> **Não é descuido, e não vamos "corrigir".** Ecossistema diferente, risco
> diferente: major de Action mexe quase sempre no runtime de Node em que ela
> roda, não no contrato de entrada. E o detector é instantâneo — se `checkout`
> quebrar, **todos** os jobs ficam vermelhos no primeiro PR. Não existe versão
> silenciosa dessa falha, que é o oposto do major de npm, onde o site quebra
> para o usuário e o CI pode continuar verde.

### `[27/08]` A trilha de falha limita uma linha por hora — eu criei o problema

Em 23/08 fiz as Edge Functions gritarem em `admin_logs` para acabar com falha
silenciosa. Funcionou, e **criou fadiga de alarme** — que é a mesma doença pelo
outro lado.

**Os números que expuseram:** `edge_function_error` virou a **2ª ação mais
frequente de toda a trilha** (68 linhas), e as 68 são "chamada recusada".
**Zero são falha de verdade.** Vinham de dois lugares: a própria trava
`portas-fechadas.mjs`, que manda 3 requisições recusadas por execução do CI, e
a `send-email`, que é pública por construção — qualquer POST da internet
gravava uma linha, sem limite.

**O espaço em disco nunca foi o problema.** 376 kB numa base de 23 MB de 500 MB,
e com 90 dias de retenção o regime permanente é ~1,8 MB. O item do backlog, como
estava escrito ("a tabela pode inchar"), descrevia um não-problema.

**O problema era a verdade da mensagem.** Essas linhas entravam como
`critical` — e a função **funcionou**: ela recusou um estranho, que é o trabalho
dela. Uma falha real da `send-email` (Google travou a conta, cadastro parado)
chegaria num canal já cheio de ruído. Fere diretamente a regra "toda mensagem de
erro tem que ser verdadeira" (§1.5).

**A correção:** uma linha por hora, por `(função, tipo de falha)`. Preserva o
sinal — hook mal configurado produz recusa contínua e a linha aparece de hora em
hora — e mata o ruído: scanner vira uma linha por hora em vez de mil.

**Consequência aceita:** a linha diz *que* aconteceu, não *quantas vezes*.
Contar exigiria alterar a linha existente, e a trilha é append-only. Para
responder "algo está errado?", uma por hora basta.

**As 68 linhas antigas não foram apagadas.** Apagar registro de auditoria para o
número ficar bonito é o instinto errado, e elas envelhecem sozinhas pela
retenção de 90 dias.

**`[27/08]` A severidade veio logo depois, com aprovação.** E medir antes
**reduziu o escopo pela metade**: as 68 linhas eram *todas* da `send-email`. A
`moderate-links` devolve 401 sem logar — nunca foi fonte de ruído. Uma Edge
Function, não duas.

O critério de quem vira `warning` é **fato, não palpite**: o GoTrue **sempre**
assina e **sempre** manda carimbo de tempo válido. Sem cabeçalho, ou com carimbo
fora da janela, não era ele.

| Recusa | Severidade | Por quê |
| --- | --- | --- |
| sem cabeçalhos de assinatura | `warning` | não pode ser o GoTrue. É estranho |
| carimbo inválido / fora da janela | `warning` | idem |
| **assinatura inválida** | **`critical`** | **ambíguo** — atacante, *ou* o secret errado. Se for o secret, o cadastro quebrou em silêncio |
| secret não configurado / malformado | `critical` | nossa config quebrada |

A lista é um `Set` explícito no código, e **o que não está nela continua
`critical`** — desconhecido grita, nunca cai num palpite (§4).

Isso troca metade do ruído (35 de 68 eram "sem cabeçalhos") sem calar nenhum
caso ambíguo.

**Gotcha registrado:** `CREATE OR REPLACE` com parâmetro novo **não** substitui a
função — cria uma segunda com outra assinatura, e a chamada antiga vira
ambígua (`function is not unique`). Precisa de `DROP` explícito antes.

### `[27/08]` Teto por sessão no Sentry, e o que ele **não** resolve

O backlog dizia "o Sentry estoura em silêncio". Ao enunciar o problema direito,
ele se partiu em dois — e só um deles é resolvível em código:

**A. A rajada.** Um bug em laço de render manda centenas de eventos em minutos.
É o caminho realista: com 3 usuários, 166 eventos/dia não se esgotam por uso
normal. Resolvido por `lib/tetoDeEventos.js` — teto de 20 por sessão, e o
estouro vira **um** aviso que carrega o último erro. Rajada de 1.000 erros passa
a custar 21 eventos, e o teste trava isso.

**B. O esgotamento gradual.** Se a cota acabar por outro caminho, o Sentry passa
a descartar e nada no código percebe. **Isso não tem solução em código:** saber
que a cota acabou exige perguntar ao Sentry, o que exige token de API guardado
no CI — trocar uma incerteza de monitoramento por uma credencial exposta é
péssimo negócio, e é a mesma conta que já fizemos no `portas-fechadas.mjs`.

A resposta para B é o **alerta de cota do próprio Sentry**, que manda email ao
se aproximar do teto. É ação de painel, do dono, e está no backlog. Sim, §0.2
regra 3 diz que "está no painel do fornecedor não conta" — mas ali a crítica é
a painel que ninguém abre. **Email chega.**

**Alternativas descartadas:**

| Ideia | Por que não |
| --- | --- |
| Contador no `localStorage` | É por navegador. A cota é global — contar local não diz nada sobre ela |
| Canário periódico batendo na API do Sentry | Precisa de token no CI, e um agendamento novo, para 3 usuários |
| Espelhar erro em `admin_logs` | O cliente não pode escrever na trilha de auditoria (é `service_role`), e abrir isso seria vetor de spam |

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

### `[23/08]` As Edge Functions entram no git como **espelho**, sem sincronia automática

Elas viviam só no Supabase. Isso não é hipótese de risco: em 23/08, ao abrir a
`send-email` pela primeira vez em semanas, achamos que qualquer pessoa da
internet disparava email pelo site, e que a `moderate-links` aceitava
`Bearer lixo-qualquer`. **Um PR teria mostrado as duas linhas.**

Agora estão em `supabase/functions/`, capturadas do que estava implantado.
Três coisas ficam explícitas, porque um espelho silencioso é pior que nenhum:

1. **Nada aqui é implantado automaticamente.** Um deploy pelo dashboard faz o
   repositório mentir sem que uma linha mude. A regra de processo é: mudança
   começa no arquivo, o PR revisa, e só então implanta.
2. **Não existe teste comparando espelho e produção.** Compará-los exigiria um
   token de gestão do Supabase guardado no CI — trocar uma divergência de
   documentação por uma chave de administração exposta é péssimo negócio.
3. **O que existe é `e2e/portas-fechadas.mjs`**, que bate na produção a cada PR
   e exige que as portas continuem fechadas. Ele não garante que os códigos
   sejam iguais; garante que a parte que mais dói não regrediu.

A `send-email` foi dividida em `index.ts` + `email-template.ts` no mesmo
movimento (§4: 314 linhas, e a verificação de assinatura ficava enterrada
embaixo de tabela de email). **Dividida também em produção** — deixar o
repositório dividido e o Supabase inteiro seria criar a divergência no primeiro
dia. Reimplantada e reverificada: ataque sem assinatura → 401; recuperação de
senha real pelo GoTrue → `enviado com sucesso`.

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

### `[27/08]` O ritual de publicar conteúdo: trava sim, refatoração não

Fechando o item de 24/08. Ao implementar, **metade dele foi descartada** — e a
razão veio de olhar o código, não de preferência.

O backlog cogitava extrair o ritual (`useBlockedWords` → `checkContent` →
`suspendedUntil` → `moderateText`) num hook só. Olhando os quatro pontos, eles
**não são iguais**:

| Ponto | Modera | Onde avisa o suspenso |
| --- | --- | --- |
| `usePostComposer` | texto + imagem + link | `PostForm` |
| `MuralForm` | texto + imagem | o próprio form |
| `useLiveChat` | só texto | `ChatPanel` |
| `CommentSection` | só texto | o próprio componente |

Forçar os quatro num molde exigiria tanta parametrização que a abstração
custaria mais que o problema — e **os quatro funcionam hoje** (conferido, não
suposto: os quatro chamam `checkContent` e os quatro avisam o suspenso).

**O que faltava não era organização: era o contrato ser conferido.** Ficou só a
trava, que é a metade que pega o 5º tipo.

Ela confronta três lugares em lados opostos do sistema — o mapa `FONTES` da
Edge Function, os três mapas de `queueLabels.js`, e os `moderateText('tipo')`
do `src/`. **Só foi possível porque as Edge Functions entraram no git em
27/08.** Provada reproduzindo as duas formas do bug: um 5º tipo produzido sem
existir na Edge Function, e o `chat` sumindo de um mapa — que é o bug histórico
literal.

### `[24/08]` A moderação **não** vira subsistema separado

Veio de fora a sugestão de tratar a moderação como subsistema próprio, porque
ela cresceu a ponto de parecer "um sistema dentro do sistema". Analisado, e
**descartado** — com o problema real identificado no caminho.

**O que a análise mediu:** 1.295 linhas em arquivos **dedicados** (pasta
`components/moderation/`, `moderationService.js`, `lib/wordlist.js`,
`useBlockedWords`, `useLiveModeration`). A separação lógica que a sugestão pede
**já existe**: pasta própria, service próprio, hooks próprios.

**Por que não separar mais:** criar camada, módulo ou infraestrutura resolveria
um problema de organização que não temos. Arquitetura melhor não é a que tem
mais abstrações — é a que resolve o problema real com complexidade
proporcional.

**O problema real é outro, e é de contrato.** Ao abrir os arquivos que
"mencionam moderação sem serem dela", não há lógica duplicada: há um **ritual
de quatro passos repetido na mão** em cada ponto de criação de conteúdo
(`usePostComposer`, `MuralForm`, `useLiveChat`, `CommentSection`) —
`useBlockedWords` → `checkContent` → `suspendedUntil` → `moderateText`. Nada
garante que um 5º tipo de conteúdo lembre dos quatro. Precedente: foi assim que
o tipo `chat` chegou na fila sem existir em nenhum mapa.

A correção proporcional é extrair o ritual + travar por teste de contrato, não
reorganizar o subsistema. Está no `BACKLOG.md`, abaixo do Sentry, porque os 4
tipos atuais estão corretos e o risco só aparece ao criar o 5º.

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

### `[23/08]` `profiles` fica com `REPLICA IDENTITY FULL` — medido, não suposto

Estava no backlog trocar para `DEFAULT` e reduzir o payload de cada update. Foi
**medido e descartado.**

A pergunta que tornava isso interessante não era o byte: era se o WAL, sob
`REPLICA IDENTITY FULL`, entregava ao navegador as colunas de `profiles` que
foram revogadas de `authenticated` por LGPD. O próprio comentário no
`useAuth.jsx` dizia que ninguém sabia.

**Sabe-se agora.** Assinando o canal com a conta de teste e disparando updates
reais pelo SQL, o payload chegou assim:

```
id, username, avatar_url, bio, created_at, role, banned,
state, platform, favorite_games, discord, twitch, youtube,
playstyle, role_changed_at
```

Sem `birth_date`, sem `suspended_until`, sem `ban_reason`, sem `email`. **O
Realtime respeita privilégio de coluna.** E o conjunto entregue é um
*subconjunto* do que a RPC `get_public_profile` já expõe publicamente — que
ainda acrescenta `age`. Só `role_changed_at` está fora dela, e é um carimbo de
tempo.

Sem o problema de privacidade, o que sobra é economia de bytes com **3
usuários**, contra mexer no caminho de dados do arquivo mais crítico do projeto
(§7). Não compensa. Reavaliar se a base crescer a ponto de o tráfego de
realtime aparecer na conta.

**De quebra, dois fatos que valem para quem for mexer nisso:**

1. Um usuário logado, assinando `profiles` **sem filtro**, recebe as mudanças
   de perfil de *todo mundo*. Avaliado e aceito: são exatamente as colunas que
   `get_public_profile` já entrega a qualquer um.
2. Update que não muda valor nenhum (`set bio = bio`) **não gera evento**. Isso
   custou uma rodada de teste: a primeira medição deu "0 eventos" e pareceu que
   a detecção de ban estava morta. Não estava — o update é que era no-op.

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

### `[28/08]` Não vamos identificar o aparelho para decidir a cena 3D

**A pergunta do dono:** jogos leem o processador e travam gráficos que o
aparelho não aguenta. Dá para fazer isso num site?

**Tecnicamente, em parte, sim.** No Chrome em Android, `userAgentData
.getHighEntropyValues(['model'])` devolve o modelo do celular, e
`WEBGL_debug_renderer_info` devolve a GPU (`"Adreno (TM) 7xx"`). Somando
`hardwareConcurrency` e `deviceMemory`, dá para montar algo perto do que um jogo
faz.

**E mesmo assim foi descartado**, por três motivos:

1. **A tabela envelhece.** Todo aparelho lançado depois de escrevermos a lista
   cai no "desconhecido" — é o fallback silencioso que o `CLAUDE.md` §4 proíbe,
   com outra roupa.
2. **A cobertura é desigual.** No iPhone não existe `deviceMemory`, não existe
   `userAgentData` e a GPU vem mascarada. A regra ficaria boa para Android e
   cega para iOS.
3. **É impressão digital.** Núcleos + memória + string da GPU é um dos combos
   clássicos de *fingerprinting*, e o projeto acabou de passar por um
   endurecimento de LGPD. Ler para decidir localmente é legítimo; a regra de
   nunca logar nem enviar seria fácil de esquecer depois.

**O que fazemos no lugar:** portão por características observáveis
(`lib/cena3D.js` — largura, `saveData`, `effectiveType`, memória, núcleos,
`prefers-reduced-motion`) para o **padrão**, e um **botão** que deixa o
visitante sobrepor esse padrão com aviso do custo. Heurística acerta a maioria;
o botão cobre o resto sem precisar acertar ninguém.

**Também descartada: a sonda de FPS em tempo de execução.** Eu mesmo propus e
recuei. Com um botão explícito, a sonda só decidiria por quem *não* pediu — e
subir automaticamente o 3D num celular fraco é exatamente o problema que a
rodada de 28/08 consertou. Custaria ~80 linhas e um novo modo de falhar, para
substituir uma escolha humana que já existe.

**Sobre PWA:** virar PWA **não** daria nenhuma dessas APIs. PWA é
instalabilidade, cache offline e notificação push; o acesso a hardware é o mesmo
de um site comum. Para ler o SoC de verdade só app nativo. (O GamerHub também
não é um PWA hoje — não há manifest nem service worker.)

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
