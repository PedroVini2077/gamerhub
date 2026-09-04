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

*Vazia.* A última tarefa — a arena de entrada com os personagens — fechou em
04/09. As seis etapas foram entregues, e as duas últimas correções vieram do
dono olhando a tela: o recorte do cadastro que deixava labareda no lado do gelo,
e o do login, que levava uma lasca laranja para a arte do gelo e um caco azul
para a do fogo.

**A causa raiz das duas era a mesma, e não era descuido de recorte:** as artes
trazem os dois lutadores numa imagem só, e **eles se sobrepõem por 75 colunas** —
não existe reta vertical que separe. A fronteira passou a ser a **cor** do pixel
na faixa disputada, com rampa de alfa para o halo não terminar num corte.
Medição, receita e números em [DESEMPENHO.md](docs/DESEMPENHO.md); a trava é
`e2e/artes-da-arena.mjs`, que conta 0 pixels invasores hoje e **638** com o
recorte antigo reinjetado.

> **Como usar esta seção.** Tarefa com múltiplas etapas: registre objetivo,
> etapas e estado aqui **antes de começar**, e atualize a cada etapa validada.
> Ao fechar, esvazie — isto é estado, não histórico. A regra inteira está em
> [EXECUCAO.md §9.5](docs/regras/EXECUCAO.md).

---

**Última conferência contra o sistema:** 02/09/2026, noite ·
**22 itens abertos** (+ 1 ideia sem compromisso)

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

## 🟠 Importante — precisa de ação ou decisão do dono

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



- ⬜ `[23/08]` 🟠 **Migrar o envio de email para fora do Gmail pessoal.**
  *`[03/09]` O dono decidiu ficar no Gmail por enquanto: "não quero gastar 40
  dólares cobrando um domínio agora, talvez mais tarde". A resposta de contato
  foi construída em cima dele — e passou a ser mais um consumidor da MESMA cota
  do cadastro e da recuperação de senha.*

  Hoje usa nodemailer com uma conta Google dedicada — melhor que a conta pessoal, mas o
  limite (~500/dia), o risco de o Google travar por envio automatizado, e a
  falta de painel de entrega continuam. Com domínio próprio (~R$40/ano) +
  Resend vira `nao-responda@…`; sem domínio, o Brevo é a opção. *Não é urgente
  com 3 usuários.*


## 🟢 Recomendado

- ⬜ `[04/09]` 🟢 **Dividir o resto do `src/index.css` (550 linhas).** *Metade da
  dívida foi paga hoje; esta é a outra metade, e ela precisa da sua aprovação.*

  Ao entregar a arena eu tinha inflado o `index.css` de 676 para 948 linhas. O
  bloco que **eu** criei saiu para `src/estilos/arena.css` (§4: sujeira minha,
  eu limpo, sem perguntar) e o arquivo voltou a 550.

  **Continua acima das 300**, e as 550 que restam são anteriores a esta sessão:
  fontes, base, `.card`, botões, tags, inputs, animações e a luz do site logado.
  Separá-las é mecânico — mesmos arquivos, mesma ordem de `@import` —, **mas
  encostaria em toda tela do site de uma vez**, e misturar isso num PR visual é
  exatamente o que a receita do §4 desaconselha ("uma extração por commit").

  Então fica registrado com o motivo, como manda a regra, em vez de sumir.


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
  fatias (`src/lib/`, <!--n:src.lib.arquivos-->87<!--/n--> arq ·
  <!--n:src.lib.linhas-->7.233<!--/n--> linhas; `src/services/`,
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
