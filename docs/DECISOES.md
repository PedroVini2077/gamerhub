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

> **`[05/09]` DESFECHO: a coluna foi apagada.** Esta decisão continua aqui
> porque explica **por que** o trigger nunca foi criado — e porque ela mostra o
> preço de deixar uma coluna morta de pé: entre 20/08 e 05/09, *três* lugares
> diferentes somaram essa coluna achando que ela valia alguma coisa. "Nada a lê"
> era verdade no dia em que foi escrito, e deixou de ser sem ninguém mexer nela.

A coluna existia mas nenhum trigger a mantinha. O plano original era criar esse
trigger; na hora de implementar mostrou-se pior, porque `posts` tem triggers em
`AFTER UPDATE` e cada curtida passaria a disparar essa cadeia. O feed resolve
curtidas e comentários em **2 consultas em lote**, sem tocar no caminho de
escrita.

---

## Código

### `[02/09]` Cada seção do site logado tem animação PRÓPRIA — e isto não é regra do CLAUDE.md

**Decisão do dono**, e a forma dela importa tanto quanto o conteúdo:

> *"acho que pode até virar uma regra, **não uma regra pra memória**, mas que
> toda aba (que fizer sentido) ter animações diversas, pra não ficar repetido"*

Ele foi explícito sobre onde isto mora: **aqui, e não no `CLAUDE.md`**. E está
certo — o `CLAUDE.md` é sobre como eu trabalho, não sobre como o site se veste.
Encher aquele arquivo de preferência visual dilui as regras que existem para
impedir bug e brecha, e regra diluída é regra que se ignora.

#### O que ficou combinado

Toda aba que fizer sentido tem animação de fundo própria, para não ficar
repetido. "Que fizer sentido" é a parte que exige julgamento, e ela já tem uma
exceção decidida: **os painéis de equipe (`/admin`, `/owner`) ficam sem nada**.
Quem está ali lê log e decide punição — movimento atrás desse texto atrapalha
em vez de ambientar.

#### Como foi executado, em duas camadas

| Camada | O que é | Por que |
| --- | --- | --- |
| `FluxoDeDados` | os traços, com a cor da seção | assinatura **compartilhada** com a landing — o site parece o mesmo site |
| `PecasFlutuantes` | peças de videogame em SVG | o que **separa** o site logado do resto |

E o elenco muda por aba: troféu e moeda nos ranks, chave nas keys, balão no
mural e nas lives, fliperama no feed. Um elenco só em cinco telas seria a mesma
cena com outra cor — o olho reconhece a repetição antes da variação.

#### "Emoji" aqui quer dizer SVG, e ele deixou isso claro

> *"quando falo emoji, não é literalmente emoji do teclado, é feito por svg ou
> o jeito que vc faz"*

Emoji de teclado muda de desenho em cada sistema: o mesmo caractere é uma coisa
no Android, outra no iPhone, outra no Windows. Num fundo de cena isso é ruído —
a identidade do site passaria a depender da fonte que o aparelho instalou.

#### O custo, medido antes de aceitar

Página parada, CPU a 1/4, com as **duas** camadas: **59,6 fps e zero
bloqueio**. Tudo é `transform` e `opacity` no compositor, sem laço de
JavaScript por quadro. Ver [DESEMPENHO.md](DESEMPENHO.md).

#### O que reabriria

O dono achar poluído com o uso. A saída barata já existe: as peças saem de uma
lista, e esvaziar a lista de uma seção a deixa só com o fluxo de dados.


### `[02/09]` O som ambiente atravessa as páginas públicas, e PARA ao entrar

**Pedido do dono:** *"essa música deve funcionar em toda landing page, então no
sobre deve funcionar, regras e tals, até mesmo no login, chegando no site em si
que não é mais pra reproduzir"*.

**Onde a decisão mora no código:** `BotaoDeSom` subiu para o `App.jsx`, **fora
do `<Routes>`**. Essa posição é o mecanismo inteiro — navegar entre rotas não
desmonta o que está fora do `<Routes>`, então a trilha continua tocando de uma
página para a outra. Quando a rota deixa de ter som, o componente desmonta e o
`desligarSom()` do cleanup solta o áudio: **parar é consequência de sair**, e
não uma segunda regra que alguém precisa lembrar de manter em dia.

**Por que uma lista fechada, e não "tudo que não é privado":** a regra
invertida erra sozinha. `!ehRotaPrivada(x)` faria toda rota **nova** nascer com
música — sem ninguém decidir. Aqui o desconhecido é silêncio, que é o padrão
seguro: uma página nova que devesse tocar aparece muda, alguém nota e
acrescenta. O contrário ninguém reporta como bug — a pessoa só acha o site
estranho.

**O caso ambíguo, e ele é único no site:** `/` é a landing para o visitante e o
feed para quem entrou. Mesma URL, duas telas. Por isso `deveTocarSom` recebe
também se há sessão.

**Provado num navegador de verdade, por CLIQUE e não por `goto`:** a primeira
versão do meu teste usava `page.goto()`, que é recarga completa — ela derrubaria
o áudio de qualquer jeito e teria passado mesmo com o botão dentro de cada
página. Só o clique exercita o roteamento do app. Com cliques: o som atravessa
as seis páginas e o arquivo é baixado **uma vez só**.

---

### `[02/09]` O MESMO fundo animado em todas as rotas, e não um por aba

**Decisão do dono**, depois da recomendação: *"pode fazer o mesmo fundo pra
todas as rotas então"*.

**O que ele perguntou:** se cada aba da barra lateral devia ganhar um fundo
próprio, já que gostou das animações da landing e da `/sobre`.

**Por que um só, com variação de cor por seção:**

1. **Cinco fundos são cinco fontes de verdade.** Cada um precisaria concordar
   com os outros em desempenho, acessibilidade e `prefers-reduced-motion`. Eles
   divergem — já divergiram neste projeto com ícones de log, rótulos de cargo e
   cores de cargo (§4).
2. **O custo mede em bytes, e ele multiplica.** O fundo da landing custa zero
   parado *porque* é CSS no compositor. Cinco variações sobem o CSS de todo
   mundo, inclusive de quem nunca abre aquela aba.
3. **A razão que decide, e é de produto:** a landing e a `/sobre` são camadas 1
   e 2 — primeira impressão, visita de 30 segundos. O feed é onde a pessoa passa
   uma hora. Movimento atrás do texto que encanta em 30 segundos cansa em 30
   minutos. **O site logado deve ser mais quieto que a landing de propósito**,
   e isso é decisão de desenho, não limitação técnica.

**O que fica no lugar:** um sistema de fundo só, com a cor de acento seguindo a
seção — verde no feed, roxo no mural, vermelho nas lives, ciano nas keys.
Reconhecível na hora, um arquivo, um teste.

> **`[02/09]` Implementado, e o dono teve que cobrar.** Eu registrei esta
> decisão e **não a executei** — ele perguntou *"vc não falou que já ia
> utilizar o mesmo fundo animado pra todas as abas da barra lateral?"*, e
> estava certo. Decisão escrita e não feita é pior do que decisão não tomada:
> ela cria a impressão de que o assunto está resolvido.
>
> O que entrou: o site logado usa o **mesmo `FluxoDeDados` da landing**, com
> `acento` por seção (`lib/acentoDaSecao.js`) e **`parallax={false}`**. Este
> último não é economia à toa — ponteiro e rolagem custam +451 ms e +296 ms
> medidos durante movimento contínuo, e o feed é a tela onde mais se rola. Sem
> eles a camada custa **zero** medido, que é exatamente o "mais quieto que a
> landing" desta decisão.
>
> Os painéis de equipe (`/admin`, `/owner`) ficam **sem fundo**: quem está ali
> lê log e decide punição, e movimento atrás desse texto atrapalha.

