# Operação

> O que fazer quando algo quebra, e o que o projeto faz sozinho para avisar que
> quebrou. Este é o arquivo para abrir num aperto.

## `[02/09]` Teste de mutação — `npm run mutacao`

Roda em ~39 s e responde a pergunta que `npm test` não responde: **os testes
detectam a mudança errada, ou só passam por cima do código?**

**Não roda no CI de todo PR**, e isso é escolha — o número balança com
refatoração inocente, e portão que oscila vira alarme falso. Um robô mensal
(`.github/workflows/lembrete-de-mutacao.yml`) abre **issue** se o score cair
abaixo do piso.

O porquê inteiro, o escopo e o que ele **não** faz estão em
[DECISOES-FERRAMENTAL.md](DECISOES-FERRAMENTAL.md).

## Observabilidade — a falha tem que gritar

> Regra de origem: `CLAUDE.md` §1.5. De 11 achados numa única rodada de testes,
> **quatro falhavam em silêncio absoluto** — nada estourava, nada aparecia na
> tela, nenhum teste quebrava. O pior deles (a moderação por IA) esteve quebrado
> em **26 de 26 chamadas por semanas**, detectando corretamente e nunca
> aplicando nada. O sistema não tinha defeito de detecção; estava mudo.

- **Sentry no frontend** (`lib/monitoring.js`) — só **erro**, sem tracing e sem
  Session Replay, que são os que consomem cota. Ligado no `ErrorBoundary`, que
  até então só fazia `console.error`: a tela "Algo deu errado" aparecia e
  ninguém do outro lado ficava sabendo.
  - `sendDefaultPii: false` e um `beforeSend` que **remove `access_token` e
    `refresh_token` da URL**. O Supabase devolve esses tokens no fragmento na
    confirmação de email e na recuperação de senha; sem a limpeza, um erro
    nessas telas mandaria uma **sessão válida** para dentro do relatório.
  - O DSN fica **no código**, não em variável de ambiente: ele é público por
    natureza (vai no bundle), e depender da Vercel significaria que esquecer de
    configurá-lo num deploy futuro apagaria o monitoramento sem ninguém notar —
    construindo a falha silenciosa que ele existe para acabar.
  - Custo medido: **+27,8 KB gzip** (507 → 535 KB de JS total).
  - **`[28/08]` Carregado sob demanda, e isso NÃO abre janela cega.** O
    `@sentry/react` saiu do chunk que bloqueia a primeira pintura (-83,4 KB
    brutos no caminho crítico) e agora chega num chunk próprio de 85 kB, depois
    que o navegador fica ocioso.

    A parte que importa é o que cobre o vão: `lib/capturaAntecipada.js` instala,
    **sincronamente**, dois ouvintes baratos que guardam erro global e promessa
    rejeitada até o Sentry subir — e o `init()` roda **antes** de eles serem
    removidos, para as duas redes ficarem ativas por um instante em vez de haver
    um buraco entre elas. Evento duplicado o Sentry deduplica; evento perdido
    ninguém recupera. `registrarErro()` e `identificarUsuario()` chamados nesse
    intervalo também ficam na fila e são aplicados depois.

    A troca só é aceitável porque tem prova: `capturaAntecipada.test.js`.
    **Se aquele teste passar a falhar, o certo é voltar o Sentry para o
    carregamento síncrono — não afrouxar o teste.**
- **Teto de 20 eventos por sessão** (`lib/tetoDeEventos.js`). O plano Free são
  5.000 eventos/mês e, estourando, o Sentry **descarta em silêncio** pelo resto
  do mês. Com 3 usuários, 166/dia não se esgotam por uso normal — o jeito
  realista de estourar é **rajada**, um bug em laço de render disparando
  centenas de eventos em minutos.

  Passado o teto, em vez das duas saídas ruins (mandar tudo e queimar a cota, ou
  ficar mudo), sai **um evento que conta a história**, carregando o último erro
  real junto e com `fingerprint` fixo — todos os avisos caem num issue só.

  > **Se você vir no Sentry o issue "Teto de 20 eventos por sessão atingido",
  > é quase certo que existe erro em laço.** O `ultimo_erro` no `extra` diz
  > qual. Uma rajada de 1.000 erros custa 21 eventos de cota, não 1.000.

