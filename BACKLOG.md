# 📋 Backlog

> **Isto é um checklist, não um diário.** Só o que falta fazer.
>
> - O que foi **decidido** ou **descartado** vai para [`docs/DECISOES.md`](docs/DECISOES.md).
> - O que já foi **feito sai daqui.** O PR, o `git log` e os relatórios em
>   `db/AAAA-MM-DD-*.md` guardam o histórico — repetir aqui só faz a lista
>   inchar até ninguém conseguir ler.
> - Toda linha leva **data** `[DD/MM]` de quando entrou. Sem data não dá para
>   ver o que envelheceu.
>
> Prioridade: 🔴 crítico · 🟠 importante · 🟢 recomendado · 🔵 futuro

> ### `[03/09]` E também é MEMÓRIA OPERACIONAL da execução
>
> Ordem do dono em 03/09: *"quero que o BACKLOG seja utilizado como memória
> operacional da execução… não dependa apenas do contexto da conversa para
> lembrar o que precisa ser feito"*.
>
> Isso dá ao arquivo um **segundo trabalho**, e ele é diferente do primeiro: a
> seção **EM EXECUÇÃO** abaixo guarda o plano da tarefa em curso — objetivo,
> etapas, estado, o que foi validado e o que travou. A fila de itens continua
> sendo o que falta fazer.
>
> A diferença prática: quando eu perder o fio, o certo é **voltar aqui**, não
> carregar mais contexto. Nas três falhas de 02–03/09 meu reflexo foi ler mais
> e tentar de novo — foi assim que passei de duas tentativas, testei
> desligando o que estava quebrado, e declarei entregue o que nunca saiu do
> lugar.
>
> **A seção EM EXECUÇÃO esvazia quando a tarefa fecha.** Ela é estado, não
> histórico — mesma regra do resto do arquivo.

---

## 🔄 EM EXECUÇÃO

### 🔄 `[25/09]` GAMERHUB NEWS — o plano, com a ordem decidida hoje

**Objetivo dele:** *"vamos tentar terminar esse GamerHub News ainda hj"*.

