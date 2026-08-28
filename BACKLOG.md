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

**Última conferência contra o sistema:** 28/08/2026, ao fechar a sessão ·
**17 itens abertos** (+ 1 ideia sem compromisso)

> **Próximo da fila.** O ciclo da moderação de imagem fechou em 28/08:
> `too_many_images` corrigido (v12), pisos ajustados com dado (v13) e
> **confirmado em execução** — o dono postou 3 imagens e as notas de todas as
> categorias apareceram no log. A instrumentação nova já se pagou: em menos de
> 24 h ela revelou que `sexual/minors` não roda em imagem (v14).
>
> **Verificado em produção nesta sessão** (não é inferência — conferido no
> banco ao fechar): a moderação de imagem roda e registra as notas; o
> banimento, o recurso e o **aviso de desbanimento** funcionam ponta a ponta —
> `ogamerpedro` recebeu e leu o aviso às 17:53; a fila está zerada.
>
> **A documentação ganhou três camadas** (§6.2): um portão no CI que reprova
> documento citando arquivo inexistente, um lembrete semanal que abre issue com
> os documentos que o código deixou para trás, e a regra de reler a seção antes
> de editá-la. Os dois scripts já se pagaram — acharam
> `register_login_attempt` documentada como existente quando ela **não existe
> mais no banco**.
>
> **O único caminho de 28/08 que ninguém exerceu é a moderação de VÍDEO** (item
> logo abaixo). Ela nasceu quebrada e foi consertada junto com a de imagem, mas
> nunca rodou com sucesso uma vez sequer.
>
> **Esperando você:** postar um vídeo (fecha o último buraco), e o PageSpeed.

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

- ⬜ `[28/08]` 🟢 **Conferir os pisos novos com o uso real, em algumas semanas.**
  *Não é decisão pendente — a decisão foi tomada em 28/08 e está no ar (v14).*
  `violence` foi aposentada e `violence/graphic` subiu de 0.80 para 0.95. O
  raciocínio inteiro está em [MODERACAO-IA.md](docs/MODERACAO-IA.md).

  **A amostra até agora** (toda a medição que existe, 5 posts):

  | Imagem | `violence` | `violence/graphic` | Fila? |
  | --- | --- | --- | --- |
  | comum (2 posts) | 0.000 – 0.001 | 0.000 | não |
  | "violenta", escolha do dono | 0.834 | 0.414 | não |
  | print de jogo (1 imagem) | — | **0.854** | não (era sim) |
  | prints de jogo (4 imagens) | **0.943** | ≤ 0.943 | não (era sim) |

  **Duas leituras honestas disso.** A boa: o modelo separa muito bem — imagem
  comum dá 0.000 e conteúdo violento sobe para a casa dos 0.8. A que incomoda:
  **nada que medimos até hoje cruzou 0.95**, então a fila de violência está,
  na prática, dormente. Isso é o efeito pretendido para print de jogo, mas
  ainda **não foi provado** que gore de verdade cruza esse piso — e não dá para
  provar postando gore real de propósito.

  Daqui a algumas semanas, olhar os logs e responder:

  | Se… | Então |
  | --- | --- |
  | a fila voltar a encher de print de jogo | 0.95 ainda está baixo |
  | passar gore evidente e a fila seguir vazia | 0.95 está alto — descer para ~0.88, acima do 0.854 medido |

  Onde ler: painel da Supabase → Edge Functions → `moderate-image` → Logs,
  linhas `[moderate-image] ... | notas: ...`.

  > Os dois itens antigos que tinham ficado na fila já foram resolvidos pelo
  > dono no painel — conferido ao fechar a sessão: `moderation_queue` com zero
  > pendentes.

- ⬜ `[28/08]` 🟠 **A moderação de VÍDEO falhou no primeiro vídeo real — causa
  ainda não confirmada.** *Saiu de "nunca foi exercida" para "foi exercida e
  não funcionou". O dono postou um vídeo às 22:20.*

  **O que está provado, pelo log da Supabase:** `moderate-text` foi chamada
  para aquele post; **`moderate-image` não foi chamada nenhuma vez**. Logo, a
  falha é no navegador, antes da rede — não é a API, não é o
  `too_many_images`, não é autenticação (o `moderate-text` do mesmo post
  passou).

  **Hipótese, e ela vem com o teste que a confirma** (§1.1): `extrairQuadros`
  devolveu lista vazia, provavelmente por codec que o `<canvas>` não decodifica.
  O que confirma é o próximo vídeo publicado — desde 28/08 a tela **avisa** com
  quantos vídeos não puderam ser analisados.

  **O que já foi corrigido:** a falha deixou de ser invisível. `moderateVideos`
  devolve `{ videos, analisados, semQuadros }` em vez de nada, a chamada deixou
  de ser uma promessa solta sem `catch`, e quem publica vê o aviso. Antes disso
  o vídeo subia sem análise e ninguém ficava sabendo — nem na tela, nem no
  `admin_logs`, nem em teste.

  > Não dá para gritar em `admin_logs` daqui: a RPC de registro é
  > `service_role`, e criar um canal de log chamável pelo navegador repetiria o
  > erro do `register_login_attempt`, que qualquer um forjava.

  **Ação do dono:** postar mais um vídeo, de preferência um MP4/H.264 comum. Se
  o aviso aparecer, é a extração; se não aparecer e o log da Edge Function
  mostrar `analisadas=3/3`, está resolvido.

