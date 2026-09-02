# Funcionalidades

> O que cada parte do site faz, do ponto de vista de quem usa. A **moderação**
> tem arquivo próprio ([MODERACAO.md](MODERACAO.md)) por ser o subsistema mais
> complexo do projeto.

## 👑 Hierarquia de cargos (roles)

Definida em `profiles.role` e ranqueada pela função SQL `role_rank()`:

| Role          | Rank | Pode…                                                                          |
| ------------- | ---- | ------------------------------------------------------------------------------ |
| `user`        | 1    | postar, comentar, curtir, mural, ver lives/chat, editar próprio perfil         |
| `admin`       | 2    | tudo de user + banir `user`, moderar chat de lives, gerenciar keys/promos, solicitar desbanimento e reativação de live, ver notificações/logs |
| `super_admin` | 3    | tudo de admin + banir/desbanir direto, aprovar/negar desbanimentos e reativações, desbloquear logins, banir `admin` |
| `owner`       | 4    | acesso total + painel do Dono: alterar roles, feature flags, banner, manutenção, métricas globais; imune a ban/alteração de role |

A hierarquia é **imposta no banco** (funções checam `role_rank(caller) >
role_rank(target)`), não apenas na UI. A mudança de cargo segue um **fluxo de
indicação/avaliação** (não troca instantânea): um admin/super admin indica,
outro avalia, o dono tem override de emergência para qualquer cargo.

O `owner` tem um rank especial de **Fundador** (laranja), exibido na página
`Ranks` fora da escala de XP normal.

---

## ✨ Funcionalidades

### Landing page institucional

`Landing.jsx` — página pública exibida para visitantes não autenticados (não
logados) ao acessar `/`. Decide-se em `HomeOrLanding` no `App.jsx` com base no
estado de autenticação.

**Cena 3D do Hero** (`Scene3D` + `scene3d/`):
- Canvas React Three Fiber carregado sob demanda (lazy) com `Suspense`. É o
  maior asset do site (~183 KB gzip, 708 KB descompactados) e é puramente
  decorativo, então `Scene3D` nem baixa o chunk quando não vai ser aproveitado.
  A decisão inteira mora em `lib/cena3D.js`, e os portões são:
  `prefers-reduced-motion`, `navigator.connection.saveData`, `deviceMemory ≤ 1`,
  `hardwareConcurrency ≤ 2` e largura de janela `< 1024px`. Todas as APIs são
  opcionais — quando uma não existe, ela não opina.
- **A escolha do visitante vence o portão.** `BotaoCena3D` deixa ativar ou
  desativar a cena, e a preferência fica no navegador (é de aparelho, não de
  pessoa).
- **`[28/08]` O laço de animação para quando a cena sai da tela.** Um
  `IntersectionObserver` desliga o `frameloop` do `<Canvas>`. Sem isso a cena
  continuava desenhando 60×/s para quem já tinha rolado para longe. Travado por
  `e2e/cena-3d.mjs`.
- **`[29/08]` O `<Canvas>` do fiber saiu; a cena é montada por `createRoot`.**
  Ele trazia junto o sistema de eventos de ponteiro (raycasting a cada
  movimento), e esta cena não tem um único manipulador de clique — é decoração.
  Vale −20% do chunk (888 → 708 kB) e −18% da thread principal atribuível a ela
  (520 → 428 ms, sob freio de CPU de 4×). Em troca, medir o contêiner ao
  redimensionar passou a ser nosso: é um `ResizeObserver`, com teste próprio.
- **`[29/08]` A resolução adaptativa foi DESFEITA.** Ela chegou a existir — a
  cena ajustava o `dpr` sozinha — e o dono reprovou em três rodadas, testando:
  *"começa muito pixelada"*, *"a luz verde não fica tão forte"*, *"o raio às
  vezes é cortado pela metade"*. O `dpr` e o `antialias` voltaram a ser os de
  antes. O que ficou de otimização é invisível: o laço parado fora da tela e o
  chunk 20% menor.
- **`[29/08]` (histórico) O que a medição mostrou, e o que se decidiu fazer com
  ela.** Com a cena visível, cada quadro custava ~92 ms e a thread principal
  ficava **99% ocupada** (8.066 ms de bloqueio numa janela de 8 s, medido em
  navegador de verdade). O custo de uma cena WebGL é por **pixel**.
  A correção que saiu disso — baixar a resolução — foi desfeita pelo dono, e o
  raciocínio inteiro está em [DESEMPENHO.md](DESEMPENHO.md). O custo em thread
  principal é uma troca aceita: enfeite bonito vale mais que nota de laboratório.

  > **Correção `[28/08]`:** este trecho listava "conexão 2g/3g" como portão. O
  > `effectiveType` foi **removido** no mesmo dia: era o único que mudava com o
  > tempo, então a mesma máquina trocava de modo entre visitas. Ver
  > [DECISOES.md](DECISOES.md).
