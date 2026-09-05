<!--
  Este arquivo é PARTE do `CLAUDE.md` — ele é puxado por `@import` e vale
  exatamente como se estivesse escrito lá dentro. Não é documentação do
  produto: é instrução de trabalho.

  Saiu do CLAUDE.md em 28/08/2026, quando o arquivo passou de 1.500 linhas e
  quatro seções estouraram o limite de ~150 do §6.2. A regra que manda dividir
  documento grande é do próprio arquivo; ele estava desobedecendo a si mesmo.

  Ao editar: as referências cruzadas (§1.3, §6.2…) continuam apontando para a
  numeração original, que não mudou. Nada foi reescrito na mudança — só movido.

  [05/09/2026] CONFERIDO CONTRA O SISTEMA, depois de a issue automática de
  documentação apontá-lo como atrasado (8 commits de código desde o último
  toque). O que foi verificado, e não é "eu li e achei bom":

    - todo caminho de arquivo citado aqui existe — checado um a um;
    - todo número no texto é HISTÓRICO congelado ("14 policies esqueceram
      owner", "918 linhas", "26 de 26 chamadas"), não afirmação sobre hoje;
    - as consultas SQL do §1.3 continuam válidas contra o schema atual.

  Nada estava falso. O aviso era indício, e o indício foi conferido — que é o
  que o relatório mensal pede (§6.2, camada 2).
-->

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
