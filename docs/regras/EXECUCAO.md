<!--
  Este arquivo é PARTE do `CLAUDE.md` — ele é puxado por `@import` e vale
  exatamente como se estivesse escrito lá dentro. Não é documentação do
  produto: é instrução de trabalho.

  Nasceu em 03/09/2026, do PROTOCOLO DE OPERAÇÃO que o dono escreveu depois de
  eu falhar três vezes seguidas na mesma tarefa. Ele foi explícito sobre o
  diagnóstico: *"depois de tanta regras, gatilhos e tudo mais, vc está tendo
  que pensar em 400 coisas ao mesmo tempo e isso tá te levando a uma exaustão
  de memória"*.

  Ao editar: este arquivo cobre COMO trabalhar. O que é certo e errado no
  produto continua no `CLAUDE.md` e nos outros `docs/regras/`.
-->

## 9. Execução — gestão de contexto

> **O que este arquivo NÃO é.** Ele não substitui, enfraquece nem dispensa
> nenhuma documentação do projeto. Ordem do dono, na letra: *"NÃO trate 'não
> manter tudo ativo na atenção' como 'não precisa consultar'"*.
>
> A regra é uma só: **não carregue tudo para resolver uma coisa; descubra o que
> precisa ser conhecido para resolver aquela coisa corretamente.**

### 9.1 Por que ele existe, com o número que decidiu o formato

O projeto tem <!--n:docs.linhas-->11.749<!--/n--> linhas de documentação, e
`CLAUDE.md` + `docs/regras/` são **injetados em toda sessão**. Isso é uma
vantagem — o conhecimento não se perde entre sessões. Mas tentar manter tudo
**ativo** enquanto executo uma tarefa foi o que produziu as três falhas de
02–03/09:

| A falha | O que eu fiz de errado |
| --- | --- |
| as peças invisíveis | 3 tentativas; conferi a aparência num recorte que **desligava a animação** |
| a trava apagada | provei, e o `git reset --hard` da prova levou o código junto |
| o PR aberto | dei por entregue três vezes o que nunca chegou na `main` |

Em todas, quando eu perdi o fio, o reflexo foi **ler mais e tentar de novo**.
Nenhuma foi falta de regra: as regras existiam, estavam certas, e eu as tinha
lido no começo da sessão.

**Este arquivo escreve só o que era NOVO.** O protocolo do dono cobre 9 pontos
que o projeto já tinha — repeti-los aqui criaria a segunda fonte de verdade que
o §4 proíbe. O mapa está em 9.7.

### 9.2 Antes de mexer em arquivo — a sequência

```
PARE  ->  ENTENDA  ->  CONSULTE O CONTEXTO RELEVANTE  ->  REGISTRE O PLANO
      ->  EXECUTE UMA ETAPA  ->  VALIDE  ->  ATUALIZE O ESTADO  ->  CONTINUE
```

O passo que eu mais pulo é o **primeiro**. Entrar direto em modo de execução é
o que transforma "conserta o fundo" em três rodadas.

### 9.3 Classificar antes de agir

Toda tarefa relevante começa nomeando cinco coisas. É rápido e evita a
investigação global:

| | |
| --- | --- |
| **tipo** | feature · bug · segurança · desempenho · refactor · manutenção · auditoria |
| **território** | qual pasta/subsistema é o alvo |
| **documentação governante** | qual documento manda naquele território (mapa em `scripts/territorio.mjs`) |
| **critério de sucesso** | como eu vou saber que acabou |
| **risco** | o que pode quebrar junto |

### 9.4 Território primeiro, projeto nunca

```
TAREFA -> TERRITÓRIO -> DOCUMENTAÇÃO RELEVANTE -> CÓDIGO RELEVANTE
       -> DEPENDÊNCIAS -> IMPLEMENTAÇÃO -> VALIDAÇÃO
```

**O mapa de territórios já existe** e é o mesmo que os portões usam:
`scripts/territorio.mjs`. Ele responde exatamente a pergunta de 9.3 — qual
documento governa qual pasta.

Se no meio da tarefa aparecer uma dependência em outro território: **pare,
consulte aquele documento, incorpore só o necessário, continue.** Não é
proibido sair do território — é proibido carregar território que a tarefa não
pediu.

> **Exemplo do que não fazer:** tarefa sobre autenticação não precisa da
> documentação de áudio, cena 3D e desempenho visual. Precisa de
> `SEGURANCA.md`, `ARQUITETURA.md` e as decisões relacionadas.

### 9.5 O BACKLOG é memória operacional

Ordem do dono: *"não dependa apenas do contexto da conversa para lembrar o que
precisa ser feito"*.

Tarefa com múltiplas etapas ganha um plano registrado na seção **EM EXECUÇÃO**
do `BACKLOG.md`, antes de começar:

