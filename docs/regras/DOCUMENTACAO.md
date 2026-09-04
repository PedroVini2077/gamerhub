<!--
  Este arquivo é PARTE do `CLAUDE.md` — ele é puxado por `@import` e vale
  exatamente como se estivesse escrito lá dentro. Não é documentação do
  produto: é instrução de trabalho.

  Saiu do CLAUDE.md em 28/08/2026, quando o arquivo passou de 1.500 linhas e
  quatro seções estouraram o limite de ~150 do §6.2. A regra que manda dividir
  documento grande é do próprio arquivo; ele estava desobedecendo a si mesmo.

  Ao editar: as referências cruzadas (§1.3, §6.2…) continuam apontando para a
  numeração original, que não mudou. Nada foi reescrito na mudança — só movido.
-->

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
| `docs/DESEMPENHO.md` | **O histórico das medições** e o que cada uma desmentiu | O portão de bytes, que é operação |
| `docs/MODERACAO-IA.md` | A moderação por IA de mídia: política por categoria, limiares e as medições que os produziram | Moderação humana |
| `docs/PAINEIS.md` | O que **a equipe** opera: painéis, banimento, config, trilha | O que o usuário comum vê |
| `docs/PRIVACIDADE.md` | O que o site coleta **de verdade**, medido na implementação | Promessa não verificada |
| `docs/VISAO-DE-FUTURO.md` | **Onde o produto pode chegar** — possibilidades, sem data e sem compromisso, com a menor versão de cada uma | Fila, prazo, especificação |
| `docs/DECISOES.md` | O que foi decidido e **descartado** no PRODUTO, com data e motivo | Item a fazer |
| `docs/DECISOES-FERRAMENTAL.md` | O mesmo, para a **esteira**: CI, Vercel, Sentry, email | Decisão de produto |
| `docs/MANIFESTO.md` | Como o dono e o Claude trabalham **juntos** — papéis, continuidade | Regra executável (vai no `CLAUDE.md`) |
| `docs/regras/*.md` | Partes do `CLAUDE.md` puxadas por `@import` — instrução de trabalho | Documentação do produto |
| `docs/regras/EXECUCAO.md` | **Como executar** (`[03/09]`): sequência antes de mexer em arquivo, classificação da tarefa, território como recorte de contexto, e o que fazer ao perder o fio | Regra sobre o produto |
| `supabase/*/README.md` | Como publicar Edge Function e versionar migration | Comportamento do site |
| `BACKLOG.md` | **DOIS trabalhos** (`[03/09]`): a fila do que falta, e a seção **EM EXECUÇÃO**, que é a memória operacional da tarefa em curso | Decisão, histórico, item já feito, pensamento solto |
| `db/AAAA-MM-DD-*.md` | Relatório de auditoria: o que foi achado e como foi provado. **Retrato de um dia — deve envelhecer**, e o varredor o ignora de propósito | Estado atual do sistema |

> **`[02/09]` Esta tabela listava 11 dos <!--n:docs.arquivos-->27<!--/n-->
> documentos.** Os que faltavam não eram menores — eram `PRIVACIDADE.md`,
> `PAINEIS.md` e os próprios `docs/regras/`, que são regra executável. Tabela de
> "onde cada coisa mora" incompleta é pior do que tabela nenhuma: ela responde
> com autoridade e manda a informação para o lugar errado, que foi como uma
> medição foi parar no `FUNCIONALIDADES.md` em 29/08.

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

### `[01/09]` TUDO entra no backlog — inclusive o que ainda nem começou

> Ordem do dono em 01/09: *"tudo oq vamos fazer e realizar, tanto de auditoria
> como features, bugs e etc, devem ser colocados no backlog e verificados a todo
> momento"*, com a ressalva dele mesmo: *"óbvio que vc deve filtrar"*.

**O que mudou.** A regra antiga mandava atualizar o backlog *"se resolveu ou
descobriu pendência"* — ou seja, **depois**. Por isso quatro pedidos dele
(o raio sumindo ao voltar à viewport, o áudio ambiente, os elementos flutuantes
e a auditoria de LGPD) ficaram vivendo só na conversa: nenhum tinha sido
resolvido nem descoberto por mim, então nenhum se encaixava no gatilho da regra.

