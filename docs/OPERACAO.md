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


### `[03/09]` Os três bugs de pausa/offline — o estado de cada um

O dono pediu para conferir três coisas que ele relatou antes e não tinha
testado. O levantamento foi feito no código e nos commits, não de memória:

| O que ele relatou | Estado | Onde |
| --- | --- | --- |
| redirecionado antes do contador chegar a zero | ✅ **resolvido** | PR #126 |
| a mensagem personalizada não funcionava | ✅ **corrigido em 03/09** | `MaintenancePage` |
| "banco fora do ar" → "algo deu errado" → tela do navegador | ⚠️ **2 de 3** | `ErrorBoundary` |

#### O contador: resolvido por REMOÇÃO, e a distinção importa

Ele não passou a contar direito — ele **deixou de existir**. A mensagem
prometia um redirecionamento que o `navigate('/')` do primeiro efeito já tinha
feito; a contagem descrevia o passado e no fim só sumia.

#### A mensagem personalizada: o campo existia e morria na tela

`MaintenancePage` tinha o texto **cravado**. O `pause_reason` era escrito no
painel do owner, salvo no `site_config`, lido pelo `Layout` e guardado no
navegador — e a tela nunca o consultava.

**Nada quebrava**, e é isso que fez o bug durar: a pausa funcionava, a tela
aparecia, o texto era razoável. Só era o texto errado. É a classe de falha que
produz um resultado **plausível**, e por isso ninguém desconfia.

Agora ela chama `motivoDaPausa()`, que resolve os dois cenários — pausa
deliberada lê do banco, queda inesperada lê a cópia do navegador — e nunca
devolve vazio.

#### A corrente de três mensagens: a do meio era mentira

| O que aparecia | Quem mostrava | Era verdade? |
| --- | --- | --- |
| "sem acesso ao banco" | `AvisoSemBanco`, via `dbHealth` | **sim** |
| "Algo deu errado" | `ErrorBoundary` | **não** — nada deu errado no site |
| página de offline | o navegador | sim, mas é outro assunto |

A segunda é o §1.5 na letra: *"toda mensagem de erro tem que ser verdadeira"*.
Ela manda a pessoa achar que o site quebrou, e manda quem investigar procurar
bug onde não há nenhum. O Wi-Fi caiu.

O `ErrorBoundary` passou a classificar, por `lib/ehFalhaDeRede.js`, e a mostrar
**"Sem conexão"** — com o conselho certo: esperar a conexão e tentar de novo
**sem recarregar**, porque recarregar offline é o que produz o terceiro elo.

**E queda de rede deixou de ir para o Sentry.** Não é economia de cota — é
qualidade do sinal: o Sentry existe para dizer que o SITE quebrou, e Wi-Fi
caindo no celular de quem usa não é defeito nosso. Mesma lição do
`edge_function_error` de 27/08, onde 68 de 68 linhas eram ruído.

> **A trava vigia os DOIS lados, e o segundo é o que mais importa.** Um bug de
> verdade classificado como "sem conexão" deixaria de ir para o Sentry e a tela
> mandaria a pessoa esperar a internet — o bug ficaria invisível dos dois lados.
> `TypeError` é o que o `fetch` lança **e** o que um `undefined.map()` lança, e
> por isso o tipo sozinho não decide nada: seis mensagens de bug real estão
> travadas como NÃO-rede.
>
> `navigator.onLine` entra como **reforço, não resposta**: `false` prova
> offline, mas `true` continua verdadeiro com Wi-Fi ligado num roteador sem
> internet.



### `[03/09]` O que o print do dono mostrou, e a regressão que EU criei

Depois do conserto acima ele testou com o banco pausado e relatou quatro coisas.
Reproduzi as quatro num navegador de verdade, com o host do Supabase bloqueado
e uma sessão salva — a condição do celular dele.

| O que ele viu | Causa REAL |
| --- | --- |
| a mensagem personalizada virou genérica | `pause_reason` só era buscado dentro do `Layout`, **que nunca monta na landing** |
| a faixa tampa o menu | a faixa era `sticky`; os cabeçalhos são `fixed` — `sticky` empurra irmãos no **fluxo**, `fixed` é posicionado pela **janela** |
| clicar em ENTRAR recarrega | ver abaixo — era consequência do erro que a árvore inteira sofria |
| a landing precisa estar acessível | ela estava de pé; o que não dava era **navegar** nela |

#### A hipótese que a reprodução DESMENTIU

