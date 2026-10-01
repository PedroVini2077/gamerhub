<!--
  Parte do `CLAUDE.md`, puxada por `@import`. O motivo do corte está no §6.2
  regra 5: seção acima de ~150 linhas vira arquivo próprio, e o CLAUDE.md
  chegou a 900 linhas — o teto que ele mesmo impõe — em 24/09.
-->

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
| **Groq** (requisições) | requisições por dia | ~1.000 no plano grátis | a IA para de redigir; o painel **diz** e a equipe escreve à mão | Sim, desde 25/09 (`admin_logs`, no `429`) |
| **Groq** (**tokens por minuto**) | tokens de UMA requisição, entrada + `max_tokens` | **8.000** (`on_demand`) | `HTTP 413`: a requisição é recusada inteira | Sim, desde 25/09 — mas ver o quadro abaixo |
| ~~**GDELT**~~ | requisições **por IP** | 1 a cada 5 s | **`[01/10]` DESLIGADA no mesmo dia** — ver o quadro abaixo | — |
| **Google News RSS** (busca ampla) | não documentado | — | **`[01/10]` `HTTP 503` INTERMITENTE** da Edge Function: funcionou às 19:21, falhou às 20:58 | Sim — `comFalha` diz o motivo e **que já tentou duas vezes** |
| **GitHub Actions** | minutos por mês | ilimitado (repo público) | — | — |

> **`[25/09]` A Groq entrou já com a terceira regra cumprida**, e não depois: o
> `429` grita em `admin_logs` antes de a função responder, e a tela diz *"A cota
> diária da IA acabou. Ela volta amanhã — escreva a mão por enquanto."* A
> pergunta da segunda regra também foi feita antes de ligar: **quantas vezes por
> dia?** Uma por clique de editor em "Redigir rascunho" — não multiplica por
> usuário, por post nem por leitor, porque só `is_staff()` alcança. É o oposto
> do realtime de curtidas, que foi recusado justamente por multiplicar.
>
> **`[26/09]` O radar de pautas entrou pela mesma porta, e a conta é maior:**
> ~12 requisições de RSS + 1 ao modelo, por clique em "Buscar pautas". Feed não
> tem cota e não custa nada — o que conta é o mesmo teto da Groq. E ele também
> não multiplica: só `is_staff()` alcança, e é um clique de editor, não um por
> visitante. A pergunta da regra 2 foi feita **antes** de ligar.

>
> **`[01/10]` A FASE 3 do radar não acrescentou NENHUMA cota externa, e isso
> foi o critério de escolha.** O sinal de aceleração ia sair do `TimelineVol`
> da GDELT ou do Google Trends — um morreu por teto de IP, o outro foi
> recusado por trazer loteria e futebol — e passou a sair de `news_items_raw`.
> As três perguntas desta página, respondidas antes de ligar: **quantas vezes
> por dia?** uma consulta a mais por clique de editor, e só `is_staff()`
> alcança. **Quanto cabe de uma vez?** 20 termos, cortado na própria RPC — 8
> pautas × 3 termos é uma consulta, não 24. **Quanto tempo leva?** é o nosso
> Postgres com 772 linhas, não rede de terceiro. Fornecedor que não existe é o
> único que nunca recusa.

