# Plano do bloco Feed · Busca · Formatação · News — Fase 0

> **Isto é ANÁLISE. Nada foi implementado**: nenhuma migration, nenhuma policy,
> nenhuma linha de produto. O prompt do dono é explícito — *"Fase 0 é só
> análise"* — e o formato de 14 itens (A–N) foi exigido por ele.
>
> A fila do bloco fica no [`BACKLOG.md`](../BACKLOG.md); aqui está o **porquê**
> de cada decisão proposta, com o que foi **medido** separado do que é palpite.

---

## A. Estado atual — medido hoje, não lembrado

### O Feed

| O que | Como é hoje | Onde |
| --- | --- | --- |
| consulta | **uma só**, `limit(30)`, `order(created_at desc)` | `fetchFeedPosts` em `services/postService.js` |
| paginação | **não existe** | — |
| busca | `Array.filter` sobre os 30 já carregados | `Home.jsx`, `useMemo` |
| filtro de categoria | idem, sobre os mesmos 30 | `Home.jsx` |
| "novos posts" | contador de **eventos de realtime** recebidos com a aba aberta | `useRealtime('posts')` |
| índice que sustenta | `idx_posts_feed` — `btree (created_at DESC) WHERE deleted_at IS NULL AND live_kind IS NULL` | banco |
| engajamento | **em lote**, 2 consultas para o feed inteiro | `attachEngagement` |

**A consequência que ninguém tinha escrito: o post nº 31 é inalcançável.** Não
há "carregar mais", não há rolagem infinita, não há cursor. O feed é uma janela
fixa de 30, e o resto do acervo só existe por link direto (`/post/:id`).

### O tamanho real do acervo

```
posts ................. 404 linhas · 232 kB
   vivos (deleted_at IS NULL) ......... 0
   que parecem de robô ................ 403   ([e2e …], [painel …])
   que parecem de gente ................. 1   (e também apagado)
community_posts (mural) ................ 1
comments ............................. 132
profiles ............................... 5
```

**O feed de produção está vazio, e está assim há tempo.** Dois efeitos que
mudam este plano inteiro:

1. **Qualquer medição de desempenho de feed hoje mede nada.** Lote, rolagem,
   custo de render e paginação precisam ser validados contra **dado semeado**,
   nunca contra a produção.
2. **A tabela `posts` é 99,8% cadáver de CI.** Cada execução do E2E deixa um
   post soft-deletado para sempre — é a mesma classe de *"tabela append-only sem
   retenção"* que o §6.1 lista para `admin_logs` e `login_attempts`, e ninguém
   tinha olhado para `posts` sob essa luz.

### As categorias

```
category ....... text, DEFAULT 'dica', aceita NULL, SEM check
valores em uso . 'dica' nos 404 posts — nenhum 'curiosidade', nenhum 'news'
no banco ....... NENHUMA policy, função, view, índice ou constraint a lê
no código ...... 3 lugares (seletor, badge do card, filtro do feed)
```

> **Honestidade sobre essa evidência:** 403 dos 404 posts foram criados por
> robôs que nunca escolhem categoria, então o "ninguém usa" é sustentado por
> **um único post humano**. Não é prova de rejeição do recurso — é prova de que
> **não há dado para afirmar nada**, e o plano não pode se apoiar nisso.
>
> O que a evidência sustenta de verdade é outra coisa, e basta: **tirar a
> categoria da experiência não quebra nada no banco**, porque nada lá depende
> dela.

### A formatação

```
dangerouslySetInnerHTML ...... ZERO ocorrências no projeto inteiro
render do conteúdo ........... {post.content} — nó de texto do React
dependência de markdown ...... nenhuma
sanitizador .................. nenhum
```

O site é **seguro por construção** quanto a HTML de usuário hoje. Qualquer
formatação muda isso, e é por isso que o eixo 3 é o de maior risco de segurança
do bloco.

### O News

Não existe: **nenhuma tabela `news*`**, nenhuma rota `/noticias`, nenhuma
`/busca`. E um fato estrutural que decide o eixo 7: **toda rota de conteúdo
está atrás de `RequireAuth`**. Só landing, sobre, regras, termos, privacidade e
contato são públicas. O News seria a **primeira área pública com conteúdo** do
site.

