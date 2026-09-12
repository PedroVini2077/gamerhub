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

## AS SETE ARTES — chegaram em 12/09

Ele mandou as sete de uma vez: *"cada uma delas representa uma parte do site,
uma é a hero, no caso a entrada, antes do feed e demais, e o outro é o cta"*.
Estão em [`referencias/cenas/`](referencias/cenas/), em WebP na resolução cheia.

| Arquivo | O que é | Como reconhecer |
| --- | --- | --- |
| `1-hero.webp` | a **entrada** | a marca no centro, telas flutuando em volta, um pódio ao fundo |
| `2-feed.webp` | o Feed | "Feed" aceso na barra lateral; posts, curtidas, tendências |
| `3-comunidade.webp` | Comunidade / mural | "Comunidade" aceso; gente, comentários, o campo "O que você está pensando?" |
| `4-keys.webp` | Keys & Promos | "Keys & Promos" aceso; capas de jogo, chaves, selos de desconto |
| `5-ranks.webp` | Ranks e XP | "Ranks" aceso; a torre de patentes, conquistas, a barra de XP |
| `6-lives.webp` | Lives | "Lives" aceso; o player grande, o chat, a lista de quem está no ar |
| `7-cta.webp` | o **fecho** | as pessoas caminhando em direção à luz e à marca |

**Peso:** 1672×940 cada, **2.032 kB as sete juntas** em WebP q0,92 — contra
**13,5 MB** em PNG, que é como elas chegaram.

### "Dá para usar no PC e no celular sem perder qualidade?" — a resposta MEDIDA

**Sim, mas por RECORTE, não por encolhimento.** A pergunta dele merecia mais do
que um "sim": eu renderizei uma das artes das duas maneiras, numa tela de 400 px.

| O que se faz | O que acontece |
| --- | --- |
| **encolher a arte inteira** para caber na largura do celular | vira 400×225. A interface desenhada dentro dela fica com o texto em 2–3 px: **ilegível**. Sobra uma miniatura bonita e muda |
| **recortar 1:2 no miolo** e usar a altura do celular | funciona **muito bem** — dá para ler "Melhor partida do dia! Que jogo insano", "Alguém pra jogar hoje? Tô no PC!", e a atmosfera sobrevive inteira |

**Por que a segunda funciona e a primeira não:** o problema nunca foi resolução,
foi **densidade de informação por pixel de tela**. No recorte, os mesmos pixels
da arte cobrem uma área menor da composição — então cada detalhe fica **maior**,
não menor. É o oposto de encolher.

**A consequência prática, e ela decide a implementação:** cada cena precisa de
**duas** versões — a 16:9 do computador e um recorte alto para o celular —, e o
recorte precisa ser **escolhido**, não centralizado por padrão. Em `2-feed` o
miolo é o feed; em `5-ranks` é a torre; em `7-cta` são as pessoas. Centralizar
tudo às cegas cortaria o assunto de metade delas.

**O peso deixa de ser problema**, e isto também é medido — a mesma arte, em WebP:

| largura | q0,82 | q0,72 |
| --- | --- | --- |
| 1600 px (monitor) | 121 kB | 90 kB |
| 828 px (celular 2×) | **45 kB** | 33 kB |
| 420 px (celular 1×) | 19 kB | 15 kB |

Sete cenas a 45 kB são **315 kB no celular**, e só a primeira precisa chegar
junto com a página — as outras entram conforme a pessoa rola.

### O que eu proponho, e a decisão é dele

**Não usar a `1-hero` no hero.** Ela é linda e é redundante: o hero de hoje já é
a marca no centro com trajetos convergindo nela, custa **3,2 kB**, e ele acabou
de chamar de *"FENOMENAL"*. Trocar isso por uma imagem de 230 kB seria pagar
70× mais por uma ideia que já está de pé — e perder o movimento, o ponteiro e o
reflexo, que uma imagem não faz.

**Onde ela serve melhor:** como cartão de compartilhamento (hoje o `og:image` é
só a marca num fundo), ou como a cena de uma seção "o que é o GamerHub".

**As outras seis entram**, e são exatamente o que mata o molde repetido: cinco
cenas para as cinco funcionalidades, e a sétima para o fecho.

---

## BLOCO 1 — A ABERTURA. `[11/09]` — DECIDIDA, pronta para implementar