**O que reabriria:** o dono achar o site logado sem personalidade depois de
pronto. Aí o caminho é aumentar a variação de cor, não multiplicar os fundos.


### `[02/09]` NÃO unificar `denied` e `rejected` nas tabelas de status

**O que foi descartado:** padronizar o valor de "negado" nas sete tabelas de
status. Hoje `unban_requests` e `live_reactivation_requests` usam `denied`, e
`moderation_queue`, `role_change_requests` e `staff_nominations` usam
`rejected` — conferido em `pg_constraint`, não deduzido.

**Por que a ideia apareceu:** essa divergência causou bug real. A
`BannedScreen` testava `rejected` para `unban_requests`, nunca batia, e quem
teve o recurso negado via *"Em análise"* para sempre. Quem escreveu tinha visto
`rejected` três vezes no mesmo código.

**Por que não vamos fazer:** unificar é migration em cinco tabelas, com
`UPDATE` em linhas existentes, mais mudança em toda RPC e toda tela que as lê —
incluindo as RPCs `SECURITY DEFINER` de moderação, que são arquivo de alto
risco (§7). Risco real, coordenado, por **ganho zero** para quem usa o site. É
exatamente o "reorganizar sem necessidade" que o §7 proíbe.

**O que foi feito no lugar**, porque o risco não some sozinho:

1. a divergência está escrita em [BANCO.md](BANCO.md), com a tabela, para
   quem for escrever a próxima tela encontrar antes de errar;
2. o mapa de desfechos saiu do JSX para `lib/etapasDoCaso.js`, com trava que
   compara nas duas direções — status do banco sem entrada no mapa, e entrada
   no mapa que o banco nunca grava, que foi a forma exata do bug.

**O que reabriria a decisão:** um terceiro bug da mesma família. Dois já é
padrão; três seria sinal de que a documentação não está bastando.


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

**O que continua valendo:** a cena é enfeite caro (708 KB descompactados desde
29/08, quando o `<Canvas>` saiu — antes eram 887 KB), então
segue fora do caminho crítico, carregada depois do ocioso e só no desktop, com o
botão de troca para quem quiser o contrário. O que **não** está mais em
discussão é a existência dela.

**O que sobra como trabalho** (no backlog, sem pressa): trocar
`@react-three/fiber` + `three` por WebGL cru com os cinco símbolos usados. E
**medir antes** quanto do chunk é `three` e quanto é `fiber` — se a maior parte
for `three`, reescrever o `fiber` não resolve nada.

### `[29/08]` Uma denúncia já leva à fila, e nada é ocultado sozinho

**O que foi decidido**, com o piso em `site_config.mod_report_threshold = 1`:

1. **Uma** denúncia leva o conteúdo à fila de revisão.
2. **Nada** é ocultado automaticamente por denúncia.
3. O contador **ignora** denúncia dispensada.

**Por que 1, e não 3.** O piso era 3 e o site tem 5 usuários — três pessoas
diferentes denunciando o mesmo item é, na prática, impossível. O resultado era
um botão de denunciar que não fazia nada e um toast que prometia revisão.

**Por que sem auto-ocultar.** As duas coisas juntas seriam perigosas: com piso
1, auto-ocultar deixaria **qualquer pessoa derrubar qualquer post sozinha**.
Separando, uma denúncia mal-intencionada custa no máximo um item de fila que um
moderador dispensa. Quem oculta é a pessoa, pelo painel — caminho que já existia
e já funcionava.

**A alternativa considerada e recusada:** manter 3 e só corrigir a mensagem do
toast. Seria honesto, mas deixaria o recurso inútil nesta escala — trocaria uma
mentira por uma inutilidade declarada.

**Quando isto envelhece:** quando a base crescer, subir o piso é uma linha de
SQL, e o auto-ocultar pode voltar com um piso próprio, mais alto. A decisão está
casada com o tamanho do site, não com o mecanismo.

### `[29/08]` Redenunciar é permitido depois que a equipe avalia

A restrição era `UNIQUE (reporter_id, content_type, content_id)`, sem olhar o
status: uma vez denunciado, nunca mais — nem depois de a própria equipe
dispensar. Foi assim que o dono dispensou a própria denúncia e ficou impedido de
denunciar de novo, com a mensagem "você já denunciou", verdadeira e inútil.

Agora o índice único é **parcial** (`WHERE status = 'pending'`): enquanto houver
uma sua em aberto, não dá para denunciar de novo — que é o que evita spam.
Depois de avaliada, dá, porque o conteúdo pode ter sido editado ou piorado.

**O que se perde:** alguém pode denunciar, ver dispensado, e denunciar de novo
em loop. Se isso virar problema real, o caminho é limitar por tempo, não voltar
à restrição eterna — e aí já haverá dado para decidir.

### `[29/08]` O `<Canvas>` do fiber saiu — a cena é montada por `createRoot`

**O que mudou:** `LandingScene` deixou de usar o componente `<Canvas>` do
`@react-three/fiber` e passa a montar a cena com `createRoot` + `extend` de uma
lista fechada de 14 classes do `three`.

**Por quê, com número.** O `<Canvas>` traz junto o sistema de eventos de
ponteiro do fiber — raycasting a cada movimento do mouse, mapeamento de
eventos, medição de camadas. Esta cena **não tem um único manipulador de clique
ou de ponteiro**: ela é decoração. Pesando as bibliotecas isoladas, `Canvas`
custa 1.420 kB contra 1.137 kB de `createRoot`. No chunk real: 888 → 708 kB
(−20,2%), e a thread principal atribuível à cena caiu de 520 ms para 428 ms sob
freio de CPU de 4×.

**O que se assume em troca:** o `<Canvas>` media o contêiner e reconfigurava
sozinho ao redimensionar. Agora isso é um `ResizeObserver` nosso. Um observador
quebrado não gera erro — a cena continuaria desenhando, esticada ou cortada —,
então virou teste em `e2e/cena-3d.mjs`, provado nos dois sentidos.

**A justificativa anterior deste item estava errada, e vale registrar.** O
backlog e o `DESEMPENHO.md` diziam que o ganho vinha de o `<Canvas>` executar
`extend(THREE)` e arrastar o namespace inteiro. Fui à fonte que executa:
`grep "extend(THREE)"` no pacote implantado não encontra nada nesta versão. O
ganho era real, a explicação não. Ver [DESEMPENHO.md](DESEMPENHO.md).

**O que isto NÃO resolve:** o `three` continua entrando praticamente inteiro,
porque o `WebGLRenderer` tem caminho de código para quase tudo que ele traz.
Encolher além daqui exigiria WebGL cru — outra conversa, e de outro tamanho.

### `[29/08]` A cena 3D volta ao original — a otimização de resolução foi DESFEITA

**Decisão do dono, depois de três rodadas de teste no celular e no PC.** Cada
rodada eu consertei o sintoma e ele voltou com outro:

