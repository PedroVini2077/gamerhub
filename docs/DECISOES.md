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

## Ferramental e infraestrutura — mudou de arquivo

As decisões sobre **ferramenta** — CI, Vercel e os deploys, Sentry,
Dependabot, as Edge Functions no git, contas de teste — estão em
**[DECISOES-FERRAMENTAL.md](DECISOES-FERRAMENTAL.md)** desde 28/08.

O corte é por tipo de pergunta: lá é *"por que a nossa esteira é assim"*;
aqui continua *"por que o site se comporta assim"*.

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

`sexual` e `self-harm*` continuam ocultando.

> **Atualização `[28/08]` — a decisão se confirmou, os números não.** Esta era
> uma aposta sem medição; a primeira medição real deu razão a ela e reprovou os
> limiares. Dois prints de jogo **comuns** foram para a fila
> (`violence/graphic` 0.854 contra piso 0.80; `violence` 0.943 contra 0.90).
> Ninguém foi ocultado — a parte que importa funcionou.
>
> Em resposta: `violence` foi **aposentada** (num site de jogos ela dispara no
> caso comum e o veredito é sempre "aprovar", então é ruído, não sinal) e
> `violence/graphic` subiu para **0.95**. Ver [MODERACAO.md](MODERACAO.md).
>
> **Correção junto:** este parágrafo dizia que `sexual/minors` também oculta em
> imagem. **Não oculta** — a API da OpenAI aplica essa categoria só a texto, e
> o piso de 0.10 no caminho de imagem nunca disparou. Quem cobre essa classe em
> imagem é `sexual` em 0.55.

### `[29/08]` O aviso de banimento na landing não identifica ninguém

**O pedido original do dono:** *"seria legal o site também identificar o usuário
banido, e aparecer uma nova aba ou botão na landing page **só pra ele**… pode
ser um sino"*.

**O "só pra ele" foi descartado**, e o motivo é mecânico. A landing é vista por
visitante anônimo, sem sessão. Para saber que aquela pessoa está banida sem
login, seria preciso guardar no navegador que **aquela máquina** teve um login
banido. Num PC ou celular compartilhado — que é a regra, não a exceção, no
público deste site — isso conta a terceiros algo que não é da conta deles. É o
oposto do endurecimento de LGPD que o projeto fez em agosto.

**O que entrou no lugar** resolve o problema real e não revela nada: um link
discreto na landing, **igual para todo mundo** — *"Conta bloqueada? Consulte seu
caso"* — que leva ao login.

A chave é que quem está banido **já consegue entrar**: a `BannedScreen` sobe no
próprio login e mostra o motivo, o formulário de recurso e o andamento do
pedido. O que faltava nunca foi a capacidade — era **saber que isso existe**.
Quem não está banido clica e encontra a tela de login normal.

**O que se perde:** a descoberta é passiva. Quem nunca olhar a landing continua
sem saber. A alternativa custava privacidade de terceiros, e essa troca não vale.

### `[29/08]` React Query no `Admin.jsx`: adiado, e a justificativa original caiu

**O item vivia no backlog desde 22/08** dizendo que a migração "resolveria de
verdade os `exhaustive-deps` suprimidos". Medindo antes de fazer, a premissa
não se sustentou:

| | |
| --- | --- |
| Hooks de domínio do painel | **6** |
| Já com `useCallback` antes desta sessão | **5** |
| Faltando | **1** (`useAdminData`) |

Ou seja: as três supressões não vinham de falta de React Query. Vinham de **um**
hook sem memoização e de dois efeitos que brigavam entre si — o de `[tab]` e o
de `[logCat]`, em que tornar um honesto fazia a aba de logs buscar duas vezes.

**O conserto foi pequeno e as três supressões sumiram:** memoizar as três
funções do `useAdminData` e **unir os dois efeitos num só**. Unidos, o conflito
desaparece, porque `logCat` só muda enquanto a aba de logs está aberta.

**React Query continua tendo valor real** — cache entre abas, dedupe,
invalidação —, mas isso é ganho de arquitetura, não conserto de lint. A
migração pede sessão própria: 8 consultas num `Promise.all`, duas paginações e
um canal lateral.

