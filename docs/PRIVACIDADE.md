# Privacidade e LGPD — o que o GamerHub coleta, de verdade

> **O que é isto.** O mapa dos dados pessoais que o site coleta, medido na
> implementação real em 01/09/2026 — não em suposição sobre o que "um site como
> esse normalmente faz". Cada linha aqui foi verificada no código, no banco ou
> num navegador.
>
> **O que NÃO é.** Uma política de privacidade pronta para publicar, nem
> parecer jurídico. É o levantamento técnico que uma política precisaria ter
> como base.
>
> **A regra que guiou o levantamento**, pedida pelo dono: não inventar coleta,
> não inventar obrigação legal, e separar **obrigação** de **boa prática**. O
> que não deu para determinar pelo código está escrito como **A DEFINIR** — não
> preenchido de palpite.

---

## A resposta curta sobre cookies: o site não usa nenhum

Medido num navegador real, visitante na landing, sessão limpa:

```
COOKIES:          NENHUM
localStorage:     vazio
sessionStorage:   ["gh_intro_vista"]
terceiros:        fonts.googleapis.com    <- 01/09; SAIU em 03/09
```

> **A linha dos terceiros é de 01/09 e já não vale**: o Google Fonts foi
> removido no mesmo dia 03/09 (ver o achado resolvido mais abaixo), e hoje a
> landing **não contacta terceiro nenhum**. A medição fica como retrato porque
> é dela que sai a afirmação sobre cookies — que continua verdadeira.

**Não existe banner de cookies a fazer**, porque não existem cookies. O
Supabase guarda a sessão em `localStorage`, não em cookie; a Vercel Analytics é
cookieless por construção.

Criar banner "porque todo site tem" seria pedir consentimento para algo que não
acontece — ruído sem função, e ruído ensina a ignorar avisos que importam.

---

## Como esta página não envelhece — a trava de crescimento

> Pedido do dono em 01/09: *"o site vai crescer mais, então a gente precisa que
> essa aba de políticas esteja sempre atualizada, sempre mesmo"*.

Promessa não sustenta isso: a política de ontem descreve o site de ontem. Duas
listas em `conteudoDaPrivacidade.js` são a versão **conferível** do que a página
afirma, e o teste as cruza com o código:

| Trava | Reprova quando |
| --- | --- |
| `CHAVES_DECLARADAS` | o código grava uma chave nova no navegador que a política não menciona |
| `TERCEIROS_DECLARADOS` | entra uma dependência que manda dado para fora sem a política dizer |
| varredura de `document.cookie` | alguém passa a usar cookie, e a página afirma que não há nenhum |

**Provadas por injeção:** uma chave `gh_rastreador_novo`, uma dependência
`posthog-js` e um `document.cookie =` — as três reprovaram nomeando o problema e
o que fazer antes de seguir.

O critério de "terceiro" é **manda alguma coisa para servidor de outra empresa**,
não "é biblioteca externa": o que anima ou formata não entra; o que faz uma
pessoa aparecer no registro de outra empresa, sim.

### `[02/09]` A quarta trava: o texto não pode mudar por baixo de quem já aceitou

As três travas acima vigiam se a política **conta a verdade sobre o código**.
Nenhuma vigiava se o **registro de aceite** continua verdadeiro — e foi por aí
que passou o defeito.

**O que aconteceu, com hora.** O dono aceitou os três documentos às **19:58:52
UTC de 02/09**, a política na versão `2026-09-02`. Horas depois, no PR #140, o
bloco *"por quanto tempo guardamos seu dado"* foi reescrito de *"falta definir"*
para uma tabela com seis prazos — e **a versão não se moveu**. O registro passou
a afirmar que ele concordou com um texto que nunca leu, que é exatamente o que
versionar o aceite existe para impedir.

A regra *"suba a versão quando o conteúdo mudar"* já estava escrita em
`documentosLegais.js`. Ela falhou porque **nada percebia que o texto tinha
mudado** — responder a isso com mais uma frase seria repetir o que não
funcionou (§2: comentário é a mais fraca das cinco travas).