| Rodada | O que ele viu | O que era |
| --- | --- | --- |
| 1 | *"começa muito pixelada, fica horrível, depois volta ao normal"* | a resolução começava em `dpr` 0,5 e subia |
| 2 | *"a luz verde não fica tão forte quando a landing 3d está ativada"* | resolução baixa borra o degradê do `pointLight` do raio |
| 3 | *"o raio às vezes é cortado pela metade"*, cena escura | o fade de entrada de 500 ms, pego no meio |

**O erro foi de método, não de implementação, e é o que vale guardar.** Eu
estava otimizando o número do Lighthouse contra a coisa que o número existe para
medir. Para a ferramenta, a cena feia e a bonita valem igual; para quem abre o
site, não. E eu insisti **três rodadas** — a cada uma consertando o sintoma em
vez de aceitar que a direção estava errada.

**O que voltou a ser exatamente como era:** `dpr={[1, 1.5]}`, `antialias: true`,
sem resolução adaptativa, sem fade, sem remontagem.

**O que FICOU, porque é invisível e está medido:**

| Otimização | Ganho | Custo visual |
| --- | --- | --- |
| laço parado fora da tela | 0 desenhos com a cena longe | nenhum |
| `createRoot` no lugar de `<Canvas>` | −20% do chunk (888 → 708 kB) | nenhum |

**O que se perde, dito sem maquiagem:** num aparelho sem GPU — o que o
Lighthouse usa — a cena volta a ocupar a thread principal enquanto o Hero está
na tela (medido: ~1.920 ms numa janela de 2.000 ms). O portão que reprovava isso
no CI virou **informativo**: ele agora mediria a escolha do dono, não um defeito,
e portão que reprova a escolha de quem decide é portão que alguém desliga na
primeira pressa.

**O que continua reprovando** no `e2e/cena-3d.mjs` é o que é defeito sem
contrapartida visual: cena desenhando fora da tela, canvas ignorando resize, e
contexto WebGL vazando na desmontagem.

### ~~`[29/08]` A resolução da cena 3D é ADAPTATIVA, não um número fixo~~ — REVERTIDA no mesmo dia

> **Esta decisão foi revertida horas depois, pelo dono, testando.** O que ficou
> de pé dela: a cena ainda se adapta, mas na direção oposta — começa no melhor e
> só desce. Ver a decisão acima. O texto original fica porque o raciocínio
> continua útil, e o erro dele é o registro que importa.

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

## `[03/09]` O fundo do site logado é PRÓPRIO, e não o da landing

**A decisão anterior estava registrada errada — por interpretação minha.** Em
02/09 o dono disse *"pode fazer o mesmo fundo pra todas as rotas então"*, e eu
li como "o mesmo da landing também no site logado". Em 03/09 ele corrigiu:
*"eu quero que o fundo do site logado seja diferente do resto… não quero o
fluxo de dados no site logado"*.

O "mesmo para todas as rotas" era **entre as abas do site logado** — feed,
mural, lives, keys, ranks. Não entre o site e a landing.

### As camadas, e por que cada uma tem um papel

| Camada | Papel | Onde |
| --- | --- | --- |
| `FluxoDeDados` | a assinatura da landing | **só** landing e páginas públicas |
| `LuzesDaArena` | atmosfera: luz que respira, quase parada | site logado |
| `PecasFlutuantes` | o movimento: as peças de videogame | site logado |

**Duas camadas se mexendo é o que não pode.** Elas disputariam atenção uma com
a outra e com o conteúdo — e o site logado é onde se lê e se rola, não onde se
contempla. Por isso a luz é lenta e as peças são o que se move.

### O que saiu, e por que

A **linha de horizonte** foi removida. Ela era minha ideia de "chão de
fliperama", e o dono perguntou direto: *"existe uma linha ali embaixo, uma cor
pra cada aba do site logado, pq isso existe?"*. Quando o próprio dono do site
não entende o que um elemento comunica, ele não comunica nada — estava ali por
gosto meu, não por função. Enfeite que precisa de explicação não se defende.

### O que entrou: as mini explosões

Pedido dele: *"mini explosões com as cores do site enquanto os objetos sobem,
não precisa ser algo muito exagerado, como se tivesse algo explodindo ao
fundo"*.

Cinco anéis de choque, e **nas cores da MARCA (verde, roxo, ciano), não no
acento da aba** — todo o resto do fundo já é monocromático, então uma explosão
na cor da seção sumiria dentro da própria cor. É o contraste que faz o estouro
ler como estouro.

**Anel e não bolha:** um círculo cheio crescendo parece mancha; o
`radial-gradient` com miolo transparente desenha a onda de choque que a gente
reconhece de jogo — e sai muito mais barato do que partículas.

**O ritmo entrega o "não exagerado":** cada estouro ocupa 12% do ciclo e fica
invisível nos outros 88%. Com ciclos primos entre si (17, 19, 23, 27, 29 s),
aparece um a cada poucos segundos, em lugar diferente, e dois nunca caem juntos
por acidente de sincronia.

### A calibragem, ajustada pelo dono

| | Antes | Agora | Motivo |
| --- | --- | --- | --- |
| espessura do traço | 2 px | **1,6 px** | *"tá meio espesso demais"* |
| duração | 46–80 s | **30–52 s** | *"poderia aumentar um pouco a velocidade"* |

Tudo continua sendo `transform` e `opacity` no compositor — mais peças e mais
estouros não mudam a conta de desempenho.

---

## `[29/08]` Sem capa de jogo na página "Sobre" — chips no lugar

**Recusado:** buscar imagem dos jogos na internet para enfeitar o bloco "Quem
está por trás". O dono perguntou se dava para pegar da internet.

**Por que não**, e são três motivos independentes — qualquer um já bastaria:

1. **Capa de jogo tem dono.** The Last of Us e God of War são da Sony, Metal
   Gear é da Konami. Publicar num site aberto é risco jurídico real, e não
   combina com o cuidado que o resto do projeto tem.
2. **Egress.** Imagem hospedada aqui come a cota mais apertada do plano
   (§0.2). Cinco capas por visita, num bloco que ninguém precisa ver para usar
   o site.
3. **Link de terceiro apodrece.** Imagem servida de fora quebra sozinha e
   ninguém fica sabendo — falha silenciosa (§1.5).

**O que foi feito no lugar:** os títulos viraram chips com nome e gênero, no
estilo neon que a identidade já tem, com ícone do `lucide-react`. Zero byte de
imagem, zero risco, e a informação que importa — o que ele joga — continua lá.

**O caminho legítimo, se um dia quisermos imagem:** print do próprio dono
jogando. Aí o conteúdo é dele.


---

## `[03/09]` O captcha do contato falha ABERTO, e o canal passou a depender do Cloudflare

**Decidido:** quando o Cloudflare não responde, a mensagem de contato **passa**
mesmo assim, e a falha vai para o `admin_logs`.

**Por quê:** o `/contato` é o canal de quem está banido, de quem perdeu o acesso
e de quem nunca criou conta — está escrito como requisito na rota, e não existe
outro caminho para falar com a equipe (o e-mail foi removido de propósito).
Barrar todo mundo por causa de uma indisponibilidade de terceiro cortaria
justamente quem mais precisa.

**O buraco é estreito, e vale medir o tamanho dele:** token que o Cloudflare
**recusa** continua recusado; só a *queda do serviço* passa, e ninguém de fora
consegue provocar essa queda. Por baixo continuam os limites do banco — 3
mensagens por e-mail em 24 h e o disjuntor de 60/hora.

