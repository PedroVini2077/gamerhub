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

> ### `[03/09]` E também é MEMÓRIA OPERACIONAL da execução
>
> Ordem do dono em 03/09: *"quero que o BACKLOG seja utilizado como memória
> operacional da execução… não dependa apenas do contexto da conversa para
> lembrar o que precisa ser feito"*.
>
> Isso dá ao arquivo um **segundo trabalho**, e ele é diferente do primeiro: a
> seção **EM EXECUÇÃO** abaixo guarda o plano da tarefa em curso — objetivo,
> etapas, estado, o que foi validado e o que travou. A fila de itens continua
> sendo o que falta fazer.
>
> A diferença prática: quando eu perder o fio, o certo é **voltar aqui**, não
> carregar mais contexto. Nas três falhas de 02–03/09 meu reflexo foi ler mais
> e tentar de novo — foi assim que passei de duas tentativas, testei
> desligando o que estava quebrado, e declarei entregue o que nunca saiu do
> lugar.
>
> **A seção EM EXECUÇÃO esvazia quando a tarefa fecha.** Ela é estado, não
> histórico — mesma regra do resto do arquivo.

---

## 🔄 EM EXECUÇÃO

*(vazia — tudo do dia fechou nos PRs #165, #121, #120, #118, #167 e #168. As
duas decisões que esperavam o dono foram tomadas por ele em 05/09: o painel da
landing foi **descartado** e o logout deixou de ser global; as duas viraram
registro em [DECISOES.md](docs/DECISOES.md).)*

---

---

**Última conferência contra o sistema:** 05/09/2026 ·
**32 itens abertos** (+ 1 ideia sem compromisso)

> **O que a conferência de 02/09 desmentiu** — três linhas daqui estavam
> erradas, e nenhuma delas se corrigiria sozinha:
>
> | O que estava escrito | O que o sistema respondeu |
> | --- | --- |
> | *"`profiles` responde 401 ao anônimo, então não há como mapear UUID → pessoa"* | `select=id,username` responde **200 com as 5 linhas**. A cadeia `site_config.updated_by` → nome fecha. Item subiu de 🔵 para 🟡 |
> | *"UUID de staff exposto em **duas** tabelas"* | `blocked_words.created_by` está **nula nas 322 linhas**. Só `site_config` vaza pessoa |
> | as duas conferências de fila "daqui a alguns dias" | fila com **20 itens, todos resolvidos**, zero pendentes — mas **nada foi postado desde 28/08**, então o zero é falta de amostra, não veredito |
>
> **E um defeito meu, encontrado e corrigido na mesma passada:** o dono aceitou
> a política de privacidade às 19:58 de 02/09, e o PR #140 reescreveu o bloco de
> retenção depois disso **sem subir a versão**. O registro de aceite passou a
> apontar para um texto que ele não leu. Corrigido: versão `2026-09-02-2`, o
> `CHECK` do banco passou a aceitar revisão no mesmo dia, e entrou a trava de
> impressão de conteúdo — ver [PRIVACIDADE.md](docs/PRIVACIDADE.md).

> **O que esta rodada fechou** (29/08): a cena 3D deixou de ocupar 99% da thread
> principal enquanto visível — 8.066 ms → 52 ms de bloqueio numa janela de 8 s,
> medido em navegador de verdade e travado no CI; o `HUB` do título (elemento de
> LCP) deixou de animar `text-shadow`, que não roda no compositor; e a falha de
> extração de quadros de vídeo passou a chegar ao `admin_logs` com o motivo, o
> tipo do arquivo e o navegador.
>
> **O buraco encontrado no caminho, e ele era o pior dos três:** `drawImage` com
> um vídeo não decodificado **não lança** — saía um JPEG válido e transparente,
> a IA respondia `score 0`, e o vídeo ficava registrado como **analisado e
> limpo**. Análise falsa é pior que ausência de análise: a ausência aparece como
> pendência, a falsa afirma que alguém olhou.
>
> **A correção que eu tinha declarado e estava pela metade:** o `frameloop` de
> 28/08 resolvia a cena desenhando **fora** da tela, e eu li isso como "o
> problema de desempenho da cena está corrigido". Nunca tinha medido o caso "na
> tela", que era o caro. Registrado no item do chunk 3D.
>
> **Fechado com a permissão que você deu** ("pode fazer todas elas"): o
> "Carregar mais" do painel. Escolhi a saída mais correta das três — cada
> sub-aba pagina a si mesma — e não a mais barata, porque as outras duas
> deixavam o clique podendo não mudar nada. Custo: uma consulta a mais na carga
> inicial, dentro do mesmo `Promise.all`.
>
> **Fechado também:** o chunk da cena 3D, que era 🔵. Ele deixou de ser "bytes
> para rede lenta" quando o A/B mostrou que a cena responde por 520 ms de thread
> principal e que, depois da resolução adaptativa, esses 520 ms são quase todos
> CARGA. Trocar `<Canvas>` por `createRoot` deu −20,2% de bytes e −18% de thread.
> A justificativa antiga do item (`extend(THREE)`) estava errada — conferida na
> fonte e corrigida em [DESEMPENHO.md](docs/DESEMPENHO.md).
>
> **Viraram decisão** (§6.2 regra 4): resolução adaptativa em vez de `dpr` fixo,
> o brilho do título por `opacity`, e o `<Canvas>` saindo em favor do
> `createRoot` → [DECISOES.md](docs/DECISOES.md).
>
> **Esperando você:** três decisões de custo (HIBP, plano Team, sair do Gmail),
> a escolha do React Query, o desenho do aviso na landing, repostar um vídeo e
> repetir o PageSpeed do desktop no preset padrão.

