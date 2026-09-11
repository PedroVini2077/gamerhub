# Identidade visual do GamerHub — as referências oficiais

> **`[10/09]` Por que esta pasta existe.** O dono mandou as artes da identidade
> **dentro de uma conversa**, e conversa morre com a sessão. Sem isto, a próxima
> sessão receberia a tarefa *"implemente a identidade"* sem ter o norte visual —
> e eu inventaria uma, que é exatamente o que os dois pedidos dele proíbem.
>
> Ordem dele, na letra: *"grava tudo no backlog, não deixa nada na memória da
> sessão"*.

## O que é permanente e o que é efeito

Esta é a leitura que sustenta toda adaptação. Separar as duas coisas é o que
impede uma versão pequena de virar outra marca.

| | |
| --- | --- |
| **Permanente** | a silhueta do raio (dois triângulos alongados em ziguezague), o **núcleo hexagonal vazado** no centro, as duas asas laterais |
| **Efeito** | gradiente, glow, facetas 3D, aresta ciano à esquerda e roxa à direita, translucidez de cristal |

**A regra que decide qualquer dúvida:** se tirar o glow, tirar a cor e reduzir a
16 px, ainda tem que ler como o mesmo raio. O detalhamento cristalino
**complementa** o raio; não o substitui.

## As referências, e o papel de cada uma

| Arquivo | Papel |
| --- | --- |
| `01-simbolo-mestre.webp` | o **símbolo mestre** — é ele que manda quando duas referências discordarem |
| `02-simbolo-cristal.webp` | o mesmo símbolo na linguagem de **cristal**, com volume e translucidez |
| `03-planas-branco-preto-verde.webp` | as **versões planas**: branco, preto e verde sólido. Sem gradiente, sem glow |
| `04-favicon-e-monocromatico.webp` | **favicon** em 16/32/48, colorido e mono. A mono é deliberadamente **mais simples** |
| `05-icone-pwa.webp` | a **composição quadrada** do ícone de aplicativo, 192 e 512 |
| `06-stress-test.webp` | a prova de que a silhueta sobrevive sem cor, sem glow, em círculo e em 16 px |
| `07-animacao-revelacao.webp` | a **dramaturgia da entrada**: a energia acende do núcleo para fora |
| `08-raio-nucleo-aceso.webp` | o raio com o **núcleo aceso** — a leitura de "o core é a fonte" |
| `09-cristal-alta-resolucao.webp` | material cristalino em detalhe: facetas, profundidade, luz interna |
| `10-cena-da-landing.webp` | **a referência da cena da Landing**: o artefato suspenso, os fragmentos orbitando, a atmosfera |
| `[10/09]` `11-mestre-3d.webp` | **a mestra do 3D**, nomeada assim pelo dono: é ela que manda em faceta, volume, espessura e material. Não manda em silhueta — ver a seção da extração, mais abaixo |

## O que ficou de fora, e por quê

A **grade de rotação 3D** (16 quadros girando 360°) foi **descartada pelo
próprio dono**: *"eu mandei a imagem animada de rotação sem querer, esse você
pode esquecer"*. Está registrado aqui para ninguém reencontrá-la num histórico
e achar que era parte do sistema.

## Como usar

> ### `[10/09]` ESTA REGRA MUDOU TRÊS VEZES NO MESMO DIA. Vale a terceira.
>
> Está escrito assim, com as três, porque decisão revertida em silêncio volta
> como "conserto" daqui a dois meses (§6.2, regra 4) — e porque quem ler só a
> última não entende por que o código tem as duas coisas.

| # | O que ele disse | Efeito |
| --- | --- | --- |
| 1ª | *"referência artística, **nunca** como asset de runtime — não coloque a imagem na Landing, não use como background, não use como textura"* | a cena nasceu 100% em código |
| 2ª | *"quero que você **USE ESSAS IMAGENS COMO BASE REAL DA EXPERIÊNCIA visual**, em vez de tentar recriar tudo do zero"* | a cena 2D foi reconstruída com a arte no centro |
| **3ª — a que vale** | *"a cena 3D principal precisa ser **CONSTRUÍDA À MÃO EM CÓDIGO**… **NÃO use a imagem da lightning como substituta da geometria 3D**"* | ver abaixo |

### A regra de HOJE, e ela NÃO é a volta da primeira

A terceira não desfaz a segunda — ela **separa por destino**, e essa é a
distinção que importa:

| Onde | O que vale |
| --- | --- |
| **a cena 3D principal** | geometria, materiais, shaders, iluminação e animação **em código**. A arte serve de referência para silhueta, proporção, cor e sensação de material — nunca como plano, sprite ou background |
| **favicon · PWA · Open Graph · previews · assets estáticos** | a arte aprovada entra **direto**, e é para isso que ela existe |
| **textura secundária na cena** | permitido, mas só *"caso exista uma razão técnica clara"* |

**O que segue proibido nas três versões:** `<img>` solto no centro, imagem como
background para fingir 3D, galeria, slideshow, copia-e-cola.

### O estado do código agora

`src/assets/marca/` guarda os derivados de runtime gerados de
`08-raio-nucleo-aceso.webp`, e duas medições decidiram o formato:

| | |
| --- | --- |
| a arte tem alfa REAL (82,8% do quadro) | usá-lo custava **67 kB** — o canal alfa domina a compressão WebP |
| a página é quase preta e o raio BRILHA | composta sobre preto e desenhada com `screen`, a mesma arte custa **18,9 kB** |

Quem usava era a cena 2D da landing — **e ela não existe mais**. Em 11/09 a
cena 3D e o fallback 2D foram removidos junto com o raio, quando o dono lembrou
que o briefing dele já dizia *"prefiro isso a adicionar 3D apenas para deixar a
página mais impressionante"*. O hero passou a ser `ConvergenciaDoHub` (SVG+CSS),
e a medição acima fica como o que ela é: a prova de que compor sobre preto com
`screen` custa 3,5× menos do que carregar o alfa.

## `[11/09]` A reconstrução do símbolo foi CANCELADA

Entre 10 e 11/09 existiu aqui uma seção sobre extrair a silhueta da arte por
script, para construir a peça 3D em código. O dono cancelou a reconstrução
inteira e o código voltou ao estado anterior — o script não existe mais, e o
nome dele não é citado aqui de propósito: caminho de arquivo apagado num
documento é exatamente o que o portão de documentação reprova.

**O que fica valendo desta pasta:** as artes são a identidade, e é delas que
sai qualquer derivado. O motivo do cancelamento está em
[../DECISOES.md](../DECISOES.md).

## Paleta

| | | |
| --- | --- | --- |
| `#39FF14` | verde elétrico | a identidade principal, dominante |
| `#00FFFF` | ciano | energia perto do núcleo |
| `#BF00FF` | roxo | elementos distantes e secundários |
| `#FFA33A` | âmbar | **extremamente restrito** |
| `#060608` | fundo | quase preto |

Não introduzir paleta nova. Não transformar o símbolo em arco-íris.

---

## `[11/09]` A MARCA NOVA — o monograma GH

> As referências `01`–`11` acima são a identidade do **raio**, aposentada em
> 11/09. Ficam como histórico. O que vale agora é esta seção.

### Como ela entrou no site, e por que não foi desenhada por mim

O dono trouxe a arte pronta e pediu uma coisa só: *"pelo amor de Deus, eu
preciso de fidelidade nisso aqui"*. Eu já tinha tentado desenhar marca aqui duas
vezes e as duas foram recusadas — a última com a palavra dele: *"muito
gradadão"*. Redesenhar no olho seria a terceira tentativa do mesmo erro.

O caminho foi outro: **derivar a geometria dos pixels da arte**.

| Etapa | Ferramenta |
| --- | --- |
| traçar o contorno da versão monocromática | `scripts/tracar-marca.mjs` |
| provar que o traço é fiel | `scripts/conferir-fidelidade.mjs` |
| gerar favicon e ícones do PWA | `scripts/gerar-icones.mjs` (`npm run icones`) |

**O número da fidelidade:** 2.316 pontos de contorno viraram **39 vértices**, e
a diferença contra a arte é de **1,80% da área da marca** — toda ela na borda de
1 px do anti-serrilhado, que é o limite do que vetorizar bitmap alcança.

**O gradiente também foi medido, não escolhido.** A primeira versão usava eixo
diagonal e três paradas; renderizada ao lado da arte, o verde virava um cantinho
enquanto no original ele domina a esquerda. Medindo 7.754 pixels de marca em
seis faixas, o eixo é **horizontal** e o verde ocupa os primeiros ~30%.

### A fonte única