**A regra agora:** pedido recebido é item escrito, **antes** de começar. O
momento de registrar é quando ele chega, não quando termina.

**O filtro, porque "tudo" sem filtro vira lista ilegível:**

| Entra no backlog | Não entra |
| --- | --- |
| feature, bug, auditoria, decisão pendente | passo intermediário do que já está em execução |
| achado que eu decidi não tratar agora | correção trivial que já vai no mesmo PR |
| o que depende do dono ou de outra sessão | conversa sobre algo que já é item |

**Por que uma regra a mais não bastava, e o que entrou junto.** A regra de
manter o backlog já existia e não impediu a falha — porque nada punha a fila na
minha frente. O `scripts/inicio-de-sessao.sh` passou a listar os itens 🔴 e 🟠
por extenso a cada sessão, em vez de só o número. Um contador não se confere;
uma lista, sim.

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

### `[28/08]` TODOS os documentos têm que estar atualizados — as três camadas

> Ordem direta do dono, depois de encontrar documentação velha três vezes numa
> sessão: *"não queira ver mais vacilos daqui pra frente... **TODOS OS
> DOCUMENTOS DEVEM ESTAR ATUALIZADOS**... nem que vc precise de um gatilho pra
> lembrar e ver o que está desatualizado"*.

**Por que a trava acima não bastou.** Ela garante que **algum** documento foi
tocado no PR — não que o documento **certo** continua verdadeiro. Os três casos
de 28/08 passaram por ela sem esforço:

| O que estava escrito | O que era verdade |
| --- | --- |
| `BACKLOG.md`: "reescrever **ou aposentar** a cena 3D" | o dono já tinha recusado o descarte, duas vezes |
| `DECISOES.md`: `effectiveType` como portão ativo | removido **horas antes**, no mesmo dia |
| `SEGURANCA.md`: `register_login_attempt` aberta a `anon` | a função **não existe mais** no banco |

O padrão nunca variou: **eu escrevo de memória do que o projeto era, em vez de
abrir o arquivo antes de alterá-lo.** É o §1.4 — *documento envelhece, o sistema
não mente* — aplicado à documentação. E quem envelhece o documento sou eu,
quando não releio.

**1. O portão** — `scripts/documentacao-quebrada.mjs`, roda no CI e **reprova**.
Nenhum documento pode citar arquivo que não existe. É determinístico: o arquivo
está lá ou não está, sem julgamento no meio. Pega renomeação e apagamento, que
é a forma mais comum de documento apodrecer.

**2. O relatório** — `scripts/documentacao-envelhecida.mjs`, roda todo dia 1º e
**abre issue**, sem reprovar nada. Ele cruza cada documento com os caminhos de
código que descreve (o mapa `TERRITORIO`) e aponta os que ficaram para trás.
É **indício, não veredito** — por isso issue e não build vermelho. Portão que
grita por indício vira ruído, e ruído ensina a ignorar o canal (§0.2, 4ª regra).
Documento novo sem entrada no mapa é reportado como não mapeado, senão o
próprio mapa envelheceria em silêncio.

**3. Reler antes de escrever** — a camada que nenhum script cobre, e a que
falhou nos três casos acima. **Proibido editar trecho de documento estrutural
sem abrir a seção alvo primeiro.** Não vale "eu lembro o que está lá": foi
exatamente esse lembrar que produziu os três. Na prática:

- vou mexer numa seção → **leio a seção inteira** antes de propor a mudança;
- a seção afirma algo sobre o sistema → **confiro na fonte** (§1.4): banco,
  `pg_proc`, o arquivo, o teste. Nunca na minha memória;
- achei divergência → **corrijo e digo qual era**, com a evidência. Conserto de
  informação errada é uma das duas exceções que dispensam proposta (§6.2), mas
  **não** dispensa avisar.

> As três se complementam de propósito e nenhuma substitui a outra. A 1 pega o
> arquivo que sumiu; a 2 aponta onde olhar; a 3 é a única que pega texto que
> ficou falso sem nada ter sumido — que foi o caso do `effectiveType`.