---

## 🎯 O BLOCO DE 10/09 — o que o dono mandou de uma vez

> **Como isto chegou.** Ele mandou um **protocolo de trabalho** e **dois pedidos
> grandes** numa sequência só, com a ordem: *"grava tudo no backlog por ordem de
> prioridade… não deixa nada na memória da sessão"*. E avisou que **as condições
> do Brevo já estão feitas — falta testar**.
>
> As artes da identidade vieram **dentro da conversa**, que morre com a sessão.
> Foram salvas em [`docs/identidade/`](docs/identidade/README.md) antes de
> qualquer outra coisa, com o índice do papel de cada uma.

### A ordem que eu recomendo, e o porquê dela

Não é a ordem em que ele mandou. É a que a régua do projeto produz — camada mais
externa primeiro (§0.4), risco operacional antes de estética (§0), e **uma
dependência técnica real** que decide o resto:

| # | O quê | Por que nesta posição |
| --- | --- | --- |
| **0** | **Testar o Brevo** | 15 minutos, e ele já fez a parte dele. Vem antes por ser **curto**, não por ser mais importante |
| **1** | **AUDITORIA PROFUNDA DE SEGURANÇA** | o §0 é explícito: segurança antes de tudo. Consome **várias sessões** |
| **2** | **Identidade de ícones** | camada 1, e produz o **SVG mestre do raio** |
| **3** | **Reconstrução da Landing 3D + 2D** | camada 1, a maior — e **consome** o SVG mestre do item 2 |
| **4** | Integrar o protocolo às regras | é meta-trabalho; muda como eu trabalho, não o que o site faz |

> **A dependência que decide a ordem 2 → 3, e ela é técnica, não preferência.**
> O item 3 pede um *"novo raio 2D dividido em metade superior, core e metade
> inferior, em SVG"*. O item 2 pede *"um sistema visual único com adaptações
> técnicas"*. Fazer a Landing antes criaria um **segundo desenho do raio**, feito
> por outro caminho — exatamente a duplicação que os dois pedidos proíbem (§4,
> fonte única). O raio 2D da Landing tem que ser o **mesmo** SVG mestre, dividido.

---

