# Desempenho — as medições, e onde elas mandaram mexer

> **O que é isto.** O histórico de investigação de desempenho do GamerHub: o que
> cada rodada de medição disse, o que ela desmentiu, e as duas vezes em que a
> conclusão apontou para o lugar errado. Saiu de
> [OPERACAO.md](OPERACAO.md) em 29/08, quando a seção passou de 150 linhas.
>
> **O que NÃO é.** O portão que reprova PR por peso continua em
> [OPERACAO.md](OPERACAO.md) — ele é operação, roda sozinho, e não depende de
> ninguém ler este arquivo. As decisões que saíram daqui estão em
> [DECISOES.md](DECISOES.md); o mapa de onde cada peça vive, em
> [ARQUITETURA.md](ARQUITETURA.md).
>
> **Por que guardar isto.** Duas vezes seguidas eu cheguei a um plano de
> otimização bem fundamentado e errado de alvo — uma por olhar byte quando o
> custo era CPU, outra por corrigir o caso "ninguém está vendo" e não medir o
> caso "está na tela". Nos dois casos, o que corrigiu o rumo foi uma MEDIÇÃO, e
> não um raciocínio melhor. É o que este arquivo existe para lembrar.

---

### `[04/09]` As artes da arena: 5 MB de PNG viraram 60–282 KB, e o portão que faltava

**O que foi medido.** O dono gerou duas artes com fundo transparente para o
login e o cadastro. Do jeito que chegaram, elas eram **PNG de ~2,5 MB cada** —
na camada 2 (§0.4), que é por onde passa todo mundo que decide ficar, e boa
parte no celular.

**O tratamento, em duas etapas, e cada uma tem um motivo diferente:**

| Etapa | O que fez | Por quê |
| --- | --- | --- |
| **Recorte** | achar a caixa real de cada corpo no canal alfa e cortar ali | metade de cada PNG era transparência pura, que ocupa byte e não aparece |
| **WebP em dois tamanhos** | 340 px e 720 px, `q:v 70` | o celular exibe ~150 px de largura; baixar 720 px para isso é o desperdício mais comum de imagem responsiva |

**O resultado, por tela — só um par carrega por vez:**

| Tela | Par de 340 px | Par de 720 px |
| --- | --- | --- |
| `/login` (fogo em guarda + gelo em guarda) | **83 KB** | **279 KB** |
| cadastro (fogo de frente + gelo de costas) | **62 KB** | **215 KB** |

Os oito arquivos somam **639 KB** no repositório, mas nenhum visitante baixa os
oito: o `srcset`/`sizes` escolhe um tamanho, e o modo escolhe o par.

> **A coluna NÃO é "celular × desktop", e essa correção é minha.** Eu escrevi
> aqui e no código que o celular pagava 83 KB. **Não paga.** Medido em 390×844
> com DPR 3, o navegador escolhe `fogo-guarda-720`: a conta que ele faz é
> `largura em CSS × densidade`, e 3 pixels físicos por CSS jogam qualquer
> telefone moderno no arquivo grande. O par de 340 só serve tela 1x.
>
> É a escolha certa dele — em tela 3x o arquivo pequeno apareceria borrado. O
> que estava errado era a **frase**, não o `srcset`: eu tinha inferido "celular
> = arquivo pequeno" e apresentado como fato (§1.1).

**E foi essa medição que liberou dobrar o tamanho no celular de graça.** O dono
reclamou que as figuras estavam pequenas no telefone. Como o aparelho dele já
baixava o arquivo de 720 px para exibir 119 px de largura, crescer para 252 px
**não mudou byte nenhum** — mudou só quanto daquele arquivo aparece na tela.
Antes: 16vh de altura, 135 px. Depois: 34vh, 287 px. Mesmo download, o dobro de
presença.

**O recorte foi onde eu errei duas vezes, e as duas o dono viu antes de mim.**

| A tentativa | O que ele viu | O que a medição mostrou |
| --- | --- | --- |
| corte no meio da imagem (x=768), por simetria | *"o personagem de fogo tá passando para o lado do de gelo"* (cadastro) | o corpo do fogo vai até x=890 e o do gelo só começa em x=1070 — o meio caía dentro das labaredas |
| corte por reta, agora nos limites medidos | *"o fogo tá aparecendo um pouco na parte de gelo, não ficou um corte muito limpo"* (login) | **os dois se sobrepõem por 75 colunas**: o fogo do golpe vai até 808 e o gelo já começa em 734 |

**A segunda é a que ensina, porque nenhuma reta resolveria.** Onde os dois
efeitos se cruzam não existe coluna vazia — a mais vazia da faixa ainda tinha 95
pixels. Qualquer corte vertical ali corta um golpe pela metade **e** leva um
pedaço do outro junto. Foi exatamente o que apareceu no celular dele: uma lasca
laranja na borda da arte do gelo e um caco azul na do fogo.

**O que resolveu:** na faixa disputada a fronteira passou a ser a **cor** do
pixel, não a posição — o lado do fogo descarta o que é nitidamente frio, o do
gelo o que é nitidamente quente, o núcleo branco do golpe (que não tem cor, e
por isso escapava das duas regras) vai para o dono da metade em que está, e o
alfa cai por rampa nos últimos 30 px, para o halo residual não terminar numa
reta. Depois disso cada arte é recortada na caixa real do que sobrou.

Resultado medido nas artes servidas pelo site: **0** pixels da cor do adversário
na borda de cada uma. Com o corte antigo eram **638** na arte do gelo.

