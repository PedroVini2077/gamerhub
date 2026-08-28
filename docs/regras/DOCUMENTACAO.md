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

---