Eu achei que a consulta falhando chamava `guardarMotivoDaPausa(undefined)` e
**apagava** a cópia guardada. Testei: o cache sobrevive. Se eu tivesse
"consertado" isso, teria mexido no lugar errado e o defeito continuaria.

E o meu primeiro teste ainda **mascarava** o efeito: o `addInitScript` do
Playwright reescreve a chave a cada navegação, então o cache "sobrevivia" porque
eu o reescrevia. Tive que refazer o teste antes de confiar nele.

#### A regressão que eu criei, e como ela apareceu

Ao mover a busca para o topo, chamei o hook em **dois** lugares — `AppRoutes` e
`Layout`. Os dois criavam o canal de realtime com o mesmo nome, e o Supabase
recusa:

```
cannot add `postgres_changes` callbacks for realtime:config_do_site
after `subscribe()`
```

A árvore inteira estourava e o `ErrorBoundary` mostrava **"Algo deu errado"**.
Ou seja: eu tinha acabado de reproduzir, sozinho, o sintoma que ele relatou.

**Como eu soube que era minha e não dele:** rodei o mesmo teste num clone da
`main`, isolado. Lá a landing renderiza normal. Sem essa comparação eu teria
"consertado" um bug que eu mesmo tinha acabado de introduzir.

A correção é uma leitura só, num provedor no topo. Nomear os canais de forma
diferente esconderia o problema e pagaria duas assinaturas de realtime pela
mesma pergunta (§6.1).

#### O contrato que ficou: `--altura-do-aviso`

A faixa publica a própria altura numa variável CSS; cada cabeçalho fixo lê
`top: var(--altura-do-aviso, 0px)`, e o `#root` ganha o mesmo `padding-top`. O
padrão `0px` é o que garante que, **sem** faixa, nada muda — descer os fixos sem
ela na tela abriria um buraco no topo.

`ResizeObserver` e não número fixo: a frase quebra em duas linhas no celular e
uma no desktop.

#### A trava, e a versão dela que passava no VAZIO

`e2e/sem-banco.mjs` passou a exigir que, **com a faixa na tela, nenhum cabeçalho
fixo fique coberto**. É a regra, não um botão específico — continua valendo
quando surgir um cabeçalho novo.

> **A primeira versão dela dizia "0 cabeçalhos fixos" e passava.** Ela rodava no
> `/login`, que não tem cabeçalho fixo: verificava nada com ar de aprovada. Hoje
> ela **reprova** quando não encontra nenhum, e forja uma sessão para alcançar a
> landing — que é o único lugar onde a faixa e um cabeçalho fixo coexistem.
>
> Provada reinjetando o bug: `faixa: 65px · cobertos: [{"tag":"NAV","top":0}]`.

**O terceiro elo continua aberto**, e está no `BACKLOG.md` como decisão: só um
Service Worker resolve, e ele erra caro (cache velho servido para sempre).
Minha recomendação registrada é não fazer agora.
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
- **piso de <!--n:testes.piso-->470<!--/n--> testes** — o CI quebrando é o caso
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
- **`[04/09]` artes da tela de entrada** (`e2e/artes-da-arena.mjs`, dentro do job
  de fumaça) — desenha cada lutador do login num canvas e conta pixels da cor do
  adversário na borda que encosta na fenda. Zero é o esperado; o limite é 30,
  para ruído de croma do WebP.

  Existe porque as duas artes chegam como **uma imagem com os dois lutadores** e
  precisam ser recortadas — e eles se sobrepõem por 75 colunas, então corte em
  reta sempre leva um pedaço do outro junto. Quem viu o defeito foi o dono, no
  celular; nenhum portão via, porque o orçamento de bytes mede JS e CSS e não
  olha imagem. Reinjetando o recorte antigo, ele acusa 638 pixels invasores.

  Roda num navegador de propósito: assim mede **a arte que o site serve**, a que
  o `srcset` escolheu, e não o arquivo da pasta. O terceiro passo confere que
  login e cadastro servem pares **diferentes** — se o `modo` parar de chegar no
  componente, as contagens continuariam zeradas e ninguém notaria.
- job de **fluxos autenticados** (`e2e/fluxos.mjs`) — loga com uma conta
  descartável e percorre: todas as telas internas com conteúdo de verdade,
  `/admin` e `/owner` **negados** para `role = 'user'`, **o fundo decorativo
  estando dentro da janela**, publicar → conferir no feed → apagar, e logout. Exige `E2E_EMAIL` e `E2E_PASSWORD` nos **Secrets**
  (senha é segredo, ao contrário da anon key). Só em PR: ele escreve no banco
  de produção. Quando falha, sobe `e2e-evidencia/` como artefato — screenshot,
  texto da tela e URL, senão o log diria só "timeout".