```
TAREFA -> PLANO REGISTRADO -> ETAPA 1 -> VALIDAÇÃO -> ATUALIZA O BACKLOG
       -> ETAPA 2 -> VALIDAÇÃO -> ATUALIZA -> ... -> CONCLUSÃO
```

O que entra: objetivo · etapas · estado · decisões · bloqueios · descobertas
que **mudam o plano** · validações · pendências.

O que **não** entra: pensamento solto, hipótese irrelevante, texto de enfeite.

**Proporcional ao tamanho e ao risco.** Ajuste de texto não vira plano de sete
etapas. Tarefa grande, sim — e se for grande demais para uma sequência segura,
o certo é dividir e registrar a divisão.

**Nenhuma etapa é marcada como concluída sem evidência.**

### 9.6 Quando eu perder o fio — a regra que muda o reflexo

Sinais: repetir investigação já feita · esquecer decisão recente · voltar a
hipótese descartada · mexer em arquivo sem relação · tentar de novo sem
evidência nova · confundir estados do projeto.

**A regra: não compense com mais contexto.** Volte ao estado registrado no
`BACKLOG.md`, reconstrua o objetivo, e determine qual é a próxima etapa.

Isso é o oposto do que eu fiz nas três falhas, e é a linha mais importante do
protocolo.

### 9.7 O que o protocolo cobre e o projeto JÁ tinha

Está aqui como **mapa**, não como cópia — duas redações da mesma regra
divergem (§4, fonte única).

| O protocolo diz | Já estava em |
| --- | --- |
| qualidade acima da velocidade | `CLAUDE.md`, seção de abertura |
| bug: 2 tentativas, depois instrumentar | [POSTURA.md](POSTURA.md) §1.2 |
| green não é provado; trava se prova reinjetando o bug | `CLAUDE.md` §2 |
| fato ≠ inferência ≠ hipótese | [POSTURA.md](POSTURA.md) §1.1 |
| medir antes e depois, mesma ferramenta | `CLAUDE.md` §0.3 |
| segurança proativa, pensar em abuso | [POSTURA.md](POSTURA.md) §1.3 |
| arquivo acima de 300 linhas divide | `CLAUDE.md` §4 |
| documentação no MESMO PR | [DOCUMENTACAO.md](DOCUMENTACAO.md) §6.2 |
| critério de conclusão | `CLAUDE.md` §2, definição de pronto |

### 9.8 A espiral de controle — e este arquivo está sob a própria regra

> Do protocolo: *"Não transforme cada falha em uma nova regra."*

O padrão a evitar: erro → cria regra → regra falha → cria trigger → trigger
falha → cria teste → cria gate → cria documentação. O processo fica mais
complexo do que o problema.

**Antes de criar regra, trigger, script, teste, gate ou documento, sete
perguntas:**

1. Já existe mecanismo que resolve isso?
2. Ele está realmente falhando, ou eu não o usei?
3. O problema é de implementação ou de arquitetura?
4. Estou duplicando regra existente?
5. Existe solução mais simples?
6. Isso cria manutenção permanente?
7. O benefício justifica a complexidade?

> **A pergunta 4 foi o que deu forma a este arquivo.** O levantamento achou 9
> pontos do protocolo já cobertos e 8 genuinamente novos. Colar o protocolo
> inteiro somaria ~600 linhas ao que já é injetado por sessão — mais de metade
> repetindo regra existente, e o oposto do objetivo dele.

**Escolha, quando for o caso:** entender por que a regra existente falhou vem
**antes** de escrever regra nova.

### 9.9 Estados de entrega não são equivalentes

```
LOCAL -> COMMIT -> PUSH -> PR -> MERGE -> DEPLOY -> PRODUÇÃO
```

Commit não é entrega. Push não é deploy. Deploy não é validado em produção.

Isto está aqui, e não só no `npm run fim`, porque eu confundi esses estados
**três vezes na mesma tarefa** — o conserto estava certo, o PR ficava aberto, e
eu olhava o meu diff em vez do site. O portão que reprova hoje é o
`nada por mergear`; esta linha é o motivo dele existir.

### 9.10 Comunicação proporcional

Antes de alteração relevante: objetivo · entendimento atual · plano · o que
será preservado · riscos.

Depois: o que mudou · como foi validado · **o que NÃO foi validado** ·
pendências · impacto documental.

**Profundidade proporcional ao risco.** Ajuste de texto não pede relatório.

### 9.11 Parar e pedir direção

Conflito entre requisitos · decisão arquitetural significativa · impacto grande
· risco de segurança relevante · falta de contexto essencial · ambiguidade que
muda o resultado · trade-off que é decisão do dono.

**Não inventar decisão para manter aparência de progresso.**