> Duas lições, e a segunda é nova aqui: **simetria aparente não é medição** — e
> **quando dois elementos se sobrepõem, o eixo do corte não existe.** Procurar
> "o melhor lugar para cortar" era a pergunta errada; a certa era "o que decide
> a quem cada pixel pertence".

**O que o orçamento de bytes do CI diz, e o que ele NÃO vê.** O
`orcamento-de-bytes.mjs` continua em 219,7 de 222 KB gzip — inalterado, porque
ele mede **JavaScript e CSS**, e imagem não passa por ele. Ou seja: trocar estas
artes por um PNG de 2,5 MB deixaria o CI **verde**. Daí as duas travas novas:
`pesoDaArena.test.js` (180 KB por arquivo, 800 KB no conjunto, provada copiando
um dos PNG originais para a pasta) e `e2e/artes-da-arena.mjs` (a contagem de cor
acima, provada reinjetando o recorte antigo e vendo o CI acusar 638).

---

### `[01/09]` O fluxo de dados da landing — e o A/B que mudou o desenho

O pedido incluía *"algum nível de interatividade"* nos elementos flutuantes. O
caminho óbvio — mover cada elemento no `requestAnimationFrame` — é exatamente o
custo que encareceu a cena 3D. O desenho escolhido foi outro: **um único
ouvinte de ponteiro escreve uma variável CSS**, coalescido por `rAF`, e o
deslocamento acontece no compositor.

**Mas isso não bastou, e só o A/B mostrou.** Medição com CPU a 1/4, comparando a
mesma página com e sem a camada, em dois builds servidos em portas separadas:

| | parado | com o ponteiro varrendo |
| --- | --- | --- |
| sem a camada | 3911 ms | 11264 ms |
| com a camada (1ª versão) | 3892 ms | 11959 ms |
| **custo atribuível** | **−19 ms** (ruído) | **+714 ms** |

**Parado a camada custa zero, como projetado.** O problema estava na
interatividade: cada atualização da variável invalidava o estilo dos **onze**
traços e disparava onze transições.

**A correção:** agrupar os traços em três planos de profundidade. Só os três
contêineres leem a variável; os traços dentro nem sabem que ela existe.

| | parado | com o ponteiro |
| --- | --- | --- |
| custo atribuível, agrupado | −43 ms | **+451 ms** |

**714 → 451 ms, queda de 37%**, sem perder o efeito de camada.

**O que sobra, dito com honestidade:** 451 ms **não é zero**. O contexto que os
dimensiona: é sob CPU 4× mais lenta, durante 60 movimentos sintéticos em laço
— pior que uso real —, sobre uma base de 7309 ms, e some por completo quando o
ponteiro para. No celular o ouvinte nem é registrado (`pointer: fine`).

**A alternativa, se um dia incomodar:** tirar o parallax. A camada sem
interatividade custa zero medido. Fica registrado para a decisão ser informada,
e não uma redescoberta.

---

### `[02/09]` As peças de videogame custam ZERO, e o número é o ponto

O site logado ganhou uma segunda camada de fundo — peças de videogame em SVG,
somadas ao fluxo de dados que já estava lá. Duas camadas numa tela onde a
pessoa passa uma hora pede número, não fé.

Medido com a página **parada**, CPU a 1/4, 6 segundos:

| | |
| --- | --- |
| fps | **59,6** |
| bloqueio da thread principal | **0 ms em 0 tarefas** |

**Por que dá zero.** Tudo é `transform` e `opacity` em `@keyframes` — as duas
propriedades que o navegador anima no **compositor**, fora da thread principal.
Não existe laço de JavaScript por quadro em lugar nenhum das duas camadas.

É a mesma escolha que o `FundoAnimado` das páginas públicas já fazia, e a razão
está registrada desde 29/08: foi o laço por quadro que custou 29.441 ms de
thread na cena 3D. A lição virou o jeito padrão de fazer enfeite aqui.

**O que este número NÃO diz:** ele mede a página parada. Rolagem e digitação
competem por thread de outras formas, e o feed é a tela onde mais se rola — por
isso o `parallax={false}` no `FluxoDeDados` do site logado continua valendo.

---

### `[02/09]` A cena 3D em regime permanente — e por que o número NÃO serve para julgá-la

O item do backlog dizia que a cena "está pesada", e isso era impressão sem
número: todas as medições anteriores mediram **carga** (montar a cena), nunca
**permanência** (ela rodando com a página parada).

Medido: página parada, cena visível, 6 segundos.

| | fps | bloqueio em 6 s |
| --- | --- | --- |
| com a cena 3D | 15,5 | **5877 ms** em 92 tarefas |
| sem a cena (2D) | 60,0 | 0 ms |

**E é aqui que eu quase escrevi uma bobagem.** Esse número parece dizer "a cena
3D come 45 fps". Ele não diz — porque este navegador **não tem GPU**. É
Chromium sem placa, com WebGL em software: a CPU faz o trabalho da placa de
vídeo. Reportar isso como custo real seria apresentar artefato de ambiente como
fato sobre o aparelho do dono (§1.1).

#### O experimento que separa uma coisa da outra

Se o custo **escala com pixels**, é rasterização — trabalho que num PC de
verdade é da GPU. Se fica **constante**, é JavaScript/three.js — e esse custa
igual em todo lugar.