- **Uma linha por hora, por tipo de falha.** `registrar_falha_de_edge_function`
  suprime repetição dentro de uma janela de 1 hora, por
  `(função, tipo de falha)`. Sem isso a trilha enche de ruído: a `send-email` é
  pública por construção (auth hook), então qualquer POST da internet gravava
  uma linha, **sem limite** — e a própria trava `portas-fechadas.mjs` gravava 3
  por execução do CI.

  > A linha diz **que** aconteceu, não **quantas vezes** — a trilha é
  > append-only e contar exigiria alterar a linha existente. Para "algo está
  > errado?", uma por hora responde.

- **Recusa de estranho é `warning`; o resto continua `critical`.** O critério é
  fato, não palpite: **o GoTrue sempre assina e sempre manda carimbo válido.**

  | Na trilha você vê | Significa |
  | --- | --- |
  | `warning` — sem cabeçalhos / carimbo fora da janela | estranho bateu na porta. A função **funcionou** ao recusar |
  | `critical` — assinatura inválida | **ambíguo**: atacante, *ou* o secret errado. Se for o secret, o cadastro está quebrado em silêncio |
  | `critical` — secret não configurado/malformado | nossa config quebrada, cadastro parado |
  | `critical` — SMTP recusou | conta do Google travada, senha de app revogada ou cota estourada |

  > Só a `send-email` registra recusa. A `moderate-links` devolve 401 sem
  > logar — conferido: das 68 linhas de ruído, **68 eram da `send-email`**.

- **Falhas de servidor viram trilha** — `registrar_falha_de_edge_function`
  grava `edge_function_error` em `admin_logs`, porque o corpo da resposta
  sozinho não basta quando o chamador é fire-and-forget. `EXECUTE` só para
  `service_role`: o texto vai direto para o painel, então não pode ser escrito
  por cliente. (`registrar_falha_de_moderacao` continua existindo e delega para
  ela — os chamadores antigos não mudaram.)
- **`send-email` grita.** Era a mais grave das mudas: se o Google travar a
  conta, a senha de app expirar ou o secret ficar errado, **ninguém se cadastra
  nem recupera senha**. Agora vão para `admin_logs` as três causas — chamada
  recusada, credenciais SMTP ausentes, e SMTP recusando o envio.

  > **Se você vir `Falha em send-email` no painel, a porta de entrada do site
  > está fechada.** Confira, nesta ordem: a senha de app do Google ainda é
  > válida? a conta não foi travada por envio automatizado? passou dos ~500
  > envios do dia?

  > **`[28/08]` E esta trilha já pagou o próprio custo.** O dono publicou um
  > post com 4 imagens e "não deu em nada". A linha
  > `Falha em moderate-image: provedor openai nao respondeu` foi o único sinal
  > que existia — e ela levou, em uma consulta, ao log da função:
  > `400 too_many_images — Number of images (4) exceeds maximum of 1`. Sem
  > essa linha, a busca teria começado do zero, porque do lado de quem publica
  > "a IA não achou nada" e "a IA nunca rodou" são a mesma tela.
  >
  > A mensagem, porém, **mentia por imprecisão**: o provedor respondeu, e
  > respondeu explicando o erro. Desde então a análise parcial tem log próprio
  > (`analise parcial: N de M imagens`), e o número de imagens analisadas vai
  > no corpo da resposta. Diagnóstico rápido:
  >
  > ```sql
  > select created_at, details, metadata from admin_logs
  >  where action = 'edge_function_error'
  >    and metadata->>'funcao' = 'moderate-image'
  >  order by created_at desc limit 10;
  > ```

  > **`[29/08]` A falha do NAVEGADOR também chega aqui agora.** Quando o vídeo
  > sobe mas a extração de quadros não produz nada, a falha acontecia inteira
  > dentro do navegador de quem publicou: a `moderate-image` não era chamada
  > nenhuma vez, e o motivo existia só num toast de segundos e no Sentry. Duas
  > investigações começaram do zero por causa disso.
  >
  > Agora o navegador relata a falha pela própria `moderate-image` (corpo com
  > `falha_de_extracao` e sem imagem), e ela grava com o motivo, o tipo do
  > arquivo, o tamanho e o agente:
  >
  > ```sql
  > select created_at,
  >        metadata->>'motivo'          as motivo,
  >        metadata->>'tipo_do_arquivo' as tipo,
  >        metadata->>'tamanho'         as bytes,
  >        metadata->>'agente'          as navegador
  >   from admin_logs
  >  where action = 'edge_function_error'
  >    and metadata->>'origem' = 'navegador'
  >  order by created_at desc limit 20;
  > ```
  >
  > Os motivos possíveis são fechados e cada um tem correção diferente: o
  > navegador não decodificou o arquivo · não soube dizer a duração · não expôs
  > as dimensões · estourou o teto de 15 s · devolveu quadros em branco · o
  > canvas recusou desenhar · nenhum salto completou. Ver
  > [MODERACAO-IA.md](MODERACAO-IA.md).
  >
  > **Só o dono do conteúdo consegue relatar**, porque o ramo fica depois da
  > checagem de dono da `moderate-image` — o volume fica preso ao ritmo de
  > publicação, e não ao que um estranho quiser mandar.

