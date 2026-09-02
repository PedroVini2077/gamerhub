# GamerHub — Instruções de trabalho

> Como o dono quer que eu (Claude) trabalhe neste projeto. Não é documentação
> de features — para isso, ver o `README.md`. Para o que está pendente, o
> `BACKLOG.md`. Para **como nós dois trabalhamos juntos** (o papel de cada um,
> quando explicar mais ou menos, o que o dono quer aprender), ver
> [`docs/MANIFESTO.md`](docs/MANIFESTO.md).

---

# 🏗️ Qualidade acima da velocidade

## Construir bem antes de construir rápido

Não precisamos entregar mais rápido. Precisamos construir melhor.

Cada funcionalidade deve ser pensada, validada e construída com qualidade. A
velocidade de desenvolvimento nunca deve estar acima da segurança, arquitetura,
manutenção e confiabilidade do GamerHub.

**Prioridade: qualidade > velocidade.**

> **O que isto NÃO quer dizer.** Não é licença para ir devagar, nem para
> transformar tarefa pequena em projeto de refatoração, nem para encher cada
> resposta de aula. Velocidade continua sendo um valor — o lema decide o
> **empate**, não a corrida: quando construir rápido e construir direito
> apontarem para lados diferentes, ganha construir direito. Quando não houver
> conflito, os dois valem juntos.

---

## 0. A prioridade do projeto

**Segurança, bugs e otimização vêm antes de qualquer outra coisa.** Não é uma
área do projeto entre outras — é *a* parte mais importante. Site bonito com
sujeira embaixo do tapete não interessa: o objetivo é uma base sólida, que
aguente crescer e não vire ruína.

Ordem de prioridade quando houver conflito:

1. **Falha de segurança** — fecha na hora (§1.3).
2. **Bug** — diagnostica e mata na 1ª ou 2ª tentativa (§1.2).
3. **Dívida estrutural** — arquivo gigante, código duplicado, lógica confusa
   (§4). Isso não é "estética": arquivo que ninguém consegue ler é onde a
   próxima falha vai se esconder. **Dividir arquivo grande é obrigação minha,
   não pedido do dono** — ver §4.
4. **Performance / custo** — egress, N+1, bundle.
5. **Feature nova** — por último, e só se o resto estiver de pé.

### Esbarrei em algo enquanto fazia outra coisa: paro ou anoto?

Depende do item, e a distinção importa — regra que manda parar sempre vira
regra que ninguém segue:

| Esbarrei em… | O que faço |
| --- | --- |
| **Falha de segurança** (1) | **Paro e trato**, sempre, mesmo longe do que eu estava fazendo. Brecha que fica aberta enquanto termino outra coisa é brecha aberta. |
| **Bug** (2) | **Paro e trato** se for do caminho que estou mexendo, ou se for grave. Bug pequeno e distante vai pro `BACKLOG.md`. |
| **Dívida estrutural** (3) | **Trato junto só se estiver no caminho** do que estou mexendo — arquivo que eu já toquei, duplicação que eu já criei. Dívida distante vai pro backlog **com o motivo**. |
| **Performance / feature** (4, 5) | Backlog. |

Em todos os casos: **eu digo o que encontrei**, tenha eu tratado ou anotado.
Achado que some em silêncio é a única saída proibida.

> A regra do §4 (arquivo que **eu toquei** passou de 300 linhas → divido antes
> de entregar) continua valendo integralmente. Ela não é "dívida distante": é
> sujeira que eu mesmo acabei de fazer.

### Limitação não é desculpa para entregar pior

> Pedido do dono em 28/08: *"a gente vai fazendo o que dá, mas sempre o melhor
> que puder... se estamos limitados, que a gente faça o melhor mesmo estando
> limitados"*.

Este projeto vive sob limite o tempo todo — plano gratuito, cota de token,
recurso que só existe no plano pago. O risco disso não é entregar menos; é
entregar **mal** e culpar o limite.

**A regra: o limite decide o TAMANHO da entrega, nunca a QUALIDADE dela.**

| Limite encontrado | Resposta certa | Resposta errada |
| --- | --- | --- |
| Não dá para fazer tudo | fazer uma parte **inteira**, com trava e documentação | fazer tudo pela metade |
| Falta recurso pago | achar o caminho que existe, e escrever o que ele **não** cobre | fingir que cobre |
| Falta contexto para terminar | parar num ponto íntegro e registrar onde parei | empurrar código não verificado |

**Duas aplicações reais, do mesmo dia.** O contador de login não podia ser
corrigido no plano Free — em vez de deixar como estava, foi fechada a brecha
que dava para fechar, e escrito exatamente o que continua faltando. A moderação
de vídeo não tinha API barata — em vez de adiar, alguns quadros passaram pela
moderação de imagem que já existe, com a limitação da amostragem escrita na
documentação.

**O que nunca é aceitável por causa de limite:** entregar sem a trava (§2),
sem a documentação (§6.2), ou dizendo que faz mais do que faz (§1.1). Se não dá
para fazer direito, o certo é fazer **menos** — não fazer pior.

### O que eu faço sem ser mandado

> Pedido do dono em 28/08: *"combinamos de muitas coisas serem automáticas sem
> eu pedir... quero que vc sempre faça automaticamente tudo sem precisar de mim
> pra dizer 'faça'... às vezes nós fazemos muitas coisas, e eu vou esquecer que
> isso existe"*.

**O padrão é: se está escrito neste arquivo, eu executo por conta.** Pedir
autorização para cumprir uma regra que já foi combinada é atrito sem ganho — e,
pior, transfere para o dono a obrigação de lembrar que a regra existe. Ele não
tem como lembrar de tudo; o arquivo é que tem.

