# O README mentindo há 6 dias, a porta que eu não fechei, e o portão que cegava outro

**Data:** 17/09/2026

Três achados, e os três vieram do dono — nenhum de portão. Isso é o assunto do
relatório tanto quanto os consertos.

---

## 1. Ele mandou fechar a porta, e a regra estava do lado dele

Eu tinha deixado a **SEC-024** (`reset_login_attempts` chamável por
`authenticated` sem ninguém chamar) como **proposta** no backlog, com este
argumento: não é explorável hoje, porque `login_attempts` está vazia — o hook
que a encheria é de plano pago. Invoquei o §7 (permissão é 🟡, proponho e
espero).

**A cobrança dele:** *"me lembro de termos colocado uma regra no CLAUDE.md, que
independente da brecha, explorável ou não, podendo quebrar hoje ou não, era pra
ser fechada na hora"*.

Ele está certo, e a regra é literal (POSTURA §1.3), nas **duas** linhas:

> *"Brecha que só vira problema amanhã se fecha hoje. Base pequena não é
> desculpa. Achou algo que 'não quebrou ainda' por sorte ou baixo volume?
> Corrigir igual."*
>
> *"Desconfiar de proteção acidental. Se algo só está seguro por efeito
> colateral de outra regra, isso não é proteção — é sorte esperando expirar."*

A segunda descreve o meu próprio argumento e o desqualifica. **"Está seguro
porque a tabela está vazia" É proteção acidental** — a proteção não era a
função, era o estado do dado. Eu li o §7 e não li o §1.3, que manda mais alto.

### O que foi feito

`REVOKE EXECUTE ON FUNCTION public.reset_login_attempts() FROM PUBLIC, anon,
authenticated`, com `COMMENT` explicando para o dia em que o contador for
ligado.

**Antes de revogar, procurei quem lê** (§1.3), em cinco frentes — nenhuma
achou nada: `src/`, `supabase/functions/`, `pg_proc.prosrc`, `pg_policies`,
triggers.

**Testado em `ROLLBACK`, 6 asserções:**

| | |
| --- | --- |
| `authenticated` **antes** | consegue chamar ← *sem esta, o teste seria verde sem ter testado nada* |
| `authenticated` depois | bloqueado |
| `anon` depois | bloqueado |
| `hook_de_verificacao_de_senha` | mantém `supabase_auth_admin=X` — o login do site não encosta nisto |
| quem zera o contador | o **hook**, com `DELETE` próprio no ramo `IF v_valid THEN` |
| ACL final | `postgres | service_role` |

Confirmado em produção no `pg_proc` depois de aplicar.

---

## 2. O README anunciava uma cena 3D que não existe há 6 dias

Ele abriu o README no celular e viu: *"tá falando aqui que a landing é montada
com uma cena 3D, pq não é vdd faz um bom tempo"*. E acrescentou o diagnóstico
que importa: *"vc está focando bastante nas documentações mais operacionais…
mas está esquecendo das estáticas e informativas como o readme"*.

### O que estava falso — conferido contra o sistema, não contra a memória

| O que dizia | O que é verdade |
| --- | --- |
| "landing page institucional **animada com cena 3D**" | a cena 3D saiu em **11/09** (−708 kB) |
| tabela de dependências com `@react-three/fiber` e `three` | **não existem** — zero ocorrências no `package.json` e em `src/` |
| "**73** `SECURITY DEFINER` **de hoje**" (medido em 02/09) | **80**, medidos hoje no `pg_proc` |
| "`BACKLOG.md` — o que falta fazer, **só isso**" | tem **dois** trabalhos desde 03/09: a fila e a seção EM EXECUÇÃO |
| `docs/regras/` com **4** arquivos | são **5** — faltava `EXECUCAO.md` |
| tabela sem `docs/identidade/` | a pasta existe com 3 documentos |

Anunciar duas dependências que o projeto não tem é a pior delas: não é redação
imprecisa, é o README descrevendo um projeto diferente.

**Corrigido junto:** o número de `SECURITY DEFINER` passou a vir com data e a
dizer que é **retrato**, com o motivo (o portão `npm run numeros` não alcança o
Postgres) e o caminho para medir o valor de agora.

---

## 3. A causa: DOIS buracos, e o segundo cegava o primeiro

Ele perguntou por que ninguém tinha percebido. A resposta é mecânica e tem duas
camadas — e é a parte deste relatório que vale mais do que os consertos.

### Buraco 1 — o README tinha território VAZIO

No mapa (`scripts/territorio.mjs`) ele estava junto de `DECISOES.md`,
`VISAO-DE-FUTURO.md` e `MANIFESTO.md`, cuja lista vazia significa *"vigiar por
commit aqui não faz sentido"*. Aqueles três são mapas de possibilidade e de
história: nenhum commit os torna falsos.

**O README não é dessa família.** Ele **afirma** coisas sobre o código — quais
dependências existem, quais comandos existem, o que a landing é. Foi erro de
classificação meu, e o efeito foi verde permanente.