## Resiliência — quando o banco cai

O site detecta sozinho que perdeu o Supabase (projeto pausado por egress, por
restrição de serviço, ou de propósito), avisa e leva todo mundo para a landing
— a única página que **não depende do banco para nada**. Antes disso, pausar
exigia editar o código e escrever "projeto pausado" na landing à mão.

**O risco desta funcionalidade é o falso positivo**, não a detecção: derrubar o
site porque o wi-fi de alguém piscou seria pior que o problema. Quatro defesas
em `lib/dbHealth.js`, que instrumenta o `fetch` do cliente Supabase:

| Defesa | Por quê |
| --- | --- |
| Só falha de **infraestrutura** conta (`fetch` estourou, ou 5xx) | 4xx significa que o banco respondeu — é RLS ou erro de aplicação, e negar é normal aqui |
| **3 falhas seguidas**, e qualquer resposta boa zera | uma falha isolada não é queda |
| **Sondagem independente** antes de declarar | se alguém atender, foi instabilidade |
| Requisição **abortada** não conta | troca de tela cancela requisição o tempo todo |

Volta sozinho: já fora do ar, sonda a cada 20s.

O motivo da pausa (`site_config.pause_reason`, editável na aba Site) é lido
**enquanto há banco** e guardado no navegador — porque se o banco caiu, o motivo
não pode vir de lá. Pausa planejada mostra o motivo real; queda inesperada, ou
primeira visita, mostra texto genérico.

## Quando a Vercel recusa o deploy

> `Resource is limited - try again in 24 hours (more than 100, code:
> "api-deployments-free-per-day")`

**A primeira coisa a saber: o site NÃO caiu.** Deploy recusado não derruba
nada — a Vercel continua servindo a última versão que subiu. O que fica para
trás é só o commit novo.

**Como conferir o que está de fato no ar**, sem depender do painel (que mostra
o *commit*, e dois commits diferentes podem gerar um site idêntico):

```bash
npm run build
ls dist/assets/index-*.js                                   # hash local
curl -s https://gamerhub-nine.vercel.app/ | grep -oE 'assets/index-[^"]+\.js'
```

Hash igual = o que está no ar é o que a `main` produz, mesmo que o painel
mostre um commit antigo. Foi exatamente o caso em 23/08: três deploys
recusados, e o site correto, porque os commits recusados mexiam só em
documentação e Edge Function.

**Por que estourou, e o que impede de repetir:** `CLAUDE.md` §0.2. Em resumo,
a Vercel construía a cada push em qualquer branch. Agora:

| Camada | Onde | O que faz |
| --- | --- | --- |
| `git.deploymentEnabled` | `vercel.json` | a branch de trabalho não cria deploy nenhum |
| `ignoreCommand` | `scripts/vercel-ignore.sh` | na `main`, pula o build quando o commit não toca em `src/`, `public/`, `index.html`, config de build ou o próprio `vercel.json` |
| portão no CI | job `deploys` | reprova o PR se a branch não estiver desligada, ou se o script sumir |

São duas camadas de propósito: não está confirmado se um build **pulado** ainda
conta como deploy na cota diária, então a primeira camada impede o deploy de
ser criado e a segunda economiza build quando ele é.

**Ao criar uma branch nova**, acrescentar em `vercel.json`:

```json
"git": { "deploymentEnabled": { "nome-da-branch": false } }
```

O CI reprova o PR com essa instrução se esquecerem.

## Faxina agendada (`pg_cron`)

| Job | Quando | O que faz |
| --- | --- | --- |
| `cleanup-expired-posts` | de hora em hora | `cleanup_expired_posts()`: apaga lives com prazo vencido e **purga o que foi soft-deletado há mais de 30 dias** |
| `expire-lives` | a cada 5 min | tira o `is_live` de quem passou do prazo; apaga live encerrada há mais de 15 min |
| `expire-lives-every-minute` | a cada minuto | só o `is_live = false` do prazo vencido |
| `gamerhub-cleanup` | 04:00 | `cleanup_old_data()`: `admin_logs` 90d, notificação lida 30d, `login_attempts` não-permanente 30d, `live_chat` de live encerrada 7d |
| `gamerhub-cleanup-unconfirmed` | 04:30 | `cleanup_unconfirmed_signups()` |