**A troca que isto NÃO evita, e é o custo real de ter captcha aqui.** Se o
*script* do Cloudflare não carregar no navegador de quem está tentando falar
com a equipe (rede que bloqueia o domínio, extensão agressiva), essa pessoa
**não consegue enviar**. A tela diz o motivo e oferece tentar de novo — não é
botão morto e mudo —, mas não existe caminho alternativo.

Aceito conscientemente porque a alternativa era pior: sem captcha, um robô com
muitos endereços enche a hora e fecha o canal **para todo mundo**, o que é o
mesmo dano em escala maior. Se um dia aparecer relato de gente sem conseguir
enviar, o caminho é oferecer uma segunda via — não desligar o captcha.

**Não mandamos o IP para o Cloudflare.** O `siteverify` aceita um `remoteip`
opcional que melhora um pouco a heurística. Ele foi deixado de fora: seria
compartilhar endereço de IP de visitante com mais um terceiro, o oposto do
endurecimento de LGPD que este projeto fez. O Cloudflare já vê o IP de quem
carrega o widget — não há por que mandar de novo, do nosso lado.

**A chave pública mora no código**, não em variável de ambiente. Mesmo motivo já
registrado para o DSN do Sentry: ela é pública por construção, e depender da
Vercel significaria que esquecer de configurá-la num deploy futuro apagaria o
captcha **sem ninguém notar** — construindo a falha silenciosa que ele existe
para evitar.

---

## `[04/09]` O login e o cadastro ganharam fogo × gelo — e, na v2, personagens de verdade

**Pedido do dono**, com uma arte de luta como referência: *"dois personagens um
de frente pro outro, divididos pelo 🆚, gelo e fogo, com uma animação leve… é só
pra tirar essa ambientação seca do login e cadastro"*.

**O que foi aproveitado da referência, e não são as figuras.** O que faz aquela
imagem funcionar é a **composição**: dois campos de cor opostos que se encontram
numa fratura carregada, com o formulário em cima dela. Tapando as duas figuras
com a mão, ela continua de pé — e é essa parte que veio.

**Por que personagem ficou de fora, e é decisão, não preguiça:**

1. **Tem dono.** Scorpion e Sub-Zero são da NetherRealm/Warner. O projeto já
   recusou capa de jogo na página "Sobre" pelo mesmo motivo, e ali o risco era
   menor — aqui seria na porta de entrada do site.
2. **Custa onde não pode custar.** Login e cadastro são a **camada 2** (§0.4):
   todo mundo que decide ficar passa por ali. A landing já paga uma cena 3D;
   arte de personagem em duas telas de formulário seria pagar duas vezes.
3. **A composição sozinha resolveu o pedido.** O objetivo declarado era tirar o
   "seco" — e isso a cor e a fratura entregam.

**O caminho se um dia quisermos figura:** silhueta **nossa**, em SVG, sem rosto.
Barata, sem dono, e entra numa camada por cima sem refazer nada do que existe.

**O que a composição faz de diferente em cada modo**, e isso não é enfeite: no
login a fenda fica no **meio** (dois lados, você decide entrar); no cadastro ela
**sai do eixo** e o fogo domina — é escolha de personagem, um lado só. A frase
abaixo do logo acompanha (`// Escolha seu personagem`), que é o *"character
selected"* da referência em palavra em vez de arte licenciada.

**O custo, medido:** 3,7 KB de componente e **1,7 KB gzip** de CSS. Nenhuma
imagem, nenhuma biblioteca, e só `transform`/`opacity` animando — as duas que
rodam no compositor. O orçamento de bytes do CI continua com folga (218,5 de 222
KB gzip).

**E quem pediu menos movimento recebe a composição parada:** com
`prefers-reduced-motion`, as partículas somem e a fenda para de respirar. A cor
e a fratura ficam — elas são a atmosfera, o movimento é o enfeite.


---

## `[04/09]` v3 da arena: os personagens passaram a ser ARTE, e eu parei de desenhar

**O que aconteceu, na ordem.** O dono olhou a v2 (só composição, sem figuras) e
achou o furo que eu não tinha visto: *"eu sei o contexto dessa tela, e o resto do
povo não… o que raios significa esse vermelho e azul com algumas partículas?"*.
Duelo sem duelistas é gradiente.

Eu propus silhuetas em SVG desenhadas por mim, avisando antes que seriam
estilizadas e não arte renderizada. Ele topou. **Tentei três vezes e não
converge** — polígonos soltos, depois proporção errada, depois uma silhueta
esguia que ainda lia mal. Ele me parou: *"tava ruim demais, os personagens
estavam parecendo mais formas geométricas do que personagem mesmo"*.

**Estava certo, e a regra do projeto já mandava parar antes.** O §1.2 diz que
depois de duas tentativas sem convergir eu paro e mudo a abordagem em vez de
insistir. Eu segui para a terceira. O aviso do teto de qualidade eu tinha dado;
o que faltou foi *agir* nele quando o teto apareceu.

**A decisão:** os personagens passam a ser **arte gerada pelo dono**, e eu faço o
que sei fazer — recorte, otimização, montagem, responsividade e medição.

### O que isso custou, e o que foi feito para caber

Os PNG originais tinham **2,5 MB cada**. Recortados no limite do canal alfa
(conferido: a transparência é real) e convertidos para WebP em dois tamanhos:

| | par de 340 px | par de 720 px |
| --- | --- | --- |
| login | 83 KB | 279 KB |
| cadastro | 62 KB | 215 KB |

> A escolha entre os dois é por **densidade de tela**, não por aparelho: um
> telefone 3x baixa o de 720. Medido, e a correção da frase antiga está em
> [DESEMPENHO.md](DESEMPENHO.md).

Só um par carrega por vez, e o `sizes` do `srcset` faz o celular baixar o
pequeno — sem ele, baixaria 720 px para exibir 150, que é a forma mais comum de
desperdiçar banda em imagem responsiva. E há **trava de peso** no `npm test`
(`pesoDaArena.test.js`), porque o orçamento de bytes do CI mede JS e CSS, não
imagem: sem ela, trocar uma arte por um PNG de 2,5 MB passaria verde.

### O recorte errado que o dono pegou, e como se acha esse erro

Na arte do cadastro, as chamas do personagem de fogo **se espalham para além do
meio da imagem**. Eu cortei os dois em x=768 (o meio) e levei as chamas dele
para dentro do recorte do gelo — na tela, aparecia fogo no lado do gelo. Ele viu
na captura e me avisou.

O conserto não foi mover o corte "a olho": foi **medir onde cada corpo começa**,
com `cropdetect` num limiar alto (só o que é opaco de verdade). O fogo termina em
x=890 e o gelo começa em x=1070 — a fronteira honesta é ~x=1000, não o meio.

### A afirmação acima estava errada sobre o login, e quem achou foi ele de novo

**Eu escrevi aqui que "a arte do login estava certa".** Não estava, e a frase era
inferência vestida de fato (§1.1): eu medi a fronteira **do corpo opaco** (x=770,
perto do meu corte em 768) e concluí que estava tudo certo — sem medir os
**golpes**, que é onde os dois se encostam. O dono viu no celular: *"o fogo tá
aparecendo um pouco na parte de gelo, não ficou um corte muito limpo"*.

