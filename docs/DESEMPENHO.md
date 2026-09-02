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