**O gatilho que reabre a decisão:** quando trocar de aba e voltar passar a
incomodar por rebuscar tudo, ou quando duas telas precisarem do mesmo dado
fresco. Aí o cache deixa de ser luxo. A rede de testes para a migração já
existe desde 28/08 (`e2e/painel-admin.mjs` conta linhas antes e depois do
"Carregar mais").

### `[28/08]` `sexual` em 0.55 é a única defesa dessa classe em imagem

**O fato, conferido na documentação da OpenAI:** a `omni-moderation-latest`
aplica a **imagem** só seis categorias. `sexual/minors` é *text only*, então o
piso de 0.10 que está no mapa de imagem **nunca disparou e nunca vai disparar**.
Foi a instrumentação de notas, criada no dia anterior, que revelou isso.

**A decisão:** deixar como está. Quem cobre a classe em imagem é `sexual` em
0.55, que roda e **oculta na hora** — piso deliberadamente mais folgado que o do
texto justamente para pegar o caso duvidoso. O caminho de texto continua com
`sexual/minors` ativo e funcionando.

**Por que não baixar o 0.55 "por segurança":** este caminho **oculta**, não
enfileira. Errar para baixo aqui censura de verdade — foto de praia e biquíni
pontuam nessa categoria sem serem pornografia. Sem uma denúncia ou um caso real
que mostre passagem indevida, mexer no número seria chute, e chute que censura
é o pior tipo.

**O que reabre esta decisão:** um caso concreto de conteúdo dessa classe
passando, ou a OpenAI estender `sexual/minors` a imagem — nesse dia o piso de
0.10 que já está no mapa volta a valer sozinho, sem precisar de código novo.

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

### ~~`[20/08]` Denúncia criada **não** gera log de auditoria~~ — REVERTIDA em 28/08

**A decisão original:** qualquer usuário pode denunciar; logar isso em
`admin_logs` inflaria a trilha até ninguém mais ler. Reavaliar se a moderação
sentir falta de rastrear quem denuncia demais.

**O dono reavaliou em 28/08 e pediu o log — e o receio se inverteu no caminho.**
Denúncia era a **única** ação de moderação sem rastro. Ocultar, suspender,
banir, aprovar na fila: tudo registra. A denúncia, que é o gatilho de boa parte
disso, sumia — quando um conteúdo aparecia na fila, a trilha não sabia dizer se
veio da IA, da wordlist ou de alguém denunciando.

Hoje existe o trigger `log_report_created` e a action `content_report_created`.
É **trigger, não chamada do frontend**: o site entrega a `anon key`, então
qualquer um insere em `reports` direto pela REST API, e log que depende do
cliente chamar é log que o cliente escolhe não gerar.

> Fica registrada como revertida, e não apagada, porque o raciocínio original
> continua válido como alerta: se a trilha inflar a ponto de ninguém ler, o
> problema volta — só que agora com a retenção do `cleanup_old_data()` como
> resposta, em vez de não registrar.

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

### `[28/08]` A cena 3D FICA — não vamos aposentá-la

**Decisão do dono, dita duas vezes:** *"não vamos aposentar a cena 3d não, vamos
manter, mas fazer o que der pra ficar um desempenho legal"* e, ao fechar a
sessão de 28/08, *"eu já tinha decidido de não aposentar, quero o 3D lá"*.

**Está aqui porque eu voltei a oferecer o descarte como opção depois de a
decisão já ter sido tomada.** O `BACKLOG.md` listava "reescrever em WebGL cru
**ou aposentar a cena e ficar com a `Scene2D`**" como se fossem dois caminhos
abertos. Não eram: o segundo já tinha sido recusado. Item de backlog que
reabre decisão fechada faz a mesma discussão voltar, e é justamente o que este
arquivo existe para impedir.

**O que continua valendo:** a cena é enfeite caro (887 KB descompactados), então
segue fora do caminho crítico, carregada depois do ocioso e só no desktop, com o
botão de troca para quem quiser o contrário. O que **não** está mais em
discussão é a existência dela.

**O que sobra como trabalho** (no backlog, sem pressa): trocar
`@react-three/fiber` + `three` por WebGL cru com os cinco símbolos usados. E
**medir antes** quanto do chunk é `three` e quanto é `fiber` — se a maior parte
for `three`, reescrever o `fiber` não resolve nada.

