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

---

## Q. `[01/10]` RADAR DE DESCOBERTA — a auditoria, e o que ela MEDIU

> Pedido dele em 01/10: o radar responde bem *"o que as fontes que escolhemos
> publicaram?"* e precisa responder também *"o que está começando a pegar fogo
> agora e interessa ao GamerHub?"*. Ele exigiu auditoria antes de qualquer
> código — e deixou explícito, num segundo prompt, que os exemplos (GTA 6,
> Marvel) são **só casos de teste**: nada de palavra-chave, fonte, peso ou
> tratamento especial para assunto nenhum. O motor é genérico para as 9
> editorias.

### 1. Diagnóstico — o que está bom, e o que limita

**O que está bom e não deve ser tocado:**

| | |
| --- | --- |
| a IA não é fonte | ela recebe o que o sistema coletou e ordena. A `redigir-materia` recusa trabalhar sem notas |
| a guarda de endereço | URL que o modelo escreve e não veio da coleta é **descartada**, e o descarte grita |
| a porta | `is_staff()`, não "estar logado" — o que está em jogo é cota de terceiro |
| falha parcial não perde tudo | IA fora do ar devolve as manchetes cruas com aviso amarelo |
| a fatia justa | rodízio entre fontes, para a rápida não comer a vaga da boa |

**O que limita, medido no banco em 01/10:**

| | |
| --- | --- |
| fontes | 15 cadastradas, **13 ativas** — todas `tipo='rss'` |
| itens | **212** em `news_items_raw`, **todos das últimas 24h** |
| `processado` | **0 de 212** — a coluna existe e **ninguém a usa** |
| `news_tags` / `news_article_tags` | **vazias** |
| `news_items_raw` | RLS ligada, **0 policies, 0 colunas concedidas** — só a service role alcança |
| artigos | 4 (3 em revisão, 1 no ar) |

**A limitação de fundo, em uma frase:** o radar só enxerga o que **13 editores
alheios decidiram publicar**. Se nenhum deles cobrir um assunto, ele não existe
para o GamerHub — e a lista de itens é **plana**: 60 manchetes soltas, sem
noção de que 8 delas falam da mesma coisa.

### 2. As fontes de descoberta — MEDIDAS, não escolhidas por preferência

| Fonte | Função | Custo / limite | Qualidade medida | Risco | Recomendação |
| --- | --- | --- | --- | --- | --- |
| **GDELT DOC 2.0** | busca + **volume de cobertura** | grátis, **sem chave**. Limite real **1 req / 5 s** — não está na doc, veio de um `429` medido | 4 artigos pt-BR em 72 h (`br.ign.com`, `canaltech`, `pt.ign.com`). `TimelineVol` deu **120 pontos horários em 7 dias** | serialização obrigatória; é cortesia de um projeto acadêmico | **FASE 1** |
| **Google Trends RSS** | sinal de atenção | grátis, sem chave, HTTP 200 | 10 tendências/BR com tráfego aproximado — **e 0 de 10 eram do nosso escopo hoje** | endpoint não oficial, pode sumir | **FASE 3**, só como sinal anexado |
| **YouTube Data v3** | sinal de atenção | chave Google; **~100 `search.list`/dia** | não testado — exige chave | mais um segredo para ele criar | **FASE 4** |
| **Reddit** | sinal de comunidade | **403 sem OAuth** (medido hoje) | — | exige app registrado + segredo | **adiado** |
| **Brave Search News** | busca | **exige cartão de crédito**; US$ 5 de crédito/mês ≈ 1.000 buscas | não testado | cartão é atrito real para este projeto | **adiado** |
| **NewsAPI** | busca | grátis = 100 req/dia, **24 h de atraso** | — | **os termos PROÍBEM produção**: *"cannot be used in a staging or production environment"* | **DESQUALIFICADO** |

> **O NewsAPI não foi recusado por gosto.** Ele é proibido por contrato no uso
> que faríamos dele, e 24 h de atraso é o oposto de *"o que está pegando fogo
> agora"*. As duas razões são independentes e cada uma basta.

