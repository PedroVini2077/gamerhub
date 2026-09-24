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

O site é SPA Vite+React. O `index.html` tem canonical, Open Graph e `WebSite`
em JSON-LD, e o `MetaDaRota` reescreve por rota **depois que o JS roda**.

| Caminho | Ganha | Custa |
| --- | --- | --- |
| **SPA como está** | zero trabalho | rastreador que não executa JS vê só o casco; compartilhamento por link não tem prévia por artigo |
| **Pré-render de rotas conhecidas** | HTML real por artigo, mesmo build, mesma Vercel | precisa rebuild a cada publicação — e **build custa cota de deploy** (§0.2) |
| **SSR** | sempre atual | muda a arquitetura do projeto inteiro |
| **SSG por artigo** | ótimo para notícia, que é imutável depois de publicada | mesmo problema de rebuild do pré-render |

**Recomendação:** não decidir agora. O SEO do News só importa quando existir
artigo publicado, e a decisão fica mais barata depois que o modelo estiver de
pé. Registrar como decisão pendente em vez de escolher no escuro.

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

## N. O que precisa da aprovação dele

1. **A ordem das fases** — proponho paginação antes de categorias e busca
   (item L). Contraria a ordem do prompt, e a porta foi aberta por ele.
2. **O que o contador de novos posts deve dizer.** Três saídas: número exato
   (exige consulta periódica — custo), número com teto (*"20+"*), ou só
   *"há novidades"*. **Recomendo o teto**: entrega a informação útil sem
   prometer um número que o sistema não mede bem.
3. **News público ou logado.** Se público, `anon` ganha leitura de artigos
   publicados — exceção à régua de 12/09, e é decisão dele, não minha. Se
   logado, o eixo SEO inteiro deixa de fazer sentido e a fase some.
4. **SEO: adiar ou decidir agora.** Recomendo adiar até existir artigo.
5. **A retenção de `posts`** — o que fazer com as 403 linhas de CI. Apagar de
   verdade é destrutivo (🔴) e não faço sem ele dizer.