> ### ⚠️ `[01/10]` A pergunta da regra 2 foi feita, e ela era a PERGUNTA ERRADA
>
> A linha da Groq dizia só *"requisições por dia"*, e eu tinha escrito, duas
> vezes, que a pergunta da regra 2 *"foi feita antes de ligar"*. Foi. **E a
> resposta certa para a pergunta errada não protege de nada.**
>
> O radar falhou em **7 de 7 chamadas** entre 26 e 28/09 — quer dizer, nunca
> funcionou em produção. Nenhuma delas chegou perto do teto diário. O que
> estourou foi um segundo medidor que não estava nesta tabela:
>
> ```
> Request too large for model `openai/gpt-oss-120b` ... service tier
> `on_demand` on tokens per minute (TPM): Limit 8000, Requested 9231
> ```
>
> Dois detalhes que decidem o conserto, e nenhum é óbvio:
> **(a)** é teto por minuto aplicado a **uma requisição só** — pedido grande
> demais é recusado mesmo com a janela inteira livre; e **(b)** a Groq soma o
> **`max_tokens`** ao que você pediu, então os 2.500 reservados para a resposta
> contavam contra os mesmos 8.000.
>
> **A regra 2 ganha uma segunda metade, e é o que esta sessão aprendeu:**
> depois de *"quantas vezes por dia?"*, perguntar **"e quanto cabe de uma
> vez?"**. Serviço que cobra por volume tem os dois medidores, e o de volume
> morde primeiro em qualquer coisa que mande texto longo — moderação de lote,
> resumo, tradução, embedding.
>
> *Registrado aqui porque a frase errada não era inofensiva: uma tabela que se
> apresenta como o inventário do que cada serviço conta deixa de ser verdade
> para quem a lê — inclusive para mim, que a reli em 26/09 montando o radar e
> conferi que a conta de requisições fechava.*
>
> ### ⚠️ `[01/10]` E a correção produziu a REGRESSÃO SEGUINTE, no mesmo dia
>
> Para caber nos 8.000 eu baixei o `max_tokens` de 2.500 para 1.300. O `413`
> morreu. Horas depois apareceu, **intermitente**:
>
> ```
> HTTP 400 · code: json_validate_failed
> "Failed to validate JSON. Please adjust your prompt."
> failed_generation: ""        <- VAZIO
> ```
>
> **`failed_generation` vazio não é JSON ruim: é NENHUMA saída.** O
> `gpt-oss-120b` é modelo de **raciocínio** — ele gasta 300 a 900 tokens de
> cadeia de pensamento **do mesmo `max_tokens`** antes de escrever. O JSON de 8
> pautas custa ~900. 1.300 fica em cima da fronteira, e por isso falhava "às
> vezes" em vez de sempre.
>
> **Eu apertei o lado errado, e o número estava no próprio log.** No `429`
> seguinte a Groq disse `Requested 4364` contra teto de 8.000 — a entrada
> custava 3.064 tokens e sobravam ~3.600 sem uso.
>
> **A lição, e ela vale para qualquer serviço medido:** quando um teto aperta,
> **medir qual parcela o ocupa antes de cortar**. Eu cortei a saída porque era
> a parcela que eu controlava por uma constante, não porque ela fosse a maior.
> E a mesma resposta da Groq que me deu o `413` já trazia o número que teria
> mostrado o erro.
>
> **A segunda metade:** num modelo de raciocínio, `max_tokens` **não** é o
> tamanho da resposta — é resposta **mais** pensamento. Tratar os dois como um
> só é um medidor interno que não estava em tabela nenhuma.
>
> ### ⚠️ `[01/10]` E eu errei esse número uma TERCEIRA vez, de outro jeito
>
> Com 2.400 o `400` voltou — mas com outro corpo, e a diferença é tudo:
>
> ```
> 1ª (1.300)  failed_generation: ""                      <- VAZIO
> 2ª (2.400)  failed_generation: "{\"pautas\":[{\"titulo\":
>             \"Nintendo lança bundle... EA Spor         <- TRUNCADO
> ```
>
> **Vazio era o raciocínio comendo tudo. Truncado é a RESPOSTA não cabendo.**
> O modelo começou a escrever e o teto acabou no meio do JSON.
>
> Eu estimava ~125 tokens por pauta; com título, ângulo de 1–2 frases, "por que
> agora" e os índices, uma pauta custa perto de **160**. Oito pautas são 1.280,
> e a reserva da resposta era 1.000.
>
> **E de novo o número que me corrigiria estava no log:** `chars 13931, itens
> 59` dá ~2.939 tokens de entrada; com 2.400 de saída o pedido custava ~5.689
> de 8.000. **Sobravam 2.300 sem uso** enquanto eu apertava a saída.
>
> **O que mudou, e por que não vai acontecer uma quarta vez:** a relação virou
> trava. `RESERVA_DA_RESPOSTA >= TETO_DE_PAUTAS × TOKENS_POR_PAUTA` é conferido
> a cada `npm test`, então quem subir o número de pautas é obrigado a subir a
> reserva junto. **Eu tinha a conta na cabeça e nenhuma no teste** — duas
> vezes.
>
> A `FOLGA` também saiu de 0,75 para 0,85, com medição: eu estimava ~6.000 e a
> Groq respondeu `Requested 4364`. Era margem empilhada sobre margem, e o preço
> eram manchetes a menos **ou** resposta cortada.