#### `[03/09]` A decoração precisa estar DENTRO DA JANELA, não só no DOM

Esta trava nasceu de uma falha de três rodadas, e ela é sobre **método**, não
sobre CSS.

O dono relatou **três vezes** *"não estou vendo as peças de videogame"*. As duas
primeiras respostas minhas foram calibragem de opacidade — as duas erradas.
A causa real era outra: `.peca-de-jogo` não tinha `top`, então cada peça nascia
no topo do container e a animação a empurrava para fora por cima. Medido depois:
**3 de 4 fora da tela no instante zero, as quatro em 3 segundos**.

**Por que eu não vi nas duas primeiras:** eu conferia num recorte HTML meu que
usava `animation: none` para fotografar as peças paradas. Eu testava a aparência
**desligando exatamente o que estava quebrado**. O `CLAUDE.md` §1.2 manda parar
depois de duas tentativas e **instrumentar** — eu não parei.

**Por que nenhum portão pegou.** Não é erro de JavaScript, não é rota fora do
ar, não é texto ausente, não é byte a mais. É decoração que **existe no DOM** e
não está onde alguém possa ver — o §1.5 na forma mais silenciosa que há. O
`conteudo-visivel.mjs` faz a pergunta parecida (*algo com tamanho real está em
`opacity: 0`?*), mas só nas páginas públicas: ele não tem sessão.

A trava roda dentro do `fluxos.mjs`, que já está logado, e faz a única pergunta
que importa: **quantas `.peca-de-jogo` estão dentro da janela?** Zero reprova, e
a mensagem conta a história para quem esbarrar nela daqui a seis meses.

> **O que ela não cobre, dito antes que alguém confie demais:** ela prova que a
> peça está na janela, não que está *visível a olho nu*. Uma peça a
> `opacity: 0.01` passaria. Para isso o critério continua sendo humano — e é
> justamente por isso que o número de opacidade agora está medido e escrito no
> `PecasFlutuantes.jsx`.

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


### `[03/09]` O terceiro estado: commitado, empurrado — e **nunca mergeado**

Os dois checks de git respondiam *"commitei?"* e *"empurrei?"*. Faltava a
terceira, que é a única que o dono enxerga: **chegou na main?**

**O caso.** O conserto do fundo do site logado ficou pronto, commitado e
empurrado — e o PR ficou aberto. O dono relatou **três vezes** que não via a
mudança, e nas três eu olhei o meu diff (certo) em vez da produção (com a versão
antiga). Só na terceira eu li o CSS que estava no ar:

```
.peca-de-jogo{ … position:absolute }   <- a versao bugada, no ar
luz-da-arena          0 ocorrencias
```

`npm run fim` dava **verde** nos dois checks e em todo o resto. Nada acusava,
porque ninguém fazia a pergunta — e o §8 é explícito: abrir o PR **e mergear**
são obrigação minha.

**Como ele responde sem API nem token:** `git merge-base --is-ancestor HEAD
origin/main`. Se o HEAD ainda não está contido na main, sobrou entrega.

> **Commitado e empurrado NÃO é entregue.** É a mesma família do §1.5, aplicada
> ao meu próprio processo: o trabalho existia, estava correto, e o mundo lá fora
> continuava com o bug — sem nada gritar de nenhum lado.

Provada: com um commit fora da main ele reprova nomeando o commit; sem, dá
verde.
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

### `[03/09]` Com o projeto PAUSADO, quem tinha sessão salva ficava preso

Relato do dono com o projeto em `INACTIVE` (conferido): *"ainda não consigo
entrar na área de login e cadastro, vc fez isso de propósito?"*. A resposta
honesta é **em parte**: barrar rota interna é deliberado; prender fora do login
não era.

**O mecanismo, reproduzido com controle.** `supabase.auth.getSession()` lê a
sessão do `localStorage` **sem tocar na rede**, então `user` fica preenchido
mesmo com o projeto pausado:

    clica em "Entrar" -> /login -> GuestOnly vê `user` -> manda para /
    em / o HomeOrLanding vê `semBanco` -> mostra a landing
    a landing oferece "Entrar" ------------------------> volta ao começo

| | com sessão salva | sem sessão salva |
| --- | --- | --- |
| clicar em "Entrar" | fica em `/`, sem formulário | vai para `/login` |
| `/login` direto | volta para `/` | abre normal |

