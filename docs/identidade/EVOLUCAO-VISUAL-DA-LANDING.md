# A evolução visual futura da landing

> ## 🔒 STATUS: FUTURO — NÃO IMPLEMENTAR AGORA
>
> **A landing vigente continua valendo, inteira.** Ordem do dono, na letra:
> *"NÃO implemente essa evolução agora"*. Este documento **registra a visão**;
> ele não é fila, não é especificação e não autoriza mudança nenhuma.
>
> Enquanto este aviso estiver aqui, mexer na landing continua exigindo pedido
> explícito dele — a landing é **área protegida** (`BACKLOG.md`, Prompt 1).

**O que é isto.** O registro de *como a landing deve crescer quando crescer* —
os dois princípios que decidem, o retrato do que existe hoje, e o que fica
proibido mesmo no futuro. Escrito em 17/09.

**O que NÃO é.** Não é [`BRIEFING-LANDING-2026-09.md`](BRIEFING-LANDING-2026-09.md),
que descreve a landing **de hoje** e as decisões que a produziram. Não é
`BACKLOG.md`: não há item, prazo nem compromisso aqui. Não é
[`DECISOES.md`](../DECISOES.md): nada foi decidido nem descartado.

---

## Os dois princípios

Eles são a razão deste documento existir. Tudo o mais abaixo é consequência.

### 1. Uma EXPERIÊNCIA = uma cena. Não uma feature = uma cena

A landing hoje tem **sete** cenas: `hero`, `feed`, `comunidade`, `keys`,
`ranks`, `lives`, `cta` (medido em `src/lib/cenasDaLanding.js`). Olhando essa
lista de fora, ela **parece** um catálogo de funcionalidades — e é aí que mora
a armadilha.

**A armadilha, dita por extenso:** se cada funcionalidade nova ganhar a sua
cena, a landing vira um índice. Chegam torneios → oitava cena. Chega loja →
nona. Chega perfil público → décima. Cada uma isolada é defensável; o conjunto
vira um menu rolável em que nenhuma respira, e a travessia — que é o que a
landing é hoje — morre por acumulação, sem ninguém tomar a decisão de matá-la.

**A regra:** uma cena existe para entregar **uma experiência de pertencer**, não
para anunciar um recurso. Antes de propor cena nova, a pergunta não é *"que
funcionalidade falta mostrar?"* — é **"que sensação ainda não foi entregue?"**.

O teste prático, e ele é duro de propósito:

> Se a funcionalidade nova fosse removida do produto amanhã, esta cena
> continuaria fazendo sentido?
>
> - **Sim** → é experiência. Pode virar cena.
> - **Não** → é feature. Cabe **dentro** de uma cena existente, ou em nenhuma.

Corolário que economiza discussão: **funcionalidade nova entra numa cena que já
existe, por padrão.** Cena nova é a exceção, e precisa se justificar pelo teste
acima — não pelo tamanho da feature.

### 2. Preservar o CONCEITO, não o ASSET

A landing de hoje é sustentada por **arte gerada** — sete conjuntos, cada um em
seis recortes (paisagem e retrato, três larguras cada). É o que ela deveria ser
**agora**, e não é o que ela precisa ser **para sempre**.

**O risco real, e é de envelhecimento, não de gosto:** arte que desenha texto,
número, preço ou um layout específico de tela **apodrece sozinha**. O dia em
que o feed mudar de forma, a arte do feed passa a mostrar um produto que não
existe — e ninguém percebe, porque imagem não quebra build, não vira erro e não
aparece em teste. É §1.5 aplicado à identidade visual.

**A regra:** o que a cena tem de preservar é **o conceito** — o que ela faz a
pessoa sentir. A **representação** é substituível, e pode migrar por cena, sem
sincronia entre elas:

| Caminho | Quando ele passa a fazer sentido |
| --- | --- |
| **arte gerada** (hoje) | conceito atmosférico, sem detalhe legível que envelheça |
| **SVG/vetor** | o conceito é estrutura — grade, conexão, fluxo — e precisa nitidez em qualquer tela e peso baixo |
| **UI de verdade** | o conceito é *usar* o produto, e a UI real já ficou bonita o bastante para se mostrar |
| **híbrido** | arte como atmosfera + uma peça de UI/SVG por cima carregando o detalhe que muda |