A medição por coluna mostrou o que nenhum limiar de opacidade mostraria: o fogo
do golpe vai até a coluna **808** e o gelo já começa na **734** — os dois se
sobrepõem por **75 colunas**, e a coluna mais vazia da faixa ainda tem 95 pixels.
**Nenhuma reta vertical separa aquilo.** Procurar "o melhor lugar para cortar"
era a pergunta errada.

**A decisão que ficou:** na faixa disputada quem decide é a **cor** do pixel — o
lado do fogo descarta o que é nitidamente frio, o do gelo o que é nitidamente
quente, o núcleo branco do golpe vai para o dono da metade em que está, e o alfa
cai por rampa nos últimos 30 px para o halo não terminar numa reta. Depois disso
cada arte é recortada na caixa real do que sobrou.

E virou **trava**, não só conserto: `e2e/artes-da-arena.mjs` desenha as artes
servidas pelo site num canvas e conta pixels da cor do adversário na borda que
encosta na fenda. Hoje dá 0; com o recorte antigo reinjetado, **638**. A receita
e os números estão em [DESEMPENHO.md](DESEMPENHO.md).

### Sobre a origem das artes

São geradas por IA a pedido do dono, com prompt dele. Ele pediu "personagens
genéricos", e a inspiração declarada é a mesma arte de luta que ele vinha usando
como referência — o que já foi discutido aqui duas vezes. **A decisão de usá-las
é dele, com o risco de semelhança dito antes.** O que o projeto continua não
fazendo é pegar arte pronta de terceiro: a diferença é essa, e está registrada
para não virar discussão nova daqui a dois meses.

### `[04/09]` No celular, CORTAR sim; ESTICAR não

**A pergunta do dono, e ela é boa:** *"vc acha que vai ficar muito feio esticar
a imagem pra ficar inteira no celular? por mais que corte e eu tenho que usar o
scroll pra ver tudo? pq oq acontece, tô achando muito pequeno as imagens"*.

**Esticar: não.** Personagem com proporção alterada não lê como estilo, lê como
defeito — é a mesma família do corte reto no meio do corpo que ele mesmo achou
duas vezes hoje. Ninguém pensa "que enquadramento ousado"; pensa "essa imagem
está errada".

**Cortar: sim, e é o padrão da casa desde a landing.** Figura que sangra pela
borda da tela é composição normal — o cinema faz isso o tempo todo. O que não
pode é o corte parecer acidental, e é por isso que o de baixo é uma **máscara
que dissolve**, não uma reta.

**Sobre o scroll:** não seria possível do jeito que ele imaginou, e vale
registrar por quê. A arena é `position: fixed` — ela é fundo de tela, não
conteúdo. Rolar a página nunca revelaria mais dela; só afastaria o formulário.
Ficar inteira e grande ao mesmo tempo, num retrato de 390 px, é geometria
impossível: a arte é quase quadrada, e duas delas lado a lado não cabem.

**O que ficou:** os dois cresceram de 16vh para 34vh (135 px → 287 px de altura
medidos em 390×844), se encontram no meio da tela em vez de ladear o logo, saem
pelas laterais, e a metade de baixo dissolve antes do formulário. Custo em
bytes: **zero** — ver [DESEMPENHO.md](DESEMPENHO.md).

### `[04/09]` A moldura de arte substituiu as labaredas e os cristais que eu desenhava

**O pedido:** *"tira os efeitos de labareda e tbm os cristais que vc fez a mão,
coloca essa moldura nos cantos, mas deixa os efeitos de fogo e gelo presentes,
faíscas, flocos de gelo"*.

**O que saiu:** `.arena-labaredas` (três formas em gradiente radial pulsando) e
`.arena-cristais` (três triângulos em `border` com brilho em laço). Eram a
tentativa de fazer fogo e gelo **em CSS**, e sofriam do mesmo problema das
silhuetas: forma geométrica não vira elemento.

**O que ficou:** as faíscas e os flocos (`.arena-brasa` e `.arena-lasca`)
continuam, porque são partícula, não desenho de objeto — ali a forma simples é
a leitura certa, e elas são o que dá movimento à cena.

**Como a moldura entra, e por que `mix-blend-mode: screen`.** A arte tem o
centro **preto** e as bordas acesas. Em `screen`, preto é transparente e claro
soma: a moldura acende as bordas e desaparece sozinha em direção ao meio, sem
máscara e sem uma reta de fim. Colada do jeito normal, o centro preto
escureceria o gradiente da arena exatamente onde o formulário mora.

**A máscara horizontal é obrigatória, e o motivo já é conhecido.**
`background-size: cover` numa caixa alta e estreita corta a arte na horizontal,
e o esvanecimento que ela traz para o centro morre no corte — sobra uma **reta
vertical** no meio da tela. É o mesmo defeito do recorte dos lutadores, virado
90°, e a solução também é a mesma: gradiente no lugar de corte.

**Duas rodadas de calibragem, e a primeira estava errada.** Entrou com 42vw e
opacidade 0.85 e **engoliu os dois lutadores** — a lava tinha mais presença que
o personagem, o oposto do que a tela precisa contar. Ficou em 30vw / 0.55 no
desktop e 34vw / 0.38 no celular, e passou para **trás** dos lutadores no DOM.

**No cadastro ela é só de fogo, e a borda direita fica VAZIA** — e aqui eu errei
uma vez antes de acertar. A primeira versão espelhava a arte de fogo para a
direita, para "fechar" a moldura dos dois lados; o dono viu e questionou na
hora: *"o fogo tá tomando conta do gelo aqui?"*.

Ele tem razão, e a leitura literal do pedido dele já era a certa. Com o gelo de
costas e recuado, lava passando por cima dele conta que **o fogo invadiu o outro
lado** — história diferente de "o fogo venceu". Borda direita limpa deixa o gelo
na penumbra, que é o que a cena quer dizer.

> **O padrão, porque foi a segunda vez hoje:** quando ele descreve o que quer,
> a versão literal é a que ele quer. Meu instinto de "completar" a ideia —
> espelhar para fechar a moldura — trocou a intenção dele pela minha.

Travado por `e2e/artes-da-arena.mjs`, que confere o estilo computado da borda
direita nas duas telas; provado apagando a regra e vendo o passo 4 reprovar.

**Custo:** 148 KB nos dois arquivos (72 + 76), estáticos, sem animação de
tela cheia. Ver [DESEMPENHO.md](DESEMPENHO.md).

### `[04/09]` Três acabamentos da arena, e o que cada um ensinou

**1. A partícula não sabia onde ficava a fronteira.** Achado do dono: *"quando a
parte de fogo pega o lado do gelo, as partículas de gelo ficam caindo no fogo…
não é algo que incomoda, só é falta de capricho"*.

A causa não era a posição de nenhuma partícula: `--x` era porcentagem **da
tela**, e a fronteira entre os dois lados é o `--eixo`, que no cadastro vai para
68%. Corrigido pela **classe**, não pelo caso: `--x` virou fração do próprio
lado (0,06 a 0,84) e o CSS multiplica pela largura dele. Passa a valer em
qualquer eixo — inclusive num terceiro modo que ainda não existe.

**2. A transição de aba, e o `layout` do Framer que NÃO funcionou.** Pedido:
*"podia fazer uma transição melhor da aba de login e cadastro, pq quando fazemos
essa troca, simplesmente corta de um pro outro"*.