### 3. A medição que decidiu o papel do "trending"

O RSS de tendências do Google para o Brasil, lido em 01/10, trouxe:

> lotofácil · Japão x Equador · energia elétrica · onça-pintada ·
> Marjorie Estiano · Arnold Schwarzenegger · Alexander Zverev ·
> previsão do tempo Londrina

**Zero de dez pertencem a qualquer das 9 editorias.** É o Caso D do teste de
aceitação dele, acontecendo na primeira leitura.

**A conclusão de desenho, e ela é forte:** tendência **nunca** entra como
fonte de pauta. Ela só pode ser **anexada a um assunto que já veio de uma
fonte jornalística** — e aí responde "quanta gente está procurando por isto",
que é outra pergunta. Trending como entrada transformaria o radar numa máquina
de futebol e loteria.

### 4. Arquitetura proposta — e o que ela recusa

```
   RSS (13 fontes)        GDELT (busca + volume)        [Fase 3+] Trends/YouTube
         │                        │                              │
         └────────────┬───────────┘                              │
                      ↓                                          │
               NORMALIZAÇÃO  (título, url, resumo, data, fonte)   │
                      ↓                                          │
               DEDUPLICAÇÃO  (url canônica)                       │
                      ↓                                          │
          AGRUPAMENTO EM EVENTO  ←───── sinais anexados ──────────┘
                      ↓
            IA ORDENA E EXPLICA  (não descobre, não confirma)
                      ↓
                 RADAR DE EVENTOS
                      ↓
                    EDITOR
```

**O que a arquitetura recusa, explicitamente:**

- perguntar ao modelo *"o que está acontecendo?"* — ele não tem internet e
  inventaria;
- tratar volume de busca como acontecimento;
- tratar comunidade como confirmação;
- **score mágico**. Se houver ordenação, ela é a soma de sinais nomeados, e a
  tela mostra **os sinais**, não o número.

### 5. Classificação de confiabilidade — e ela não se mistura

| | O que significa | De onde pode vir |
| --- | --- | --- |
| `confirmado` | fonte oficial ou evidência sólida | anúncio do estúdio/fabricante |
| `relato` | veículo jornalístico relata | RSS, GDELT |
| `rumor` | alegação não confirmada | veículo citando "fontes" |
| `vazamento` | material supostamente vazado | veículo relatando leak |
| `tendencia` | aumento de atenção | Trends, YouTube |
| `discussao` | comunidade falando | Reddit, fórum |

**`tendencia` e `discussao` nunca viram `relato` por acumulação.** Muita gente
falando não é fato — e é por isso que a classificação é um campo próprio, e
não um número somado aos outros.

### ✅ `[01/10]` A Fase 2 foi feita — e ela entregou MENOS do que esta tabela

Duas coisas mudaram entre o plano e a execução, e as duas por medição.

**1. O agrupamento já existia.** A instrução ao modelo manda juntar manchetes
do mesmo assunto desde a Fase 1, e funciona — medido: a pauta do QSSR agrupou
**4 veículos**. O que faltava não era o agrupamento: era **vê-lo**. A tela
passou a dizer *"N veículos"* quando o evento tem mais de um. Um evento com
quatro veículos é notícia; com um, pode ser nota — e essa leitura é do editor,
não minha.

**2. Entraram QUATRO dos seis valores.** `tendencia` e `discussao` ficaram de
fora **de propósito**: as quinze fontes de hoje são todas veículo jornalístico,
e nenhuma produz "aumento de atenção" nem "comunidade falando". Pôr os seis
criaria dois valores que nada alcança — a tela desenharia selo para caso que
nunca chega, que é código morto parecendo feature.

Eles entram na **Fase 3**, junto com Trends e comunidade, que é de onde vêm. A
regra *"nunca viram relato por acumulação"* fica para quando houver o que
acumular, e a trava reprova se eles entrarem antes da fonte.

### O limite que a classificação TEM, e ele está na tela

O modelo vê título e 160 caracteres de resumo. **`confirmado` quer dizer "a
manchete se apresenta como anúncio oficial"** — não que o GamerHub conferiu.