**Onde ver se um job falhou:** `select * from cron.job_run_details order by
start_time desc limit 20;`. Não há alerta automático — o sintoma na tela vem
antes: live encerrada que não some do feed é o job de hora em hora parado.

> O `cleanup_expired_posts()` era uma Edge Function chamável por qualquer um da
> internet. Virou SQL e saiu da rede — ver `docs/SEGURANCA.md`.

## O painel de admin no navegador

`e2e/painel-admin.mjs` abre o `/admin` com uma conta de cargo `admin`, percorre
as sete abas e confere que a mesma conta é **negada** no `/owner`.

**Por que precisou de uma segunda conta:** o `fluxos.mjs` loga com `role='user'`
de propósito — é assim que ele prova que `/admin` e `/owner` são negados.
Promover aquela conta destruiria a prova. Sem uma conta separada, o painel
inteiro ficava sem cobertura de navegador — e foi ali que a moderação de
comentário ficou quebrada por meses.

**`[28/08]` Cobre também paginação e notificações.** Ele conta as linhas antes
e depois do "Carregar mais" — é o que separa *"o botão existe"* de *"o botão
funciona"* — e exige que a aba de Notificações mostre lista ou o texto de vazio.
As duas entraram porque são as partes que a migração do `useAdminData` para
React Query vai mexer, e nenhuma tinha teste: refatorar camada de dados às
cegas ali seria o pior lugar para começar.

**Somente leitura, e isso é decisão de segurança.** Uma conta `admin`
automatizada rodando em todo PR poderia ocultar post e suspender gente; num
teste que roda a cada push, "se der errado" é questão de tempo. As ações
destrutivas continuam validadas em transação com `ROLLBACK`, onde nada
sobrevive.

**A conta `[28/08]`:** `claudestaff`, cargo `admin`, promovida pela RPC
`owner_set_role` — e não por `UPDATE` cru, porque só a RPC grava em
`admin_logs`. Um update direto chegaria no mesmo lugar sem deixar rastro, e a
trilha passaria a mentir por omissão (`CLAUDE.md` §5).

**Se os secrets `E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD` sumirem**, o job se pula
— mas o job `qualidade` emite `::warning::` dizendo que o painel está sem
cobertura. Job que se pula em silêncio é verde que não testou nada.

## `[28/08]` Por que os testes de navegador não esperam `networkidle`

`networkidle` espera a rede ficar parada por 500 ms — e ela **nunca para**
quando um recurso de terceiro pendura. Aconteceu: `/community` estourou o
timeout de 20 s numa rodada e passou 13/13 na repetição, com o Google Fonts
inalcançável e o navegador retentando para sempre.

O estrago não é a lentidão. É que o vermelho apontava para a **rota**, quando o
defeito estava na **rede** — e teste que acusa o inocente ensina a ignorar
vermelho, que é o oposto do que ele existe para fazer.

A espera certa não é "a rede parou", é **"o conteúdo que eu vim conferir
apareceu"**. O `smoke.mjs` usa `domcontentloaded` e depois espera pelo regex da
própria rota. Se o conteúdo não vier, o timeout **não** estoura o teste: as
checagens seguintes produzem a mensagem precisa (`TELA BRANCA`, `guard levou
para X`, `sem o conteúdo esperado`), que diagnostica muito melhor que um
timeout cru.

## Quando a Vercel constrói, e quando não

`scripts/vercel-ignore.sh` decide. Ele pula quando a branch não é a `main`, e
quando o commit não toca em nada que vá para o navegador — documentação, SQL,
Edge Function, CI **e teste dentro de `src/`**.

**`[28/08]` A exclusão dos testes veio de um caso real:** o merge do PR #68
gastou um deploy de produção mexendo só em `src/lib/__tests__/`. Testes moram
em `src/`, mas o bundler nunca os inclui.

**Este é o único script do projeto onde errar não quebra nada visivelmente.**
Pular por engano deixa o site velho no ar em silêncio — sem erro, sem log, sem
teste vermelho. Por isso ele tem trava própria: `scripts/__tests__/` monta
repositórios git de verdade e confere as sete decisões. Ao acrescentar uma
exclusão nova, o teste tem que cobrir ela.

## Orçamento de bytes — o portão de desempenho

`scripts/orcamento-de-bytes.mjs` roda no CI e **reprova o PR** quando o site
engorda. Ele confere quatro coisas:

| O que | Teto | Por quê |
| --- | --- | --- |
| JS do carregamento inicial | 740 kB brutos / 222 kB gzip | é o que o navegador busca antes de pintar qualquer coisa |
| Qualquer chunk isolado | 320 kB | chunk de **rota** não aparece no `index.html` e escapa do teto acima — mas quem abre a página paga tudo |
| `LandingScene-*.js` existe | — | se o `lazy()` virar `import` estático, o chunk some e a cena 3D é absorvida pela rota |
| O HTML ainda é legível | — | se as expressões pararem de casar, ele sai com erro em vez de medir zero byte e aprovar |

**Mede byte, não tempo, de propósito.** Tempo de laboratório oscila com a
máquina: as duas medições de 27/08 discordaram **4×** no TBT sobre o mesmo site.
Portão que balança vira alarme falso, e alarme que grita à toa ensina a ignorar
o canal (`CLAUDE.md` §0.2). Byte é determinístico — o mesmo commit dá o mesmo
número em qualquer máquina.

**Ele não diz se o site está rápido.** Diz se ficou mais pesado, que é o que dá
para afirmar sem margem de erro. Para saber se está rápido, o Lighthouse no
mesmo aparelho e o Vercel Speed Insights (campo).

> **O histórico das medições — o que cada rodada mediu, o que ela desmentiu, e
> as duas vezes em que eu ia otimizar o lugar errado — está em
> [DESEMPENHO.md](DESEMPENHO.md).** Saiu daqui em 29/08 porque a seção passou de
> 150 linhas (§6.2 regra 5) e porque são dois trabalhos diferentes: aqui fica o
> **portão** que reprova o PR; lá, a **investigação** que decide onde mexer.

## Portão de qualidade automático

`.github/workflows/ci.yml`, a cada PR e push na `main`:

- `lint` (0 erros) · `npm test` · `build` · `npm audit --audit-level=high`
- **piso de <!--n:testes.piso-->445<!--/n--> testes** — o CI quebrando é o caso
  fácil, fica vermelho e alguém olha; o perigoso é ele **passar sem testar
  nada** (arquivo renomeado, `describe.skip` esquecido). Ao adicionar testes,
  subir o piso junto.

  > **`[02/09]` Três números para a mesma coisa, e nenhum conferia o outro.**
  > Este parágrafo dizia **168**, o `ci.yml` exigia **222** e a suíte tinha
  > **437**. Nenhum estava errado sozinho — o piso simplesmente parou de ser
  > subido, e o portão passou a tolerar que **215 testes sumissem em silêncio**,
  > que é exatamente o que ele existe para impedir.
  >
  > Os dois foram corrigidos, e o número acima agora é **lido do `ci.yml`** pelo
  > `npm run numeros`. Divergência entre o portão e o texto virou build vermelho
  > em vez de coisa que alguém precisa lembrar de comparar.
- job de **fumaça** (`e2e/smoke.mjs`) — as rotas num Chromium real, **como
  visitante**: cada uma monta sem exceção de JS e o `RequireAuth` redireciona
  para onde deveria. Só roda com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
  nas *Variables* do repositório; sem elas seria "0 rotas", falha que não diz
  nada sobre o código.
- **segredos** (`scripts/segredos-vazados.mjs`) — reprova o PR se algum arquivo
  rastreado tiver chave privada, `service_role`, token do GitHub ou senha em
  texto. Não procura a `anon key`: ela é pública por construção, e acusá-la
  seria alarme falso em todo PR. Existe porque `.gitignore` é convenção, não
  trava — e segredo vazado não se conserta apagando o arquivo: o repositório é
  público e a chave fica no histórico. O conserto é rotacionar no fornecedor.

