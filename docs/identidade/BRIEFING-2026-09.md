# A reformulação da marca e da landing — o briefing do dono, `[11/09]`

> **Por que este arquivo existe.** Ordem dele, na letra: *"salva tudo isso e o
> outro prompt no backlog, pra não se perder, e as imagens tbm, grava tudo"*.
> Conversa morre com a sessão; este arquivo não.

## O que ele decidiu, e encerra uma pergunta minha

Eu tinha perguntado se a marca seria **o G**, **o GH** ou **a palavra**. A
resposta dele fecha a questão, e é mais ambiciosa do que as três:

> *"eu queria realmente usar GamerHub, G e o GH como marca em lugares
> distintos"*

**Não é escolher um — é um SISTEMA com os três**, cada um no contexto em que
funciona. Isso é o padrão de marca madura (a palavra no cabeçalho, o símbolo no
favicon, o monograma onde falta espaço), e muda o trabalho: o que precisa ser
desenhado não é *um* desenho, é a **relação** entre os três.

## As referências

| Arquivo | O que é |
| --- | --- |
| [`referencias/12-marca-oito-direcoes.webp`](referencias/12-marca-oito-direcoes.webp) | 8 direções de marca, cada uma com símbolo, G, GH, wordmark, favicon, monocromática e a relação símbolo+nome. Paleta azul/roxa |
| [`referencias/13-marca-na-paleta-do-site.webp`](referencias/13-marca-na-paleta-do-site.webp) | As mesmas ideias **na paleta verde/roxo do GamerHub**, mais versões horizontais/verticais, monocromáticas, ícones e um ensaio de motion |

**Elas são referência, não asset.** Pedido explícito dele no briefing anterior:
*"Não utilize essas imagens como assets do GamerHub. Não copie elementos
específicos delas."* O que elas comunicam é atmosfera, construção e sistema.

> **Estas substituem o norte do raio.** As referências `01`–`11` desta pasta são
> a identidade **anterior** (o raio com núcleo hexagonal). Elas ficam como
> histórico — o dono não pediu para apagá-las —, mas o rumo de 11/09 é o G/GH/
> wordmark, **sem raio**.

## O briefing de direção criativa, na íntegra do que decide

O texto completo veio em duas mensagens. O que ele **decide**, destilado:

### O produto, e o que a marca precisa dizer

O GamerHub reúne Feed, Mural da Comunidade, Lives com chat, Keys & Promos,
perfis, Ranks e XP. O conceito de **"Hub"** — um ponto onde pessoas, conteúdo,
jogos e progressão se encontram — *"deve ser uma referência importante"*.

> *"Não quero que o GamerHub pareça apenas um site que possui várias
> funcionalidades."*

### As oito direções que ele pediu para avaliar

`01` Universo · `02` Hub/Convergência · `03` Fragmentos · `04` A interface é a
marca · `05` Portal · `06` System/Digital world · `07` Pulso/Energia ·
`08` Marca tipográfica/monograma.

E a instrução sobre como avaliá-las: *"Não quero simplesmente escolher uma das
oito direções. Analise o projeto e descubra quais conceitos realmente têm
potencial. Você pode combinar conceitos."*

### As restrições que ele impôs

| Restrição | Palavras dele |
| --- | --- |
| **3D deixou de ser exigência** | *"prefiro isso a adicionar 3D apenas para deixar a página 'mais impressionante'"* |
| **Sem clichê neon** | *"evite completamente o clichê de 'site cyberpunk + neon + hologramas'"* |
| **A marca pode nascer do nome** | *"talvez o GamerHub nem precise de um símbolo externo"* |
| **Não é evolução da landing atual** | *"Quero considerar uma mudança real de conceito"* |
| **A landing não é a fórmula de sempre** | *"Não pense apenas em: Hero → Feature → Feature → Feature → CTA"* |

### O que a marca precisa suportar

Logo · favicon · avatar · interface · redes sociais · animações · materiais
futuros. E os critérios que ele nomeou: reconhecimento, simplicidade,
memorabilidade, escalabilidade.

## O que a MINHA análise acrescentou, e que ele ainda não respondeu

Está no estudo de direção. Os pontos que continuam abertos:

1. **A tese da fenda.** O verde e o roxo hoje são dois lutadores de costas,
   separados por um corte vertical — imagem de **duelo**. O nome promete
   **encontro**. A proposta é que a fenda deixe de ser onde eles brigam e passe
   a ser onde eles se tocam. Custo: zero linha de código; é narrativa.
2. **A fonte de display.** `Orbitron` é competente e é a fonte mais usada do
   mundo em "coisa gamer". Se o objetivo é não parecer mais um site gamer, ela
   é a alavanca mais forte — e a mudança mais cara, porque atinge o site todo.
3. **De onde vem a arte.** O que deu certo neste projeto (a arena) foi arte
   **dele** + composição minha. O que falhou duas vezes (3D, ícones) fui eu
   tentando produzir a arte.

## O orçamento, que é o limite duro

`760 kB` brutos / `228 kB` gzip no carregamento inicial, com portão no CI. A
cena 3D sozinha pesava **708 kB** — é por isso que ela não cabia. SVG, CSS e
tipografia cabem em **unidades de kB**.