> **`[01/10]` A GDELT entrou com as DUAS perguntas respondidas — a antiga e a
> que esta sessão acrescentou.**
>
> *Quantas vezes por dia?* Até **2 por clique** de editor em "Buscar pautas".
> Não multiplica por usuário, post nem leitor: só `is_staff()` alcança.
>
> *E quanto cabe de uma vez?* Uma. É teto de **frequência**, não de volume —
> por isso as consultas vão em **série**, com 5,2 s entre elas, e o teto por
> clique é 2 (4 fariam o editor esperar ~16 s olhando a tela).
>
> **E uma terceira coisa, que é o motivo de esta linha ser diferente das
> outras:** o teto é por **IP de saída**, e nós não controlamos com quem
> dividimos o nosso. Medido em 01/10: quatro tentativas espaçadas de 8 s e uma
> sozinha após **70 s de silêncio** — `429` em todas. A causa provável é IP
> compartilhado consumido por terceiros; **isso é hipótese, não fato** (§1.1),
> porque o IP da Edge Function é outro e eu não alcanço aquele ambiente.
>
> Por isso o desenho não aposta que ela responda: o `429` é **caso esperado**,
> vira linha em `comFalha`, e a coleta do RSS segue intacta. Se a GDELT nunca
> responder em produção, o radar continua exatamente como era — e nós vamos
> **saber**, em vez de supor.
>
> ### ⚠️ `[01/10]` O primeiro clique real desmentiu a previsão — e o número já era meu
>
> Eu projetei isto esperando `429` da Edge Function. Veio outra coisa:
>
> ```
> Sem resposta: Busca ampla · games (Signal timed out.)
>             · Busca ampla · tecnologia e geek (Signal timed out.)
> ```
>
> **Não é recusa: é lentidão.** E o número que teria mostrado isso já estava
> medido, por mim, **antes** do clique:
>
> ```
> HTTP 429 · 444 bytes · 10,79 s
> HTTP 429 · 444 bytes · 12,34 s
> ```
>
> **Doze segundos para devolver um `429`** — a resposta mais barata que existe,
> que nem chega a consultar o índice. Eu olhei para o código de status e não
> olhei para o relógio. O `TIMEOUT_DO_FEED` de 10 s, dimensionado para RSS,
> nunca ia caber nem para o erro.
>
> **É o mesmo erro do `max_tokens`, na mesma sessão, com horas de diferença:**
> a resposta do fornecedor trazia o número que me corrigiria, e eu li só o
> pedaço que confirmava o que eu já pensava.
>
> **A terceira pergunta, e ela entra para valer:** depois de *"quantas vezes
> por dia?"* e *"quanto cabe de uma vez?"*, perguntar **"quanto TEMPO ela
> leva?"**. Serviço gratuito de terceiro costuma ser lento por projeto, não
> por acidente — e timeout herdado de outro serviço é um teto que ninguém
> escolheu.
>
> **O que mudou:** a GDELT ganhou timeout próprio de 20 s, e o teto por clique
> caiu de 2 para **1** — com 20 s cada, duas em série custariam 45 s de espera
> para quem clicou. A fonte que fica de fora é **dita** em `comFalha`.
>
> ### ⛔ `[01/10]` E com o timeout certo ela mostrou a resposta REAL: `429`
>
> O clique seguinte, já com 20 s:
>
> ```
> a GDELT recusou por excesso de consultas em 10s (limite dela, nao nosso)
> ```
>
> **O timeout era suficiente — ela responde em 10 s.** O que ela faz é
> **recusar**. E recusa na PRIMEIRA requisição, sem espaçamento nenhum
> envolvido: o orçamento de 1 req/5 s do IP já estava gasto antes de nós
> chegarmos.
>
> **Isso fecha a questão, e a hipótese do IP compartilhado vira conclusão
> prática:** cinco tentativas daqui (inclusive uma após 70 s de silêncio) e
> duas da Edge Function, com IPs diferentes. **Zero sucessos. Nenhum.**
>
> **`EdgeRuntime.waitUntil()` NÃO resolveria** — e eu tinha registrado isso
> como o próximo passo. O problema nunca foi tempo: é cota por IP. Mover para
> segundo plano dá mais relógio e **zero cota**. O gatilho que eu escrevi
> estava apontando para a saída errada.
>
> **As duas fontes foram DESLIGADAS** (`ativa = false`), porque uma fonte que
> falha em 100% dos cliques é a 4ª regra desta página na veia: alarme que
> sempre grita errado é pior do que alarme nenhum. Ela aparecia como "2 fontes
> não responderam" em toda busca, e a tela dizia "15 fontes" quando 13
> funcionam.
>
> **A lição sobre ESCOLHA de fornecedor, que é o que fica:** a auditoria
> escolheu a GDELT por ser *"grátis, sem chave, sem ação do dono"* — e os três
> eram verdade. O que não foi perguntado é **de que IP nós saímos**. Serviço
> com teto por IP é inutilizável atrás de infraestrutura compartilhada, e
> tanto este ambiente quanto a Edge Function da Supabase são compartilhados
> por construção. **"Sem chave" não é só conveniência: é o sintoma de que o
> fornecedor identifica você pelo IP, e aí o IP é a cota.**
>
> ### ✅ `[01/10]` O substituto entrou no MESMO dia, e sem uma linha de código
>
> Decisão dele depois do diagnóstico: **Google News RSS de busca**. Medido
> antes de ligar, com o NOSSO `lerFeed` rodando sobre o XML real — 100 itens
> no feed, 15 lidos, título/link/data corretos, **resposta em 1 segundo**.
>
> **Ele não entrou na tabela acima com um teto porque não observamos nenhum.**
> Isso não é o mesmo que "não tem": é o que foi medido. Se um dia ele recusar,
> cai em `comFalha` como qualquer feed, e a tela diz.
>
> **Zero código novo.** Ele é RSS, e o coletor de RSS existe desde a fundação
> do radar — as duas consultas entraram como `tipo = 'rss'` e caem no
> `Promise.all` dos feeds. A arquitetura da Fase 1, que despacha por `tipo`,
> se pagou aqui: trocar de fornecedor virou um `INSERT`.
>
> **O que ele cobra em troca**, e está aceito: o `<link>` de cada item é um
> redirecionador do Google, não o endereço do veículo. No navegador resolve;
> a URL que vai para as notas do rascunho, não. O título termina com
> `- <Veículo>`, então nenhuma fonte fica anônima.
>
> **E um defeito que ele revelou no NOSSO lado:** o `<description>` do Google
> News repete o título. Mandar os dois ao modelo custaria **duas vezes o mesmo
> fato** dentro do pedido cujo teto eu passei o dia apertando. O `lerFeed`
> passou a descartar resumo que só repete o título — regra **genérica** de
> qualidade de feed, não tratamento para um fornecedor, e os 13 feeds reais
> mantêm os resumos deles (medido: 15 de 15 em Canaltech, PC Gamer e
> GameSpot).
>
> ### ⚠️ `[01/10]` E o 1º clique com ele deu `HTTP 503` — causa ainda DESCONHECIDA
>
> ```
> Sem resposta: Busca ampla · tecnologia e geek (HTTP 503)
>             · Busca ampla · games (HTTP 503)
> ```
>
> **O que eu descartei, medindo:** não é o `User-Agent`. Daqui o Google News
> responde `200` em 1 s com **três** UAs diferentes — o nosso exato, nenhum, e
> um de navegador. Bom ter medido antes de "consertar" o que não estava
> quebrado.
>
> **O que eu NÃO sei, e um clique não decide:** se é instabilidade do serviço
> ou bloqueio do IP de datacenter da Edge Function. A segunda hipótese é a
> mesma classe da GDELT, e seria irônica — mas é hipótese (§1.1).
>
> **O que entrou, e vale independente da causa:** uma **retentativa** para
> `5xx`. Pela definição do HTTP, `5xx` é *"o servidor falhou, tente de novo"*,
> e nós desistíamos na primeira. **Só `5xx`:** repetir um `429` gasta mais da
> cota que o servidor acabou de dizer que esgotou — foi assim que a GDELT
> morreu —, e `403`/`404` são decisão deliberada que insistir não muda.
>
> **É UMA tentativa extra, não um laço.** Se as duas falharem, a fonte entra em
> `comFalha` dizendo *"HTTP 503 nas duas tentativas"* — e isso também é
> diagnóstico: duas falhas seguidas são evidência melhor do que uma. O próximo
> clique diz se era soluço ou se é bloqueio.
>
> ### ✅ `[01/10]` O clique seguinte respondeu: é INTERMITENTE, não bloqueio
>
> E eu quase errei a conclusão. O clique deu `503 nas duas tentativas` nas duas
> fontes, e o gatilho que eu mesmo tinha escrito dizia *"se der 503 nas duas de
> novo, a conclusão vira bloqueio"*. **Eu desliguei as duas fontes.**
>
> Antes de escrever a decisão, conferi no banco — e a tabela desmentiu:
>
> ```
> Busca ampla · games              15 itens  ·  coletados 19:21 UTC
> Busca ampla · tecnologia e geek  15 itens  ·  coletados 19:21 UTC
> ```
>
> **Elas FUNCIONARAM** num clique anterior que eu não tinha visto. `503` às
> 20:58 e `200` às 19:21 do mesmo dia, do mesmo IP: isso é instabilidade, não
> bloqueio. **As duas foram religadas**, e a retentativa de `5xx` é exatamente
> a resposta certa para esse padrão.
>
> **A lição é sobre o gatilho, não sobre o Google.** Eu escrevi um gatilho que
> olhava só o SINTOMA ("deu 503 duas vezes?") e não o HISTÓRICO ("alguma vez
> funcionou?"). Gatilho que decide por uma amostra decide errado quando o
> fenômeno é intermitente — e `news_items_raw` tinha a resposta o tempo todo,
> porque **item coletado é prova de sucesso que sobrevive ao clique**.

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
