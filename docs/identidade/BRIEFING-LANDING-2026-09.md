# A landing como EXPERIÊNCIA — o briefing do dono, `[11/09]`

> **Por que este arquivo existe, e por que é separado.** Ordem dele: *"vou te
> mandar um prompt... grava tudo e vamos implementar com o que temos por agora...
> vamos só estruturar antes de fazer"*. Conversa morre com a sessão.
>
> Ele está separado do [`BRIEFING-2026-09.md`](BRIEFING-2026-09.md) porque os
> dois decidem coisas diferentes: aquele é sobre a **marca** (o G, o GH, a
> palavra), este é sobre a **experiência de navegar a landing**. Juntá-los
> passaria de 150 linhas e misturaria dois assuntos num documento só (§6.2,
> regra 5).

---

## O que ele decidiu, e o que decide o trabalho

**O princípio, na letra dele:**

> *"A landing não deve apenas explicar o GamerHub. Ela deve fazer o visitante
> EXPERIENCIAR o GamerHub."*

**A reação que ele quer, em três tempos** — e isto é o critério de aceitação
real, mais do que qualquer lista técnica:

> *"Que porra é essa? Isso é o GamerHub?"* → *"Ah, entendi. É uma rede social
> gamer."* → *"Quero entrar nisso."*

**O diagnóstico dele do que está errado hoje**, e ele está certo: a landing é
`Hero → Feature → Feature → Feature → Feature → Feature → CTA`, e cada
`FeatureSection` repete `eyebrow → título → descrição → CTA → screenshot`.
Organizado, e por isso mesmo previsível e institucional.

**A nova hierarquia que ele pede:** `ARTE → PRODUTO → INFORMAÇÃO`. A arte cria
impacto, a interface real demonstra, o texto explica. Não é mais
`texto + screenshot` em toda parte.

**A jornada proposta** (ele mesmo diz que é referência, não obrigação):
`ENTER → DISCOVER → CONNECT → LIVE → DISCOVER → LEVEL UP → BELONG`.

## O que ele PROIBIU, e é metade do briefing

Vale mais do que a lista de efeitos, porque é o que impede a landing de virar
demonstração de animação:

> *"Não use scroll effects só porque são legais... Cada movimento precisa ter
> uma função. Pergunte para cada animação: por que isso está se movendo? Se a
> resposta for apenas 'para ficar bonito', provavelmente não precisa existir."*

Fora: partículas aleatórias, elementos girando sem propósito, cards flutuando,
excesso de blur e de glow, animação em tudo, parallax decorativo, GSAP
indiscriminado, e *"uma página parecendo um experimento de animação"*.

Estética fora: gamer clichê, RGB, controle gigante, teclado, headset, personagem
genérico, cyberpunk genérico, HUD militar, dashboard SaaS, "site de IA",
glassmorphism e partículas em excesso.

**Ritmo, e não sequência de efeitos:**
`IMPACTO → RESPIRO → INFORMAÇÃO → MOVIMENTO → IMPACTO → TRANSIÇÃO → RESPIRO`.
*"Algumas partes podem ser extremamente animadas. Outras podem ser quase
estáticas. Esse contraste é importante."*

## A paleta, que ele fixou

| | |
| --- | --- |
| `#39FF14` | verde elétrico — **continua sendo a principal** |
| `#00FFFF` | ciano — profundidade |
| `#BF00FF` | roxo — profundidade |
| `#FFA33A` | âmbar — *"extremamente restrito"* |
| `#060608` | fundo |

*"Não invente uma nova identidade cromática. Não use rainbow. Também não
transforme tudo em neon."*

## O que ele exigiu que NÃO se perca

- **A UI tem que ser real.** *"A arte pode ser conceitual. O produto precisa
  continuar sendo real."* Nada de inventar interface, nem falsificar
  funcionalidade, nem trocar conteúdo real por placeholder sem necessidade.
- **Mobile desde o começo**, não *"desktop primeiro e depois escondemos as
  animações"*.
- **`prefers-reduced-motion`** e legibilidade preservados: a landing continua
  funcional sem animação nenhuma.