| Roda sozinho, sempre | Onde está a regra |
| --- | --- |
| Dividir arquivo que passou de 300 linhas | §4 |
| Fechar falha de segurança explorável | §1.3 |
| Diagnosticar e matar bug | §1.2 |
| Bateria de faxina ao fechar um bloco | §6.1 |
| **Medir desempenho ao mexer em bundle, rota, asset ou dependência** | §0.3 |
| Atualizar `README.md` e `BACKLOG.md` no mesmo PR | §6.2 |
| Abrir o PR e mergear ao concluir | §8 |

**O que continua dependendo do dono** é curto e proposital: decisão de produto,
decisão de custo, ação de painel que eu não alcanço, mudança em documento
estrutural (§6.2), e o que o §7 marca como 🟡/🔴. **A auditoria completa (§6)
continua sendo pedida por ele** — ela consome uma sessão inteira, então quem
decide a hora é quem paga o token.

> **Só que "ele pede" não pode virar "ninguém lembra".** Por isso existe o
> lembrete de auditoria (§6, no fim): um robô mensal que abre issue no
> repositório dizendo que passou do prazo. O dono continua decidindo se e
> quando roda — mas deixa de precisar lembrar sozinho de que aquilo existe.

### Organização é PRÉ-REQUISITO das outras regras, não estética

> Observação do dono depois de uma sessão inteira: *"percebeu que quando fomos
> organizando as coisas, colocando as coisas certas no CLAUDE.md, e a
> organização dos arquivos, como tudo fluiu?"*. Ele está certo, e a razão é
> mecânica — não é questão de gosto.

**As outras regras deste arquivo só são executáveis em cima de algo organizado.**
Três provas desta mesma semana:

| A regra | Por que a bagunça a inutiliza |
| --- | --- |
| §1.3 — *"varredura de CLASSE, não de caso"* | Só dá para perguntar "onde mais esse padrão existe?" num código que **dá para varrer**. A moderação de comentário ficou quebrada por meses dentro de um `Admin.jsx` de 918 linhas que ninguém revisava inteiro |
| §1.4 — *"o sistema não mente, o documento envelhece"* | O backlog listava **cinco itens já feitos**. Não foi descuido: 90% do arquivo não era backlog, e a desorganização **escondeu o dado** |
| §2 — *"definição de pronto"* | Um README de 1.087 linhas onde só 140 respondiam "o que é isso" não é documentação; é um lugar onde a informação desatualizada se esconde |

**A consequência prática, e é a parte que muda o comportamento:** arrumar não é
uma tarefa que se agenda para depois — é parte de terminar. Um bloco de trabalho
só está fechado quando o que ele tocou ficou **mais fácil de ler do que estava**.
Se ficou mais difícil, ele não acabou, mesmo que a funcionalidade esteja de pé.

Isso já está operacionalizado em quatro lugares — §4 (arquivo > 300 linhas
divide), §6.1 (faxina automática), §6.2 (cada documento com um trabalho), e o
portão de documentação no CI. Esta seção existe para dizer **por que** eles
existem, para que nenhum deles pareça capricho e seja o primeiro a ser cortado
quando der pressa.

---

## 0.1 Economia de contexto (tokens)

O projeto é grande e as sessões são longas. Token gasto à toa é sessão que
acaba no meio do trabalho — então economizar faz parte de fazer bem feito.

**Não repetir o que já foi feito:**
- Não reler arquivo que já li nesta sessão. Se preciso conferir uma linha,
  conferir **aquela** linha, não o arquivo inteiro.
- Não re-verificar o que acabei de verificar. Rodei `build` e passou? Não rodar
  de novo dois passos depois sem ter mexido em nada.
- Não redescobrir o que já está escrito. `README.md`, `BACKLOG.md` e
  `db/AAAA-MM-DD-*.md` são memória do projeto — ler de lá é mais barato do que
  re-investigar o banco ou o código.

**Trabalhar em lote:**
- Comandos independentes vão numa chamada só (vários `Bash`/leituras de uma
  vez), não um por vez.
- Agrupar um bloco de trabalho num PR só, em vez de abrir PR por mudança
  trivial.
- Saída gigante (advisors, dumps): fatiar/resumir por script, nunca despejar
  inteira no contexto.

**Ler com pontaria:**
- `grep` para *localizar*, leitura para *entender*. Ler o arquivo todo quando
  preciso do todo; ler o trecho quando o alvo é conhecido.

> **Exceção que manda mais alto:** durante **auditoria** (§6), a leitura
> integral é o objetivo — ali não se economiza cortando cobertura. Se faltar
> contexto no meio de uma auditoria, **registrar onde parei** no `BACKLOG.md` e
> retomar depois; nunca declarar a fase concluída com leitura parcial pra
> poupar token. Economia vale no trabalho do dia a dia, não em cima da
> qualidade da varredura.

---

## 0.2 O projeto inteiro roda em cota de graça, e toda cota estoura

Isto não é sobre um serviço. É sobre o formato do projeto: **o GamerHub é uma
pilha de planos gratuitos**, e cada um mede uma coisa diferente. Resolver o
medidor de um não protege dos outros — resolve um, o próximo aparece.

Já aconteceu duas vezes, e a segunda me pegou de surpresa **porque eu estava
olhando o medidor errado**:

| Quando | O medidor que estourou | Como aparecia no meu radar |
| --- | --- | --- |
| Sessões de junho–agosto | **Egress do Supabase** | Vigiado de perto: `lib/image.js`, `LazyVisible`, realtime enxuto, §6.1 inteira dedicada a ele |
| 23/08/2026 | **100 deploys/dia da Vercel** | Não estava em lugar nenhum. Nem me ocorreu que `git push` custava algo |

O erro de raciocínio foi o mesmo dos dois lados: eu tratei "cota" como sinônimo
de "banda". Cota é qualquer coisa que alguém conta. E **quase toda ferramenta
que a gente ligou este mês conta alguma coisa**.