- **portas do banco** (`e2e/portas-do-banco.mjs`, dentro do job de fumaça) —
  bate na REST API do Supabase **como um estranho sem conta** e reprova o PR se
  alguma porta saiu do lugar. Era a **única camada sem portão nenhum**: o
  `portas-fechadas` cobre Edge Functions, o resto lê `src/` e documentação.

  Confere as **duas direções**, e a segunda é a que falta em todo lugar:

  | Direção | O que pega |
  | --- | --- |
  | fechado continua fechado | `admin_logs`, `posts`, `moderation_queue`… e 8 RPCs privilegiadas |
  | **aberto continua aberto** | `site_config` e `blocked_words`, que a landing lê antes de qualquer login |
  | **`[02/09]` coluna a coluna, em `profiles`** | as 8 colunas pessoais em 401, e `id`/`username` legíveis — as duas direções, por coluna |

  A terceira linha entrou porque a primeira **dava verde honesto para a pergunta
  errada**: ela sondava `select=*`, `profiles` responde 401 a isso, e daí este
  documento e o `SEGURANCA.md` passaram a afirmar que "`profiles` responde 401 ao
  anônimo". Privilégio no Postgres é **por coluna** — `select=id,username`
  devolve as 5 linhas. Ver [SEGURANCA.md](SEGURANCA.md).

  A segunda existe porque [POSTURA.md](regras/POSTURA.md) registra **três quedas
  do site** causadas por correção de segurança legítima — revogar colunas de
  `profiles` parou post, comentário, mural e chat. Um portão que só olhasse a
  primeira direção aprovaria com prazer o revoke que derruba tudo.

  **O que ele não cobre, e está escrito no próprio arquivo:** é caixa-preta com
  a `anon key`. Não enxerga policy, `search_path` de `SECURITY DEFINER`, nem o
  que um usuário **logado** alcança. Responde uma pergunta só — *o que um
  estranho consegue?* — e responde bem.

- **mapa de arquivos** (`scripts/mapa-de-arquivos.mjs`) — reprova o PR se algum
  arquivo de `src/` não aparecer no `ARQUITETURA.md`. É a **outra direção** do
  portão de documentação quebrada: aquele pega documento citando arquivo que não
  existe; este pega arquivo que existe e nenhum documento cita. Faltava, e por
  isso o mapa chegou a não conhecer 80 arquivos — incluindo `lib/roles.js` e
  `lib/realtimeTables.js`, que são travas do projeto.
- **conteúdo visível** (`e2e/conteudo-visivel.mjs`, dentro do job de fumaça) —
  rola cada página pública numa janela de celular (412x830) e reprova se algo
  com tamanho real ficar em `opacity: 0`. Existe porque a `/sobre` subiu com os
  sete blocos invisíveis e **o smoke marcou OK**: ele procura texto, e
  `innerText` devolve o texto de um elemento invisível. Cobertura que não
  cobria (§1.5). A causa era de classe — `whileInView` com `amount: 0.25` num
  container mais alto que 4x a janela —, então a trava varre as páginas em vez
  de conferir aquela.
- job de **fluxos autenticados** (`e2e/fluxos.mjs`) — loga com uma conta
  descartável e percorre: todas as telas internas com conteúdo de verdade,
  `/admin` e `/owner` **negados** para `role = 'user'`, publicar → conferir no
  feed → apagar, e logout. Exige `E2E_EMAIL` e `E2E_PASSWORD` nos **Secrets**
  (senha é segredo, ao contrário da anon key). Só em PR: ele escreve no banco
  de produção. Quando falha, sobe `e2e-evidencia/` como artefato — screenshot,
  texto da tela e URL, senão o log diria só "timeout".

### A trava das Edge Functions bate na produção, e é de propósito

`e2e/portas-fechadas.mjs` (dentro do job de fumaça) manda cinco requisições de
abuso reais contra as Edge Functions e exige `401`/`410` em todas. São as
brechas fechadas em 23/08 — ver [`SEGURANCA.md`](SEGURANCA.md).

Por que produção e não uma varredura do código: **as Edge Functions não estão
no git**. Um teste que lê `src/` não protege nada delas — basta um deploy pelo
dashboard, ou uma versão antiga restaurada, e a porta reabre sem que uma linha
do repositório mude. Nenhuma das requisições tem efeito colateral: todas devem
ser recusadas.

A trava foi provada reimplantando a *forma* do bug (corpo inofensivo,
`verify_jwt` desligado, devolvendo 200) e conferindo que o teste acusou
`ABERTA` nomeando a função e o estrago que ela voltaria a permitir.

### As rotas dos testes ficam num arquivo só, com trava

`e2e/rotas.mjs` é a fonte única, e `src/lib/__tests__/rotasE2E.test.js` a
confronta com os `path=` do `App.jsx`. Existe porque a lista antiga tinha
**quatro caminhos que não existem** (`/home`, `/comunidade`, `/perfil`,
`/configuracoes`): as quatro caíam na tela de 404, o conteúdo esperado era
`/./`, e o teste imprimia "12/12 rotas OK" sem nunca ter aberto quatro delas.
Nenhum teste de runtime pega isso — do ponto de vista do navegador, a rota `*`
renderizou.