O conteúdo entrou em `AnimatePresence mode="wait"` com a variante `fadeTab` que
o resto do site já usa. Faltava a altura: o cadastro é **2,5× mais alto** que o
login (354 → 877 px, medido em 1280 px de largura), e o card saltava de tamanho
com o conteúdo ainda transparente.

A saída de uma linha seria `<motion.div layout>`. **Ela não funcionou, e isso é
medição:** com ela no card, a altura pulava de 354 para 877 px entre dois
quadros e o `transform` computado ficava em `none` o tempo todo — nenhuma
animação de projeção chegou a rodar. Em vez de insistir (§1.2), a altura passou
a ser medida por `ResizeObserver` e animada em `CardQueAcompanhaAltura`.

> **A animação é condicional à `chave` de propósito.** O `ResizeObserver`
> dispara a cada mudança de altura, inclusive as de digitação (medidor de força
> da senha, mensagem de erro). Animar 280 ms a cada tecla deixaria o formulário
> com cara de travado.

**3. "Recuar" tinha virado "sumir".** *"a área de cadastro no celular, o
personagem de gelo mal aparece"*. A causa era acumulada e nenhuma das partes
estava errada sozinha: a base do celular joga o gelo para `right: -16vw`, e a
regra do cadastro somava mais 6vw de translação **para a direita**. Somados,
22vw dele ficavam fora da tela. Ele voltou para dentro e ganhou opacidade —
continua atrás e mais apagado, que é o ponto, mas agora dá para ver que está lá.

### `[04/09]` O `index.css` virou lista de imports — e a ORDEM é o comportamento

O arquivo tinha 948 linhas com a arena dentro, e 550 depois que ela saiu. As 550
restantes eram anteriores e encostam em toda tela do site, então a divisão
esperou o dono liberar (*"vai com calma arrumando o css e fazendo o split"*).

**O que decidiu o desenho:** CSS resolve empate de especificidade por **ordem**.
`.card` só vence uma utilitária do Tailwind de mesma propriedade porque está
depois de `@tailwind utilities`. E `@import` tem que vir antes de qualquer
regra. As duas coisas juntas obrigam a solução: as diretivas `@tailwind` saíram
para um arquivo próprio, e o `index.css` virou **só a lista de imports**, na
mesma sequência em que os blocos estavam.

**Como foi provado que nada mudou:** o CSS emitido pelo build tem as **mesmas
862 regras**, antes e depois. A única diferença de ordem é o bloco da arena, que
voltou para o fim — que é onde ele estava antes de eu extraí-lo no PR #155.
Prova de saída, não opinião sobre o processo.

**E a prova pegou um bug de verdade.** O `arena.css` também passou de 300 linhas
(455) e virou quatro partes dentro de `estilos/arena/`. Ao descer uma pasta, os
dois `url('../assets/auth/moldura-*.webp')` deixaram de resolver: o Vite emitiu
o **caminho cru**, e a moldura daria **404 em produção** — com build verde, lint
verde e testes verdes. Nenhum portão via, porque nenhum deles compara a saída.

Só apareceu porque o CSS emitido foi comparado byte a byte com o de antes. É a
lição do §1.5 aplicada a refactor: *"extraí sem mudar comportamento"* é
afirmação, e afirmação precisa de evidência. A evidência aqui é o arquivo de
saída, e ela custa um `cmp`.

### `[04/09]` A troca de aba: metade da cena mudava em 900 ms e a outra de estalo

Dois achados do dono na mesma mensagem, e **a mesma raiz nos dois**.

**1. *"os personagens simplesmente aparecem, sem nenhum fade in ou fade out"*.**
Era o mesmo `<img>` recebendo um `src` novo — o navegador pinta a imagem nova no
quadro em que ela chega, e troca de arquivo não tem transição. Virou fade
cruzado: as duas artes coexistem por 550 ms, com `AnimatePresence` **sem**
`mode="wait"` (com `wait` a que sai termina antes de a que entra começar, e aí
não é cruzamento, é piscada).

**2. *"quando volto do cadastro pro login, as partículas azuis estão caindo na
área do fogo"*.** A posição delas vinha do `--eixo` **sem transição**, enquanto
a fenda e os lados levam 900 ms para andar. Voltando de 68% para 50%, o lado do
gelo alargava no mesmo quadro e a fenda ainda estava lá atrás.

> **Só na volta**, e essa assimetria é a assinatura do defeito: na ida o lado do
> gelo encolhe, então as partículas se afastam da fenda em vez de cruzá-la. Um
> bug que só acontece num sentido quase sempre é "duas coisas que deviam andar
> juntas andando em velocidades diferentes".

O conserto foi **contêiner por lado**, com a mesma `transition` de
`.arena-lado`. Dois elementos transicionam e as 24 partículas seguem de graça,
porque a posição delas passou a ser porcentagem do contêiner. Fazer cada
partícula transicionar seria animar `left`/`right` em 24 nós, que não roda no
compositor (§0.3).

#### A pré-carga que eu escrevi e a medição derrubou

Para o cruzamento da PRIMEIRA troca não desvanecer para uma imagem ainda
chegando, minha primeira solução foi **pré-carregar o outro par** em
`requestIdleCallback`. Medi antes de entregar, e ela caiu por dois motivos:

| | |
| --- | --- |
| custo | **+215 KB** — a tela de entrada ia de 423 para **638 KB** de imagem |
| "ocioso" | os 6 arquivos chegaram **dentro de 2 s**, junto com a tela. O `requestIdleCallback` disparou cedo porque a página fica ociosa rápido — "ocioso" não quer dizer "depois" |

**O que ficou custa zero:** a arte que entra só **começa** a aparecer quando o
`load` dela dispara. Em rede boa ela chega dentro da janela do fade e ninguém
percebe diferença; em rede ruim, a entrada começa mais tarde — nunca é um
estalo. Camada 2 é por onde todo mundo passa, e metade dessa gente nunca abre a
outra aba: 215 KB de enfeite por isso não se paga.

#### A caixa do lutador colapsou, e o e2e pegou na hora

Com as duas artes fora de fluxo (para se sobreporem), o `.arena-lutador` ficou
sem conteúdo que o dimensionasse e **colapsou para 0 px de largura**. Corrigido
com `aspect-ratio: 1` na caixa e `object-fit: contain` + `object-position` por
lado — a largura passa a acompanhar a altura sozinha, em toda tela e em todo
modo, e a arte encosta na borda certa. Conferido nas quatro combinações.

### `[04/09]` A tela de entrada voltou para a PALETA DO SITE — e eu devia ter avisado

**O corte do dono, e ele está certo:** *"eu não sei o que tava passando na minha
cabeça de fazer personagem de gelo e fogo, não tem nada a ver com o site"*. E a
cobrança que veio junto: *"você tinha que ter me avisado isso, né?"*.

**Tinha.** A paleta está em `estilos/base.css` desde o começo — `--neon: #39ff14`,
`--purple: #bf00ff`, `--cyan: #00ffff` — e manda em toda a interface. Laranja de
lava e azul de gelo são outra linguagem visual. Eu construí **três rodadas**
inteiras em cima da referência dele sem levantar isso uma vez.