### O inventário — e a pergunta que importa em cada linha

Não é "quanto sobra". É: **quando estourar, alguém fica sabendo?**

| Serviço | O que ele conta | Teto do plano | O que acontece ao estourar | Grita? |
| --- | --- | --- | --- | --- |
| **Vercel** | deploys criados por dia | 100 | o deploy é recusado; **o site continua no ar com a versão anterior** | Sim — email + comentário no PR |
| **Supabase** | egress | 5 GB/mês | projeto pausado; o site cai | Sim — hoje o `dbHealth` detecta e leva pra landing |
| **Sentry** | eventos por mês | 5.000 | **descarta em silêncio** | Parcial, desde 27/08 |
| **Gmail** (send-email) | envios por dia | ~500 | cadastro e recuperação de senha param | Sim, desde 23/08 (`admin_logs`) |
| **Safe Browsing** | consultas por dia | 10.000 | link deixa de ser checado | Sim, desde 23/08 (`admin_logs`) |
| **GitHub Actions** | minutos por mês | ilimitado (repo público) | — | — |

As linhas sem "sim" na última coluna são as perigosas, e o Sentry era o caso
irônico: **a ferramenta que existe pra acabar com falha silenciosa falhava em
silêncio quando estourava.**

**O que mudou em 27/08, e o que não mudou.** O caminho realista de estourar era
a **rajada** — bug em laço mandando centenas de eventos em minutos. Isso o
`lib/tetoDeEventos.js` fechou: teto de 20 por sessão, e o estouro vira **um**
evento que conta a história em vez de mil ou de nenhum. Uma rajada de 1.000
erros passou a custar 21.

O que **não** dá para fechar em código é o esgotamento gradual: saber que a cota
acabou exige perguntar ao Sentry, e isso exigiria token de API no CI — trocar
incerteza de monitoramento por credencial exposta é a mesma conta ruim de
sempre. Para esse resto, a resposta é o alerta de cota do próprio Sentry, que
manda **email**. Está no backlog como ação do dono.

> Vale distinguir da regra 3 abaixo: "está no painel do fornecedor não conta"
> critica **painel que ninguém abre**. Email chega.

### A quarta regra: alarme que grita à toa é o mesmo problema, do outro lado

Aprendida em 27/08, e custou caro porque **eu mesmo criei**. Ao fazer as Edge
Functions gritarem em `admin_logs` (§1.5), `edge_function_error` virou a **2ª
ação mais frequente de toda a trilha** — e 68 de 68 eram "chamada recusada",
zero eram falha de verdade. A `send-email` é pública por construção, então
qualquer POST da internet gravava uma linha; e a minha própria trava gravava 3
por execução do CI.

**Consertar o silêncio pode produzir fadiga de alarme, e as duas cegam igual.**
Uma esconde o sinal em nada; a outra esconde em ruído.

Duas perguntas, agora, ao criar qualquer alarme:

1. **Quem pode disparar isto?** Se a resposta inclui "qualquer um da internet",
   ele precisa de limite antes de existir.
2. **A severidade é verdade?** Recusar um estranho é a função **funcionando**.
   Marcar isso como `critical` é mentira, e mentira repetida ensina a ignorar o
   canal onde a falha real vai aparecer.

> No mesmo dia, meu próprio vigia de CI em segundo plano mandava um alarme falso
> por PR, porque lia a API do GitHub com um token que não existe. Eu estava
> escrevendo esta regra enquanto a violava. Alarme que sempre grita errado é
> pior do que alarme nenhum — ele foi desligado.

### As três regras

**1. `git push` não é de graça.** Foi a lição de 23/08 e é a menos intuitiva.
A Vercel constrói a cada push em **qualquer** branch, então o ciclo normal de
trabalho custa 4 a 6 deploys por PR:

```
push inicial na branch            -> 1 preview
cada correção depois do CI        -> 1 preview cada
o merge na main                   -> 1 produção   <- o único que interessa
o --force-with-lease do §8        -> 1 preview de conteúdo IDÊNTICO à main
```

Hoje `vercel.json` desliga preview por branch e `scripts/vercel-ignore.sh`
pula build de commit que não toca no que vai pro navegador. **Ao criar branch
nova, acrescentar em `vercel.json`** — e existe portão no CI que reprova o PR
se eu esquecer.

**2. Antes de ligar qualquer coisa nova, perguntar quantas vezes por dia ela
roda.** Não "quanto custa" — *quantas vezes*. Um número por requisição, por
push, por post, por usuário. Se a resposta multiplica por algo que cresce
(usuários × posts × leitores), o teto chega antes do que parece. Foi assim que
o realtime de curtidas ficou de fora (§6.1) e é a mesma conta.

**3. Cota que estoura em silêncio precisa do mesmo tratamento de §1.5.** Ou
alguém vê na tela, ou vai pro `admin_logs`, ou um teste falha. "Está no painel
do fornecedor" não conta — ninguém abre painel de fornecedor por diversão. Foi
por isso que a `send-email` e a `moderate-links` passaram a gritar.

### O que **não** resolve, e por que registrar isso

Duas ideias que soam certas e atacam o alvo errado:

- **"Mergear menos vezes na main."** Reduz os deploys de produção, que eram
  ~12 no dia. O teto foi de 100. O grosso era preview de branch — mergear em
  lote não encosta neles.
- **"Usar uma branch de teste e só mandar pra main o que estiver sólido."** É
  exatamente o que já se faz: a `claude/*` **é** a branch de teste. O problema
  nunca foi o que ia pra main; era que a branch de teste também deployava.

Registrado aqui porque as duas vão voltar a ser sugeridas — inclusive por
outras IAs, que foi de onde vieram.

---

## 0.3 Desempenho é experiência do usuário, e ela mede em BYTES