### `[02/09]` A camada 3 falhou de novo, e por isso virou máquina em duas frentes

> Cobrança do dono: *"estou percebendo que vc está dando muita bola fora…
> **toda a documentação do projeto, não falo algumas, todas!** todas devem estar
> atualizadas, e em uma única sessão… não estou pagando o Claude Pro pra vc
> ficar vacilando desse jeito"*.

**Ele está certo, e o diagnóstico é que a camada 3 é a única sem máquina.** As
camadas 1 e 2 são scripts; a 3 é "reler antes de escrever", que depende de mim
lembrar — e foi ela que falhou nos três casos de 28/08 e de novo em 02/09,
quando o `AUDITORIA.md` afirmava *"131 arquivos / 14.362 linhas"* num projeto
que tinha **dobrado**.

**Os três portões existentes aprovaram aquilo**, cada um por um motivo
diferente — o que mostra que não era descuido de nenhum, e sim uma pergunta que
ninguém fazia. Os três olham **nome de arquivo**; nenhum lê o que o texto
**afirma**.

Duas partes da camada 3 são mecanizáveis, e viraram portão:

| Mecanismo | Pergunta | Reprova? |
| --- | --- | --- |
| `scripts/numeros-do-projeto.mjs` (`npm run numeros`) | **o número escrito bate com o projeto?** | **sim**, no CI |
| `scripts/territorio-coberto.mjs` | **toda parte do sistema tem documento responsável?** | **sim**, no CI |
| `scripts/documentacao-a-revisar.mjs` (`npm run docs`) | **que documento ESTA sessão tornou suspeito?** | não — é lista de leitura |

**O número deixa de ser digitado.** O documento escreve o valor dentro de um
comentário HTML — `<!--n:src.arquivos-->314<!--/n-->` —, invisível no markdown
renderizado. O script mede e reescreve; o CI confere. **Chave desconhecida é
erro, não silêncio**: um typo faria aquele número nunca mais ser atualizado, com
o agravante de parecer vigiado.

**Marcador explícito, e não varredura de "N linhas"**, porque o histórico
legítimo — *"918 → 197 linhas"* — precisa continuar congelado. Portão que grita
no lugar certo pelo motivo errado vira ruído (§0.2, 4ª regra).

**A cobertura de território fecha o buraco do próprio mapa.** O relatório mensal
só enxerga o que está no mapa, e o mapa é escrito à mão: pasta fora dele não
fica "atrasada", fica **invisível**, e aí o verde passa a significar "não olhei
ali". Foi o caso de `src/components/privacidade/` — onde mora o texto da
política —, que não tinha dono nenhum quando o PR #140 reescreveu o bloco de
retenção. Na primeira execução ele achou ainda **três caminhos mortos**, um
deles apagado desde o PR #105, deixando o `DESEMPENHO.md` meio vigiado.

### O que continua sendo leitura humana — e como ela deixou de ser cega

Nenhum portão responde *"este parágrafo em português ainda é verdade?"*. Fingir
que responde seria pior do que não ter portão (§6.3).

O que mudou é o **custo** dessa leitura. Mandar reler
<!--n:docs.linhas-->10.348<!--/n--> linhas por precaução a cada sessão consome
contexto que deveria ir para o trabalho (§0.1) — e regra cara demais é regra que
deixa de ser cumprida, que é como a camada 3 falhou quatro vezes. `npm run docs`
cruza o que a sessão mexeu com o mapa de territórios e devolve **quais** abrir e
**o que mudou embaixo de cada um**. `npm run docs -- --tudo` lista os
<!--n:docs.arquivos-->27<!--/n--> por idade, para varredura completa.

**A regra prática, e ela é curta:** rodar `npm run docs` **antes de fechar
qualquer bloco de trabalho**, e abrir o que ele apontar. Um documento marcado
`NAO TOCADO` não está necessariamente errado — está **não conferido**, que é
exatamente o estado em que os erros de 28/08 e 02/09 sobreviveram.

---