`.github/dependabot.yml`: PR semanal agrupado por patch/minor, teto de 3.
**Major fica de fora de propósito** — já quebrou o site uma vez (o upgrade do
react-router que motivou o teste de fumaça existir).

---


---

[← voltar para o README](../README.md)

---

## `[29/08]` `npm run fim` — o fechamento de sessão

O CI só enxerga o que já foi **empurrado**. Ele nunca soube dizer se sobrou
trabalho não commitado, commit não empurrado, arquivo que passou de 300 linhas,
ou contador do backlog divergindo da contagem real. Essas quatro coisas só
existiam na memória de quem estava trabalhando — e memória foi exatamente o que
falhou em 29/08.

`scripts/fim-de-sessao.mjs` roda build, lint, testes e os portões, **e** as
quatro conferências acima. Ele reprova com a lista do que falta.

Não é CI de propósito: o CI roda no PR, e o problema que ele resolve acontece
**depois** do PR — no momento de encerrar. Rodar antes de fechar a sessão é
obrigação escrita no `CLAUDE.md` §6.3.

**O que ele NÃO verifica, e diz isso na tela.** Ele cobre 6 dos 13 itens da
definição de pronto. Os outros sete são de julgamento — incluindo *"pensei em
como abusar disto"* — e nenhum comando responde por eles. Ele os imprime como
perguntas, e termina avisando que verde ali não quer dizer pronto. Portão que
finge medir julgamento é falsa confiança, e falsa confiança cega igual a
silêncio (§0.2).

### `[30/08]` O teste do painel dependia de existir dado em produção

Ele reprovou com o site **legitimamente vazio**: o dono esvaziou a lixeira
(`admin_permanent_delete_all`, 20 posts), o painel passou a mostrar "Nenhum post
ativo" — funcionando perfeitamente — e o teste caiu porque exigia encontrar ao
menos uma linha de post.

**Por que a exigência existia:** o seletor de linhas já contou zero em silêncio
por meses, e o ramo "sem botão de paginar" registrava isso como sucesso. Aceitar
zero de graça reabriria esse buraco.

**A saída foi separar as duas causas de zero**, perguntando ao próprio painel:

| O painel diz | Há linha? | Veredicto |
| --- | --- | --- |
| N > 0 | não | **falha** — o seletor quebrou (a trava original) |
| 0 ou nada, com "Nenhum post ativo" na tela | não | passa — o site está vazio |
| nada, e sem estado vazio | não | **falha** — a aba não renderizou |

Assim a trava continua pegando regressão de seletor sempre que houver dado, e
deixa de gritar à toa quando não houver (§0.2, 4ª regra).

---

## `[01/09]` Banco fora do ar: o que continua de pé, e o que para

O desenho antigo **sequestrava o app**: `if (semBanco) return <OfflineGate />`
acima do `<Routes>`. Três defeitos saíam daí, e o dono relatou os três:

| Sintoma | Causa |
| --- | --- |
| não dava para ir em "Sobre" nem "Login" | sem `<Routes>` montado, nenhuma rota existia — e as duas **não precisam do banco** |
| "vai redirecionar" e não redirecionava | o `navigate('/')` já tinha rodado no primeiro efeito; a contagem descrevia algo que **já havia acontecido** |
| tela cheia a cada reload | aviso ocupando tudo vira estorvo, não informação |

**A regra que ficou:** fora do ar bloqueia **só o que depende do banco**.

| Parte | Sem banco |
| --- | --- |
| Landing, `/sobre` | de pé — conferido: não importam o cliente Supabase |
| `/login` | aparece e explica, em vez de sumir |
| Rotas internas | barradas pelo `RequireAuth`, que já existia para isso |
| Raiz com sessão | mostra a landing: o feed é consulta pura |

O aviso virou faixa fina (`ui/AvisoSemBanco.jsx`), sem contagem mentirosa. Ela
some sozinha quando o `dbHealth` reconecta (tentativa a cada 20 s).

### O que a investigação mediu, e mudou o teste

**Um visitante na landing faz ZERO requisições ao Supabase.** A página é
estática e, sem sessão salva, nem a resolução de auth vai à rede. Consequência
prática: para quem só está lendo, **a faixa não aparece — e está certo**, porque
nada está quebrado para essa pessoa.

Isso invalidou a primeira versão da trava: ela nunca alcançava o estado que
dizia testar, e passava **mesmo com o bug reinjetado**. Hoje `e2e/sem-banco.mjs`
força o estado de verdade com quatro tentativas de login contra o host
bloqueado, e reprova nomeando a causa.

---

## `[02/09]` O portão de documentação passou a ver TODOS os documentos