### O que já existe e serve de alavanca

- **`FeatureGate` + `site_config`** — porta por funcionalidade, ligada e
  desligada pelo fundador, já em uso em `community`, `keys` e `lives`. É o
  mecanismo pronto para *"adicionar → migrar → validar → substituir"*.
  *(Nota: ele faz **uma consulta por montagem** e falha ABERTO — sem resposta,
  a seção aparece. Para área pública isso precisa ser reavaliado.)*
- **`useApenasAUltimaResposta`** — guarda de corrida, criada hoje. Paginação é
  fábrica de corrida; ela vai ser necessária.
- **`recarregarAteAparecer`** — já trata leitura-após-escrita no pool.

---

## B. Dependências

| Alvo | Depende dele no BANCO | Depende dele no CÓDIGO |
| --- | --- | --- |
| `posts.category` | **nada** (medido) | `ComposerToolbar` (seletor) · `PostCard` (`categoryConfig`, badge) · `Home` (`CATEGORIES`, filtro) · `LiveGoModal` (manda `'dica'` fixo) · `usePostComposer` (estado) · `postService.createPost` |
| ordem do feed | `idx_posts_feed` | `fetchFeedPosts` |
| "novos posts" | publicação realtime de `posts` | `useRealtime` em `Home` |
| conteúdo do post | — | `PostCard`, `PostPage`, e a moderação por IA que lê o texto |

**O `LiveGoModal` manda `category: 'dica'` fixo** — ao tirar a categoria da
experiência, esse é um dos lugares que some junto, e é fácil de esquecer porque
não parece um lugar de categoria.

---

## C. Problemas encontrados na análise

Achados desta varredura, **nenhum pedido**:

1. **🟡 O contador de "novos posts" promete o que o feed não mostra.** O handler
   de realtime conta **todo** INSERT em `posts`; a consulta do feed exclui
   `live_kind IS NOT NULL`. Alguém abrir uma live incrementa "1 novo post" para
   todo mundo — e o clique não traz nada. Mesma classe para post que a RLS
   esconde de quem olha.
2. **🟡 O contador conta EVENTOS, não posts.** Quem fica com a aba aberta duas
   horas acumula um número que não corresponde a nada no banco; quem acabou de
   entrar vê zero com 200 posts novos desde a última visita. O pedido do dono
   (*"'existem 500 novos posts' ≠ 'carregar 500 posts'"*) presume um número que
   hoje **não é medido** — ele é contado na memória da aba.
3. **🟢 O feed trunca em 30 sem dizer.** Não há indicação de que existe mais
   coisa. Hoje é invisível porque há zero posts vivos; com uso real vira "o
   site perdeu meus posts antigos".
4. **🟢 `posts` acumula lixo de CI sem retenção** — 403 linhas soft-deletadas
   que nunca saem.
5. **🔵 A busca atual promete o que não faz.** O campo diz "Buscar posts…" e
   procura em 30. Com acervo, isso é uma resposta errada apresentada como
   completa.

> Os itens 1, 2 e 4 vão para o `BACKLOG.md` **agora**, independentemente deste
> bloco: são defeitos existentes, não tarefas da feature (§0, regra de esbarrar).

---

## D. Arquitetura proposta

### O princípio que o dono pediu como requisito

```
descoberta  ->  lote limitado  ->  renderização incremental  ->  próximo lote
```

Traduzido para este projeto:

| Camada | Proposta | Por quê |
| --- | --- | --- |
| **descoberta** | uma RPC que devolve **um número e um teto** (`"20+"`), não a lista | contar é barato; trazer não é |
| **página** | **keyset** por `(created_at, id)`, não `OFFSET` | `OFFSET 500` faz o Postgres varrer 500 linhas e jogar fora; keyset usa o índice que já existe |
| **lote** | **a medir**, não a escolher | ver item K |
| **estado** | lista acumulada em memória, chave estável por `id` | não remontar card que a pessoa está lendo |
| **novos** | entram **no topo, por ação da pessoa** | o dono foi explícito |

