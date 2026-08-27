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

## 1. Postura (as regras que valem acima de tudo)

### 1.1 Sinceridade — sempre, em tudo

- **Nunca dizer que algo foi verificado se não foi.** Separar sempre o que eu
  *testei* do que eu *suponho*. Se rodei um teste, dizer qual. Se não rodei,
  dizer "não testei isso".
- **Não inflar entrega.** Se corrigi 3 de 5 coisas, dizer 3 de 5 — e quais 2
  ficaram, por quê. Nada de esconder o que faltou no meio de um resumo bonito.
- **Admitir limite de conhecimento.** Se não sei se algo funciona (ex.: como o
  Realtime trata privilégio de coluna), dizer que não sei e ou testar, ou
  projetar de um jeito que não dependa da resposta.
- **Corrigir o dono quando ele estiver enganado sobre o diagnóstico.** Ele
  descreve o *sintoma* — o sintoma é sempre verdadeiro, a *causa* que ele supõe
  pode não ser. Investigar a causa real e explicar a diferença com clareza, sem
  rodeio e sem constrangimento. Exemplo real: "o site conta email que não
  existe como cadastrado" — o sintoma era real, mas a causa não era contagem
  errada, era o trigger criar o perfil antes da confirmação.
- **Se eu quebrei algo, falo primeiro.** Antes que ele descubra.
- **Nada de "provavelmente funciona".** Ou funciona e eu provei, ou eu digo que
  não validei.

#### Fato, inferência e hipótese são três coisas diferentes

> Esta é a regra mais nova e a que eu mais violei. Em 23/08 eu afirmei duas
> coisas como fato e as duas eram dedução minha: *"não há provedor de reserva
> na moderação"* (havia um `viaHuggingFace()` vivo no código, que eu não tinha
> aberto) e *"são webhooks duplicados"* (era hipótese, e estava errada). Eu
> mesmo tive que corrigir as duas depois. Nenhuma foi mentira — foram
> inferências vestidas de fato.

| Nível | O que é | Como eu falo |
| --- | --- | --- |
| **Fato** | observei direto: rodei a consulta, li o arquivo, o teste passou, o `curl` respondeu | afirmo, e digo **onde** vi |
| **Inferência** | conclusão a partir de evidência, sem ter olhado o alvo | "pelo que vi em X, **deduzo** que Y" |
| **Hipótese** | possibilidade que ainda não tem evidência | "**hipótese:** Y. Para confirmar, basta olhar Z" |

**Toda hipótese vem com o teste que a confirma.** Hipótese sem próximo passo é
opinião ocupando espaço de investigação.

**Ausência de evidência não é evidência de ausência — nos dois sentidos.** Não
achei brecha ≠ é seguro. Não achei prova de que é seguro ≠ é vulnerável.
Quando faltar evidência, o certo é dizer três coisas: **o que verifiquei, o que
não consegui verificar, e qual evidência resolveria**.

**Quando o documento e o código discordarem, nenhum dos dois ganha por padrão**
(§1.4). Procuro a evidência que executa — banco, migration, RLS, teste,
comportamento observável — e registro a inconsistência.

### 1.2 Diagnosticar antes de consertar — matar o bug na 1ª ou 2ª tentativa

O dono já perdeu sessões inteiras com correção por tentativa e erro. Isso
acontece quando eu **chuto a causa** em vez de encontrá-la. Proibido chutar.

**O método, em ordem, sem pular etapa:**

1. **Reproduzir.** Antes de tocar em qualquer código, provar que o bug existe,
   com um teste/consulta que falha. Se não consigo reproduzir, ainda não
   entendi o problema — e mexer no código nesse estado é chute.
2. **Localizar a causa raiz**, não o sintoma. Perguntar "por que?" até chegar
   no mecanismo. "O painel não oculta o comentário" → por quê? → o update
   afeta 0 linhas → por quê? → não existe policy de UPDATE → **essa** é a causa.
3. **Explicar o mecanismo** antes de corrigir. Se não consigo explicar em uma
   frase por que o bug acontece, não entendi ainda.
4. **Corrigir a causa**, uma coisa de cada vez. Nunca mudar 3 coisas na
   esperança de que uma resolva — isso é chute com passos extras, e destrói a
   informação de qual delas era o problema.
5. **Provar que morreu:** o teste que falhava agora passa.
6. **Provar que não quebrei nada:** rodar os caminhos vizinhos que dependiam do
   comportamento antigo.

**Sinais de que estou chutando** (parar imediatamente e voltar ao passo 1):
- "vou tentar mudar isso e ver se resolve"
- mexer em algo sem saber explicar como aquilo causaria o sintoma
- a mesma área falhar 2× seguidas com correções diferentes
- justificar com "deve ser cache/timing/coisa do navegador" sem evidência

**Se depois de 2 tentativas o bug continuar vivo:** parar de tentar consertar.
Voltar e instrumentar — logar valores reais, rodar a consulta isolada, testar a
hipótese diretamente. Relatar ao dono o que já foi descartado e com que
evidência. Insistir no escuro é o que consome sessão.

**Ao entregar um fix, dizer sempre:** qual era a causa raiz, como provei que era
ela, e como provei que morreu.

### 1.3 Segurança proativa

> IA que desenvolve sozinha tem fama de deixar brecha. O dono não quer que o
> GamerHub seja mais um caso desses.

- **Nunca entregar só "funciona".** Antes de dar qualquer coisa por pronta —
  feature, fix, refactor, mudança de banco — pensar ativamente em como aquilo
  pode ser abusado: dado forjado, RLS que não cobre um caminho, RPC chamável
  por quem não devia, input sem validação, condição de corrida, edge case de
  permissão (dono da linha × admin × owner), enumeração de dados.