> **O §7 é explícito:** *"se eu discordar de uma ideia do dono, eu digo antes de
> executar. Concordar por educação com uma abordagem pior é o pior serviço que
> eu posso prestar"*. A regra existia, estava certa, e eu não a apliquei — não
> por discordar em silêncio, mas por **não ter percebido que havia do que
> discordar**. Identidade visual não estava na minha lista de coisas a conferir
> antes de começar; passa a estar.

**O que mudou, item a item:**

| | antes | agora |
| --- | --- | --- |
| lutadores | fogo × gelo | verde neon × roxo, com o raio da marca no peito |
| moldura | lava e cristal | circuito neon, verde de um lado e roxo do outro |
| gradiente dos lados | laranja / ciano-gelo | `#39ff14` / `#bf00ff` |
| fenda | sombra quente + fria | sombra verde + roxa |
| VS | laranja / ciano | verde / roxo |
| partículas | brasa e lasca de gelo | faísca verde e estilhaço roxo |
| nomes no código | `fogo`/`gelo`/`brasa`/`lasca` | `verde`/`roxo`/`faisca`/`estilhaco` |

**Os nomes foram renomeados junto, e isso não é capricho.** `.arena-lutador-fogo`
apontando para uma arte verde é a definição de nome que mente — o §4 chama isso
de fonte de bug, e a próxima pessoa a abrir o arquivo procuraria fogo.

#### O VS passou a animar na SAÍDA também

Pedido do dono: *"preciso que você anime tanto a entrada como a saída dele
também, ele só está animado para a entrada"*. Ele encolhe e apaga ao ir para o
cadastro, e volta com o mesmo estalo elástico.

**Duas curvas diferentes, e o número decidiu.** Com a curva elástica nas duas
propriedades, a opacidade caía para **0,02 em 140 ms** — animação no papel,
estalo na tela. A elástica ficou no `transform`, onde o exagero é o efeito; a
opacidade ganhou uma curva calma de 420 ms, onde o que importa é dar tempo de
ver. Medido depois: 0,90 → 0,29 → 0,08 → 0.

O `animation: none` que existia na regra do VS **saiu** — era ele que reiniciava
a entrada ao voltar para o login, o mesmo defeito que os lutadores tinham.


## `[04/09]` A tela de boas-vindas: a fenda contava a história errada

A primeira versão eram duas metades com uma **fenda visível no meio desde o
primeiro quadro**. O dono reprovou: *"não queria que ela tivesse essa fenda, eu
queria que fosse estilo portão futurista, que tem uma tranca no meio que rodasse
'destrancando' a porta e carregando o site"*.

**A diferença não é decorativa, e vale escrever por quê.** Fenda no primeiro
quadro conta *"isto vai abrir"* — a porta já está entregue, só falta o
movimento. Porta inteira com tranca girando conta *"isto está sendo aberto para
você"*, que é exatamente o que a tela existe para dizer enquanto o site carrega.
A primeira mostra o resultado; a segunda mostra o trabalho.

**Daí os três estados, e o do meio é o que dá CAUSA à abertura:**

| estado | o que está na tela | duração |
| --- | --- | --- |
| trancado | superfície única, tranca de três anéis girando | do piso (700 ms) ao teto (2500 ms) |
| destrancado | a tranca para, trava e acende; a linha vira "acesso liberado" | 420 ms |
| abrindo | as folhas se separam | 560 ms |

Sem o estado do meio a porta abriria sozinha, e a tranca no meio não teria feito
nada — seria enfeite em cima de enfeite.

**As duas folhas continuam existindo** (é o único jeito de a porta abrir), mas
com o **mesmo fundo e sem borda**: a divisão só passa a existir no instante em
que elas se separam.

### O que ficou igual, e é o que importa

O teto de 2,5 s. A tranca gira enquanto o perfil carrega, mas se ele não chegar
ela trava e a porta abre do mesmo jeito. Animação bonita não vira porta trancada
(§0.3).

---

## `[05/09]` O portão é A TELA — e as quatro versões recusadas até chegar nele

Esta entrada existe porque a mesma tela foi refeita **cinco vezes**, e sem o
registro a próxima pessoa (ou eu, daqui a dois meses) refaz a nº 2 achando que
está melhorando.

| # | o que eu entreguei | a recusa do dono, na letra |
| --- | --- | --- |
| 1 | duas metades com uma fenda desde o 1º quadro | *"não queria que ela tivesse essa fenda"* |
| 2 | anéis e argolas de CSS girando | *"quando eu falei portão, eu tô falando literalmente de uma porta"* |
| 3 | a ilustração dele recortada em 4 peças | *"eu mandei pra vc usar como exemplo e criar a mão"* |
| 4 | SVG desenhado à mão, centralizado, 62vh | *"a porta é pra ser a tela inteira... A TELA INTEIRA! não uma imagem abrindo, é pra ter imersão"* |
| 5 | duas folhas de 50vw × 100vh | — |

**O erro que se repetiu da 1 à 4 foi sempre o mesmo, e não era de desenho.** Eu
tratei "portão" como um *objeto a ser ilustrado* e fui melhorando a ilustração.
A nº 4 era desenho melhor que a nº 3 e foi recusada igual, porque o defeito
nunca esteve no traço: estava no **enquadramento**. Enquanto sobra tela em volta
da porta, o olho lê "figura de porta". Quando a porta encosta nas quatro bordas,
não existe fora — e aí não se olha a porta, se está atrás dela.

### A decisão técnica: superfície em CSS, mecanismo em SVG

Um SVG único de tela cheia precisa de `preserveAspectRatio`, e **nenhum dos três
modos serve** — medido, não suposto:

| modo | no celular (390×844), viewBox 1200×800 |
| --- | --- |
| `meet` | a porta cabe inteira e sobra fundo em volta: é o defeito da nº 4 de novo |
| `slice` | restam ~370 unidades de largura visíveis — some tudo menos a tranca |
| `none` | a tranca deixa de ser redonda e vira elipse |

Daí a divisão por **natureza da peça**, que é a parte reaproveitável desta
decisão: o que **não tem forma própria** (chapa, nervura, listra, brilho) é CSS,
porque estica para qualquer proporção sem deformar nada; o que **tem forma** (a
tranca, que precisa continuar redonda) é SVG de lado fixo.

O disco é desenhado **inteiro nas duas folhas**, centrado na emenda, e o
`overflow: hidden` de cada folha faz o corte. Não há `clipPath`, não há "metade
esquerda" e "metade direita" para divergirem, a metade viaja com a folha na
abertura sem cálculo nenhum, e nada aparece fora da moldura quando as folhas
saem — que era um defeito real da nº 4.

### Duas coisas que o print desmentiu, e valem ficar escritas

**A emenda não pode CLAREAR.** A primeira tentativa da nº 5 tinha um bisel que
subia até `#263443`, mais claro que a chapa, dos dois lados — e o resultado era
uma coluna de luz descendo o meio da tela. Ou seja: uma fenda, que é literalmente
o que foi recusado na nº 1. Porta fechada não tem luz no meio; tem sombra.

**A abertura revela o SITE, não um vão desenhado.** A versão com um poço escuro
por baixo das folhas foi descartada: quem cobre a tela são as folhas, então tirar
o fundo faz a porta abrir sobre a página já montada. Um fundo ali esconderia
justamente aquilo que a porta existe para revelar.

### O bug que veio junto, e era o mais grave