| O que entrou | O que faz |
| --- | --- |
| `impressao` em `DOCUMENTOS` | o sha256 do arquivo de conteúdo de cada documento |
| teste em `documentosLegais.test.js` | reprova quando o arquivo muda e a impressão não acompanha |
| `CHECK` do banco widened para `^\d{4}-\d{2}-\d{2}(-\d+)?$` | deixa a **segunda revisão do mesmo dia** ser dita; antes era inexprimível |

**Ela cobra decisão, não versão nova.** Exigir reaceite a cada vírgula treinaria
todo mundo a clicar sem ler — o dano oposto e igualmente real. Ao falhar, o
teste apresenta as duas saídas: mudança relevante sobe `versao` **e**
`impressao`; mudança cosmética sobe **só** a `impressao`.

**Consequência já em produção:** a política está em `2026-09-02-2`, e o aviso
não bloqueante de reaceite aparece para quem aceitou a versão anterior — hoje,
uma pessoa.

---

## O mapa dos dados

### O que fica no NAVEGADOR de quem usa

| Chave | O que é | Por quê | Quando some |
| --- | --- | --- | --- |
| `sb-*-auth-token` (localStorage) | token de sessão do Supabase | é o que mantém a pessoa logada | logout, ou expiração do token |
| `gh_intro_vista` (sessionStorage) | "já vi a abertura" | não repetir a intro a cada recarregamento | ao fechar o navegador |
| `gh_landing_3d` (localStorage) | preferência de cena 3D ligada/desligada | respeitar a escolha explícita da pessoa | só se ela limpar o navegador |
| `gh_pause_reason` (localStorage) | motivo da pausa do site | mostrar a explicação certa | ao voltar do ar |
| `gh_chunk_reload_at` (sessionStorage) | instante do último recarregamento automático | evitar laço de recarregamento | ao fechar o navegador |

Nenhuma delas identifica a pessoa, exceto o token de sessão — que é o que
autentica, e por isso existe.

### O que fica no BANCO

| Dado | Onde | Por quê | Necessário? | Risco |
| --- | --- | --- | --- | --- |
| e-mail | `auth.users` (Supabase Auth) | login e recuperação de senha | **sim** | alto se vazar — por isso não está em `profiles` e o anônimo leva 401 |
| senha | `auth.users`, como hash | idem | **sim** | o site nunca vê a senha em claro |
| `username`, `avatar_url`, `bio` | `profiles` | identidade pública na comunidade | sim | público por escolha de quem escreve |
| `birth_date` | `profiles` | calcular a idade | sim, com ressalva abaixo | **a data em si não é exposta** — o perfil público mostra só a idade |
| `state`, `platform`, `favorite_games`, `playstyle` | `profiles` | perfil gamer | **opcional** | preenchimento livre |
| `discord`, `twitch`, `youtube` | `profiles` | links de quem quiser | **opcional** | a pessoa decide expor |
| `banned`, `ban_reason`, `banned_by`, `suspended_until` | `profiles` | moderação e trilha de auditoria | sim | colunas revogadas do papel `authenticated` |
| e-mail + tentativas | `login_attempts` | barrar força bruta | sim | ver retenção abaixo |
| ações de moderação | `admin_logs` | trilha de auditoria | sim | ver retenção abaixo |

### Quem mais recebe alguma coisa

| Terceiro | O que recebe | Verificado |
| --- | --- | --- |
| **Supabase** | tudo acima; é o banco e o autenticador | — |
| **Vercel** | hospeda; recebe IP e user-agent nos logs de acesso, como todo servidor | inerente a estar no ar |
| **Vercel Analytics / Speed Insights** | métrica de página, **sem cookie** | montados no `App.jsx` |
| **Sentry** | erro + `{ id, username }` | lido em `monitoring.js`: **não manda e-mail** |
| **Cloudflare Turnstile** `[03/09]` | o IP e sinais do navegador de quem abre a **/contato** — e só ela | medido por `e2e/terceiro-no-contato.mjs`, que reprova se aparecer terceiro fora da lista ou qualquer cookie |
| ~~**Google Fonts**~~ | ~~o IP de quem visita, ao baixar a fonte~~ | **saiu em 03/09** — as fontes vêm do próprio site |

