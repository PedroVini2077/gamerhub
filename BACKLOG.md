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

**Última conferência contra o sistema:** 29/08/2026, manhã ·
**29 itens abertos** (+ 1 ideia sem compromisso)

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

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[30/08]` 🔴 **PRIMEIRO ITEM DA PRÓXIMA SESSÃO — auditoria de mim mesmo.**
  *Pedido do dono em 30/08: "o primeiro item do backlog literalmente vai ser vc
  como IA... oq vc quase sempre falha, oq ficamos quebrando cabeça por sua
  causa". Marcado 🔴 porque é o item que decide a qualidade de todos os outros.*

  **O objetivo:** o mesmo tratamento que o projeto recebe — achar as brechas,
  fechar o que der, e travar o que não der — aplicado a **mim**. Não é
  autocrítica: é varredura de classe (§1.3) sobre o meu próprio comportamento.

  **O catálogo já começa aqui, com evidência.** Não custa nada agora e a
  próxima sessão não tem como reconstruir isto de memória:

  | Padrão de falha | Evidência |
  | --- | --- |
  | Escrevo de memória em vez de abrir o arquivo | 3 casos em 28/08 (§6.2) + 2 em 29/08: medição no `FUNCIONALIDADES` e 6 arquivos fora do `ARQUITETURA` |
  | Afirmo **inferência** como **fato** | 23/08, duas vezes, eu mesmo tive que corrigir (§1.1) |
  | Escrevo teste que **não pode falhar** | o teste de portas RPC em `portas-fechadas.mjs` — PostgREST nunca expõe função `trigger` |
  | Construo portão que acusa **errado** | `mapa-de-arquivos.mjs` acusou 145 arquivos na 1ª execução; comparava com a extensão |
  | Produzo **verde que promete demais** | `npm run fim` dizia "sessão pode ser fechada" cobrindo 6 de 13 itens |
  | Prometo acompanhar coisa **depois do turno** | 2 vezes em 29/08; o turno acaba e a sessão para — não existe "eu aviso depois" |
  | Tentativa e erro em vez de diagnóstico | 3 rodadas na cena 3D, cada uma com justificativa própria e alvo errado (§1.2) |
  | Crio dado de teste que **confunde o dono** | fila de moderação com itens falsos marcados `trigger_type: ai` |
  | Entendo errado e **não pergunto** | a aba de banimento: eu li "site logado", ele quis "landing" |

  **O método proposto** (a decidir com ele):
  1. Ler o `CLAUDE.md` e os `docs/regras/` inteiros procurando **regra que já
     falhou** — cada uma existe porque eu errei, e o histórico está escrito lá.
  2. Varrer `git log` e os corpos de PR atrás de "corrigi o que eu mesmo fiz".
  3. Para cada padrão: existe mecanismo que o pega? Se não, dá para criar um?
     Se não der, ele vira pergunta nos gatilhos — que é o mais fraco, e por
     isso o último recurso (§2).
  4. **Estender os gatilhos ao resto do projeto**, que foi o outro pedido: hoje
     eles cobrem documentação e fechamento. Faltam banco, moderação e
     segurança.

  **A pergunta que ele pediu, na forma que não deixa escapar.** A versão
  original — *"estou fazendo tudo o que preciso?"* — é respondível com um "sim"
  preguiçoso, e teria deixado passar todas as falhas de 29/08. A versão que
  obriga a nomear:

  > **Quais regras deste projeto se aplicam ao que acabei de fazer — e para
  > cada uma, onde está a evidência de que cumpri?**

  Sem evidência nomeada, não cumpri: só acho que cumpri. Formalizar isto no
  `CLAUDE.md` é decisão da próxima sessão (§6.2 pede proposta).

  ---

  ### `[01/09]` PARTE C EXECUTADA — cada padrão de falha contra a proteção que existe

  *Feita depois de o dono cobrar: "tô achando que vc fez essa sua auditoria muito
  rápida, realmente estamos fazendo tudo pra evitar vc de errar?". Ele estava
  certo. Esta é a resposta com número.*

  | # | Padrão de falha meu | Existe mecanismo? |
  | --- | --- | --- |
  | 1 | escrevo de memória em vez de abrir o arquivo | **parcial** — o gatilho de início mostra a idade de cada doc; o mapa pega arquivo novo fora do `ARQUITETURA`. Mas **nada pega "escrevi no documento errado"**, que foi a falha real de 29/08 |
  | 2 | apresento inferência como fato | **não** — só a pergunta no gatilho |
  | 3 | escrevo teste que não consegue falhar | **não**, e eu **repeti hoje** |
  | 4 | construo portão que acusa errado | **parcial** — o falso positivo aparece na primeira execução, mas só se alguém rodar |
  | 5 | produzo verde que promete demais | **não** — o `npm run fim` foi corrigido, mas como caso, não como classe |
  | 6 | prometo acompanhar coisa depois do turno | **não** — comportamental |
  | 7 | tentativa e erro em vez de diagnóstico | **não** |
  | 8 | crio dado de teste que confunde o dono | **SIM, a partir de hoje** — o `fluxos.mjs` reprova se sobrar post de teste no feed |
  | 9 | entendo errado e não pergunto | **não** |

  **Um de nove tem mecanismo. Essa é a resposta honesta à pergunta dele.**

  ### O número 3 é o mais grave, e merece parágrafo próprio

  *"Teste que não consegue falhar"* está no catálogo desde 30/08 — e em 01/09 eu
  **cometi de novo**: a primeira versão da trava de banco fora do ar nunca
  alcançava o estado que dizia testar. Só apareceu porque eu injetei o bug de
  volta e vi a coisa passar.

  Ou seja: **a disciplina de provar a trava por injeção é hoje a única defesa
  contra o padrão, e ela depende inteiramente de eu lembrar de fazer.**

  O mecanismo que pegaria isso de verdade é **teste de mutação** (mutar o código
  e exigir que algum teste quebre). Ele existe para JS (Stryker), e é **decisão
  de custo do dono**: adiciona minutos ao CI e uma dependência de peso. Está
  aqui como pergunta a ele, não como coisa que eu decido sozinho.

  ### Os que provavelmente NÃO têm mecanismo, e por que dizer isso importa

  Os padrões 2, 6, 7 e 9 são de julgamento e de conduta na conversa. Não existe
  script que detecte "ele afirmou sem ter provado" ou "ele entendeu errado e não
  perguntou". Fingir que um portão cobre isso seria o padrão 5 acontecendo de
  novo, uma camada acima.

  Para eles, o que existe é a pergunta no gatilho de início e o relatório de
  entrega — e o dono cobrando quando faltar. **É pouco, e é honesto dizer que é
  pouco.**

  ### O que ainda falta desta auditoria

  - **Parte A incompleta:** a matriz saiu com `gatilho → cobertura`. Falta a
    coluna **obrigação** — o que cada portão EXIGE de quem mexe na área — que
    era metade do formato pedido.
  - **Parte B não começou:** varrer as seis classes nomeadas (inferência como
    fato, teste que não falha, validação que acusa errado, documentação não
    consultada, diagnóstico sem evidência, conclusão prematura) pelo código.

  **O que este item NÃO promete:** que eu pare de errar. Prometer isso seria a
  mesma mentira do verde que prometia demais. O alvo é o mesmo do projeto —
  **o mínimo possível**, e cada erro que acontecer virando trava para não
  acontecer de novo.
  ---

  ### `[30/08]` Complemento do dono — a pergunta muda de "onde errei" para
  ### "por que consegui errar"

  > *"Não quero apenas descobrir onde o Claude errou, mas entender **por que ele
  > conseguiu errar e por que o projeto permitiu que o erro passasse**."*

  Isto reenquadra o item inteiro. O catálogo acima vira **entrada**, não
  resultado: cada linha dele passa a ser uma pergunta sobre **cobertura**, e não
  um troféu de erro encontrado.

  #### A. Gatilho por área — a matriz que ainda não existe

  Hoje os gatilhos cobrem documentação e fechamento de sessão. **Nenhuma outra
  área tem gatilho nenhum**, e isso nunca foi olhado de frente.

  Mapear, uma linha por área: autenticação/autorização · Supabase, banco e RLS ·
  usuários e dado sensível · admin/staff · APIs e Edge Functions · fluxos
  críticos · testes e auditoria · configuração e segredo · CI/CD · documentação.

  E para **cada** uma, responder as cinco:

  | Pergunta | Por que ela importa |
  | --- | --- |
  | Qual gatilho **deveria** disparar? | sem isto, "está protegido" é opinião |
  | O que ele **exige** de quem mexe ali? | obrigação vaga não se cumpre nem se cobra |
  | Quais arquivos/fluxos ele **realmente** cobre? | cobertura declarada ≠ cobertura real (§1.5, fonte nº 6) |
  | Existe caminho para **alterar a área sem acioná-lo**? | é a pergunta que encontra a brecha; as outras quatro só descrevem |
  | Ele pode dar **falso positivo ou negativo**? | falso negativo cega; falso positivo ensina a ignorar (§0.2, 4ª regra) |

  **A forma que o dono deu, e que vale como critério de aceite do item:**

  > **gatilho → obrigação → evidência.** Não "confiar que a IA vai lembrar".

  Já há prova de que os dois últimos itens da matriz não são teóricos: o
  `mapa-de-arquivos.mjs` nasceu dando **145 falsos positivos**, e o teste do
  painel gritou com o site legitimamente vazio. Os dois eram gatilhos novos.

  #### B. Erro é CLASSE, nunca caso

  Isto já é regra do projeto (§1.3, *"varredura de classe, não de caso"*), mas
  aqui ela se aplica **a mim**. Ao achar uma falha minha, a pergunta obrigatória
  é *"onde mais esse mesmo padrão está?"*.

  As classes a varrer, nomeadas pelo dono: inferência apresentada como fato ·
  teste que não consegue falhar · validação que acusa errado · documentação não
  consultada · diagnóstico sem evidência · conclusão prematura.

  > Corrigir só o caso encontrado deixa os outros no site — foi exatamente assim
  > que 14 policies ficaram sem `owner` três vezes seguidas.

  #### C. Causa → prevenção, e a proteção NÃO é sempre uma regra

  Para cada falha relevante, percorrer os quatro degraus:

  > **erro → causa → padrão → proteção possível**

  E então **escolher o tipo de proteção**, em vez de escrever regra por reflexo:
  regra, gatilho, teste, script, documentação, ou mudança de código que torne o
  erro impossível.

  **Este é o ponto mais fácil de errar do item inteiro, e o dono já o marcou:**
  *"não transforme tudo automaticamente em mais uma regra no CLAUDE.md"*. A
  tabela do §2 concorda — regra escrita é a **mais fraca** das cinco travas, e a
  falha de 29/08 foi precisamente uma regra escrita, certa, e não cumprida.
  Responder a isso com mais regra é repetir o que não funcionou.

  #### D. As duas perguntas obrigatórias durante a auditoria

  A primeira já está no gatilho de início. A segunda é nova, e cobre o buraco
  que a primeira não vê — afirmar sem ter provado:

  > **1.** Quais regras se aplicam ao que acabei de fazer — e, para cada uma,
  > **onde está a evidência** de que cumpri?
  >
  > **2.** **O que estou afirmando agora que ainda não provei?**

  A segunda ataca a minha falha mais registrada: apresentar **inferência como
  fato** (§1.1). Ela deve entrar no gatilho de início junto com a primeira — e
  isso é execução, não decisão nova.

  #### E. A regra que fecha o item

  > **Não assumir que algo está protegido só porque existe uma regra para isso.
  > Verificar cobertura, acionamento e evidência.**

  Aplicável inclusive a esta auditoria: se ela terminar com uma lista de
  proteções que ninguém acionou nem viu falhar, ela não provou nada — provou
  apenas que eu sei escrever proteção.

  **Critério de aceite do item, então:** cada proteção proposta sai com (a) o
  que ela cobre, (b) como foi **acionada** para provar que funciona, e (c) o que
  ela explicitamente **não** cobre. As três, ou ela não entrou.

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

- ⬜ `[29/08]` 🟠 **O feed não mostrou um post recém-publicado, uma vez em sete.**
  *Achado no CI, não reproduzido ainda — está aqui para não sumir em silêncio.*

  Em 29/08 às 22:21 o `fluxos.mjs` falhou no passo 15: publicou e esperou 30 s
  o post aparecer no feed. **Ele nunca apareceu.** Na segunda execução, com o
  mesmo commit, passou.

  **O que eu confirmei no banco** (não é dedução): o post foi criado às
  22:21:02, `deleted_at`, `hidden_at` e `expires_at` todos nulos, a conta sem
  ban nem suspensão. A publicação funcionou inteira — o que falhou foi a tela
  refletir. As seis execuções anteriores do mesmo dia passaram, e o PR daquele
  momento não tocava em nada do caminho de publicação nem do feed.

  **Hipótese, ainda sem prova:** `onPost()` dispara UM refetch depois do
  insert; se aquele refetch não trouxer o post, nada refaz a busca, e o feed
  fica parado até navegar — o que casa com a tela vazia 30 s depois.
  Para confirmar: instrumentar o retorno do refetch (quantas linhas vieram e
  se o id do post recém-criado estava entre elas) e rodar o fluxo umas vezes.

  **Por que não é 🟢:** se a hipótese estiver certa, isto não é problema de
  teste — é uma pessoa publicando, não vendo o próprio post, e concluindo que o
  site comeu o que ela escreveu. O post existe; a tela mente. É §1.5.

- ⬜ `[29/08]` 🟠 **Aba "Fui banido / meu caso" na navegação lateral da LANDING.**
  *Ideia do dono em 29/08. Fica registrada com a armadilha junto, porque a
  parte difícil não é a tela — é decidir quem pode ver o quê.*

  A ideia: quem foi banido tem hoje só a `BannedScreen`, uma tela que cobre
  tudo e diz pouco. Vira uma página própria na landing, com o caso: o motivo,
  a data, o prazo, o id da conta e a situação do recurso.

  **A armadilha, e ela é de segurança.** A página é da landing, ou seja,
  pública. Se ela aceitar um email ou um usuário e responder "esta conta está
  banida", vira **oráculo de enumeração**: qualquer um descobre se um email
  tem conta, e se aquela pessoa foi punida. Isso é dado de terceiro exposto
  sem consentimento — o oposto do endurecimento de LGPD que já foi feito.

  **O caminho que não tem esse problema:** a pessoa **entra** e a página lê
  `auth.uid()`. O login continua funcionando para conta banida (ela só não
  navega no site), então a conta dela é a prova de identidade — sem oráculo,
  sem enumeração. O link para essa página sai de dentro da própria
  `BannedScreen` e da landing.

  **O que falta decidir antes de codar:** quais campos a pessoa vê (o motivo,
  sim; **quem** moderou, não — isso expõe a equipe a retaliação), e se o
  recurso passa a ser feito ali.

  Depende de: policy/RPC nova para a pessoa ler o próprio caso, rota nova,
  e o link dentro da `BannedScreen`.

- ⬜ `[29/08]` 🟢 **Página "Regras da comunidade" na navegação lateral.**
  Hoje o site modera, oculta e bane sem nenhuma página que diga **qual regra**
  foi quebrada. Isso enfraquece a moderação — punição sem regra escrita parece
  arbitrária — e é o primeiro link que a página de banimento acima vai querer
  apontar. Mesmo padrão da `/sobre`: conteúdo em arquivo, sem banco.

- ⬜ `[29/08]` 🟢 **Página "Privacidade / seus dados" na navegação lateral.**
  O projeto fez endurecimento de LGPD (colunas revogadas, dado de terceiro
  fechado) e não tem nenhuma página que conte isso a quem usa. Mesmo padrão da
  `/sobre`.

- ⬜ `[29/08]` 🟢 **Enfeitar a landing além do que já foi feito.**
  O dono disse em 29/08 que quer a landing "muito mais parruda", mas que por
  agora está bom. Fica anotado para não virar decisão esquecida.

- ⬜ `[01/09]` 🟢 **Áudio ambiente na landing — avaliar antes de implementar.**
  *Pedido do dono no prompt de 01/09.* Futurista, sutil, com botão manual
  quando o autoplay for bloqueado e preferência que persiste.

  **O que decidir ANTES de escrever código:** formato e compressão, quando o
  download começa (nunca no caminho crítico), quando o áudio é instanciado, e o
  comportamento de autoplay no celular. É recurso secundário: não pode
  atrapalhar o carregamento da landing.

- ⬜ `[01/09]` 🟢 **Elementos flutuantes novos na landing — propor antes de fazer.**
  *Pedido do dono no prompt de 01/09.* Diferentes dos que já existem, com
  cara de tecnologia/gamer, algum nível de interatividade, sem poluir.

  O dono pediu **proposta visual antes da implementação**. E o custo já tem
  regra medida: `transform`/`opacity` rodam no compositor e custam ~zero;
  qualquer coisa com laço de JS por quadro entra na conta da cena 3D.

- ⬜ `[02/09]` 🟡 **A idade mínima de 13 anos existe SÓ no navegador.**
  *Achado na auditoria de privacidade de 02/09. O levantamento inteiro está em
  [PRIVACIDADE.md](docs/PRIVACIDADE.md).*

  O `RegisterForm.jsx` limita a data pelo atributo `max` do input. **O banco não
  tem CHECK em `birth_date`** — conferido: existem CHECKs para `platform`,
  `playstyle` e `role`, e nenhum para a data. Com a `anon key`, qualquer um
  chama a REST API e cadastra a data que quiser (§1.3: validação no cliente não
  vale nada sozinha).

  **Por que pesa mais que política de produto:** a LGPD trata dado de criança e
  adolescente em artigo próprio, com consentimento específico.

  **Dimensionado:** 5 perfis, 2 com data, **nenhum** abaixo de 13 e nenhuma data
  absurda. Um CHECK entra sem rejeitar linha existente.

  **Falta a sua decisão:** qual é o piso — 13, 16 ou 18? O número é escolha de
  produto e jurídica, não minha. Com ele eu aplico a migration e travo.

- ⬜ `[02/09]` 🔵 **`login_attempts` e `admin_logs` sem política de retenção.**
  As duas são append-only e guardam dado pessoal — e-mail numa, quem fez o quê
  na outra. Sem prazo, crescem para sempre, e a LGPD fala em necessidade e
  prazo. Já existe infraestrutura de retenção em `lib/logMeta.js`; falta a
  decisão de por quanto tempo guardar.

- ⬜ `[02/09]` 🔵 **Google Fonts entrega o IP do visitante ao Google.**
  Único terceiro que a landing contacta (medido). Hospedar as fontes no próprio
  site elimina isso por alguns KB de banda. **Boa prática, não obrigação
  legal** — a distinção importa.

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

- ⬜ `[01/09]` 🔵 **UUID de staff exposto ao anônimo em duas tabelas públicas.**
  *Achado na auditoria de gatilhos de 01/09, sondando a REST API como visitante.*

  As duas tabelas que o visitante lê de propósito carregam junto a coluna de
  autoria: `site_config.updated_by` e `blocked_words.created_by`. Qualquer um
  sem conta lê o UUID de quem mexeu na configuração do site e de quem cadastrou
  cada palavra da lista.

  **Por que 🔵 e não mais:** é UUID, não nome. `profiles` responde **401** ao
  anônimo, então não há como mapear UUID → pessoa pela REST API. O impacto real
  hoje é ligar mudanças de config a uma conta, sem saber qual.

  **É CLASSE, não caso:** a pergunta certa não é "essas duas colunas incomodam?"
  e sim *"toda tabela legível pelo anônimo está devolvendo só o que a tela
  precisa?"*. A landing lê `site_config` para o modo manutenção e `blocked_words`
  para o filtro — **nenhuma das duas telas usa a coluna de autoria**.

  **Solução provável:** view ou `select()` explícito sem as colunas de autoria,
  em vez de `select=*`. Antes de revogar coluna, rodar a consulta de "quem lê"
  do [POSTURA.md](docs/regras/POSTURA.md) — revoke já derrubou o site três vezes.

  **Bônus a decidir junto:** a lista inteira de 322 palavras bloqueadas é
  pública. Isso é consequência do filtro rodar no cliente, não descuido — mas
  entrega a quem quiser burlar o dicionário exato. Vale registrar como decisão
  consciente em `DECISOES.md`, ou mudar de abordagem.

- ⬜ `[30/08]` 🟢 **Tornar o teste do painel independente de dado de produção.**
  Em 30/08 ele reprovou porque o site ficou sem post — não por defeito nenhum.
  O remendo de agora distingue "seletor quebrou" de "site vazio", e mantém a
  trava viva; mas o teste continua **medindo o banco** em vez de medir o painel.

  O certo é ele criar o próprio post antes de conferir a aba e apagá-lo depois,
  como o `fluxos.mjs` já faz. Aí a paginação volta a ser exercitada sempre, e
  não só quando alguém tiver postado.

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

- ⬜ `[23/08]` **Migrar o envio de email para fora do Gmail pessoal.** Hoje usa
  nodemailer com uma conta Google dedicada — melhor que a conta pessoal, mas o
  limite (~500/dia), o risco de o Google travar por envio automatizado, e a
  falta de painel de entrega continuam. Com domínio próprio (~R$40/ano) +
  Resend vira `nao-responda@…`; sem domínio, o Brevo é a opção. *Não é urgente
  com 3 usuários.*


## 🟢 Recomendado

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
