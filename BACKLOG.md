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

**Última conferência contra o sistema:** 28/08/2026, madrugada ·
**16 itens abertos** (+ 1 ideia sem compromisso)

> **Conferência item a item, e ela achou um erro meu.** Ao reescrever um item no
> PR #92 usei um recorte por INTERVALO e engoli o que estava no meio: **quatro
> itens e a seção `🟢 Recomendado` inteira** — Gmail, React Query, confirmar
> desempenho e emagrecer o chunk 3D. Nada acusou; o CI ficou verde e a lista só
> encolheu. Recuperados do `git show`, conferidos um a um contra a versão
> íntegra, e agora há teste exigindo que as quatro seções de prioridade existam.
>
> **Fechados nesta madrugada:** o atraso da `BannedScreen` (medido: 0,30 a
> 1,08 s de ida ao servidor — agora usa escopo local e sai na hora), a nota real
> da IA chegando ao painel, e a extração de quadros de vídeo, que ganhou motivo
> de falha e trava em navegador de verdade.
>
> **Viraram decisão** (§6.2 regra 4, decisão não é backlog): testar moderação
> com `ogamerpedro` → [DECISOES-FERRAMENTAL.md](docs/DECISOES-FERRAMENTAL.md);
> `sexual` em 0.55 ser a única defesa dessa classe em imagem →
> [DECISOES.md](docs/DECISOES.md).
>
> **Esperando você:** três decisões de custo (HIBP, plano Team, sair do Gmail),
> a escolha do React Query, e o desenho do aviso na landing.

---

## 🟠 Importante — precisa de ação ou decisão do dono

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

- ⬜ `[28/08]` 🟢 **Confirmar a extração de quadros com o vídeo que falhou.**
  *A falha foi reproduzida em parte, a causa foi cercada, e o caminho ficou
  endurecido — falta só o dono repostar aquele vídeo específico.*

  **O que estava provado:** `moderate-text` foi chamada para o post do vídeo e
  `moderate-image` **não foi chamada nenhuma vez**. A falha era no navegador,
  antes da rede.

  **O bug de fundo, e ele foi corrigido:** `extrairQuadros` tinha **cinco**
  caminhos diferentes terminando no mesmo `resolve([])` — `createObjectURL`
  estourando, formato não decodificado, duração não finita, teto de 15 s, e
  canvas recusando. Cinco causas, um sintoma, nenhuma pista, e correções
  completamente diferentes para cada uma. Agora cada uma diz seu nome.

  **O que mais mudou, e por quê:**

  | Mudança | Motivo |
  | --- | --- |
  | trata `duration === Infinity` | caso real e comum em vídeo de celular e de gravação em streaming; era desistência calada |
  | `crossOrigin` removido | a origem é `blob:` do próprio documento — mesma origem por construção, nada a proteger, e declarar CORS numa `blob:` só cria recusa silenciosa |
  | vídeo entra no DOM, fora da tela | navegador de celular recusa decodificar elemento solto na memória, e o sintoma é exatamente "nada acontece, sem erro" |

  **Travado por `e2e/quadros-de-video.mjs`**, que roda no CI: fabrica um vídeo
  de verdade com `MediaRecorder`, exige os 3 quadros distintos em JPEG, e exige
  que um arquivo inválido falhe **dizendo por quê**.

  **Ação do dono, e é a única coisa que falta:** repostar aquele mesmo vídeo. Se
  passar, o log mostra `analisadas=3/3`. Se falhar, o aviso na tela agora vem
  com a causa — e aí o conserto é dirigido, não mais adivinhação.

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

- ⬜ `[23/08]` **Migrar o envio de email para fora do Gmail pessoal.** Hoje usa
  nodemailer com uma conta Google dedicada — melhor que a conta pessoal, mas o
  limite (~500/dia), o risco de o Google travar por envio automatizado, e a
  falta de painel de entrega continuam. Com domínio próprio (~R$40/ano) +
  Resend vira `nao-responda@…`; sem domínio, o Brevo é a opção. *Não é urgente
  com 3 usuários.*


## 🟢 Recomendado

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

  **Como rodar o Lighthouse** (perguntado pelo dono em 28/08) — três caminhos,
  do mais fácil ao mais fiel:

  | Onde | Como | Serve para |
  | --- | --- | --- |
  | **PageSpeed Insights** | abrir `pagespeed.web.dev`, colar a URL do site | comparar com a medição de 27/08 — foi ela que deu 36 e depois 92 |
  | **Chrome no PC** | F12 → aba **Lighthouse** → *Mobile* + *Performance* → *Analyze page load* | iterar rápido; roda na sua máquina, então o número oscila com o que estiver aberto |
  | **O próprio celular** | Termux, como em 27/08 | o único que mede o aparelho real |

  **As duas regras que fazem a medição valer alguma coisa** (§0.3 regra 5):
  medir **antes e depois na MESMA ferramenta e no MESMO aparelho**, e sempre em
  **janela anônima** (extensão do Chrome entra na conta e suja o resultado).
  Comparar um PageSpeed de hoje com um Lighthouse local de ontem não diz nada.

  Repare que o número de laboratório oscila mesmo sem nada mudar — foi por isso
  que o portão do CI virou **byte** (`scripts/orcamento-de-bytes.mjs`) e não
  tempo. O Lighthouse aqui serve para confirmar a direção, não para aprovar ou
  reprovar.

- ⬜ `[28/08]` 🔵 **Emagrecer o chunk da cena 3D — o que sobrou depois do
  gargalo real.** *A cena 3D FICA (decisão do dono, registrada em
  [DECISOES.md](docs/DECISOES.md)). E o problema de desempenho que ela causava
  **já foi corrigido** — isto aqui é o resto.*

  **O que foi resolvido em 28/08.** O perfil de CPU do PageSpeed mostrou onde o
  tempo ia de verdade:

  | Categoria | Tempo |
  | --- | --- |
  | **Other** (o laço de animação) | **29.441 ms** |
  | Script Evaluation | 789 ms |
  | Script Parsing & Compilation | 79 ms |

  A cena continuava desenhando 60×/s depois que o visitante rolava para longe.
  Agora o `frameloop` desliga fora da tela — medido num navegador real: **125
  desenhos em 2 s visível, 0 fora da tela**, travado por `e2e/cena-3d.mjs`.

  **O que sobra, e por que é 🔵 e não 🟠:** o chunk continua com 887 kB, e
  trocar `<Canvas>` por `createRoot` + `extend` seletivo vale **−20%** (887 →
  707 kB, medido com experimento descartável). Isso importa para **download em
  rede lenta**, não para thread principal — os 789 ms de execução já eram
  pequenos perto do laço.

  **O custo de fazer:** `createRoot` não traz o tratamento de resize que o
  `<Canvas>` faz sozinho; seria preciso escrever e testar isso. Trabalho real,
  ganho moderado, risco na porta de entrada do site. Por isso fica para quando
  houver folga, e não agora.

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