- **Não repetir o peso da cena 3D.** *"A nova landing precisa ser visualmente
  ambiciosa sem depender de 3D pesado."* Prioridade: SVG + CSS + imagens +
  composição + UI real.
- **Nada de `Landing.jsx` virar um monstro.**

---

## PENDENTE — as referências visuais ainda não existem

**Ele disse, com todas as letras:** *"provavelmente ele vai falar que eu vou te
mandar imagens de referência, eu não tenho elas agora eu vou ter que gerar,
deixa isso pendente"*.

Isto está escrito aqui porque o prompt inteiro se apoia nelas — *"use-as como
referência para composição, escala, profundidade, posicionamento da UI,
narrativa, atmosfera, transições, hierarquia visual e comportamento durante o
scroll"*. **Toda decisão de direção de arte fica em aberto até elas chegarem.**

**O que NÃO depende delas, e por isso pode andar agora:** a arquitetura de
cenas, o mecanismo de scroll, o orçamento de desempenho, o comportamento no
celular e a estrutura de componentes. É exatamente por onde a fila abaixo
começa.

Quando chegarem, elas vão para `referencias/` e são citadas neste arquivo.

---

## BLOCO 1 — A ABERTURA. `[11/09]`, em idealização

> **Ordem de método, dele:** *"vamos fazer em blocos? uma coisa por vez, primeiro
> a animação de entrada... nesse momento não vamos implementar, vamos idealizar,
> anotar e implementar"*. Nada abaixo está construído.

### O que ele já decidiu

| | |
| --- | --- |
| tela escura, **sem clarão** | *"sobre o estouro, quero descartar isso"* — ver [DECISOES.md](../DECISOES.md) |
| a marca tem **animação de entrada** | *"não sei se ela é desenhada, estruturada"* — a forma está em aberto |
| a frase vem **depois** da marca | *"aí depois vem a msg"* |
| a frase é **curta** | e ele pediu ideias, listadas abaixo |
| a abertura **vira** a landing | *"a tela ir aparecendo aos poucos e a logo ir para o centro da landing, assim como o antigo raio... uma transição suave"* |
| a marca **fica** na landing | *"queria que a logo ficasse ali flutuando e tendo interações com o cenário ou com o mouse ou clique do usuário"* |

### A ideia central que sai disso

**A abertura deixa de ser uma tela ANTES do site e passa a ser a marca
CHEGANDO.** Hoje são duas coisas coladas: um overlay que cobre tudo e some, e
um hero que começa do zero atrás dele. Um corte. A ideia dele junta as duas numa
tomada só — a marca se monta no escuro, a frase aparece, a landing materializa
por trás, e a marca **assenta no hero e continua lá**, flutuando e reagindo.

**O ganho não é só estético, e é o argumento mais forte a favor:** hoje os
trajetos do `ConvergenciaDoHub` convergem para **espaço vazio** atrás do título.
Com a marca morando no hero, eles passam a convergir **nela**. A metáfora do
nome (Hub = ponto de encontro), o fundo e a marca passam a dizer a mesma coisa,
em vez de três coisas parecidas.

### As frases — ideias pedidas por ele

Curtas, e nenhuma descreve funcionalidade: a explicação é trabalho do hero, que
vem dois segundos depois. O trabalho da abertura é **prometer**.

| Frase | O que ela faz |
| --- | --- |
| **"O ponto onde tudo se encontra."** | diz literalmente o que a animação mostra. Frase e desenho contam a mesma história em duas linguagens — é a mais coesa das três |
| **"Aqui o jogo continua."** | diz para que o produto serve: a vida de jogador entre as partidas — feed, mural, live, chat. Curta e calorosa |
| **"Sua base de operações."** | é a voz que o site já tem — mas é **a sobrancelha do hero**, e repeti-la dois segundos antes vira eco |

**Recomendação:** a primeira, com a segunda como alternativa. A terceira só se a
sobrancelha do hero mudar junto, senão o visitante lê a mesma frase duas vezes
em três segundos.

### Como a frase entra — e por que eu discordo das duas opções dele