> **Método, definido por ele:** *"vamos fazer em blocos? uma coisa por vez...
> idealizar, anotar e implementar"*, e *"quando tiver redondo partimos pro
> resto"*. Esta seção é o "redondo" do bloco 1. **Nada está construído.**

### O que ficou DECIDIDO

| | |
| --- | --- |
| **A frase** | **"Aqui o jogo continua."** — *"eu gostei da frase"* |
| **Como a marca aparece** | **pintada** — *"pensei dela aparecer como se fosse pintada"*. Não é o contorno se traçando (linguagem do raio): é o preenchimento surgindo, como tinta passando |
| **O brilho** | depois de pintada, ela **brilha como objeto polido** — *"ele se revelar, 'estoura' um brilho e aí sim abrir a landing"*. É reflexo NO objeto, não clarão na tela (ver [DECISOES.md](../DECISOES.md)) |
| **A ordem** | marca pintada → frase → brilho → landing |
| **A interação** | **não é clique.** *"queria algo nessa vibe"* da cachoeira de dados, que segue o ponteiro no PC |
| **Onde a marca fica** | no hero, depois da abertura, flutuando e respondendo ao ponteiro |

### A ideia central

**A abertura deixa de ser uma tela ANTES do site e passa a ser a marca
CHEGANDO.** Hoje são duas coisas coladas — um overlay que cobre tudo e some, e
um hero que começa do zero atrás dele. Um corte. A ideia dele junta as duas numa
tomada só, e a marca não sai de cena no fim: ela **assenta no hero e fica**.

**O ganho que não é estético:** hoje os trajetos do `ConvergenciaDoHub`
convergem para **espaço vazio** atrás do título. Com a marca morando lá, eles
passam a convergir **nela**.

### UMA LUZ, TRÊS PASSAGENS — o mecanismo que junta tudo o que ele pediu

A descoberta que fecha o bloco: **"pintada" e "brilho de objeto polido" são o
mesmo recurso técnico** — uma faixa de luz atravessando a marca por baixo de uma
máscara. Muda só a largura e a velocidade. Então a abertura inteira é **uma luz
só, passando três vezes**, e cada passagem tem uma função diferente:

| Passagem | Largura e ritmo | O que ela FAZ |
| --- | --- | --- |
| **1ª — pinta** | larga, lenta | a marca não existe; onde a luz passa, ela fica. É o "pintada" dele |
| **2ª — escreve** | a mesma luz, seguindo | passa por baixo da marca e deixa **"Aqui o jogo continua."** |
| **3ª — pole** | estreita, rápida | o reflexo de superfície polida. **No pico dela, a landing abre** |

**Por que isso é melhor do que três efeitos separados**, e é o teste que o
próprio briefing dele exige (*"por que isso está se movendo?"*): a resposta é
sempre a mesma — **"é a mesma luz, ainda andando"**. Três efeitos distintos
precisariam de três justificativas, e é assim que uma página vira demonstração
de animação.

**E resolve o problema de leitura da frase.** Ele tinha levantado *"rodando a
logo, ou deslizando"*; texto em órbita é difícil de ler, persegue o olho e fica
minúsculo no celular — exatamente o que o briefing dele proíbe. Com a luz, a
frase não "entra": ela é **revelada**, parada, no lugar onde vai ficar.

### O orçamento de tempo — proposta, para ele reagir com número

| | |
| --- | --- |
| pinta a marca | 0,55 s |
| respiro | 0,15 s |
| revela a frase | 0,35 s |
| leitura | 0,45 s |
| o brilho polido | 0,35 s |
| a landing abre | 0,30 s |
| **total** | **≈ 2,15 s** |

Hoje a abertura inteira dura **0,75 s**, então isto é quase o triplo. **O
argumento a favor mudou de natureza:** com a abertura virando o hero, esse tempo
deixa de ser "tela preta antes do site" e passa a ser a chegada — mas continua
sendo tempo em que ninguém clica em nada.

**Proposta:** completa na **primeira visita da sessão**; nas seguintes, a marca
já aparece posta no hero, sem overlay. O mecanismo de "já viu" já existe e está
provado — é o `sessionStorage` de `lib/boasVindas.js`.

### A restrição técnica que decide o desenho — conferida no código, não suposta