> **`[03/09]` A linha do Google Fonts estava errada quando eu a reli**: ela
> descrevia o serviço como ativo, e ele tinha sido removido no mesmo dia, em
> outra seção deste arquivo. Ficou riscada em vez de apagada — a tabela é onde
> alguém procura "quem recebe o que", e um serviço que saiu é informação útil.
>
> **Por que nenhum portão pegou:** os três olham nome de arquivo e número. Uma
> tabela em português afirmando que um serviço existe não é nada disso. Foi o
> mesmo tipo de falha do `effectiveType` em 28/08.

---

## Os achados, com severidade

### ✅ `[03/09]` RESOLVIDO — a idade mínima de 13 anos passou a ser imposta

> **Achado original (01/09):** o limite existia só no atributo `max` do input.
> O site usa a `anon key`, então qualquer um chamava a REST API direto com a
> data que quisesse — o caso clássico do §1.3.
>
> **A LGPD trata dado de criança e adolescente em artigo próprio**, com
> exigência de consentimento específico. O piso de idade não é só política do
> site.

O dono decidiu **13 anos** em 02/09, e entrou o trigger `guard_idade_minima`
(não um `CHECK`: expressão de CHECK precisa ser IMMUTABLE, e `current_date` é
STABLE — idade é relativa a hoje).

#### `[03/09]` E aí veio a parte que quase passou: o trigger nunca disparava

Colocar a regra no banco **não bastou**, e a descoberta veio de puxar outro fio
— o revoke do `SELECT` de `profiles`.

`useAuth.jsx` gravava `birth_date` com um `UPDATE` feito **logo depois** do
`signUp`. Com confirmação de e-mail ligada o `signUp` não devolve sessão, então
aquele UPDATE rodava como **`anon`** — e a única policy de UPDATE de `profiles`
é `TO authenticated`.

Medido em `ROLLBACK`: **0 linhas afetadas e nenhum erro.** O código checava
`error`, que vinha nulo, e seguia em frente.

| A regra existia em | E era imposta? |
| --- | --- |
| formulário (`Login.jsx`) | sim, mas só no navegador |
| banco (`guard_idade_minima`) | **não** — dispara em `INSERT OR UPDATE OF birth_date`, e o valor nunca chegava |
| política de privacidade | afirmava um piso que o sistema não aplicava |

**A prova de que era real, e não teoria:** 3 dos 5 perfis estavam com
`birth_date` **nulo**, incluindo os criados pelo formulário.

**A correção:** os campos extras passaram a viajar no `options.data` do
`signUp`, e o `handle_new_user` (que é `SECURITY DEFINER`, sem RLS no caminho)
os escreve no próprio INSERT do perfil. Aí o trigger de idade dispara de
verdade. Confirmado em `ROLLBACK`: menor de 13 é **barrado**, com a mensagem em
português.

> **O que continua verdade, e é honesto dizer:** nada impede alguém de **mentir**
> a data. Verificação de idade de verdade exige documento, e isso é
> desproporcional para este site. O que mudou é que o piso declarado passou a
> ser real no sistema, em vez de existir só no formulário e no texto.

#### `[03/09]` E a página pública continuou dizendo que estava pendente

O dono abriu a `/privacidade` no celular e viu o bloco **Idade mínima** com o
aviso *"Esta parte ainda depende de uma decisão… falta a decisão do dono sobre o
piso de idade"* — **um dia depois** de a regra estar de pé no banco.

**Por que nenhum portão pegou, e a razão importa:**

| Portão | Por que passou |
| --- | --- |
| a trava de impressão do conteúdo | ela vigia o arquivo **mudar**; o problema era ele NÃO ter mudado |
| `numeros-do-projeto` | não há número naquele texto |
| `documentacao-envelhecida` | compara commits, e o arquivo tinha commits |

**E o pior detalhe:** este mesmo documento foi atualizado com "✅ RESOLVIDO" no
dia. A documentação do **desenvolvedor** andou; a do **usuário** não. Documento
legal afirmando pendência falsa a quem se cadastra é pior do que `docs/` velho.

**A trava que eu tentei, e descartei.** A primeira ideia foi cruzar bloco
pendente com item no `BACKLOG.md`. Provei reinjetando o bug exato e **ela não
disparou** — o `BACKLOG.md` virou memória operacional, então o plano da própria
tarefa mencionava "idade mínima" e satisfazia a busca. Removida em vez de
remendada: trava que dá verde sem sustentar nada ensina a confiar num sinal que
não segura (§2).