- **`LogoBolt`**: raio 3D sólido extrudado (silhueta do ícone Zap da marca),
  cresce de escala 0→1 com `easeOutCubic` ao aparecer; acompanhado por um
  `pointLight` (`flashRef`) que estoura no nascimento (intensidade 14→0) e
  decai rápido — "primeiro a luz, depois a forma se revela". Roda
  continuamente no eixo Y, revelando a profundidade da extrusão; zumbido neon
  suave de `emissiveIntensity` sem flickering.
- **`FloatingShapes`**: formas geométricas 3D wireframe flutuantes nos quatro
  cantos — **gem** (dois icosaedros contra-rotativos, verde-neon), **ring**
  (toro, roxo), **diamond** (octaedro, laranja) e **dodeca** (dodecaedro,
  ciano). Todos com `wireframe: true` e `depthWrite: false` para ficarem
  visualmente atrás do raio. O `LogoBolt` usa `renderOrder={1}` para garantir
  que sempre renderize por cima, independente da posição Z. Cada forma
  materializa com overshoot (`easeOutBack`) em cascata temporal
  (`SHAPE_STAGGER = 0.16s`).
- **`Lightning`**: raios 3D animados cruzando a cena.

**Intro de abertura** (`IntroLightning`):
- Overlay `fixed inset-0 z-[60]` que cobre tudo no primeiro carregamento.
- SVG de raio principal + bifurcação desenhado via `pathLength` 0→1 (0.3s).
- Flash verde em tela inteira: radial gradient `opacity [0, 0.85, 0]` em 0.34s.
- Bola de clarão expandindo: `scale [0, 0.9, 2.4]` + `opacity [0, 1, 0]` em 0.72s.
- Overlay some (`opacity 0`) em 0.45s, chama `onComplete` — libera o conteúdo do Hero.
- Todo o conteúdo do Hero (eyebrow, título, subtítulo, CTA) fica em
  `animate={introDone ? 'animate' : 'initial'}` até a intro terminar.

**`ElectricTitle`** — título "GAMERHUB" com eletricidade:
- Aparece com blur+letterSpacing animados via variante `heroTitle`.
- **"HUB"** pisca com animação CSS `animate-electric-buzz` (neon mal aterrado).
- SVG com 5 arcos zigue-zague de cores/durações/atrasos variados (`ARCS`).
- Os arcos só entram no DOM depois que `onAnimationComplete` dispara (título
  terminou de se formar) — evita o flash de traços estáticos visíveis durante
  a animação de entrada. `animationFillMode: 'backwards'` garante que os arcos
  com delay fiquem em `opacity: 0` durante a espera (não aparecem todos de
  uma vez e somem um a um).

**`[29/08]` Link para quem está bloqueado.** Abaixo do CTA, um link discreto —
*"Conta bloqueada? Consulte seu caso"* — que leva ao login. Ele é **igual para
todos** e não identifica ninguém: quem está banido já consegue entrar e ver o
andamento do recurso na `BannedScreen`; o que faltava era saber que isso existe.
Identificar o visitante banido foi descartado por privacidade — ver
[DECISOES.md](DECISOES.md).

**Seções de features** (`FeatureSection`):
- Cada seção tem ícone, eyebrow, título, descrição e botão "Saiba mais" que
  abre/fecha painel animado com mais detalhes (`expandPanel`).
- Imagens reais do site (`LandingShot`) com usernames censados por privacidade.
- Seções cobertas: Feed, Mural, Lives, Keys & Promos, Ranks & XP.
- Animações de reveal ao entrar na viewport (`fadeUpReveal` + `VIEWPORT`).

**Outros componentes**: `HighlightsStrip` (stats/destaques), `FinalCTA`
(chamada pra ação final), `LandingNav` (navegação pública), `LandingFooter`.

**`lib/landingMotion.js`** — variantes Framer Motion exclusivas da landing:
`heroTitle`, `heroFade`, `fadeUpReveal`, `staggerContainer`, `expandPanel`.
Separadas de `lib/motion.js` (que é o restante do site) para manter a
assinatura visual mais "show" da primeira impressão sem contaminar as
transições discretas das páginas internas.

### Autenticação & contas

- **Cadastro** com e-mail/senha, `username`, data de nascimento (mínimo 13 anos
  — LGPD), estado (UF) e plataforma. Confirmação de e-mail via magic link
  (`AuthConfirm`).