| Janela | Canvas | Bloqueio em 6 s |
| --- | --- | --- |
| 1280×800 | 1,024 Mpx | **5583 ms** |
| 640×400 | 0,256 Mpx | **0 ms** |
| 320×240 | 0,116 Mpx | **0 ms** |

Não é proporcional — é um **penhasco**. Com 4× menos pixels o bloqueio não cai
para um quarto: cai para **zero**. Abaixo de certo ponto o rasterizador de
software cabe no orçamento do quadro, e nenhuma tarefa passa dos 50 ms.

#### O que isso permite afirmar, e o que não permite

**Permite:** o custo da cena é dominado por **rasterização por pixel**. E o
lado JavaScript dela é **pequeno** — a 0,256 Mpx a cena roda 6 segundos sem
produzir uma única tarefa longa.

**Não permite:** dizer quanto ela pesa na máquina do dono. Lá quem faz esse
trabalho é a GPU, e eu não tenho como medir isso daqui.

**Para onde a próxima investigação aponta:** se o custo é por pixel, as
alavancas são resolução (o `dpr` adaptativo que já existe), **overdraw** —
quantas camadas transparentes são pintadas por cima umas das outras — e custo
de shader. **Não** são "menos objetos" nem "menos JavaScript", que era para
onde eu ia olhar.

O que fecha isso de verdade é uma medição no aparelho dele, com o painel de
desempenho do navegador aberto — e essa eu não consigo fazer sozinho.

---

### `[02/09]` O raio da intro nunca era desenhado — e a culpa NÃO era da cena 3D

Relato do dono: *"o raio/efeito visual da intro às vezes corta, falha ou
simplesmente não aparece"*. Medido, o resultado é pior do que "às vezes".

**O teste:** amostrar o `stroke-dashoffset` do traço a cada quadro. Se o raio
desenha, o valor passa por estados intermediários entre 1 (nada desenhado) e 0
(completo). Se ele só aparece pronto, o desenho nunca aconteceu na tela.

| CPU | Valores distintos de `stroke-dashoffset` | Leitura |
| --- | --- | --- |
| 1× | **1** (`0px` desde a primeira amostra, às 496 ms) | nunca desenhou |
| 4× | **1** (`0px` desde as 894 ms) | nunca desenhou |
| 6× | 0 amostras em 1,5 s | nem apareceu |

**Em nenhuma medição o traço chegou a ser desenhado.** Ele pulava direto para o
estado final — o desenho, que é a graça inteira da animação, nunca acontecia.

#### O palpite que a medição derrubou

A suspeita óbvia era a cena 3D disputando a thread principal com a intro. O A/B
diz que não:

| | bloqueio durante a intro (0–1300 ms), CPU 4× |
| --- | --- |
| com a cena 3D | 602 ms em 4 tarefas |
| **sem** a cena 3D | **594 ms em 4 tarefas** |

Oito milissegundos de diferença é ruído. **Mexer na cena 3D não teria
adiantado nada** — e essa era a otimização que eu ia fazer. É a terceira vez
neste arquivo que uma medição corrige o alvo de um plano bem fundamentado.

#### O mecanismo de verdade

O Framer Motion calcula cada quadro dentro de `requestAnimationFrame`. Durante
o boot da landing a thread principal fica ocupada (os 602 ms acima), o rAF não
roda, e quando volta a rodar **a animação já passou do fim**: ela salta em vez
de correr. Não é lentidão — é a animação inteira sendo pulada.

#### A correção, e o depois

A intro passou a ser **CSS puro**: `stroke-dashoffset` em `@keyframes`, com
`pathLength="1"` no SVG para normalizar o comprimento sem medir nada em JS. O
relógio de uma animação CSS é do navegador e corre independente do JavaScript —
com a thread travada ela perde quadros, mas continua na posição certa quando
volta.

| CPU | Antes | Depois |
| --- | --- | --- |
| 1× | 1 valor | **5 valores** — `1 → 0,994 → 0,795 → 0,340 → 0` |
| 4× | 1 valor | **4 valores** |

O traço passou a ser desenhado de verdade nas duas velocidades.

#### A metade que faltava: a intro saiu do chunk da landing

**Primeiro, uma correção do que eu escrevi acima.** Eu tinha registrado que a
6× a medição era "inconclusiva". Remedindo com uma janela maior, ela é
**positiva**: o traço desenha a 6× e a 8× também. A janela de 1,5 s é que
acabava antes — era limitação do meu teste, não do código.

O que sobrava era outra coisa, e essa era real: **o traço só existia no DOM às
1320 ms a 6× e 1820 ms a 8×**, porque a intro morava no Hero, que vive dentro
do chunk lazy da landing. Todo esse tempo é tela preta.

A intro passou a ser montada pelo `HomeOrLanding` (`App.jsx`), que está no
pacote inicial — e ela **também serve de fallback** do `Suspense`: enquanto o
chunk da landing baixa, quem está olhando vê o raio em vez do splash.

| CPU | Traço aparece — antes | depois | Valores distintos |
| --- | --- | --- | --- |
| 6× | 1320 ms | **911 ms** | 3 → 4 |
| 8× | 1820 ms | **1433 ms** | 3 → **6** |

A 8× o desenho ficou visivelmente mais completo: `1 → 0,994 → 0,844 → 0,488 →
0,091 → 0`, ou seja, a animação progride de verdade em vez de dar dois saltos.

**O que isso custou, medido:** o pacote inicial foi de 702,5 kB para 712,1 kB
(**+9,6 kB**; +3,0 kB gzip), dentro do teto de 740 kB. Só foi barato porque, na
mesma leva, a intro deixou de depender do Framer Motion — mover a versão antiga
teria arrastado a biblioteca junto.

