# Operação

> O que fazer quando algo quebra, e o que o projeto faz sozinho para avisar que
> quebrou. Este é o arquivo para abrir num aperto.

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

## Portão de qualidade automático

`.github/workflows/ci.yml`, a cada PR e push na `main`:

- `lint` (0 erros) · `npm test` · `build` · `npm audit --audit-level=high`
- **piso de 168 testes** — o CI quebrando é o caso fácil, fica vermelho e
  alguém olha; o perigoso é ele **passar sem testar nada** (arquivo renomeado,
  `describe.skip` esquecido). Ao adicionar testes, subir o piso junto.
- job de **fumaça** (`e2e/smoke.mjs`) — as rotas num Chromium real, **como
  visitante**: cada uma monta sem exceção de JS e o `RequireAuth` redireciona
  para onde deveria. Só roda com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
  nas *Variables* do repositório; sem elas seria "0 rotas", falha que não diz
  nada sobre o código.
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