**O que ficou:** o `scripts/inicio-de-sessao.sh` passa a listar, a cada sessão,
todo bloco `pendente` de documento **público**. Não julga se a pendência é
real — só põe na frente, que é a classe de mecanismo que funcionou para os itens
🔴/🟠 do backlog (§6.3).

> A primeira versão dele acusou dois falsos positivos: os arquivos **explicam**
> o campo `pendente: true` num comentário, e o grep pegou a explicação. Alarme
> que grita à toa é o §0.2, 4ª regra — e ele nasceu no código escrito para não
> deixar nada passar em silêncio. Consertado ancorando o padrão em linha de
> código, e provado nas duas direções: fala com bloco real, cala sem.

### 🔵 `login_attempts` e `admin_logs` não têm política de retenção

As duas são append-only e guardam dado pessoal — e-mail numa, quem fez o quê na
outra. Sem retenção, elas crescem para sempre.

A LGPD fala em **necessidade** e **prazo**: guardar para sempre um registro de
tentativa de login de dois anos atrás é difícil de justificar. Já existe
infraestrutura de retenção em `lib/logMeta.js` para outras categorias — o que
falta é a decisão de prazo.

### ✅ `[03/09]` RESOLVIDO — o Google Fonts saiu

> **Achado original (01/09):** o Google Fonts era o **único terceiro que a
> landing contactava**, medido. Todo visitante — inclusive quem só abre a
> página e vai embora, sem conta e sem clicar em nada — entregava o IP ao
> Google.
>
> Registrado na época como **boa prática, não obrigação legal**, e essa
> distinção continua correta. O que mudou é que o custo de resolver era pequeno.

As fontes passaram a ser servidas do próprio site: **96 KB** em
`public/fonts/`, com o `@font-face` em `src/estilos/fontes.css`. *(`[04/09]`
Estava no `src/index.css` até o CSS ser dividido; o arquivo mudou, o fato não.)*

| | Antes | Agora |
| --- | --- | --- |
| terceiros que a landing contacta | **1** (Google) | **nenhum** |
| domínios na cadeia da fonte | 2 (`googleapis` → `gstatic`) | 0 |
| viagens antes do primeiro glifo | baixar CSS → descobrir URL → baixar woff2 | o arquivo, direto |

**Duas economias que apareceram no caminho:**

- **Só o subconjunto `latin`.** O Google servia também cirílico, grego e
  vietnamita — um site em português não usa nenhum. O `unicode-range` continua
  declarado, que é o que faz o navegador nem buscar a fonte fora da faixa.
- **O Orbitron é uma fonte variável.** Os quatro pesos que o site usa
  (400/600/700/900) vinham do **mesmo arquivo** — conferido por md5, os quatro
  downloads eram byte a byte iguais. Servir um arquivo com `font-weight: 400
  900` no lugar de quatro cópias economiza 35 KB.

**O que sumiu do `index.html`:** os dois `preconnect`, o `preload` do CSS, o
truque `media="print" + onload` e o `<noscript>` que existia porque o truque
depende de JavaScript. Nada disso faz sentido quando o arquivo mora no mesmo
domínio.

**A trava** (`conteudoDaPrivacidade.test.js`): nenhum host de fonte de terceiro
pode aparecer no `index.html` nem em **nenhuma folha de estilo de `src/`** — e
ela ignora comentários de propósito, porque os arquivos **contam** por que as
fontes saíram de lá.

> **`[04/09]` A trava passou a varrer todo o CSS, e não um nome cravado.** Ela
> lia `src/index.css`; o split do CSS moveu o bloco de `@font-face` e ela
> **reprovou** — fez o trabalho dela. O conserto não foi trocar um nome fixo por
> outro: agora ela varre `src/estilos/*.css` inteiro, então vale para arquivo de
> CSS que ainda não existe. Provado criando um arquivo novo com um `@import` do
> Google Fonts e vendo a trava acusá-lo pelo nome.
Provada: repus um `<link>` do Google e ela falhou nomeando o problema.