**Por que valeu:** 400 ms a menos de tela preta no aparelho fraco, que é
exatamente onde o problema aparecia. Num aparelho rápido a diferença é
imperceptível — e é assim que tem que ser.

---

### `[02/09]` A trilha da landing: o que ela custa, e o que NÃO custa

O som ambiente deixou de ser sintetizado e passou a ser um arquivo real.
Arquivo tem peso; o desenho existe para esse peso não cair em quem não pediu.

> **`[03/09]` A faixa mudou** — o dono pediu a troca por "Lofi Coffee Shop"
> (Alex Morgan, Pixabay Content License), e a pergunta dele foi direta: *"agora
> o arquivo é um .mp3 ao invés de ser um .ogg pequeno, isso afeta muito?"*.
>
> **Afeta, e o número diz o quanto:**
>
> | | Tamanho | Duração |
> | --- | --- | --- |
> | trilha anterior (`.opus`) | 304 KB | 36 s |
> | o `.mp3` que ele mandou, cru | **3.644 KB** | 114 s |
> | recodificado em Opus 64 kbps | **807 KB** | 88 s |
>
> O mp3 cru seria **12×** o arquivo anterior. Em Opus fica em 2,7× — e a
> diferença que decide é **onde** esse peso cai: a trilha só é baixada quando
> alguém LIGA o som, e é servida pela Vercel, não pelo Supabase, então não
> encosta na cota de egress (§0.2). O portão de bytes continua passando com a
> mesma margem, porque o áudio nunca esteve no carregamento inicial.
>
> O que ela custa de verdade é a espera de quem clica: **807 KB é ~2 s no 4G;
> 3,6 MB seriam ~9 s** de silêncio depois do clique.
>
> **O ponto de corte do laço foi medido, não escolhido a olho.** O original tem
> fade-out (−14,2 dB no início contra −30,6 dB no fim: 16,4 dB de salto em
> laço). Cinco regiões candidatas foram medidas, e a que começa em 4 s casou com
> **1,0 dB** de diferença entre as pontas — menos do que a variação natural
> dentro da própria música.
>
> **O custo que ninguém vê:** o PCM descompactado subiu de ~13,8 MB para
> **~33,8 MB** de RAM enquanto o som está ligado, porque a faixa é mais longa.
> É o preço de um laço que demora mais a se repetir, e ele só existe para quem
> ligou o som.

**O que ele custa a quem NÃO liga o som: zero.** Medido num navegador de
verdade, contando as requisições:

| Momento | Pedidos do `.opus` |
| --- | --- |
| página carregada, som desligado | **0** |
| depois do clique em ligar | 1 (HTTP 200) |
| desligar e religar | 2 — rebaixa do cache |

O módulo não pede o arquivo, não cria `AudioContext` e não aloca nada até
alguém ligar o som ou a tentativa pós-intro acontecer.

**Rede.** O original tem 980 KB (Ogg Vorbis estéreo, 195 kbps). O publicado
tem **296 KB** (Opus estéreo, 56 kbps): 3,3× menor. Nesta faixa de volume, e
neste material, a diferença não é audível — Opus a 56 kbps entrega o que o
Vorbis entregava a 195. O arquivo sai do build com hash no nome, então é
cacheável para sempre.

**Memória, e é o número que quase passou batido.** `decodeAudioData` guarda PCM
descompactado: 36 s × 48 kHz × 2 canais × 4 bytes = **~13,8 MB de RAM**
enquanto o som toca. É o preço de um laço sem emenda; a alternativa
(`<audio loop>`) quase não gasta memória mas tem furo audível na volta em
vários navegadores.

**O erro que eu quase deixei passar:** escrevi no código que o `close()` do
contexto devolvia esses 13,8 MB. **Não devolve.** O buffer vive num módulo à
parte, e `AudioBuffer` não pertence a contexto nenhum — fechar o contexto não
o alcança. Ficavam 13,8 MB retidos pelo resto da sessão de alguém que tinha
acabado de pedir silêncio. Hoje o desligar chama `esquecerTrilha()`, e o custo
disso é rebaixar do cache ao religar (confirmado: 1 pedido vira 2).

**O laço, medido em vez de ouvido.** O original não é loop, apesar de o autor
descrevê-lo assim:

| | RMS dos primeiros 10 ms | RMS dos últimos 10 ms |
| --- | --- | --- |
| original | 0,2440 | 0,0013 |
| publicado | 0,1484 | **0,1576** |

Tocar o original em laço daria, a cada 41 s, a música morrendo até quase o
silêncio e voltando de repente no volume cheio. Não é estalo — é a faixa
reiniciando na cara de quem está lendo. A região entre 1 s e 37 s foi recortada
e costurada com crossfade de 3 s em curva de cosseno; o salto na emenda ficou
**35 dB abaixo do pico**.

Não dá para eu escutar o resultado, e não vou fingir que escutei: o que está
provado aqui é a medida, não a impressão auditiva.

---

### `[02/09]` A camada mais densa, e o parallax de ROLAGEM que ela ganhou

O dono achou o efeito acima *"muito discreto"* e pediu mais — com a ressalva
*"só não deixa feio"*. Ele também descreveu, sem saber o nome, o que faltava:
*"quando rolo a tela, parece que para no tempo, é assim mesmo?"*. **Era assim
mesmo, e era um defeito de percepção real:** a camada só reagia ao ponteiro.
Rolando a página ela descia colada ao conteúdo, como um papel de parede — e
papel de parede que não se move em relação ao texto lê-se como cenário parado.