**Por que keyset e não `OFFSET`:** o índice `idx_posts_feed` é
`btree (created_at DESC) WHERE …`, exatamente o formato que keyset explora.
`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT n`
custa o mesmo na página 1 e na página 50. `OFFSET` não. **E keyset não pula nem
duplica** quando um post nasce entre duas páginas — que é o requisito "sem
duplicar" do prompt, resolvido pela estrutura em vez de por remendo.

**O desempate por `id` não é detalhe:** `created_at` pode repetir, e sem o
desempate o cursor pula ou repete linhas. O índice precisa virar
`(created_at DESC, id DESC)`.

### O que NÃO muda

`attachEngagement` continua em lote e o contrato de retorno do post continua o
mesmo. Nada do PostCard, da moderação, do XP ou do realtime precisa saber que a
paginação existe.

---

## E. Banco

| Mudança | Natureza | Nota |
| --- | --- | --- |
| índice `(created_at DESC, id DESC)` parcial | **aditiva** | substitui `idx_posts_feed`; medir com `EXPLAIN` antes e depois |
| RPC de contagem de novos | **aditiva** | `SECURITY DEFINER` com `SET search_path`, `REVOKE` de `anon`, checagem por `auth.uid()` |
| coluna `busca tsvector` gerada + índice GIN | **aditiva** | `to_tsvector('portuguese', title || ' ' || content)`; o dicionário `portuguese` **existe** no banco (medido) |
| tabelas `news_*` | **aditiva** | RLS pensada na criação, nunca "depois" |
| `posts.category` | **nada agora** | sai da experiência primeiro; a coluna só é discutida depois de um ciclo inteiro sem ninguém reclamar |

**`pg_trgm` e `unaccent` NÃO estão instalados** (medido). A FTS nativa resolve
busca por palavra; `pg_trgm` só seria necessário para busca por trecho/erro de
digitação, e é decisão separada — instalar extensão é mudança de superfície.

**Toda tabela nova nasce fechada para `anon`**, pela régua de papéis de 12/09 —
com uma exceção a decidir no eixo News (ver N).

---

## F. Frontend

- `Home.jsx` tem **196 linhas** e acumula busca, filtro, realtime, contador,
  lista e composer. Paginação não entra aí sem estourar o §4. O corte natural:
  um `useFeed` com a lista e o cursor, e o `Home` só desenhando.
- A rolagem é a parte que só se valida **no celular** — e o `e2e/` já tem
  roteiro em janela de celular (`conteudo-visivel.mjs`) para imitar.
- Formatação: o render precisa continuar sem `dangerouslySetInnerHTML`. Um
  renderizador que transforma um AST em elementos React **nunca produz HTML**,
  então a classe inteira de XSS não volta. É por isso que a recomendação do
  eixo 3 é **AST, não HTML sanitizado**.

---

## G. Segurança

| Risco | Como fechar |
| --- | --- |
| formatação virar XSS armazenado | render por **AST → React**, nunca HTML. Link continua passando por `safeExternalUrl` |
| busca vazar post oculto/apagado | a busca é **consulta ao banco**, então a RLS de `posts` decide — e ela já esconde `deleted_at`/`hidden_at` de quem não é staff (medido). Nada de busca em view sem RLS |
| painel editorial confiar no frontend | `if (role === 'admin')` **não é autorização**. RPC `SECURITY DEFINER` + `exige_operador_ativo()`, como o resto |
| News público abrir superfície nova | é a **primeira** área pública com conteúdo. `anon` ganharia leitura de `news_articles` publicados — e isso é exceção à régua de 12/09, que **precisa de decisão escrita** (ver N) |
| ingestão de fontes | conteúdo de terceiro entrando no banco. Tem de nascer em `news_items_raw`, fora do alcance do público, e só virar artigo por ato humano |

---

## H. SEO — os trade-offs, sem migrar de framework

> **`[24/09]` Correção do que eu mesmo escrevi.** A primeira versão desta seção
> listava só o `index.html` e o `MetaDaRota`, e deixava passar a impressão de
> que o SEO do projeto era um começo. **Não é** — conferido arquivo a arquivo
> depois que o dono aprovou "SEO agora":