`AberturaDaMarca` é importada **estaticamente** no `App.jsx` (linha 33); a
`Landing` é **`lazy`** (`paginasLazy.js`). É deliberado: em 02/09 a intro morava
dentro do hero e o raio só existia depois de o chunk baixar — **1.320 ms a 6× de
CPU**, tela preta o tempo todo.

**Consequência:** enquanto a abertura toca, o hero pode não existir. A marca
**não pode voar até uma posição medida no hero** — medir exige o hero montado, e
esperar por ele traz de volta o defeito que a separação consertou.

**A saída, e é a mesma que resolveu o cruzamento das artes da arena:** uma
posição **combinada**, escrita nas mesmas unidades dos dois lados. A abertura
termina com a marca ali; o hero desenha a dele no mesmo ponto; a troca é um
cruzamento, não um voo. Sem medição, sem espera, e nada quebra se a landing
demorar.

> **Isso pede trava de contrato.** Dois lugares que precisam concordar para
> sempre divergem na primeira mudança — é a definição da Fase 4 da auditoria.

### A interação com o ponteiro — e o conserto que ela exige antes

Ele reparou certo: *"a cachoeira de dados no PC tem interação com o mouse, elas
seguem o mouse"*. É o `FluxoDeDados`, e o desenho dele é o barato: **um ouvinte,
uma variável CSS, coalescida por quadro**, deslocamento no compositor. Parado,
custa zero.

**Mas há um detalhe que impede reusar direto, e ele foi conferido:** a variável
`--desvio` é escrita em `alvo.style`, onde `alvo` é o **próprio contêiner** do
`FluxoDeDados` (linha 121). Só a subárvore dele enxerga. A marca vive no hero,
fora dessa árvore — então ela não tem acesso.

**As duas saídas, e a segunda é a errada:**

| | |
| --- | --- |
| **subir a variável** para um ancestral comum, e os dois lados lerem dela | **um** ouvinte serve os dois |
| dar um ouvinte próprio à marca | **dois** ouvintes de ponteiro na mesma página, e duas verdades sobre onde o ponteiro está (§4) |

**No celular não há ponteiro**, e o `FluxoDeDados` já trata isso da forma certa:
sem `(pointer: fine)` ele **nem registra** o ouvinte. A marca herda a mesma
regra — no toque ela fica parada, e isso não é defeito.

### O que ainda está em aberto neste bloco

1. **O tempo total** — 2,15 s é proposta minha; ele decide.
2. **A versão curta na segunda visita** — proposta minha; ele decide.
3. **A flutuação da marca no hero** (o vai-e-vem lento, independente do
   ponteiro): existe ou a marca fica parada e só responde ao ponteiro?
4. **`prefers-reduced-motion`**: quem pede menos movimento vê a marca já
   pintada e a frase, sem luz e sem flutuação. Precisa continuar liberando a
   landing — abertura que não termina é tela preta permanente (§1.5).

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
| `AberturaDaMarca.jsx` | 149 | a abertura; era `IntroLightning` e desenhava o raio |
| `LandingFooter.jsx` | 127 | rodapé |
| `Hero.jsx` | 125 | ato 1 |
| `Landing.jsx` | 109 | **a página inteira**, que ordena tudo |
| `ElectricTitle.jsx` | 91 | o nome com eletricidade |
| ~~`FeatureSection.jsx`~~ | 67 | era **o molde repetido 5×**, e a monotonia morava nele. **Apagado em 12/09**: as cinco seções viraram cenas com arte própria (`CenaDaLanding`) |
| `HighlightsStrip.jsx` | 54 | faixa de destaques |
| `FinalCTA.jsx` | 31 | o fecho |

**O que isto diz, e é melhor notícia do que o briefing supõe:**

1. **Nenhum arquivo está inchado.** O maior é 248 linhas, abaixo do limite de
   300 (§4). Não existe dívida estrutural bloqueando a reformulação — o que ele
   teme (*"Landing.jsx virar um monstro"*) ainda não aconteceu, e o trabalho é
   manter assim enquanto as cenas crescem.
2. **A monotonia era de UM arquivo.** `FeatureSection.jsx` tinha 67 linhas e era
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
| 2 | A abertura (`AberturaDaMarca`) | não | **feita** em 11/09 |
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