**O que mudou:** 11 → **23 traços**, quatro deles marcados `pacote: true` (mais
largos, mais brilhantes e mais rápidos, para o olho ter onde pousar), e um
**parallax de rolagem** aplicado no elemento raiz — deslocamento contrário ao
scroll, de modo que o fundo anda em velocidade diferente do texto.

Medido no mesmo A/B da seção anterior (CPU 1/4, dois builds em portas
separadas, 60 movimentos de ponteiro + varredura de 3000 px de rolagem):

| | parado | com ponteiro + rolagem |
| --- | --- | --- |
| 23 traços, sem parallax de rolagem | ≈ 0 | **+750 ms** |
| 23 traços, **com** parallax de rolagem | ≈ 0 | **+1046 ms** |
| **custo só do parallax de rolagem** | — | **≈ +296 ms** |

**Parado continua custando zero** — dobrar a quantidade de traços não mexeu
nisso, porque a animação inteira é CSS no compositor.

**Por que aceitei os 296 ms.** Eles compram exatamente a queixa do dono, que é
percepção de vida na página; e a regra de ouro da seção anterior continua
valendo — o número aparece sob CPU 4× mais lenta, em varredura sintética
contínua, e desaparece assim que a pessoa para de rolar. O `transition` **não**
é aplicado no elemento de rolagem de propósito: reiniciar uma transição a cada
quadro de scroll era o caminho caro, e é o que teria feito o número explodir.

**O que NÃO foi medido:** aparelho real do dono. Os números aqui são de
laboratório, no mesmo ambiente das medições anteriores — comparáveis entre si,
não com um PageSpeed (§0.3, regra 5).

---

### `[01/09]` Auditoria da cena 3D — o que medi, e o experimento que deu ZERO

O dono disse *"tô percebendo que ele tá pesando"* sobre o raio, e pediu
otimização **sem tirar qualidade**. Auditar antes de alterar.

#### O experimento do `import * as THREE` — não vale a pena alterar

`Lightning.jsx` e `SceneObjects.jsx` usam `import * as THREE from 'three'`;
`LandingScene.jsx` usa imports nomeados. A sabedoria comum diz que namespace
quebra tree-shaking. **Medi em vez de acreditar:** converti os dois arquivos
para imports nomeados (só 5 símbolos: `AdditiveBlending`, `ExtrudeGeometry`,
`MathUtils`, `Shape`, `Vector3`) e reconstruí.

| | chunk `LandingScene` |
| --- | --- |
| `import * as THREE` | 707,98 kB · 189,03 kB gzip |
| imports nomeados | 707,98 kB · 189,03 kB gzip |

**Byte a byte igual — o hash do arquivo nem mudou.** O Rollup já tree-shakeava
o namespace de forma idêntica, porque todo acesso é estático (`THREE.Vector3`).
Revertido: sem ganho mensurável, não se altera.

> Fica registrado justamente para eu (ou outra IA) não "consertar" isto de novo
> daqui a três meses achando que é ganho fácil.

#### O custo do raio NÃO está no laço por quadro

Li o `useFrame` do `Lightning.jsx` inteiro. Ele é bem escrito: nenhuma alocação
por quadro (muta um `Float32Array` pré-alocado), refs em vez de estado do React,
e a geometria só é regerada **quando o arco dispara** — a cada 0,6 a 2,4 s, não
a cada quadro. O trabalho por quadro por arco é uma subtração, um `clamp` e um
`sin`. Isso não pesa.

#### O suspeito real: SETE `pointLight`

| Onde | Quantas |
| --- | --- |
| `LandingScene` (estáticas) | 2 |
| `Lightning` — uma por arco | 3 |
| `Lightning` — flash de trovão | 1 |
| `SceneObjects` — flash | 1 |
| **total de `pointLight`** | **7** (+ 1 direcional + 1 ambiente) |

**O detalhe que torna isso caro:** no three.js, luz com `intensity = 0`
**continua custando shader inteiro**. Ela permanece no array de uniforms e é
avaliada por fragmento, em toda superfície com `MeshStandardMaterial`. As quatro
luzes de flash ficam apagadas a maior parte do tempo e cobram o tempo todo.

**E o conserto óbvio é uma armadilha.** Alternar `light.visible` conforme o
flash mudaria a CONTAGEM de luzes, e a contagem faz parte da chave do cache de
programas do three.js: cada mudança dispara **recompilação de shader**. Trocar
custo constante por engasgo a cada 0,6 s é piorar.

#### O que eu NÃO consigo medir aqui, e por isso não alterei nada

Este ambiente renderiza WebGL **por software** (swiftshader). Contagem de luz,
draw call e bytes são independentes de GPU; **tempo de quadro e custo de
fragmento não são**. Medir FPS aqui e chamar de resultado seria inventar número
— e comparar laboratório de software com o celular dele é o erro que a regra 5
do §0.3 proíbe.

**Draw calls medidos:** 215 em 3 s, num canvas de 1280x800 a DPR 1.

#### A proposta que precisa do aparelho do dono

Compartilhar **uma** `pointLight` entre os três arcos, em vez de uma por arco:
7 → 5 luzes. O risco visual é real e específico — quando dois arcos disparam
dentro da mesma janela de 0,36 s, hoje há duas luzes e passaria a haver uma.
Pelos intervalos configurados isso acontece com frequência não desprezível.