| Já existe | Estado |
| --- | --- |
| `public/robots.txt` | escrito à mão, com as áreas de conta em `Disallow` e o motivo comentado no arquivo |
| `public/sitemap.xml` | só as páginas públicas e indexáveis |
| `MetaDaRota` | `<title>`, `description` e `canonical` por rota, com teste de contrato que reprova rota pública fora do catálogo |
| `index.html` | canonical base, Open Graph, Twitter card, JSON-LD `WebSite` |
| `llms.txt` | existe |

E duas ausências são **deliberadas**, com o porquê escrito: `og:`/`twitter:` não
mudam por rota (raspador de cartão social não executa JavaScript, então mexer
neles no cliente criaria a ilusão de que mudam), e `Organization` ficou fora do
JSON-LD porque o GamerHub é um projeto, não uma organização com endereço.

O site é SPA Vite+React.

| Caminho | Ganha | Custa |
| --- | --- | --- |
| **SPA como está** | zero trabalho | rastreador que não executa JS vê só o casco; compartilhamento por link não tem prévia por artigo |
| **Pré-render de rotas conhecidas** | HTML real por artigo, mesmo build, mesma Vercel | precisa rebuild a cada publicação — e **build custa cota de deploy** (§0.2) |
| **SSR** | sempre atual | muda a arquitetura do projeto inteiro |
| **SSG por artigo** | ótimo para notícia, que é imutável depois de publicada | mesmo problema de rebuild do pré-render |

### `[24/09]` O que "SEO agora" significa DEPOIS de o News ser logado

O dono decidiu duas coisas no mesmo pedido: **News só para quem tem conta** e
**SEO agora**. Elas se cruzam, e é preciso dizer como — senão eu entregaria
trabalho que não serve para nada.

**Artigo atrás de login não é indexável, e não deve ser.** Se o News é logado,
o `Article` schema, o pré-render e o SSG **perdem o objeto**: o rastreador
encontraria uma parede de login, e forçar a indexação de conteúdo que exige
conta é pedir para o Google mostrar uma página que o visitante não consegue
ler. A tabela de trade-offs acima continua registrada — ela volta a valer **no
dia em que existir artigo público**, e não antes.

**O que "SEO agora" entrega, então, é a superfície pública que JÁ existe:**

| Cabe agora | Não cabe agora |
| --- | --- |
| auditar `title`/`description`/canonical das 6 páginas públicas contra o que elas realmente são | `Article` schema |
| conferir hierarquia de `<h1>`/`<h2>` — heading errado é o defeito mais comum e o mais invisível | pré-render / SSR / SSG |
| `sitemap.xml` ganhar a landing de News **quando ela existir** | indexar `/noticias/:slug` |
| `robots.txt` receber `/noticias` no `Disallow`, junto das outras áreas de conta | — |

**Minha recomendação:** fazer a auditoria das seis páginas públicas agora (é
barata e o portão de meta já existe para sustentá-la), e manter a decisão de
pré-render/SSR **congelada** até haver conteúdo público. Não é adiar por
preguiça: é não pagar complexidade por um benefício que a decisão do News
acabou de tirar da mesa.

---

## I. Automação

Ingestão de fonte é trabalho recorrente, e este projeto já tem duas formas: cron
do Postgres e GitHub Actions. A pergunta do §0.2 vale antes de qualquer coisa —
**quantas vezes por dia isso roda?** Uma coleta de 10 fontes a cada 15 minutos
são 960 execuções/dia, e cada uma é egress mais escrita.

Nada disso entra antes de o modelo existir e de haver revisão humana funcionando.

---

## J. IA

O dono já definiu: **IA classifica, sugere tag, resume, acha duplicata e aponta
afirmação sem fonte — não publica.** O projeto já tem moderação por IA com
limiares em `site_config`, e o mesmo padrão serve: o resultado da IA é um
**campo de sugestão**, e a publicação é um ato humano registrado em `admin_logs`.

---

## K. Testes — e a medição que falta ANTES de escolher o lote

O dono deu 10–20 como exemplo e pediu validação técnica. O que precisa ser
medido, e não opinado:

1. **Custo de render por card** — com mídia e sem, num aparelho lento.
2. **Bytes por lote** — o `orcamento-de-bytes.mjs` mede o bundle; isto é outra
   conta, de dado.