### `[29/08]` A resolução da cena 3D é ADAPTATIVA, não um número fixo

**O que foi decidido:** a cena começa no `dpr` mais barato (0,5) e sobe até 1 se
os quadros couberem em 60 fps. Se descer uma vez, não volta a subir. O
`antialias` foi desligado.

**Por que não cravar 0,5 e acabar.** Porque seria o mesmo erro de sinal ao
contrário. A medição que motivou a mudança foi feita em rasterização por
**software** (SwiftShader) — que é o que o Lighthouse, o PageSpeed e qualquer
máquina com GPU bloqueada usam. Lá, `dpr 1,5` bloqueava a thread principal
**8.066 ms de uma janela de 8.000 ms**. Mas numa máquina com GPU, cinco chamadas
de desenho por quadro não custam nada: fixar 0,5 entregaria uma cena borrada
para quem não tinha problema nenhum. Os números completos estão em
[ARQUITETURA.md](ARQUITETURA.md).

**Por que começa embaixo e sobe, e não o contrário.** Começar alto e descer
significa pagar a conta cheia durante a amostragem — e a amostragem cai bem no
meio do carregamento, que é a janela que o Lighthouse observa e que o visitante
sente. Enfeite não taxa o caminho crítico para depois pedir desculpas
(`CLAUDE.md` §0.3, regra 2). O pior caso agora é uma fração de segundo mais
macia antes de firmar.

**Por que não volta a subir depois de descer.** Máquina no limiar oscilaria
entre dois degraus para sempre, e resolução piscando incomoda mais do que
resolução baixa e estável. O primeiro rebaixamento é o veredito daquele
aparelho.

**O que se perde, sem maquiagem:** numa tela de alta densidade a cena fica
visivelmente mais macia que antes até subir de degrau, e o teto passou de 1,5
para 1 — acima disso o ganho era imperceptível numa cena sem texto nem textura
fina, e a conta era paga em pixel. O `antialias` suavizava serrilhado que, em
formas brilhantes e difusas, quase não aparece.

**Isto não reabre a decisão acima:** a cena continua existindo e continua sendo
a que o dono escolheu. O que mudou foi quanto ela cobra por quadro.

### `[29/08]` O brilho do título da landing deixou de piscar por `text-shadow`

**O que mudou:** os keyframes de `electricBuzz` animavam `opacity` **e**
`text-shadow`. Agora animam só `opacity`; o brilho virou valor estático no
`style` do span.

**Por quê:** `text-shadow` não roda no compositor. O PageSpeed do dono trazia o
aviso "Evitar animações não compostas — 1 elemento animado", e o elemento era
justamente o `HUB` do título — o **elemento de LCP da landing**, com 2.780 ms de
atraso de renderização. Um laço infinito de 5 s repintava o maior texto da
página na thread principal, para sempre.

**O que se perde:** a variação do **raio** do brilho entre um pisca e outro. O
`opacity` atenua o texto e o brilho juntos, então a palavra continua "vacilando"
como neon mal aterrado — o que some é a mudança de espalhamento, sutil o
bastante para não valer o custo.

**Registrado aqui porque é mudança de visual**, ainda que pequena, e feita sem
pedir: ela é a correção direta de um defeito que a ferramenta apontou pelo nome,
e é reversível numa linha.

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
(`lib/cena3D.js` — largura, `saveData`, memória, núcleos,
`prefers-reduced-motion`) para o **padrão**, e um **botão** que deixa o
visitante sobrepor esse padrão com aviso do custo. Heurística acerta a maioria;
o botão cobre o resto sem precisar acertar ninguém.

> **Correção `[28/08]`:** esta lista dizia `effectiveType` e estava
> desatualizada — ele foi removido no mesmo dia, algumas horas depois, e a
> frase não acompanhou. Era o **único** portão que mudava com o tempo (o
> navegador reestima a rede continuamente), então a mesma máquina trocava de
> modo entre visitas. Foi o que o dono viu no notebook dele. Todos os portões
> que sobraram são estáveis, e é isso que torna a decisão explicável para quem
> usa.

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


[← voltar para o README](../README.md)