**Não implementado**, porque "a luz verde não fica tão forte" já foi uma
regressão real deste projeto, e eu não tenho como medir aqui se o ganho paga o
risco. Depende de comparação lado a lado no aparelho dele.

---

### `[29/08]` O fundo animado da "Sobre" custa zero, e isso foi medido

O dono pediu formas se mexendo atrás do texto — *"batendo aleatoriamente, tipo
um ping-pong em tempo real"* — e perguntou antes **se aquilo lesa o
desempenho**. A pergunta certa, e a resposta depende de qual caminho se toma.

**O que foi recusado:** física de verdade. Colisão exige um laço de JavaScript
a cada quadro, que é o mesmo custo dos 29.441 ms de thread principal da cena
3D. Numa página de **leitura** o estrago seria maior, porque a pessoa fica
parada minutos e o laço nunca para.

**O que foi feito:** doze peças animadas só com `transform` e `opacity` — as
duas rodam no compositor, fora da thread principal.

**A medição.** A/B no mesmo build e na mesma página, usando o próprio
`prefers-reduced-motion` como estado de controle (com ele a camada some), CPU
emulada **4× mais lenta**, 6 s com a página parada:

| Estado | Tarefas longas |
| --- | --- |
| Sem animação (camada escondida) | **0** |
| Com as doze peças atravessando | **0** |

**O que isso confirma, e o que não confirma.** Confirma a regra que já estava
neste arquivo: a propriedade animada decide o custo, não a quantidade de
elementos. `transform`/`opacity` são compostas; `text-shadow` e `filter` não —
foi por isso que o `electricBuzz` da landing perdeu o `textShadow`. **Não**
confirma nada sobre aparelho real: é laboratório, e laboratório não substitui
campo (regra 5 do §0.3).

---

### `[29/08]` O salto do fundo no celular era a barra de endereço

**O sintoma**, relatado pelo dono: as peças davam um pulo no começo da rolagem
e outro no fim. Ele disse que precisaria gravar a tela para explicar.

**A causa.** A camada é `fixed` e cada peça é posicionada em **porcentagem da
altura dela**. Ao rolar para baixo, o celular esconde a barra de endereço — a
janela cresce, toda porcentagem é recalculada de uma vez, e as peças pulam
juntas. No fim, a barra volta e elas pulam de novo.

**A medição que provou**, com as animações congeladas (para ler posição base, e
não movimento) e a janela indo de 830 para 930 px:

| Peça | 1ª | 2ª | 3ª | 4ª | 5ª | 6ª |
| --- | --- | --- | --- | --- | --- | --- |
| Salto | 4 px | 16 px | 42 px | 54 px | 57 px | **70 px** |

**Quanto mais embaixo a peça, maior o salto.** É essa progressão que prova ser
porcentagem recalculada — corte de animação ou defeito de renderização
atingiriam todas por igual. Foi o que descartou as duas hipóteses erradas sem
precisar testá-las.

**A correção:** altura em `100lvh` (`.camada-de-fundo`, em `index.css`), que é a
altura da janela **com a barra recolhida** — valor fixo. `dvh` seria o erro
oposto: ele acompanha a barra, e é exatamente o que provoca o pulo.

> **O que NÃO foi verificado, e é importante que esteja escrito:** a correção
> em si. Num navegador de desktop não existe barra retrátil — `lvh` é igual a
> `vh`, e redimensionar a janela move os dois juntos. A medição prova o
> **mecanismo**, não a cura. Só um celular de verdade confirma.

---

### `[28/08]` A medição de campo, e o que ela desmentiu

PageSpeed Insights, 28/08 às 19:19, Lighthouse 13.4.1:

| | Celular (Moto G Power emulado) | Computador |
| --- | --- | --- |
| **Desempenho** | **87** | **57** |
| First Contentful Paint | 2,9 s | 0,6 s |
| Largest Contentful Paint | 3,3 s | 1,2 s |
| **Total Blocking Time** | **0 ms** | **14.830 ms** |
| Cumulative Layout Shift | 0,012 | 0,003 |
| Speed Index | 2,9 s | 6,8 s |

Acessibilidade 98, Práticas 100, SEO 92 nos dois.

**No celular a rodada de otimização funcionou, e o número que prova é o TBT
zerado.** Em 27/08 ele estava em 3.690 ms (Termux) e 15.310 ms (PageSpeed); a
nota saiu de 36 para 87. O celular recebe a `Scene2D` e simplesmente não paga
os 887 KB de então.

**No desktop o resultado é ruim, e ele desmente uma frase que eu havia
escrito.** A documentação dizia que a cena 3D "não pesa no carregamento, porque
chega depois do ocioso". O TBT diz o contrário: chegar depois do ocioso adia o
trabalho, **não o elimina** — e a thread principal travada aparece no Speed
Index (6,8 s contra 1,2 s de LCP) e derruba a nota para 57.

> **Ressalva sobre o número, para ele não ser citado como exato depois.** A
> corrida de desktop rodou com **"Limitação personalizada"**, e não com o
> preset padrão (a de celular usou "Limitação lenta de 4G", esse sim padrão).
> Ou seja: os 14.830 ms **não são comparáveis** a uma corrida de desktop comum,
> e a magnitude está inflada por uma configuração que não sabemos qual é.
>
> O que a medição sustenta com segurança: no desktop a cena 3D custa **muito**
> trabalho de CPU depois da primeira pintura, e a diferença entre FCP/LCP
> ótimos e Speed Index de 6,8 s tem uma causa só. O que ela **não** sustenta é
> o valor absoluto. Repetir no preset padrão antes de usar esse número para
> decidir qualquer coisa (§0.3, regra 5: mesma ferramenta, mesmo aparelho,
> mesma configuração).