> Pedido do dono em 28/08, depois da primeira rodada de otimização: *"a
> experiência do usuário, se não for a mais importante, é uma das partes mais
> importantes do projeto"*. Esta seção existe porque site lento é um defeito que
> ninguém denuncia — a pessoa fecha a aba e some, e nada aparece em log nenhum.

**A conta que engana, e que eu já errei.** Em 27/08 o Lighthouse acusou 387 KiB
de página inteira e **13,9 s de main thread**. Os dois números só batem quando
se percebe que o custo de CPU é proporcional ao JavaScript **descompactado**: o
chunk da cena 3D tinha 236 KB comprimidos e **887 KB** depois de descompactar.

> **Peso de rede e trabalho de CPU são contas diferentes.** Ao avaliar um
> arquivo, o número que importa para travamento é o bruto, não o gzip.

### As quatro armadilhas já encontradas aqui

| Armadilha | O que parecia | O que era |
| --- | --- | --- |
| `lazy()` **não adia download** | "a cena é lazy, então não pesa" | o componente montava com o Hero, então o pedido saía no primeiro instante — caminho crítico com outro nome |
| `@import` de CSS externo | "tem `preconnect`, está resolvido" | `preconnect` economiza handshake, **não descoberta**: o navegador só soube da fonte depois de parsear o CSS inteiro |
| `manualChunks` **vence** `import()` | "troquei para dinâmico, vai separar" | regra ampla (`/react/`) arrastava `@sentry/react` para o chunk ansioso, e chunk manual ganha da divisão automática |
| Chunk de **rota** escapa do orçamento | "o carregamento inicial está no teto" | a rota é lazy, então a biblioteca pesada foi para o chunk dela — o visitante pagava tudo e o portão não via |

### As regras

**1. Antes de adicionar biblioteca, perguntar quanto ela custa DESCOMPACTADA.**
E se ela vem inteira: `three` entra com o renderer WebGL completo mesmo quando
o código usa cinco símbolos. Tree-shaking não alcança tudo.

**2. Decoração cara é opcional, e a decisão nunca é minha sozinha.** Portão por
aparelho (`lib/cena3D.js`) decide o padrão; **a escolha explícita do visitante
vence o portão**. Palpite de heurística não passa por cima de quem clicou.

**3. Toda espera precisa de teto absoluto.** Adiar carregamento até `load`, até
`requestIdleCallback` ou até qualquer evento cria o caso em que o evento não
vem. Já aconteceu: a cena 3D presa em `readyState: interactive` porque o Google
Fonts estava inalcançável. Enfeite que some não gera erro, não gera log e não
quebra teste — é §1.5 puro.

**4. Regressão de desempenho é barrada por byte, não por tempo.**
`scripts/orcamento-de-bytes.mjs` roda no CI. Tempo de laboratório oscila com a
máquina — as duas medições de 27/08 discordaram **4×** no TBT medindo o mesmo
site —, e portão que balança vira alarme falso (§0.2, quarta regra). Byte é
determinístico.

**5. Medir antes e depois na MESMA ferramenta e no MESMO aparelho.** Comparar um
PageSpeed de hoje com um Lighthouse local de ontem não diz nada. E medição de
laboratório não substitui campo: o Vercel Speed Insights já está instalado.

**6. Detectar aparelho é medir, não identificar.** Dá para ler modelo e GPU no
Chrome/Android (`userAgentData`, `WEBGL_debug_renderer_info`), mas isso é tabela
que envelhece, não existe no Safari, e é impressão digital — o oposto do
endurecimento de LGPD que este projeto fez. Ver
[`docs/DECISOES.md`](docs/DECISOES.md).

---

## 0.4 A ordem do trabalho é de FORA para DENTRO — as camadas

> Ideia do dono em 29/08: *"começar as coisas de fora pra dentro... como a
> landing page é a primeira coisa, ela é a primeira camada, o login e cadastro é
> a segunda camada, o site em si são outras camadas"*.

**Por que isto existe, e o custo que ele evita.** No mesmo dia, gastei **três
rodadas** afinando a resolução da cena 3D — enquanto o rodapé da landing era
duas linhas, não havia página "sobre", e os cards que apresentam o site não
levavam a lugar nenhum. Nada me dizia que eu estava no lugar errado: cada rodada
tinha justificativa própria, medição própria e resultado próprio.

A ordem por camada tira essa escolha do meu julgamento no calor do momento.

| Camada | O que é | Quem vê |
| --- | --- | --- |
| **1** | Landing | qualquer pessoa, antes de decidir se fica |
| **2** | Login e cadastro | quem decidiu entrar |
| **3** | O site logado — feed, mural, lives, perfil, ranks | quem já é da casa |
| **—** | Painéis e moderação | só a equipe (transversal: atende todas as outras) |

**A regra:** na dúvida entre duas coisas boas, faz a da camada mais externa. Um
defeito na camada 1 é visto por todo mundo que chega; um refinamento na camada 3
é visto por quem já ficou.

### O que FURA a fila, e não é negociável

A ordem das camadas é desempate, não hierarquia acima do §0. Continua valendo,
na frente de qualquer camada:

1. **Falha de segurança explorável** — fecha na hora (§1.3).
2. **Bug** que quebra um caminho de uso — diagnostica e mata (§1.2).
3. **Pedido explícito do dono** — ele conhece o que é urgente melhor do que a
   régua; a régua serve para quando ele **não** disse.

### O que a regra NÃO quer dizer

Não é "proibido tocar em camada interna". É que, quando **eu** escolho o que
fazer, começo por fora. Se o dono pede uma coisa da camada 3, faço a coisa da
camada 3 — a régua nunca vira desculpa para não atender.

E não é "termine a camada antes de passar para a próxima": camada nenhuma
termina. É sobre a ordem de escolher, não sobre um portão.

---

## 1. Postura

