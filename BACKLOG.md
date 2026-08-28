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
**21 itens abertos** (+ 1 ideia sem compromisso)

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

- ⬜ `[28/08]` 🟠 **A moderação de VÍDEO nunca rodou com sucesso — nem uma vez.**
  *É o único caminho tocado em 28/08 que ninguém exerceu, e o mais provável de
  ainda estar quebrado.*

  Ela nasceu em 28/08 mandando 3 quadros numa requisição só, e a OpenAI aceita
  **um por vez** — ou seja, foi entregue quebrada e passou o dia inteiro assim.
  A correção do `too_many_images` (v12) conserta o formato, mas **isso é
  inferência, não observação** (§1.1): o caminho `moderateVideos` →
  `extrairQuadros` → `data:` embutido → 3 requisições nunca completou com
  sucesso na vida. Conferido no banco ao fechar a sessão: **zero vídeos no ar**.

  Além do lote, há dois pontos que só um vídeo real testa, e nenhum tem
  cobertura de teste hoje:

  | O que pode falhar | Por quê |
  | --- | --- |
  | `extrairQuadros` devolver lista vazia | codec que o `<canvas>` do navegador não abre |
  | quadro passar de 400 KB | o teto do `data:` recusa em silêncio e só o `console.warn` conta |

  **Ação do dono, e é barata:** postar um vídeo curto. O veredito sai no log
  como `analisadas=3/3`. Se vier `analisadas=0/3` ou nada aparecer, o problema é
  a extração no navegador, não a API.

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

- ⬜ `[28/08]` 🟢 **Duas seções ainda estouram o limite do §6.2 — e são maiores
  que a que eu tinha achado.** A varredura de fechamento mediu **todas** as
  seções de todos os documentos, em vez de olhar só o tamanho do arquivo. O
  resultado desmentiu minha própria priorização:

  | Documento | Maior seção | Situação |
  | --- | --- | --- |
  | `docs/FUNCIONALIDADES.md` | `✨ Funcionalidades` — **365 linhas** | 🔴 o pior, e eu não tinha visto |
  | `docs/DECISOES.md` | `Ferramental` — **302 linhas** | 🔴 idem |
  | ~~`docs/MODERACAO.md`~~ | ~~política de imagem — 150+~~ | ✅ resolvido em 28/08 → `MODERACAO-IA.md` |

  Ou seja: o único que eu tinha anotado era o **menos** grave dos três. Foi
  medindo que apareceram os outros dois — mais uma vez, o sistema não mente e a
  minha lista mentia.

  **Não executei os dois, e o motivo é o Contrato de Evolução (§6.2):** o corte
  do `MODERACAO.md` era óbvio (um bloco autocontido de política de mídia); estes
  dois não são. `FUNCIONALIDADES.md` teria que ser cortado por área de produto,
  e `DECISOES.md` por tema — e cortar mal um arquivo de decisões espalha a
  memória do projeto em vez de organizá-la. Pede proposta antes.

  **Ao criar qualquer arquivo novo, acrescentar em três lugares**, senão ele
  nasce órfão: a tabela do `README.md`, o mapa `TERRITORIO` em
  `scripts/documentacao-envelhecida.mjs`, e o próprio documento de origem com o
  ponteiro para onde o conteúdo foi.


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
- ⬜ `[28/08]` 🔵 **Emagrecer a cena 3D — mantendo ela.** *A cena 3D FICA. O dono
  decidiu duas vezes ("não vamos aposentar a cena 3d não, vamos manter" e, ao
  fechar a sessão de 28/08, "eu já tinha decidido de não aposentar, quero o 3D
  lá"). Registrado em [DECISOES.md](docs/DECISOES.md) para não voltar à mesa.*

  Este item deixou de ser decisão e virou trabalho de otimização, sem pressa.

  Hoje os 887 KB **não pesam no carregamento** — chegam depois do ocioso e só no
  desktop —, mas quem recebe ainda paga 236 KB de download e o parse.

  **A causa raiz está medida** (28/08, lendo o fonte da dependência):
  `@react-three/fiber` v9.7.0 executa `extend(THREE)` **dentro do próprio
  `<Canvas>`**, com este comentário no código dele: *"This will include the
  entire THREE namespace by default, users can extend their own elements by
  using the createRoot API instead"*. O namespace inteiro do `three` entra no
  bundle independentemente do que a nossa cena importa — e ela usa **cinco**
  símbolos. Nenhum tree-shaking alcança isso enquanto o `<Canvas>` for usado.

  **O ganho do conserto óbvio também está medido, com um experimento
  descartável** (trocar `<Canvas>` por `createRoot` + `extend()` só dos 14
  elementos que a cena usa, build, e reverter):

  | | Bruto | Gzip |
  | --- | --- | --- |
  | Hoje, com `<Canvas>` | 887,18 kB | 235,86 kB |
  | Com `createRoot` + `extend` seletivo | **707,15 kB** | **188,75 kB** |
  | Ganho | −180 kB (−20%) | −47 kB |

  **E é por isso que o item continua aberto em vez de já estar feito: 20% não
  resolve o problema.** O que sobra são os 707 kB do renderer WebGL do `three`,
  que a `fiber` referencia direto e é irredutível enquanto ela for a camada de
  render. Cortar 20% de bytes não transforma um Speed Index de 6,8 s.

  **Os caminhos que sobram, e nenhum é trivial:**

  | Caminho | O que custa |
  | --- | --- |
  | `createRoot` + `extend` seletivo | −20% de bytes; **precisa de tratamento de resize próprio**, que hoje o `<Canvas>` faz sozinho |
  | Baixar `dpr` e desligar `antialias` no desktop | não mexe em byte nenhum, mas pode ser onde mora o custo real de GPU/CPU |
  | WebGL cru com os 5 símbolos | o maior ganho possível e o maior risco — reescreve uma cena que hoje funciona |

  **O próximo passo não é escolher: é medir onde o tempo vai.** Byte não é a
  mesma conta que CPU (§0.3), e a suspeita agora é que o custo esteja na
  inicialização do renderer e na compilação de shader, não no parse. Um perfil
  de CPU no DevTools do desktop responde isso em minutos e evita reescrever a
  cena por palpite.
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