> A lição que fica: *"fora do caminho crítico"* e *"de graça"* não são a mesma
> coisa. O byte adiado continua sendo parseado e executado, e o orçamento de
> bytes — que mede o **carregamento inicial** — nunca ia enxergar isso. Ele
> continua certo no que mede; só não mede esta parte.

### `[28/08]` O perfil de CPU, e por que eu ia otimizar o lugar errado

A segunda corrida trouxe a repartição da thread principal no desktop — **30,7 s
no total** — e ela reescreve o diagnóstico:

| Categoria | Tempo |
| --- | --- |
| **Other** | **29.441 ms** |
| Script Evaluation | 789 ms |
| Style & Layout | 227 ms |
| Rendering | 133 ms |
| Script Parsing & Compilation | 79 ms |
| Garbage Collection | 28 ms |
| Parse HTML & CSS | 3 ms |

**96% do custo está em "Other"**, que num app WebGL é o `requestAnimationFrame`
— o laço de animação. Parsear, compilar e executar os 887 KB de então somam
**menos de 900 ms**.

**A conclusão incomoda e é importante:** o plano que eu tinha (`createRoot` +
`extend` seletivo, −20% de bytes) mexeria nos 789 ms e deixaria os 29.441 ms
intactos. Eu ia otimizar com capricho a fatia errada. Foi por não ter esse
perfil que a hipótese do tamanho durou tanto — e é o §0.3 literal: **byte e CPU
são contas diferentes**.

**O desperdício de verdade:** a cena vive no Hero, no topo da página, e
continuava desenhando 60 vezes por segundo **depois que o visitante rolou para
longe dela**. Ninguém vê, e a CPU paga.

**A correção** é um `IntersectionObserver` que desliga o `frameloop` do
`<Canvas>` quando a cena sai da tela. Medido num navegador de verdade:

| | Desenhos em 2 s |
| --- | --- |
| Cena visível | 125 |
| Cena fora da tela | **0** |

Travado por `e2e/cena-3d.mjs`, que roda no CI e envolve `gl.drawElements` para
contar desenho de fato. Provado nos dois sentidos: com o `frameloop` fixo em
`always`, o teste falha acusando 140 desenhos fora da tela.

> **Por que não `frameloop="demand"`:** `demand` só desenha quando alguém pede
> um quadro, e esta cena é animada por natureza — ela congelaria justamente
> enquanto visível.

### `[29/08]` A correção acima estava CERTA e era metade — a metade menor

O dono repetiu o PageSpeed e o desktop continuou em 58, com 31,3 s de thread
principal e **30.182 ms em "Other"**. Praticamente o mesmo número de antes.

O erro do diagnóstico de 28/08 não foi a medição nem a correção: foi a
pergunta. Eu perguntei "por que a cena gasta CPU quando ninguém está vendo?" e
respondi bem. Nunca perguntei **quanto ela custa enquanto ESTÁ sendo vista** —
que é o caso em que o Lighthouse a observa, e o caso em que o visitante está
olhando para ela.

Medido em 29/08, navegador de verdade, `PerformanceObserver` de `longtask`,
janela de 8 s com o Hero na tela e build de produção:

| Configuração | Quadros | Long tasks | Thread bloqueada |
| --- | --- | --- | --- |
| `dpr [1, 1.5]` + `antialias` | 88 | 88 | **8.066 ms de 8.000 ms** |
| `dpr 1`, sem `antialias` | 133 | 132 | 7.897 ms |
| `dpr 0,75` | 182 | 9 | 468 ms |
| `dpr 0,5` | 243 | **0** | **0 ms** |
| resolução adaptativa (o que ficou) | 236 | 1 | **52 ms** |

**A thread principal ficava 99% ocupada**, e cada quadro isolado passava dos
50 ms que definem uma long task. Só cinco chamadas de desenho por quadro — o
custo não vinha de quantidade de objeto nem de bytes de JavaScript, e sim de
**PIXEL**. Foi por isso que nenhuma das otimizações de tamanho encostou nele.

Isso também explica a contradição entre os dois relatórios do dono: o do
**celular** trazia TBT **0 ms**, o do **desktop**, 31 s. Não era ruído de
medição — a cena não sobe abaixo de 1024px, então o celular nunca pagou por ela.

**A correção da época** foi resolução adaptativa (desfeita depois — ver a seção
seguinte): a cena começava no `dpr` mais barato e subia se
os quadros couberem em 60 fps. Não é um número fixo porque a medição acima é em
rasterização por software — o que Lighthouse e PageSpeed usam, e o que também
acontece em máquina com GPU bloqueada; numa máquina com GPU, cravar 0,5 puniria
quem não tem problema nenhum.

`e2e/cena-3d.mjs` passou a barrar bloqueio de thread acima de 800 ms, além de
continuar contando desenhos. Provado nos dois sentidos: **0 ms** com a correção,
**2.151 ms** com `dpr [1, 1.5]` e `antialias` de volta.

> **A lição que fica, e ela é de método:** "corrigi o caso A" não é o mesmo que
> "corrigi o problema". Quando o número não se move depois de uma correção
> medida e travada, o certo é procurar o caso que não foi medido — e não repetir
> a mesma medição esperando outro resultado (§1.2).