As regras que valem acima de todas: sinceridade, diagnosticar antes de
consertar, segurança proativa, não confiar no que está escrito, e falha tem
que gritar.

@docs/regras/POSTURA.md

## 2. Definição de pronto

Uma entrega só está pronta quando **todos** estes itens passam:

- [ ] `npm run build` — sem erro
- [ ] `npm run lint` — **0 erros** (warnings: não aumentar o número existente)
- [ ] `npm test` — tudo verde
- [ ] Mudou lógica de banco/RPC/RLS? Testado em transação com `ROLLBACK`
      **antes** de aplicar em produção (ver §5)
- [ ] Os caminhos que **não** podiam quebrar foram testados explicitamente
- [ ] Pensei em como abusar disso (§1.3) e fechei o que achei
- [ ] **Nenhum arquivo que eu toquei ficou acima de 300 linhas.** Se ficou,
      dividi **antes** de entregar — não anotei pra depois (§4)
- [ ] `README.md` atualizado se mudou comportamento/estrutura
- [ ] `BACKLOG.md` atualizado se resolveu ou descobriu pendência
- [ ] Passei a bateria de faxina (§6.1) no que toquei — código morto, egress,
      cleanup, duplicação
- [ ] Passei o **teste dos três canais** (§1.5) no que toquei
- [ ] **Todo bug que corrigi virou uma trava** (ver abaixo) — sem exceção
- [ ] Script de teste avulso: rodou, passou, **apagou** (nunca commitar)

### Todo bug corrigido vira uma TRAVA — não é opcional

> Consertar sem travar é convite pro bug voltar. E ele volta: neste projeto já
> voltou três vezes o mesmo padrão de `owner` esquecido em lista de papéis.

**A regra:** nenhum bug é considerado resolvido só porque o sintoma sumiu.
Junto do conserto entra **um mecanismo que impede o retorno** e que roda sozinho.

**Como escolher a trava** — na ordem, do mais forte pro mais fraco. Sempre
preferir o mais alto que couber:

| Força | Mecanismo | Quando cabe |
| --- | --- | --- |
| 1º | **Constraint / CHECK / FK no banco** | o dado errado passa a ser **impossível** de existir |
| 2º | **Teste que reproduz o bug** | comportamento errado passa a quebrar o `npm test` |
| 3º | **Teste de contrato** que varre o código-fonte | a deriva entre dois lugares passa a falhar sozinha |
| 4º | **Tipo / mapa explícito** que não aceita valor desconhecido | o caso novo estoura em vez de cair num `else` |
| 5º | Comentário explicando o porquê | **só quando nenhum dos quatro couber** |

**A trava tem que ser provada.** Não basta escrever o teste: é preciso
**injetar o bug de volta** e ver o teste falhar, nomeando o problema. Se ele
passa com o bug presente, ele não é trava, é decoração. Exemplo real: ao
travar as assinaturas de realtime, removi `unban_requests` da lista e conferi
que o teste falhou apontando `hooks/useAdminRealtime.js` e o comando SQL que
faltava.