- ⬜ `[10/09]` 🟠 **AUDITORIA PROFUNDA DE SEGURANÇA + HARDENING.** *Pedido dele
  em 3 partes — **a parte 1 está registrada abaixo; as partes 2 e 3 ainda não
  chegaram**. Auditoria autorizada do próprio site.*

  **O que ele já testou, e o resultado é BOM — mas precisa virar regressão.**
  Ele adulterou a resposta de `get_own_profile` no DevTools (`"role": "user"` →
  `"owner"`), o frontend acreditou, e então chamou as RPCs administrativas
  direto:

  | RPC chamada com role falsificado | Resposta |
  | --- | --- |
  | `admin_list_users` | 400 · P0001 · *"Acesso negado."* |
  | `owner_get_stats` | 400 · P0001 · *"Acesso negado."* |
  | `admin_get_unconfirmed_users` | 400 · P0001 · *"Acesso negado."* |
  | `get_blocked_logins` | 400 · P0001 · *"Acesso negado: exige super_admin ou fundador."* |

  **A leitura dele está certa, e vale repetir para eu não errar depois:** isso
  **não é escalada de privilégio**. Estado de autorização adulterável no cliente
  é esperado numa SPA. Só vira vulnerabilidade se **alguma ação sensível confiar
  nesse estado**. A ordem é explícita: *"não tente proteger o frontend contra
  DevTools como se isso fosse a barreira principal"*.

  **`npm test` precisa passar a provar esses quatro 400.** Hoje nada impede uma
  migration futura de afrouxar uma delas em silêncio.

  ### A regra do método, e ela proíbe o meu atalho favorito

  *"NÃO faça uma caça superficial por palavras como SECURITY DEFINER, role,
  admin ou owner. Leia o fluxo completo."* Para cada operação sensível:

      frontend → service/hook → chamada Supabase → REST/RPC → função PL/pgSQL
      → tabela/view → GRANT → RLS → trigger → auditoria → o que o cliente vê

  E: **se existe mais de uma porta para a mesma ação, comparar todas.** *"Uma
  autorização segura não pode depender de o usuário não conhecer uma segunda
  porta."*

  ### As três frentes da parte 1

  **A. As 10 tabelas administrativas que aparecem no Network de conta comum** —
  `admin_notifications`, `admin_notification_reads`, `admin_logs`,
  `moderation_queue`, `unban_requests`, `live_chat_timeouts`,
  `live_reactivation_requests`, `contact_messages`, `staff_nominations`,
  `role_change_requests`. Todas responderam **200 `[]`**.

  > **Ele explicitamente proíbe as duas conclusões fáceis:** `200 []` **não**
  > prova que a RLS está certa, e **não** prova vazamento. Pode ser RLS
  > filtrando, tabela vazia, ou grant/policy impedindo linha. **Só o banco
  > responde.** São 13 perguntas por tabela — inclusive *"existe motivo para o
  > frontend de usuário normal consultar isto?"* e *"trocando IDs, filtros ou
  > status, aparece alguma coisa?"*.

  **B. `profiles?select=id`** — respondeu 200, mas o DevTools mostrou *"Failed to
  load response data"*. **Não há evidência do conteúdo**, e ele proíbe
  classificar como `[]` ou como lista de IDs (§1.1: ausência de evidência não é
  evidência de ausência). Mapear **todas** as consultas diretas a `profiles`:
  `select('id')`, `select('*')`, joins `profiles(...)`, filtros por `user_id`,
  `count/head`, `update`, `insert`, `delete` — e cruzar com grants e policies.

  **C. Auditoria de CORPO de cada `SECURITY DEFINER`** — 30 perguntas por
  função, e o motivo está no nosso próprio histórico: *"houve funções que
  pareciam seguras olhando só nome, role, grants, SECURITY DEFINER e
  search_path — mas o corpo revelou vulnerabilidades"*. Entre elas: o alvo é
  validado? há autorização objeto-a-objeto? IDs podem ser trocados? o retorno
  expõe além do necessário? grava auditoria com o **ator real**? deveria estar
  num schema não exposto?

  ### Duas análises que ele pediu SEM autorizar a mudança

  - **`get_own_profile` devolve `public.profiles` inteiro.** O risco é **schema
    drift**: uma coluna sensível nova passa a ser exposta **automaticamente**,
    sem ninguém revisar. Ele quer a análise de impacto de trocar por
    `RETURNS TABLE` explícito — e diz *"NÃO mude automaticamente"*.
  - **`admin_list_users`** — admin pode ver owner e super_admin? cada nível
    precisa dos mesmos campos? `p_limit` aceita valor abusivo (DoS)? há
    paginação? `SETOF public.profiles` expõe demais?

  ### O que NÃO pode ser desfeito

  A migration `20260821164914_restrict_profile_columns_for_authenticated.sql`
  fechou um vazamento **real** de `birth_date` e histórico de moderação. O
  desenho por RPC continua certo — o que ele quer é saber se ele **continua
  válido depois de todas as migrations posteriores**.

  ### O tamanho disto, dito antes de começar

  São **78 funções `SECURITY DEFINER`** hoje. A Fase 2 de 05/09 cobriu **21** —
  as alcançáveis por quem tem conta sem passar por `is_super`/`is_staff` — e
  achou dois problemas. Aplicar 30 perguntas às 78 é trabalho de **várias
  sessões**. Vale o §0.1: se o contexto acabar, **registro onde parei** e retomo;
  nunca declaro fase concluída com leitura parcial.

  **FORA DO ESCOPO:** não é hora de refatorar, redesenhar tela, mexer em
  desempenho ou tocar na Landing. Achado que não for brecha explorável vira item,
  não conserto (§6 — *"achado que eu decidir não corrigir vai pro BACKLOG com o
  motivo"*).

- ⬜ `[10/09]` 🟠 **1. TESTAR O BREVO.** *O dono já criou a conta e configurou —
  falta a metade que é minha.*

  **O código já está pronto** desde o PR #172: se `SMTP_HOST` existir, a
  `send-email` usa o relay; se não existir, segue no Gmail. Mudança aditiva, e o
  caminho de volta é apagar um segredo.

  **O que falta, na ordem:** reimplantar a Edge Function (🟡 §7 — é função de
  autenticação, então com ele por perto), conferir que os cinco segredos estão
  no painel, e **provar com um cadastro de verdade**.

  **O que a trava NÃO cobre, e por isso o teste real é obrigatório:**
  `envioDeEmailTemDoisCaminhos.test.js` garante que as propriedades do código não
  sumam — **não** que o e-mail chega, que a senha do relay está certa, ou que o
  remetente foi aceito no provedor.

  **Se falhar, a mensagem em `admin_logs` agora diz qual caminho estava em uso** —
  antes ela mandaria investigar o provedor errado.

- ⬜ `[10/09]` 🟠 **2. IDENTIDADE VISUAL DE ÍCONES — o sistema, não cinco logos.**
  *Referências em [`docs/identidade/`](docs/identidade/README.md).*

  **O objetivo, na frase dele:** *"não quero cinco logos diferentes, quero um
  sistema visual único com adaptações técnicas"*. Logo mestre, favicon, ícone
  PWA, monocromático e animação — todos o **mesmo raio**.

  **Hierarquia que decide qualquer conflito:** geometria do raio → silhueta →
  consistência com o que já existe → legibilidade em tamanho pequeno → cor →
  glow. *Se removermos o glow, a marca ainda funciona. Se removermos a cor, ainda
  funciona.*

  **O que eu JÁ SEI, e é o coração da tarefa:** o "raio" que aparece hoje no
  Login e no cabeçalho é o ícone **`Zap` do `lucide-react`** — um raio genérico
  de biblioteca, **não** o raio da identidade. Trocar isso é o que faz o sistema
  existir, e toca vários componentes.

  **Etapas, na ordem que ele definiu:** auditar (o que existe em `index.html`,
  favicon, manifest, PWA, logos, componentes) → comparar com as referências →
  mapear *asset atual → asset correto → onde é usado* → planejar a **menor**
  mudança → implementar → validar → segunda passada procurando inconsistência.

  **FORA DO ESCOPO, e é obrigatório estar escrito:**
  - não criar identidade nova, não fazer rebranding;
  - não substituir o raio por gamepad, headset, escudo, letra G/GH ou qualquer
    símbolo genérico de esports/SaaS;
  - não alterar componentes que não exibem a marca;
  - não refatorar nada "já que estou aqui";
  - não mexer em autenticação, banco, RLS ou permissões.

  **O que depende dele:** eu vou precisar **reconstruir a silhueta em SVG** (as
  artes são PNG, e favicon 16 px pede vetor). Isso é **eu redesenhando** — ele
  precisa olhar e aprovar antes de eu espalhar pelo site.

- ⬜ `[10/09]` 🟠 **3. RECONSTRUÇÃO RADICAL DA LANDING — 3D e 2D.** *A maior das
  três. Referência da cena: `docs/identidade/referencias/10-cena-da-landing.webp`.*

  **Não é evolução incremental.** A camada visual da cena é desmontada e
  reconstruída; o que fica é a **infraestrutura de performance**.

  **O conceito, na frase dele:** *"um artefato cristalino de energia que está
  vivo"*. O raio é a identidade, o cristal é o material, o núcleo é a fonte, o
  vórtice é o nascimento, os fragmentos são a consequência.

  | O que muda | Em uma linha |
  | --- | --- |
  | **raio dividido** | metade superior + **core** + metade inferior, com uma **fissura visível mas pequena** — lê como um raio primeiro, dividido depois |
  | **core** | pertence à mesma linguagem geométrica; pulsa, ilumina as faces internas e **sustenta** as duas metades |
  | **entrada** | 7 fases: vazio → vórtice → convergência → core → formação do raio → ruptura curta → estabilização |
  | **idle** | o vórtice quase some; o core é o coração da animação |
  | **fragmentos** | acabam o torus/octaedro/dodecaedro/icosaedro nos quatro cantos; entram fragmentos da **mesma família cristalina**, distribuídos em **profundidade** |
  | **2D** | **não é versão pobre da 3D** — é interpretação gráfica da mesma identidade, em SVG + CSS, com a mesma dramaturgia |
  | **arquitetura** | um **controlador central** de animação (timeline de estados), não lógica espalhada por objeto |

  **A regra mais importante, e ela é dele em maiúsculas:** a imagem 3D é
  **referência, não asset**. Nada de pôr a imagem na Landing, usar como
  background, textura, sprite ou plano. *"A imagem é o mapa. O código é a
  construção."*

  **O que NÃO pode morrer na reconstrução** — é infraestrutura, não estética:
  `IntersectionObserver`, suspensão fora da viewport, `ResizeObserver`, cleanup,
  `root.unmount()`, controle de DPR, resolução adaptativa, o portão de bytes e o
  fallback. Reavaliar cada uma; substituir só conscientemente e por algo
  equivalente ou melhor.

  **FORA DO ESCOPO:**
  - não alterar autenticação, autorização, banco, RLS, roles, permissões ou API;
  - não mexer em páginas sem relação com a Landing;
  - não trocar bibliotecas nem atualizar dependência sem necessidade;
  - não aproveitar para reorganizar o projeto;
  - achado de segurança incidental **documenta, não corrige aqui**.

  **Restrição de processo, explícita:** *"não faça commit nem push sem minha
  autorização"*. Pode criar, alterar, remover, testar e analisar — **para antes
  do commit**.

  > **O que eu preciso dizer antes de começar, não depois.** Este item é grande
  > e a régua do §0.1 vale: se o contexto acabar no meio, o certo é **parar num
  > ponto íntegro e registrar onde parei**, nunca empurrar cena pela metade. E há
  > uma tensão real entre *"faça bonito"* e o orçamento de bytes do CI — se o
  > resultado bonito não couber no teto, quem decide é ele, não eu sozinho.

- ⬜ `[10/09]` 🟢 **4. Integrar o PROTOCOLO DE CONTROLE DE COMPLEXIDADE às
  regras.** *Documento estrutural → precisa de proposta (§6.2).*

  **O que ele traz de genuinamente novo** — o resto já existe, e duplicar regra
  cria duas fontes de verdade que divergem (§4):

  | Novo | O que muda |
  | --- | --- |
  | **FORA DO ESCOPO obrigatório** | hoje eu delimito o que **vou** fazer, nunca o que deliberadamente **não** vou |
  | **Descoberta ≠ ação** | *"descobrir um problema não significa receber autorização para corrigi-lo"* |
  | **Validação em camadas** | validar proporcional ao risco, em vez da bateria inteira sempre |
  | **Expansão mínima declarada** | quando expandir, nomear a **menor** expansão possível |
  | **Relatório final estruturado** | com *"o que NÃO foi alterado"* como campo fixo |

  **O conflito que eu preciso resolver por escrito, e não pode ficar implícito:**
  o `CLAUDE.md` §0 manda **tratar** dívida que está no caminho, e o §4 manda
  **dividir agora** arquivo que eu mesmo inchei. O protocolo §21 proíbe *"já que
  estou aqui"*. Não são a mesma coisa — sujeira que **eu acabei de fazer** é
  limpeza do meu próprio trabalho, não descoberta —, mas a fronteira precisa
  estar escrita, senão vira brecha nos dois sentidos: ou eu paro de dividir
  arquivo que inchei, ou eu uso o §4 como desculpa para refatorar o que quiser.

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[05/09]` 🟠 **O "Esqueci o código" do cofre ANULA o cofre — achado do
  dono.** *Precisa de decisão porque as três saídas mudam o que o cofre é.*

  Pergunta dele: *"que sentido faz ter um botão pra resetar senha? se alguém
  pega meu PC ou celular ligado na tela e não souber a senha, ele só vai
  redefinir"*.

  **Ele está certo, e eu conferi no código:** `esquecerCodigo()` apaga o resumo
  e o sal do `localStorage` e a tela cai em *"definir novo código"*. **Dois
  cliques e qualquer um entra.** O cofre protege contra ninguém.

  **O que isto NÃO é:** brecha de segurança. O cofre é cenográfico por decisão
  registrada — quem protege o painel é a RLS e o `is_super()` no banco, e quem
  pegou a máquina destravada já tem a sessão. Ver [DECISOES.md](docs/DECISOES.md).
  **O que isto É:** um cadeado que não tranca, o que é pior do que não ter
  cadeado — ele sugere uma proteção que não existe.

  | | Saída | Custo | O que muda |
  | --- | --- | --- | --- |
  | **A** | **remover o botão** | zero | esquecer o código passa a exigir limpar os dados do site no navegador — mesmo efeito, mas exige intenção e saber onde mexer |
  | **B** | **exigir a SENHA DA CONTA para resetar** | moderado | o cofre passa a valer de verdade: quem pegou a máquina aberta tem a sessão, mas normalmente **não** tem a senha |
  | **C** | deixar como está | zero | assumir que é 100% enfeite, e escrever isso na tela |

  **Minha recomendação: B.** É a única que faz o cofre significar alguma coisa,
  e a verificação é server-side de verdade (`signInWithPassword`), não um `if`
  no cliente. **A** é a versão de custo zero se ele preferir não gastar sessão
  nisso.

- ⬜ `[05/09]` 🟢 **O lembrete de auditoria não enxerga fase parada.** Ele
  compara a data do relatório **mais recente** com 90 dias. Como as Fases 2 e 4
  rodaram em 05/09, ele fica quieto — **mesmo com as Fases 1 e 3 paradas desde
  21/08**. O relógio dele não distingue fase.

  Conserto pequeno: guardar a fase no nome do arquivo (já está: `fase4-...`) e
  medir a idade **por fase**. É limitação minha, encontrada por mim, e está
  aqui para não depender de eu lembrar.

- ⬜ `[05/09]` 🟠 **Rodar FASE 1 e FASE 3 da auditoria.** Paradas desde
  **21/08** (`db/2026-08-21-auditoria-seguranca.md`). As Fases 2 e 4 rodaram em
  05/09; estas duas não. Consome uma sessão inteira, então a hora é do dono.

- ⬜ `[05/09]` 🔵 **A tela de APARELHOS CONECTADOS.** *Ideia do dono, nascida
  de dentro da decisão do logout — ver
  [VISAO-DE-FUTURO.md](docs/VISAO-DE-FUTURO.md).*

  Lista de sessões abertas com "encerrar esta". É a peça que faltava para o caso
  *"tem alguém na minha conta"* ser **visível** — hoje o site não tem como
  contar isso a ninguém. **Três coisas precisam ser respondidas antes**, e uma
  delas é dele: a região que ele citou é geolocalização por IP, ou seja,
  terceiro novo e dado pessoal novo na política de privacidade.

- ⬜ `[04/09]` 🟢 **Música no painel do Fundador.** *Ideia do dono; as três saídas
  que ele imaginou têm impedimento — ver
  [VISAO-DE-FUTURO.md](docs/VISAO-DE-FUTURO.md).*

  Ler a biblioteca do celular dele pelo site não é possível (não existe API para
  isso). Spotify e YouTube esbarram em conta paga, regra de uso e privacidade.
  O caminho limpo é o mesmo do som ambiente que já existe: **um arquivo curto,
  hospedado por nós, com licença clara**.

- ⬜ `[03/09]` 🟢 **Decidir se o site precisa de Service Worker para o caso
  offline.** *É o terceiro elo da corrente que o dono relatou, e o único que
  não deu para consertar.*

  **A corrente que ele viu, com o aparelho offline:**

  | O que aparecia | Estado |
  | --- | --- |
  | "sem acesso ao banco" | ✅ correto, e continua |
  | "Algo deu errado" | ✅ **corrigido em 03/09** — virou "Sem conexão", e não vai mais para o Sentry |
  | página de offline do navegador | ⬜ **este item** |

  **Por que o terceiro é diferente:** ele acontece quando a pessoa **recarrega**
  estando offline. Não é mensagem errada nossa — é o navegador não ter como
  carregar o app, porque nada está guardado localmente. Só um Service Worker
  resolve, servindo o app do cache.

  **O que ele custaria, dito antes:** um SW é código que fica *entre* o site e
  a rede, e erra caro — cache velho servido para sempre é o defeito clássico,
  e o conserto exige a pessoa limpar o navegador. Ele também muda como o deploy
  chega: o §0.2 já registra que **a Vercel conta deploy**, e um SW mal
  configurado faz o visitante continuar na versão antiga sem saber.

  **Minha recomendação: não agora.** O ganho é uma tela melhor num caso raro
  (recarregar offline); o risco é servir versão velha em todos os casos. Com 5
  usuários não paga. Registrado para quando houver volume — e para não ser
  redescoberto como bug.

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

  > **Conferido em 02/09, e o número não decide nada ainda:** a fila tem 20
  > itens, **todos resolvidos** (15 `approved`, 5 `rejected`), **zero
  > pendentes** — e nenhum item novo entrou desde 28/08. Fila vazia com uso
  > parado não distingue "o piso está certo" de "ninguém postou". A conferência
  > continua aberta porque ela depende de uso real, não de uma consulta.

- ⬜ `[29/08]` 🟢 **Conferir a fila `Não analisado` daqui a alguns dias.**
  *Não é pendência de código — o caminho está fechado. É a conferência que diz
  se o número escolhido foi o certo.*

  **O que ficou pronto:** a moderação de vídeo funciona (confirmado em produção,
  `analisadas=3/3`), e o vídeo que falhar **nos dois caminhos** vai para a fila
  como `sem_analise`.

  **O que conferir**, no painel de Moderação:

  | Se… | Então |
  | --- | --- |
  | a fila `Não analisado` seguir vazia | o plano B está dando conta — nada a fazer |
  | aparecer um item de vez em quando | funcionando como projetado; o motivo no item diz qual navegador falhou |
  | encher | o plano B não está cobrindo o caso real, e aí o motivo (que vem com as duas metades) aponta onde |

  > **Conferido em 02/09:** os 20 itens da fila são `post` (13), `chat` (6) e
  > `comment` (1) — **nenhum `sem_analise`**. Mesma ressalva do item acima:
  > nada foi postado desde 28/08, então o zero é falta de amostra, não prova.

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



- ⬜ `[01/09]` 🟡 **Decidir se as 3 luzes dos arcos do raio viram 1 compartilhada.**
  *Auditoria da cena 3D de 01/09. A medição inteira está em
  [DESEMPENHO.md](docs/DESEMPENHO.md); aqui fica só a decisão que falta.*

  A cena tem **7 `pointLight`**, e quatro delas são flashes que ficam apagados a
  maior parte do tempo. No three.js, luz com `intensity = 0` **continua custando
  shader inteiro** — ela segue no array de uniforms e é avaliada por fragmento.

  **O conserto óbvio é armadilha:** alternar `visible` mudaria a contagem de
  luzes, que faz parte da chave do cache de programas — cada troca recompila
  shader. Custo constante viraria engasgo a cada 0,6 s.

  **A proposta viável:** uma `pointLight` compartilhada pelos três arcos (7 → 5).
  **O risco é específico e real:** quando dois arcos disparam dentro da mesma
  janela de 0,36 s, hoje são duas luzes e passariam a ser uma.

  **Por que não implementei:** *"a luz verde não fica tão forte"* já foi uma
  regressão deste projeto, e este ambiente renderiza WebGL por software — não dá
  para medir aqui se o ganho paga o risco. **Precisa de comparação lado a lado
  no aparelho do dono.** Sem isso, alterar seria chute com passos extras.

- ⬜ `[01/09]` 🔵 **UUID de staff exposto ao anônimo em `site_config.updated_by`.**
  *`[03/09]` **Rebaixado de 🟡 para 🔵** — a metade grave foi fechada, e o que
  sobrou é o item original, agora com a justificativa CERTA.*

  **O que foi fechado em 03/09:** a cadeia que ligava o UUID a uma pessoa.
  `profiles?select=id,username` devolvia as 5 linhas e transformava
  `site_config.updated_by` num nome. Hoje responde **401** — a checagem de
  username do cadastro virou a RPC `username_disponivel`, e o `SELECT` de `anon`
  em `profiles` foi revogado. Conferido na produção, depois do merge.

  **O que sobra:** `site_config.updated_by` continua legível, e agora é
  **de fato** só um UUID sem nome — que era o que o item dizia em 01/09, só que
  na época era falso. Impacto real: ligar mudanças de config a *uma* conta, sem
  saber qual.

  > **Por que a justificativa antiga era falsa, e vale guardar.** Ela dizia
  > *"`profiles` responde 401 ao anônimo"*. O 401 valia para `select=*` —
  > privilégio no Postgres é **por coluna**, e um `select=*` negado prova apenas
  > que *alguma* coluna está fechada. O portão `portas-do-banco.mjs` cometia o
  > mesmo erro e por isso dava verde; desde 02/09 ele sonda **coluna a coluna**.

  **`blocked_words.created_by`** é lida pelo anônimo mas está **nula nas 322
  linhas** — vaza estrutura, não dado.

  **A dependência já está checada** (a consulta de "quem lê" do
  [POSTURA.md](docs/regras/POSTURA.md)): **nenhuma policy** usa
  `updated_by`/`created_by`, e a única função que os toca é
  `owner_set_site_config`, `SECURITY DEFINER`, que não passa por esses
  privilégios. O `REVOKE` das duas colunas é seguro — só não é urgente.

  > **A lição que ficou, e é a mais cara desta rodada.** Eu propus revogar
  > `id`/`username` dizendo que a dependência estava checada. Estava — mas a
  > consulta de "quem lê" procura **policy e função no banco**, e quem lia era
  > **o cliente**: o cadastro. O revoke teria sido a **quarta** queda do site
  > por revoke bem-intencionado. A consulta do POSTURA.md precisa incluir
  > `grep` no `src/`, e não só o Postgres.

  **Bônus a decidir junto:** a lista inteira de 322 palavras bloqueadas é
  pública. É consequência do filtro rodar no cliente, não descuido — mas entrega
  o dicionário exato a quem quiser burlar. Vale registrar como decisão em
  `DECISOES.md`, ou mudar de abordagem.

  **Defesa em profundidade, sem pressa:** `anon` tem privilégio de INSERT/UPDATE
  em quase toda coluna de `profiles`, `site_config` e `blocked_words`. A RLS
  nega tudo (sondado: 0 linhas afetadas, e nada entrou), então não está aberto —
  mas privilégio que ninguém usa é superfície que ninguém revisa.

- ⬜ `[29/08]` 🟢 **Decidir as outras abas da navegação lateral da landing.**
  Hoje ela tem as cinco seções da página, "Sobre" e "Entrar". Você disse que não
  sabia o que sugerir além do "Sobre" — quando quiser, trago uma proposta do que
  costuma fazer sentido nesta fase (regras da comunidade, contato, novidades) e
  você corta o que não quiser.

- ⬜ `[29/08]` 🟢 **Avaliar um rodapé para o site logado.** A decisão foi
  começar pela landing (camada 1). O site logado tem barra lateral e cabeçalho
  próprios, onde rodapé grande disputa espaço com o conteúdo — pode ser que o
  certo lá seja uma versão bem enxuta, ou nenhum.

## 🟠 Importante — dá para fazer


- ⬜ `[02/09]` 🟠 **A cena 3D: o custo é por PIXEL, e a próxima medição é no
  aparelho do dono.** *Primeira medição de regime permanente feita em 02/09 —
  ver [DESEMPENHO.md](docs/DESEMPENHO.md).*

  **O que já se sabe, medido:** o custo da cena escala com **pixels**, não com
  JavaScript. Com 4× menos pixels o bloqueio cai de 5583 ms para **zero** — um
  penhasco, não uma ladeira. E o lado JS é pequeno: a 0,256 Mpx a cena roda
  6 s sem uma única tarefa longa.

  **Por que isso não fecha o assunto:** a medição é num Chromium **sem GPU**,
  onde a CPU faz o trabalho da placa. Num PC de verdade quem paga esse custo é
  a GPU, e eu não meço isso daqui. Usar esse número para julgar o aparelho do
  dono seria artefato de ambiente vendido como fato (§1.1).

  **O que resolve:** abrir o painel de desempenho do navegador **na máquina
  dele**, com a landing aberta, e olhar o tempo de GPU por quadro. Depende dele.

  **Para onde olhar depois disso**, se confirmar: resolução (`dpr` adaptativo,
  que já existe), **overdraw** (camadas transparentes pintadas umas sobre as
  outras) e custo de shader. **Não** é "menos objetos" nem "menos JavaScript" —
  era para lá que eu ia, e a medição desviou.

  **O que NÃO pode:** reduzir qualidade visual para ganhar FPS. O dono já
  recusou aposentar a cena duas vezes — ver [DECISOES.md](docs/DECISOES.md).



- ⬜ `[23/08]` 🟠 **Migrar o envio de email para fora do Gmail.** *`[05/09]` O
  CÓDIGO JÁ ESTÁ PRONTO — o que falta é ação de painel, e ela é do dono.*

  **O que mudou em 05/09.** A função passou a aceitar **dois caminhos**:
  se `SMTP_HOST` existir ela usa o relay; se não existir, segue no Gmail
  exatamente como hoje. Mudança aditiva (§7): o caminho feliz de agora não foi
  tocado, e voltar atrás é **apagar um segredo**.

  Isso torna a migração uma ação de painel — sem deploy, sem coordenar horário,
  sem mexer em código com o cadastro possivelmente quebrado.

  **O que depende do dono, na ordem:**

  1. criar conta no Brevo e **verificar um remetente**;
  2. **a pergunta que decide o custo:** o Brevo aceita remetente verificado
     **sem domínio próprio**? Se sim, custa **R$0**; se exigir domínio, são os
     ~R$40/ano que ele já recusou uma vez. *Eu não consegui confirmar isso —
     a documentação deles não abre para leitura automática, e prefiro dizer
     isso a repetir de memória um número que pode ter mudado.* Ele vê em dois
     minutos ao criar a conta;
  3. pegar as credenciais SMTP e colar em **Supabase → Edge Functions →
     Secrets**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e
     `SMTP_FROM`. **A senha não passa por aqui** — mesma regra do Turnstile;
  4. me avisar para eu reimplantar a função e conferir o primeiro envio.

  **Como provamos que funcionou:** um cadastro de teste. Se falhar, a mensagem
  em `admin_logs` agora diz **qual caminho** estava em uso — antes ela mandaria
  investigar o provedor errado.

  **O que continua sem prova até lá:** que o e-mail chega, que a senha está
  certa e que o remetente foi aceito. Nada disso é verificável do repositório;
  a trava `envioDeEmailTemDoisCaminhos.test.js` só garante que as propriedades
  do código não sumam.

  > **Por que isto NÃO é urgente por volume, medido em 05/09:** `auth_register`
  > tem **12 registros na vida do projeto**, o último em 28/08. A cota de ~500/dia
  > não está perto de estourar. O que mantém o item em 🟠 é outra coisa: se o
  > Google travar a conta por envio automatizado, **cadastro e recuperação de
  > senha param em silêncio** — e o site continua de pé, aparentando funcionar.


## 🟢 Recomendado

- ⬜ `[05/09]` 🟢 **A query de índice nunca usado do §6.1 não serve neste
  volume — e isso precisa estar escrito antes de alguém agir nela.**

  Rodada hoje, ela devolveu **72 índices** com `idx_scan = 0` — **incluindo as
  chaves primárias de quase toda tabela**. Não é dívida: é que o site tem poucos
  usuários e a maioria dos caminhos nunca foi exercida. Apagar índice por esse
  sinal seria estrago, não faxina.

  **O que fazer:** deixá-la de fora da bateria enquanto o volume for este, ou
  trocá-la por uma que compare `idx_scan` **entre** índices da mesma tabela (o
  que distingue "ninguém usa este banco" de "ninguém usa este índice"). Enquanto
  não houver tráfego real, nenhuma das duas responde nada.



- ⬜ `[29/08]` **Repetir o PageSpeed do desktop, agora no preset padrão.**
  *A causa do 58 foi encontrada e corrigida; falta o antes/depois de campo.*

  **O que a rodada de 29/08 achou.** O PageSpeed do dono acusava 31,3 s de
  thread principal, dos quais **30.182 ms em "Other"** — e byte nenhum explicava
  aquilo, porque o custo de uma cena WebGL é por **pixel**. Medido num navegador
  de verdade, janela de 8 s com o Hero na tela:

  | Configuração | Long tasks | Thread bloqueada |
  | --- | --- | --- |
  | como estava (`dpr` até 1,5 + `antialias`) | 88 | **8.066 ms de 8.000 ms** |
  | resolução adaptativa (como está) | 1 | **52 ms** |

  A thread principal ficava 99% ocupada enquanto a cena estivesse visível. Isso
  também explica a contradição dos dois prints do dono: o do celular deu **TBT
  0 ms** porque a cena 3D não sobe abaixo de 1024px — o celular nunca pagou.
  Detalhes em [ARQUITETURA.md](docs/ARQUITETURA.md).

  **O que falta, e por que é do dono:** o print do desktop mostrava
  *"Limitação personalizada"*. Comparar uma medição de preset customizado com
  outra não diz nada (§0.3, regra 5). O pedido é: **PageSpeed, aba Desktop,
  janela anônima**, e comparar com o próximo — sempre no mesmo preset.

  | Onde | Como |
  | --- | --- |
  | **PageSpeed Insights** | `pagespeed.web.dev`, colar a URL, aba Desktop |
  | **Chrome no PC** | F12 → Lighthouse → Desktop + Performance → Analyze page load |
  | **Vercel Speed Insights** | já instalado; é o único que mede usuário real, e o único que responde se a cena incomoda quem TEM GPU |

  O portão do CI continua sendo **byte** (`scripts/orcamento-de-bytes.mjs`),
  porque tempo de laboratório oscila. A exceção nova é `e2e/cena-3d.mjs`, que
  agora barra bloqueio de thread acima de 800 ms — ali a margem é zero contra
  dois mil, não uma porcentagem.

## 🔵 Só quando o volume crescer

- ⬜ `[02/09]` 🔵 **Mensagem marcada como SPAM não precisa de 2 anos.**
  *Refinamento do prazo decidido em 02/09, não correção dele.*

  `contact_messages` tem prazo único de 2 anos, e ele foi calibrado pela
  conversa de moderação legítima. Mensagem que a equipe marcou como spam não
  tem essa finalidade — pela LGPD, guardar dado sem finalidade é justamente o
  que o prazo existe para evitar.

  **Por que não fiz junto:** o dono aprovou "2 anos", e inventar uma segunda
  regra que ele não pediu é decidir por ele. Fica registrado; a mudança é uma
  linha no `cleanup_old_data`.


- ⬜ `[02/09]` 🔵 **`date.js` e `roles.js` têm regiões que nenhum teste toca.**
  *Achado pelo teste de mutação — coluna `# no cov`, 65 mutantes.*

  Não é bug: é código sem rede. `roles.js` marca 92,31% no que os testes
  alcançam e 30% no total — ou seja, o que é testado é testado bem, e há uma
  parte que ninguém exercita. Vale olhar quando sobrar fôlego; nenhum dos dois
  é caminho crítico hoje.


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
  fatias (`src/lib/`, <!--n:src.lib.arquivos-->99<!--/n--> arq ·
  <!--n:src.lib.linhas-->9.220<!--/n--> linhas; `src/services/`,
  <!--n:src.services.arquivos-->17<!--/n--> arq ·
  <!--n:src.services.linhas-->1.771<!--/n--> linhas) concentram quase todo o
  benefício — é onde mora
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