`src/lib/marca.js` guarda o caminho e as paradas. Dele sai **tudo**: o
componente React, o `favicon.svg`, os três ícones do PWA, o `apple-touch-icon` e
o cartão de compartilhamento. Para mudar a marca, troca-se a arte e roda-se
`npm run icones`; nunca se edita um ícone.

#### `[11/09]` O que o gerador escreve hoje, e por que cada formato

| Arquivo | Formato | Por quê |
| --- | --- | --- |
| `favicon.svg` | SVG · 1,9 kB | nítido em qualquer densidade |
| `icone-192.webp` · `icone-512.webp` | WebP · 4 e 10 kB | o corpo novo é um gradiente suave, e **PNG comprime gradiente muito mal**: o de 512 dava 274 kB, contra 13 kB em WebP |
| `icone-maskable-512.webp` | WebP · 9 kB | idem, e sem cantos arredondados — quem desenha a forma é o Android |
| `apple-touch-icon.png` | PNG · 37 kB | **exceção obrigatória**: o iOS não aceita WebP neste `<link>` |
| `cartao-1200x630.jpg` | JPEG · 31 kB | o `og:image`. JPEG porque o rastreador do Facebook ainda falha com WebP em parte dos casos, **e a falha é muda** — o link volta a aparecer sem imagem |

O conjunto pesa **97 kB**, contra 195 kB do conjunto anterior: ficou mais leve
apesar de ter ganhado um arquivo a mais e um corpo mais elaborado.

#### `[11/09]` Onde a marca aparece ANIMADA

Além dos ícones estáticos, a marca agora tem duas aparições com movimento, e as
duas saem do mesmo `CAMINHO_DA_MARCA`:

| Onde | O que acontece |
| --- | --- |
| `AberturaDaMarca` | ela é **pintada** por uma faixa de luz, a mesma luz revela a frase, e um **reflexo de objeto polido** corre por cima antes de a landing abrir |
| `MarcaFlutuante` | ela **fica** no hero depois da abertura, flutuando com movimento próprio e seguindo o ponteiro |

As duas usam a **mesma posição combinada** (`lib/marcaNoHero.js`), porque a
troca entre elas é um cruzamento e não um voo — a abertura é estática e a
`Landing` é `lazy`, então o hero pode não existir enquanto a abertura toca.

#### `[11/09]` O CORPO do ícone, e o defeito que ele consertou

Renderizados nos tamanhos de uso e sobre cinco papéis de parede, os ícones
antigos mostraram um problema que não aparecia em tamanho grande: **sobre papel
de parede preto o quadrado `#060608` funde com o fundo**, e sobra a marca
flutuando, sem silhueta — adesivo recortado, não ícone. Foi o que o dono
resumiu como *"a do pwa tem que ser bonitinho poxa"*.

O corpo passou a ter gradiente vertical, um brilho verde de um lado e roxo do
outro (as duas pontas do gradiente da própria marca) e uma borda interna quase
transparente, que é o que desenha a silhueta no preto. Nada disso toca o
desenho da marca.

Travas em `src/lib/__tests__/marca.test.js`: o favicon tem que conter o mesmo
caminho do componente; o raio não pode voltar como marca; ninguém pode copiar o
`d` para dentro de outro componente; **toda imagem citada pelo manifesto e pelo
`index.html` tem que existir**; e o `type` declarado no manifesto tem que bater
com a extensão do arquivo. As duas últimas existem porque ícone que some **não
quebra nada** — o navegador cai no genérico dele e ninguém percebe.

### O que NÃO deu certo, e está registrado para não ser tentado de novo

**A marca não sobrevive à extrusão 3D.** A peça central do hero era o raio
extrudado (`scene3d/SceneObjects.jsx`), e trocá-la pelo GH foi tentado duas
vezes em 11/09:

| Tentativa | Resultado |
| --- | --- |
| chanfro do raio (`bevelSize: 0.04`) | virou um **borrão verde arredondado** — o chanfro engoliu as contraformas, que no GH têm ~0.1 de largura |
| chanfro mínimo (`0.008`) | as contraformas apareceram, mas a peça continua ilegível girando, e **sólida em verde** |

A razão é de forma, não de ajuste: o GH é um monograma **plano**, de traços
finos, cuja identidade é o **gradiente**. Sólido verde em rotação destrói as
três coisas. A mudança foi revertida e a decisão está no `BACKLOG.md`.