- **Brecha que só vira problema amanhã se fecha hoje.** Base pequena não é
  desculpa. Se o código fica em produção, o buraco fica junto. Achou algo que
  "não quebrou ainda" por sorte ou baixo volume? Corrigir igual.
- **Desconfiar de proteção acidental.** Se algo só está seguro por efeito
  colateral de outra regra, isso não é proteção — é sorte esperando expirar.
  Caso real: o autor podia alterar `hidden_at` do próprio post, e só não
  conseguia porque a policy de SELECT escondia o post moderado dele. Bastava
  alguém adicionar um "seu post foi ocultado" na UI pra abrir o bypass.
- **Validação no cliente não vale nada sozinha.** O site usa a `anon key`:
  qualquer pessoa chama a REST API direto e pula o frontend inteiro. Toda regra
  precisa existir também no banco (RLS, CHECK, trigger, ou RPC com checagem).
- Na dúvida entre brecha real e paranoia, **tratar como brecha** e registrar a
  decisão — corrigida, ou por que foi considerada segura. Nunca deixar em
  silêncio.

#### Todo achado de segurança vem com severidade, impacto e solução

Dizer "isso é grave" não ajuda a priorizar. A escala:

| | Quando | Exemplo real deste projeto |
| --- | --- | --- |
| 🔴 **Crítico** | explorável de fora, sem conta, e derruba ou compromete o site | `send-email` aceitando chamada de qualquer um — dava para queimar a cota do Gmail e travar o cadastro de todo mundo |
| 🟠 **Alto** | explorável por quem tem conta, ou consome recurso compartilhado | `moderate-links` com porta decorativa: qualquer token passava e queimava a cota do Safe Browsing |
| 🟡 **Médio** | precisa de condição incomum, ou o estrago é contornável | `cleanup-expired-posts` aberta: idempotente, mas dava para martelar de fora |
| 🔵 **Baixo** | higiene, defesa em profundidade, risco teórico no volume atual | `token_hash` indo para o log da função |

Cada achado sai com as três: **risco** (o que dá para fazer), **impacto** (o que
acontece se fizerem) e **solução** (o que fecha). Sem impacto não dá para
decidir; sem solução é só susto.

**Nunca escrever "está seguro" sem evidência que sustente.** O certo é dizer o
que foi verificado e como — "testei o ataque X e recebi 401" vale; "revisei e
parece ok" não é garantia, é impressão. Ver o quadro de fato/inferência/hipótese
no §1.1.

**Investigação de segurança é estática ou em ambiente seguro.** Nunca proponho
teste destrutivo em produção. Quando precisei reproduzir uma brecha de verdade,
usei o endereço de teste do próprio dono e uma requisição sem efeito colateral —
e avisei antes.

#### Como achar ANTES — o que já custou caro aqui

Três correções de segurança legítimas derrubaram o site em silêncio. Nenhuma
foi descuido na hora de escrever: foi **não perguntar quem dependia daquilo**.

| O que foi feito | O que quebrou junto |
| --- | --- |
| Revogar colunas de `profiles` (LGPD) | As policies de INSERT liam `suspended_until` → **postar, comentar, mural e chat pararam** |
| Apagar policies amplas de SELECT no storage | A API perdeu a leitura de buckets e da própria pasta → **upload de foto parou** |
| Escrever lista de papéis à mão | 14 policies esqueceram `owner` → **o fundador não encerrava live nem silenciava** |

**Antes de revogar, apagar ou restringir qualquer coisa, procurar quem lê:**

```sql
-- quem depende da COLUNA que vou revogar
select tablename, policyname from pg_policies
 where coalesce(qual,'')||coalesce(with_check,'') ilike '%coluna%';
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and prosrc ilike '%coluna%';

-- triggers SECURITY INVOKER (rodam com o privilégio de QUEM CHAMA)
select t.tgname, p.proname, p.prosecdef from pg_trigger t
  join pg_proc p on p.oid=t.tgfoid
 where not t.tgisinternal and p.prosrc ilike '%tabela%';
```

**Varredura de classe, não de caso.** Ao achar um bug, perguntar sempre: *"onde
mais esse mesmo padrão existe?"*. Achar `owner` faltando numa policy e corrigir
só ela deixa 13 iguais no site. A consulta que achou as 14:

```sql
select tablename, policyname from pg_policies
 where coalesce(qual,'')||coalesce(with_check,'') ilike '%super_admin%'
   and coalesce(qual,'')||coalesce(with_check,'') not ilike '%owner%';
```

**Hierarquia nunca se escreve à mão.** Existe `role_rank()`, `is_staff()` e
`is_super()`. Lista literal `ARRAY['admin','super_admin']` é bug esperando
acontecer — foi assim três vezes.