**É deriva entre portões que precisam concordar** (§6 FASE 4) — dois sabiam do
banco e um não:

    HomeOrLanding ... user && !semBanco -> área logada
    RequireAuth ..... !user || semBanco -> manda para /
    GuestOnly ....... user             -> manda para /   <- não sabia

A regra em uma frase: **sem banco, o site trata todo mundo como visitante.** Uma
sessão que não pode ser conferida e não abre nenhuma página interna não é um
login utilizável — é um dado velho no navegador.

**E a tela de login passou a dizer a verdade** (`auth/LoginSemBanco.jsx`). Sem
banco, o formulário sai e entra a explicação: entrar e cadastrar dependem do
servidor de autenticação, que cai junto. Deixar o botão ali seria oferecer algo
que não pode funcionar, e o erro de um `fetch` que não completa não distingue
"senha errada" de "site fora do ar" — a mensagem falsa que o §1.5 proíbe. O
estado do formulário fica no `Login.jsx`, então o que já foi digitado volta
quando o banco responde.

> **A trava anterior APROVAVA este bug, e a forma se repete.** O passo do
> `e2e/sem-banco.mjs` era `if (!/entrar|senha/i.test(texto))`. Com sessão salva
> o `GuestOnly` mandava `/login` de volta para `/`, a landing aparecia — e a
> landing tem um botão escrito **ENTRAR**. A expressão casava e o teste dava
> verde. Hoje ele clica no botão como uma pessoa faria e confere o **endereço**
> depois do clique.
>
> **E a sessão forjada precisava ser um JWT bem formado.** A primeira gravava
> `access_token: 'e2e'`; o cliente Supabase descarta um token que não decodifica,
> `user` ficava nulo, e o teste rodava como visitante puro — desligando
> exatamente o que deveria medir. Foi por isso que este defeito sobreviveu ao PR
> #148, onde eu o registrei como *"não reproduzi"*.

### `[03/09]` Com o projeto PAUSADO, o CI fica vermelho — e o que isso quer dizer

**Três jobs não têm como passar com o Supabase em `INACTIVE`**, e é bom saber
qual é qual antes de sair procurando bug no código:

| Job | Por quê | Dá para consertar em código? |
| --- | --- | --- |
| `fluxos autenticados` | precisa **entrar** no site; o servidor de auth está fora | não — precisa do projeto ativo |
| `painel de admin num navegador` | idem, com a conta de staff | não |
| `rotas num navegador de verdade` | as duas travas de porta batem no gateway | **a mensagem, sim** — e estava errada |

**O alarme que mentia, e era o pior lugar possível para isso.** Com o projeto
pausado o gateway responde **HTTP 540** a tudo. Como 540 não estava em nenhuma
lista de status esperados, `e2e/portas-fechadas.mjs` acusava **as cinco portas
de uma vez** e escrevia *"alguém reimplantou uma Edge Function sem a checagem de
quem chama"*. Nada disso tinha acontecido: as funções nem chegaram a rodar.

Uma acusação de porta de segurança reaberta é justamente a que mais precisa ser
levada a sério quando aparecer de verdade — gastá-la num falso positivo é o
defeito do §0.2 (4ª regra) no lugar mais caro.

`e2e/portas-do-banco.mjs` tinha a mesma classe de defeito, em dois disfarces: o
`fetch` estourando subia como `TypeError: fetch failed` cru, e um 540 num
`select` que deveria dar 401 seria relatado como **"LEITURA ABERTA"**.

**Os dois passaram a sair com código 2 (ambiente), como este arquivo já fazia
para queda de rede.** O CI continua **vermelho** — não dá para afirmar que as
portas estão fechadas sem conseguir bater nelas —, mas o motivo passa a ser
*"não foi verificado"*, e não *"foi verificado e está aberto"*.

> **Quando o CI reprovar assim, a primeira conferência é o estado do projeto**,
> não o código: `status` do projeto no painel da Supabase, ou pela MCP. Se
> estiver `INACTIVE`, reativar e repetir o CI é o caminho inteiro.

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
linhas"* num projeto de <!--n:src.arquivos-->319<!--/n--> arquivos e
<!--n:src.linhas-->30.850<!--/n--> linhas.

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
comentário HTML — `<!--n:src.arquivos-->319<!--/n-->` —, invisível no markdown
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
mandar reler <!--n:docs.linhas-->10.832<!--/n--> linhas por precaução — o que
custa contexto e, por custar, acaba não acontecendo —, ele diz **quais** abrir e
**o que mudou embaixo de cada um**.