- ⬜ `[28/08]` 🟡 **`sexual/minors` não roda em imagem — e não há conserto
  nosso.** *Achado em 28/08 pela instrumentação nova, menos de 24 h depois de
  ela existir.*

  A `omni-moderation-latest` aplica **seis** categorias a imagem; `sexual/minors`
  é **text only** (fato conferido na documentação da OpenAI). O piso de 0.10 que
  está no mapa de imagem nunca disparou e nunca vai disparar.

  **Não é brecha aberta:** quem cobre essa classe em imagem é `sexual` em 0.55,
  que roda e **oculta na hora** — e o caminho de texto continua com
  `sexual/minors` ativo. Já está documentado no código, em
  [MODERACAO-IA.md](docs/MODERACAO-IA.md) e travado por teste, e o log passou a
  distinguir "não veio e não deveria" de "não veio e deveria".

  **O que fica em aberto é decisão de produto, não código:** se `sexual` em 0.55
  é folgado o bastante para ser a única linha de defesa dessa classe em imagem.
  Baixar o piso pega mais casos duvidosos e também mais foto de praia — e este
  caminho **oculta**, então errar aqui censura de verdade. Sem denúncia ou caso
  real, mexer seria chute.

- ⬜ `[28/08]` 🟢 **Aviso do banimento FORA do site, na landing.** *Pedido do
  dono, adiado por ele mesmo: "depois a gente implementa isso".*

  Eu entendi errado da primeira vez e entreguei outra coisa. O que ele pediu em
  28/08 foi: *"seria legal o site também identificar o usuário banido, e
  aparecer uma nova aba ou botão na landing page só pra ele… pode ser um sino"*.
  O que eu fiz foi notificação **dentro** do site (o sino do `Header`, que só
  existe depois do login). As duas são úteis e não se substituem: a de dentro
  serve para quem voltou; esta serve para quem **não consegue entrar**.

  **O obstáculo real, e é por onde a implementação tem que começar:** a landing
  é vista por visitante anônimo, sem sessão. Identificar "esta pessoa está
  banida" sem login exige guardar algo no navegador dela — e aí vêm as
  perguntas que decidem o desenho: o que exatamente fica guardado (um `id`? um
  `token`?), por quanto tempo, e o que acontece se outra pessoa usar o mesmo
  computador. Vazar "esta máquina pertence a alguém banido" para quem
  compartilha o PC é o tipo de coisa que este projeto passou o mês endurecendo
  contra (§1.3).

  Sem responder isso primeiro, qualquer implementação vira brecha nova ou
  aviso que aparece para a pessoa errada.

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

- ⬜ `[28/08]` 🟢 **`moderation_queue.ai_score` é sempre 1 — a nota real nunca
  chega ao banco.** A `moderate-image` manda `p_score: 1` de propósito (a
  decisão já foi tomada pelos pisos fixos, e o dial do painel não deve
  desfazê-la), mas o efeito colateral é que o painel mostra "score 1" para tudo.
  Quem revisa a fila não consegue distinguir um 0.96 raspando o piso de um 0.99
  gritante — e são casos com decisões diferentes.

  A nota verdadeira existe **só no log da Edge Function**. Conferido em 28/08:
  o log guarda pelo menos **7 dias** (medido, não suposto — havia 5.814 linhas
  de 21/08). Serve para ajustar piso; não serve para quem está olhando um item
  da fila agora.

  **Conserto pequeno:** mandar a nota real num parâmetro novo e gravá-la em
  `moderation_queue.metadata`, sem tocar no `p_score` que decide.

- ⬜ `[28/08]` 🟢 **Faltam dois splits de documento: `FUNCIONALIDADES.md` e
  `DECISOES.md`.** *Escolhidos pelo dono como o próximo passo depois do split do
  `CLAUDE.md`.*

  | Documento | Maior seção | Situação |
  | --- | --- | --- |
  | `docs/FUNCIONALIDADES.md` | `✨ Funcionalidades` — **365 linhas** | aberto |
  | `docs/DECISOES.md` | `Ferramental` — **302 linhas** | aberto |
  | ~~`CLAUDE.md`~~ | ~~1.512 linhas, 4 seções acima de 150~~ | ✅ 28/08 → `docs/regras/` via `@import` |
  | ~~`docs/MODERACAO.md`~~ | ~~política de mídia~~ | ✅ 28/08 → `MODERACAO-IA.md` |

  **O corte não é óbvio, e é por isso que ainda não foi feito.**
  `FUNCIONALIDADES.md` teria que ser cortado por área de produto (feed, lives,
  painéis…), e `DECISOES.md` por tema — e cortar mal um arquivo de decisões
  espalha a memória do projeto em vez de organizá-la. Pede proposta (§6.2).

  **Ao criar arquivo novo, acrescentar em três lugares**, senão ele nasce órfão:
  a tabela do `README.md`, o mapa `TERRITORIO` em
  `scripts/documentacao-envelhecida.mjs`, e o documento de origem com o ponteiro
  para onde o conteúdo foi.

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
