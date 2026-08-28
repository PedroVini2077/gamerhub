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

**Última conferência contra o sistema:** 28/08/2026 · **18 itens abertos**
(+ 1 ideia sem compromisso)

> **Próximo da fila.** O canal de recurso do banido entrou em 28/08 e o dono
> validou em produção: banir, recorrer, o limite de 1 pedido por ban e o
> desbanimento funcionam. O teste dele achou **três acertos pequenos** que estão
> logo abaixo — o mais importante é o banido não reencontrar o formulário ao
> entrar de novo.
>
> **Esperando você:** os prints de jogo para medir o `violence/graphic`, e a
> decisão sobre log de denúncia. Nenhum dos dois bloqueia nada.

---

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[28/08]` 🟢 **Atraso ao fechar a `BannedScreen`.** Dois, com tamanhos
  diferentes: um pequeno quando o contador de 20 s zera sozinho, e **um maior ao
  clicar em "Sair agora"**. *Hipótese, não medida:* o `signOut` do
  `useAuth.jsx:212` faz `supabase.auth.signOut()` e a tela só some quando a
  promessa volta — ou seja, o tempo é ida ao servidor, não render. Se for isso,
  o certo é a tela sair na hora e o `signOut` correr atrás. **Medir antes de
  mexer** (§1.2): abrir a aba Network e ver quanto demora o `POST /auth/v1/logout`.

- ⬜ `[28/08]` 🟢 **Ao testar moderação, use `ogamerpedro`, não `claudetester`.**
  *Decidido pelo dono em 28/08: não vamos criar uma terceira conta — a conta
  pessoal dele serve.* A `claudetester` é a que o E2E usa para logar: enquanto
  ela está banida, o job "fluxos autenticados" falha. Já aconteceu **duas vezes
  em 20 minutos**. O `recusarSeBanido()` faz o CI nomear a causa, mas não impede
  o vermelho — o que impede é banir outra conta.

- ⬜ `[28/08]` 🟢 **Depois de sair, o usuário cai no `/login` em vez da landing.**
  O dono viu com a `claudetester`. A landing é a porta de entrada do site e a
  única página que não depende do banco (é para onde o `dbHealth` manda todo
  mundo quando o Supabase cai) — mandar para o formulário de login é passo a mais
  sem motivo. Conferir para onde o `signOut` redireciona e apontar para `/`.

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
- ⬜ `[22/08]` **Migrar `Admin.jsx` para React Query.** **Conferido contra o
  sistema em 28/08, e a justificativa original não se sustenta mais** (§1.4).

  O item dizia que a migração "resolveria de verdade os `exhaustive-deps`
  suprimidos". Medido:

  | | |
  | --- | --- |
  | Warnings de lint dentro do `Admin.jsx` | **zero** — os 12 restantes estão espalhados por 10 outros arquivos |
  | Supressões dentro do `Admin.jsx` | 3 |
  | Supressões no resto do projeto | 7, em 7 arquivos |
  | Tamanho do `Admin.jsx` | **213 linhas** (era 918 antes dos splits) |

  E as três supressões têm a **mesma causa, que não é falta de React Query**:
  as funções de fetch vêm dos hooks de domínio sem `useCallback`, então mudam
  de identidade a cada render — incluí-las nas deps faria o painel recarregar
  em loop. **O conserto pequeno é memoizar essas funções nos próprios hooks**,
  e aí as deps ficam honestas sem migração nenhuma.

  React Query continua tendo valor real (cache entre abas, dedupe, invalidação),
  mas isso é ganho de arquitetura — não conserto de lint. **Vale decidir qual
  dos dois se quer** antes de gastar uma sessão nisso.

  **A rede ficou pronta em 28/08.** Ao planejar a migração ficou claro que as
  duas partes mais arriscadas — a paginação com estado local
  (`loadMorePosts`/`loadMoreKeys`) e o canal lateral que escreve as notificações
  no estado do pai — não eram tocadas por teste nenhum. Refatorar camada de
  dados às cegas justamente ali seria o pior lugar para começar. O
  `e2e/painel-admin.mjs` passou a **contar as linhas antes e depois do
  "Carregar mais"** e a exigir estado definido na aba de Notificações.

  **O que falta agora é só a migração em si**, e ela pede sessão própria: são 8
  consultas num `Promise.all`, duas paginações e um canal lateral para
  desmontar. Ver [ARQUITETURA.md](docs/ARQUITETURA.md).
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