3. **Rolagem no celular** — o card que a pessoa lê não pode se mexer.
4. **Sem duplicar nem pular** — com post nascendo durante a paginação.

Travas que o bloco vai exigir: cursor que não pula nem duplica · a busca não
devolve post oculto para conta comum · o renderizador de formatação nunca
produz HTML · a tabela `news_*` não é alcançável por `anon` fora do que foi
decidido.

---

## L. Fases — a ordem proposta, e ela muda a do prompt

| # | Fase | Por que aqui |
| --- | --- | --- |
| **0** | esta análise | feita |
| **1** | **os 3 defeitos do item C** (contador que mente, contador de evento, lixo de CI) | são bugs existentes, e o §0 põe bug antes de feature |
| **2** | **paginação keyset + lote medido** | é a fundação. Busca e categorias mexem na mesma tela |
| **3** | **tirar categorias da experiência** | pequeno, e depende de a tela já estar estável |
| **4** | **busca de verdade** (FTS) | precisa de acervo; com 0 posts vivos, não dá para validar |
| **5** | **formatação** | independente das outras; o mais arriscado em segurança |
| **6+** | **News** — modelo, painel, SEO, ingestão, IA | domínio próprio, e o único que abre área pública |

**A diferença para a ordem do prompt** é que a paginação vem antes de tudo: o
prompt a trata como complemento, e ela é o alicerce das outras três. Tirar
categoria e trocar a busca numa tela que ainda vai ser reescrita é fazer o
mesmo trabalho duas vezes.

---

## M. Riscos

| Risco | Gravidade | Mitigação |
| --- | --- | --- |
| validar paginação com o feed vazio | **alto** | semear dado de teste e apagar na mesma sessão; nunca medir na produção vazia |
| formatação reabrir XSS | **alto** | AST → React; trava que reprova `dangerouslySetInnerHTML` no projeto inteiro |
| News público furar a régua de papéis | **alto** | decisão escrita antes do primeiro `GRANT`, com a tela pública nomeada ao lado |
| `posts.category` apagada cedo demais | médio | não apagar; um ciclo inteiro fora da experiência antes de discutir a coluna |
| ingestão estourar cota | médio | contar execuções por dia **antes** de ligar (§0.2) |
| `Home.jsx` virar arquivo gigante | baixo | extrair `useFeed` na fase 2, não depois |

---

---

## O. `[24/09]` PERMISSÕES DA UI — o eixo que o último prompt somou

> Medido, não lembrado: **112 usos** de `isAdmin`/`isOwner`/`isSuperAdmin` em
> **30 arquivos**, mais literais de cargo (`role === 'admin'`) espalhados.

### O que já existe, e é bom

| Camada | O que faz |
| --- | --- |
| `lib/roles.js` | `ROLE_RANK` · `roleRank()` · `canModerate()` · `canDeleteContent()` · `canModerateLive()` · `suspendedUntil()`. **Espelha o banco de propósito** e diz isso no cabeçalho |
| `hooks/useRole.js` | expõe `role`, `isUser`, `isAdmin`, `isSuperAdmin`, `isOwner`, `isBanned` |
| banco | `role_rank()` · `is_staff()` · `is_super()` · `is_owner()` · `can_moderate_content()` · `exige_operador_ativo()` |

**Nada disso deve ser recriado.** A hierarquia estrita (`>` e não `>=`) é a
regra que impede admin de moderar admin, e o projeto já a quebrou **três vezes**
escrevendo lista de papéis à mão. `canModerate(viewer, alvo)` é sobre
**hierarquia entre duas pessoas** — uma capacidade booleana nunca vai expressar
isso, e trocar uma pela outra seria destruir semântica.

### O problema real, em números

| Onde | Usos | O que costuma ser |
| --- | --- | --- |
| `pages/` | 6 arquivos | decidir se monta painel |
| `hooks/` | 6 arquivos | decidir o que buscar |
| `components/admin/` | 5 arquivos | mostrar/esconder controle |
| `services/` | **3 arquivos** | **mudar a QUERY** — é a categoria diferente |
| resto | 10 arquivos | badge, cor, rótulo — isso é IDENTIDADE, não capacidade |

**Os três serviços são o achado que muda o desenho:**

