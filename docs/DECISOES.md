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

## `[04/09]` O login e o cadastro ganharam fogo × gelo — e NENHUM personagem

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