- **Tela pós-cadastro persistente** (`RegisterSuccess`): substitui o toast
  temporário por uma tela dedicada que permanece enquanto o usuário não clica
  "Voltar para o login" — deixa claro que a confirmação de e-mail é obrigatória
  e avisa que pedir reenvio invalida o link anterior.
- **Email de confirmação** resistente a dark mode — template em Edge Function
  com cores explícitas (não herda tema escuro do cliente de email).
- **Login** com detecção de bloqueio por tentativas (ver
  [bloqueio de login](#bloqueio-de-login-por-tentativas)) e contagem regressiva
  ao vivo quando bloqueado.
- Botão **"Voltar para a página inicial"** na tela de login (leva para a
  Landing sem precisar de conta).
- **Recuperação de senha** por e-mail; indicador de força de senha.
- **Configurações** (`Settings`): trocar senha, trocar e-mail (com confirmação),
  preferências de notificação (likes/comentários) e **deletar a própria conta**
  (RPC `delete_own_account`, com dupla confirmação).
- Trigger `handle_new_user` cria automaticamente a linha em `profiles` ao
  registrar um usuário no `auth.users` — isso acontece **antes** de qualquer
  confirmação de e-mail (é assim que o Supabase Auth funciona; não dá pra
  verificar existência de e-mail de forma síncrona no cadastro).
- **Cadastros nunca confirmados** (e-mail inválido/inexistente/digitado
  errado): ficam visíveis pro admin em **Admin → Usuários** ("Cadastros
  pendentes de confirmação"), com opção de remover na hora
  (`admin_get_unconfirmed_users` / `admin_delete_unconfirmed_user`, admin+) —
  sem isso o admin via um "usuário" normal mesmo quando o e-mail nunca existiu.
  São removidos automaticamente depois de **7 dias** sem confirmar
  (`cleanup_unconfirmed_signups`, pg_cron `gamerhub-cleanup-unconfirmed`,
  4h30 UTC) — libera o username pra outra pessoa usar.

### Feed de posts

- Criação de posts (`PostForm`) com:
  - Título + conteúdo; categorias `dica` / `curiosidade` / `news`.
  - Até **10 mídias** por post: imagens (≤5MB) e vídeos (≤10MB — reduzido de
    100MB→25MB→10MB para poupar cota de egress; clipes longos via embed são
    recomendados). As imagens ainda são **comprimidas no browser** antes de
    subir (`lib/image.js`) — o limite de 5MB é do arquivo escolhido, não do que
    vai pro bucket.
  - **Áudio**: upload (≤20MB) ou **gravação pelo microfone** (`AudioRecorder`).
  - **Embeds**: YouTube, Twitch, TikTok (`EmbedPlayer` / `getEmbedInfo`).
    Suporta URLs de `youtube.com/live/` além dos formatos padrão.
  - Marcar embed como **live** (Twitch ou YouTube).
- Exibição (`PostCard`): carrossel de mídias (`MediaCarousel` + lightbox),
  player de áudio (`MediaPlayer`), embeds, likes e comentários.
  - O carrossel só monta quando o card chega **perto da viewport**
    (`LazyVisible`) e o **vídeo só baixa no clique** ("toque para carregar") —
    mídia de post que ninguém rolou até não gasta banda.
  - Curtidas, "eu curti", nº de comentários e a mídia vêm **prontos do feed**
    (busca em lote); o card só faz query própria quando recebe um post solto
    (painel admin/moderação).
- **Edição com janela de 30 minutos** (contador regressivo).
- **Retry de mídia** com backoff caso a mídia ainda não tenha subido.
- Feed (`Home`): busca por texto, filtro por categoria, aviso de "novos posts"
  em tempo real, limite de 30 posts.
- Posts com `live_kind` (lives de jogadores) são **excluídos do feed** — só
  aparecem na aba Lives.

### `[29/08]` Três defeitos da abertura da landing

**1. A landing 2D aparecia antes da 3D.** A `Scene2D` era o fallback enquanto o
chunk chegava — parecia gentileza e era defeito. O dono viu no PC da loja, onde
a espera é mais longa: *"não é pra aparecer em hipótese alguma"*.

São duas cenas com arranjos diferentes: trocar uma pela outra no meio do
carregamento não é "carregando", é a página mudando na frente de quem olha.
Agora o espaço fica **vazio** até a 3D chegar — o Hero tem título e botão por
cima, então o que se vê é o mesmo fundo escuro que fica atrás da cena depois.

Junto, o download passou a começar na montagem em vez de depois da espera pelo
ocioso: os dois eram serializados, e era isso que fazia o buraco durar segundos.
A espera pela CPU continua inteira — o que não precisava esperar era a rede.

**Conferido num navegador:** 42 amostras do DOM a cada 100 ms desde a montagem,
e a cena 2D não apareceu em nenhuma.

**2. A explosão do raio era pequena no monitor.** `vmax` é a maior dimensão da
tela: num celular em pé isso é a altura e o clarão saía enorme; num monitor
deitado é a largura, e a mesma conta dava um círculo pequeno. O clarão cresceu e
o miolo brilhante foi empurrado para fora — é o núcleo que lê como "explosão",
não o halo.

**3. A intro tocava toda vez.** *"Quando recarrego a página, vem a animação,
mudo de aba, de novo, saio do login, novamente."* Agora toca **uma vez por
sessão do navegador** (`sessionStorage`): sobrevive a recarregar, a navegar e a
voltar do login, e reaparece numa visita futura. `localStorage` mostraria a
abertura uma vez na vida.

Quem pediu `prefers-reduced-motion` não recebe a intro: ela é o movimento mais
agressivo do site — tela inteira, flash e clarão.

A decisão mora em `lib/introJaVista.js`, fora do componente, porque
`sessionStorage` **lança** em modo privado. Enterrado num `useState`, esse
`throw` derrubaria a landing inteira por causa de um enfeite. O padrão quando
não dá para lembrar é **mostrar** — errar exibindo é melhor do que sumir com a
abertura para todo mundo em janela anônima.

### `[29/08]` A landing como CAMADA 1 — navegação, rodapé e "Sobre"

A landing deixou de ser uma rolagem só. Ver `CLAUDE.md` §0.4 sobre a ordem por
camadas, que é o que colocou este trabalho na frente.

| O que | O que resolve |
| --- | --- |
| **Cards do topo levam às seções** | pedido do dono: *"imagina o site cresce, e o usuário ter que rolar uma tela grande"*. A faixa deixou de ser enfeite e virou o índice da página |
| **Navegação lateral** (gaveta) | abre pelo menu da barra fixa. Coluna fixa disputaria espaço com o Hero, e no celular não caberia |
| **Rodapé de verdade** | eram duas linhas que não levavam a lugar nenhum. Agora tem as seções, o projeto, o GitHub e a conta |
| **Página `/sobre`** | pública de propósito: dá para ler sobre o projeto **antes** de criar conta |

**A lista de seções é fonte única** (`components/landing/secoesDaLanding.js`).
Os três lugares que a usam — faixa, rodapé e gaveta — liam listas próprias
antes, e a do topo **já divergia**: citava "Lives ao vivo" e não mencionava
Keys, que é uma seção inteira do site. Ninguém notou porque a faixa não levava a
lugar nenhum; assim que virou navegação, isso seria link quebrado.

**Trava:** `components/landing/__tests__/secoesDaLanding.test.js` exige que toda
seção declarada tenha âncora na página, que toda âncora da página esteja na
lista, e que os três componentes importem a lista em vez de escrever a própria.
Âncora inexistente **não dá erro** no navegador — ele só não rola, e para quem
clica é indistinguível de site travado.

### `[29/08]` A página "Sobre" — sete blocos, escritos pelo dono

`/sobre` é pública de propósito: dá para ler o que o projeto é **antes** de
criar conta. Ela nasceu com três blocos em branco — a origem, quem está por
trás e para onde o site vai dependiam da história do dono, e inventá-los
produziria uma origem que não aconteceu. Ele respondeu em 29/08 e os sete
blocos estão preenchidos.

| Bloco | O que conta |
| --- | --- |
| O que é o GamerHub | comunidade gamer, não agregador de notícia |
| De onde o projeto nasceu | curiosidade — **não** um buraco nos lugares que ele já usava |
| Quem está por trás | Pedro, o curso, o interesse por back-end, e os jogos que ele joga |
| O que a gente espera de quem entra | o bloco em destaque, com o lema **"Respeito, risos e muito gaming."** |
| Como a comunidade é cuidada | a moderação por IA + fila humana, em linguagem de visitante |
| Este site foi construído com inteligência artificial | dito na cara, a pedido dele |
| Para onde o GamerHub vai | o que ele quer que o site seja |

**Como ela é enfeitada** `[29/08]`: cada bloco abre com um ícone num quadrado
na identidade do site, e os jogos que o dono citou viram **chips** com nome e
gênero em vez de mais um parágrafo. Sem capa de jogo — o motivo está em
[DECISOES.md](DECISOES.md), e vale a pena ler antes de propor imagem de novo.

O ícone vem de um mapa explícito (`components/sobre/iconesDoSobre.js`), não de
import dinâmico: import por nome traria o `lucide-react` inteiro para o pacote.
E o mapa não tem ícone padrão de propósito — bloco novo sem ícone **estoura no
teste** em vez de escolher um símbolo qualquer sozinho (§4, fallback
silencioso).

**O fundo que se mexe** `[29/08]`: doze peças atravessam a tela devagar atrás do
texto — triângulo, quadrado, losango, cruz, e os quatro botões de controle (X,
círculo, quadrado, triângulo), desenhados como geometria simples nas cores do
site. Antes eram seis, e o dono achou pouco e lento; a duração caiu de 34 s
para 19–35 s por peça.

**O salto que ele viu no celular** era a barra de endereço mudando a altura da janela e recalculando toda porcentagem de uma vez. Corrigido com `100lvh` na classe `.camada-de-fundo`. Os números que provaram a causa — e a parte que **não** foi possível verificar no desktop — estão em [DESEMPENHO.md](DESEMPENHO.md).

Antes disso, seis formas de contorno atravessavam a tela
devagar atrás do texto (`components/sobre/FundoAnimado.jsx`). O pedido do dono
era "formas flutuando e batendo aleatoriamente, tipo ping-pong em tempo real" —
e colisão de verdade **não foi feita de propósito**: ela exige um laço de
JavaScript por quadro, que é o mesmo custo que derrubou o desempenho da cena 3D,
e aqui seria pior porque numa página de leitura a pessoa fica parada minutos.

O que substitui a aleatoriedade é cada peça ter duração, atraso e trajetória
próprias, com durações que não são múltiplas entre si — os ciclos demoram
muito para coincidir, então o conjunto não se repete de forma perceptível.

**Custo:** medido em zero tarefa longa, com a CPU 4x mais lenta. A medição, o A/B e o que ela NÃO prova estão em [DESEMPENHO.md](DESEMPENHO.md) — é lá que mora o histórico de medição.

Some por completo para quem pediu menos movimento no sistema
(`motion-reduce:hidden`) — conferido no navegador: `display: none` e altura
zero. Movimento de fundo dispara enjoo em quem tem sensibilidade vestibular, e
isso não é detalhe decorativo.

**A fonte é `components/sobre/conteudoDoSobre.js`** — a página só renderiza a
lista. Bloco com `pendente: true` volta a aparecer como pendente na tela, com a
dica do que entra ali; o mecanismo continua de pé para quando um bloco novo
nascer sem texto.

**O bug que a página teve no primeiro dia, porque ele ensina uma classe.** Ela
foi ao ar com os sete blocos em `opacity: 0` **permanente** — o cabeçalho
aparecia e abaixo dele havia 4.000 px de nada. A causa não era da página: o
container que embrulhava os blocos usava `whileInView` com `viewport={{ amount:
0.25 }}`, e 25% de um container de 3.902 px são 975 px — **mais do que a janela
inteira de um celular** (830 px). O limiar era inatingível por construção, o
`whileInView` do pai nunca disparava, e os filhos ficavam escondidos para
sempre.

Nenhum teste pegou, e o motivo importa: o Vitest monta em jsdom, que não tem
`IntersectionObserver` de verdade nem layout; o `smoke.mjs` procura **texto**, e
`innerText` devolve normalmente o texto de um elemento invisível — ele marcou
"Sobre OK" com a página em branco. Hoje cada seção carrega o próprio
`whileInView`, e `e2e/conteudo-visivel.mjs` rola as páginas públicas numa janela
de celular e reprova se algo com tamanho real ficar invisível.

**A trava:** `conteudoDoSobre.test.js` falha se algum bloco ficar sem título ou
sem parágrafo, se dois ids colidirem, e — o que importa aqui — se o texto
deixar de mencionar as respostas específicas do dono (o lema, os jogos que ele
citou, o aviso de IA, o nome dele). Sem isso, uma reescrita de estilo apagaria a
história dele sem nada acusar. Provada removendo o lema: o teste apontou
`A página deixou de mencionar "respeito, risos e muito gaming"`.

### `[29/08]` Página de um post (`/post/:id`)

Um post sozinho, com o card inteiro — texto, imagem, vídeo, áudio e embed.

**Por que existe:** a fila de moderação ganhou um botão "ver no site", e não
havia para onde apontar. O feed é `/`, e um post antigo podia nem estar na
primeira página.

**Quem vê o quê:** conteúdo **oculto ou apagado** aparece para quem é da equipe
(`role_rank >= 2`), porque é justamente esse conteúdo que precisa ser julgado.
Para os demais, a página diz que o post não existe **ou** não está visível — as
duas causas juntas de propósito, já que separá-las entregaria a existência do
conteúdo oculto.

### `[29/08]` Página de uma mensagem do mural (`/mural/:id`)

Mesma ideia e mesmas regras da página de post, para o mural. Existe porque ele
era o único tipo da fila de moderação sem destino exato — o link caía na lista,
que é paginada, e uma mensagem antiga podia nem estar na primeira página.

### Comentários, likes e notificações

- **Comentários** (`CommentSection` / `CommentCard`): abrir/fechar, criar,
  deletar (autor ou admin), contagem, envio com Enter.
- **Respostas em thread** (replies): coluna `comments.parent_id` (self-FK com
  `ON DELETE CASCADE`). UI achatada em 1 nível (respostas de respostas viram
  irmãs sob o comentário raiz), com composer inline ao clicar "Responder".
- **Likes em comentários** (`comment_likes`): toggle por usuário, exibido com
  coração em `CommentCard`.
- **Likes em posts**: toggle por usuário (constraint única `post_id+user_id`).
- **Notificações ao usuário** (`notifications`):
  - Like num post → notifica o autor (se `notif_likes`).
  - Comentário num post → notifica o autor do post (se `notif_comments`).
  - Resposta a um comentário → notifica o autor do comentário pai.
  - Like num comentário → notifica o autor do comentário (se `notif_likes`).
  - Geradas por triggers `SECURITY DEFINER` (não pelo front diretamente).
  - Sino no `Header` mostra não-lidas e permite marcar todas como lidas.

### Mural da comunidade

- `Community` + `MuralForm` / `MuralCard`: mural de mensagens da galera.
- Suporte a **imagens** no mural (upload de foto).
- **Reações** com emojis (clique para reagir, contagem agrupada).
- Paginação: exibe 50 itens por vez.
- Modal de exclusão com confirmação; contador de mensagens no cabeçalho.
- Em tempo real (Supabase Realtime). Banidos não postam (RLS).

### Lives + chat em tempo real

A aba `Lives` exibe duas categorias de conteúdo lado a lado via **sub-tabs**:

**Sub-tabs:**
- **Da comunidade** — lives de posts comuns (sem `live_kind`).
- **Gameplays** — `live_kind = 'gameplay'`.
- **Reacts** — `live_kind = 'react'`.
- **Outros** — `live_kind = 'outro'` (com label livre definido pelo autor).

**Lives de jogadores** (`LiveGoModal`):
- Botão "Ficar ao vivo" na aba Lives abre um modal `createPortal`.
- O usuário informa: título, link da live (Twitch ou YouTube detectado
  automaticamente), e tipo (Gameplay / React / Outro).
- Para "Outro": campo de texto livre (`kindLabel`) é obrigatório — ex.:
  "Speedrun", "Ranqueada", "Just Chatting".
- Internamente cria um post com `is_live = true`, `live_kind` e
  `live_kind_label`. Reutiliza toda a infraestrutura existente de
  chat/moderação/presença/player.
- `LivesList` exibe badge de plataforma + badge de `live_kind`.

**Player e chat:**
- `Lives` lista posts com `is_live = true`; player `EmbedPlayer` embutido.
- **`EmbedPlayer` padronizado**: `VideoPlayer` compartilhado entre Twitch e
  YouTube — mesmo cabeçalho "AO VIVO", link para a plataforma, tratamento de
  `expires_at` (hook `useExpired`), tela "Live encerrada". Antes o YouTube não
  tinha esse tratamento, apenas a Twitch.
- **Chat ao vivo** (`live_chat`) em tempo real (Supabase Realtime).
- **Contagem de espectadores** via Supabase Presence.
- **Moderação**: silenciar usuários por tempo determinado
  (`live_chat_timeouts`, durações pré-definidas), encerrar a live, deletar
  mensagens (autor da mensagem, dono da live ou admin).
- **Encerramento automático** quando aplicável; trigger `set_live_ended_at`
  grava `live_ended_at`; `was_live` marca quem já transmitiu (usado no XP).
- **Reativação de live**: admin solicita → super admin aprova/nega
  (`live_reactivation_requests`).

### Keys & promoções

- `Keys` (público, via `feature_keys`): aba de **keys grátis** (com botão de
  copiar código) e aba de **promoções** (desconto %, link, validade).
- CRUD feito por admins no painel (`KeyEditor` / `KeyForm` em `Admin`),
  gravado em `game_keys`.

### Sistema de XP e Ranks

XP calculado **no servidor** pela RPC `get_user_xp` (fonte de verdade):

| Fonte                           | XP               |
| ------------------------------- | ---------------- |
| Por post                        | +20              |
| Por like recebido               | +5               |
| Por comentário feito            | +3               |
| Bônus por live (além do post)   | +30              |
| Bio preenchida                  | +50 (único)      |
| Avatar                          | +30 (único)      |
| Plataforma definida             | +15 (único)      |
| Conectar Discord/Twitch/YouTube | +15 cada (único) |

**7 tiers** (`src/lib/ranks.js`), cada um com 4 sub-ranks (I–IV), cor e ícone:
Recruta → Veterano → Guerreiro → Elite → Predador → Lenda → Deus. O `owner` tem
um rank especial de **Fundador** (laranja), fora da escala de XP — com card
visual exclusivo na página `Ranks`. A página `Ranks` mostra o rank atual,
progresso do sub-rank, breakdown de XP e a tabela de fontes. O rank também
aparece como **borda do avatar** e no `AvatarPopup`.

### Perfis

- **Perfil próprio** (`Profile`): edição de bio, nascimento, estado, plataforma,
  estilo de jogo, jogos favoritos e redes (Discord/Twitch/YouTube); **upload de
  avatar** com compressão para 400×400 JPEG; stats (posts, likes recebidos, XP)
  e visualização de rank/progresso.
- **Perfil público** (`UserProfile`, rota `/u/:username`): mesmos dados em modo
  leitura + posts do usuário (excluídas as lives de jogador); cálculo de idade a
  partir da data de nascimento.
- `AvatarPopup`: card flutuante com resumo do perfil ao clicar num avatar,
  incluindo atalho para banir (se o viewer tiver hierarquia para isso).

### Painéis da equipe, banimento, login e auditoria

Tudo o que **a equipe** opera — painéis de admin/super admin/dono,
banimento e desbanimento, bloqueio de login, configuração do site e a
trilha de auditoria — mudou para **[PAINEIS.md](PAINEIS.md)** em 28/08.

O corte é por público: aqui fica o que quem **usa** o site vê; lá, o que
quem **administra** opera.

---

[← voltar para o README](../README.md)

---

### `[01/09]` Para onde a página rola quando a rota muda

Dois bugs relatados pelo dono tinham a mesma raiz: **ninguém mandava a página
rolar**. Nenhum dos dois quebrava nada visível — a página abria, os links
existiam, o console ficava limpo. Eles só entregavam a pessoa no lugar errado.

| O que ele viu | A causa |
| --- | --- |
| abrir "Sobre" pelo rodapé caía no meio da página | navegação do React Router é troca de rota no cliente; o v6 **não reseta scroll**, e a posição antiga fica |
| links de seção do rodapé não faziam nada na "Sobre" | o rodapé aparece nas duas páginas, mas usava âncora **relativa** (`#feed`), que só existe na landing |

**Quem resolve:** `components/ui/RolagemDeRota.jsx`, montado uma vez no
`App.jsx`. Ele distingue três navegações, porque tratá-las igual quebra duas:

| Navegação | O certo | O que um `scrollTo(0,0)` cego faria |
| --- | --- | --- |
| link para outra página | ir para o topo | certo por acidente |
| link com âncora (`/#feed`) | rolar até a seção | **mataria a âncora** |
| voltar/avançar | restaurar onde a pessoa estava | **perderia o lugar** |

O `POP` é o caso mais esquecido: o navegador já guarda a posição de quem volta,
e sobrescrever isso é apagar trabalho dele.

O rodapé passou a usar `Link` com `{ pathname: '/', hash }` em vez de `href` —
funciona das duas páginas e não recarrega. `HighlightsStrip` e a navegação
lateral continuam com âncora simples: as duas só existem na landing.

**A trava:** `e2e/navegacao.mjs`, no CI. Confere os **três** casos, não um.
Provada removendo o `RolagemDeRota`: reprovou dizendo *"a /sobre abriu em
4420px, vinda de 4420px na landing"* e apontando o arquivo.

---

### `[01/09]` O raio sumia ao voltar para a tela — e não era só o raio

O dono relatou o raio ficando mudo depois de sair da viewport e voltar. A
investigação achou **cinco** ocorrências da mesma causa, e três delas faziam
coisas **sumirem** da tela.

**A causa, lida no fonte do `@react-three/fiber`** (`setFrameloop`), não deduzida:

```js
clock.stop(); clock.elapsedTime = 0;
if (frameloop !== 'never') { clock.start(); clock.elapsedTime = 0; }
```

**O relógio da cena zera a cada mudança de `frameloop`** — e ele muda toda vez
que a cena sai e volta para a viewport, porque é exatamente assim que o laço é
desligado fora da tela (otimização que fica).

| Onde | O que acontecia ao voltar |
| --- | --- |
| arcos do raio | agendavam `proximo = elapsedTime + intervalo`; com o relógio zerado ficavam mudos **pelo tempo que a pessoa tinha ficado olhando antes** |
| flash de trovão | idem |
| entrada das formas | `popP` voltava a 0 → escala 0 → **sumiam e refaziam a entrada** |
| entrada da logo | idem — **a logo encolhia até desaparecer** |
| oscilações (`useBob`, diamante) | o seno saltava de fase e os objetos davam um pulo |

**Nada estourava.** Medido: a cena seguia desenhando (185 draws antes, 185
depois de voltar). Só o conteúdo se comportava errado — falha silenciosa.

**A correção:** tempo acumulado a partir do `delta` de cada quadro. O `delta`
não sabe nada de relógio absoluto e não tem como ser zerado por baixo. Fica em
`lib/ritmoDoRaio.js` (agendamento) e no `useTempoAcumulado` do `SceneObjects`
(animação). O teto de 1 s por quadro protege do salto que o navegador entrega
quando a aba volta do segundo plano.

**A trava:** `ritmoDoRaio.test.js` varre `scene3d/` e reprova qualquer
`clock.elapsedTime` em código. Testar só o helper seria "teste que não consegue
falhar" — alguém reescreveria a cena com o relógio e o teste seguiria verde.
Provada reinjetando o bug na entrada da logo: reprovou apontando
`SceneObjects.jsx:82` e explicando as duas consequências.

---

### `[02/09]` A página `/privacidade` — política escrita do sistema, não de modelo

O dono deixou claro que isto é **requisito de lançamento**, não enfeite: *"não
quero lançar um site que literalmente quebra as leis reais"*.

**De onde veio o texto:** do levantamento em [PRIVACIDADE.md](PRIVACIDADE.md),
feito medindo a implementação — navegador aberto para ver cookie e
armazenamento, consultas ao banco para ver colunas, leitura do código para ver o
que sai para terceiros.

**Nada de modelo copiado.** Política copiada descreve um site que não é este, e
política que descreve errado é pior do que nenhuma: ela promete o que o sistema
não faz.

**O que a página diz, com tabela:** que não há cookie nenhum (e por isso não há
faixa de consentimento), o que fica guardado no navegador, que dado existe no
banco e se é obrigatório ou opcional, quem mais recebe alguma coisa, e como
exercer cada direito da LGPD — que aqui é botão, não formulário.

**Três blocos aparecem MARCADOS como pendentes**, e é escolha deliberada: idade
mínima, prazo de retenção e quem é o controlador dependem de decisão do dono.
Preencher de palpite seria prometer o que ninguém prometeu.

**A trava é diferente da de conteúdo comum.** Uma política **promete** coisas
sobre o sistema; se o sistema mudar e o texto ficar, a página passa a afirmar
algo falso e ninguém vê pela tela. A afirmação mais frágil é a dos cookies, então
`conteudoDaPrivacidade.test.js` varre `src/` atrás de escrita de cookie e
reprova. Provada criando um arquivo que escreve `document.cookie`: reprovou
dizendo que o texto virou promessa falsa.

O link está na navegação lateral **antes** do "Entrar", e no rodapé — a pessoa
consegue ler o que acontece com os dados dela **antes** de decidir criar conta.

---

### `[02/09]` A página `/regras` — a moderação ganhou onde se explicar

O site oculta conteúdo, suspende e bane desde antes desta página. Até agora
**não havia lugar nenhum dizendo qual regra foi quebrada**. Punição sem regra
escrita parece arbitrária mesmo quando é justa — e quem foi punido não tem como
corrigir o próprio comportamento se ninguém disse qual era o esperado.

**O conteúdo veio do que o sistema faz** ([MODERACAO.md](MODERACAO.md) e
[MODERACAO-IA.md](MODERACAO-IA.md)): o que a checagem automática bloqueia, o que
vai para fila humana, e como funciona o recurso. **Se uma regra está escrita lá,
existe mecanismo por trás dela** — não é lista de bom-tom inventada.

Pública de propósito: a futura tela de "fui banido" vai apontar para cá, e quem
foi punido precisa alcançá-la **sem estar logado**.

### `[02/09]` A casca compartilhada das páginas de texto

`components/conteudo/PaginaDeConteudo.jsx` nasceu quando a **segunda** página
com essa estrutura ia existir. O §4 manda extrair a partir de duas, e o motivo é
concreto: cópias divergem. Com três cascas iguais, a correção do `whileInView`
ou do scroll de âncora precisaria ser feita em três lugares — e uma ficaria para
trás sem ninguém notar.

`Privacidade.jsx` caiu de **132 para 24 linhas**. A `/sobre` **não** usa a
casca: ela tem lema, bloco em destaque e o mural de jogos, e forçá-la aqui
encheria o componente de opção que só uma página usa — a outra forma de errar a
abstração.