**A consequência que importa:** migrar **uma** cena não obriga a migrar as
outras. A landing pode viver anos misturando os quatro caminhos, desde que a
continuidade entre cenas seja preservada — e ela é feita de ritmo, cor e
movimento, não de técnica de renderização.

---

## O retrato de hoje — para o futuro saber do que está partindo

Medido em 17/09, não estimado.

| | |
| --- | --- |
| cenas | **7** (`src/lib/cenasDaLanding.js`) |
| recortes por cena | **6** — paisagem 1600/1200/828, retrato 828/620/420 |
| caminho normal | `PrologoDaLanding.jsx` — a travessia com movimento |
| caminho `prefers-reduced-motion` | `PrologoParado.jsx` — a mesma arte e a mesma frase, paradas |
| título da página | **um** `<h1>`, a frase do Ato 0 (corrigido em 17/09) |
| 3D | **nenhum** — removido em 11/09, −708 kB |

**A estrutura que a evolução tem de respeitar**, porque ela não é enfeite:

- **Os dois caminhos são um só desenho.** Tudo que a evolução criar precisa ter
  resposta para `prefers-reduced-motion`, e a resposta não é "some": é a mesma
  cena, parada. Quem pediu menos movimento pediu menos movimento, não menos
  site.
- **A continuidade é o produto.** A landing virou travessia em 11/09 (PR #193).
  Cena que entra sem se ligar à anterior e à seguinte quebra a coisa que a
  landing é — mesmo que, sozinha, seja bonita.

---

## O que fica PROIBIDO, mesmo no futuro

Não são preferências. Cada linha tem uma cicatriz atrás.

| Proibido | Por quê |
| --- | --- |
| **3D "para impressionar"** | o briefing do dono já dizia *"prefiro isso a adicionar 3D apenas para deixar a página mais impressionante"*. Custou 708 kB e três sessões antes de sair |
| **Decoração sem teto de espera** | `CLAUDE.md` §0.3 regra 3: adiar até um evento cria o caso em que o evento não vem. Já aconteceu — a cena 3D presa em `readyState: interactive` porque o Google Fonts estava inalcançável |
| **Arte com texto, preço ou número legível** | é o princípio 2 no caso mais agudo: apodrece sem avisar |
| **Cena por funcionalidade** | é o princípio 1. A landing vira índice |
| **Biblioteca nova sem o custo DESCOMPACTADO medido** | §0.3 regra 1. `three` entrou com o renderer WebGL inteiro para cinco símbolos |
| **Mudar a landing para agradar métrica** | ordem dele no Prompt 1: *"NÃO quero uma caça ao 100/100"* |

---

## Como uma evolução destas deveria começar, no dia em que começar

Escrito aqui para o dia em que ele pedir — não como plano ativo.

1. **Ele pede**, e nomeia a sensação que falta. Não a feature.
2. Passar a proposta pelo **teste do princípio 1** (a cena sobrevive sem a
   funcionalidade?) e pelo **princípio 2** (que caminho de representação, e por
   quê).
3. **Uma cena por vez, com merge próprio.** A landing foi reformulada assim, em
   fatias, e foi o que permitiu voltar atrás barato.
4. **Medir antes e depois, na mesma ferramenta** (§0.3 regra 5), com o
   orçamento de bytes como portão.
5. Atualizar o [`BRIEFING-LANDING-2026-09.md`](BRIEFING-LANDING-2026-09.md) —
   ele descreve o que **é**, e é ele que fica falso quando a landing muda.

---

> **Se você chegou aqui procurando o que fazer agora: não é nada.** Este
> documento existe para que a próxima mudança visual da landing tenha um
> critério escrito em vez de um impulso — e para que a conversa comece no
> "que sensação falta", e não no "que feature ainda não tem cena".