```js
deleteComment(commentId, userId, isAdmin)   // if (!isAdmin) q = q.eq('user_id', userId)
deleteMuralPost(id, userId, isAdmin)        // idem
updatePost(postId, {...}, userId, isAdmin)  // idem
```

O `isAdmin` ali **não é autorização** — é um recorte de consulta. Sem ele, o
autor comum mandaria um `DELETE` sem `user_id` e a RLS recusaria em silêncio
(0 linhas, nenhum erro), que é a 2ª fonte de silêncio do `POSTURA.md`. Ou seja:
o parâmetro existe para que a **mensagem de erro seja verdadeira**, não para
liberar nada. Removê-lo "porque o banco decide" pioraria o produto.

> Isto responde direto ao ponto 28 do prompt: os três **não** devem perder o
> parâmetro. O que eles podem ganhar é um nome honesto — não é "sou admin", é
> "posso apagar conteúdo alheio", e quem responde isso é a mesma
> `canDeleteContent` que já existe.

### O modelo proposto — `can()` por cima, nunca no lugar

```
    role (identidade)        ──>  badge, cor, rótulo, rank        mantém role
    hierarquia (duas pessoas) ──>  canModerate(viewer, alvo)      mantém função
    capacidade (uma pessoa)   ──>  can('publish_news')            NOVO
```

`can()` é **derivado** de `roleRank`, não uma segunda tabela de verdade — um
mapa `capacidade → rank mínimo`, no mesmo arquivo que já guarda a hierarquia.
Sem isso, seriam duas fontes divergindo (§4), que é exatamente como os ícones
de log e os rótulos de cargo divergiram.

E o hook não duplica a função: `usePermissions()` lê o papel do `useRole` e
chama a **mesma** função pura que o código fora do React chama.

### O mapa cargo → capacidade → tela → operação → proteção no banco

Este é o item 7 do prompt, e a coluna que importa é a **última**: se ela
estiver vazia, a capacidade é decoração.

| Capacidade | Rank mínimo | Tela | Proteção REAL no banco |
| --- | --- | --- | --- |
| `moderate_content` | admin (2) | fila, denúncias, botão ocultar | policies de `posts`/`comments` + `can_moderate_content()` |
| `ban_users` | admin (2) | painel de usuários | `ban_user` / `unban_user` (DEFINER, hierarquia estrita) |
| `manage_roles` | super_admin (3) | cargos | `admin_set_role` · `owner_set_role` |
| `view_audit_logs` | admin (2) | trilha | `owner_get_audit_logs` · policy de `admin_logs` |
| `manage_site` | owner (4) | config | `owner_set_site_config` (lista fechada de chaves) |
| `manage_live` | admin (2) **ou dono da live** | chat da live | policies de `live_chat*` — **é o caso que não cabe num rank só** |
| `publish_news` | **a definir** | painel editorial | **não existe ainda** |

**A linha `manage_live` é a prova de que `can()` sozinho não basta**: a regra é
*"é staff **OU** é o dono desta live"*, e depende do objeto. Ela continua no
`canModerateLive(isAdmin, live, user)`, e é por isso que o modelo mantém as
três camadas em vez de achatar tudo em capacidades.

### O que NÃO muda

- `role` continua existindo para badge, cor, rótulo e rank (ponto 26 do prompt).
- `roleRank`/`canModerate` continuam sendo a hierarquia (ponto 27).
- Os três serviços mantêm o recorte de consulta (ponto 28, com o motivo acima).
- **Nenhuma policy, RPC ou função SQL muda por causa disto.** `can()` é UI.

### O teste de DOM (pontos 29 e 30)

Já existe base: o `e2e/fluxos.mjs` percorre `ROTAS_PROIBIDAS_PARA_USUARIO` e
falha se `MARCAS_DE_PAINEL` aparecer para conta comum. O que falta é a
granularidade — **botão** administrativo dentro de tela compartilhada, e texto
interno de staff. É ampliação do que existe, não invenção.

> E vale registrar o que o próprio dono escreveu no prompt, porque é a parte
> que costuma se perder: esconder botão **não é segurança**. O ganho de não
> renderizar UI administrativa é não entregar ruído e detalhe interno a quem
> não precisa — a autoridade continua sendo RLS, RPC e constraint.