**A mensagem da falha tem que ensinar.** Quem esbarrar nela daqui a seis meses
precisa entender o que fazer sem ler o histórico. "esperado [] mas recebeu [x]"
não ensina nada; "assinatura que nunca vai receber evento — rode `ALTER
PUBLICATION ...`" ensina.

**Travas que já existem** (imitar o padrão, não reinventar):
`lib/logMeta.js` (toda action precisa de ícone) · `lib/realtimeTables.js` (toda
assinatura precisa da tabela publicada) · `components/moderation/queueLabels.js`
(todo tipo da fila precisa existir nos três mapas) · `lib/roles.js`
(`canModerateLive` com as 5 combinações travadas).

---

## 3. Stack

- **Frontend:** React 19 + Vite + Tailwind + Framer Motion. Testes: Vitest.
- **Backend/DB:** Supabase (Postgres 17), project_id `yuqbdcoljlvncxdnesxk`.
- **Deploy:** Vercel (SPA com rewrite para `/`).
- Cliente usa **apenas a anon key**. A segurança real está no RLS + funções
  `SECURITY DEFINER`.

---

## 4. Regras de código

### Organização — nunca deixar arquivo gigante

Arquivo grande não é problema de estilo: é onde bug e brecha se escondem,
porque ninguém consegue ler tudo de uma vez pra revisar. Foi exatamente assim
que a moderação de comentário ficou quebrada por meses sem ninguém notar.

#### Split é automático — eu não espero pedido

> Ordem direta do dono: *"assim como a regra da segurança que vc vai fazer sem
> eu pedir, quero tbm que vc já identifique locais no código que precisam ou
> vão precisar fazer um corte antes mesmo de me entregar"*.

Isto tem o **mesmo peso da regra de segurança (§1.3)**. O motivo é o mesmo:
código pequeno e limpo é o que permite achar brecha e bug. Arquivo inchado
esconde os dois.

Na prática:

- **Antes de entregar qualquer coisa**, conferir o tamanho dos arquivos que
  toquei. Passou de 300 linhas? Divido **agora**, no mesmo trabalho — não
  pergunto, não anoto pra depois.
- **Se eu vou fazer um arquivo crescer** e isso o levaria perto do limite,
  já entrego dividido. Não crio dívida nova pra pagar depois.
- **Se eu esbarrar num arquivo grande** enquanto faço outra coisa, aviso e
  divido, mesmo que não seja o que foi pedido (regra de esbarrar, §0).
- Varredura barata pra rodar sempre que fechar um bloco de trabalho:
  ```bash
  find src -name '*.jsx' -o -name '*.js' | xargs wc -l | sort -rn | head -15
  ```
- **O que continua exigindo aprovação** (§7): quando dividir deixa de ser
  movimentação mecânica e vira **decisão de arquitetura** — trocar o padrão de
  estado, mudar contrato de service, reorganizar pastas. Aí eu apresento o
  plano antes. O corte mecânico (extrair componente, extrair hook, tirar
  duplicação) **não** precisa de aprovação.
- Ao relatar, dizer sempre o antes → depois em linhas.

**Gatilhos objetivos para dividir** (qualquer um já basta):

| Gatilho | Ação |
| ------- | ---- |
| Arquivo > 300 linhas | Dividir. > 500 é dívida que **precisa** entrar no backlog. |
| Mistura responsabilidades (busca dados + estado + UI + regra de negócio) | Separar por responsabilidade, não por tamanho. |
| Mesma UI repetida em 2+ lugares | Extrair componente. |
| Mesma lógica repetida em 2+ lugares | Extrair hook ou util. |
| Acesso ao Supabase dentro de componente | Mover pro service do domínio. |
| Preciso rolar o arquivo pra entender uma função | Já passou do ponto. |

**Como dividir sem quebrar** (a ordem importa):
1. Extrair **sem mudar comportamento** — só mover código e ajustar imports.
2. `npm run build` + `npm test` a cada extração, não só no fim.
3. Uma extração por commit, pra ficar reversível.
4. Só depois, se fizer sentido, melhorar a lógica extraída — nunca junto.

- **Pensar em escalabilidade, não só em funcionar.** "Aguenta crescer e é fácil
  de manter" faz parte do requisito.
- **Fonte única de verdade.** Se a mesma informação existe em dois lugares,
  eles vão divergir. Já aconteceu: os dois painéis de log tinham mapas de
  ícones próprios e desatualizados (hoje unificados em `lib/logMeta.js`, com
  teste que falha se alguém esquecer de registrar uma action nova).

### Erros
- **Nunca engolir erro.** `const { data } = await supabase...` descarta o
  `error` silenciosamente. Em operação de escrita isso é proibido.
- **`count: 'exact'` + tratar 0 linhas como erro** em update/delete. RLS nega
  **em silêncio**, devolvendo 0 linhas sem erro — sem essa checagem, o app diz
  "sucesso" e nada aconteceu. Foi exatamente isso que escondeu, por muito
  tempo, o fato de a moderação de comentário e mural nunca ter funcionado.
- Atualização otimista precisa de **rollback + aviso** quando o servidor recusa
  (ver `lib/like.js`).

### Fallback silencioso é PROIBIDO

> O bug mais barato de escrever e o mais caro de achar. Você economiza uma linha
> hoje e paga com uma tela em "Carregando..." para sempre depois.

O caso real: a prévia da fila de moderação mapeava `post` e `comment`, e tudo o
mais caía num `else → community_posts`. Quando o tipo `chat` passou a existir,
ele foi buscar numa tabela onde a linha **nunca** existe, o erro foi descartado,
e o card ficou girando eternamente. Ninguém escreveu esse bug — ele **nasceu
sozinho** no dia em que um valor novo apareceu.

**Os quatro disfarces do fallback silencioso:**

```js
const t = tipo === 'post' ? 'posts' : tipo === 'comment' ? 'comments' : 'community_posts';
const sev = w.severity || 'medium';        // e se vier 'critical'?
switch (x) { case 'a': …; default: faz();} // default que ENGOLE
const v = obj[k] ?? PADRAO;                // padrão escondendo chave inexistente
```

**O que fazer no lugar:**

- **Mapa explícito**, um objeto com todas as chaves conhecidas — e o
  desconhecido devolve `undefined`, não um palpite.
- **Tratar o desconhecido de forma visível**: retornar erro, mostrar
  "tipo desconhecido: X" na tela, ou lançar. Nunca escolher um valor por ele.
- **Travar com teste** (§2): a lista de valores que o sistema pode produzir
  precisa bater com as chaves do mapa. Foi o que impediu o caso do `chat` de
  voltar.
- **Valor padrão só quando o padrão é a regra**, não quando é chute. `?? true`
  numa preferência de notificação é regra ("na dúvida, notifica"); `?? 'medium'`
  numa severidade vinda do banco é chute.

**Sinal de alerta:** se você escreveu `else`, `default:` ou `??` e não consegue
dizer em voz alta **quais valores caem ali**, é fallback silencioso.

### UI
- **Sem emojis na UI.** Só `lucide-react`, ou `react-icons/fa6` para marcas
  (Discord, Twitch, YouTube). Emoji dá cara de chatbot. Isso inclui setas
  tipográficas (`→`, `←`) em botão: usar ícone.
- **Botão de atualizar: loading mínimo de 500ms** —
  `Promise.all([fetch(), new Promise(r => setTimeout(r, 500))])`, com
  `disabled={refreshing}` e `className={refreshing ? 'animate-spin' : ''}`.
- **Nada de `window.confirm` / `window.prompt` / `alert`.** Usar `ConfirmModal`
  / `ReasonModal`.
- Modais via `createPortal`, fundo `rgba(0,0,0,0.92)`, card
  `bg-dark-800 rounded-2xl`, animação `animate-fade-up`.
- Tipografia mono para dado técnico, `font-display` para título.
- Animações: variantes compartilhadas de `lib/motion.js` — não duplicar.
- **Acessibilidade:** botão só-ícone precisa de `aria-label`; toggle precisa de
  `aria-pressed`.

### URLs e mídia
- **Toda URL vinda de usuário passa por `safeExternalUrl`** (`lib/url.js`)
  antes de virar `href`. Só `http`/`https`. Isso já foi um XSS armazenado real.
- Imagem de upload passa por `lib/image.js` (compressão) — egress é a cota mais
  apertada do plano Free.

---

## 5. Trabalhando com o banco

O padrão de teste em ROLLBACK assumindo papel, os gotchas do `execute_sql`,
a regra da inversa e da limpeza, e a disciplina de quem passa por cima da RLS.

@docs/regras/BANCO.md

## 6. Auditoria periódica e 6.1 Faxina

As 4 fases da auditoria, a regra de cobertura total, e a bateria de faxina
que roda ao fechar cada bloco de trabalho.

@docs/regras/AUDITORIA.md

## 6.2. Documentação

Onde cada documento mora, o Contrato de Evolução, e as três camadas que
mantêm tudo atualizado (portão no CI, lembrete semanal, reler antes de escrever).

@docs/regras/DOCUMENTACAO.md

## 6.3 Os mecanismos que não dependem da minha memória

> Ordem do dono em 29/08, depois de eu falhar **duas vezes na mesma sessão**:
> *"quero algum tipo de gatilho pra vc poder ler a documentação e principalmente
> sua própria memória (CLAUDE.md), nada mais pode falhar"*.

**O que essa cobrança revelou, e é o motivo desta seção existir.** As duas
falhas foram com as regras **escritas, certas, e lidas por mim no começo da
sessão**: escrevi medição no `FUNCIONALIDADES.md` (o lugar é `DESEMPENHO.md`) e
deixei seis arquivos novos fora do `ARQUITETURA.md`. Nenhum portão acusou,
porque nenhum deles olhava isso.

A tabela do §2 já dizia o que fazer: *"comentário explicando o porquê"* é a
**mais fraca** das cinco travas, e só vale *"quando nenhum dos quatro couber"*.
Responder a uma falha de cumprimento escrevendo **mais uma regra** seria repetir
exatamente o que não funcionou. Por isso o que entrou foi mecanismo, não texto.

| Mecanismo | Quando roda | O que ele pega |
| --- | --- | --- |
| `scripts/inicio-de-sessao.sh` | **sozinho**, no `SessionStart` | põe na minha frente o estado real: pendência não commitada, os itens 🔴/🟠 do backlog **por extenso**, e há quantos dias cada documento não é tocado |
| `scripts/fim-de-sessao.mjs` (`npm run fim`) | **eu rodo antes de encerrar** | o que o CI nunca viu: trabalho não commitado, commit não empurrado, arquivo acima de 300 linhas, contador do backlog mentindo |
| `scripts/mapa-de-arquivos.mjs` | CI, **reprova** | arquivo em `src/` que o `ARQUITETURA.md` não conhece |
| `scripts/segredos-vazados.mjs` | CI, **reprova** | chave privada, `service_role`, token ou senha em arquivo rastreado |
| `scripts/documentacao-quebrada.mjs` | CI, **reprova** | documento citando arquivo que não existe mais |
| `scripts/documentacao-envelhecida.mjs` | dia 1º, **abre issue** | documento atrás do código — **inclusive `CLAUDE.md` e os `docs/regras/`**, que até 02/09 eram os únicos sem vigilância |
| `e2e/portas-do-banco.mjs` | CI, **reprova** | porta do banco que abriu — **e porta que fechou**, que já derrubou o site 3× |
| `e2e/conteudo-visivel.mjs` | CI, **reprova** | conteúdo no DOM e invisível na tela, em janela de celular |
| `e2e/navegacao.mjs` | CI, **reprova** | página abrindo no lugar errado, âncora morta, botão voltar atropelado |
| `e2e/sem-banco.mjs` | CI, **reprova** | banco fora do ar derrubando o que **não** depende dele |
| `src/lib/tabelasSemUpdate.js` | `npm test`, **reprova** | `update` em tabela sem policy — 0 linhas e **nenhum erro** |
| `src/lib/__tests__/varrerFontes.js` | usado pelas travas | trava que varre pasta e **não leu arquivo nenhum**: sem ele, renomear a pasta deixa o teste verde para sempre |
| `e2e/publicarPost.mjs` | CI, **reprova** | publicar que não aparece — e ele diz **o que a tela disse** em vez de um `waiting for locator` mudo |
| `conteudoDoSobre.test.js` | `npm test`, **reprova** | mídia de terceiro em `src/assets/som/` **sem crédito visível**: licença CC-BY exige atribuição, e sem ela o site usa a obra sem licença |
| `documentosLegais.test.js` | `npm test`, **reprova** | documento público que ninguém aceita, e versão fora do formato que o `CHECK` do banco exige |
| `src/lib/somAmbiente.js` (teste) | `npm test`, **reprova** | duas instâncias de áudio tocando juntas — a janela entre o clique e o download terminar |

### O que os mecanismos NÃO fazem — e por que isso está escrito aqui

> Pergunta do dono em 30/08, no minuto seguinte à entrega: *"esse script te faz
> lembrar dessas regras ou testes? ... te faz lembrar de **tudo** oq vc precisa
> fazer na sessão?"*.

**Não. E não tem conserto em código.** Dos 13 itens da definição de pronto (§2),
os mecanismos acima cobrem **seis** — os que uma máquina consegue medir. Os
outros sete são de julgamento, e o principal deles é justamente o de segurança:
não existe comando que responda *"eu pensei em como alguém abusaria disto?"*.

| Verificado por máquina | Só por julgamento |
| --- | --- |
| build · lint · testes | **pensar como o atacante (§1.3)** |
| arquivo acima de 300 linhas | o bug virou trava, e a trava foi provada (§2) |
| contador do backlog | teste dos três canais (§1.5) |
| arquivo fora do `ARQUITETURA.md` | faxina no que toquei (§6.1) |
| documento citando arquivo que sumiu | caminhos que não podiam quebrar (§1.2) |
| trabalho não commitado ou não empurrado | mudança de banco testada em `ROLLBACK` (§5) |

**Fingir que verifica seria pior do que não verificar.** Um portão que dá verde
sobre julgamento ensina a confiar num sinal que não sustenta nada — a mesma
falha das cotas que estouram em silêncio (§0.2), só que pelo lado da falsa
confiança. Por isso `npm run fim` termina dizendo, com todas as letras, que
verde ali **não** quer dizer pronto: quer dizer que o que dá para medir por
máquina está medido.

**O que os dois gatilhos fazem com os sete itens restantes:** põem a lista na
frente. No **início**, porque no fim ela chegaria tarde demais para mudar *como*
a coisa foi construída — pensar em abuso depois de entregar não é segurança
proativa, é auditoria do próprio erro. E no **fim**, como última chance de
voltar. A resposta de cada um vai **dita ao dono no relatório de entrega**, que
é o único lugar onde ele pode cobrar.

### Onde cada coisa escrita mora — a tabela que eu errei

Está no §6.2 por extenso. Repetida aqui em uma linha porque foi **este** acerto
que falhou, e o gatilho de início a mostra em toda sessão:

> medição → `DESEMPENHO.md` · decisão → `DECISOES.md` · arquivo novo →
> `ARQUITETURA.md` · o que falta → `BACKLOG.md` · quando quebra → `OPERACAO.md`

### Nada fica para a próxima sessão — o que isso quer dizer de verdade

A sessão acaba e o contexto morre junto. Então **o que eu comecei, eu fecho**:
sem código não commitado, sem PR sem merge, sem achado que existe só na
conversa. `npm run fim` reprova os três.

**O que essa regra NÃO promete**, porque regra impossível vira regra ignorada
(§0): que todo trabalho caiba numa sessão. Uma auditoria consome uma inteira; um
bug que só reproduz no celular do dono depende dele. O que não cabe vai para o
`BACKLOG.md` **escrito**, com o que já foi descartado e qual evidência
resolveria — nunca para a minha cabeça, que não sobrevive ao fim da sessão.

---

## 7. Processo para mudanças estruturais

- **Antes de alterar**, apresentar análise/plano e **aguardar aprovação**.
- Mudanças graduais e justificadas. Não reescrever do zero, não reorganizar sem
  necessidade, não mudar comportamento/visual/rotas/auth/integrações por conta
  própria.
- Preferir mudança **aditiva** (que não altera o caminho feliz).
- Após cada alteração relevante, informar: arquivos mudados, o que mudou, por
  quê, benefício e risco.
- **Arquivos de alto risco** (mexer só com teste explícito dos dois lados):
  `hooks/useAuth.jsx`, `pages/Login.jsx`, `lib/supabase.js`, qualquer policy de
  RLS, qualquer `SECURITY DEFINER`. Quebrar `useAuth` derruba o site inteiro.

### Os três níveis — quando executo, quando proponho, quando alerto

"Mudança estrutural pede aprovação" era vago demais e me fazia perguntar coisa
óbvia ou executar coisa sensível. A lista fechada:

**🟢 Executo direto** — local, reversível, baixo risco:

ajuste de UI · correção de texto · bug claramente identificado · refactor local
sem impacto arquitetural · pequena melhoria de código · extrair componente ou
hook · dividir arquivo que eu mesmo inchei (§4).

**🟡 Proponho e espero** — estrutural ou sensível:

arquitetura · modelo de dados · migration · RLS · permissões · autenticação ·
autorização · RPC sensível · Edge Function crítica · infraestrutura · contrato
entre partes do sistema · comportamento público importante · separação de
subsistema · mudança relevante na moderação · qualquer coisa difícil de
reverter.

**🔴 Alerto antes, e não executo em silêncio** — perigoso ou irreversível:

perda ou alteração relevante de dado de usuário · `DROP` · revoke amplo ·
qualquer coisa sem caminho de volta. Explico **risco, alternativa e impacto**, e
espero — mesmo que o dono já tenha pedido, se ele não parecia saber do risco.

> **A exceção que manda mais alto:** falha de segurança **explorável** se fecha
> na hora (§1.3), relatando junto o que foi feito. Buraco aberto esperando
> aprovação é buraco aberto.

**Se eu discordar de uma ideia do dono, eu digo antes de executar.** Concordar
por educação com uma abordagem pior é o pior serviço que eu posso prestar — o
dono decide, mas decide sabendo o que eu penso.

---

## 8. Git — incluindo PR e merge

- Trabalhar na branch combinada com o dono (hoje:
  `claude/gamerhub-technical-summary-vhguK`). Não criar branch nova sem
  permissão.
- Commit explicando **o problema**, não só a mudança: o que estava errado, como
  foi comprovado, o que foi feito.

### Fechar o ciclo: PR + merge são minha responsabilidade

O dono **não** quer mergear na mão. Ao concluir um bloco de trabalho (feature,
fix, fase de auditoria), eu fecho o ciclo inteiro:

1. `git push -u origin <branch>`
2. Abrir o PR (`create_pull_request`, base `main`) com corpo explicando **o
   problema, a correção e como foi validado** — não só a lista de arquivos.
3. Mergear (`merge_pull_request`, `squash`).
4. Sincronizar a branch local com a `main` já mergeada:
   `git checkout main && git pull --ff-only origin main && git checkout -B <branch>`
5. **Realinhar a branch remota** com `git push --force-with-lease`. Sem isso ela
   fica apontando pros commits individuais que o squash substituiu, e o git
   passa a ver divergência ("N à frente, M atrás") mesmo sem nada pendente —
   o hook de fim de sessão acusa commit não empurrado que na verdade já está
   na `main`. Antes de forçar, conferir com
   `git diff --stat origin/main origin/<branch>` que o conteúdo é idêntico.
   *(Este push custava um deploy de preview de conteúdo idêntico ao que acabou
   de ir pra main. Desde 23/08 não custa mais — ver §0.2.)*
6. Informar o número do PR ao dono.

**Só mergear com a definição de pronto (§2) cumprida** — build, lint, testes e
validação no banco. Se algo estiver falhando, o PR fica aberto e eu aviso; não
mergear "pra não deixar pendente".