**Erro que a RLS engole.** `UPDATE`/`DELETE` negado pela RLS devolve **0 linhas
e nenhum erro**. Toda escrita que pode ser negada usa `count: 'exact'` e trata
0 como falha — no service E no chamador. Sem isso a tela mente ("Live
encerrada" com a live no ar).

---

### 1.4 Não confiar só no que está escrito

`CLAUDE.md` e `BACKLOG.md` são memória do projeto, não a verdade sobre ele. Já
me enganaram: o backlog dizia "projeto pausado" (estava ativo), "~30 funções"
(eram 73), "Admin.jsx com 900 linhas" (eram 647), "adiar `pg_net` por risco"
(a operação nem era possível). **Documento envelhece; o sistema não mente.**

Antes de afirmar qualquer coisa sobre o estado do projeto, olhar a fonte:

| Pergunta | Onde está a verdade |
| --- | --- |
| O banco está assim mesmo? | consulta ao Supabase, não o backlog |
| Essa função ainda existe/faz isso? | `pg_proc.prosrc`, não a documentação |
| Quando isso quebrou? | `git log -S'trecho'` — acha o commit que introduziu |
| O que essa mudança tocou? | `git show <sha>`, `git log --oneline -- <arquivo>` |
| Isso é regressão minha ou antiga? | `git log` + reproduzir na versão anterior |

**Testar também o que é antigo.** A tendência natural é testar só o que mexi
nesta sessão — e foi justamente aí que os bugs escaparam: eles vieram de
sessões *anteriores* e ninguém voltou. Ao investigar uma falha, subir na
história:

```bash
git log --oneline -20                    # o que entrou recentemente
git log --oneline -- src/caminho.jsx     # história daquele arquivo
git log -S'texto_que_sumiu' --oneline    # quando esse trecho apareceu/saiu
git show <sha> --stat                    # o que aquele commit tocou
```

**Nada de descartar mudança antiga por ser antiga.** Se a suspeita apontar para
algo de três sessões atrás, ir lá. A idade do commit não o inocenta.

**Usar todas as ferramentas, não só as duas.** MCP do Supabase (estado real),
navegador (Playwright — o site de verdade), API HTTP (`curl` nas Edge Functions
e no PostgREST), `git`, histórico de PRs no GitHub. Quando duas fontes
discordam, vence a que **executa**.

---

### 1.5 Falha tem que GRITAR

> Regra irmã de "nunca engolir erro" (§4), mas mais forte e mais ampla. Aquela
> diz *não descarte o erro*. Esta diz: **se algo quebrar, alguém tem que ficar
> sabendo — sem depender de o dono clicar e reparar.**

**Por que esta regra existe.** Na rodada de 22–23/08 foram 11 achados. Quatro
falhavam em **silêncio absoluto**: nada estourava, nada aparecia na tela, nada
ia pro log que alguém lê, nenhum teste quebrava. Só foram encontrados porque o
dono estava clicando no site. O pior deles — a moderação por IA — estava
quebrado em **26 de 26 chamadas**, por semanas, detectando corretamente e nunca
aplicando nada.

**O sistema não estava com defeito de detecção. Estava mudo.**

#### As sete fontes de silêncio deste projeto

Cada uma já causou bug real aqui. Ao escrever ou revisar código, procurar as sete:

| # | Fonte de silêncio | O caso real |
| --- | --- | --- |
| 1 | **Fire-and-forget** — resposta descartada por design | `moderateText` disparava e ignorava; a RPC devolvia `permission denied` num `console.error` que ninguém lê |
| 2 | **0 linhas afetadas** sem erro | RLS negando `UPDATE`/`DELETE`; e o inverso — 0 linhas porque a linha *já não existe*, reportado como "sem permissão" |
| 3 | **Trigger-guarda que reverte** | o `owner` deu `UPDATE` pra tirar suspensão, o comando **passou sem erro**, e o guarda reverteu por baixo |
| 4 | **Assinatura de realtime em tabela não publicada** | canal conecta, `subscribe()` responde `SUBSCRIBED`, e **nenhum evento chega, para sempre** |
| 5 | **Fallback silencioso** (§4) | `else → community_posts` mandava item de `chat` pra tabela errada; erro descartado; tela em "Carregando..." eterno |
| 6 | **Cobertura que não cobre** | a lista de palavras casava só a flexão exata; `otário` não pegava `otários` e nada acusava |
| 7 | **Erro só no `console.error`** | serve pra depurar, **não é tratamento**. Ninguém abre o console do servidor de produção por diversão |

#### O que fazer — regras concretas

- **Fire-and-forget devolve estado no corpo da resposta.** Se a função não pode
  bloquear o usuário, tudo bem — mas o resultado tem que ser inspecionável por
  quem for testar. `status: "ok"` × `status: "rpc_error"` com a mensagem junto.
  Foi essa mudança que tornaria o bug da IA visível em 1 minuto em vez de semanas.
- **0 linhas é AMBÍGUO — desambiguar sempre.** São dois casos com tratamentos
  opostos: *negado pela RLS* (erro real, avisar) e *a linha já não existe*
  (objetivo atingido, seguir). Quando a diferença importa, fazer o `SELECT` de
  conferência antes de dar a mensagem. Mensagem errada gasta mais tempo do dono
  do que mensagem nenhuma.
- **Escrita que "passa" mas não muda nada é falha.** Se existe trigger-guarda
  sobre a coluna, conferir o valor **depois** — ou usar a RPC própria. `UPDATE`
  sem erro **não** prova que mudou.
- **Configuração que pode silenciosamente nunca funcionar precisa de teste de
  contrato.** Assinatura de realtime, mapa de tipos, lista de actions, papéis.
  Ver §6 FASE 4 e a §2.
- **`console.error` sozinho nunca conta como tratamento.** Ou vai pra tela do
  usuário, ou vai pro corpo da resposta, ou dispara um teste. De preferência dois.
- **Toda mensagem de erro tem que ser verdadeira.** "Você não tem permissão"
  quando o motivo é outro é pior do que "erro desconhecido" — manda o dono
  investigar permissão por horas.

#### O teste dos três canais

Antes de dar qualquer coisa por pronta, responder:

> **Se isto quebrar amanhã de madrugada, sem ninguém olhando —
> (a) o que aparece pra quem está usando?
> (b) o que fica gravado onde alguém vai ver?
> (c) qual teste falha?**

Se as três respostas forem "nada", **não está pronto** — está apenas escrito.
Pelo menos uma tem que ser concreta, e em caminho crítico (auth, moderação,
pagamento, permissão) o certo é ter as três.

---

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

## 5. Trabalhando com o banco (Supabase MCP)

### O padrão de teste que funciona
Testar RLS de verdade exige **assumir o papel do usuário**, não rodar como
superusuário (que ignora RLS):

```sql
BEGIN;
-- (aplica a mudança que quero testar)

CREATE TEMP TABLE r(k text, v text);
GRANT INSERT, SELECT ON r TO authenticated, anon;   -- senão o papel não escreve nela

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<uuid-do-usuario>","role":"authenticated"}';

DO $$ BEGIN
  -- tentativa que DEVE falhar
  INSERT INTO ...;
  INSERT INTO r VALUES ('teste_x','FALHOU: conseguiu');
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('teste_x','OK: bloqueado');
END $$;

RESET role;
SELECT * FROM r ORDER BY k;   -- precisa ser o ÚLTIMO select
ROLLBACK;
```

**Gotchas que já custaram tempo:**
- `execute_sql` **só devolve o resultado do último `SELECT`** — juntar os
  veredictos numa tabela temporária e fazer um `SELECT` no fim.
- `\echo` e `PERFORM` fora de bloco plpgsql **não existem** ali; usar `DO $$`.
- Papel `authenticated` não escreve em temp table sem `GRANT` explícito.
- Um `EXCEPTION` no meio do bloco **aborta o resto do bloco** — testes
  independentes, cada um no seu `DO $$`.
- Contar linhas de tabela protegida por RLS **enquanto assume um papel sem
  acesso** dá 0 e parece que a feature quebrou. Verificar fora do papel.
- Em função `SECURITY DEFINER`, `current_user` é o **dono da função**, não o
  papel do cliente — é o que faz os guards de trigger não bloquearem as RPCs.
- Trigger dispara **independente de `EXECUTE`**: o Postgres checa esse
  privilégio na criação do trigger, não a cada disparo.

### Regras
- Mudança de schema/função → `apply_migration` (fica no histórico), com nome
  em `snake_case` descritivo.
- Mudança destrutiva (DELETE, DROP, revoke amplo) → **dimensionar antes**
  (`SELECT count(*)`), testar em `ROLLBACK`, e confirmar com o dono se apaga
  dado de usuário.
- Comentar **no SQL** por que a mudança existe. O `CREATE OR REPLACE` sozinho
  não conta a história.
- Rodar `get_advisors` (security + performance) depois de mudar schema.
- Documentar auditoria/mudança grande em `db/AAAA-MM-DD-*.md`.

### Toda ação de estado precisa da INVERSA e da LIMPEZA

> Duas falhas da mesma família apareceram no mesmo dia: suspensão que não tinha
> como ser removida, e fila de moderação que ficava presa para sempre depois do
> ban. Nos dois casos alguém escreveu o caminho de ida e parou ali.

**Ao criar qualquer ação que muda estado, responder as três antes de entregar:**

1. **Qual é a inversa, e quem pode executá-la?**
   Suspender pede tirar. Ocultar pede restaurar. Banir pede desbanir. Promover
   pede rebaixar. Se a inversa não existe, o estado é **permanente** — e aí a
   ação inteira precisa de autorização à altura disso.
   *O caso real:* `apply_suspension` existia sem `lift_suspension`, e o
   trigger-guarda impedia até o `UPDATE` manual. Um `admin` (rank 2) conseguia
   silenciar alguém **para sempre**, e nem o `owner` desfazia — a suspensão
   virava um banimento permanente pulando toda a hierarquia do ban.

2. **Quem passa a apontar para o nada?**
   Ao apagar conteúdo, o que referenciava aquilo? Fila de moderação, denúncias,
   notificações, logs, mídia no storage. **Onde não dá pra ter FK, tem que ter
   trigger** — e `moderation_queue.content_id` aponta pra quatro tabelas
   diferentes, então FK ali é impossível por construção.
   *O caso real:* `ban_user` apagava os posts e deixava os itens da fila
   `pending` apontando para linhas mortas, sem jeito de sair da tela.

3. **Quem precisa ficar sabendo?**
   O alvo da ação, a equipe, e a trilha de auditoria. Ação de moderação que o
   alvo descobre sozinho (porque o post sumiu) é indistinguível de bug, do lado
   dele.

**Corrigir sempre pela CLASSE, não pelo caso.** A limpeza da fila não pertence
ao `ban_user` — pertence a *qualquer* caminho que apague conteúdo: o próprio
autor apagando, o admin apagando, exclusão de conta, cascade de FK, e os
caminhos que ainda não existem. Trigger `AFTER DELETE` na tabela cobre todos de
uma vez; consertar dentro do `ban_user` cobriria um.

### Toda entrada de RPC precisa de FAIXA, não só de tipo

`p_days integer` aceita `36500`. Foi assim que uma suspensão de "alguns dias"
virou suspensão até o ano **2126** — e como não havia inversa (acima), virou
banimento permanente.

**O tipo diz o formato; a faixa diz o que faz sentido.** Antes de qualquer
`UPDATE` dentro de uma RPC:

- **Número:** mínimo e máximo explícitos, com `RAISE EXCEPTION` claro e em
  português — a mensagem chega no toast do usuário.
  `IF p_days < 1 OR p_days > 30 THEN RAISE EXCEPTION 'Suspensao deve ser de 1 a 30 dias…'`
- **Texto:** tamanho máximo, e lista fechada quando for enum de fato.
- **UUID de alvo:** existe? é o próprio? tem cargo igual ou superior?
- **Nulo:** `p_days IS NULL` passa por `< 1`? Em SQL, **não** — `NULL < 1` é
  `NULL`, e o `IF` não dispara. Checar `IS NULL` explicitamente.

**O limite superior é decisão de produto, e tem que estar escrita.** "Mais que
30 dias é caso de banimento, que tem hierarquia própria e caminho de reversão"
— isso vai no comentário do SQL, não só na cabeça de quem escreveu.

**Validação no cliente não substitui isto** (§1.3): o site usa a `anon key`, e
o dropdown que só oferece 1 e 7 dias não impede ninguém de chamar a REST API
com 36500.

### Eu passo por cima de toda proteção, e por isso preciso de disciplina própria

O guard `guard_profile_privileged_cols` reverte `role`, `banned` e
`suspended_until` **só quando `current_user` é `authenticated` ou `anon`**.
Pelo MCP eu rodo como `postgres`: o guard não me alcança, e um `UPDATE` direto
passa. O mesmo vale para RLS, para os pisos de moderação e para a hierarquia
de cargos.

**Isso não é brecha do site.** É a diferença entre o que um navegador consegue
fazer (onde a segurança mora, e onde ela segurou) e o que a credencial mestra
do banco consegue fazer (que é o que aquela credencial *é*). O acesso é do
dono, delegado a mim.

**Mas cria um buraco de rastreabilidade que é meu para fechar.** Mudança de
schema fica no histórico (`apply_migration`) e mudança de código fica no PR.
**Mudança de dado por `execute_sql` não deixa nada** — nem no `admin_logs`,
nem no git. Some junto com a conversa.

As três regras:

1. **Mexer em cargo, ban ou suspensão vai pela RPC, nunca por `UPDATE` cru.**
   `owner_set_role`, `ban_user`, `unban_user`, `apply_suspension`,
   `lift_suspension` existem e gravam em `admin_logs`. Um `UPDATE` direto
   chega no mesmo lugar sem deixar rastro — e a trilha de auditoria do dono
   passa a mentir por omissão.
2. **Mudança de dado que não seja de teste é anunciada, com número.** Quantas
   linhas, quais, e por quê — antes de rodar (§5, dimensionar).
3. **Dado de teste que eu crio, eu apago na mesma sessão**, e digo que apaguei.
   Post, perfil, linha de fila. O que não dá para apagar (log já gravado) eu
   aponto.

Se algum dia isso precisar de trava de verdade e não de disciplina, o caminho
é conectar o MCP com um papel restrito em vez do dono. Hoje não dá: auditoria
e migration exigem esse nível. Registrado para quando deixar de exigir.

### Coisas específicas deste banco
- RLS por **linha**; privilégio por **coluna** é por **papel**. "Dono vê tudo do
  próprio, nada do alheio" não se expressa com nenhum dos dois sozinho — precisa
  de RPC `SECURITY DEFINER` (ver `get_own_profile`, `admin_list_users`,
  `get_public_profile`).
- Toda `SECURITY DEFINER` precisa de `SET search_path = public`. Sem isso, a
  resolução de nomes segue o `search_path` de quem chama — vetor clássico de
  escalada.
- Funções admin/owner: `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO
  authenticated`, **além** da checagem interna por `auth.uid()`.
- Não confiar em `posts.likes` — a coluna existe mas nenhum trigger a mantém.

---

## 6. Auditoria periódica (plano em 4 fases)

Quando o dono pedir "auditoria", "testes do site", "caçar bugs/brechas" ou
similar. **Uma fase por vez**, relatório ao fim de cada uma.

> Fases 1–3 olham cada camada por dentro. A **Fase 4** olha se elas concordam
> entre si — é a fase que pega o bug que não estoura em lugar nenhum.

> **Sobre aprovação:** o padrão é relatar e esperar antes de aplicar correções
> amplas. **Exceção:** falha de segurança explorável se fecha na hora (§1.3) —
> relatando junto o que foi feito. Refactor e mudança de comportamento sempre
> esperam aprovação.

### FASE 0 — Inventário (obrigatória, antes de qualquer fase)

Auditoria sem inventário vira amostragem disfarçada. Antes de começar, gerar a
**lista fechada de tudo que precisa ser olhado** e trabalhar em cima dela:

```bash
find src -name '*.jsx' -o -name '*.js' | xargs wc -l | sort -rn   # todo o código
```
```sql
-- toda a superfície do banco
select tablename from pg_tables where schemaname='public';
select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public';
select tablename, policyname, cmd from pg_policies where schemaname='public';
```

Anotar os totais (ex.: "131 arquivos / 14.362 linhas · 27 tabelas · 52 funções
`SECURITY DEFINER`"). **Esses números são a meta de cobertura** e vão no
relatório final como `lidos X de Y`.

### Cobertura: o padrão é LER TUDO

Este projeto tem ~14 mil linhas. **Isso é lível por inteiro** — não é grande o
bastante pra justificar amostragem. O padrão passa a ser:

- **Ler 100% do código** de `src/`, arquivo por arquivo, percorrendo a lista da
  Fase 0. Grep serve para *achar* rápido, **nunca** para substituir a leitura.
- **Ler 100% do corpo** das funções `SECURITY DEFINER`. Metadados (quem
  executa, tem `search_path`, checa role) provam **cobertura**, não
  **corretude**: 6 falhas reais já passaram por eles com os guards "certos" e
  erro no meio do código — `admin_unlock_login` que barrava o próprio fundador,
  `soft_delete_post` sem hierarquia, `total_xp` nunca preenchido.
- **Enumerar 100%** de tabelas, policies, FKs, índices e triggers.

Se por algum motivo não der pra ler tudo numa sessão, **registrar onde parei**
(no `BACKLOG.md`) e retomar dali — nunca declarar a fase concluída com leitura
parcial.

### Honestidade sobre o método

**Ao relatar, dizer qual método foi usado e o número real de cobertura** —
"li 131 de 131 arquivos" ou "li 40 de 131, parei em X". Nunca deixar parecer
que "olhei tudo" quando foi grep. Se a fase foi parcial, ela está **parcial**,
não concluída.

### Ao achar algo, CORRIGIR — não só listar

Auditoria que só produz lista não serve. Para cada achado:
1. **Reproduzir** (§1.2) — provar que existe, com teste que falha.
2. **Corrigir** de verdade, testando em `ROLLBACK` antes de produção.
3. **Reverificar** que morreu **e** que os caminhos vizinhos não quebraram.
4. Registrar no relatório: causa raiz, como provei, como validei.

Achado que eu decidir **não** corrigir agora vai pro `BACKLOG.md` com o motivo
explícito — nunca some em silêncio.

### FASE 1 — Frontend
- `npm run build` limpo · lint (0 erros) · testes verdes.
- Rules of Hooks (nenhum hook após early return/condicional).
- Memory leaks: subscription/timer/realtime sem cleanup.
- Race conditions: `useEffect` que busca dado com dep variável sem guarda de
  cancelamento (resposta velha sobrescrevendo a nova).
- Validação de input; estados de loading/erro cobertos.
- **Segurança:** `dangerouslySetInnerHTML`/`innerHTML`/`eval`; `href`/`src`
  vindos de dado de usuário; `target="_blank"` sem `rel`; checagem de permissão
  que só existe no cliente.
- Acessibilidade: botão só-ícone sem nome acessível.
- Emoji na UI; `window.confirm`/`prompt`.

### FASE 2 — Backend
- **Enumerar todas** as funções `SECURITY DEFINER` com: quem pode executar,
  tem `search_path`?, usa `auth.uid()`?, checa role?
- **Ler o corpo** de: (a) toda função sem checagem de identidade que seja
  chamável por `anon`/`authenticated`; (b) toda função que escreve em tabela de
  outro usuário; (c) toda função de moderação/permissão. Registrar quantas de
  quantas foram lidas.
- Validação de parâmetro (a função confia no que o cliente mandou?).
- Lógica de negócio: ban, bloqueio de login, XP, moderação.
- Tratamento de erro e risco de SQL injection (concatenação de string).

### FASE 3 — Banco
- RLS ligado em **todas** as tabelas; policy por comando (SELECT/INSERT/
  UPDATE/DELETE) — **tabela sem policy de UPDATE nega em silêncio**.
- Policy de SELECT que exponha dado sensível a `anon`/`authenticated`.
- Publicação realtime (`supabase_realtime`) e `REPLICA IDENTITY`.
- Índices em coluna filtrada/ordenada; FK sem índice de cobertura.
- Integridade: FK e regra de `ON DELETE` (um `NO ACTION` esquecido trava
  exclusão de conta).
- `get_advisors` security **e** performance.

### FASE 4 — Deriva entre o código e o banco

> A fase que faltava. As Fases 1, 2 e 3 olham cada lado **por dentro** e o
> encontram saudável. Esta olha se os dois **concordam entre si** — e foi de
> onde saíram três bugs em um único dia, todos invisíveis em runtime.

**Por que existe uma fase só pra isso.** O frontend estava correto. O banco
estava correto. O que estava errado era a *combinação*: o código assinava uma
tabela que a publicação não continha, mapeava tipos que o banco não produzia
mais sozinho, e casava palavras por uma regra diferente da do trigger. Ler
qualquer um dos dois lados isoladamente não revela nada.

**O sintoma característico:** nada estoura, nada loga, e a funcionalidade
simplesmente **não acontece**. Ver §1.5.

#### A varredura — confrontar código × banco, item a item

| O que confrontar | Como achar a deriva | O caso real |
| --- | --- | --- |
| **Assinaturas de realtime** × publicação `supabase_realtime` | listar `table: 'x'` e `useRealtime('x')` no código, cruzar com `pg_publication_tables` | `unban_requests` e `live_reactivation_requests` assinadas e nunca publicadas |
| **Mapas de tipo no JS** × valores que o banco realmente grava | ver o que os triggers/RPCs inserem em colunas de tipo (`content_type`, `trigger_type`, `action`) | `chat` chegou na fila e não existia em nenhum mapa |
| **Regras de casamento/validação duplicadas** | mesma decisão implementada nos dois lados (wordlist, bloqueio de login, hierarquia) | cliente casava palavra exata, banco passou a casar plural |
| **Listas de papéis escritas à mão** × `role_rank()`/`is_staff()`/`is_super()` | `grep` por `'admin'`, `'super_admin'`, `'owner'` literais | 14 policies sem `owner`, três vezes |
| **Privilégio de COLUNA** × o que a tela lê | `information_schema.column_privileges` vs os `select()` do código | colunas de `profiles` revogadas derrubaram post, comentário, mural e chat |
| **Actions gravadas pelo banco** × mapa de ícones do painel | `grep` em `prosrc` por `INSERT INTO admin_logs` | 14 actions sem ícone, invisíveis pro teste que só varria `src/` |
| **Funções de trigger expostas como RPC** | `get_advisors` → `anon_security_definer_function_executable` | `checar_palavras_bloqueadas` chamável via `/rest/v1/rpc/` |
| **Tabelas sem policy de UPDATE** × telas que fazem update | `pg_policies` sem `cmd IN ('UPDATE','ALL')` | moderação de comentário e mural quebrada por meses, em silêncio |

Consultas de apoio:

```sql
-- tabelas assinadas no código que NÃO estão publicadas
select tablename from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public';

-- tabela sem policy de UPDATE nega em silêncio
select t.tablename from pg_tables t where t.schemaname='public'
 and not exists (select 1 from pg_policies p where p.schemaname='public'
                  and p.tablename=t.tablename and p.cmd in ('UPDATE','ALL'));

-- coluna revogada que alguma policy/função ainda lê
select tablename, policyname from pg_policies
 where coalesce(qual,'')||coalesce(with_check,'') ilike '%coluna%';
```

```bash
# toda assinatura de realtime do código
grep -rn "table: '\|useRealtime('" src/ --include=*.js --include=*.jsx
```

#### A regra que fecha a fase

**Toda deriva encontrada vira teste de contrato (§2), não só correção.** Deriva
não é um bug pontual: é um par de lugares que precisa concordar para sempre, e
que vai divergir de novo na próxima mudança. Corrigir sem travar aqui é
garantir que a Fase 4 da próxima auditoria vai achar exatamente a mesma coisa.

---

## 6.1 FAXINA — bateria de otimização (obrigatória e automática)

> Pedido do dono: *"essa faxina que estamos fazendo — otimizando, caçando bugs,
> egress — é algo obrigatório, e tem que ser automático, como jogar fora lixo"*.

**Faxina ≠ auditoria.** A auditoria (§6) procura **falha**: brecha, bug, regra
que não cobre um caminho. A faxina procura **excesso e desperdício**: código
morto, duplicação, consulta cara, byte trafegado à toa. As duas são
obrigatórias e nenhuma substitui a outra.

**Quando roda, sem o dono pedir:**
- ao fechar um bloco de trabalho (antes do PR);
- quando eu mesmo esbarrar num item da lista, mesmo fazendo outra coisa (§0);
- por inteiro, quando o dono disser "faxina".

### A bateria

**1. Código morto e duplicado**
```bash
find src -name '*.jsx' -o -name '*.js' | xargs wc -l | sort -rn | head -15
```
- Arquivo > 300 linhas → dividir agora (§4).
- Função exportada sem nenhum call site → apagar. *(Cuidado: referência passada
  como valor — `queryFn: fn` — não é chamada; conferir antes de apagar.)*
- Mesma lógica/UI em 2+ lugares → extrair. Cópias divergem: já aconteceu com
  ícones de log, rótulos de cargo, cores de cargo e a regra de bloqueio de
  login.

**2. Egress — a cota mais apertada *do Supabase*** (não a mais apertada do
projeto: o teto de deploys da Vercel estourou primeiro — ver §0.2)
- Imagem sem compressão antes do upload (`lib/image.js`).
- `cacheControl` longo em arquivo de path único.
- `SELECT *` onde a tela usa 4 colunas.
- N+1: uma consulta por card em vez de uma em lote.
- Realtime assinando tabela de alto volume, ou `event:'*'` sem filtro. Custa
  por (mudanças × conexões) e só dói quando escala.

**3. Carregamento**
- Rota/asset pesado sem `lazy`.
- Componente caro montando fora da viewport (`LazyVisible`).
- Vídeo/mídia baixando sem clique.

**4. Memória e ciclo de vida**
- `createObjectURL` sem `revokeObjectURL` — segura o arquivo inteiro na RAM.
- `setInterval`/`setTimeout`/subscription sem cleanup.
- Efeito com deps que remontam canal de realtime a cada render.

**5. Banco**
```sql
select * from pg_stat_user_indexes where idx_scan = 0;  -- índice nunca usado
```
- FK sem índice de cobertura; coluna filtrada/ordenada sem índice.
- Tabela append-only sem retenção (`admin_logs`, `login_attempts`, `live_chat`).
- `get_advisors` (security **e** performance) depois de mexer em schema.

**6. Saúde do projeto**
```bash
npm audit            # 0 vulnerabilidades
npm run lint         # 0 erros; warnings não podem AUMENTAR
npx vitest run       # tudo verde
npm run build        # limpo
node e2e/smoke.mjs   # rotas de pé num navegador real
```

### Regras da faxina

- **Medir antes e depois.** "Otimizei" sem número é opinião. Dizer o antes → o
  depois: 918 → 197 linhas, 16 → 12 warnings, 8 → 0 vulnerabilidades.
- **Uma otimização por commit**, reversível.
- **Não trocar correção por maquiagem.** Suprimir warning com `disable` não é
  faxina — se for necessário, o motivo vai escrito ao lado no código e é dito
  ao dono que foi supressão, não conserto.
- **O que eu decidir NÃO otimizar vai pro `BACKLOG.md` com o motivo.**

---

## 6.2 Documentação — onde cada coisa mora, e por que isso é obrigatório

> Pedido direto do dono, depois de eu vacilar: *"o backlog precisa
> obrigatoriamente estar sempre atualizado… o readme é obrigatório que esteja
> sempre atualizado… separar em novas seções caso precise, e isso é obrigatório
> pra não haver poluição"*.

**Por que a regra existe, com número.** Em 23/08 o `BACKLOG.md` tinha 1.330
linhas, das quais **129 eram a lista** — 90% do arquivo não era backlog. E ele
listava **31 itens abertos, sendo que cinco já estavam feitos** e três
apareciam duplicados 2–3 vezes. O `README.md` tinha 1.087 linhas, e só ~140
respondiam "o que é isso e como rodo".

Não foi falta de regra: a §2 já mandava atualizar os dois. Foi o arquivo virar
um lugar onde as coisas **entram e nunca saem**.

### Cada arquivo tem UM trabalho

| Arquivo | O que é | O que NUNCA vai nele |
| --- | --- | --- |
| `README.md` | Porta de entrada: o que é, como rodar, mapa dos docs | Detalhe de implementação, tabela, RLS |
| `docs/ARQUITETURA.md` | Pastas, rotas, camada de dados, convenções | O que cada tela faz |
| `docs/FUNCIONALIDADES.md` | O que cada tela faz, do ponto de vista de quem usa | SQL, nome de função interna |
| `docs/MODERACAO.md` | O subsistema de moderação inteiro | — |
| `docs/BANCO.md` | Tabelas, RPCs, RLS, storage, realtime, custo | Como *usar* o site |
| `docs/SEGURANCA.md` | O que protege o quê | — |
| `docs/OPERACAO.md` | **Quando quebra.** Monitoramento, site fora do ar, CI | Feature |
| `docs/DECISOES.md` | O que foi decidido e **descartado**, com data e motivo | Item a fazer |
| `BACKLOG.md` | **Checklist.** Só o que falta | Decisão, histórico, item já feito |
| `db/AAAA-MM-DD-*.md` | Relatório de auditoria: o que foi achado e como foi provado | — |

### As cinco regras

1. **Mudou comportamento ou estrutura? A documentação muda no MESMO PR.** Não
   é "depois". Um PR que mexe em `src/`, `db/` ou nas Edge Functions e não toca
   documentação está incompleto — e o CI recusa (ver abaixo).
2. **Item concluído SAI do backlog.** Não vira ✅ e fica: sai. O PR, o `git log`
   e o `db/*.md` guardam o histórico. Backlog que acumula concluído deixa de ser
   legível, e legibilidade é a única função dele.
3. **Toda linha do backlog leva data `[DD/MM]`.** Sem data não dá para saber o
   que envelheceu, e foi assim que cinco itens mortos passaram despercebidos.
4. **Decisão não é backlog.** Se a resposta é "não vamos fazer isso, porque…",
   vai para `docs/DECISOES.md` com data. É o que impede a mesma discussão de
   voltar em dois meses e alguém "consertar" uma decisão proposital.
5. **Seção passou de ~150 linhas? Vira arquivo próprio.** Mesma lógica do
   split de código (§4): documento gigante é onde a informação desatualizada se
   esconde. Ao criar o arquivo, acrescentar na tabela do `README.md` — arquivo
   que ninguém acha é arquivo que ninguém atualiza.

### Contrato de Evolução — proposta antes de mexer em documento estrutural

Documento estrutural é: `CLAUDE.md`, `README.md`, `BACKLOG.md` e tudo em
`docs/`. Antes de alterar qualquer um deles, **apresento uma proposta** que
responde quatro perguntas:

1. **O que** será alterado.
2. **Por que** essa mudança faz sentido.
3. **Onde** ela entra.
4. **O que NÃO** será substituído.

Só depois da aprovação eu escrevo — no lugar mais adequado, preservando a
organização que já existe.

> **Adicionar é melhor do que substituir**, desde que não gere duplicação. Uma
> regra nova que repete uma que já existe não fortalece nada: cria duas fontes
> de verdade que vão divergir (§4, fonte única).

**Não altero documento estrutural só porque achei uma redação melhor.** A
alteração precisa de razão real: comportamento mudou, decisão nova, ou
informação que envelheceu.

**Duas exceções**, para o contrato não virar burocracia:

- **Manutenção rotineira que as regras já mandam fazer** não precisa de
  proposta nova: atualizar `BACKLOG.md` ao concluir ou descobrir item (§2),
  registrar decisão em `DECISOES.md`, e atualizar a documentação do que mudou
  **no mesmo PR** (§6.2 regra 1). O dono já aprovou isso quando essas regras
  entraram; pedir de novo a cada vez é atrito sem ganho.
- **Corrigir informação comprovadamente errada** é conserto de bug, não
  mudança de rumo — mas eu **digo** o que corrigi e com que evidência.

O que sempre pede proposta: mexer numa **regra**, remover conteúdo, mudar a
estrutura de um documento, ou criar documento novo.

### Antes de fechar qualquer bloco de trabalho

Reler **A FILA** do backlog inteira e marcar o que mudou. Não confiar na
memória do que estava lá: **conferir contra o sistema** (§1.4) — a extensão
ainda existe? a função ainda tem esse problema? `git log -S` mostra que já foi
feito? Foi essa conferência que achou os cinco itens mortos.

Se a lista passar de ~25 itens, é sinal de que precisa de outra conferência.

### A trava

Regra escrita não bastou — eu tinha a §2 e não segui. Por isso existe um passo
no CI que **falha o PR** quando ele mexe em `src/`, `db/` ou
`supabase/functions` e não toca em nenhum arquivo de documentação. Mesma
filosofia do piso de testes (§2): não depende da minha memória, depende do
portão.

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
