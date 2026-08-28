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

**Última conferência contra o sistema:** 28/08/2026 · **19 itens abertos**
(+ 1 ideia sem compromisso)

> **Próximo da fila.** Nada esperando você. A conta `claudestaff` foi criada
> em 28/08 e promovida a `admin` pela RPC `owner_set_role` (que grava na
> trilha), então o `/admin` deixou de ser o único caminho do site sem cobertura
> de navegador.
>
> **O que sobra é trabalho meu:** moderação de vídeo, `Admin.jsx` para React
> Query (agora destravado), o smoke test instável, os prints de jogo no
> `violence/graphic` e a limpeza do `vercel-ignore.sh`.

---

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[23/08]` **Usuário banido não tem canal para pedir revisão.** A
  `BannedScreen` mostra o motivo e desloga em 6s: sem botão, sem formulário,
  sem contato. `request_unban` exige `role = 'admin'`, ou seja, só um admin
  abre o pedido em nome de outra pessoa — coerente com a hierarquia, mas deixa
  o banido sem saída. *Mexe em quem pode chamar a RPC: pede aprovação antes.*
- ⬜ `[22/08]` **Proteção contra senha vazada (HIBP).** Só no plano Pro
  (~US$25/mês). Decisão de custo.
- ⬜ `[28/08]` **Contar falha de login de verdade exige plano Team.** A função
  `hook_de_verificacao_de_senha` está no banco, testada e com `EXECUTE` só para
  o `supabase_auth_admin` — mas o *Password Verification Attempt hook* aparece
  cinza no painel: **"Team or Enterprise Plan required"**. O outro caminho
  também está fechado: `auth.audit_log_entries` está vazia, zero linhas desde
  sempre. **O que já está resolvido:** ninguém consegue mais fabricar alerta de
  segurança, e força bruta continua barrada pelo rate limit do próprio GoTrue.
  O que falta é só a contagem para avisar a equipe. Mesma família do HIBP —
  decisão de custo, não de código. Ver [SEGURANCA.md](docs/SEGURANCA.md).

## 🟠 Importante — dá para fazer

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
  `exhaustive-deps` suprimidos. **Destravado em 28/08:** a conta `claudestaff`
  existe, e `e2e/painel-admin.mjs` abre o painel e as sete abas num navegador de
  verdade em todo PR. A rede que faltava para mexer ali com segurança agora
  existe.
- ⬜ `[27/08]` **O smoke test é instável no `networkidle`.** Numa rodada local,
  `/community` deu timeout de `page.goto`; na repetição, 13/13. **Não é
  regressão** — a falha não foi exceção de JS, e outras 10 rotas que
  renderizam a mesma landing passaram na mesma rodada. *Hipótese:* neste
  sandbox o Google Fonts é bloqueado, o navegador retenta, e o `networkidle`
  nunca acha a rede parada. **No CI não apareceu** em nenhuma execução desta
  semana, o que é consistente com a hipótese. Se um dia aparecer lá, trocar
  `networkidle` por `domcontentloaded` + espera por seletor. Teste que falha
  sem motivo ensina a ignorar vermelho — por isso está anotado e não esquecido.
- ⬜ `[27/08]` **Mudança só de teste ainda gasta um deploy da Vercel.** O
  `scripts/vercel-ignore.sh` lista `src` inteiro em `CAMINHOS_QUE_IMPORTAM`, e
  `src/lib/__tests__/` está dentro de `src`. Foi o que aconteceu no merge do
  PR #68: ele mexeu só em `tiposDeConteudo.test.js` dentro de `src/`, e mesmo
  assim construiu. **Não corrigi na hora de propósito:** o próprio script diz
  que, na dúvida, o certo é construir — errar para o lado do *skip* deixa o
  site velho no ar em silêncio (`CLAUDE.md` §1.5). Excluir os testes é seguro
  (`git diff --quiet ... -- src ':(exclude)src/**/__tests__/**'`), mas mexer na
  regra que decide se o site atualiza pede teste do script antes, não um
  chute. Ganho: ~1 deploy por PR que só mexe em teste.
- ⬜ `[28/08]` **Confirmar a melhora de performance com número, em produção.**
  A rodada de otimização de 28/08 foi medida **no build** (prints 227 → 94 KB;
  cena 3D e Sentry fora do caminho crítico; carregamento inicial hoje em
  691,7 kB, conferido por `scripts/orcamento-de-bytes.mjs`). Falta o
  antes/depois de campo, e ele só vale **no mesmo aparelho e na mesma
  ferramenta** — as duas medições de 27/08 discordaram 4× no TBT (3.690 ms no
  Termux, 15.310 ms no PageSpeed). Duas fontes: repetir o Lighthouse no mesmo
  celular, e o **Vercel Speed Insights**, que já está instalado no projeto e
  coleta de usuário real. *Ação do dono; sem isso "otimizei" é opinião (§6.1).*
- ⬜ `[28/08]` **Os 887 KB da cena 3D continuam existindo.** Hoje eles não
  pesam no carregamento (chegam depois do ocioso, e só no desktop), mas quem
  recebe ainda paga 236 KB de download e o parse. Só há dois caminhos reais, e
  nenhum é urgente: trocar `@react-three/fiber` por WebGL cru com os cinco
  símbolos usados (`Shape`, `ExtrudeGeometry`, `MathUtils`, `Vector3`,
  `AdditiveBlending`), ou aposentar a cena 3D e ficar com a `Scene2D` em todo
  lugar. *Decisão de produto, não de código.*
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
- ⬜ `[21/08]` **Migração para TypeScript.** *Rebaixada em 28/08 a pedido do
  dono — fica por último.* Não descartada: quando a hora chegar, a análise de
  28/08 recomenda fazer por fronteira, e não de uma vez. As duas primeiras
  fatias (`src/lib/`, 44 arq · 2.899 linhas; `src/services/`, 9 arq · 994
  linhas) são 22% do código e concentram quase todo o benefício — é onde mora
  toda a conversa com o Supabase e a lógica pura já 100% testada. Gatilho
  sugerido: a próxima migration que renomeie ou remova coluna.
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