Ele levantou duas: *"rodando a logo, ou deslizando"*.

**Texto girando em volta da marca é o efeito que o briefing dele proíbe.** Ele
mesmo escreveu: *"por que isso está se movendo? Se a resposta for apenas 'para
ficar bonito', provavelmente não precisa existir"*. Texto em órbita é difícil de
ler, obriga o olho a perseguir, e a resposta para "por que gira?" é só "fica
legal". Ele também custa: texto em caminho curvo no celular fica minúsculo.

**Deslizar por baixo funciona** e é honesto — lê como legenda da marca.

**A terceira, que eu proponho:** a mesma luz que acende a marca **continua** e
revela a frase ao passar por ela. Um gesto, dois resultados, e a resposta para
"por que isso se move?" é *"é a mesma luz, ainda andando"*. É mais barato do que
parece: uma varredura em máscara, sem laço por quadro.

### O que "montar" pode ser — três leituras, e uma delas é nova

Ele disse não saber, então a decisão fica aqui escrita com o custo de cada uma.

| Leitura | Como seria | Observação |
| --- | --- | --- |
| **desenhada** | o contorno se traça e depois preenche | é o que já acontece hoje. Funciona, mas é a linguagem do RAIO — traço de relâmpago |
| **estruturada** | as faces do hexágono entrando em ordem | **a marca é UM caminho fechado de 39 vértices com `evenodd`** — ela não tem peças. Fazer isso exige recortar o desenho em partes, o que cria um segundo desenho que vai divergir do primeiro (§4) |
| **convergida** | fragmentos chegam de fora e, onde se encontram, a marca aparece | usa a linguagem que a landing **já** escolheu, não exige cortar o caminho (é máscara, não geometria), e emenda direto no fundo do hero |

**Recomendação: a terceira.** Ela responde "montada aos poucos" sem inventar uma
segunda linguagem visual, e é a única que faz a abertura e o hero serem a mesma
ideia em vez de duas parecidas.

### A restrição técnica que decide o desenho — conferida, não suposta

`IntroLightning` é importado **estaticamente** no `App.jsx` (linha 33), e a
`Landing` é **`lazy`** (`paginasLazy.js`). Isso é deliberado e está documentado:
em 02/09 a intro morava dentro do hero, e o raio só existia depois de o chunk da
landing baixar — **1.320 ms a 6× de CPU**, tela preta o tempo todo.

**Consequência para esta ideia:** enquanto a abertura toca, o hero pode ainda
não existir. Então a marca **não pode voar até uma posição medida no hero** —
medir exige o hero montado, e esperar por ele traz de volta exatamente o defeito
que a separação consertou.

**A saída é a mesma que resolveu o cruzamento das artes da arena:** uma posição
**combinada**, escrita nas mesmas unidades dos dois lados. A abertura termina
com a marca naquele ponto; o hero desenha a dele no mesmo ponto; a troca é um
cruzamento, não um voo. Sem medição, sem espera, e nada quebra se a landing
demorar.

> Isso pede uma trava do tipo "contrato": um teste que falhe se os dois lados
> deixarem de concordar sobre a posição. Deriva entre dois lugares que precisam
> combinar é exatamente o que a Fase 4 da auditoria existe para pegar.

### A marca flutuando e reagindo — o que precisa de cuidado

Pedido dele: *"interações com o cenário ou com o mouse ou clique do usuário"*.

**O risco não é a ideia, é o custo.** Já existe o desenho certo no projeto:
`FluxoDeDados` reage ao ponteiro com **um ouvinte, uma variável CSS, coalescida
por quadro**, e o deslocamento acontece no compositor. Parado, custa zero. Uma
marca que reage precisa seguir o mesmo padrão — não um laço por quadro, que foi
o que encareceu a cena 3D (5.877 ms de thread em 6 s de página parada).

**E "clique" merece uma pergunta de produto antes de existir:** o que acontece
ao clicar? Se não houver resposta, é um alvo que não faz nada — pior do que não
ser clicável. Hipóteses: rola para a próxima cena, ou aciona o mesmo pulso que
os trajetos usam. Fica em aberto.