---

## P. `[24/09]` O que NÃO precisa mudar

O prompt pede isto explicitamente (item 5), e é a parte que evita refatoração
por refatoração:

| Continua como está | Por quê |
| --- | --- |
| `lib/roles.js` e `useRole` | são a hierarquia, e ela está certa e espelha o banco |
| toda a camada de RLS/RPC | `can()` é UI; a autorização real não muda uma linha |
| `attachEngagement` (2 consultas em lote) | já resolve o N+1; paginação não o afeta |
| `recarregarAteAparecer` | trata leitura-após-escrita no pool, problema ortogonal |
| `robots.txt`, `sitemap.xml`, `MetaDaRota` | já existem e estão corretos |
| o cartão social estático no `index.html` | mudar por rota não chegaria ao WhatsApp |
| `FeatureGate` | é o mecanismo de migração — será usado, não trocado |
| `posts.category` **no banco** | sai da experiência; a coluna fica |

---

## Q. `[24/09]` Migrations previstas (item 14 do prompt)

Nenhuma escrita ainda. O que o plano prevê, em ordem:

| # | Migration | Natureza | Depende de |
| --- | --- | --- | --- |
| 1 | índice `(created_at DESC, id DESC)` parcial para o cursor | aditiva | — |
| 2 | RPC de contagem de novos com **teto** | aditiva | decisão 2 (aprovada: `"20+"`) |
| 3 | coluna gerada `busca tsvector` + índice GIN em `posts` | aditiva | fase da busca |
| 4 | RPC de busca paginada | aditiva | 3 |
| 5 | `news_sources` · `news_items_raw` · `news_articles` · `news_tags` · `news_article_tags` | aditivas, **com RLS na criação** | decisão 3 (aprovada: logado) |
| 6 | RPCs editoriais (criar, editar, publicar, arquivar) | aditivas | 5 |

**Nenhuma é destrutiva.** `DROP COLUMN category` não está nesta lista de
propósito — ela só entra depois de um ciclo inteiro sem ninguém sentir falta,
e com decisão dele.

## N. Decisões — o que ele respondeu em `[24/09]`

| # | A decisão | Resposta dele | Estado |
| --- | --- | --- | --- |
| 1 | ordem das fases (paginação antes de categorias e busca) | *"de resto pode fazer tudo"* | ✅ **aprovada** |
| 2 | o que o contador deve dizer | **teto `"20+"`** | ✅ **aprovada** |
| 3 | News público ou logado | **só logado** | ✅ **decidida** |
| 4 | SEO agora ou depois | **agora** | ✅ **decidida, com ressalva** — ver H |
| 5 | as 403 linhas de CI em `posts` | *"não entendi, me explica"* | ⏳ **pendente** |

### O que a decisão 3 obriga, e ele viu antes de mim

Palavras dele: *"como é nova feature, precisamos pôr isso lá na landing page"*.
Está certo, e é consequência direta: **se o News exige conta, a landing é o
único lugar onde alguém sem conta descobre que ele existe.** Sem isso, a
funcionalidade nasce invisível para quem ainda não entrou — que é exatamente o
público que ela deveria atrair.

A landing já tem o mecanismo pronto: `components/landing/secoesDaLanding.js` é
**fonte única** das cinco seções (faixa do topo, navegação lateral e rodapé
leem dela). Somar News é uma entrada ali mais uma cena.

**A ressalva, e ela é de honestidade, não de preguiça:** a entrada na landing
só pode ir ao ar **junto** com o News. Anunciar antes é a landing prometendo
uma área que não existe — o §1.5 pelo lado da interface, e o mesmo defeito que
o `INV-TELA-001` existe para impedir. Por isso o item entra na **fase do News**,
com a razão dele registrada.

### A ressalva da decisão 4

Está no item H: **artigo atrás de login não é indexável, e não deve ser.** "SEO
agora" passa a significar auditar a superfície pública que já existe — e ela
está em estado melhor do que a primeira versão desta análise dava a entender
(`robots.txt`, `sitemap.xml` e `MetaDaRota` já existem, com teste de contrato).
Pré-render, SSR e SSG ficam congelados até haver conteúdo público.