**O que já existe** (PR #246): 5 tabelas, RLS provada em ROLLBACK, `busca`
gerada com `portugues_sem_acento`. **Zero tela.**

| # | Etapa | Estado |
| --- | --- | --- |
| 1 | O corte editorial B no banco: `in_review` + publicar só `is_super()` | ✅ trigger, provado em ROLLBACK 8/8 |
| 2 | `is_owner()` nas oito (5 funções + 3 policies) | ✅ SEC-054 + SEC-054b |
| 3 | Service de leitura do News | ✅ `newsService.js`, sem RPC e sem `conteudo` na lista |
| 4 | `/news` (lista) e `/news/:slug` (artigo) — **só logado** | ✅ |
| 5 | O anúncio do News na LANDING | ⚠️ **PARCIAL** — ver abaixo |
| 6 | Painel editorial (criar, editar, enviar para revisão, publicar) | ✅ aba **News** do admin |
| 7 | Travas: vocabulário × banco, rota coberta por e2e | ✅ |

> **A etapa 5 ficou PELA METADE, e é honesto dizer por quê.** O News foi
> anunciado dentro da cena do feed na landing — uma frase, sem arte nova. O que
> ele merece é **cena própria**, como Feed, Mural, Lives, Keys e Ranks têm: cada
> uma tem arte dele e sobreposição própria.
>
> Eu **não** produzi essa arte de propósito. A decisão de 25/09 é clara: a arte
> é dele, a composição é minha — e as duas vezes em que eu tentei produzir arte
> (3D e ícones) foram descartadas. Fazer de novo seria gastar sessão para jogar
> fora.
>
> **O que eu preciso dele:** a arte da cena do News, no mesmo formato das
> outras 7. Aí a cena entra em `SECOES` e ganha `#news` na navegação e no rodapé.

> **`[25/09]` A etapa 6 ENTROU.** O News deixou de ser sala vazia: a equipe cria,
> escreve com o mesmo editor do post, manda para revisão, e super admin publica.
>
> **O que o News AINDA não tem**, e nenhuma destas é bloqueio para usá-lo:
>
> | Falta | Por que não entrou agora |
> | --- | --- |
> | **capa por upload** | hoje é URL colada. Upload exige bucket, policy e compressão (`lib/image.js`) — é um bloco próprio |
> | **agendamento pela tela** | o banco aceita `scheduled`, a tela não oferece. Sem um job que vire `scheduled` em `published`, agendar seria uma promessa que ninguém cumpre |
> | **ingestão automática** (`news_items_raw`) | a tabela existe e está fechada. É o bloco de coletar de fontes |
> | **paginação da lista** | teto de 30, dito na tela |

**Fora deste bloco, decididos hoje e enfileirados depois:** a RPC da wordlist,
o `pg_trgm`, a rota de publicar (botão "+"), e a fonte da landing.

**Risco que eu já enxergo:** a etapa 5 é de camada 1 (landing) e as outras são
camada 3. Pela §0.4 a landing vem antes — mas anunciar uma tela que ainda não
existe é pior do que não anunciar. Por isso ela vai **junto** com a 4, não antes.

---

### 🔵 `[25/09]` A wordlist inteira é legível por qualquer pessoa logada

Achado enquanto eu fechava a SEC-053. `blocked_words_select` é `USING (true)`:
qualquer conta lê as **322** palavras da lista de moderação pela REST API. Quem
tem a lista tem o mapa para contorná-la.

**Por que NÃO fechei junto, e não é preguiça.** O compositor, o mural, os
comentários e o chat leem essa lista **pelo cliente** (`useBlockedWords`) para
avisar a pessoa **antes** de ela enviar. Fechar a policy apagaria esse aviso —
e é exatamente a classe de conserto que já derrubou o site três vezes aqui
(revogar coluna de `profiles` parou post, comentário, mural e chat).

**O que muda de verdade se fechar:** nada passa a escapar da moderação — o
banco checa sozinho (`checar_palavras_bloqueadas`, e os triggers de post,
comentário e chat). O que se perde é o aviso amigável: a pessoa publica e o
conteúdo é ocultado/enfileirado depois, em vez de ela ser avisada na hora.

Isso é **decisão de produto**, não de segurança:

| Saída | Ganha | Perde |
| --- | --- | --- |
| **deixar como está** | aviso antes de enviar | a lista é pública para quem tem conta |
| **fechar a policy** | a lista vira segredo da equipe | o aviso some; a pessoa descobre depois |
| **RPC `SECURITY DEFINER` que responde só "este texto tem termo bloqueado?"** | os dois: aviso mantido, lista escondida | uma ida ao servidor por checagem — e é **exatamente** a conta do §0.2 regra 2 (quantas vezes por dia isso roda?) |

**Minha recomendação:** a terceira, **se e quando** a lista virar algo que
valha esconder. Hoje ela é lista de palavrão, não de estratégia — 🔵 de
propósito.

> ### ✅ `[25/09]` ELE DECIDIU: fazer a RPC
>
> *"Pode fazer tbm a rpc que só responde tem termo bloqueado"*. Ou seja: o aviso
> antes de enviar continua, e a lista deixa de ser legível por qualquer conta.
>
> **O que eu preciso resolver ao construir**, e é o §0.2 regra 2 (*quantas vezes
> por dia isso roda?*): hoje a checagem é local e custa zero — uma ida ao
> servidor por tecla digitada seria inaceitável. O desenho tem de ser
> **sob demanda** (ao enviar, ou com espera depois de parar de digitar), nunca
> a cada tecla.

---

### ✅ `[25/09]` DECIDIDO — o botão "+" abre uma ROTA PRÓPRIA, não um modal

Proposta dele em 25/09: *"acho que tá na hora de mudar a forma de postar algo...
pensei em limpar essa parte de cima do feed, e adicionar um botão +, tipo
Instagram e TikTok? Que abre uma parte específica pra edição, posts, vídeos, oq
vc acha?"*.

**Meu parecer: fazer, mas NÃO tirar tudo do topo.** O argumento a favor é
sólido e vai ficar mais forte: o compositor do topo é um custo que **todo mundo
que rola paga** por uma ação que **poucos fazem** — e ele só cresce. A barra de
ferramentas já o engordou; a prévia ao vivo engorda mais; vídeo, News e live não
cabem numa caixa só. Uma superfície dedicada tem espaço; o topo do feed não.

**O risco, e é real para ESTE site.** Compositor que precisa ser procurado é
usado menos. O Instagram aguenta isso porque postar lá é aspiracional; uma
comunidade nova, com o feed ainda magro, precisa do contrário — atrito baixo
para publicar importa mais do que primeira tela limpa.

**Por isso o meio-termo, que é o que Facebook e Reddit fazem:** o topo do feed
guarda **uma linha** ("No que você está pensando?") que **abre** o compositor
dedicado, em vez do compositor inteiro. O "+" na navegação vira a segunda porta,
para quem não está no feed. Custa uma linha em vez de um card, a descoberta
continua de graça, e o compositor ganha o espaço de que precisa.

> **`[25/09]` ELE DECIDIU: rota própria.** Palavras dele: *"o Instagram, quando
> vc clica pra criar um post ou reels, ele te leva a um lugar pra escolher
> alguma mídia... e depois vc pode editar as fotos e vídeos separadamente. Se
> fosse só um modal, ia continuar pequeno na minha opinião, então fazer algo a
> parte vai dar mais liberdade pra quem quer postar"*.
>
> Ele mesmo pôs o limite: *"eu sei que um site não dá pra colocar uma
> ferramenta inteira de edição, mas pelo menos fazer algo separado pra dar mais
> liberdade e criatividade"*. O alvo é **espaço para trabalhar**, não paridade
> com o Instagram.
>
> E disse a ordem: **vídeo curto vem DEPOIS do GamerHub News** — a rota tem de
> nascer com lugar para ele, sem construí-lo agora.
>
> **`[25/09]` E ele fechou a segunda parte: OS DOIS.** *"eu colocaria essa linha
> e acrescentaria o botão + visível em algum lugar tbm"*. O topo do feed guarda
> **uma linha** que abre a rota, e o **"+" fica visível** na navegação — duas
> portas para a mesma superfície, não duas superfícies.

**O que JÁ está decidido e não muda com isso:** o "+" não pode embarcar opção de
equipe no DOM de quem não é equipe (3º prompt dele, sobre permissão na tela).

---

### 🔵 `[25/09]` Revisitar WYSIWYG se o editor sair do caminho crítico

Hoje **não**: 331,4 kB brutos contra 7,1 kB ([DESEMPENHO.md](docs/DESEMPENHO.md),
[DECISOES.md](docs/DECISOES.md)). O gatilho para reabrir é o item acima: se o
compositor virar **rota própria**, ele sai do carregamento inicial, e aí o peso
deixa de ser pago por quem só passa no feed. A objeção de colagem de HTML
continua de pé e teria de ser resolvida à parte.

---

### ⬜ `[19/09]` REORGANIZAÇÃO DOCUMENTAL — Fase 0 FEITA, esperando aprovação

**Pedido dele:** auditoria estrutural de documentação, prosas e travas, com
*"NÃO QUEBRE NENHUMA TRAVA EXISTENTE"* como regra acima de todas. Implementação
**só depois da aprovação** — este bloco é o levantamento, não a execução.

#### O que foi MEDIDO (Fase 0) — nada foi alterado

| | |
| --- | --- |
| documentação | 17.385 linhas em 22 arquivos. Maiores: `DECISOES.md` 2.506 · `BACKLOG.md` 1.907 · `OPERACAO.md` 1.661 · `SEGURANCA.md` 1.581 · `DESEMPENHO.md` 1.477 |
| relatórios de auditoria | 23 arquivos em `db/`, 5.316 linhas |
| testes/roteiros/portões | **147** arquivos |
| inventário de travas do `CLAUDE.md` | cita **43** → cobre **29%** |
| travas que leem SQL como TEXTO | **23** (a classe frágil do item 17) |
| prosa em `src/` | 12.356 de 45.067 linhas (**27%**); 208 arquivos com bloco de 15+ linhas |
| prosa em migrations | 5.060 de 16.286 linhas (**31%**) |
| IDs vivos | `SEC-*` em 51 migrations e 29 arquivos de `src/`; `LIVE-*` em 13 e 19; `N*` só em documentação |
| `ADR-*` e `INV-*` | **não existem** — 0 ocorrências no repositório inteiro |

#### O achado que MUDA o tamanho do item 14 (HTML/DevTools)

Medido, não suposto:

- **comentário JSX `{/* */}`: 227 blocos no fonte, ZERO no build.** O
  compilador os remove. Não chegam ao DOM, não poluem DevTools, não pesam.
- **`index.html`: 7 comentários, e os 7 SOBREVIVEM** para `dist/index.html`.

Então o item 14 **não é problema de projeto — é de um arquivo só**, e o
conserto são 7 linhas. Afirmar o contrário seria inflar o trabalho.

#### O que o projeto JÁ TEM e não precisa ser criado

A estrutura pedida em grande parte existe com outro nome. Criar de novo seria
duplicar fonte de verdade (§4):

| O prompt pede | Já existe como |
| --- | --- |
| `docs/audits/` | **`db/AAAA-MM-DD-*.md`** — 23 relatórios, e o lembrete de auditoria já lê a data deles |
| `docs/rules/` | **`docs/regras/`**, injetado por `@import` no `CLAUDE.md` |
| índice de decisões | **`docs/DECISOES.md`** + `DECISOES-FERRAMENTAL.md` |
| rastreabilidade achado→correção | parcial: `SEGURANCA.md` liga N→SEC/LIVE em prosa |

#### O que falta de verdade — e é CURTO

1. **`docs/INVARIANTES.md`** — a camada `INV-*` não existe. Hoje a regra
   permanente só existe implícita, dentro do teste que a protege.
2. **Inventário de travas com rastreabilidade** — o do `CLAUDE.md` cobre 29% e
   **não distingue trava de teste comum**. Esse é o buraco real, não o tamanho.
3. **ADRs** para as decisões que hoje moram em prosa de migration.

#### Riscos que a migração precisa respeitar (levantados, não resolvidos)

- **Três portões leem caminho de documento:** `documentacao-quebrada.mjs`,
  `territorio-coberto.mjs` e `numeros-do-projeto.mjs` (36 números vivos em 52
  documentos). Mover arquivo sem atualizar `scripts/territorio.mjs` **reprova o
  CI** — e pior, `territorio-coberto` passa a dizer que uma pasta não tem dono.
- **23 travas leem o TEXTO das migrations.** Reescrever comentário de migration
  pode quebrá-las: várias já foram enganadas por prosa citando comando.
- **A prosa das migrations é imutável na prática:** a migration já rodou. Editar
  o arquivo não muda o banco, e faz o espelho mentir.

#### Ordem proposta (cada uma é um PR, e nenhuma apaga nada)

1. ✅ **FEITO** — `docs/INVARIANTES.md`. **`[24/09]` correção: eu disse "31
   invariantes em 8 famílias" e eram 37 em 9** — contei errado ao relatar, o
   arquivo sempre teve as 37. Derivadas dos `describe()` das travas que já
   rodam; nada inventado. Registrado no `README`, no `territorio.mjs`, no
   `CLAUDE.md` e na tabela do `DOCUMENTACAO.md`. **0 arquivos de código
   tocados.**
2. ✅ **FEITO** — `docs/TRAVAS.md`: os **149** classificados em 7 naturezas
   (9 portões de CI · 23 travas de invariante · 18 de contrato · 19 E2E ·
   4 robôs que avisam · 62 testes comuns · **14 que NÃO são trava**, nomeados).
   Achou **9 travas sem invariante escrito** e **1 erro no `CLAUDE.md`**
   (o `edges-implantadas` dizia estar fora do CI; roda no `implantar-edges.yml`).
   **0 arquivos de código tocados.**
3. ✅ **FEITO** — as **9 travas órfãs** viraram invariante: `INV-NAV-001`,
   `INV-TELA-001/002/003`, `INV-LEGAL-001/002`, `INV-CONTRATO-007` e
   `INV-CONTA-006/007`. O `INVARIANTES.md` passou a **46 invariantes em 12
   famílias**, e nenhuma linha do `TRAVAS.md` diz mais "sem INV".
4. ✅ **FEITO** `[24/09]` — os **7 comentários do `index.html`**. Eles eram os
   únicos comentários do projeto que **chegam ao navegador**: o JSX tem 227
   blocos no fonte e zero no build, o de HTML vai inteiro para o `dist/`. A
   prosa foi **copiada** para a seção "O `index.html` — o que cada linha faz, e
   por quê" do `ARQUITETURA.md` (nada apagado), e a trava
   `htmlNaoVazaProsa.test.js` confere as duas pontas — nenhum comentário no
   HTML **e** a seção continuar de pé com o conteúdo dentro, senão ela premiaria
   quem apaga a explicação. `INV-PORTA-009`.
5. ✅ **FEITO** `[24/09]` — e **saiu diferente do planejado, de propósito.**
   Virou **um índice**, `docs/DECISOES-DE-BANCO.md`, e não uma pasta de ADRs.
   Três desvios, todos escritos dentro do próprio arquivo:

   | O plano dizia | O que foi feito | Por quê |
   | --- | --- | --- |
   | criar `ADR-001`, `ADR-002`… | usar os IDs que **já existem** (`SEC-*`, `LIVE-*`) | um segundo espaço de IDs para o mesmo fato é a duplicação do §4 — `SEC-027` já é citado em migration, teste, `SEGURANCA.md` e `INVARIANTES.md` |
   | um arquivo por decisão | um índice | *"NÃO CRIE 500 ARQUIVOS"* foi pedido explícito, e o que faltava era **navegação** |
   | **copiar** a prosa | **resumir** decisão + descarte e apontar a migration | copiar cria a segunda fonte que envelhece. E **nenhuma migration foi tocada** — 23 travas leem o texto delas |

   12 decisões indexadas em 5 temas. Registrado no `README`, no
   `territorio.mjs`, no `CLAUDE.md` e na tabela do `DOCUMENTACAO.md`.

**Nada de banco. Nada de RLS. Nada de comportamento.**

---


- ⬜ `[24/09]` 🟢 **O `CLAUDE.md` está a DUAS linhas do próprio teto (898 de
  900).** *Descoberto pela trava `regrasCarregadas.test.js`, que reprovou quando
  uma linha nova o levou a exatamente 900 — ela funcionou. A próxima regra que
  entrar não cabe, e a saída certa não é subir o teto: é o §6.2 regra 5 (seção
  acima de ~150 linhas vira arquivo próprio), que foi como nasceram os
  `docs/regras/`. Candidatos a sair: §0.2 (cotas, ~90 linhas) e §6.3 (a tabela
  dos mecanismos, ~80). Não é urgente — vira urgente no dia em que eu precisar
  escrever uma regra e não puder.*

### ✅ `[24/09]` O comentário sumia da tela — resposta velha sobrescrevendo a nova

**Era o item 🟡 aberto hoje de manhã, e a causa NÃO era nenhum dos dois
suspeitos que eu tinha anotado.** Eu havia escrito "o card remonta" ou "o
`setCount(initialCount)` sobrescreve" — e as duas estavam erradas. O que
derrubou a hipótese foi a instrumentação: no despejo da tela, o compositor
estava visível junto do rótulo "Comentar", ou seja **a seção estava ABERTA**
com a lista vazia. Remontagem teria fechado.

**A causa real é uma CORRIDA**, e ela é a 3ª armadilha da FASE 1 do §6 —
*"resposta velha sobrescrevendo a nova"*, que estava escrita na régua de
auditoria desde sempre e nunca tinha sido testada:

```
abrir a seção   -> busca A, devolve []          (conexão lenta, demora)
enviar comentário -> busca B, devolve [c]        (responde primeiro)
                 -> a tela mostra o comentário
A responde      -> setComments([])               -> o comentário SOME
```

**Reproduzido antes de consertar** (§1.2): `comentarioNaoSomeDepoisDeAparecer.test.jsx`
resolve as duas buscas fora de ordem e viu o comentário desaparecer. Vermelho
primeiro, verde depois do conserto.

**Varredura de CLASSE, não de caso** (§1.3): o mesmo desenho existia em mais
dois lugares — `useMensagensDeContato` (trocar o filtro × marcar/responder, e o
piso de 500 ms ALARGA a janela) e `useXpDasLives` (evento de realtime ×
invalidar/revalidar), que eu mesmo escrevi ontem. Os três passaram a usar
`useApenasAUltimaResposta`, um hook só — cópia diverge (§4).

**Três travas, todas provadas reinjetando:** a do hook (guarda sempre
verdadeira · contador que não incrementa · contador vazando entre montagens), a
da tela (o bug original) e a de classe (guarda removida de um dos três · lista
esvaziada · a marca `novoPedido()` migrando para depois do `await`).
`INV-TELA-005`.

### ✅ `[19/09]` LIVE-051 — a moderação não alcançava a live AINDA NO AR

**Não foi relatado: saiu da varredura de classe do LIVE-050.** A pergunta do
§1.3 feita na coluna irmã (`hidden_at` em vez de `deleted_at`) devolveu um bug
**pior**, porque ocultar é o que a moderação mais faz.

**Medido em `ROLLBACK`:** ocultar uma live no ar deixava `is_live = true`
(oculta **e** no ar) e o XP `lives` ia de **0 → 1**. Apagar uma live no ar pela
equipe: mesma coisa, por ordem de trigger. E a live oculta continuava listada
como "AO VIVO" **para a equipe** — o comum via 0, quem moderou via 1.

**Causa:** a invalidação do XP é retrospectiva, e live no ar não tem sessão para
invalidar. Corrigido na **certidão de nascimento** da sessão, não em mais uma
varredura. `motivo_de_invalidacao()` virou fonte única do motivo, porque a
inversa casa por ele.

Trava `moderacaoAlcancaLiveNoAr.test.js`, provada com **8** reinjeções (6 no
banco, 2 na tela). Produção conferida antes do CHECK: 0 a higienizar.

---

### ✅ `[19/09]` LIVE-050 — live APAGADA voltava ao ar pelo painel

**Bug que ele encontrou clicando:** *"assim que exclui um post de live, eu
consigo ativar e reativar a live mesmo estando apagado, lá pelo painel"*.

**Medido em `ROLLBACK`, e era pior que o relato:** o post ficava `is_live=true`
com `deleted_at IS NOT NULL` — estado impossível — e cada ciclo ativar/desativar
gravava uma sessão em `lives_realizadas`, que paga XP. **2 cliques = 2 sessões.**
A tela não mostrava a live (o filtro `deleted_at` segurava), então o único
sintoma visível era um botão que parecia funcionar.

**Causa raiz:** o CHECK do SEC-034 travou `is_live` × `live_ended_at` e deixou
`is_live` × `deleted_at` de fora — mesma classe, o par que ninguém olhou. E o
`set_live_ended_at` tinha a **ida** (apagar live no ar encerra) sem a **volta**.

Fechado em três camadas independentes: o trigger **levanta**, o registro exige
`OLD.deleted_at IS NULL`, e o CHECK torna o estado impossível. Trava
`liveApagadaNaoVoltaAoAr.test.js`, provada reinjetando os **seis** modos de
desfazê-las. Produção conferida antes do CHECK: 0 posts no estado impossível,
0 sessões inválidas — nada a limpar.

---

### ✅ `[19/09]` O RESTO DA 4ª RODADA — fechado

**Ordem dele:** *"É pra fechar tudo!!"*.

| # | O que era | Fechado por |
| --- | --- | --- |
| 1 | XP: bônus de perfil pago por caractere INVISÍVEL (o N3 só estava fechado para ASCII) | **SEC-046** |
| 2 | CI: único workflow sem `permissions` + `persist-credentials` | **SEC-047** |
| 3 | `delete_own_account`: senha errada sem rastro + handles sem validação | **SEC-048** |
| 4 | O risco residual da SEC-043: lista de 25 nomes à mão | **SEC-049** |

**O que o auditor da SEC-049 achou na PRIMEIRA execução — as duas minhas:**
`request_unban` (esqueci na lista) e `texto_visivel` (nasceu aberta para `anon`,
o padrão que eu mesmo documentei na SEC-042, repetido 20 min depois).

**Três travas minhas eram DECORAÇÃO até eu reinjetar o bug.** Em todas, o teste
passava verde com a falha presente. Isso é o argumento mais forte desta sessão
a favor da regra §2 — e está no `MANIFESTO.md`.

**Não testado, e não vira PASS:** o teste dinâmico de senha errada do
`delete_own_account` foi bloqueado pela ferramenta. Só há análise estrutural.

---

### ✅ `[19/09]` AUDITORIA DE SEGURANÇA — 4ª rodada, fechada nesta sessão

**Cobrança dele:** *"o chat gpt tá achando mais coisa... fecha tudo e qualquer
coisa que vc achar, não deixe nada passar"*.

| Família | Achados | Fechada por |
| --- | --- | --- |
| estado do operador não era autorização | N43, N44, N46, N47 | **SEC-043** |
| decisão sobre geração velha do estado | N41, N32, N33/N42, N34 | **SEC-044** |
| decisão sobre snapshot do alvo | N25, N26, N27, N38, N39 | **SEC-045** |

**Três achados NÃO reproduzem hoje**, e isso é correção ao levantamento:
N45/N48 (`admin_set_role` sem `EXECUTE`, `owner_set_role` exige fundador).

**N13 e N16 continuam decisão de design**, como ele mesmo classificou.

**A porta que o levantamento NÃO listou** e que o ataque contra a minha própria
correção achou: `UPDATE posts SET hidden_at` direto pela RLS — o caminho real do
`moderationService`. Guardar só as RPCs teria deixado a moderação aberta.

---

### ✅ `[18/09]` O PACOTE DE LIVE QUE FALTAVA — fechado nesta sessão

**Pedido dele:** *"pode fazer oq vc recomendou das lives e pode fazer o popup de
confirmação da melhor forma que vc achar"*.

| | |
| --- | --- |
| **LIVE-041** | `expires_at` ganhou dono: o autor escolhe a DURAÇÃO, o servidor deriva o instante. Seletor no `LiveGoModal` |
| **LIVE-042** | o pedido de reativação passou a deixar rastro em `admin_logs` — ele **não deixava** |
| popup ao **encerrar** | o botão do autor abria direto uma ação sem volta |
| popup ao **excluir** | o texto genérico não dizia que apagar encerra a live |
| `PedirReativacaoDaLive` | a porta do autor, em dois lugares (a janela é de 15 min) |

**O que quase foi para produção, e é o que importa desta sessão:** escrevi
`SECURITY DEFINER` no rascunho do `guard_post_privileged_cols`. Em produção ele
é **INVOKER** de propósito — ele lê `current_user`. Como DEFINER, `v_comum` fica
sempre falso e **toda a pinagem da SEC-027 desliga em silêncio**.

Pegou porque as asserções 9, 10 e 11 do ROLLBACK reprovaram juntas. A regra que
teria evitado isso **já estava escrita** no `docs/regras/BANCO.md` — o que
faltava era mecanismo, não texto (§9.8). Hoje há trava.

**Dívida que eu mesmo criei e paguei no mesmo bloco:** o `postService.js` passou
de 300 linhas (302). Corte mecânico, a parte de **storage** saiu para o
`postMediaService.js`: 302 → 250 + 64.

---

### ✅ `[18/09]` AUDITORIA EXTERNA (3ª rodada) — a MESMA regra, aplicada pela metade

**Pedido dele:** *"tá difícil em Claude? Vc fecha e tô achando várias coisas
abertas"*. Ele está certo, e o padrão dos achados reais diz por quê.

| | |
| --- | --- |
| N8 — live ocultada/apagada continuava pagando 30 XP | LIVE-040 |
| N9/N10 — comentário de post apagado/oculto continuava pagando 3 XP | LIVE-040 |
| N11/N12 — comentário e chat de post fora do ar continuavam **legíveis** | SEC-041 |
| N13 — curtidas | **não é falha**; decisão medida e escrita na migration |
| N16 — `lives_realizadas` órfã | **é o desenho**: sem isso o XP de live dura 15 min |

**A falha minha, e ela não é a mesma da 2ª rodada — é pior.** Lá eu não varri a
classe depois de achar um caso. Aqui eu **escrevi a regra** (*"XP paga pelo que
está no ar"*, SEC-028, ontem) e a apliquei em **um** dos quatro caminhos. Os
outros três continuaram abertos com a regra já escrita em cima deles.

E o N8 eu **reabri**: a LIVE-036/037, de horas antes, soltou o XP de live do
post para sobreviver ao cron — e, ao soltar do post, soltou da moderação.

Medido em `ROLLBACK`: ocultar um post comum levava o XP de 1 → 0; ocultar uma
**live**, de 1 → **1**.

Relatório em [`db/2026-09-18-auditoria-externa-3a-rodada.md`](db/2026-09-18-auditoria-externa-3a-rodada.md).

### ✅ `[18/09]` AUDITORIA EXTERNA (2ª rodada) — fechada nesta sessão

Um documento de auditoria externa retestou o pentest e trouxe 3 achados novos.
Resultado: **os 3 confirmados e fechados**, mais **3 que a varredura de classe
encontrou por fora** — incluindo um que a minha própria trava achou.

| | |
| --- | --- |
| 06C — oráculo de existência no `restore_post` | SEC-032 · e a classe tinha **5**, não 1 |
| 06L — resposta apontando para pai de outro post | SEC-033 · FK composta |
| N7 — estado impossível de live + spam de notificação | SEC-034 · e apagar o post não encerrava a live |
| N1/N2/N3/N4/N5/N6 (retestes) | confirmados fechados, com evidência |

**A falha minha que isto expôs:** a SEC-031 (ontem) corrigiu a ordem
autorização/validação em **duas** funções e eu não varri a classe. A auditoria
achou a terceira; a varredura que eu deveria ter feito achou a quarta, quinta e
sexta — uma delas escrita por mim horas antes.

E um item do BACKLOG de 11/09 (`auth.uid()` NULL nos guards) estava aberto
enquanto eu reescrevia exatamente aquelas funções, sem lê-lo. Fechado na
SEC-035.

Relatório em [`db/2026-09-18-auditoria-externa-2a-rodada.md`](db/2026-09-18-auditoria-externa-2a-rodada.md).

### ✅ `[18/09]` PENTEST DE SETEMBRO — fechado nesta sessão

**Pedido dele:** *"olhe o prompt mais pesquise mais a fundo ainda pra ver se vc
acha algo a mais que isso e conserte tudo na hora sem deixar pra depois"*, mais
*"algum log não está sendo tratado corretamente… está sem título algum nos
logs"*.

**Resultado:** 15 achados relatados → **11 confirmados e corrigidos**, 3
desmentidos com evidência (10, 13, 14), 1 corrigido em forma diferente da
sugerida (15). **6 achados NOVOS** encontrados por fora do relatório — inclusive
a causa dos logs em branco.

6 migrations (SEC-027 … SEC-031 + SEC-028b), 25 asserções de trava novas, todas
provadas reinjetando o bug. Relatório completo em
[`db/2026-09-18-pentest-de-setembro.md`](db/2026-09-18-pentest-de-setembro.md).

**O que NÃO fechou, e por quê:** marcar a caixa "é uma live" na UI continua
valendo 30 XP. É decisão de produto (§7 🟡) — item próprio na seção do dono.

**Impacto visível:** o XP cai para quem tinha conteúdo apagado/oculto. As contas
de teste do e2e vão de 3575→255 e 3120→0; a sua (`opedrovini`) fica em 65,
inalterada.


### 🧪 `[18/09]` EXPERIMENTO NO PREVIEW — o Ato 0 como PORTAL em SVG

**Pedido dele:** *"na documentação fala algo sobre tirar as cenas em imagem e
usar SVG, quero que vc faça a mudança só na primeira cena, algo que faça sentido
com portal… e queria ver na preview, **depois pode desfazer**"*.

**Onde ele está:** na branch **`preview`**, e SÓ nela. O `PortalDoAtoZero.jsx`
substitui `CENAS.hero` nos dois caminhos do prólogo (o normal e o de
`prefers-reduced-motion`); as outras seis cenas continuam sendo arte gerada.

> **`[18/09]` Ele foi para a `main` por engano e voltou no mesmo dia.** O PR #211
> levou junto a fiação do portal, e mergear pôs em PRODUÇÃO um experimento que o
> pedido dele mandava ver **na preview** — *"queria ver na preview, depois pode
> desfazer"*. Pior: contrariava o que ele já tinha dito em 17/09, *"vc não vai
> alterar nada, pq da última vez vc deixou a landing feia"*.
>
> A produção voltou para `CENAS.hero`. O arquivo continua no repo, testado e
> documentado — o que mudou é **onde ele está ligado**. A lição é do §9.9:
> LOCAL, COMMIT, PUSH, PR, MERGE e PRODUÇÃO não são o mesmo estado, e juntar um
> experimento visual com correção de segurança num PR só apaga essa diferença.

**⚠️ A ARTE DO HERO FICOU ÓRFÃ.** As seis variantes de `1-hero-*` continuam no
repositório sem ninguém mostrá-las (~500 kB). Isso é exatamente o defeito que a
trava `prologo.test.js` existe para impedir — e ela **passou a exigir este item
escrito** enquanto o experimento durar.

**As duas saídas, e as duas são decisão dele:**

| Se ele… | O que acontece |
| --- | --- |
| **gostar do portal** | os seis `1-hero-*` são APAGADOS, e o `cenasDaLanding.js` perde a entrada |
| **não gostar** | uma linha em cada prólogo volta o `<ArteDaCena arte={CENAS.hero} prioridade />`, e o portal + o CSS saem |

**Nada disto é permanente até ele decidir.** Registrado aqui porque achado que
vive só na conversa é o que o §6.2 proíbe.

---

### 🗣️ `[17/09]` A MESA — a visão de futuro e a landing, decididas JUNTOS

**Pedido dele, na letra:** *"a gente coloca na mesa tudo o que está na visão de
futuro e sobre a landing page e decidimos o que vamos fazer, até porque dá pra
fazer agora; aí vc coloca tudo aqui e vc vai me falando o que podemos fazer e
tals, anota isso"*.

**O que isto é:** uma conversa de decisão, não uma tarefa de execução. Ele quer
**a lista inteira na frente** — o que o [`VISAO-DE-FUTURO.md`](docs/VISAO-DE-FUTURO.md)
guarda e o que o [`EVOLUCAO-VISUAL-DA-LANDING.md`](docs/identidade/EVOLUCAO-VISUAL-DA-LANDING.md)
propõe — com **o que já dá para fazer hoje** separado do que não dá, e eu
opinando item a item.

**O que ele espera de mim quando a mesa abrir:**

| | |
| --- | --- |
| a lista **completa**, não uma seleção minha | ele decide, eu informo |
| para cada item: **dá pra fazer agora?** | e o que falta, quando não dá |
| a minha opinião, **inclusive quando for contra** | §7: concordar por educação é o pior serviço |
| o que **conflita** entre si | duas ideias boas que não cabem juntas |

**Está aqui e não na fila** porque é o próximo bloco combinado, e porque o §6.2
manda o pedido virar item escrito **antes** de começar — foi assim que quatro
pedidos dele viveram só na conversa em 01/09.

> **A landing continua área protegida até esta mesa acontecer.** A conversa pode
> mudar isso; nada antes dela muda.

---

### `[11/09]` REFORMULAÇÃO DA LANDING — em fatias, mergeando cada uma

**Ordem do dono:** *"eu realmente quero reformular toda a landing, não só a
cena, vai fazendo o que pode e a gente vai ajeitando no decorrer"*. E a correção
dele, que eu precisava ouvir: *"eu nunca te pedi pra fazer em 3D, acho que no
prompt tá explícito"* — e estava: *"prefiro isso a adicionar 3D apenas para
deixar a página mais impressionante"*.

**Objetivo:** a landing dos três atos — a fenda, o que converge, você já está
dentro. Ver `docs/identidade/BRIEFING-2026-09.md`.

#### `[12/09]` FATIAS 5 e 6 — CONCLUÍDAS e mergeadas (PR #191 e #192)

O prólogo (ATO 0 → GAMERHUB) e as cinco cenas com personalidade de movimento
estão na `main`. O detalhe de cada uma está em
[`BRIEFING-LANDING-2026-09.md`](docs/identidade/BRIEFING-LANDING-2026-09.md).

#### `[12/09]` FATIA 7 — CONTINUIDADE CINEMATOGRÁFICA (em execução)

> Quarto prompt dele, e o diagnóstico é preciso: *"as cenas individualmente
> estão cinematográficas, mas a página ainda denuncia que são blocos
> independentes"*. E a régua: *"não pense em 'como colocar uma animação entre
> duas imagens'. Pense em 'como fazer a imagem A se transformar na imagem B'"*.

**Ele mandou fazer AOS POUCOS** — *"eu sei que é muita coisa, grava tudo e faça
aos poucos"*. Então a fatia vai em três blocos, cada um com PR próprio.

| Bloco | O que é | Estado |
| --- | --- | --- |
| **A** | Tirar o `FluxoDeDados` da landing + costurar HERO → HIGHLIGHTS → FEED, que é o corte mais visível | **feito** em 12/09 |
| **B** | As artes ganharem a tela inteira + a costura nas outras quatro emendas (comunidade, lives, keys, ranks, CTA) | **feito** em 12/09 |

**`[12/09]` O bloco A fechou.** O `FluxoDeDados` saiu da landing (e continua no
site logado), a faixa de destaques deixou de ser uma seção e passou a ser
conduzida pela rolagem invadindo o fim do prólogo, e nasceu o mecanismo de
**costura** — margem negativa + máscara no topo — aplicado por enquanto só na
emenda para o Feed. O bloco B estende a costura para as outras e dá tela cheia
às artes. Detalhe em `docs/DECISOES.md`.
| **C** | As microanimações do ATO 0 — a arte de abertura viva antes da transformação | **feito** em 12/09 |

**`[12/09]` A FATIA 7 FECHOU.** Os três blocos estão na branch. A landing deixou
de ser uma sequência de blocos e virou uma travessia: o fluxo saiu, o hero cede
para os cards, as seis emendas somem, as artes ocupam a tela, cada chegada tem
um gesto próprio, e o ATO 0 tem sinais de vida que preparam a convergência.

**`[12/09]` AJUSTE depois do print dele.** Três coisas: o rastro da convergência
atravessando a emenda (o palco recortava nos dois eixos), a faixa de destaques
subindo de 12vh para 26vh para fechar o *"buraco"* entre o hero e o feed, e os
sinais do ATO 0 maiores e mais numerosos. Junto veio um bug real: as linhas de
ligação tinham 0,18 **pixel** de espessura. Tudo em `docs/DECISOES.md`.

**`[12/09]` AJUSTE 2 — os chips do ATO 0 no celular.** Ele viu no telefone:
*"alguns dos css estão cortadas no celular"* e *"o fundo é colorido, e o texto
com esse balão vazado não dá pra enxergar muito"*. Duas coisas da mesma família
— o chip existe, o navegador desenha, e ninguém lê. A âncora passou a ser a
borda de que o chip se aproxima (ele cresce PARA DENTRO), e o fundo virou opaco.
Duas travas novas, as duas provadas reinjetando o bug. Medido em navegador a
360, 390, 400 e 1440 px: nenhum chip fora da tela, zero rolagem horizontal.

**`[12/09]` AJUSTE 3 — a sétima emenda, que ninguém tinha visto.** Pergunta
dele: *"esse corte da última arte com o footer, dá pra fazer algo? Ou essa parte
é pra ser simples?"*. As duas: **o rodapé fica simples** (é a saída, e é o mesmo
em quatro páginas), mas o corte era a única emenda dura que sobrou — a costura
mascara o TOPO da cena que chega, e o `FinalCTA` é a única sem cena depois, então
a borda de baixo dele ficou exposta. Máscara com `fechaEmbaixo` + a margem
inferior fora. Três travas, provadas uma a uma. Em `docs/DECISOES.md`.

**`[12/09]` AJUSTE 4 — o rodapé virou EPÍLOGO, e a camada de produto cresceu.**
Dois pedidos dele no mesmo bloco. O rodapé ganhou três degraus (assinatura →
navegação → créditos + voltar ao início), com entradas que **desaceleram na
ordem**; os traços da assinatura são o inverso do ato CONVERGÊNCIA. E as
sobreposições das cinco cenas cresciam: `w-[15.5rem]` eram 248 px FIXOS, 63% da
tela no celular e **17%** no monitor. `scale` no `PainelDaCena` (1,3 / 1,55 /
1,75), +2 linhas no feed no PC, chips do ATO 0 maiores, e o `leading` do título
das cenas de 1,08 para 1,18 — a cedilha de "promoções" encostava na linha de
cima. Em `docs/DECISOES.md`.

**`[12/09]` O buraco que os três bugs revelaram, e ele era do CI.** Nenhum dos
17 roteiros de navegador perguntava se a página **rola para o lado**. Os chips, o
SVG do rodapé e o risco do `scale` são a mesma falha muda, e os três foram
achados por ele no telefone. O `e2e/conteudo-visivel.mjs` passou a perguntar, e
a NOMEAR o elemento culpado.

**`[12/09]` AJUSTE 5 — o último polimento, e ele achou um bug em SEIS lugares.**
Quatro pedidos: o cartão das Keys desceu do topo no celular (`pt-16` →
`pt-[26vh]`); as ligações do ATO 0 passaram a aparecer no telefone (havia um
`hidden md:block` que era cautela velha, não decisão) e viraram **energia**
(gradiente que acende na direção do centro + núcleo que respira); a borda do
ícone do PWA passou a ser fração do lado — ela **existia** e era 0,3 pixel; e o
pisca das animações com atraso.

**O pisca era o achado:** `animation-delay` não esconde o elemento, então
durante a espera o navegador desenha o estado normal dele. A varredura de classe
encontrou **seis** casos, e eu conhecia um — os outros estavam na tela de
entrada, no portão, e um eu tinha acabado de criar. Trava nova em
`animacaoComAtraso.test.js`. Tudo em `docs/DECISOES.md`.

**`[12/09]` AJUSTE 6 — ele DESFEZ duas coisas dos ajustes 4 e 5.** As **linhas
do ATO 0** que iam até o centro (*"na vdd Claude, não gostei dessas linhas
não... pode tirar tudo mesmo, do Pc e do celular"*) e a **borda do ícone do
PWA** (*"esse gradiante que vc fez, e essas luzes elas já fazem o trabalho de
dar as 'bordas' do app, sem precisar de uma borda física"*).

Nos dois casos o que saiu foi a solução, não a lição — e a diferença importa,
porque as travas eram do mecanismo: a de espessura em `non-scaling-stroke`
**virou varredura de classe** sobre `src/components/landing` (provada
reinjetando 0,18 px no `ConvergenciaDoHub`, que ela nunca tinha coberto), e a
do `backwards` já era de classe e continua intacta. As travas que só descreviam
o desenho removido (drenagem, gradiente, `pathLength`) saíram junto: trava sem
alvo não falha, ela itera zero vezes e fica verde para sempre.

**`[12/09]` A LANDING PAUSA AQUI, a pedido dele** — *"já trabalhamos demais
nessa landing page"*. Não é abandono: o que sobrou está listado no fim desta
seção, e a fila abaixo volta a ser a prioridade.

**O que fica em aberto, e é medição, não conserto:** `mask-image` promove cada
cena a camada própria de composição — são **seis** agora. Em GPU de celular isso
tem custo de memória de vídeo que nenhuma medição de byte enxerga. É o primeiro
lugar a olhar se alguém relatar travamento ao rolar. Está em `DESEMPENHO.md`.

**O que ele PROIBIU nesta rodada, e vale para os três blocos:** fade preto entre
cenas (só o do prólogo, que tem função narrativa) · prender as cinco · parallax
exagerado · 3D · biblioteca nova · cartas falsas nas Keys · partículas · mais
neon · destruir a composição de celular · mexer em rota, texto ou funcionalidade
· remover os cards clicáveis do `HighlightsStrip` (eles são o índice da página).

**O que ele mandou PRESERVAR:** as cinco cenas, os overlays e as personalidades,
as artes das duas composições, o CTA com pessoas, as âncoras, o
`prefers-reduced-motion`, o lazy, e a distinção
`CenaDaLanding` × `CenaPresa` × `PalcoDeRolagem`.

**`[12/09]` ETAPA 0 do prompt — o merge manual dele, CONFERIDO.** `origin/main`
está em `b9c195a` (merge do PR #192), `git diff 61f69c3 origin/main` é vazio, os
6 arquivos de `cenas/` estão lá, build/lint/631 testes/6 portões verdes, e a
produção serve **o mesmo hash** que o build local da `main` gera. Nada faltou.

**Sobre a memória da abertura: NÃO há o que construir.** Ele pediu que ela não
volte ao trocar de aba, só ao fechar e abrir. Conferido em
`src/lib/introJaVista.js`: já é `sessionStorage`, que sobrevive a recarregar e a
navegar pelo site e **morre quando a aba fecha** — exatamente o pedido. O que
muda é só o tempo que ela dura quando toca.

> **`[11/09]` A fila abaixo foi REESCRITA.** Ele mandou um segundo briefing, bem
> mais ambicioso — a landing como **experiência de scroll**, não como sequência
> de seções. Está inteiro em
> [`docs/identidade/BRIEFING-LANDING-2026-09.md`](docs/identidade/BRIEFING-LANDING-2026-09.md),
> com a análise do que existe hoje e a direção proposta.
>
> **Ele avisou que as imagens de referência ainda NÃO existem** — *"eu não tenho
> elas agora, eu vou ter que gerar, deixa isso pendente"* —, e que o plano pode
> mudar quando chegarem: *"provavelmente vamos ter que mudar o que estamos
> fazendo, mas vamos só estruturar antes de fazer"*. Por isso a fila é ordenada
> pelo que **não** depende delas.

> **`[11/09]` O MÉTODO, definido por ele:** *"vamos fazer em blocos? uma coisa
> por vez... nesse momento não vamos implementar, vamos idealizar, anotar e
> implementar"*. Cada fatia passa por **idealizar → anotar → implementar**, e só
> avança quando a anterior estiver redonda: *"quando tiver redondo partimos pro
> resto"*.
>
> **Bloco em idealização agora: a ABERTURA (fatia 2).** Tudo dele está em
> [`BRIEFING-LANDING-2026-09.md`](docs/identidade/BRIEFING-LANDING-2026-09.md),
> com as propostas de frase, as três leituras de "montar", a restrição técnica
> que decide o desenho e os 6 pontos ainda em aberto.

| Fatia | O que é | Estado |
| --- | --- | --- |
| **1** | Matar a cena 3D e trocar o fundo do hero por convergência em SVG/CSS | **feita** |
| **2** | A abertura: marca pintada, frase revelada, reflexo polido, e a marca assenta no hero | **feita** |
| **3** | As CINCO CENAS com arte própria + o CTA — **no PC** | **feita** em 12/09 |
| 4 | As mesmas cenas **no CELULAR**, com as artes de RETRATO | **feita** em 12/09 |
| **5** | O PRÓLOGO: cena presa + progresso de rolagem, os cinco atos do ATO 0 até o hero | **feita** em 12/09 |
| **6** | DAR VIDA às cinco cenas: personalidade de movimento por cena, duas presas, três soltas | **feita** em 12/09 |

**`[12/09]` A fatia 5 fechou.** Segundo prompt dele — a landing como narrativa
de rolagem. O ATO 0 é a arte de abertura quase em tela cheia, **sem logo, sem
parágrafo e sem CTA**, com a frase *"Tudo o que acontece entre gamers, em um só
lugar."*; a rolagem conduz `ARTE → TRANSFORMAÇÃO → CONVERGÊNCIA → MARCA →
GAMERHUB`. A arquitetura, as 20 regras dele item a item e o que se perdeu estão
em [`BRIEFING-LANDING-2026-09.md`](docs/identidade/BRIEFING-LANDING-2026-09.md).

**O que ficou aberto DENTRO da fatia 5, e é decisão dele:**

- `[12/09]` 🔵 **A marca não assenta mais no hero** — a abertura abre para a
  arte, e a marca só volta no 4º ato. É consequência da regra 1 do prompt dele
  (ATO 0 sem logo). Se ele preferir a continuidade de volta, o caminho está
  escrito em `docs/DECISOES.md` e são ~5 linhas.
- `[12/09]` 🔵 **A fatia 6 é o resto do pedido:** as cinco cenas de baixo
  continuam entrando com o mesmo `fadeUpReveal` — que é exatamente o *"cinco
  fades iguais"* que ele proibiu. O palco (`PalcoDeRolagem`) já existe e serve
  para elas sem mudança.

**`[12/09]` A fila foi reorganizada em DOIS BLOCOS**, por decisão dele: *"faz
primeiro no PC... eu vou regerar todas elas, mas no formato de celular, aí vamos
em duas partes"*.

**O que isso muda no que eu já fiz:** o recorte automático para celular
(`npm run cenas` gera as versões `alta-*`) deixa de ser a solução e vira
**remendo**. Arte composta em retrato ganha de qualquer corte automático — o
corte não escolhe o enquadramento, ele só descarta o que sobra.

**`[12/09]` O bloco 2 fechou no mesmo dia.** Ele gerou as sete cenas em retrato e
o `<picture>` passou a trocar de ARTE abaixo de 768 px. O empilhamento
provisório saiu: o texto voltou a ficar por cima, agora apoiado no pé da cena,
porque a arte em pé tem altura de sobra.

**A alavanca que ficou aberta, com a medição que a resolve:** as artes são
geradas a qualidade 0,80, e a 0,72 tira ~25% do peso — o celular cairia de
777 kB para ~580 kB na página inteira. **Não apliquei** porque não medi se o
artefato aparece no texto da interface DENTRO da arte, que é justamente o que
precisa continuar legível. Trocar legibilidade por byte sem olhar desfaria o
motivo de as artes de retrato existirem. A medição: gerar uma cena a 0,72 e
comparar o recorte do texto lado a lado.

**As PERGUNTAS que eu fiz, e onde cada uma parou.** Gravadas porque pergunta que
vive só na conversa some com a sessão — foi assim que quatro pedidos dele se
perderam em 01/09.

| # | Pergunta | Resposta |
| --- | --- | --- |
| 1 | Qual frase aparece com a marca na abertura? | ✅ **"Aqui o jogo continua."** |
| 2 | Quanto tempo a abertura pode durar, e a 2ª visita ganha versão curta? | 🟡 **em aberto** — proposta de 2,15 s e versão curta no briefing, esperando ele |
| 3 | O que "montar" quer dizer no desenho? | ✅ **pintada**, e depois o brilho de objeto polido |
| 4 | As artes que ele vai gerar são FUNDO ou PEÇAS? | 🟡 **em aberto** — *"cada print vai ter sua arte própria"* sugere composição, mas ele não respondeu a pergunta diretamente |
| 5 | O molde `FeatureSection` morre, ou fica nas seções menores? | ✅ **morre** — *"cada print vai ter sua arte própria"* |

**`[11/09]` O TETO DE AMBIÇÃO da landing, na palavra dele:** *"na landing é onde
eu mais quero gastar... não precisa ser pesado, mas tem que ter impactante"*.

Isso muda uma calibragem que eu vinha usando errado. Eu tratava "não pode
pesar" como "faça o mínimo"; ele está dizendo outra coisa — **a landing é onde o
esforço deve se concentrar**, e o limite é o *peso*, não a *ambição*. As duas
coisas não são a mesma: o `ConvergenciaDoHub` é impactante e custa 3,2 kB.

**Por que isso fica escrito aqui e não só na conversa:** na hora de escolher
entre uma cena mais simples e uma mais ousada, é esta frase que decide o empate
— e sem ela registrada, eu escolheria a simples achando que estou sendo
responsável.

**Por que a 3 vem antes das cenas, e não depois:** cena presa é MECANISMO —
altura reservada, progresso, o que acontece no celular, o que acontece com
`prefers-reduced-motion`. Construir uma vez com teste e reusar é o oposto de
escrever cinco animações parecidas que divergem (§4). Fazer as Lives primeiro e
extrair o mecanismo depois é o caminho que produz duplicação.

**Critério de sucesso da fatia 1:** nenhum raio na landing, o orçamento de bytes
cai, e o hero conta "ponto de encontro" sem depender de 3D.

**Fatia 1 — FEITA, com o que ela custou e o que ela NÃO rendeu.** Saiu a cena
inteira (wrapper, fallback 2D, a pasta, o botão de escolha, o portão por
aparelho), `three`, `@react-three/fiber`, `lib/ritmoDoRaio.js` e o
`e2e/cena-3d.mjs` com o job de CI que o rodava. A intro deixou de desenhar o
raio: hoje é a marca que se desenha. No lugar do hero entrou
`ConvergenciaDoHub`.

**Sinceridade sobre o critério de sucesso que eu mesmo escrevi acima:** ele
dizia *"o orçamento de bytes cai"*, e **não caiu** — carregamento inicial em
735,0 kB / 222,9 kB gzip, exatamente o de antes, e o chunk da `Landing` subiu
17,9 → 21,1 kB porque o SVG novo mora nele. O critério estava errado, não a
entrega: a cena era `lazy` atrás do portão por aparelho, então nunca esteve no
carregamento inicial. O que sumiu foram os 708 kB de quem **recebia** a cena e
os 5.877 ms de thread em 6 s de página parada. Medição em
[`DESEMPENHO.md`](docs/DESEMPENHO.md).

**Calibragem da convergência, em dois passos, cada um a partir de um print.** A
1ª versão traçava a reta inteira até o centro e sumia o texto por opacidade — as
linhas cruzavam o título assim mesmo. A correção é geométrica: cada traço para
na borda de uma elipse que envolve o texto. A 2ª versão tinha 11 pontos
animados ao mesmo tempo, o elemento mais brilhante da tela; hoje 1 em cada 3
trajetos leva ponto. Conferido em 1280×800 e em 400×800.

---

---

**Última conferência contra o sistema:** 18/09/2026 ·
**53 itens abertos** (+ 1 ideia sem compromisso)

---

## 🔖 `[17/09]` ELE RESPONDEU — o que fica, o que cai, e o que entra

> O bloco ENGATILHADO de 12/09 fez 5 perguntas e pediu 4 ações de painel. Ele
> respondeu todas em 17/09. Este bloco substitui aquele.

### O que ele decidiu (detalhe e motivo em [`docs/DECISOES.md`](docs/DECISOES.md))

| Pergunta | Resposta dele |
| --- | --- |
| **Super admin?** | pode existir, **mas sem poder sobre o fundador**. Vira o **SEC-021** abaixo — hoje `ban_user` respeita hierarquia e `unban_user` **não** |
| **O ban destrói conteúdo?** | **sim, é deliberado.** *"o ban é a punição mais severa do site"*. SEC-015 **fechado** — sobra só a mensagem de desban, que promete o que não entrega |
| **Sair do Gmail?** | **agora não.** O item continua aberto, deixa de ser 🟠 |
| **Ícones de notificação?** | não respondeu — e a minha recomendação continua de pé: **encurtar a lista da RPC** para os 4 que a tela desenha |
| **Ideia nova** | XP/rank como punição graduada → [`VISAO-DE-FUTURO.md`](docs/VISAO-DE-FUTURO.md) |

### ❌ B1 ERA UMA TAREFA FALSA, E O ERRO FOI MEU

Ele reagiu: *"ligar o contador de tentativas não dá, é pago esqueceu?"*. **Ele
está certo, e o agravante é que o projeto JÁ SABIA** — o item `[11/09]` mais
abaixo diz, com a fonte da documentação oficial, que o
`Password Verification Attempt` é de **Teams and Enterprise** (nem Pro), e
termina com a frase *"NÃO é 'faltou clicar', e eu afirmei isso antes de
conferir"*.

No bloco de 12/09 eu escrevi de volta *"está construído e nunca ligado… falta o
passo a passo"* — **reintroduzi um erro que este mesmo arquivo já tinha
corrigido**, porque escrevi o resumo de memória em vez de reler o item. É o §1.4
na veia: documento envelhece, mas aqui quem envelheceu fui eu.

**O que resta é a decisão A ou B do item `[11/09]`** (tirar a promessa da tela ×
subir de plano) — e ela continua sem resposta.

### Ações de painel que sobraram

| # | O que | Estado |
| --- | --- | --- |
| **B2** 🔵 | Política de senha no painel de Auth | continua válida. A proteção contra senha vazada **não** entra: plano Pro |
| **B3** 🔵 | Alerta de cota do Sentry | ele **acha** que já ativou. Não tenho como verificar daqui — fica assim escrito, sem eu afirmar nem negar |
| **B4** ✅ | Implantar as Edge Functions | **FEITO em 17/09** — as 8 subiram e `npm run edges` diz 8/8 OK. **FECHADO em 17/09**: ele pôs o segredo, o workflow rodou verde de ponta a ponta e o passo de prova confirmou 8/8 |

---

## 🆕 `[17/09]` OS DOIS PROMPTS — registrados, para rodar em PARALELO

> Ordem dele: *"eu vou te mandar dois prompts, quero que vc grave tudo e faça
> tudo em paralelo ao que já estamos fazendo"*. Os textos integrais estão em
> `db/2026-09-17-prompts-do-dono.md` — aqui fica só o que vira trabalho.

### ⬜ PROMPT 1 · AUDITORIA TÉCNICA PÓS-LANDING (Lighthouse/PageSpeed) 🟠

**O que é:** auditoria técnica do **GamerHub inteiro**, guiada pelo PageSpeed,
em 6 camadas e por prioridade — uma de cada vez, com diagnóstico → decisão →
implementação → validação.

**A regra que manda mais alto, e é dele:** *"NÃO quero uma caça ao 100/100"*.
Performance só se mexe com **problema real, ganho relevante e risco baixo** —
ganho teórico ou incerto é **não implementar**.

**A LANDING É ÁREA PROTEGIDA.** *"Está finalizada"*. Pode ser verificada quanto
a defeito técnico real, mas **não sofre alteração visual ou estrutural para
agradar métrica**. Proibido remover animação, Framer Motion, imagem, cena ou
composição por causa de Lighthouse.

**O escopo é por FINALIDADE, não uniforme:** landing ≠ página pública ≠
autenticada ≠ administrativa ≠ legal. Não aplicar regra de SEO de página
pública em área logada; não indexar admin; não usar `robots.txt` como
segurança.

| Camada | O que | Estado |
| --- | --- | --- |
| 🔴 1 | console | ✅ **diagnosticado em 17/09** com o PageSpeed dele. TODOS os erros são o mesmo: o WebSocket de realtime falhando DNS no runner do Google. Não é defeito para quem usa — mas revelou o achado abaixo |
| 🟠 2 | `robots.txt` · `sitemap.xml` | ✅ **FEITO em 17/09** — ver `db/2026-09-17-prompt1-etapa1.md` |
| 🟡 3 | titles · meta descriptions · canonical · **JSON-LD** | ✅ **FEITO em 17/09** — 6 títulos únicos de 6, canonical por página, e o JSON-LD com **um** tipo (`WebSite`). Ver `db/2026-09-17-prompt1-etapa3.md` |
| 🟢 4 | acessibilidade — problema concreto, preservando a direção artística | ✅ **FEITO em 17/09** — medido em navegador nas 5 rotas: 0 botão sem nome, 0 link sem texto, 0 imagem sem `alt`, nenhum salto de cabeçalho. **2 defeitos reais**, os dois corrigidos |
| 🔵 5 | performance — **só com evidência** | ✅ **DIAGNOSTICADA em 17/09, e a evidência disse para NÃO mexer.** Três investigações, zero otimizações: a minha proposta do Supabase estava errada (quem puxa o chunk é o `useAuth`), o CSS não tem gordura (49,4 dos 70,5 kB são nossos, o purge está certo), e separar o `framer-motion` **estourou o orçamento** — chunk menor comprime pior. Ver `db/2026-09-17-etapa5-e-o-alvo-inexistente.md` |
| ⚪ 6 | `llms.txt` | ✅ **FEITO em 17/09** |

**ACHADO DA ETAPA 1, já medido em produção — e é falha MUDA:**

```
/robots.txt   -> HTTP 200 · text/html
/sitemap.xml  -> HTTP 200 · text/html
/llms.txt     -> HTTP 200 · text/html
```

Nenhum dos três existe em `public/`. O `vercel.json` tem
`"rewrites": [{ "source": "/(.*)", "destination": "/" }]`, que **captura tudo** —
então o crawler pede `robots.txt` e recebe **o HTML do site com status 200**.
É pior do que 404: o 404 diz "não existe"; o 200 com HTML diz "existe" e entrega
lixo. Ninguém vê, nada loga, nenhum teste falha (§1.5).

### ✅ PROMPT 2 · A EVOLUÇÃO VISUAL FUTURA DA LANDING — **FEITO em 17/09** 🟡

**Escrito em [`docs/identidade/EVOLUCAO-VISUAL-DA-LANDING.md`](docs/identidade/EVOLUCAO-VISUAL-DA-LANDING.md)**,
com `STATUS: FUTURO — NÃO IMPLEMENTAR AGORA` no topo. Os dois princípios dele
estão gravados com o teste prático de cada um, junto do retrato medido de hoje
(7 cenas × 6 recortes) e da lista do que fica proibido mesmo no futuro.
**Nada foi implementado** — a landing vigente continua inteira.

O pedido original, mantido abaixo para o documento poder ser conferido contra
ele:

**Ordem explícita:** *"NÃO implemente essa evolução agora"*. A tarefa é
**analisar a landing atual e registrar a visão** num documento. A landing
vigente continua valendo.

O princípio a gravar: **uma experiência = uma cena**, e não *uma feature = uma
cena*. A landing cresce por pilares narrativos, não por catálogo de
funcionalidades. Junto: **preservar o conceito, não o asset** — arte que depende
de texto, preço, número ou layout específico envelhece rápido, e no futuro a
representação pode migrar para SVG/UI/híbrido, cena por cena.

Destino: documento próprio em `docs/`, com **STATUS: FUTURO / NÃO IMPLEMENTAR
AGORA** escrito nele.

---

## 🔴 ACHADOS DE SEGURANÇA — `[10/09]`


- ✅ **SEC-025 e SEC-026 · `[18/09]` A escalação em `profiles` e a auditoria das
  48 — FECHADAS.** `authenticated` perdeu UPDATE nas 13 colunas que não edita
  (era a tabela inteira), e `admin_set_role` saiu de `authenticated` por ser
  órfã nas quatro frentes. Advisor 48 → 47. Relatórios:
  `db/2026-09-18-checkmate-profiles-escalacao.md` e
  `db/2026-09-18-auditoria-48-security-definer.md`.

- ✅ **SEC-024 · `[17/09]` `reset_login_attempts()`, a terceira porta morta do
  contador de login** — **FECHADA no mesmo dia.** Eu tinha deixado como
  proposta, argumentando que não é explorável hoje; **o dono corrigiu e estava
  certo** — a POSTURA §1.3 é literal: *"brecha que só vira problema amanhã se
  fecha hoje"* e *"desconfiar de proteção acidental… é sorte esperando
  expirar"*. A proteção não era a função: era `login_attempts` estar vazia.
  Revogada de `PUBLIC, anon, authenticated`, provada em `ROLLBACK` com 6
  asserções — inclusive a que mostra que a porta **estava aberta** antes — e a
  metade anônima travada em `e2e/portas-do-banco.mjs` (49/49). Relatório em
  `db/2026-09-17-readme-sec024-e-o-vigia-cego.md`.

- ✅ **SEC-011 · `anon` lia 26 das 29 tabelas** — **FECHADO em 12/09**, e com
  escopo maior do que o achado. O dono definiu a régua de papéis (*"não quero
  que anon veja nada"*) e ela virou migration: `REVOKE ALL` nas 29 tabelas,
  `GRANT SELECT (key, value, updated_at) ON site_config` como única exceção, e
  `ALTER DEFAULT PRIVILEGES` para valer em tabela que ainda não existe.
  Validado em `ROLLBACK` com usuário real (posts 275→275, comments 62→62), em
  produção (`anon` lê só `site_config`, escreve NADA), e pela porta da frente
  (`portas-do-banco.mjs` 46/46, HTTP 401 observado). Régua escrita em
  `docs/regras/BANCO.md`; relatório em `db/2026-09-12-auditoria-bloco-a2-*.md`.

- ✅ **SEC-012 · apagar a conta não pedia senha** — **FECHADO em 12/09**.
  `delete_own_account(p_senha)` confere no SERVIDOR via `a_senha_confere`, um
  auxiliar interno (revogado de `anon` e `authenticated`) que o cofre também
  passou a usar — uma implementação só do `crypt`. A versão sem argumento foi
  **apagada**, senão a porta continuaria aberta ao lado da nova. A trilha passou
  a ser gravada **antes** do `DELETE` (o `logAudit` do cliente rodava depois, com
  o ator já inexistente — falha silenciosa). Testado em `ROLLBACK` com usuário
  descartável: senha errada recusa, senha certa apaga E deixa 1 registro.
  Trava `exclusaoPedeSenha.test.js`, 6 asserções.

- ✅ **SEC-013 · `notify_user` não deixava rastro** — **FECHADO em 12/09**.
  Passou a registrar em `admin_logs` (`admin_notified_user`), exigir que o alvo
  exista, limitar a 500 caracteres e aceitar só tipo de lista fechada. Provado
  em produção: tipo inventado, texto de 501 e alvo inexistente são todos
  recusados.

- ⬜ `[12/09]` 🟡 **SEC-015 · a INVERSA do ban existe para a marca, não para o
  CONTEÚDO — e é DECISÃO DO DONO.** *BLOCO B.*

  `ban_user` faz `DELETE FROM posts / comments / community_posts / live_chat`.
  `DELETE` de verdade, não `soft_delete` — e o projeto TEM o caminho reversível
  (`soft_delete_post` marca `deleted_at`, e existe `restore_post`).

  | | quem pode | reversível? |
  | --- | --- | --- |
  | marcar banido | **admin** (rank 2) | sim |
  | apagar todo o conteúdo | **admin** (rank 2) | **NÃO** |
  | desbanir | **super_admin** (rank 3) | — |

  **Quem destrói é um nível ABAIXO de quem desfaz**, e o que ele destrói é a
  parte sem volta. O desbanimento devolve a conta e não devolve nada do que a
  pessoa escreveu — e a notificação ainda diz *"sua conta voltou ao normal"*.

  **Pode ser intencional** (banir para purgar é política defensável), e por isso
  não é 🟠. Mas se for, precisa estar escrito e a mensagem precisa parar de
  prometer o que não entrega. **Decisão de produto.**

- ⬜ `[12/09]` 🔵 **A política de senha do painel de Auth nunca foi conferida.**
  *BLOCO F, e vem com a parte que eu quase errei.* O advisor pede para ligar a
  proteção contra senha vazada (HaveIBeenPwned). **Pesquisei antes de virar
  tarefa para você, e ela é do plano PRO** — não existe botão para clicar no
  Free, e esse aviso vai aparecer em todo advisor para sempre. Não é
  configuração, é dinheiro.

  **O que dá para fazer no Free**, na mesma tela: comprimento mínimo e classes
  de caracteres obrigatórias. Hoje o site só mede força **no cliente**
  (`lib/password.js`), e validação no cliente não vale nada sozinha (§1.3) —
  quem chama a API de auth direto passa por cima. Falta eu escrever o passo a
  passo no `OPERACAO.md` (§9.12) e você conferir o que está configurado.

- ⬜ `[12/09]` 🔵 **`admin_list_users` faz `SELECT * FROM profiles`.** *BLOCO D.*
  Devolve **todas** as colunas para qualquer admin, inclusive as que a tela não
  usa. Não é brecha — admin é cargo autorizado —, é minimização de dado e
  egress (§6.1): a cota mais apertada do Supabase paga por coluna que ninguém
  lê. Trocar por lista explícita de colunas.

- ⬜ `[17/09]` 🟡 **TRÊS soluções para o mesmo problema de alarme repetido — e
  eu criei a segunda e a terceira.** *DECISÃO DELE.*

  | Função | Estratégia | Ganha | Perde |
  | --- | --- | --- | --- |
  | `registrar_falha_de_edge_function` | **suprime** a repetição | trilha estritamente append-only | a contagem |
  | `record_banned_login_attempt` (SEC-023) | **atualiza** a linha | "9 vezes" é sinal de verdade | a linha deixa de ser imutável |
  | `notify_admin_new_live` (SEC-034, `[18/09]`) | **atualiza** a linha | idem | idem |

  > **`[18/09]` Eu piorei a divergência em vez de resolvê-la.** A SEC-034
  > precisava de deduplicação urgente (31% das notificações de admin eram spam
  > de live), e eu copiei o desenho do `record_banned_login_attempt` por
  > consistência — sem trazer a decisão para cá primeiro. Foi a escolha certa
  > para não inventar um quarto padrão, e a errada por adiar de novo o que já
  > estava esperando decisão há um dia. Agora são 2 a 1 a favor de "atualizar";
  > se for essa a decisão, sobra só o `registrar_falha_de_edge_function` para
  > alinhar.

  A primeira tem a razão escrita no código: *"a trilha é append-only, então não
  dá para incrementar um contador na linha existente sem mudar essa natureza"*.
  **Eu li isso DEPOIS de aplicar o SEC-023** — o argumento é legítimo e eu não o
  considerei antes de escrever.

  A favor de atualizar: aqui a contagem **é** a informação. "Tentou 1 vez" e
  "tentou 30 vezes em meia hora" são fatos diferentes, e a linha alterada
  descreve evento **do sistema**, não ação humana.

  Alinhar é barato nos dois sentidos. O que não pode é ficar com duas respostas
  para a mesma pergunta (§4, fonte única).

- ⬜ `[12/09]` 🔵 **`notify_user` aceita 9 tipos; o sino estiliza 4.** *BLOCO D.*
  `warning`, `info`, `success`, `error`, `system` e `role` estão na lista
  fechada da RPC e **não** estão no `NOTIF_META` — caem no sino genérico. Não é
  bug: o `DESCONHECIDO` é fallback deliberado e visível. Mas a RPC promete mais
  do que a tela desenha, e escolher ícone é decisão de design. Ou entram no
  mapa, ou saem da lista da RPC.

- ⬜ `[12/09]` 🔵 **O buraco que sobrou da régua de `anon`: `GRANT` explícito.**
  O `ALTER DEFAULT PRIVILEGES` fecha a tabela NOVA por padrão, mas não impede
  alguém de escrever `GRANT SELECT ... TO anon` numa migration futura. O que
  pegaria isso é o `portas-do-banco.mjs`, e ele só enxerga as tabelas da lista
  dele — tabela nova com grant explícito ficaria fora dos dois.

  **Conserto possível:** o roteiro enumerar as tabelas em vez de usar lista
  fixa, e exigir 401 em todas menos `site_config`. Não feito agora porque ele
  roda com a chave anônima e não consegue listar o schema — precisaria de uma
  RPC só para isso, e RPC nova aberta a `anon` é exatamente o que a régua
  proíbe. Registrado para decidir com calma.

- ✅ **`contagem_de_migrations()` chamável por `anon`** — **DECIDIDO MANTER** em
  12/09, e a decisão está escrita em `docs/DECISOES.md`. Ela é usada pelo portão
  de CI `espelho-de-migrations.mjs`, que roda com a chave anônima. Fechar
  exigiria pôr a `service_role` no CI — trocar um inteiro exposto por uma
  credencial mestra exposta é a conta errada. Ela não devolve dado nem dá poder:
  cabe na régua do dono como exceção nomeada.

- ✅ **SEC-001 · `game_keys.key_code` legível sem conta** — **FECHADO**.
  Migration `key_code_deixa_de_ser_legivel_sem_conta`, trava em
  `e2e/portas-do-banco.mjs`. Reproduzido antes, reconferido depois.
- ✅ **SEC-002 · `SEGURANCA.md` afirmava que `anon` via `(id, username)` de
  `profiles`** — **FECHADO**. Já não era verdade; texto corrigido com a
  evidência (`information_schema.column_privileges`).
- ✅ **SEC-003 · `TRUNCATE` concedido a `anon` em 27 de 29 tabelas** —
  **FECHADO**. Migration `revogar_truncate_de_anon_e_authenticated`, com
  `ALTER DEFAULT PRIVILEGES` para as tabelas futuras.
- ✅ **SEC-004 · a wordlist inteira era legível sem conta** (322 palavras com a
  severidade — o mapa de como contornar o filtro) — **FECHADO**. 🔵
- ✅ **SEC-006 · o cache do React Query atravessava a troca de conta** —
  **FECHADO**. 🟡 Era a consequência de backend que faltava para o spoof de
  `role` do DevTools deixar de ser inofensivo.
- ✅ **SEC-005 · `site_config.updated_by` legível por `anon`** — **FECHADO**, e
  com ele o item 🔵 que estava **aberto no backlog desde 01/09**. Deu para
  fechar sem decisão nova porque duas coisas mudaram: `profiles` foi revogado de
  `anon` (o UUID já não vira nome) e nenhuma tela pública lê essa coluna.
- ✅ **SEC-007 · a moderação de conteúdo dizia ter apagado o que não apagou** —
  **FECHADO**. 🟡 Ver a lixeira é `role_rank >= 2` (plana), apagar é
  `can_moderate_content` (hierarquia estrita): o admin **enxerga** o post do
  owner e não pode apagá-lo, e a RLS recusa com **0 linhas e nenhum erro**. O
  toast dizia "apagado permanentemente" e a trilha gravava a exclusão. Medido em
  `ROLLBACK` (a tela contava 176, o banco apagava 175). Varrido por CLASSE: dos
  17 `delete()` de `src/`, **6 corrigidos** e 4 marcados como 0-linhas legítimo.
  Trava `apagarConfereLinhas.test.js`, provada reinjetando o bug.
- ✅ **SEC-008 · o período de avaliação de staff podia acabar no ano 12020** —
  **FECHADO**. 🟡 `review_staff_nomination(p_trial_days)` e
  `decide_staff_trial(p_extend_days)` tinham piso e **nenhum teto** — a mesma
  falha da suspensão até 2126. Importa porque o trial é o que autoriza um super
  admin a promover **sem o fundador**, e nada cobra o vencimento por máquina
  (não há cron sobre `trial_review_date`). Provado em `ROLLBACK`: 3.650.000 dias
  aceitos, cargo virou `admin`, revisão para 12020-01-20. Faixa de 7–180 dias
  (extensão 1–90, total 365) **e** `CHECK` no banco — a trava que torna o dado
  errado impossível, e que sobrevive a alguém reescrever a função.
- ✅ **SEC-009 · o UPDATE de conteúdo ignorava a hierarquia que o DELETE
  respeita** — **FECHADO**. 🟠 O mais sério do dia: um admin **reescreveu e
  ocultou** um post do fundador por `PATCH` direto, enquanto o
  `soft_delete_post` recusava o mesmo post por falta de permissão. As três
  tabelas de conteúdo tinham `DELETE` com hierarquia estrita e `UPDATE` com
  cargo plano (`is_staff()` / `role_rank >= 2`). Corrigido nas seis policies,
  cada cenário testado em `ROLLBACK` (moderação segue viva, autor segue
  editando). Trava `hierarquiaNoConteudo.test.js`.
- ✅ **SEC-010 · a trilha atribuía ao AUTOR a ação feita por outra pessoa** —
  **FECHADO**. 🟡 `log_post_event` gravava o dono do post como ator. Agora grava
  `auth.uid()` (caindo para o autor quando não há sessão — o cron), nomeia os
  dois no texto e sobe para `warning` quando quem age não é o autor.

> **A auditoria CONTINUA.** As três primeiras frentes fecharam, mas o piso do
> §6 pede muito mais: as **48 funções alcançáveis** uma a uma, as **12 policies
> com `USING (true)`**, os fluxos de role/ban/moderação, IDOR, upsert, mass
> assignment e o isolamento de sessão. O que já foi apurado está em
> `db/2026-09-10-auditoria-seguranca.md`.

## 🟡 ACHADOS OPERACIONAIS — `[10/09]`

- ⬜ `[10/09]` 🔵 **`unsilenceUser` existe duas vezes**, com assinaturas
  diferentes: `liveService.unsilenceUser({postId, userId})` e
  `useAdminLiveActions.unsilenceUser(id)`. Os dois foram corrigidos junto no
  SEC-007, mas **cópia diverge** (§4, fonte única) — foi assim com os ícones de
  log, os rótulos de cargo e a regra de bloqueio de login. Unificar exige
  decidir uma assinatura só, e o hook apaga por `id` da linha enquanto o serviço
  apaga por par: não é troca mecânica.

- ✅ `[10/09]` 🟡 **`e2e/artes-da-arena.mjs` era instável no CI** — **FECHADO**.
  Falhava com *"cadastro tem 4 lutador(es), esperava 2"*: o fade cruzado
  flagrado no meio.

  **A causa raiz:** a espera pedia só *"existem 2 `.arena-troca`"*, e isso é
  verdade em **dois** estados — antes de a troca começar (com as artes do
  login) e depois de ela terminar. Fallback silencioso na versão temporal (§4).

  **A janela foi provada**: clicando de dentro da página e lendo a condição na
  mesma tarefa de JS, ela responde `true` com as artes do login ainda na tela.
  Mas **a falha não reproduziu aqui** — pelo caminho real do Playwright a
  condição antiga levou **728 ms**, já com as artes novas: o clique é mais lento
  que o render nesta máquina, e no CI a corrida deu para o outro lado.

  O conserto diz **o que se espera ver**, não quantos elementos: os `src` têm
  que ser diferentes dos de antes. A prova é estrutural, não estatística — 5
  rodadas verdes aqui não valem nada, porque **antes** do conserto também davam
  5/5.

- ⬜ `[10/09]` 🟡 **O orçamento de bytes dá resultado DIFERENTE aqui e no CI.**
  Local, com `npm ci` (mesmo lockfile do CI): **222,4 kB gzip**, acima do teto
  de 222 → reprova. No CI, o mesmo passo **passa**.

  **Medido, não suposto:** com `git stash` das minhas mudanças, o número local é
  **222,4 antes e depois** — ou seja, o que eu fiz custou **0 kB gzip**, e o
  estouro local não é meu.

  A causa provável é a versão do `zlib`/Node mudando a compressão em alguns
  bytes. **Portão que dá veredito diferente por ambiente não é portão** — ele
  reprova quem roda local e libera quem roda no CI, ou o contrário. Vale medir a
  diferença e, se for isso, comparar com uma tolerância explícita em vez de um
  número seco.

  **Não subi o teto**, que seria o conserto errado (§6.1): o número é a decisão,
  não o obstáculo.

---

## 🎯 O BLOCO DE 10/09 — o que o dono mandou de uma vez

> **Como isto chegou.** Ele mandou um **protocolo de trabalho** e **dois pedidos
> grandes** numa sequência só, com a ordem: *"grava tudo no backlog por ordem de
> prioridade… não deixa nada na memória da sessão"*. E avisou que **as condições
> do Brevo já estão feitas — falta testar**.
>
> As artes da identidade vieram **dentro da conversa**, que morre com a sessão.
> Foram salvas em [`docs/identidade/`](docs/identidade/README.md) antes de
> qualquer outra coisa, com o índice do papel de cada uma.

### A ordem que eu recomendo, e o porquê dela

Não é a ordem em que ele mandou. É a que a régua do projeto produz — camada mais
externa primeiro (§0.4), risco operacional antes de estética (§0), e **uma
dependência técnica real** que decide o resto:

| # | O quê | Por que nesta posição |
| --- | --- | --- |
| **0** | **Testar o Brevo** | 15 minutos, e ele já fez a parte dele. Vem antes por ser **curto**, não por ser mais importante |
| **1** | **AUDITORIA PROFUNDA DE SEGURANÇA** | o §0 é explícito: segurança antes de tudo. Consome **várias sessões** |
| **2** | **Identidade de ícones** | camada 1, e produz o **SVG mestre do raio** |
| **3** | **Reconstrução da Landing 3D + 2D** | camada 1, a maior — e **consome** o SVG mestre do item 2 |
| **4** | Integrar o protocolo às regras | é meta-trabalho; muda como eu trabalho, não o que o site faz |

> **A dependência que decide a ordem 2 → 3, e ela é técnica, não preferência.**
> O item 3 pede um *"novo raio 2D dividido em metade superior, core e metade
> inferior, em SVG"*. O item 2 pede *"um sistema visual único com adaptações
> técnicas"*. Fazer a Landing antes criaria um **segundo desenho do raio**, feito
> por outro caminho — exatamente a duplicação que os dois pedidos proíbem (§4,
> fonte única). O raio 2D da Landing tem que ser o **mesmo** SVG mestre, dividido.

---

- ⬜ `[25/09]` 🟢 **A FONTE DE DISPLAY — a única das três que ele quis mudar.**

  **`[25/09]` Ele fechou as outras duas:** *"já está bom como está, só a fonte
  que eu concordo em mudar; a tese da fenda e as artes já foi decidido há muito
  tempo atrás"*. **Ele está certo nas duas, conferido:** a fenda tem decisão
  escrita em `DECISOES.md` desde 04/09 (ele reprovou a fenda visível desde o
  primeiro quadro, e a versão de hoje nasceu daquilo), e a arte sempre foi
  **dele**, com composição minha — nunca foi pergunta aberta, era observação
  minha ocupando linha de decisão. O item estava **inchado**, e isso é meu erro.

  **O que sobra, e não é pequeno:** `Orbitron` é a fonte mais usada do mundo em
  "coisa gamer". Se o objetivo é não parecer mais um site gamer, é a alavanca
  mais forte — e a mais cara, porque `font-display` atinge o site **inteiro**.

  **Antes de trocar, eu preciso trazer:** 3 a 4 candidatas com amostra da marca
  "GamerHub" em cada, o custo em bytes de cada uma (§0.3 regra 1), e o que muda
  em tela pequena. Trocar fonte é fácil; escolher errado se paga em todas as
  telas. **Não começo sem ele ver as amostras.**

- ⬜ `[10/09]` 🟢 **4. Integrar o PROTOCOLO DE CONTROLE DE COMPLEXIDADE às
  regras.** *Documento estrutural → precisa de proposta (§6.2).*

  **O que ele traz de genuinamente novo** — o resto já existe, e duplicar regra
  cria duas fontes de verdade que divergem (§4):

  | Novo | O que muda |
  | --- | --- |
  | **FORA DO ESCOPO obrigatório** | hoje eu delimito o que **vou** fazer, nunca o que deliberadamente **não** vou |
  | **Descoberta ≠ ação** | *"descobrir um problema não significa receber autorização para corrigi-lo"* |
  | **Validação em camadas** | validar proporcional ao risco, em vez da bateria inteira sempre |
  | **Expansão mínima declarada** | quando expandir, nomear a **menor** expansão possível |
  | **Relatório final estruturado** | com *"o que NÃO foi alterado"* como campo fixo |

  **O conflito que eu preciso resolver por escrito, e não pode ficar implícito:**
  o `CLAUDE.md` §0 manda **tratar** dívida que está no caminho, e o §4 manda
  **dividir agora** arquivo que eu mesmo inchei. O protocolo §21 proíbe *"já que
  estou aqui"*. Não são a mesma coisa — sujeira que **eu acabei de fazer** é
  limpeza do meu próprio trabalho, não descoberta —, mas a fronteira precisa
  estar escrita, senão vira brecha nos dois sentidos: ou eu paro de dividir
  arquivo que inchei, ou eu uso o §4 como desculpa para refatorar o que quiser.

## 🔮 `[24/09]` O PRÓXIMO GRANDE BLOCO — Feed, Busca, Formatação e News

> **`[24/09]` A FASE 0 ESTÁ FEITA** e mora em
> [`docs/PLANO-FEED-BUSCA-NEWS.md`](docs/PLANO-FEED-BUSCA-NEWS.md) — os 14 itens
> (A–N) que ele exigiu, com o que foi **medido** separado do que é proposta.
> **Nada foi implementado:** nenhuma migration, nenhuma policy, nenhuma linha de
> produto. O que falta agora é **decisão dele** (item N do documento), e os cinco
> pontos estão na seção de decisões deste backlog.

### Os quatro eixos

| # | O que é | Ponto crítico |
| --- | --- | --- |
| **1** | **Feed sem categorias.** Tirar `dica`/`curiosidade`/`news` da EXPERIÊNCIA: seletor, filtro, badge, textos | ⚠️ **NÃO apagar `posts.category` do banco.** Primeiro auditar RPCs, triggers, policies, consultas, testes, componentes e histórico |
| **2** | **Busca de verdade.** Hoje ela filtra o que já está carregado no cliente — isso não é busca global | Avaliar Full Text Search do Postgres, índices, ranking, paginação. **Sem tecnologia externa** sem necessidade |
| **3** | **Formatação nos posts.** Negrito, itálico, tachado, listas, citação, link | ⚠️ **Nunca `dangerouslySetInnerHTML` com conteúdo do usuário.** Markdown controlado / AST / rich text estruturado — a escolha tem de ser justificada ANTES |
| **4** | **GamerHub News.** Área editorial separada de `posts`, com fontes, tags, ingestão e revisão humana | `posts.category = 'news'` **não** vira sistema editorial. Domínios diferentes, modelos diferentes |

### As 11 fases propostas por ele

`1` inventário e arquitetura · `2` tirar categorias do Feed · `3` busca nova ·
`4` formatação · `5` fundação do News · `6` painel editorial · `7` SEO ·
`8` ingestão de fontes · `9` IA assistente · `10` automação ·
`11` integração News ↔ comunidade.

> A ordem pode mudar **se a análise mostrar dependência melhor** — ele abriu
> essa porta explicitamente.

### O que ele quer de MODELO (nomes ainda não definitivos)

`news_sources` · `news_items_raw` · `news_articles` · `news_tags` ·
`news_article_tags`. Status: `draft` · `scheduled` · `published` · `archived`.
Rotas: `/noticias`, `/noticias/:slug`, `/busca?q=`.

### As regras que NÃO são negociáveis no bloco

- **Editorial é humano.** IA pode classificar, sugerir tag, resumir, achar
  duplicata e apontar afirmação sem fonte — **não publica sozinha**.
- **Direito autoral.** Não copiar artigo inteiro: fonte → verificação → redação
  própria → atribuição → link. Imagem não vai no Postgres.
- **Autorização é do banco.** `if (role === 'admin')` no frontend **não** é
  autorização; RLS/RPC decide. Toda tabela nova nasce com RLS pensada, não
  "depois".
- **Compatibilidade:** adicionar → migrar → validar → substituir → remover
  legado. Nunca apagar e descobrir depois quem dependia.
- **SEO:** o site é SPA Vite+React. Apresentar os trade-offs (SPA · pré-render ·
  SSR · SSG) **sem migrar de framework** por conta própria.

### `[24/09]` TERCEIRO PROMPT — permissões da UI, DOM administrativo e o resto

> **Gravado, e a Fase 0 dele também está feita** — a parte nova virou as seções
> **O**, **P** e **Q** do [`PLANO-FEED-BUSCA-NEWS.md`](docs/PLANO-FEED-BUSCA-NEWS.md).
> Ele repete e amplia os dois anteriores; aqui fica só **o que ele somou**.

**PARTE VI — permissões da UI.** Estudar `can('manage_users')`,
`can('ban_users')`, `can('publish_news')`… em vez de `isAdmin` espalhado.
Regras dele, na letra:

- **`can()` NÃO é a segurança** — a autoridade continua em RLS, RPC e
  constraint. *"O frontend pode ser manipulado."*
- **não converter cargo em permissão cegamente** — mapear
  `cargo → capacidade → componente → ação → regra do banco` antes.
- **não eliminar `role`** — badge, rank e hierarquia continuam sendo sobre
  identidade. O alvo é *"não usar role como mecanismo espalhado de decisão de
  capacidade"*.
- **não achatar a hierarquia** — `roleRank()` e `canModerate(viewer, alvo)`
  continuam; a pergunta é como convivem com `can()`.
- **auditar os serviços que recebem `isAdmin`** — sem remover cegamente.

**PARTE VI (29–30) — DOM administrativo.** Não entregar a usuário comum UI de
staff que só seria escondida por CSS. E ele mesmo escreve a ressalva: *"não
confundir isso com segurança"*.

**PARTE VII — permissões editoriais** (`create_news`, `publish_news`,
`archive_news`, `manage_news_sources`…), sem assumir que todo admin tem todas.

**PARTE VIII — banco.** Toda tabela nova nasce com RLS, policy, grant e modelo
de acesso explícito. `SECURITY INVOKER` por padrão; `DEFINER` só quando
necessário, com `search_path` e `EXECUTE` restrito.

**PARTES IX–XIV** — SEO, performance, testes, migração aditiva, documentação de
decisões e um plano de 14 fases.

**A regra final dele:** depois da análise, **PARE**. E ao implementar: uma fase
→ testar → auditar → regressão → segurança → build → documentar → apresentar →
só então continuar.

---

### `[24/09]` COMPLEMENTO — o comportamento de novas publicações no Feed

> Segundo prompt dele, para somar ao bloco acima. **Também não iniciado.**

**O problema, na letra dele:** *"500 novos posts foram publicados → aparece '500
novos posts' → usuário clica → o sistema tenta carregar os 500"*. Isso não pode
acontecer.

**O princípio, que ele quer tratado como requisito de arquitetura:**

```
"existem 500 novos posts"   ≠   "carregar 500 posts"

descoberta -> lote limitado -> renderização incremental -> próximo lote
```

| Requisito | O que ele pede |
| --- | --- |
| **Contador limitado** | *"Há novas publicações"* ou *"+20"* — o número mostrado não precisa ser o total do banco |
| **Tamanho de lote** | 10–20 é o exemplo dele, mas **tem de ser validado tecnicamente** contra card, imagem, celular, custo de render |
| **Posição de rolagem** | não jogar para o topo, não duplicar, não mover card que a pessoa está lendo. **Testar no celular** |
| **Sem duplicar** | ID único e/ou **cursor**; avaliar keyset pagination em vez de `OFFSET` |
| **Atualização é do usuário** | indicador discreto → ele decide → entra no topo |

**A frase que resume a experiência desejada:** o Feed deve parecer **vivo sem
parecer instável** — *"tem coisa nova aqui"*, não *"o app reorganizou tudo
enquanto eu lia"*.

#### Feed cronológico agora, ranking DEPOIS

Fase 1 é recência com paginação e carregamento incremental. A arquitetura tem de
**permitir** ranking futuro (recência, interação, pessoas seguidas, afinidade,
diversidade) **sem implementá-lo agora**. Ele foi explícito: *"não queremos um
clone do Instagram/TikTok"*, e *"não implementar coleta invasiva simplesmente
para ter dados"* — as métricas se definem quando houver necessidade real.

#### Os 10 passos que ele exige ANTES de mexer no Feed

descobrir como o mecanismo de "novos posts" funciona hoje · como a paginação
funciona · como os posts são ordenados · como o React mantém o estado da lista ·
como novas publicações são detectadas · **medir** o impacto de lotes maiores ·
achar duplicação · achar race condition · propor · **só implementar após
aprovação**.

> E vale o de sempre: a mudança do Feed continua sujeita a XP, comentários,
> likes, moderação, RLS e a todos os invariantes do `INVARIANTES.md`.

### O formato da primeira resposta (14 itens, exigido por ele)

A estado atual · B dependências · C problemas · D arquitetura · E banco ·
F frontend · G segurança · H SEO · I automação · J IA · K testes · L fases ·
M riscos · **N o que precisa da aprovação dele**.

---

## 🐛 `[24/09]` Achados da Fase 0 — defeitos que existem HOJE

> Saíram da análise do feed, nenhum foi relatado. São **bugs existentes**, não
> tarefas da feature — por isso entram como itens próprios e vêm antes do bloco
> (§0: bug na frente de feature).

### ✅ `[24/09]` Os dois defeitos do contador de novidade — FEITOS

**1. Ele prometia post que a recarga não trazia.** O handler de realtime
contava TODO `INSERT` em `posts`; a consulta do feed exclui
`live_kind IS NOT NULL`. Abrir uma live somava "1 nova publicação" para todo
mundo com a aba aberta, e o clique não trazia nada. Conferido no banco: o
`checar_palavras_bloqueadas` **escreve `hidden_at` no próprio INSERT**, então
post que nasce oculto tinha o mesmo efeito — não era hipótese.

**2. Ele contava EVENTOS, não posts.** Teto de **20** (`"20+"`), decisão dele
em 24/09 entre três saídas: número exato (exigiria consulta periódica por
usuário — custo), teto, ou só "há novidades".

As regras saíram para `src/lib/novidadeDoFeed.js`, puro, porque a concordância
com o `fetchFeedPosts` é **deriva entre dois lugares** (FASE 4 do §6) e precisa
de teste de contrato. `INV-TELA-006`.

**Provado reinjetando:** `entraNoFeed` sem `live_kind` → falhou no caso da
live · teto removido → falhou no acúmulo · **filtro novo na consulta que o
aviso ignora → falhou nomeando a coluna**. A terceira é a que impede a deriva
de voltar.

### ✅ `[24/09]` As 410 linhas de lixo de CI — APAGADAS, e a torneira fechada

**Aprovado por ele depois de eu explicar.** Dimensionado em `ROLLBACK` antes
(§5): 409 posts, autores **`claudestaff` e `claudetester`** (nenhuma conta de
gente), 138 comentários em cascata, 0 curtidas, 0 mídia, e **zero** linhas de
`lives_realizadas` apontando para eles — o registro de XP de live não foi
tocado. `admin_logs` também não: a trilha registra o que aconteceu, e apagar o
rastro seria mentir por omissão.

**`[24/09]` Correção do que eu disse antes:** eu havia relatado "403 de robô e
1 que parece de gente". Errado — o que sobrou era `[e2e-live …] live
automatica`, que minha heurística não pegou porque procurava "automatico" no
masculino. **Todos os 410 posts do banco eram de teste. Nenhum era de gente.**

**A torneira:** `cleanup_old_data()` (cron diário das 4h, que já era o lugar da
retenção das outras cinco tabelas) passou a apagar de verdade o post de teste
já soft-deletado há mais de 2h. Não criei cron novo — seria a espiral do §9.8.

**O padrão é apertado de propósito:** `^\[(e2e|painel|e2e-live) [0-9]{10,}\]`
exige o RELÓGIO que o `marcaDeTeste` escreve. Provado em ROLLBACK:
`[e2e coisas da vida] meu post` **não** casa, `[e2e 1790269082501] …` casa, e
o post apagado há 10 minutos sobrevive.

**Trava:** `retencaoDePostDeTeste.test.js` cruza `PREFIXOS_DE_TESTE` (JS) com o
padrão do SQL — prefixo novo de um lado e não do outro reprova nomeando ele.
Provada reinjetando os dois sentidos. `INV-CONTEUDO-005`.


- ⬜ `[24/09]` 🟢 **O portão de "nenhum arquivo acima de 300 linhas" NÃO
  enxerga `e2e/` nem `scripts/`.** *Achado ao fazer o split: o
  `fim-de-sessao.mjs` varre só `src/` e ainda exclui `__tests__`. Hoje há
  **dois arquivos acima do teto fora do alcance dele** — `e2e/portas-do-banco.mjs`
  (608 linhas) e `e2e/painel-admin.mjs` (384). O portão não está errado, está
  **incompleto**, e o efeito é o mesmo das cotas que estouram em silêncio: ele
  imprime "OK nenhum arquivo acima de 300" e a frase não é verdade. Duas saídas:
  ampliar a varredura (e aí os dois reprovam até serem divididos) ou dizer na
  mensagem QUAL pasta ele olhou. Prefiro ampliar — mas isso obriga a dividir os
  dois antes, então é trabalho, não ajuste.*

### ✅ `[24/09]` FASE 2 — o feed pagina por cursor (keyset)

**O defeito que morreu:** `fetchFeedPosts(30)` era consulta única. O post nº 31
era inalcançável a não ser por link direto, e nada na tela dizia isso.

**A forma foi ESCOLHIDA POR MEDIÇÃO, não por preferência.** Com 300 linhas
semeadas, página do meio:

| Forma | Plano | Linhas filtradas | Heap fetches |
| --- | --- | --- | --- |
| `ROW(created_at,id) < ROW(…)` | **Index Cond** | 0 | 20 |
| `.or(lt, and(eq, id.lt))` | Filter | 100 | 239 |
| `OR` só para o cursor nulo | Filter | 100 | 120 |

A segunda é o que o PostgREST conseguiria expressar — e é o custo do `OFFSET`
com outro nome. A terceira mostrou que **até o `OR` do "primeira página"**
derruba o índice, e é por isso que a RPC tem dois `RETURN QUERY` separados.

**Provado em ROLLBACK antes de aplicar:** 3 páginas somam 60 ids distintos com
**`created_at` IDÊNTICO** nos 60 — o caso que o desempate por `id` existe para
resolver — e zero repetidos, zero de fora. Faixa: `feed_pagina(5000)` devolve
50, `feed_pagina(0)` devolve 1. Cursor pela metade **estoura** em vez de
devolver vazio em silêncio. `anon`: negado.

**O lote é 20, e o que sustenta esse número não é medição** — o feed tem zero
posts vivos, então medir render por card não mediria nada. O que sustenta é
mais modesto e verificável: **é menor que os 30 de antes**, então nenhuma
página ficou mais pesada do que já era. A medição de verdade continua na fila.

**Split junto:** `postService.js` passou de 300 linhas e o que define **a forma
de um post** saiu para `src/services/postSelect.js`.

**Trava:** `paginacaoDoFeed.test.js`, as três falhas mudas — RPC virando
`DEFINER` (a RLS deixa de valer), os dois ramos virando um `OR` (fica certo e
lento), e o lote passando do teto (o "carregar mais" some com posts por ler).
As três provadas reinjetando. `INV-CONTEUDO-006`.

- ⬜ `[24/09]` 🟢 **Medir o tamanho do lote do feed com dado de verdade.** *O 20
  foi escolhido por ser menor que os 30 de antes, não por medição — o feed
  está vazio. O que medir, com dado semeado: custo de render por card (com e
  sem mídia, em aparelho lento), bytes por lote, e rolagem no celular. Muda um
  número só (`TAMANHO_DO_LOTE`), e a trava garante que ele não passe do teto
  da RPC.*

- ⬜ `[24/09]` 🟢 **O E2E não exercita a paginação nem o aviso de novidade.**
  *O `cicloDoPost` publica um post só, então nunca há segunda página; e o aviso
  de novidade exigiria duas sessões simultâneas. Os dois caminhos estão
  cobertos por trava de contrato e por prova em ROLLBACK, mas não por navegador
  — e é honesto dizer qual é qual.*

### ✅ `[24/09]` FASE 3 — a categoria saiu da experiência (a coluna FICA)

Saíram da tela: o **seletor** do compositor, o **filtro** do feed, o **badge**
do card, os textos que citavam "dicas, curiosidades, news", e o `category` do
corpo do `INSERT`. Saiu também do `POST_SELECT` — ela viajava em toda linha de
todo feed sem ninguém ler.

**A coluna `posts.category` continua no banco**, com o `DEFAULT 'dica'`.
Palavras dele: *"Não executar DROP COLUMN simplesmente porque a UI não usa mais
o campo."*

**A decisão de produto está escrita** em `docs/DECISOES.md`, com as três
alternativas descartadas e o trade-off aceito — perde-se filtrar por tipo, que
valia pouco (o filtro só via o que estava carregado) e que a busca de verdade
substitui.

**Trava:** `categoriaSaiuDaExperiencia.test.js` reprova as duas pontas — um
`DROP COLUMN` numa migration e o seletor voltando ao feed. Provada reinjetando
as duas, **mais um controle**: prosa que CITA o comando não pode acusar, senão
o comentário que explica a decisão acusaria a si mesmo. `INV-CONTEUDO-007`.

**`[24/09]` E a coluna FOI apagada no mesmo dia.** Ele desfez a condição —
*"esse prompt foi do ChatGPT, pode descartar"* — e autorizou sob outra:
*"se tiver de boa e não quebrar nada"*. Não estava de boa: o trigger
`log_post_event` lia `NEW.category`, e apagar antes de consertá-lo teria
derrubado o **publicar** (`record "new" has no field "category"`, medido em
ROLLBACK). A Fase 0 tinha dito que ninguém lia — errado, a varredura afogou o
sinal em `admin_logs.category`, que é homônima. Consertado primeiro, apagado
depois. A trava mudou de lado e agora impede o retorno da leitura.

### ✅ `[24/09]` Os 45 posts de prova — a paginação passou no teste dele, e eles saíram

Ele conferiu no navegador e o veredito foi *"a paginação funciona!"*. Os três
lotes, o botão sumindo no fim e a posição de rolagem: tudo conforme.

**Apagados de verdade** (não soft: era dado de teste meu, e o soft só os
esconderia deixando a tabela suja de novo). Dimensionado antes: 45 posts, autor
`claudetester`, **zero** comentários e **zero** curtidas presos neles.
Conferido depois: `posts` com 11 linhas, todas já soft-deletadas de rodadas do
CI — que a retenção diária limpa —, e o feed em zero.

> **Detalhe que me enganou por um segundo:** a consulta que apagava e contava no
> MESMO comando devolveu "56 restantes". Não era erro — num só comando, o CTE
> que apaga e o `SELECT` que conta veem a **mesma versão** da tabela, a de
> antes. A conferência de verdade exige uma segunda consulta.

- ⬜ `[25/09]` 🟢 **✅ APROVADO por ele — a busca acha palavra, não pedaço de palavra.** *`pg_trgm`
  ficou de fora: é outra extensão, outro índice e outra conta de custo. Hoje
  "config" não acha "configuração" — só a palavra inteira (com flexão e sem
  depender de acento). Entra quando houver acervo que justifique.*

### ✅ `[25/09]` FASE 5 — formatação de post, em ÁRVORE e não em HTML

Entraram `**negrito**`, `*itálico*`, `~~riscado~~`, `- lista`, `> citação` e
`[texto](link)`.

**A decisão de segurança é o coração da fase, e está justificada em
`DECISOES.md`** — o prompt exige justificativa. O caminho "óbvio" seria
Markdown → HTML + sanitizador; não foi esse. O analisador devolve uma **árvore**
e o componente vira cada nó num elemento React: **nenhuma string de HTML existe
no caminho**, então `dangerouslySetInnerHTML` não é "evitado com disciplina" —
não há o que passar para ele.

Sanitizar é o desenho oposto: produz-se o perigo e tenta-se tirá-lo depois.
Funciona enquanto o sanitizador conhecer todos os truques.

**O único ponto perigoso tem dono:** marcação não injeta script, `href` injeta.
Todo link passa por `safeExternalUrl` — a mesma função que fechou um XSS
armazenado real em agosto. URL recusada **vira texto**, não some.

**Zero mudança de banco.** `posts.content` continua guardando o texto como foi
digitado; a formatação acontece só ao desenhar. Post antigo atravessa e sai
igual — por isso não houve migration nem conversão de dado, e há um teste
exatamente para esse caso.

**Trava:** `formatacaoNaoVirarHtml.test.jsx` renderiza de verdade (jsdom) e
exige que `javascript:`/`data:`/`vbscript:`/`file:` não virem `href`, que
`<script>`, `<img onerror>`, `<iframe>` e `<svg onload>` apareçam como texto, e
que o `src/` inteiro siga em **zero** `dangerouslySetInnerHTML`. Provada
reinjetando as duas pontas. `INV-TELA-008`.

**`[25/09]` Os dois itens abaixo foram resolvidos no mesmo dia, por pedido
dele** — a formatação chegou ao comentário (com MENOS recursos, decisão dele) e
o compositor ganhou barra de ferramentas com prévia. Ver a seção do editor
rico, logo abaixo.

- ⬜ `[25/09]` 🔵 **A formatação não chegou ao MURAL.** *`MuralCard` continua
  desenhando texto puro. É trocar uma linha — mas o mural tem tom próprio
  (recado curto), e levar cor e tamanho para lá é decisão sua, não minha.*

### ✅ `[25/09]` O EDITOR RICO — barra, prévia, cor e tamanho

Pedido dele, com exemplos de outros editores: *"o site é pra gamers, o usuário
pode ter a liberdade de ser criativo, mexer em tamanho, cor, forma"* — e
*"nem tudo que tem na hora de postar precisa ter nos comentários"*.

**Não é WYSIWYG, e isso é decisão.** `contenteditable` (Slate, TipTap,
CKEditor) produz **HTML do usuário** — exatamente o que a fase 5 tirou do
caminho, com trava — e pesa centenas de KB num projeto que mede bundle por
byte. A barra **escreve marcação** e a prévia mostra o resultado: desenho do
GitHub e do Reddit, mesmo resultado prático, e o banco continua guardando
texto.

**Cor e tamanho vêm de lista FECHADA**, e essa é a parte que muda a natureza do
problema: até aqui a formatação escolhia entre elementos, agora o usuário
escolhe um **valor**. Guardar `#ff0000` e aplicar em `style` pareceria seguro
(o React recusa CSS malformado) — e seria **proteção acidental** (§1.3), que
some no dia em que o texto for para um e-mail ou um componente que concatene.

Ele escolhe um **nome**; o analisador confere; quem desenha traduz nome →
classe. Nome inventado **volta a ser texto**.

**Seis cores da marca e três tamanhos.** Paleta fechada é o que impede o feed
de virar arco-íris ilegível; o teto de tamanho é o que impede um post em corpo
gigante de empurrar o resto para fora da tela de quem só passava.

**O comentário recebe menos:** negrito, itálico, riscado e link. Sem cor,
tamanho, lista nem citação — conversa não é publicação.

**Trava:** `corETamanhoSaoFechados.test.jsx` — valor fora do vocabulário,
`style` montado a partir do nó, e o comentário ganhando poder que o post não
tem. Provada reinjetando as três. `INV-TELA-009`.

### ✅ `[25/09]` FASE 6 — a fundação do News (tabelas, RLS, grants, constraints)

Cinco tabelas: `news_sources`, `news_articles`, `news_tags`,
`news_article_tags` e `news_items_raw`. **Nenhuma linha de tela ainda** — esta
fase é a fundação.

**Quem pode o quê, e provado com papel real em ROLLBACK:**

| | resultado |
| --- | --- |
| comum vê publicado | **1** ✓ |
| comum vê rascunho | **0** ✓ |
| comum vê publicado com data FUTURA | **0** ✓ |
| comum escreve | **bloqueado** ✓ |
| comum vê fontes / ingestão | **0 / 0** ✓ |
| admin vê rascunho · escreve | **1 · consegue** ✓ |
| admin APAGA | **não** (só super) ✓ |
| `anon` vê artigo | **negado** ✓ |

**`news_items_raw` não tem policy nenhuma, de propósito:** é conteúdo de
terceiro, não verificado, possivelmente com direito autoral alheio. Ninguém lê
pela REST API — nem a equipe. O acesso será por RPC, com recorte decidido na
hora.

**Toda escrita exige `operador_ativo()`** — a lição do SEC-043 (admin banido ou
suspenso continuava mandando) nasce dentro de cada tabela nova.

### ✅ `[25/09]` SEC-052 — toda tabela nova nasce ABERTA, e o `BANCO.md` dizia o contrário

**Achado conferindo a fundação do News:** `news_items_raw`, criada **sem um
único `GRANT` escrito**, apareceu com `DELETE,INSERT,SELECT,UPDATE` para
`authenticated`.

Medido em `pg_default_acl`: `postgres` dá `arwdm` a `authenticated`, e
`supabase_admin` dá **tudo, inclusive a `anon`**.

**E a regra escrita afirmava o oposto** — *"o `ALTER DEFAULT PRIVILEGES` fecha a
tabela nova por padrão"*. É a pior espécie de documentação errada: ensina a
**não conferir**. Corrigida.

**Não vazou** — a RLS sem policy nega tudo. Mas é o SEC-005 na letra: *"o grant
já estaria lá esperando"*. Proteger por ausência de policy é proteger por
acidente.

**Varredura de classe:** duas tabelas no banco com zero policies —
`lives_realizadas` (já revogada, o desenho certo) e esta.

**O auditor ganhou a 5ª checagem**, em vez de um portão novo (§9.8) — e o CI já
o ouve pelo `contagem_de_achados_de_seguranca`. Contraprova em ROLLBACK: tabela
criada do zero nasceu com os quatro privilégios, **o auditor acusou**, a
contagem do CI foi a 1, e o `REVOKE` a zerou.

- ⬜ `[25/09]` 🟠 **✅ DECIDIDO (saída B): admin ESCREVE, super admin PUBLICA.**
  *"Gostei da opção b, pode ser ela mesma".*

  | Ação | Quem pode, a partir da decisão |
  | --- | --- |
  | criar rascunho · editar | admin · super admin · owner |
  | **publicar** | **só** super admin · owner |
  | apagar | só super admin · owner |

  **Por que B e não "como está":** rascunho é reversível; publicado é a voz do
  GamerHub falando com todo mundo, e erro editorial publicado não desfaz. Quem
  escreve deixa de ser quem aprova.

  **Por que NÃO o papel `editor` (saída C):** mexer em `role_rank` encosta em
  todo o sistema de hierarquia, e isso já derrubou o site três vezes. O ganho só
  aparece quando existir gente que escreve e não modera — hoje não existe.

  **O que entra junto, e é o que faz B funcionar:** um estado `in_review` e o
  botão "enviar para revisão". Sem isso o admin escreve e fica preso, sem
  caminho — seria a regra da INVERSA (§5) quebrada na estreia.

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[24/09]` 🟠 **O painel do Fundador autoriza por LITERAL, e as duas saídas
  têm risco.** *Achado na parte 1 da auditoria (SEC-051). **Não é
  vulnerabilidade** — o efeito é correto. É decisão de semântica, e por isso
  não decidi sozinho.*

  Cinco funções (`owner_get_stats`, `owner_get_users`, `owner_get_metrics`,
  `owner_get_audit_logs`, `owner_get_notifications`) autorizam assim:

  ```sql
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
  ```

  | Saída | O que ganha | O que arrisca |
  | --- | --- | --- |
  | **trocar por `is_owner()`** | some o literal que já causou 3 falhas; elas voltam a ser visíveis para o auditor | **muda semântica**: `is_owner()` é `role_rank >= 4`, o literal é `= 'owner'`. Um cargo futuro de rank 5 passaria num e não no outro |
  | **pôr `exige_operador_ativo()`** | cumpre o `INV-AUTZ-003` à risca | **risco de trancar o fundador fora do próprio painel, sem inversa** — e ninguém consegue puni-lo por RPC de qualquer forma (hierarquia estrita), então o ganho é ~zero |
  | **deixar como está** | zero risco | o literal continua, e as cinco ficam na lista de isenção do auditor |

  **Minha recomendação:** trocar por `is_owner()` **se** você quiser que um
  cargo futuro acima de owner herde o painel; manter o literal **se** o painel
  deve ser do fundador e de mais ninguém, para sempre. **Não** pôr a guarda de
  operador nas cinco — o ganho não paga o risco de lockout.

  Enquanto não decide, as cinco estão isentas **com o motivo escrito** na
  migration, e a trava reprova se a lista crescer.

  > **`[25/09]` Agora são CINCO FUNÇÕES + TRÊS POLICIES, e é a mesma decisão.**
  > A SEC-053 passou o auditor a olhar policy também, e ele achou
  > `site_config_owner_delete`, `_insert` e `_update` usando o mesmo
  > `role = 'owner'` literal. Eu cheguei a trocá-las por `is_owner()` e
  > **desfiz** — o argumento acima (muda semântica) vale igual para elas, e
  > fazer em silêncio o que este item classifica como decisão sua seria pior do
  > que não fazer. As três entraram na lista de isenção com o motivo, e a trava
  > `auditorDoBancoEhOuvido.test.js` cobre essa lista também.
  >
  > **Quando você decidir, a decisão vale para as oito de uma vez.**

  > ### ✅ `[25/09]` ELE DECIDIU: trocar por `is_owner()`, nas oito
  >
  > *"Pode fazer esse do is_owner"*. Vale para as **cinco funções** do painel e
  > para as **três policies** de `site_config`. Consequência aceita: um cargo
  > futuro de rank ≥ 4 herdaria o painel do Fundador — é o que a troca
  > significa, e ele decidiu sabendo.
  >
  > **NÃO entra junto:** pôr `exige_operador_ativo()` nas cinco. A recomendação
  > contra continua de pé (risco de trancar o fundador fora do próprio painel,
  > sem inversa) e ele não pediu isso.

- ⬜ `[18/09]` 🟠 **AUDITORIA E2E — o que falta cobrir.** *Pedido dele em 18/09:
  "não considere 'a função/RLS/trigger está correta' equivalente a 'o fluxo do
  GamerHub está seguro'".*

  **Feito nesta rodada:** `e2e/lives.mjs` — criar, encerrar, reativar e apagar
  live pela interface, conferindo a TELA contra o ESTADO PERSISTIDO com o token
  real do usuário. Roda no CI junto do `fluxos`.

  **`[24/09]` Feito: likes.** `e2e/curtir.mjs`, chamado de dentro do
  `fluxos.mjs`, no post da própria execução. O que ele prova e nenhum teste
  anterior provava: a curtida é **otimista** (`src/lib/like.js` acende o
  coração antes de o servidor responder), então conferir o número logo depois
  do clique não prova nada — a prova é **recarregar**. E o descurtir é o lado
  perigoso: `DELETE` negado pela RLS devolve **204 e zero linhas, sem erro**,
  o cliente não reverte, e a tela apaga uma curtida que continua no banco.
  Nenhum status HTTP pega isso. Virou `INV-TELA-004`.

  **`[24/09]` Feito: respostas em thread.** `responderEEsperarAninhada`, no
  próprio `e2e/comentar.mjs` — o cabeçalho dele dizia desde 05/09 que a
  resposta aninhada NÃO era coberta, e ficou verdade por 19 dias. A assertiva
  que importa não é o texto aparecer: é o **recuo**. Resposta que entra na
  lista como comentário solto tem o `INSERT` aprovado, o texto na tela e só a
  estrutura errada — nada estoura. Conferido por **estrutura** — o bloco do
  comentário pai tem de CONTER o texto da resposta. Comparar a POSIÇÃO dos dois
  textos foi a primeira tentativa e reprovou uma resposta CERTA: o recuo do
  bloco convive com um avatar menor na resposta, e a soma pode dar para
  qualquer lado. Envia por **Enter**
  porque os dois compositores têm o mesmo `aria-label` no botão, e o caminho de
  teclado não era exercitado por roteiro nenhum. `INV-CONTEUDO-003`.

  **Falta**, na ordem em que ele listou: live chat · atualização de perfil ·
  notificações na tela · o comportamento depois de ocultar (não só apagar) ·
  usuário comum × moderador na mesma tela.

  **`[24/09]` O corte foi FEITO:** o bloco do ciclo do post virou
  `e2e/cicloDoPost.mjs` (148 linhas) e o `fluxos.mjs` caiu de 288 para **189**.
  Ele ficou com a SESSÃO — entrar, alcançar cada rota, ser negado no painel,
  sair — e os fluxos que faltam cabem no roteiro do conteúdo.

  **Por que não foi tudo agora:** cada fluxo desses escreve em produção (o CI
  usa contas descartáveis reais), e um E2E que cria dado e falha no meio deixa
  sujeira para gente de verdade ver. Um por vez, com limpeza provada.


- ⬜ `[19/09]` 🟢 **RPC administrativa NOVA não entra sozinha na guarda da
  SEC-043.** *`[24/09]` **Rebaixado de 🟠 para 🟢**: a parte que importava foi
  fechada pela SEC-050.*

  **O que mudou.** O `auditoria_de_operadores()` sempre soube responder — ele
  varre `pg_proc` e acha RPC administrativa sem `exige_operador_ativo()`. O que
  faltava era **alguém ouvi-lo**: a função tinha `EXECUTE` revogado de todos, e
  só rodava quando eu perguntava à mão. Hoje o `e2e/portas-do-banco.mjs` a
  consulta pelo mensageiro, com a anon key, **a cada PR**. Provado: uma RPC
  administrativa nova sem a guarda leva o contador de 0 para 2.

  **O que sobra, e é pouco:** a detecção é por **heurística de corpo** (a função
  menciona `role_rank`/`is_staff`/`is_super`/`is_owner`). Uma RPC administrativa
  que decidisse permissão por outro caminho não seria vista. Não conheço nenhuma
  assim hoje; se aparecer, o jeito é a lista de exceções **com motivo escrito**,
  que a trava `auditorDoBancoEhOuvido.test.js` já vigia.

- ⬜ `[18/09]` 🟠 **Toda função nova nasce chamável por `anon`.** *`[24/09]` O
  dono autorizou fechar, e a MEDIÇÃO mostrou que a correção na raiz **não é
  alcançável com a minha credencial**. Registrado aqui para ninguém tentar de
  novo pelo mesmo caminho.*

  **O estado de hoje é bom:** das 100 funções em `public`, **3** são alcançadas
  por `anon`, e as três se justificam — `username_disponivel` (a tela de
  cadastro, que roda sem conta), `contagem_de_migrations` (o portão
  `espelho-de-migrations` a chama **com a anon key**, conferido no script) e
  `role_rank` (aparece em policy; revogar é a classe das 3 quedas do
  `POSTURA.md`, então **não** foi tocada).

  **O problema é a função NOVA**, e o mecanismo foi isolado em `ROLLBACK`:

  | Tentativa | Resultado medido |
  | --- | --- |
  | `ALTER DEFAULT PRIVILEGES FOR ROLE postgres … REVOKE … FROM anon` | pega — o `anon=X` sai do `pg_default_acl` |
  | mas a função nova continua aberta | ela nasce com `=X/postgres`, ou seja **PUBLIC** tem `EXECUTE` |
  | `… REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` | **não pega** — o `pg_default_acl` volta inalterado |
  | `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin …` | **`permission denied to change default privileges`** |

  Existem **dois** `pg_default_acl` de função em `public` (dono `postgres` e
  dono `supabase_admin`), e o segundo é intocável por mim.

  **O que fica como caminho, em ordem de força:**

  1. ✅ **FEITO `[24/09]` — SEC-050.** A detecção está no CI: o
     `contagem_de_achados_de_seguranca()` devolve **quantas** funções o `anon`
     alcança fora da lista branca, e o `e2e/portas-do-banco.mjs` o chama com a
     anon key. Devolve **número**, não nomes — assim não vira mapa para quem
     chamar de fora. Provado: uma função nova aberta leva o contador de 0 a 3.
  2. **Ação do dono / suporte Supabase** — mudar o default do `supabase_admin`
     é fora do meu alcance. Só vale abrir se a detecção mostrar que o caso é
     frequente.
  3. **O que já segura hoje:** cada função nova sai com `REVOKE EXECUTE`
     explícito na própria migration, e o `funcaoDeTriggerNaoEhRpc.test.js`
     cobre a classe dos triggers.

  > **Continua ABERTO, e o motivo é preciso:** a prevenção na raiz não foi
  > feita — função nova **ainda nasce** alcançável pelo `anon`. O que mudou é
  > que a brecha deixou de ser silenciosa: o CI reprova no mesmo PR. Chamar isso
  > de fechado seria exatamente o que o §1.1 proíbe.

- ⬜ `[18/09]` 🔵 **`lives_realizadas` é append-only e o E2E escreve nela a cada
  execução.** *Achado enquanto eu limpava as 3 órfãs do N16.*

  Cada `e2e/lives.mjs` no CI acrescenta **uma linha permanente**. Ela é órfã por
  desenho (o post é apagado pelo cron), então nada a remove — nem cascade, nem
  retenção.

  Hoje é ~1 linha por PR e não custa nada. Mas é exatamente o padrão que a
  faxina (§6.1, item 5) manda vigiar: tabela append-only sem retenção, igual a
  `admin_logs`, `login_attempts` e `live_chat`.

  **Por que não resolvi agora:** a saída óbvia — o E2E apagar a própria linha —
  exigiria dar `DELETE` em `lives_realizadas` para `authenticated`, que é a
  régua de papéis ao contrário. A saída certa é entrar no
  `cleanup_old_data()` (o cron das 04:00), com uma regra de retenção que valha
  para **todo mundo**, não só para a conta de teste. Isso é decisão de produto:
  *por quantos meses a prova de que uma live aconteceu precisa existir?*

  As 3 órfãs de hoje já foram apagadas — eram minhas, do `claudetester`.

- ⬜ `[18/09]` 🔵 **A proteção contra senha vazada está DESLIGADA — e não dá
  para ligar no plano Free.** *Decisão de CUSTO, não ação de painel.*

  Apareceu no Security Advisor durante a auditoria das 48:
  `auth_leaked_password_protection` desligado. O Supabase checaria a senha
  escolhida contra o HaveIBeenPwned e recusaria as que já vazaram.

  > **`[18/09]` EU ESCREVI ESTE ITEM ERRADO E O DONO QUASE PAGOU POR ISSO.**
  > A primeira versão era um passo a passo mandando ele abrir o painel e ligar
  > um toggle. **O toggle não existe no plano Free.** A documentação oficial é
  > explícita: *"Leaked password protection is available on the **Pro Plan and
  > above**"* — conferido em 18/09 em
  > https://supabase.com/docs/guides/auth/password-security
  >
  > O item `[22/08]` já dizia isso — *"só no plano Pro (~US$25/mês)"* — e eu
  > criei um segundo item contradizendo o primeiro, sem conferir nenhum dos
  > dois. Os dois estão unificados aqui.
  >
  > **A falha é exatamente a que o §9.12 descreve:** *"passo a passo sem essa
  > conferência é armadilha bem formatada"*. E ela veio no mesmo dia em que eu
  > declarei ao dono que tinha pulado a pesquisa de documentação no prompt das
  > 48 — ou seja, não foi descuido isolado: foi a mesma omissão, duas vezes.

  **O que o Advisor não diz:** ele marca o recurso como desligado mesmo em
  projeto que não pode ligá-lo. O alerta é genérico, não é acionável aqui.

  **Custo:** ~US$25/mês (Pro). **Decisão dele.** Enquanto não for, a política
  de senha do próprio site é o que protege — ver o item `[12/09]` sobre a
  política do painel de Auth nunca ter sido conferida.

- ⬜ `[11/09]` 🟠 **O contador de tentativas de login nunca foi LIGADO.** *Ação
  de painel — eu não alcanço.*

  Queixa do dono: *"não tá contando os logins errado"*. **Ele está certo, e
  medido:** `login_attempts` tem **0 linhas** e `max(updated_at)` é *nunca*. Nos
  logs do GoTrue das últimas 24 h houve **9 logins** e o único `run_hook`
  registrado foi o da `send-email` — o de verificação de senha não aparece
  nenhuma vez.

  **NÃO é "faltou clicar", e eu afirmei isso antes de conferir.** O
  `Password Verification Attempt` **não existe no plano Free**: a tabela da
  [documentação de Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
  o marca como `Teams and Enterprise`, enquanto quatro outros aparecem como
  `Free, Pro`. O projeto **já sabia** — está num comentário em
  `src/pages/Login.jsx` desde 28/08 — e eu diagnostiquei pelo banco sem ler o
  comentário que estava no caminho.

  A função existe, está correta e foi **provada em ROLLBACK** (4 erradas contam,
  a 5ª bloqueia por 15 min, acertar limpa). Ela simplesmente **nunca é chamada**.

  **A DECISÃO É SUA, e são duas opções honestas:**

  | Opção | O que muda | Custo |
  | --- | --- | --- |
  | **A. Tirar a promessa da tela** | a mensagem "Conta bloqueada por excesso de tentativas" sai, e o site deixa de prometer o que não faz. A função e a migration ficam guardadas, prontas para o dia do upgrade | zero |
  | **B. Subir de plano** | o hook liga e o contador passa a valer | mensalidade do Supabase |

  **O que está fora:** contar do lado do cliente. Foi exatamente a brecha
  fechada em 28/08 — qualquer um forjava o bloqueio de qualquer e-mail sem
  saber a senha.

  Enquanto isso, quem protege contra força bruta é o rate limit do próprio
  GoTrue, que é server-side e não depende desta tela.

- ⬜ `[11/09]` 🟡 **A foto do remetente do e-mail é a letra "G".** *Ação do dono
  — e o caminho não é o que este item dizia até hoje.*

  **Correção de informação errada minha (§6.2):** este item afirmava que era
  *"configuração no painel do Brevo (o avatar do remetente)"*. Não é — o Brevo
  não controla isso. O que o Gmail desenha ao lado do remetente vem do **perfil
  Google do endereço que assina o `From:`**, ou de **BIMI**. Sem um dos dois, o
  Gmail cai na inicial do nome de exibição — e o nosso é `GamerHub`, daí o "G".

  Os dois caminhos, com o custo de cada um, estão escritos em
  [`docs/OPERACAO.md`](docs/OPERACAO.md).

- ⬜ `[05/09]` 🟢 **O lembrete de auditoria não enxerga fase parada.** Ele
  compara a data do relatório **mais recente** com 90 dias. Como as Fases 2 e 4
  rodaram em 05/09, ele fica quieto — **mesmo com as Fases 1 e 3 paradas desde
  21/08**. O relógio dele não distingue fase.

  Conserto pequeno: guardar a fase no nome do arquivo (já está: `fase4-...`) e
  medir a idade **por fase**. É limitação minha, encontrada por mim, e está
  aqui para não depender de eu lembrar.

- ✅ `[05/09]` 🟠 **Rodar FASE 1 e FASE 3 da auditoria** — **FEITAS em 10/09**.
  Relatório em `db/2026-09-10-auditoria-fases-1-e-3.md`.

  **Fase 1:** build/lint/testes limpos; zero `dangerouslySetInnerHTML`, zero
  `target="_blank"` sem `rel`, zero `window.confirm`, zero emoji, zero timer ou
  canal sem cleanup, zero botão só-ícone sem nome acessível. O `innerHTML` do
  `supabase.js` e o `<iframe src>` do `EmbedPlayer` foram auditados e são
  seguros — no segundo, porque as regexes de `lib/embed.js` capturam o id em
  classe fechada que não aceita `/`, `?`, `#`, `:` nem `@`.

  **Corrigido:** duas corridas de `useEffect` (`useBloqueioDeLogin` e
  `FeatureGate`) — resposta antiga podia pintar a tela do estado novo.

  **Fase 3:** RLS ligada nas **29** tabelas, zero FK sem índice, a lista da
  trava `tabelasSemUpdate.js` confere com o banco linha a linha, e nenhuma
  tabela que o site apaga está sem policy de DELETE.

  **Corrigido:** `profiles` **nunca tinha sido analisada** (`last_analyze` e
  `last_autoanalyze` NULL) — a estatística dizia 0 linhas onde há 5, e ela é
  lida em toda policy de RLS. `ANALYZE` em 10 tabelas.

- ⬜ `[10/09]` 🟡 **`blocked_words` ficou SEM PORTÃO do lado logado.**

  O `e2e/portas-do-banco.mjs` vigiava a lista de palavrão pelo lado anônimo. O
  SEC-004 fechou `blocked_words` para `anon` — corretamente: os quatro lugares
  que chamam `useBlockedWords` e o painel de moderação vivem **todos** atrás de
  `RequireAuth`, conferido rota a rota no `App.jsx`. `authenticated` manteve as
  5 colunas.

  **O que se perde:** aquele arquivo roda com a chave anônima, então ele deixou
  de conseguir enxergar a tabela. O risco que a linha guardava continua vivo do
  lado logado — se a lista sumir, `checkContent` **aprova tudo em silêncio**, e
  é a falha muda clássica (§1.5): nada estoura, nada loga, e a moderação
  simplesmente para de acontecer.

  **Onde ele caberia:** o job `fluxos autenticados` do CI já faz login. Uma
  asserção lá — "a wordlist carregou com N > 0 palavras" — fecharia o buraco
  sem credencial nova.

- ⬜ `[10/09]` 🔵 **A consulta de índice não usado da §6.1 é inócua neste
  volume.** `select ... where idx_scan = 0` devolve **36 dos índices**, e o
  motivo está medido: `posts` tem 188 linhas, `profiles` 5, `reports` 2. Em
  tabela desse tamanho o planejador escolhe varredura sequencial e **está
  certo** — o índice não é inútil, é para quando crescer.

  Não é para "consertar" agora: derrubar índice com base nisso seria o erro.
  Fica anotado para ninguém reabrir a mesma conclusão daqui a dois meses, e
  porque o sinal só passa a valer depois de tráfego real.

- ⬜ `[05/09]` 🔵 **A tela de APARELHOS CONECTADOS.** *Ideia do dono, nascida
  de dentro da decisão do logout — ver
  [VISAO-DE-FUTURO.md](docs/VISAO-DE-FUTURO.md).*

  Lista de sessões abertas com "encerrar esta". É a peça que faltava para o caso
  *"tem alguém na minha conta"* ser **visível** — hoje o site não tem como
  contar isso a ninguém. **Três coisas precisam ser respondidas antes**, e uma
  delas é dele: a região que ele citou é geolocalização por IP, ou seja,
  terceiro novo e dado pessoal novo na política de privacidade.

- ⬜ `[04/09]` 🟢 **Música no painel do Fundador.** *Ideia do dono; as três saídas
  que ele imaginou têm impedimento — ver
  [VISAO-DE-FUTURO.md](docs/VISAO-DE-FUTURO.md).*

  Ler a biblioteca do celular dele pelo site não é possível (não existe API para
  isso). Spotify e YouTube esbarram em conta paga, regra de uso e privacidade.
  O caminho limpo é o mesmo do som ambiente que já existe: **um arquivo curto,
  hospedado por nós, com licença clara**.

- ⬜ `[03/09]` 🟢 **Decidir se o site precisa de Service Worker para o caso
  offline.** *É o terceiro elo da corrente que o dono relatou, e o único que
  não deu para consertar.*

  **A corrente que ele viu, com o aparelho offline:**

  | O que aparecia | Estado |
  | --- | --- |
  | "sem acesso ao banco" | ✅ correto, e continua |
  | "Algo deu errado" | ✅ **corrigido em 03/09** — virou "Sem conexão", e não vai mais para o Sentry |
  | página de offline do navegador | ⬜ **este item** |

  **Por que o terceiro é diferente:** ele acontece quando a pessoa **recarrega**
  estando offline. Não é mensagem errada nossa — é o navegador não ter como
  carregar o app, porque nada está guardado localmente. Só um Service Worker
  resolve, servindo o app do cache.

  **O que ele custaria, dito antes:** um SW é código que fica *entre* o site e
  a rede, e erra caro — cache velho servido para sempre é o defeito clássico,
  e o conserto exige a pessoa limpar o navegador. Ele também muda como o deploy
  chega: o §0.2 já registra que **a Vercel conta deploy**, e um SW mal
  configurado faz o visitante continuar na versão antiga sem saber.

  **Minha recomendação: não agora.** O ganho é uma tela melhor num caso raro
  (recarregar offline); o risco é servir versão velha em todos os casos. Com 5
  usuários não paga. Registrado para quando houver volume — e para não ser
  redescoberto como bug.

- ⬜ `[28/08]` 🟢 **Conferir os pisos novos com o uso real, em algumas semanas.**
  *Não é decisão pendente — a decisão foi tomada em 28/08 e está no ar (v14).*
  `violence` foi aposentada e `violence/graphic` subiu de 0.80 para 0.95. O
  raciocínio inteiro está em [MODERACAO-IA.md](docs/MODERACAO-IA.md).

  **A amostra até agora** (toda a medição que existe, 5 posts):

  | Imagem | `violence` | `violence/graphic` | Fila? |
  | --- | --- | --- | --- |
  | comum (2 posts) | 0.000 – 0.001 | 0.000 | não |
  | "violenta", escolha do dono | 0.834 | 0.414 | não |
  | print de jogo (1 imagem) | — | **0.854** | não (era sim) |
  | prints de jogo (4 imagens) | **0.943** | ≤ 0.943 | não (era sim) |

  **Duas leituras honestas disso.** A boa: o modelo separa muito bem — imagem
  comum dá 0.000 e conteúdo violento sobe para a casa dos 0.8. A que incomoda:
  **nada que medimos até hoje cruzou 0.95**, então a fila de violência está,
  na prática, dormente. Isso é o efeito pretendido para print de jogo, mas
  ainda **não foi provado** que gore de verdade cruza esse piso — e não dá para
  provar postando gore real de propósito.

  Daqui a algumas semanas, olhar os logs e responder:

  | Se… | Então |
  | --- | --- |
  | a fila voltar a encher de print de jogo | 0.95 ainda está baixo |
  | passar gore evidente e a fila seguir vazia | 0.95 está alto — descer para ~0.88, acima do 0.854 medido |

  Onde ler: painel da Supabase → Edge Functions → `moderate-image` → Logs,
  linhas `[moderate-image] ... | notas: ...`.

  > **Conferido em 02/09, e o número não decide nada ainda:** a fila tem 20
  > itens, **todos resolvidos** (15 `approved`, 5 `rejected`), **zero
  > pendentes** — e nenhum item novo entrou desde 28/08. Fila vazia com uso
  > parado não distingue "o piso está certo" de "ninguém postou". A conferência
  > continua aberta porque ela depende de uso real, não de uma consulta.

- ⬜ `[29/08]` 🟢 **Conferir a fila `Não analisado` daqui a alguns dias.**
  *Não é pendência de código — o caminho está fechado. É a conferência que diz
  se o número escolhido foi o certo.*

  **O que ficou pronto:** a moderação de vídeo funciona (confirmado em produção,
  `analisadas=3/3`), e o vídeo que falhar **nos dois caminhos** vai para a fila
  como `sem_analise`.

  **O que conferir**, no painel de Moderação:

  | Se… | Então |
  | --- | --- |
  | a fila `Não analisado` seguir vazia | o plano B está dando conta — nada a fazer |
  | aparecer um item de vez em quando | funcionando como projetado; o motivo no item diz qual navegador falhou |
  | encher | o plano B não está cobrindo o caso real, e aí o motivo (que vem com as duas metades) aponta onde |

  > **Conferido em 02/09:** os 20 itens da fila são `post` (13), `chat` (6) e
  > `comment` (1) — **nenhum `sem_analise`**. Mesma ressalva do item acima:
  > nada foi postado desde 28/08, então o zero é falta de amostra, não prova.

- ⬜ `[28/08]` **Contar falha de login de verdade exige plano Team.** A função
  `hook_de_verificacao_de_senha` está no banco, testada e com `EXECUTE` só para
  o `supabase_auth_admin` — mas o *Password Verification Attempt hook* aparece
  cinza no painel: **"Team or Enterprise Plan required"**. O outro caminho
  também está fechado: `auth.audit_log_entries` está vazia, zero linhas desde
  sempre. **O que já está resolvido:** ninguém consegue mais fabricar alerta de
  segurança, e força bruta continua barrada pelo rate limit do próprio GoTrue.
  O que falta é só a contagem para avisar a equipe. Mesma família do HIBP —
  decisão de custo, não de código. Ver [SEGURANCA.md](docs/SEGURANCA.md).



- ⬜ `[29/08]` 🟢 **Decidir as outras abas da navegação lateral da landing.**
  Hoje ela tem as cinco seções da página, "Sobre" e "Entrar". Você disse que não
  sabia o que sugerir além do "Sobre" — quando quiser, trago uma proposta do que
  costuma fazer sentido nesta fase (regras da comunidade, contato, novidades) e
  você corta o que não quiser.

- ⬜ `[29/08]` 🟢 **Avaliar um rodapé para o site logado.** A decisão foi
  começar pela landing (camada 1). O site logado tem barra lateral e cabeçalho
  próprios, onde rodapé grande disputa espaço com o conteúdo — pode ser que o
  certo lá seja uma versão bem enxuta, ou nenhum.

## 🟠 Importante — dá para fazer

- ⬜ `[18/09]` **Revogar as colunas derivadas de `posts` — a SEGUNDA camada da
  SEC-027.** *Só depois do deploy desta branch, e a ordem importa.*

  A SEC-027 fechou a manipulação com um trigger. O trigger funciona, mas é
  **camada única** — e a lição do SEC-025 é exatamente essa: desabilitado,
  renomeado, ou num caminho onde `current_user` não seja `authenticated`, a
  porta reabre em silêncio.

  ```sql
  REVOKE UPDATE (was_live, expires_at, created_at, live_ended_at,
                 live_kind, live_kind_label, id, user_id) ON public.posts FROM authenticated;
  REVOKE INSERT (was_live, expires_at, created_at, live_ended_at,
                 deleted_at, hidden_at, edited_at)        ON public.posts FROM authenticated;
  ```

  **Por que não foi junto:** até o deploy desta branch o `postService` ainda
  manda `was_live` no corpo do INSERT, e revogar antes faria **publicar post
  parar** na janela entre a migration e o deploy. O código já foi corrigido —
  falta o deploy chegar na `main`.

  **O que NUNCA pode entrar nesse revoke:** `hidden_at` e `deleted_at` no
  UPDATE. A moderação grava `hidden_at` por UPDATE direto de tabela e admin
  também é `authenticated` — revogar derruba o painel.

- ⬜ `[18/09]` 🔵 **326 posts no banco, ZERO vivos.**

  Encontrado durante o pentest: **todos** os posts têm `deleted_at` preenchido.
  É consistente com um site novo (o conteúdo real ainda não existe) somado ao
  e2e, que cria e apaga post a cada rodada de CI — as contas `claudetester` e
  `claudestaff` sozinhas respondem por **322** deles.

  Não é achado de segurança e não mexi em nada. Está aqui porque é o tipo de
  número que ninguém confere e que explicaria um feed vazio, e porque agora o
  XP depende dele (SEC-028): post apagado deixou de pagar.



- ⬜ `[23/08]` 🟠 **Migrar o envio de email para fora do Gmail.** *`[05/09]` O
  CÓDIGO JÁ ESTÁ PRONTO — o que falta é ação de painel, e ela é do dono.*

  **O que mudou em 05/09.** A função passou a aceitar **dois caminhos**:
  se `SMTP_HOST` existir ela usa o relay; se não existir, segue no Gmail
  exatamente como hoje. Mudança aditiva (§7): o caminho feliz de agora não foi
  tocado, e voltar atrás é **apagar um segredo**.

  Isso torna a migração uma ação de painel — sem deploy, sem coordenar horário,
  sem mexer em código com o cadastro possivelmente quebrado.

  **O que depende do dono, na ordem:**

  1. criar conta no Brevo e **verificar um remetente**;
  2. **a pergunta que decide o custo:** o Brevo aceita remetente verificado
     **sem domínio próprio**? Se sim, custa **R$0**; se exigir domínio, são os
     ~R$40/ano que ele já recusou uma vez. *Eu não consegui confirmar isso —
     a documentação deles não abre para leitura automática, e prefiro dizer
     isso a repetir de memória um número que pode ter mudado.* Ele vê em dois
     minutos ao criar a conta;
  3. pegar as credenciais SMTP e colar em **Supabase → Edge Functions →
     Secrets**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e
     `SMTP_FROM`. **A senha não passa por aqui** — mesma regra do Turnstile;
  4. me avisar para eu reimplantar a função e conferir o primeiro envio.

  **Como provamos que funcionou:** um cadastro de teste. Se falhar, a mensagem
  em `admin_logs` agora diz **qual caminho** estava em uso — antes ela mandaria
  investigar o provedor errado.

  **O que continua sem prova até lá:** que o e-mail chega, que a senha está
  certa e que o remetente foi aceito. Nada disso é verificável do repositório;
  a trava `envioDeEmailTemDoisCaminhos.test.js` só garante que as propriedades
  do código não sumam.

  > **Por que isto NÃO é urgente por volume, medido em 05/09:** `auth_register`
  > tem **12 registros na vida do projeto**, o último em 28/08. A cota de ~500/dia
  > não está perto de estourar. O que mantém o item em 🟠 é outra coisa: se o
  > Google travar a conta por envio automatizado, **cadastro e recuperação de
  > senha param em silêncio** — e o site continua de pé, aparentando funcionar.


## 🟢 Recomendado

- ⬜ `[18/09]` 🟢 **A tela de lives diz "1 ao vivo" e "Nenhuma live acontecendo
  agora" ao mesmo tempo.** *Achado pelo E2E novo, não por análise de código.*

  As abas de `/lives` são: `Da comunidade` (`!live_kind`, **a padrão**),
  `Gameplays`, `Reacts`, `Outros`. O `LiveGoModal` SEMPRE define um `live_kind`
  (padrão `gameplay`), então **uma live criada por "Ficar ao vivo" nunca aparece
  na aba padrão**.

  Resultado, com a tela recém-carregada: o cabeçalho conta `1 ao vivo`, a aba
  `Gameplays` mostra `(1)`, e o miolo diz *"Nenhuma live acontecendo agora —
  volte mais tarde!"*.

  **Não é defeito**: separar live de jogador de live da comunidade é de
  propósito. É leitura de tela. Quem acabou de ficar ao vivo cai numa aba que
  diz que não tem nada.

  Saídas possíveis (decisão de produto): abrir na primeira aba **que tem
  conteúdo** · esconder a contagem quando a aba está vazia mas o site não ·
  trocar o texto vazio por *"nenhuma aqui — veja em Gameplays (1)"*.


- ⬜ `[12/09]` 🟢 **A falha do `e2e/fluxos.mjs` manda investigar o lugar
  errado.** *Achado hoje, custou alguns minutos de investigação minha.*

  **O que aconteceu.** O job `fluxos autenticados` reprovou dizendo *"o portão
  de boas-vindas NÃO apareceu depois do login"*, e listou três coisas para
  conferir no portão. Nenhuma era a causa: o dump da tela mostrava a URL ainda
  em `/login` e o botão em **"AGUARDE..."** — o `signInWithPassword` nem tinha
  voltado. O portão não apareceu porque **o login não aconteceu**.

  **Por que importa.** É a regra §1.5 na letra: *toda mensagem de erro tem que
  ser verdadeira*. "Você não tem permissão" quando o motivo é outro é pior do
  que "erro desconhecido", porque manda alguém investigar permissão por horas.
  Aqui o alvo errado é o portão.

  **O conserto:** antes de escolher a mensagem, desambiguar os dois estados —
  ainda em `/login` com o botão travado (**o login não voltou**, quase sempre
  rede/serviço externo) × já autenticado e o portão ausente (**a causa que as
  três dicas descrevem**). Mesma disciplina do "0 linhas é AMBÍGUO" do §1.5.

  **Foi flake nesta vez** — o re-run do MESMO commit passou nos 6 jobs, e
  nenhum dos 17 arquivos do PR #195 está no caminho do login. Mas o teto de
  2,5 s para uma chamada de rede a serviço externo vai reprovar de novo, e a
  próxima pessoa vai reler as mesmas três dicas erradas.

- ⬜ `[05/09]` 🟢 **A query de índice nunca usado do §6.1 não serve neste
  volume — e isso precisa estar escrito antes de alguém agir nela.**

  Rodada hoje, ela devolveu **72 índices** com `idx_scan = 0` — **incluindo as
  chaves primárias de quase toda tabela**. Não é dívida: é que o site tem poucos
  usuários e a maioria dos caminhos nunca foi exercida. Apagar índice por esse
  sinal seria estrago, não faxina.

  **O que fazer:** deixá-la de fora da bateria enquanto o volume for este, ou
  trocá-la por uma que compare `idx_scan` **entre** índices da mesma tabela (o
  que distingue "ninguém usa este banco" de "ninguém usa este índice"). Enquanto
  não houver tráfego real, nenhuma das duas responde nada.



- ⬜ `[11/09]` **Medir a landing NOVA em campo — o antes/depois que sobrou.**
  *A cena 3D saiu; falta o número de usuário real do que ficou no lugar.*

  **Por que o item de 29/08 foi reescrito.** Ele pedia repetir o PageSpeed "no
  preset padrão" para fechar o antes/depois da cena 3D, e trazia toda a
  investigação de por que 30.182 ms caíam em "Other": o custo de uma cena WebGL
  é por **pixel**, não por byte. Nada disso é acionável hoje — **a cena foi
  removida em 11/09**, junto com `three`, `@react-three/fiber` e o
  `e2e/cena-3d.mjs` que vigiava o laço de animação. O raciocínio inteiro está
  guardado em [DESEMPENHO.md](docs/DESEMPENHO.md), que é onde medição mora.

  **O que continua valendo, e é o único pedaço vivo:** o site nunca teve
  medição de campo do hero. O laboratório oscila — duas medições do mesmo site
  em 27/08 discordaram **4×** no TBT —, e o Vercel Speed Insights já está
  instalado e é o único que responde por quem TEM GPU.

  | Onde | Como |
  | --- | --- |
  | **Vercel Speed Insights** | já instalado; é o único que mede usuário real |
  | **PageSpeed Insights** | `pagespeed.web.dev`, colar a URL, aba Desktop |
  | **Chrome no PC** | F12 → Lighthouse → Desktop + Performance → Analyze page load |

  Sempre no mesmo preset e em **janela anônima** (§0.3, regra 5: mesma
  ferramenta, mesmo aparelho). O portão do CI continua sendo **byte**
  (`scripts/orcamento-de-bytes.mjs`), porque tempo de laboratório oscila e
  portão que balança vira alarme falso.

  **A limitação do meu ambiente, e ela vale para qualquer medição futura:** este
  Chromium **não tem GPU** — a CPU faz o trabalho da placa. Todo número de
  renderização que eu produzir daqui é artefato de ambiente, e usá-lo para
  julgar a máquina dele seria vender inferência como fato (§1.1). É por isso que
  a medição de campo depende dele, e não de mim.

  > **`[11/09]` Este item substitui TRÊS que foram removidos hoje**, todos sobre
  > a cena 3D que deixou de existir: o custo por pixel (`[02/09]` 🟠), as sete
  > `pointLight` dos arcos (`[01/09]` 🟡) e o modelo em ferramenta 3D externa
  > (`[11/09]` 🟡). Nenhuma medição se perdeu — a de pixel e a das luzes estão em
  > [`DESEMPENHO.md`](docs/DESEMPENHO.md), e a conta de Meshopt × Draco está em
  > [`DECISOES.md`](docs/DECISOES.md). O que saiu foi a **fila**: pendência sobre
  > código apagado não é pendência, é entulho que faz o backlog parecer maior do
  > que é (§6.2, regra 2).


## 🔵 Só quando o volume crescer

- ⬜ `[11/09]` 🔵 **Post apagado fica na tabela para sempre — sem prazo de
  retenção.**

  Medido hoje, ao conferir a queixa do dono sobre o post de teste no ar: os
  roteiros do CI deixam **214 linhas** em `posts` marcadas com `[e2e ` ou
  `[painel `, desde 30/08. **Nenhuma aparece no feed** — todas têm `deleted_at`
  preenchido, porque o apagar do site é SUAVE. Ou seja: a limpeza dos testes
  funciona, e o que sobra é linha morta.

  O `cleanup_old_data` tem prazo para `admin_logs`, `notifications`,
  `login_attempts`, `live_chat` e `contact_messages` — e **nenhum** para post
  apagado (§6.1, item 5: tabela que só cresce).

  **Por que não fiz agora:** 214 linhas não pesam em nada, e o prazo certo é
  decisão de produto, não minha — "quantos dias um post apagado ainda pode ser
  restaurado?" é uma pergunta de moderação. É uma linha no `cleanup_old_data`
  quando o dono disser o número.

- ⬜ `[02/09]` 🔵 **Mensagem marcada como SPAM não precisa de 2 anos.**
  *Refinamento do prazo decidido em 02/09, não correção dele.*

  `contact_messages` tem prazo único de 2 anos, e ele foi calibrado pela
  conversa de moderação legítima. Mensagem que a equipe marcou como spam não
  tem essa finalidade — pela LGPD, guardar dado sem finalidade é justamente o
  que o prazo existe para evitar.

  **Por que não fiz junto:** o dono aprovou "2 anos", e inventar uma segunda
  regra que ele não pediu é decidir por ele. Fica registrado; a mudança é uma
  linha no `cleanup_old_data`.


- ⬜ `[02/09]` 🔵 **`date.js` e `roles.js` têm regiões que nenhum teste toca.**
  *Achado pelo teste de mutação — coluna `# no cov`, 65 mutantes.*

  Não é bug: é código sem rede. `roles.js` marca 92,31% no que os testes
  alcançam e 30% no total — ou seja, o que é testado é testado bem, e há uma
  parte que ninguém exercita. Vale olhar quando sobrar fôlego; nenhum dos dois
  é caminho crítico hoje.


> Nenhum destes é dívida. São decisões **corretas para 3 usuários** que deixam
> de ser corretas em outra escala. Registrados para não serem redescobertos
> como se fossem problema.

- ⬜ `[jun]` **RPC de engajamento agregado.** `attachEngagement` traz as linhas
  de `post_likes`/`comments` e conta no cliente. Trocar por agregação no banco
  quando um post passar dos milhares de curtidas.
- ⬜ `[jun]` **Presence num canal global único** (`gamerhub-presence`).
  Revisitar se "online agora" passar de algumas centenas.
- ⬜ `[jun]` **Paginação / virtualização** em listas longas (usuários, logs, chat).
- ⬜ `[jun]` **Mídia no Cloudflare R2** — solução definitiva de egress se crescer.
- ⬜ `[21/08]` **Migração para TypeScript.** *Rebaixada em 28/08 a pedido do
  dono — fica por último.* Não descartada: quando a hora chegar, a análise de
  28/08 recomenda fazer por fronteira, e não de uma vez. As duas primeiras
  fatias (`src/lib/`, <!--n:src.lib.arquivos-->157<!--/n--> arq ·
  <!--n:src.lib.linhas-->18.708<!--/n--> linhas; `src/services/`,
  <!--n:src.services.arquivos-->23<!--/n--> arq ·
  <!--n:src.services.linhas-->2.377<!--/n--> linhas) concentram quase todo o
  benefício — é onde mora
  toda a conversa com o Supabase e a lógica pura já 100% testada. Gatilho
  sugerido: a próxima migration que renomeie ou remova coluna.
- ⬜ `[21/08]` **2FA no login.**
- ⬜ `[21/08]` **Afinar detecção de ban** (hoje realtime + poll de 60s de reserva).

## 💡 Ideias registradas, sem compromisso

- 💡 `[23/08]` **Área própria de moderação de live, estilo YouTube Studio.** O
  incômodo é real: chat é ao vivo e efêmero, e a fila de moderação é assíncrona
  — quando o admin abre o painel, a live já acabou. As ferramentas que importam
  ali já existem no `ModPanel`, dentro da live. É feature nova, não é
  prioridade.

---

## Como esta lista é conferida

Documento envelhece; o sistema não mente (`CLAUDE.md` §1.4). Antes de confiar
em qualquer linha daqui, conferir na fonte:

| Pergunta | Onde está a verdade |
| --- | --- |
| Essa extensão / tabela / função ainda existe? | consulta ao Supabase |
| Esse arquivo ainda tem esse problema? | `grep` no código |
| Isso já não foi feito? | `git log -S'trecho'` e os PRs |

Na conferência de 23/08 essa checagem encontrou **cinco itens listados como
abertos que já estavam feitos** e três duplicados 2–3 vezes. Se a lista voltar
a passar de ~25 itens, é sinal de que precisa de outra conferência.