### `[29/08]` A parte da otimização que foi DESFEITA, e o que ela ensinou

A resolução adaptativa era o que zerava as long tasks na tabela acima. Ela foi
desfeita — pelo dono, testando, em **três rodadas seguidas**, cada uma com um
sintoma novo:

| Rodada | O que ele viu |
| --- | --- |
| 1 | *"começa muito pixelada, fica horrível"* — ela começava em `dpr` 0,5 e subia |
| 2 | *"a luz verde não fica tão forte"* — resolução baixa borra o degradê do `pointLight` |
| 3 | *"o raio às vezes é cortado pela metade"* — o fade de entrada, pego no meio |

**O erro foi de método, e é o que vale guardar.** Eu estava otimizando o número
do Lighthouse contra a coisa que o número existe para medir. Para a ferramenta,
a cena feia e a bonita valem igual; para quem abre o site, não. E eu insisti
três rodadas antes de aceitar isso — a cada uma, consertando o sintoma em vez de
aceitar que a direção estava errada.

**O que ficou**, porque é invisível e está medido: o laço parado fora da tela
(0 desenhos), e o chunk 20% menor pela troca do `<Canvas>` por `createRoot`.

**O que se perde:** num aparelho sem GPU — o que o Lighthouse usa — a cena volta
a ocupar a thread principal enquanto o Hero está na tela. É uma troca deliberada
e do dono: nota de laboratório vale menos que a primeira impressão de quem abre
o site.

### `[29/08]` O tamanho do chunk### `[29/08]` O tamanho do chunk — feito, e a explicação anterior estava errada

**A correção primeiro.** Esta seção afirmava que `@react-three/fiber` v9.7.0
executa `extend(THREE)` dentro do `<Canvas>`, arrastando o namespace inteiro do
`three`. Fui conferir na fonte que executa (§1.4) e **não é verdade nesta
versão**: `grep "extend(THREE)"` no pacote implantado não encontra nada, e o
fiber referencia ~22 símbolos específicos (`WebGLRenderer`, `Scene`,
`Raycaster`, `PerspectiveCamera`…), não o namespace.

Também testei a metade que dependia dessa explicação: trocar
`import * as THREE` por importações nomeadas nos nossos dois arquivos. O chunk
ficou **byte a byte idêntico** — o empacotador já resolvia isso sozinho.

**Onde estavam os 20%, então.** Pesando cada biblioteca sozinha (build de lib,
sem minificar):

| O que | Tamanho |
| --- | --- |
| só `three` (`WebGLRenderer` + `Scene` + `PerspectiveCamera`) | 604 kB |
| `@react-three/fiber` importando `Canvas` | 1.420 kB |
| `@react-three/fiber` importando só `createRoot` | **1.137 kB** |

A diferença é o **sistema de eventos de ponteiro** que o `<Canvas>` monta:
raycasting a cada movimento, mapeamento de eventos, medição de camadas. Esta
cena não tem **um único** manipulador de clique ou de ponteiro — é decoração
pura —, então era peso morto inteiro.

**O resultado, medido nos dois eixos:**

| | Antes | Depois |
| --- | --- | --- |
| chunk da cena | 888.149 B | **708.484 B** (−20,2%) |
| thread principal atribuível à cena (freio 4×) | 520 ms | **428 ms** (−18%) |

Os dois números andando juntos confirmam o que se esperava: o custo de carga é
proporcional a bytes, e aqui ele era o que sobrava depois da resolução
adaptativa ter zerado o custo do laço.

**O que NÃO mudou, e é o teto do que dá para fazer por este caminho:** o
`three` continua entrando praticamente inteiro — o chunk ainda contém áudio,
carregadores, `SkinnedMesh`, `PMREMGenerator`. Não é desleixo do empacotador: o
`WebGLRenderer` tem caminho de código para quase tudo isso, e é ele que a cena
precisa. Encolher além daqui exigiria trocar o `three` por WebGL cru, que é
outra conversa e de outro tamanho.

**O custo assumido na troca são DUAS capacidades**, e as duas falhariam em
silêncio. Ambas viraram teste em `e2e/cena-3d.mjs`, provadas nos dois sentidos:

| O que o `<Canvas>` fazia | Como está coberto | Sintoma se quebrar |
| --- | --- | --- |
| medir o contêiner e reconfigurar ao redimensionar | `ResizeObserver` + teste que encolhe a janela de 1440 para 1100px | a cena fica esticada ou cortada, sem erro |
| soltar o contexto WebGL ao desmontar | `root.unmount()` + teste com **20 desmontagens** | o navegador guarda um número limitado de contextos (~16 no Chromium): a cena **para de aparecer** para quem navegou um pouco pelo site |

O segundo é o mais traiçoeiro dos dois, e foi por isso que o laço do teste vai
**além** do teto do navegador: com 8 voltas nada aparece, e o vazamento só se
manifesta depois. Medido: 20 voltas, um canvas, contexto vivo, nenhum aviso de
"too many active WebGL contexts" — e, com o `unmount()` removido de propósito, o
aviso aparece e o teste reprova.

> **Se ele reprovar seu PR:** a saída lista cada chunk com tamanho e diz o
> suspeito mais provável. Se o crescimento for intencional, suba o teto **no
> próprio script** e explique no commit por que o site precisou engordar — o
> limite existe para forçar essa frase.