Relato do dono: *"assim que eu logava, eu via o site por alguns segundos, depois
aparecia o portão"*. Não era lentidão — era **ordem**. `marcarEntradaAgora()`
ficava depois do `signInWithPassword`, mas o `onAuthStateChange` preenche o
`user` **dentro** dessa chamada: o site trocava de rota e pintava enquanto ainda
faltavam duas idas ao servidor até a marca existir. E o próprio portão ainda
adiava mais um `setTimeout(0)`, com um comentário meu dizendo que era de
propósito — o defeito escrito como decisão.

O conserto são duas metades: a marca passou a ser escrita **antes** do login (com
`cancelarEntradaAgora()` em todo caminho que não termina em entrada), e a leitura
virou `useLayoutEffect`, que roda **antes da pintura**. As duas são invisíveis em
runtime — desfazer qualquer uma não gera erro, não gera log e não quebra teste de
comportamento —, então viraram trava de contrato em
`src/lib/__tests__/portaoAntesDoSite.test.js`, provada reinjetando cada metade.

---

## `[05/09]` O cofre do Fundador é CENOGRÁFICO, e isso está escrito na tela

Duas versões possíveis foram postas na mesa do dono, e ele escolheu a primeira:

| | Cenográfico (feito) | De verdade (não feito) |
| --- | --- | --- |
| onde o código é conferido | no navegador | numa RPC, contra hash no banco |
| protege de | quem senta na frente do computador dele | quem tem a sessão roubada |
| custo | pequeno | grande, mexe no arquivo mais sensível do projeto |
| risco novo | nenhum | **ficar trancado para fora** |

**Por que aceitar uma tranca que não tranca.** Porque a ameaça que ela cobre é
real e não tinha resposta nenhuma — o computador do dono, aberto, com a sessão
viva. Para essa, pedir um código antes de mostrar o painel é a medida certa.
O que estaria errado seria ela se apresentar como mais do que é, e por isso o
aviso está impresso **embaixo do campo**, não só na documentação.

**Três escolhas menores, e cada uma tem motivo:**

**O código é por aparelho, não no banco.** Guardar no banco não deixaria o cofre
mais forte — a `anon key` é pública e a checagem continuaria no navegador — e
criaria uma senha a mais para perder. Local, cada aparelho tem o seu e perder um
não tranca nenhum outro.

**Fica guardado o resumo, nunca o código.** SHA-256 com sal aleatório por
aparelho. Não é para resistir a força bruta séria — é para o código não ficar em
texto puro num lugar que a própria pessoa pode abrir sem querer numa gravação de
tela. Travado por teste, porque nada na tela denunciaria a troca.

**O desbloqueio dura a ABA, não um tempo fixo.** Trinta minutos ou uma hora
trancaria no meio de uma moderação. Fechou a aba, fecha o cofre.

**O que ficou de fora e é decisão dele:** as três chaves de armazenamento do
cofre entraram na lista técnica da política de privacidade, mas **não** na
tabela que o leitor vê. Elas só nascem no navegador de quem é fundador, e
listá-las descreveria para milhares de pessoas um armazenamento que existe para
uma. Se ele preferir citá-las, o custo é subir a `versao` do documento — o que
faz todo mundo aceitar de novo.

---

## `[05/09]` As conquistas são DERIVADAS — não têm tabela, e isso é escolha

Conquista normalmente é uma tabela: `achievements` mais `user_achievements`, com
trigger gravando a cada post, curtida e comentário. Aqui não é.

**A pergunta que decidiu foi a de sempre (§0.2): quantas vezes por dia isso
roda?** A resposta da versão com tabela é "uma escrita por interação de todo
mundo" — e isso multiplica por usuários × posts × curtidas, que é exatamente a
conta que estoura cota.

As oito conquistas são calculadas em cima do que a `get_user_xp` **já devolve**,
numa chamada que o perfil **já faz**. Custo: zero consulta nova, zero escrita,
zero tabela, zero trigger.

### O que se perde, dito antes de alguém descobrir

| | derivada (é assim) | com tabela |
| --- | --- | --- |
| custo | zero | uma escrita por interação |
| "quando" foi conquistada | **não existe** | data guardada |
| notificar na hora | **não dá** | dá |
| conquista de evento sem rastro (ex.: "entrou no 1º dia") | **impossível** | possível |

O dia em que notificar ou datar virar necessidade, a tabela passa a valer o
preço. Hoje não vale — e trocar depois é aditivo: as oito continuam existindo.

### Duas escolhas menores

**"Perfil completo" olha os seis campos, não o número 140** (a soma dos bônus no
SQL). Se um bônus mudar de valor, a conquista continua verdadeira. Depender do
total faria ela virar inalcançável em silêncio.

**Conquista bloqueada mostra o nome.** Esconder o que falta transforma a lista
num enigma; mostrar transforma em objetivo. O cadeado e a cor dizem o estado.

---

## `[05/09]` O XP contava curtidas de uma coluna morta — e era o TERCEIRO lugar

`get_user_xp` fazia `SUM(posts.likes) * 5`. Nada no banco nunca escreveu nessa
coluna: o único trigger em `post_likes` é o `notify_post_like`, que só insere
notificação. **A soma dava 0 para todo mundo, para sempre**, e a tela de ranks
anunciava *"Receber um like → 5 XP"* que o sistema nunca pagou.

Comprovado em transação com `ROLLBACK`: 3 linhas em `post_likes`, `posts.likes`
= 0, `get_user_xp` = 0, `count(*)` = 3.

**O que mais importa aqui não é o bug — é por que ele sobreviveu.** Este era o
terceiro lugar com o mesmo defeito. `fetchProfileStats` (frontend) e
`owner_get_metrics` (banco) já tinham sido corrigidos antes, **cada um por conta
própria, em passadas diferentes**. Ninguém perguntou *"onde MAIS este padrão
existe?"* — que é literalmente a regra da varredura de classe (§1.3) — e a
função que sobrou ficou errada sozinha.

**A correção conta da tabela em vez de criar trigger para manter a coluna.**
Contador denormalizado exige acertar INSERT e DELETE e desincroniza no primeiro
caminho que alguém esquecer; esta coluna morta é a prova viva disso.

**Anti-farm:** a auto-curtida não conta (`pl.user_id <> p.user_id`). "Receber um
like" é de outra pessoa — sem isso, curtir o próprio post seria 5 XP por clique.

**Efeito visível:** o XP de quem já recebeu curtidas **sobe**. É a correção de um
valor que estava errado para baixo, não uma mudança de regra.

### O desfecho, no mesmo dia

Eu tinha deixado isto como pendente — *"apagá-la seria a trava mais forte
possível, mas `DROP COLUMN` é irreversível e entra no 🔴 do §7"*. **O dono
autorizou, e a coluna foi apagada.**

Antes de apagar, a busca foi por CLASSE e não só pela que eu conhecia: 24
colunas que nenhuma função, policy, índice ou view do banco menciona; cruzadas
com o código, **22 eram lidas pelo site**. Das 3 restantes, duas foram apagadas
(`posts.likes`, 0 linhas com dado; `live_muted.muted_until`, 0 linhas) e
**`admin_notification_reads.read_at` ficou**: 249 linhas COM dado. Coluna sem
leitor mas com dado não é a mesma coisa que coluna sem leitor e sem dado.

O teste `xpNaoLeColunaMorta.test.js` continua de pé — agora como segunda rede,
não como única.