**Corrigido:** território `['package.json']`. Mínimo de propósito — dar-lhe
`src/` o faria aparecer em toda issue mensal, e portão que sempre grita ensina a
ignorar o canal (§0.2, 4ª regra). E é o arquivo certo: a saída da cena 3D foi,
literalmente, a remoção de duas linhas dali.

### Buraco 2 — o `npm run numeros` CEGAVA o relatório de envelhecimento

Consertar o buraco 1 **não teria pego este caso**, e provei isso antes de
comemorar.

O relatório datava cada documento por `git log -1 -- <doc>`: o último commit que
**tocou** o arquivo. Só que o `numeros-do-projeto.mjs` toca documento sozinho —
reescreve o valor dentro de `<!··n:chave··>123<!··/n··>` a cada PR que muda uma
contagem.

**O último "update" do README, por extenso** — com o marcador escrito com `·`
no lugar dos traços, senão o próprio portão reescreve este exemplo (e reescreveu,
na primeira vez que salvei este arquivo):

```diff
- … <!··n:migrations··>176<!··/n··> migrations que recriam o banco
+ … <!··n:migrations··>177<!··/n··> migrations que recriam o banco
```

Foi só isso. Um robô trocando um número — e o relógio de envelhecimento zerou.
Nenhum humano leu uma linha.

> **E a armadilha mordeu duas vezes no mesmo dia:** ao escrever este relatório
> com o marcador de verdade, o `npm run numeros` trocou o `176` e o `177` por
> `178` — apagando justamente o exemplo que explica o problema. A
> [`DOCUMENTACAO.md`](../docs/regras/DOCUMENTACAO.md) já avisava que *"o
> histórico legítimo precisa continuar congelado"*; eu só não tinha percebido
> que um relatório sobre marcadores é o caso mais fácil de acontecer.

**A ironia é exata:** o `numeros-do-projeto.mjs` termina imprimindo *"Confira o
texto EM VOLTA de cada um: a frase que citava o número pode ter deixado de ser
verdade junto com ele"* — e, no mesmo ato, apagava o sinal de que alguém
precisava conferir. Portão que cega outro portão é §1.5 puro: nada estoura,
nada loga, e o documento simplesmente para de ser vigiado.

**E não era só o README.** Todo documento com marcador vivo se rejuvenescia
sozinho — e são justamente os mais centrais que os têm: `README.md`,
`AUDITORIA.md`, `DOCUMENTACAO.md`, `EXECUCAO.md`.

**Corrigido:** a data passa a vir do último **toque de gente** — o primeiro
commit, do mais novo para o mais velho, cujo diff no arquivo ainda difere
**depois de neutralizar os valores dos marcadores**. Comparar o conteúdo (e não
só procurar `<!--n:`) é o que evita o falso negativo de uma linha que tem
marcador *e* texto reescrito junto.

**Provado reinjetando o caso real:** com o README no estado de antes, o
relatório passou a acusá-lo — *"8 commits de código desde a última
atualização"* —, e antes do conserto ele não aparecia de jeito nenhum. De
quebra, apareceu o `supabase/migrations/README.md` (11 commits), que estava
cego pelo mesmo motivo. Conferido: aquele está correto.

---

## 4. A landing passou a ter UM `<h1>` — com permissão dele

*"Pode mexer, vc só tem permissão pra mexer no que for necessário e o que não
for quebrar nem alterar nada."*

**Medido antes, em navegador, nos dois caminhos** (normal e
`prefers-reduced-motion`): **2 `<h1>`** — a frase do Ato 0 e o "GAMERHUB".

Qual fica com o título: a frase **descreve** a página; o "GAMERHUB" **nomeia** a
marca, que já está no `<title>`, no JSON-LD (`name`) e na navbar. Descrição
ganha de nome — e o PageSpeed dele confirma que a frase é o elemento de LCP.

**Consertado pela CLASSE, não pelo caso:** o segundo `<h1>` mora no
`ElectricTitle.jsx`, e os **dois** prólogos chegam nele pelo mesmo
`ConteudoDoHero`. Um arquivo fechou os dois caminhos.

**Antes → depois, medido:**

```
h1 na tela          2  ->  1        (nos dois caminhos)
GAMERHUB     @365 329x48 48px  ->  @365 329x48 48px     idêntico
hierarquia   H1 -> H2 -> H2 -> H3   sem salto
```

Não moveu um pixel: `text-5xl md:text-7xl` dá o tamanho explicitamente, então o
`preflight` do Tailwind não tem o que zerar.

**Corrigido junto:** um comentário dentro do `ElectricTitle` afirmava *"este
span é o elemento de LCP da landing"*. Não é mais — o PageSpeed dele aponta a
frase do Ato 0. A razão técnica de não animar `text-shadow` continua inteira; o
que envelheceu foi a justificativa.

**A trava**, provada nas duas metades reinjetando o bug:

- devolver `motion.h1` ao `ElectricTitle` → falha nomeando o arquivo
- tirar o `<h1>` do prólogo → falha dizendo que ele tem 0 e devia ter 1

