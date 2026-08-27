# 📋 Backlog

> **Isto é um checklist, não um diário.** Só o que falta fazer.
>
> - O que foi **decidido** ou **descartado** vai para [`docs/DECISOES.md`](docs/DECISOES.md).
> - O que já foi **feito sai daqui.** O PR, o `git log` e os relatórios em
>   `db/AAAA-MM-DD-*.md` guardam o histórico — repetir aqui só faz a lista
>   inchar até ninguém conseguir ler.
> - Toda linha leva **data** `[DD/MM]` de quando entrou. Sem data não dá para
>   ver o que envelheceu.
>
> Prioridade: 🔴 crítico · 🟠 importante · 🟢 recomendado · 🔵 futuro

**Última conferência contra o sistema:** 27/08/2026 · **20 itens abertos**
(+ 1 ideia sem compromisso)

> **Próximo da fila.** As duas cotas que estouravam em silêncio (`CLAUDE.md`
> §0.2) foram fechadas em 27/08. **Do dono** sobraram três ações de painel:
> apagar o Deploy Hook da Vercel (é uma URL-senha colada num chat), ligar o
> alerta de cota do Sentry, e trocar a senha da conta de teste.
>
> **Do que é meu e não depende de decisão sua**, o mais alto é a mentira do
> `register_login_attempt` (abaixo): o contador de login não protege contra
> força bruta e deixa qualquer um gerar alerta falso de segurança.