### O que continua em aberto neste bloco

1. **Qual frase** — três propostas acima, com recomendação.
2. **Como a frase entra** — deslizar, ou a varredura que eu proponho.
3. **Qual leitura de "montar"** — três acima, com recomendação.
4. **Duração**, e se a segunda visita da sessão ganha versão curta. Com a
   abertura virando o hero, o tempo deixa de ser "tela preta perdida" e passa a
   ser parte da chegada — o que **enfraquece** o argumento de encurtar, mas não
   o elimina.
5. **O que o clique faz**, se houver clique.
6. **`prefers-reduced-motion`**: quem pede menos movimento vê a marca já posta e
   a frase, sem varredura e sem flutuação.

---

## A ANÁLISE — o que existe hoje, medido

Primeira etapa que ele pediu (*"analise o projeto atual"*), com número em vez de
impressão. Medido em 11/09:

| Componente | Linhas | O que é hoje |
| --- | --- | --- |
| `FluxoDeDados.jsx` | 248 | traços verticais subindo, página inteira, parallax de ponteiro e rolagem |
| `ConvergenciaDoHub.jsx` | 187 | **novo hoje** — o fundo do hero, trajetos convergindo |
| `BotaoDeSom.jsx` | 181 | som ambiente |
| `LandingSidebar.jsx` | 165 | navegação lateral |
| `IntroLightning.jsx` | 149 | a abertura; hoje desenha a marca |
| `LandingFooter.jsx` | 127 | rodapé |
| `Hero.jsx` | 125 | ato 1 |
| `Landing.jsx` | 109 | **a página inteira**, que ordena tudo |
| `ElectricTitle.jsx` | 91 | o nome com eletricidade |
| `FeatureSection.jsx` | 67 | **o molde repetido 5×** — é aqui que mora a monotonia |
| `HighlightsStrip.jsx` | 54 | faixa de destaques |
| `FinalCTA.jsx` | 31 | o fecho |

**O que isto diz, e é melhor notícia do que o briefing supõe:**

1. **Nenhum arquivo está inchado.** O maior é 248 linhas, abaixo do limite de
   300 (§4). Não existe dívida estrutural bloqueando a reformulação — o que ele
   teme (*"Landing.jsx virar um monstro"*) ainda não aconteceu, e o trabalho é
   manter assim enquanto as cenas crescem.
2. **A monotonia é de UM arquivo.** `FeatureSection.jsx` tem 67 linhas e é
   instanciado 5× com props diferentes. Trocar o molde não exige reescrever a
   página: exige **deixar de ter um molde único**.
3. **O sistema de animação já é `framer-motion`**, usado em 6 componentes. Ele
   já faz `useScroll`/`useTransform` — scroll-driven não precisa de biblioteca
   nova. **GSAP/ScrollTrigger só entra se algo não couber**, e hoje nada indica
   que não caiba (§0.3, regra 1: perguntar o custo descompactado antes).
4. **Já existe uma camada de fundo de página inteira** (`FluxoDeDados`), com
   parallax medido e barato. Cena fixa com conteúdo mudando por cima é o mesmo
   mecanismo, um nível acima.
5. **O orçamento de bytes tem pouca folga:** 735,7 kB / 223,1 kB gzip contra o
   teto de 760 / 228. **~24 kB brutos de sobra.** Qualquer cena nova cara entra
   por rota lazy ou não entra.

---

## A DIREÇÃO PROPOSTA — o que eu faria, e por quê

Isto é proposta, não decisão tomada: o §7 manda apresentar e esperar antes de
mexer em estrutura.

### A ideia central

**A landing é a travessia de fora para dentro do Hub.** Ela já tem esse eixo
desde hoje — a convergência do hero desenha trajetos pousando num ponto. A
reformulação estende a mesma metáfora ao resto: o visitante entra pela borda e
vai chegando ao centro, e cada cena é uma coisa que o Hub reúne.