Ela varre a **pasta**, não o arquivo culpado: os dois prólogos valem 1 `<h1>`
cada, e qualquer outro arquivo da landing vale zero.

---

## 5. O PageSpeed dele: 96 no PC, 77 no celular — e o culpado não é peso

Ele mandou os prints e foi explícito: *"vc não vai alterar nada, pq da última
vez vc deixou a landing feia"*. **Nada foi alterado.**

O diagnóstico completo está em [`docs/DESEMPENHO.md`](../docs/DESEMPENHO.md). O
resumo é uma linha do próprio relatório:

```
Time to First Byte                     0 ms
Atraso na renderização do elemento  3.560 ms    <- 77% do LCP de 4,6 s
```

O elemento de LCP é **texto** — a frase do Ato 0, com `style="opacity: 1;
transform: none"`, que é saída do Framer Motion. Texto não tem download: a frase
está no HTML desde o primeiro byte e fica invisível até o JS carregar, o React
montar e a animação rodar.

**Por isso as três recomendações de peso do relatório não atacam este número**
(126 KiB de JS, 11 KiB de CSS, 28 KiB de imagem): elas encurtam o download, e o
gargalo está no que acontece **depois** dele. E TBT = 0 ms com CLS = 0 diz o
resto — o celular não está engasgando, está **esperando**.

Registrei no `DESEMPENHO.md` a tabela do que **não** adiantaria, para a próxima
sessão não gastar rodada no lugar errado.

---

## 6. Achado de quebra: o roteiro de portas aprova RPC pelo motivo errado

Apareceu ao acrescentar as três RPCs do contador ao `e2e/portas-do-banco.mjs`.
Medido contra produção com a chave anônima de verdade:

```
username_disponivel  {}                        -> 404    (parece fechada)
username_disponivel  {"p_username":"zzteste"}  -> 200    <- ABERTA de propósito
```

O roteiro chama cada RPC com corpo vazio, e o PostgREST devolve **404 para
função com parâmetro obrigatório** — por assinatura, não por privilégio. Os dois
404 são indistinguíveis dali, e quase todas as entradas de `RPCS_FECHADAS` têm
parâmetro.

**Isto não é brecha** — nenhuma porta abriu. É **vigia cego**: se alguém der
`GRANT` em `ban_user` amanhã, o 404 de assinatura chega antes e o teste continua
verde. É a classe "teste que não consegue falhar", a mesma que originou o
`varrerFontes.js`, de volta em outro lugar.

**O que continua provado:** as três do contador foram conferidas uma a uma com o
argumento certo, e as três responderam `401` — recusa de privilégio.

**Não corrigi**, e o motivo está no backlog: a correção faria o roteiro
**invocar de verdade** `ban_user` e afins contra produção caso alguma estivesse
aberta. Existe caminho seguro (UUID zerado), mas é um teste de CI passando a
escrever contra produção — decisão dele.

O aviso ficou escrito **dentro do arquivo**, para quem ler o "49/49" não
confiar mais do que ele prova.

---

## 7. Prompt 2 — a evolução visual futura, escrita e não implementada

[`docs/identidade/EVOLUCAO-VISUAL-DA-LANDING.md`](../docs/identidade/EVOLUCAO-VISUAL-DA-LANDING.md),
com `STATUS: FUTURO — NÃO IMPLEMENTAR AGORA` no topo.

Os dois princípios dele, cada um com o teste prático que o torna executável:

- **uma experiência = uma cena**, e o teste: *se a funcionalidade fosse removida
  do produto amanhã, esta cena continuaria fazendo sentido?* Não → é feature,
  cabe dentro de uma cena existente.
- **preservar o conceito, não o asset**, com os quatro caminhos de representação
  (arte gerada · SVG · UI real · híbrido) e quando cada um passa a fazer
  sentido.

Junto: o retrato medido de hoje (7 cenas × 6 recortes, os dois caminhos de
movimento, zero 3D) e a lista do que fica **proibido mesmo no futuro** — cada
linha com a cicatriz que a produziu.

---

## O que NÃO foi feito, dito com todas as letras

- **A Etapa 5 (performance) não foi implementada.** Foi diagnosticada, e o
  diagnóstico diz que as sugestões óbvias não resolvem. Qualquer mudança
  encosta na landing e depende dele.
- **O falso positivo do `portas-do-banco.mjs` continua lá.** Documentado no
  arquivo e no backlog, não corrigido.
- **A metade `authenticated` da SEC-024 não tem trava automática.** Cobri-la
  exigiria credencial de usuário no CI — a mesma troca já recusada antes. O
  estado foi provado em `ROLLBACK` e conferido no `pg_proc`; o que roda sozinho
  é a metade anônima.
- **Não li os 44 documentos.** Li o `README.md` inteiro e conferi cada
  afirmação dele contra o sistema; dos citados, abri
  `supabase/migrations/README.md` (correto), e os de `docs/` já haviam sido
  conferidos nas etapas anteriores. O que fecha essa lacuna de verdade é o
  conserto do buraco 2, que passa a apontar sozinho quem está atrás.