---

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[23/08]` **Trocar a senha da conta de teste.** Ela foi combinada por chat
  e ficou no histórico da conversa. Conta descartável e sem privilégio, então
  não é urgente — mas é higiene. **Ao trocar, atualizar o secret
  `E2E_PASSWORD`** no repositório, senão o job de fluxos passa a falhar.
- ⬜ `[23/08]` **Usuário banido não tem canal para pedir revisão.** A
  `BannedScreen` mostra o motivo e desloga em 6s: sem botão, sem formulário,
  sem contato. `request_unban` exige `role = 'admin'`, ou seja, só um admin
  abre o pedido em nome de outra pessoa — coerente com a hierarquia, mas deixa
  o banido sem saída. *Mexe em quem pode chamar a RPC: pede aprovação antes.*
- ⬜ `[22/08]` **Proteção contra senha vazada (HIBP).** Só no plano Pro
  (~US$25/mês). Decisão de custo.
- ⬜ `[21/08]` **Migração para TypeScript.** Grande, decisão do dono.
- ⬜ `[27/08]` 🟡 **Apagar o Deploy Hook da Vercel.** *Settings → Git → Deploy
  Hooks → apagar o `github`.* Ele é uma **URL-senha**: quem tiver o link
  dispara deploy sem login nenhum, e queima os 100/dia. O link foi colado no
  chat em 27/08, então está num histórico de conversa. É redundante — a
  integração nativa (`Connected May 16`) já faz o trabalho — e era ele o
  causador dos deploys duplicados. Apagar resolve as duas coisas.
- ⬜ `[27/08]` **Ligar o alerta de cota do Sentry.** *Settings → Subscription →
  notificações de uso, ou Alerts → quota.* Ele manda email ao se aproximar dos
  5.000 eventos/mês. O teto por sessão (`lib/tetoDeEventos.js`) já impede o
  caminho realista de estourar — a rajada — mas **esgotamento gradual não tem
  solução em código**: saber que a cota acabou exige perguntar ao Sentry, e isso
  exigiria um token de API no CI. Ver [DECISOES.md](docs/DECISOES.md).
- ⬜ `[24/08]` **Decidir se eu ganho contas de teste com cargo.** Hoje só
  tenho `claudetester` (`user`), e é de propósito: o E2E usa justamente ela
  para provar que `/admin` e `/owner` são **negados**. Promover essa conta
  quebraria essa prova. O que falta decidir é criar contas **separadas** —
  ver o motivo e o risco em [DECISOES.md](docs/DECISOES.md).

## 🟠 Importante — dá para fazer

- ⬜ `[27/08]` 🟡 **O contador de login promete o que não entrega, e é abusável.**
  Achado ao responder "onde está o rate limit?". **Medido, não deduzido:**

  | Teste | Resultado |
  | --- | --- |
  | 3 logins com senha errada direto no GoTrue | contador continua **zero** |
  | 5 chamadas anônimas a `register_login_attempt` | conta marcada como **bloqueada** |

  A RPC é chamável por `anon` (precisa ser — a página de login não está
  autenticada) e **incrementa sem verificar se o login falhou de verdade**. Ou
  seja: **não protege contra força bruta** (quem ataca vai direto no
  `/auth/v1/token`, que tem rate limit próprio do Supabase) e **deixa qualquer
  um gerar alerta falso** de "conta bloqueada" para qualquer email.

  **O que NÃO é:** não tranca ninguém fora. Uma sessão anterior já mitigou isso
  colocando o login *antes* da checagem de bloqueio — **verificado**: conta
  marcada como `blocked` e o dono entrou com a senha certa (HTTP 200).

  **O que sobra:** poluição de `admin_logs` e `admin_notifications` com alertas
  de segurança fabricados. Mesma classe do `edge_function_error` — fadiga de
  alarme (`CLAUDE.md` §0.2).

  **Duas saídas, e a segunda é a certa:**
  1. limitar o alerta a um por hora por email, como fizemos na trilha (rápido);
  2. **Password Verification Hook** do Supabase — o GoTrue avisa o banco a cada
     verificação de senha, e aí o contador passa a ser verdade. É a arquitetura
     correta e faz o mecanismo cumprir o que promete.

  *Mexe em auth: §7 🟡, pede aprovação.*

- ⬜ `[23/08]` **Migrar o envio de email para fora do Gmail pessoal.** Hoje usa
  nodemailer com uma conta Google dedicada — melhor que a conta pessoal, mas o
  limite (~500/dia), o risco de o Google travar por envio automatizado, e a
  falta de painel de entrega continuam. Com domínio próprio (~R$40/ano) +
  Resend vira `nao-responda@…`; sem domínio, o Brevo é a opção. *Não é urgente
  com 3 usuários.*

## 🟢 Recomendado

- ⬜ `[23/08]` **Medir prints de jogo no `violence/graphic`.** O piso está em
  0.80, escolhido sem dado. Como esse caminho **só enfileira e nunca oculta**,
  errar gera fila maior — não censura. Por isso deixou de ser pré-requisito.
- ⬜ `[22/08]` **Migrar `Admin.jsx` para React Query.** Resolveria de verdade os
  `exhaustive-deps` suprimidos. **Continua travado:** o E2E autenticado usa
  conta comum de propósito (é assim que ele prova que `/admin` é negado), então
  o painel segue sem cobertura de navegador. Destravaria com uma segunda conta
  de teste, com cargo de admin — decisão pendente, porque uma conta de staff
  automatizada é superfície de ataque nova.
- ⬜ `[27/08]` **O smoke test é instável no `networkidle`.** Numa rodada local,
  `/community` deu timeout de `page.goto`; na repetição, 13/13. **Não é
  regressão** — a falha não foi exceção de JS, e outras 10 rotas que
  renderizam a mesma landing passaram na mesma rodada. *Hipótese:* neste
  sandbox o Google Fonts é bloqueado, o navegador retenta, e o `networkidle`
  nunca acha a rede parada. **No CI não apareceu** em nenhuma execução desta
  semana, o que é consistente com a hipótese. Se um dia aparecer lá, trocar
  `networkidle` por `domcontentloaded` + espera por seletor. Teste que falha
  sem motivo ensina a ignorar vermelho — por isso está anotado e não esquecido.
- ⬜ `[20/08]` **Denúncia criada não gera log de auditoria.** Decisão consciente
  (qualquer um denuncia, e logar inflaria a trilha) — reavaliar se a moderação
  sentir falta. Ver [DECISOES.md](docs/DECISOES.md).
- ⬜ `[22/08]` **Moderação de vídeo.** Adiada a pedido, **e não é cara**: dá
  para extrair frames com `<video>` + `canvas` no navegador e mandar pela
  moderação de imagem que já existe. Custo zero, e herda de graça a cobertura
  de gore e automutilação.

## 🔵 Só quando o volume crescer

> Nenhum destes é dívida. São decisões **corretas para 3 usuários** que deixam
> de ser corretas em outra escala. Registrados para não serem redescobertos
> como se fossem problema.

- ⬜ `[jun]` **RPC de engajamento agregado.** `attachEngagement` traz as linhas
  de `post_likes`/`comments` e conta no cliente. Trocar por agregação no banco
  quando um post passar dos milhares de curtidas.
- ⬜ `[jun]` **Presence num canal global único** (`gamerhub-presence`).
  Revisitar se "online agora" passar de algumas centenas.
- ⬜ `[jun]` **Paginação / virtualização** em listas longas (usuários, logs, chat).
- ⬜ `[jun]` **Mídia no Cloudflare R2** — solução definitiva de egress se crescer.
- ⬜ `[21/08]` **2FA no login.**
- ⬜ `[21/08]` **Afinar detecção de ban** (hoje realtime + poll de 60s de reserva).

## 💡 Ideias registradas, sem compromisso

- 💡 `[23/08]` **Área própria de moderação de live, estilo YouTube Studio.** O
  incômodo é real: chat é ao vivo e efêmero, e a fila de moderação é assíncrona
  — quando o admin abre o painel, a live já acabou. As ferramentas que importam
  ali já existem no `ModPanel`, dentro da live. É feature nova, não é
  prioridade.

---

## Como esta lista é conferida

Documento envelhece; o sistema não mente (`CLAUDE.md` §1.4). Antes de confiar
em qualquer linha daqui, conferir na fonte:

| Pergunta | Onde está a verdade |
| --- | --- |
| Essa extensão / tabela / função ainda existe? | consulta ao Supabase |
| Esse arquivo ainda tem esse problema? | `grep` no código |
| Isso já não foi feito? | `git log -S'trecho'` e os PRs |

Na conferência de 23/08 essa checagem encontrou **cinco itens listados como
abertos que já estavam feitos** e três duplicados 2–3 vezes. Se a lista voltar
a passar de ~25 itens, é sinal de que precisa de outra conferência.