Isso é a mesma família do endereço inventado que a Fase 1 fechou: rótulo que
parece verificação e não é seria promessa de apuração sem apuração. Por isso a
tela escreve, uma vez acima da lista, *"os selos dizem como a MANCHETE se
apresenta, não se o fato foi conferido"* — e a trava reprova se a frase sumir.

### 6. Rollout incremental

| Fase | O que entra | Por que nesta ordem |
| --- | --- | --- |
| **1** ✅ **`[01/10]`** | GDELT como 2ª fonte de coleta, ao lado do RSS | grátis, sem chave, sem ação do dono, e já responde "o que saiu fora das minhas fontes" |
| **2** ✅ **`[01/10]`** | agrupamento em evento + classificação | é o que impede 20 sites virarem 20 pautas |
| **3** | `TimelineVol` do GDELT e Trends como **sinal anexado** | só faz sentido quando já existe evento a que anexar |
| **4** | YouTube / comunidade | exigem segredo novo e ação dele |

### 7. Mudanças necessárias — e o que NÃO muda

| Camada | Fase 1 |
| --- | --- |
| banco | **nenhuma migration.** `news_items_raw` já tem `fonte_id` nulável, `url` único e `coletado_em` |
| Edge Function | `radar-de-pautas` ganha um coletor GDELT ao lado do RSS |
| frontend | a tela passa a mostrar de onde veio cada item |
| env | **nada** — GDELT não tem chave |
| testes | o coletor novo entra na trava que já existe |
| documentação | esta seção + `OPERACAO.md` |

**Não muda:** RLS, policies, triggers, a porta `is_staff()`, a guarda de
endereço inventado, o comportamento de falha parcial, nem as 9 editorias.

### ✅ `[01/10]` A Fase 1 FOI FEITA — e o que a entrega desmentiu do plano

O plano acima acertou em quase tudo, e errou numa coisa que só a medição
mostra. Registrado porque a Fase 3 depende da GDELT de novo.

| O plano dizia | O que se mediu |
| --- | --- |
| "nenhuma migration" | **certo, e por um motivo melhor do que eu sabia**: o `CHECK` de `news_sources.tipo` já aceitava `'api'` desde a fundação do News. A consulta virou LINHA de tabela, não constante |
| "limite real 1 req / 5 s" | **certo, e insuficiente**: o teto é por **IP**, e com 8 s de espaço — e depois com **70 s** — a resposta foi `429` nas cinco tentativas |
| GDELT devolve artigos | `ArtList` traz `url`, `title`, `seendate`, `domain` — **e nenhum resumo**. O `resumo` fica vazio de propósito: preencher com domínio ou data seria fabricar conteúdo editorial a partir de metadado |
| "a trava que já existe cobre" | **errado**: ela exigia `comFalha.push(` dentro do `index.ts` e reprovou quando a coleta mudou de arquivo. Grep não distingue "mudou de casa" de "sumiu" — a garantia virou teste executável |

**O que ficou provado, e o que não.** Provado em `npm test`: os dois coletores
convivem, um caindo não derruba o outro, `429` em texto puro não estoura o
`JSON.parse`, a série respeita o espaçamento, tipo desconhecido grita, e o
código não cita assunto nenhum.