Uma segunda trava confere que todo `@font-face` aponta para um arquivo que
existe — sem ela, renomear um `.woff2` daria queda silenciosa para a fonte do
sistema: nada quebra, nada avisa, o site só fica com outra cara (§4).

## O que está BEM feito, e merece registro

Auditoria só com achado ruim dá a impressão errada do estado real.

- **`profiles` não tem coluna de e-mail.** Ele mora no `auth`, fora do alcance
  da REST API pública.
- **O anônimo leva 401 em `posts`, `admin_logs` e `moderation_queue`** —
  verificado pelo portão `portas-do-banco.mjs`.
- **Em `profiles`, o anônimo leva 401 em tudo que é pessoal** — `role`,
  `banned`, `suspended_until`, `birth_date`, `bio`, `avatar_url` e `created_at`,
  cada coluna sondada uma a uma pelo portão.

  > **Correção de 02/09, com a evidência.** Esta linha dizia *"o anônimo leva
  > 401 em `profiles`"*, sem ressalva, e isso era **falso**. O 401 vale para
  > `select=*`; `select=id,username` responde **200 com as 5 linhas**.
  > Privilégio no Postgres é **por coluna**, e um `select=*` negado prova apenas
  > que *alguma* coluna está fechada. O portão sondava só `select=*` — dava
  > verde honesto para uma pergunta que não era a certa.
  >
  > A exposição de `id`+`username` está no `BACKLOG.md` como item 🟡, esperando
  > decisão sobre o revoke. O portão passou a sondar **coluna a coluna** e
  > reprova se qualquer outra abrir.
- **O Sentry recebe `id` e `username`, nunca e-mail.**
- **A data de nascimento não é exposta**: o perfil público mostra a idade
  calculada no banco, não a data.
- **Não há cookie nenhum**, então não há rastreamento a consentir.
- **Existe exclusão de conta** (`delete_own_account`), que é o direito de
  eliminação da LGPD implementado de fato.

---

## A DEFINIR — o que o código não responde

Nenhum destes se descobre lendo o projeto. Ficam em branco de propósito:

| Ponto | Por que depende do dono |
| --- | --- |
| Prazo de retenção de `login_attempts` e `admin_logs` | decisão de negócio |
| Idade mínima definitiva (13/16/18) | decisão de produto e jurídica |
| Quem é o controlador dos dados, e o canal de contato | dado pessoal dele |
| Base legal declarada de cada coleta | precisa de leitura jurídica |
| Se haverá política de privacidade publicada, e onde | há item de página no backlog |


## `[04/09]` Duas marcas novas no navegador, e a decisão de NÃO subir a versão

A tela de boas-vindas do login guarda dois sinalizadores locais:

| chave | onde | para quê | some quando |
| --- | --- | --- | --- |
| `gh_entrando` | `sessionStorage` | mostrar a saudação **uma vez** depois do login, e não a cada recarregamento | fecha a aba |
| `gh_ja_entrou:<id>` | `localStorage` | saber se a saudação é de estreia ou de volta | limpa o navegador |

As duas estão na tabela do bloco "o que fica guardado no seu navegador" e em
`CHAVES_DECLARADAS` — foi a trava dessa lista que reprovou o commit antes de eu
lembrar de declará-las.

> **`gh_entrando` vive segundos.** Ela é escrita no login e apagada na primeira
> leitura da tela de boas-vindas; se a tela não abrir, ela morre ao fechar a
> aba. Não é rastreamento — é o sinalizador que impede a saudação de voltar a
> cada recarregamento.

**A `versao` do documento NÃO subiu; só a `impressao`.** Isso é decisão, e o
motivo está escrito também em `lib/documentosLegais.js`: as duas linhas novas
são da mesma natureza das sete que já estavam ali — sinalizador local de
preferência, nada sai do aparelho, nada é pessoal. *"Lembramos que você acabou
de entrar para não repetir uma saudação"* não muda o que o site coleta sobre a
pessoa, e subir a versão faria todo mundo reaceitar o documento por causa disso.

> **Se o dono discordar, é uma linha:** subir a `versao` para `2026-09-04` em
> `lib/documentosLegais.js`. O julgamento é dele; o meu está escrito para poder
> ser revisto.
