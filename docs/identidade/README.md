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

## O que ficou de fora, e por quê

A **grade de rotação 3D** (16 quadros girando 360°) foi **descartada pelo
próprio dono**: *"eu mandei a imagem animada de rotação sem querer, esse você
pode esquecer"*. Está registrado aqui para ninguém reencontrá-la num histórico
e achar que era parte do sistema.

## Como usar

**Como referência artística, nunca como asset de runtime.** Ordem explícita do
dono para a Landing: *"não coloque a imagem diretamente na Landing, não use como
background, não use como textura, não dependa da imagem em runtime"*.

A construção é em código — SVG para o símbolo, geometria em código para a cena.
Estas imagens são o **mapa**; o código é a construção.

## Paleta

| | | |
| --- | --- | --- |
| `#39FF14` | verde elétrico | a identidade principal, dominante |
| `#00FFFF` | ciano | energia perto do núcleo |
| `#BF00FF` | roxo | elementos distantes e secundários |
| `#FFA33A` | âmbar | **extremamente restrito** |
| `#060608` | fundo | quase preto |

Não introduzir paleta nova. Não transformar o símbolo em arco-íris.
