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

**Última conferência contra o sistema:** 28/08/2026 · **20 itens abertos**
(+ 1 ideia sem compromisso)

> **Próximo da fila.** As ações de painel de 27/08 saíram todas: Deploy Hook da
> Vercel apagado, alerta de cota do Sentry ligado, senha da conta de teste
> trocada — e o job "fluxos autenticados" do PR #70 provou que o secret
> `E2E_PASSWORD` acompanhou.
>
> **Sobrou uma ação sua:** ligar o Password Verification Hook no painel
> (abaixo). A função já está no banco e testada; hook não ligado é hook que
> nunca é chamado.

---

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[23/08]` **Usuário banido não tem canal para pedir revisão.** A
  `BannedScreen` mostra o motivo e desloga em 6s: sem botão, sem formulário,
  sem contato. `request_unban` exige `role = 'admin'`, ou seja, só um admin
  abre o pedido em nome de outra pessoa — coerente com a hierarquia, mas deixa
  o banido sem saída. *Mexe em quem pode chamar a RPC: pede aprovação antes.*
- ⬜ `[28/08]` 🟡 **Ligar o Password Verification Hook.** *Authentication →
  Hooks → Password Verification → `public.hook_de_verificacao_de_senha`.* A
  função já está no banco, testada e com `EXECUTE` só para `supabase_auth_admin`
  — mas hook não ligado é hook que nunca é chamado. **Enquanto isso não for
  feito:** ninguém consegue mais fabricar alerta de segurança (essa porta já
  fechou com a remoção do `register_login_attempt`), porém falha de login real
  também não é contada. Ver [SEGURANCA.md](docs/SEGURANCA.md).
- ⬜ `[22/08]` **Proteção contra senha vazada (HIBP).** Só no plano Pro
  (~US$25/mês). Decisão de custo.
- ⬜ `[21/08]` **Migração para TypeScript.** Grande, decisão do dono.
- ⬜ `[24/08]` **Decidir se eu ganho uma conta de teste com cargo.** Hoje só
  tenho `claudetester` (`user`), e é de propósito: o E2E usa justamente ela
  para provar que `/admin` e `/owner` são **negados**. Promover essa conta
  quebraria essa prova, então a discussão é sobre uma conta **separada**.

  **Minha recomendação `[27/08]`, se você quiser decidir:**

  | | |
  | --- | --- |
  | Cargo | **`admin`**, não `super_admin` — é o menor cargo que abre o painel, e o que abre menos portas |
  | `owner` | **Nunca.** Ele troca cargos e pausa o site: comprometer é comprometer tudo, sem volta |
  | Conta | nova (`claudestaff`), com a `claudetester` intacta em `user` |
  | Quando criar | **no mesmo PR que traz os testes que precisam dela** — conta de staff sem teste é só superfície de ataque nova |

  **O que ganha:** o `/admin` passa a ter cobertura de navegador (hoje tem
  zero), o que destrava a migração para React Query, e os fluxos de moderação
  passam a ser testados de ponta a ponta.

  **O risco, honesto:** a senha vive num secret do GitHub, e o repositório é
  público. O que protege é que PR de fork não recebe secret. O estrago máximo
  de um `admin` é ocultar/apagar conteúdo de usuário comum e suspender —
  reversível, registrado em `admin_logs`, e ele **não** mexe em cargo nem
  toca em conteúdo de `super_admin`/`owner` (a hierarquia já barra).

  Ver também [DECISOES.md](docs/DECISOES.md).

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