Isso resolve a exigência mais difícil do briefing — *"coerência: todas as cenas
precisam pertencer ao mesmo universo"* — sem inventar uma linguagem nova: ela
nasce do **nome do produto**, e já está desenhada na primeira tela.

### A fila, e o critério de ordem

A ordem é a das camadas (§0.4) cruzada com o risco: começar pelo que todo mundo
vê e pelo que **não depende das referências**.

| # | Cena | Depende das imagens? | Estado |
| --- | --- | --- | --- |
| 1 | Hero — a convergência | não | **feita** em 11/09 |
| 2 | A abertura (`IntroLightning`) | não | a fazer |
| 3 | **O mecanismo de cena presa** (sticky + progresso), sem arte nova | não | a fazer — é a fundação das outras |
| 4 | Comunidade: *"tem gente aqui"* | parcialmente | espera 3 |
| 5 | Feed vivo | parcialmente | espera 3 |
| 6 | Lives — a cena mais cinematográfica | **sim** | espera as imagens |
| 7 | Keys & Promos — descoberta | **sim** | espera as imagens |
| 8 | XP/ranks — o scroll como progressão | não | espera 3 |
| 9 | O fecho, na porta do login | não | espera as anteriores |

**Por que a 3 vem antes das cenas:** cena presa é um mecanismo, não um enfeite —
altura reservada, progresso do scroll, o que acontece no celular, o que acontece
com `prefers-reduced-motion`. Construir isso uma vez, com teste, e reusar em
todas as cenas é o oposto de escrever cinco animações parecidas que divergem
(§4, fonte única). Fazer a cena das Lives primeiro e extrair o mecanismo depois
é o caminho que produz duplicação.

### Desempenho — as três regras que eu me imponho aqui

1. **Orçamento primeiro.** Restam ~24 kB brutos. Cena que não couber vai para
   chunk de rota, e o portão por arquivo (320 kB) continua valendo sem exceção
   nominal — a que existia foi removida com a cena 3D.
2. **Nada de laço por quadro.** O `FluxoDeDados` já prova o desenho certo: um
   ouvinte, uma variável CSS, coalescida por `requestAnimationFrame`,
   deslocamento no compositor. Cena presa segue o mesmo padrão.
3. **Medir antes e depois, na mesma ferramenta** (§0.3, regra 5). E o número que
   importa para travamento é o **descompactado**, não o gzip.

### Celular — a pergunta que decide cada cena

Não *"como escondo a animação"*, e sim: **o pin faz sentido nesta tela?** Numa
janela de 844 px de altura, prender uma cena por 300vh de rolagem é muito mais
tempo parado do que num monitor. A resposta provável não é a mesma para todas as
cenas, e cada uma responde a sua — versão simplificada é aceitável, experiência
destruída não é.

### Os riscos, ditos antes de começar

| Risco | Por que é real aqui |
| --- | --- |
| **Cena presa quebra a rolagem** | `position: sticky` dentro de contêiner com `overflow` ou `transform` simplesmente não gruda. A landing já tem `overflow-x-clip` no hero |
| **Altura reservada errada** | pin exige reservar espaço; errar deixa buraco ou corta a cena. É o tipo de defeito que só aparece em uma altura de tela |
| **Conteúdo que só existe animado** | se a cena carrega a informação e a animação não roda, a informação some — §1.5, e reprova no `conteudo-visivel.mjs` |
| **O orçamento estourar no fim** | com 24 kB de folga, a última cena paga a conta das anteriores. Medir por cena, não no fim |
| **Virar experimento de animação** | é o risco que o próprio dono nomeou, e o único que nenhum portão pega |

---

## O que continua em aberto, e é decisão dele

1. **As imagens de referência** — bloqueiam as cenas 6 e 7.
2. **Quanto da jornada dele manter.** `ENTER → DISCOVER → CONNECT → LIVE →
   DISCOVER → LEVEL UP → BELONG` tem sete tempos; a proposta acima tem nove
   cenas. Elas não são a mesma lista, e reduzir é provavelmente melhor do que
   somar.
3. **Se o rodapé, a sidebar e a faixa de destaques sobrevivem** à reformulação
   ou entram na narrativa.