> #### ✅ `[01/10]` O PRIMEIRO CLIQUE REAL ACONTECEU — e o resultado é misto
>
> **O radar funcionou inteiro.** 170 manchetes de 15 fontes, a Groq aceitou, as
> pautas saíram agrupadas (uma delas com 4 veículos sobre o mesmo
> acontecimento) e os endereços foram resolvidos por número. Zero erro em
> `admin_logs`. As três confirmações que faltavam fecharam.
>
> **E a GDELT não entrou — mas não pelo motivo que eu previ.** Eu esperava
> `429`; veio `Signal timed out.` nas duas consultas. **Não é recusa, é
> lentidão** — e o número que mostraria isso já estava medido por mim antes do
> clique: ela leva **10 a 12 segundos só para devolver um `429`**, que é a
> resposta mais barata que existe. O `TIMEOUT_DO_FEED` de 10 s, dimensionado
> para RSS, nunca ia caber.
>
> **Corrigido:** timeout próprio de 20 s para `tipo='api'`, e o teto por clique
> caiu de 2 para 1 (com 20 s cada, duas em série custariam 45 s de espera).
>
> **Ainda não provado:** que a GDELT responde **com sucesso**. Não existe uma
> única medição de sucesso — nem daqui (429 sempre), nem de lá (timeout). O
> próximo clique diz, e agora a tela informa o relógio junto do motivo.
>
> #### ⛔ O 2º clique fechou a questão: a GDELT SAIU, o Google News ENTROU
>
> Com o timeout de 20 s ela respondeu — e o que respondeu foi `429`, na
> **primeira** requisição. Sete tentativas, dois IPs, **zero sucessos**. O
> teto é por IP e saímos de IP compartilhado.
>
> **O gatilho que eu tinha escrito aqui estava errado:** eu disse que a saída
> seria `EdgeRuntime.waitUntil()`. Não resolveria — o problema nunca foi
> tempo, é cota, e segundo plano dá relógio e zero cota.
>
> **Substituída pelo Google News RSS de busca, e sem uma linha de código.**
> Ele é RSS: as duas consultas entraram como `tipo = 'rss'` e caem no
> coletor que já existia. **A arquitetura desta fase se pagou aqui** — trocar
> de fornecedor virou um `INSERT`, porque `coleta.ts` despacha por `tipo` e a
> consulta sempre foi dado.
>
> Medido: 100 itens, 15 lidos, 1 segundo. Traz PlayStation.Blog BR,
> TudoCelular, Adrenaline, Nintendo Blast, Tecnoblog e Omelete — veículos
> fora dos 13 feeds, que era o objetivo da fase.
>
> **O custo, aceito por ele:** o link é um redirecionador do Google, não o
> endereço do veículo. O título carrega `- <Veículo>`, então a origem aparece
> antes do clique. A história inteira está em `DECISOES.md`.

**A arquitetura que a Fase 2 herda:** `coleta.ts` despacha por `tipo` e devolve
`{itens, comFalha}`. Coletor novo é um `tipo` novo e um adaptador — não mexe
no `index.ts` nem no pedido ao modelo.

### `[01/10]` O 400 que apareceu no mesmo dia, e por que ele importa para a Fase 2

Depois de o `413` ser corrigido baixando `max_tokens` de 2.500 para 1.300,
surgiu `HTTP 400 json_validate_failed` com `failed_generation: ""` — **vazio**.
Não era JSON ruim: era **nenhuma saída**. O `gpt-oss-120b` é modelo de
raciocínio e gasta 300–900 tokens pensando do mesmo `max_tokens`.

**O que a Fase 2 herda disso, e é a parte que muda decisão:** agrupar em evento
e classificar confiabilidade **aumenta a resposta** — cada pauta ganha campos
novos, e o modelo tem mais o que decidir. A reserva de saída vai ter de crescer
junto, e ela sai do mesmo teto de 8.000 que a lista de manchetes.

Então a Fase 2 começa com uma conta, não com código: **quantos tokens a mais a
resposta nova custa, e quantas manchetes isso tira da entrada.** Hoje o piso
está travado em 50 itens (`radarDePautasNaoInventa`), e com 15 fontes em rodízio
abaixo disso cada fonte entra com menos de 4 manchetes — fino demais para
agrupar assunto repetido, que é justamente o que a Fase 2 existe para fazer.

### 8. Critérios de sucesso, verificáveis

1. o radar traz assunto que **nenhum dos 13 RSS** publicou;
2. várias fontes sobre o mesmo acontecimento viram **um** evento;
3. rumor continua marcado como rumor;
4. nenhuma URL inventada passa;
5. tendência **nunca** vira pauta sozinha;
6. GDELT fora do ar **não** derruba o RSS;
7. IA fora do ar **não** perde a coleta;
8. nenhuma linha do código cita assunto específico — o motor é genérico.