Cobrança do dono: *"os gatilhos têm que ser feitos para cada documentação do
projeto, nenhum deles pode passar, inclusive o `CLAUDE.md`"*.

Ele estava certo, e havia **dois** buracos:

| Buraco | O que significava |
| --- | --- |
| `CLAUDE.md` e `BACKLOG.md` tinham território **vazio** | estavam na lista só para não serem acusados de "não mapeados" — **nunca eram conferidos** |
| o varredor lia só `docs/` no primeiro nível | **`docs/regras/` era invisível** — e é lá que moram os splits do `CLAUDE.md` |

Ou seja: os cinco arquivos que **comandam todo o resto** eram exatamente os que
ninguém vigiava.

**O território deles não é "o código que descrevem"** — é o **mecanismo que os
cumpre**. Uma regra sobre banco envelhece quando o portão do banco muda; uma
regra sobre documentação envelhece quando os portões de documentação mudam.

**Achou na primeira execução:** o `CLAUDE.md` estava **7 commits de código**
atrás, e a tabela de mecanismos do §6.3 listava **3** dos **10** que existem
hoje. Corrigida no mesmo PR.

---

## `[02/09]` A pergunta que os três portões de documentação não faziam

Cobrança do dono, no mesmo dia: *"toda a documentação do projeto, não falo
algumas, todas! todas devem estar atualizadas, e em uma única sessão"* — depois
de eu achar que `docs/regras/AUDITORIA.md` afirmava *"131 arquivos / 14.362
linhas"* num projeto de <!--n:src.arquivos-->304<!--/n--> arquivos e
<!--n:src.linhas-->29.133<!--/n--> linhas.

**Os três portões existentes aprovaram aquilo, e cada um por um motivo
diferente** — o que prova que não era descuido de nenhum deles, e sim uma
pergunta que ninguém fazia:

| Portão | Por que passou |
| --- | --- |
| "o PR tocou documentação?" | tocou, sempre — só nunca a linha errada |
| `documentacao-quebrada` | os arquivos citados **existiam**; o número é que não |
| `documentacao-envelhecida` | conta **commits**, não confere afirmação |

Os três olham **nomes de arquivo**. Nenhum lê o que o texto **afirma**.

### Os quatro mecanismos que entraram

| Comando / portão | Pergunta que ele faz | Reprova? |
| --- | --- | --- |
| `npm run numeros` (`--check` no CI) | os números escritos batem com o projeto? | **sim** |
| `scripts/territorio-coberto.mjs` (CI) | toda parte do sistema tem documento responsável? | **sim** |
| `npm run docs` | que documento **esta sessão** tornou suspeito? | não — é lista de leitura |
| `npm run docs -- --tudo` | o estado de todos, por idade | não |

**Como o número deixa de envelhecer.** O documento escreve o valor dentro de um
comentário HTML — `<!--n:src.arquivos-->304<!--/n-->` —, invisível no markdown
renderizado. O script mede o projeto e reescreve o miolo; no CI ele confere e
reprova. Chave desconhecida é **erro**, não silêncio: um typo faria aquele
número nunca mais ser atualizado, com o agravante de **parecer vigiado**.

**Por que marcador explícito e não varredura de "N linhas".** Porque o
histórico legítimo — *"918 → 197 linhas"* — precisa continuar congelado.
Portão que grita no lugar certo pelo motivo errado vira ruído (§0.2, 4ª regra).

### O que a cobertura de território achou na primeira execução

Três caminhos apontando para arquivos que não existem mais, e o pior deles é
instrutivo: `src/lib/resolucaoDaCena.js` foi **apagado no PR #105** e a entrada
sobreviveu ao arquivo. Como o relatório pula caminho inexistente, o
`DESEMPENHO.md` ficou **meio vigiado** desde então, sem nada acusar.

E o buraco que originou o portão: `src/components/privacidade/` — onde mora o
**texto da política de privacidade** — não tinha dono. O PR #140 reescreveu o
bloco de retenção e os três portões aprovaram uma mudança em documento legal
sem pedir que a documentação acompanhasse.

### O que estes quatro NÃO fazem

Nenhum deles responde *"este parágrafo em português ainda é verdade?"*. Essa
continua sendo leitura humana, e é por isso que `npm run docs` existe: em vez de
mandar reler <!--n:docs.linhas-->9.460<!--/n--> linhas por precaução — o que
custa contexto e, por custar, acaba não acontecendo —, ele diz **quais** abrir e
**o que mudou embaixo de cada um**.
