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

Quem usa hoje: `src/components/landing/Scene2D.jsx` — **e isso é estado
intermediário**. A 2D só aparece para quem não recebe a 3D, e a direção dela
será revista quando a cena em código estiver de pé.

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
