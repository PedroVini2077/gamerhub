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
