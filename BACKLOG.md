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

**53 itens abertos** (+ 5 desativados, no bloco do fim)

> **`[09/10]` Este arquivo tinha 2.758 linhas, e o primeiro item da fila
> aparecia na 1.213.** Quase metade dele era passado: 22 seções já concluídas
> com ✅, o plano de uma sessão que já aconteceu, e 280 linhas de uma
> reformulação cujo próprio texto dizia *"a FATIA 7 fechou"* debaixo de um
> título que dizia *"em execução"*.
>
> É o mesmo diagnóstico que abre o §6.2 — *"1.330 linhas, das quais 129 eram a
> lista"* — de volta, e por eu não cumprir a regra 2 (*"item concluído SAI"*)
> 22 vezes. O histórico não se perdeu: ele está no `git log`, nos PRs, no
> `DECISOES.md` e nos relatórios de `db/`.


## 🔄 EM EXECUÇÃO

### `[10/10]` A tabela de conquistas — o REGISTRO do desbloqueio

**Pedido dele em 09/10:** *"Vc disse que a tabela de conquistas não tem, pode
fazer tbm 👍🏻"* — depois de o estudo de cosméticos medir que as conquistas são
**derivadas** e que, sem persistência, não existe *"desbloqueado para sempre"*.

**O que isto NÃO é, e a distinção decide tudo.** O cabeçalho de
`lib/conquistas.js` recusou a tabela em 05/09 com a pergunta do §0.2 —
*"quantas vezes por dia isso roda?"* — e a resposta era *"uma escrita por
interação de todo mundo"*, porque o desenho pressuposto era **gatilho em
`posts`, `post_likes` e `comments`**. Não é esse. Aqui a escrita acontece
**uma vez por conquista, por pessoa, para sempre**: no máximo 8 linhas por
conta, gravadas quando ela abre o PRÓPRIO perfil e algo novo cruzou a meta.
A recusa de 05/09 continua válida para o desenho que ela recusou.

| | o que foi recusado em 05/09 | o que entra agora |
| --- | --- | --- |
| gatilho | em toda tabela de conteúdo | **nenhum** |
| escritas | 1 por post, curtida e comentário | ≤ 8 por conta, **na vida** |
| quando | a cada interação | ao abrir o próprio perfil, se algo cruzou |

**Etapas:**

1. ✅ migration **escrita** — `20261010000000_conquistas_desbloqueadas_tabela.sql` +
   `20261010000100_conquistas_desbloqueadas_funcoes.sql`:
   tabela + RLS + `REVOKE` (SEC-052) + as duas funções + o backfill
2. ✅ a RPC `registrar_conquistas()` mede no SERVIDOR e **não recebe
   parâmetro** — é aí que mora a proteção (§1.3, o site usa a `anon key`)
3. ✅ trava `conquistaNaoDerivaDoBanco.test.js` — 20 checagens, **provada
   reinjetando 6 bugs**, cada um reprovou na checagem certa
4. ✅ a tela ganha a data, e só a data (`useConquistas` + `ConquistasCard`)
5. ✅ **provado em `ROLLBACK`** — 10 de 10 veredictos OK: forjar `INSERT`,
   `UPDATE` e `DELETE` todos bloqueados, `medir_conquistas` de outra pessoa
   bloqueada, RLS mostrando 1 própria e 0 alheias, `anon` barrado nas duas
   portas, a RPC idempotente (2ª chamada devolve 0) e `retroativa=false` no
   que ela gravou. Backfill: **5 linhas, 5 pessoas, só `um_mes_de_casa`** —
   o número que eu tinha dimensionado antes
6. 🟠 **APLICAR — é dele, e eu não alcanço.** O `apply_migration` e todo
   `execute_sql` que **efetiva** são recusados nesta sessão (leitura e
   `BEGIN…ROLLBACK` passam — medido, 5 linhas de evidência no `OPERACAO.md`).
   O passo a passo está em
   [`docs/OPERACAO.md`](docs/OPERACAO.md) → *"APLICAR UMA MIGRATION QUANDO EU
   NÃO CONSIGO"*: link direto do SQL Editor, os dois arquivos **em ordem**, a
   consulta de conferência com os 4 números esperados, o que pode dar errado
   (conferido antes) e como desfazer.
7. 🟠 **O MERGE ESPERA a etapa 6**, e isso é regra nova escrita no
   `OPERACAO.md`: código que chama RPC inexistente **degrada em silêncio** —
   os services devolvem o vazio seguro, a tela renderiza sem data, nada
   estoura. Parece entregue e não está (§1.5).

**Decisões tomadas, com o motivo:**

- **O backfill vai na migration, com `retroativa = true`.** Sem ele, quem já
  tem sete conquistas receberia **a data de hoje** nas sete — uma data que se
  apresenta como história e não é (§1.1). Varrendo a base de uma vez, tudo o
  que foi gravado depois tem data verdadeira, e a RPC nunca precisa decidir se
  é o primeiro registro daquela conta.
- **A tela NÃO muda o que considera concluída.** Isso é a decisão pendente nº 1
  do estudo (*desbloqueio permanente ou condicional?*), e ela é dele. O que
  entra é só a infraestrutura + a data; trocar a origem do "concluída" depois é
  uma linha, com os dados já no lugar.

## 🔴 ACHADOS DE SEGURANÇA — `[10/09]`


- ⬜ `[12/09]` 🟡 **SEC-015 · a INVERSA do ban existe para a marca, não para o
  CONTEÚDO — e é DECISÃO DO DONO.** *BLOCO B.*

  `ban_user` faz `DELETE FROM posts / comments / community_posts / live_chat`.
  `DELETE` de verdade, não `soft_delete` — e o projeto TEM o caminho reversível
  (`soft_delete_post` marca `deleted_at`, e existe `restore_post`).

  | | quem pode | reversível? |
  | --- | --- | --- |
  | marcar banido | **admin** (rank 2) | sim |
  | apagar todo o conteúdo | **admin** (rank 2) | **NÃO** |
  | desbanir | **super_admin** (rank 3) | — |

  **Quem destrói é um nível ABAIXO de quem desfaz**, e o que ele destrói é a
  parte sem volta. O desbanimento devolve a conta e não devolve nada do que a
  pessoa escreveu — e a notificação ainda diz *"sua conta voltou ao normal"*.

  **Pode ser intencional** (banir para purgar é política defensável), e por isso
  não é 🟠. Mas se for, precisa estar escrito e a mensagem precisa parar de
  prometer o que não entrega. **Decisão de produto.**

- ⬜ `[12/09]` 🔵 **A política de senha do painel de Auth nunca foi conferida.**
  *BLOCO F, e vem com a parte que eu quase errei.* O advisor pede para ligar a
  proteção contra senha vazada (HaveIBeenPwned). **Pesquisei antes de virar
  tarefa para você, e ela é do plano PRO** — não existe botão para clicar no
  Free, e esse aviso vai aparecer em todo advisor para sempre. Não é
  configuração, é dinheiro.

  **O que dá para fazer no Free**, na mesma tela: comprimento mínimo e classes
  de caracteres obrigatórias. Hoje o site só mede força **no cliente**
  (`lib/password.js`), e validação no cliente não vale nada sozinha (§1.3) —
  quem chama a API de auth direto passa por cima. Falta eu escrever o passo a
  passo no `OPERACAO.md` (§9.12) e você conferir o que está configurado.

- ⬜ `[12/09]` 🔵 **`admin_list_users` faz `SELECT * FROM profiles`.** *BLOCO D.*
  Devolve **todas** as colunas para qualquer admin, inclusive as que a tela não
  usa. Não é brecha — admin é cargo autorizado —, é minimização de dado e
  egress (§6.1): a cota mais apertada do Supabase paga por coluna que ninguém
  lê. Trocar por lista explícita de colunas.

- ⬜ `[17/09]` 🟡 **TRÊS soluções para o mesmo problema de alarme repetido — e
  eu criei a segunda e a terceira.** *DECISÃO DELE.*

  | Função | Estratégia | Ganha | Perde |
  | --- | --- | --- | --- |
  | `registrar_falha_de_edge_function` | **suprime** a repetição | trilha estritamente append-only | a contagem |
  | `record_banned_login_attempt` (SEC-023) | **atualiza** a linha | "9 vezes" é sinal de verdade | a linha deixa de ser imutável |
  | `notify_admin_new_live` (SEC-034, `[18/09]`) | **atualiza** a linha | idem | idem |

  > **`[18/09]` Eu piorei a divergência em vez de resolvê-la.** A SEC-034
  > precisava de deduplicação urgente (31% das notificações de admin eram spam
  > de live), e eu copiei o desenho do `record_banned_login_attempt` por
  > consistência — sem trazer a decisão para cá primeiro. Foi a escolha certa
  > para não inventar um quarto padrão, e a errada por adiar de novo o que já
  > estava esperando decisão há um dia. Agora são 2 a 1 a favor de "atualizar";
  > se for essa a decisão, sobra só o `registrar_falha_de_edge_function` para
  > alinhar.

  A primeira tem a razão escrita no código: *"a trilha é append-only, então não
  dá para incrementar um contador na linha existente sem mudar essa natureza"*.
  **Eu li isso DEPOIS de aplicar o SEC-023** — o argumento é legítimo e eu não o
  considerei antes de escrever.

  A favor de atualizar: aqui a contagem **é** a informação. "Tentou 1 vez" e
  "tentou 30 vezes em meia hora" são fatos diferentes, e a linha alterada
  descreve evento **do sistema**, não ação humana.

  Alinhar é barato nos dois sentidos. O que não pode é ficar com duas respostas
  para a mesma pergunta (§4, fonte única).

- ⬜ `[12/09]` 🔵 **`notify_user` aceita 9 tipos; o sino estiliza 4.** *BLOCO D.*
  `warning`, `info`, `success`, `error`, `system` e `role` estão na lista
  fechada da RPC e **não** estão no `NOTIF_META` — caem no sino genérico. Não é
  bug: o `DESCONHECIDO` é fallback deliberado e visível. Mas a RPC promete mais
  do que a tela desenha, e escolher ícone é decisão de design. Ou entram no
  mapa, ou saem da lista da RPC.

- ⬜ `[12/09]` 🔵 **O buraco que sobrou da régua de `anon`: `GRANT` explícito.**
  O `ALTER DEFAULT PRIVILEGES` fecha a tabela NOVA por padrão, mas não impede
  alguém de escrever `GRANT SELECT ... TO anon` numa migration futura. O que
  pegaria isso é o `portas-do-banco.mjs`, e ele só enxerga as tabelas da lista
  dele — tabela nova com grant explícito ficaria fora dos dois.

  **Conserto possível:** o roteiro enumerar as tabelas em vez de usar lista
  fixa, e exigir 401 em todas menos `site_config`. Não feito agora porque ele
  roda com a chave anônima e não consegue listar o schema — precisaria de uma
  RPC só para isso, e RPC nova aberta a `anon` é exatamente o que a régua
  proíbe. Registrado para decidir com calma.

## 🟡 ACHADOS OPERACIONAIS — `[10/09]`

- ⬜ `[01/10]` 🔵 **Cachear o Chromium do Playwright, SE travar de novo.**
  *Achado de hoje, e o gatilho é objetivo.* O job `painel de admin` ficou
  **115 minutos** parado em "Instalar o Chromium do Playwright" — download de
  dependência, antes de qualquer teste. Não era o site (respondia em 0,2 s),
  não era o código, não era fila (só havia aquela execução). Os outros dois
  jobs de navegador levaram 3 e 6 min no mesmo run.
  **Já tratado:** todos os 6 jobs ganharam `timeout-minutes` (eram **zero**,
  e o padrão do GitHub é SEIS HORAS). Agora ele falha em 25 min dizendo o que
  é, em vez de travar.
  **Não fiz o cache** porque foi a 1ª vez em meses e `actions/cache` é
  manutenção permanente para um problema que pode ter sido instabilidade da
  CDN (§9.8, pergunta 6). **Se travar de novo**, aí o cache se paga.

- ⬜ `[03/10]` 🔵 **COMPARTILHAR TELA estilo Discord — dá para fazer, e o que
  decide é que NENHUM navegador de celular suporta.** *Pergunta dele em 03/10,
  depois esclarecida: era compartilhamento de tela para poucos, não transmissão
  para o mundo.*

  **Dá, e a API é padrão:** `navigator.mediaDevices.getDisplayMedia()`. Não
  precisa de extensão nem de app.

  ### O fato que decide, medido no caniuse em 03/10

  | | |
  | --- | --- |
  | iOS Safari | ❌ sem suporte, **todas** as versões |
  | Chrome para Android | ❌ |
  | Firefox para Android · Samsung Internet · Opera Mobile | ❌ |
  | **suporte global** | **35,85%** |

  Metade da web é celular, e **nenhum celular compartilha tela pelo
  navegador**. Quem ASSISTE pode estar em qualquer aparelho — receber vídeo é
  trivial. Quem COMPARTILHA precisa de computador.

  **Isso não é detalhe de implementação: é quem pode usar a funcionalidade.**
  O próprio dono usa o site pelo celular — ele conseguiria ver, não
  compartilhar.

  ### Custo, se for em frente

  Tela 720p30 ≈ 2 Mbps = **900 MB por hora de espectador**.

  | Caminho | Grátis | Depois |
  | --- | --- | --- |
  | **Cloudflare Realtime** (SFU) | 1.000 GB ≈ **1.110 h de espectador** | US$ 0,05/GB |
  | Malha P2P, sem servidor | de graça | — |

  **Na malha o gargalo não é dinheiro, é o UPLOAD de quem compartilha:** sem
  SFU ele manda uma cópia para cada espectador. Três espectadores a 2 Mbps são
  **6 Mbps de subida**, e conexão residencial é assimétrica — o upload é a
  metade curta. Até 2 espectadores a malha serve; acima disso precisa de SFU, e
  aí volta a coluna de cima.

  **Os dois cobram em silêncio depois do teto**, como o LiveKit das salas de
  voz. Entraria obrigado a um teto nosso antes do deles (§0.2).

  ### O custo que decide, e aqui é o maior de todos

  **Tela compartilhada mostra qualquer coisa** — e a moderação daqui funciona
  por amostragem de quadros de vídeo **já enviado** (`MODERACAO-IA.md`). Ao
  vivo não existe "depois". Com idade mínima de 13 anos, isso é o §1.3 com
  resposta óbvia e nenhuma defesa pronta.

  **Minha recomendação:** não agora, e não por custo. Uma funcionalidade que
  metade dos aparelhos não alcança, que não tem como moderar, e que o próprio
  dono não conseguiria usar do celular, entrega menos do que parece. O Discord
  resolve isso hoje por R$0.

  **O que mudaria a conta:** haver gente no site, em computador, querendo
  mostrar jogo um para o outro. Aí a decisão volta — e o teto nosso e a
  moderação vêm antes do código.


- ⬜ `[03/10]` 🔵 **SALAS DE VOZ — o custo em DINHEIRO é ~R$0, e não é ele que
  decide.** *Pergunta dele em 03/10: "tô pensando em salas de voz… qual seria o
  custo disso agora?"*

  **Medido nos preços de hoje, não de memória** (fontes no chat de 03/10):

  | Caminho | Grátis por mês | Quanto isso dá, em sala de 5 |
  | --- | --- | --- |
  | **Cloudflare Realtime** (SFU + TURN) | 1.000 GB | **~3.470 h/mês** |
  | Malha P2P (sem servidor) + TURN da Cloudflare | idem, e só ~15% do tráfego passa pelo TURN | praticamente ilimitado até 4 pessoas |
  | LiveKit Cloud (Build) | 5.000 min de participante | **~16 h/mês** — e cobra depois |

  A conta: voz Opus ≈ 32 kbps = 14,4 MB por hora de stream. Sala de 5 num SFU
  são 20 streams-hora por hora de sala = 288 MB/h.

  **O LiveKit está fora por um motivo que não é o preço:** o plano grátis é
  *pay-as-you-go* depois do teto — ele **cobra em silêncio**. Seria o primeiro
  serviço do projeto a fazer isso, e o §0.2 inteiro existe porque cota que
  estoura sem ninguém saber é o padrão que já nos pegou duas vezes.

  **O que custa de verdade, e é por isso que isto é 🔵 e não 🟠:**

  1. **Moderação não alcança voz.** O subsistema inteiro — wordlist, IA de
     texto, IA de imagem, fila — é para conteúdo que fica gravado. Voz não
     deixa rastro, e o site tem idade mínima de 13 anos. Uma sala sem
     moderação possível é a classe do §1.3: "pensar em como isto seria
     abusado" tem resposta óbvia e nenhuma defesa pronta.
  2. **LGPD.** Voz é dado pessoal. A `PRIVACIDADE.md` descreve o que o site
     coleta **medido na implementação**; ligar voz exige mexer no documento e
     no aceite — e documento legal tem trava própria (`documentosLegais`).
  3. **Teto de conexões simultâneas do Supabase:** 200 no plano grátis, e a
     sinalização do WebRTC gastaria uma por pessoa em sala. Não morde hoje;
     morde no dia em que o site tiver gente, que é justamente quando a
     feature faria sentido.

  **Minha recomendação:** se o objetivo é *ter voz agora*, um convite para
  **Discord** custa R$0, zero código e já tem moderação de voz pronta. Sala
  nativa só compensa quando o site tiver gente suficiente para que sair dele
  seja o problema — e aí a decisão volta com os três custos acima na mesa.


- ⬜ `[02/10]` 🔵 **Três roteiros E2E ainda têm o login INLINE.** *Dívida que
  eu declarei ao extrair o `entrar`/`sair` para `e2e/util.mjs`.*

  `fluxos.mjs`, `lives.mjs` e `painel-admin.mjs` repetem o mesmo trecho de
  login. O `duasContas.mjs` seria a quarta cópia, então o helper nasceu — mas
  migrar os três exigiria tocar o `painel-admin.mjs`, que está em **449
  linhas** e me obrigaria a dividi-lo no meio de outra tarefa (§4).

  **Não é urgente:** as quatro cópias fazem a mesma coisa e nenhuma está
  errada. O risco é a deriva — mudar o seletor do botão de entrar conserta uma
  e deixa três quebrando no CI com `waiting for locator`.

  **Quando for feito, o `painel-admin.mjs` sai junto** — ele é o único arquivo
  de `e2e/` acima de 300 linhas.


- ⬜ `[10/09]` 🔵 **`unsilenceUser` existe duas vezes**, com assinaturas
  diferentes: `liveService.unsilenceUser({postId, userId})` e
  `useAdminLiveActions.unsilenceUser(id)`. Os dois foram corrigidos junto no
  SEC-007, mas **cópia diverge** (§4, fonte única) — foi assim com os ícones de
  log, os rótulos de cargo e a regra de bloqueio de login. Unificar exige
  decidir uma assinatura só, e o hook apaga por `id` da linha enquanto o serviço
  apaga por par: não é troca mecânica.

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[25/09]` 🟠 **O QUE CONTINUA SENDO DECISÃO DELE — o resto das duas perguntas**

  **1. "Eu como owner posso ter um painel próprio de publicar notícias?"**

  **Minha recomendação: NÃO um segundo editor — mas SIM uma visão editorial no
  `/owner`.** Dois editores são duas implementações que divergem (§4), e a
  diferença entre owner e admin já está expressa no lugar certo: os botões que
  aparecem. O que falta no `/owner` não é a ferramenta de escrever, é o **estado
  do jornal**: quantos rascunhos esperando revisão, o que está agendado, o que
  saiu na semana. Isso é informação de fundador, não cópia de painel.

  **2. "As recomendações por IA, acha bom implementar?"**

  **Sim, mas só como ASSISTENTE de quem escreve — nunca como autor.** O corte:

  | Cabe | Não cabe |
  | --- | --- |
  | sugerir resumo/subtítulo **a partir do corpo que ele já escreveu** | escrever a matéria a partir do título |
  | sugerir editoria pelo título | inventar fato, data, número ou citação |
  | avisar "este texto não tem link de fonte" | publicar sem gente ler |

  **O motivo não é técnico, é o que está escrito na landing:** *"apurado pela
  equipe, sem caça-clique e sem repost sem fonte"*. IA que redige a partir de um
  título produz exatamente o contrário, com a marca do GamerHub assinando.

  **O custo, que é a parte que ninguém pergunta (§0.2 regra 2):** a chamada seria
  **uma por matéria** — algumas por dia, não por tecla. Essa é a forma certa. Mas
  **não existe orçamento de IA decidido**, e toda cota grátis deste projeto já
  estourou pelo menos uma vez.

  **Onde a IA paga de verdade:** na ingestão (`news_items_raw`), resumindo o item
  coletado num rascunho que o editor reescreve. Mas isso exige a ingestão primeiro.

  ---

- ⬜ `[18/09]` 🧪 **EXPERIMENTO NO PREVIEW — o Ato 0 como PORTAL em SVG**

  **Pedido dele:** *"na documentação fala algo sobre tirar as cenas em imagem e
  usar SVG, quero que vc faça a mudança só na primeira cena, algo que faça sentido
  com portal… e queria ver na preview, **depois pode desfazer**"*.

  **Onde ele está:** na branch **`preview`**, e SÓ nela. O `PortalDoAtoZero.jsx`
  substitui `CENAS.hero` nos dois caminhos do prólogo (o normal e o de
  `prefers-reduced-motion`); as outras seis cenas continuam sendo arte gerada.

  > **`[18/09]` Ele foi para a `main` por engano e voltou no mesmo dia.** O PR #211
  > levou junto a fiação do portal, e mergear pôs em PRODUÇÃO um experimento que o
  > pedido dele mandava ver **na preview** — *"queria ver na preview, depois pode
  > desfazer"*. Pior: contrariava o que ele já tinha dito em 17/09, *"vc não vai
  > alterar nada, pq da última vez vc deixou a landing feia"*.
  >
  > A produção voltou para `CENAS.hero`. O arquivo continua no repo, testado e
  > documentado — o que mudou é **onde ele está ligado**. A lição é do §9.9:
  > LOCAL, COMMIT, PUSH, PR, MERGE e PRODUÇÃO não são o mesmo estado, e juntar um
  > experimento visual com correção de segurança num PR só apaga essa diferença.

  **⚠️ A ARTE DO HERO FICOU ÓRFÃ.** As seis variantes de `1-hero-*` continuam no
  repositório sem ninguém mostrá-las (~500 kB). Isso é exatamente o defeito que a
  trava `prologo.test.js` existe para impedir — e ela **passou a exigir este item
  escrito** enquanto o experimento durar.

  **As duas saídas, e as duas são decisão dele:**

  | Se ele… | O que acontece |
  | --- | --- |
  | **gostar do portal** | os seis `1-hero-*` são APAGADOS, e o `cenasDaLanding.js` perde a entrada |
  | **não gostar** | uma linha em cada prólogo volta o `<ArteDaCena arte={CENAS.hero} prioridade />`, e o portal + o CSS saem |

  **Nada disto é permanente até ele decidir.** Registrado aqui porque achado que
  vive só na conversa é o que o §6.2 proíbe.

  ---

- ⬜ `[19/09]` 🟢 **RPC administrativa NOVA não entra sozinha na guarda da
  SEC-043.** *`[24/09]` **Rebaixado de 🟠 para 🟢**: a parte que importava foi
  fechada pela SEC-050.*

  **O que mudou.** O `auditoria_de_operadores()` sempre soube responder — ele
  varre `pg_proc` e acha RPC administrativa sem `exige_operador_ativo()`. O que
  faltava era **alguém ouvi-lo**: a função tinha `EXECUTE` revogado de todos, e
  só rodava quando eu perguntava à mão. Hoje o `e2e/portas-do-banco.mjs` a
  consulta pelo mensageiro, com a anon key, **a cada PR**. Provado: uma RPC
  administrativa nova sem a guarda leva o contador de 0 para 2.

  **O que sobra, e é pouco:** a detecção é por **heurística de corpo** (a função
  menciona `role_rank`/`is_staff`/`is_super`/`is_owner`). Uma RPC administrativa
  que decidisse permissão por outro caminho não seria vista. Não conheço nenhuma
  assim hoje; se aparecer, o jeito é a lista de exceções **com motivo escrito**,
  que a trava `auditorDoBancoEhOuvido.test.js` já vigia.

- ⬜ `[18/09]` 🔵 **`lives_realizadas` é append-only e o E2E escreve nela a cada
  execução.** *Achado enquanto eu limpava as 3 órfãs do N16.*

  Cada `e2e/lives.mjs` no CI acrescenta **uma linha permanente**. Ela é órfã por
  desenho (o post é apagado pelo cron), então nada a remove — nem cascade, nem
  retenção.

  Hoje é ~1 linha por PR e não custa nada. Mas é exatamente o padrão que a
  faxina (§6.1, item 5) manda vigiar: tabela append-only sem retenção, igual a
  `admin_logs`, `login_attempts` e `live_chat`.

  **Por que não resolvi agora:** a saída óbvia — o E2E apagar a própria linha —
  exigiria dar `DELETE` em `lives_realizadas` para `authenticated`, que é a
  régua de papéis ao contrário. A saída certa é entrar no
  `cleanup_old_data()` (o cron das 04:00), com uma regra de retenção que valha
  para **todo mundo**, não só para a conta de teste. Isso é decisão de produto:
  *por quantos meses a prova de que uma live aconteceu precisa existir?*

  As 3 órfãs de hoje já foram apagadas — eram minhas, do `claudetester`.


- ⬜ `[11/09]` 🟡 **A foto do remetente do e-mail é a letra "G".** *Ação do dono
  — e o caminho não é o que este item dizia até hoje.*

  **Correção de informação errada minha (§6.2):** este item afirmava que era
  *"configuração no painel do Brevo (o avatar do remetente)"*. Não é — o Brevo
  não controla isso. O que o Gmail desenha ao lado do remetente vem do **perfil
  Google do endereço que assina o `From:`**, ou de **BIMI**. Sem um dos dois, o
  Gmail cai na inicial do nome de exibição — e o nosso é `GamerHub`, daí o "G".

  Os dois caminhos, com o custo de cada um, estão escritos em
  [`docs/OPERACAO.md`](docs/OPERACAO.md).

- ⬜ `[05/09]` 🟢 **O lembrete de auditoria não enxerga fase parada.** Ele
  compara a data do relatório **mais recente** com 90 dias. Como as Fases 2 e 4
  rodaram em 05/09, ele fica quieto — **mesmo com as Fases 1 e 3 paradas desde
  21/08**. O relógio dele não distingue fase.

  Conserto pequeno: guardar a fase no nome do arquivo (já está: `fase4-...`) e
  medir a idade **por fase**. É limitação minha, encontrada por mim, e está
  aqui para não depender de eu lembrar.

- ⬜ `[10/09]` 🟡 **`blocked_words` ficou SEM PORTÃO do lado logado.**

  O `e2e/portas-do-banco.mjs` vigiava a lista de palavrão pelo lado anônimo. O
  SEC-004 fechou `blocked_words` para `anon` — corretamente: os quatro lugares
  que chamam `useBlockedWords` e o painel de moderação vivem **todos** atrás de
  `RequireAuth`, conferido rota a rota no `App.jsx`. `authenticated` manteve as
  5 colunas.

  **O que se perde:** aquele arquivo roda com a chave anônima, então ele deixou
  de conseguir enxergar a tabela. O risco que a linha guardava continua vivo do
  lado logado — se a lista sumir, `checkContent` **aprova tudo em silêncio**, e
  é a falha muda clássica (§1.5): nada estoura, nada loga, e a moderação
  simplesmente para de acontecer.

  **Onde ele caberia:** o job `fluxos autenticados` do CI já faz login. Uma
  asserção lá — "a wordlist carregou com N > 0 palavras" — fecharia o buraco
  sem credencial nova.

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


- ⬜ `[29/08]` 🟢 **Avaliar um rodapé para o site logado.** A decisão foi
  começar pela landing (camada 1). O site logado tem barra lateral e cabeçalho
  próprios, onde rodapé grande disputa espaço com o conteúdo — pode ser que o
  certo lá seja uma versão bem enxuta, ou nenhum.

## 🟠 Importante — dá para fazer

- ⬜ `[02/10]` 🔵 **O GamerHub News está DE PÉ — o que falta são três acabamentos**

  > **`[02/10]` Este item encolheu porque foi conferido contra o código, não
  > contra a memória (§1.4).** Ele listava 8 etapas e duas estavam marcadas
  > erradas: a **etapa 5** (cena do News na landing) aparecia como *PARCIAL* e
  > está **feita desde 25/09, com a arte dele** (PR #251, `5-marca` em
  > `src/assets/landing/cenas/`); e a **ingestão automática** aparecia como "a
  > tabela existe e está fechada", quando o radar enche `news_items_raw` desde
  > 26/09 — **801 manchetes** medidas em 02/10.
  >
  > As 8 etapas do plano de 25/09 estão **todas concluídas**, e por isso saíram
  > daqui (§6.2 regra 2). O histórico está nos PRs #246 a #255 e no
  > `PLANO-FEED-BUSCA-NEWS.md`.

  **O que o News ainda não tem.** Nenhuma destas impede usá-lo — ele cria,
  escreve, revisa, publica, lê e tem radar de pautas.

  | falta | o que custa | por que não entrou |
  | --- | --- | --- |
  | **capa por upload** | bucket + policy + compressão (`lib/image.js`) | hoje é URL colada, e funciona. É bloco próprio, com egress junto |
  | **agendamento pela tela** | um job que vire `scheduled` em `published` | o banco **aceita** `scheduled` e a tela não oferece. Sem o job, agendar seria promessa que ninguém cumpre — e o `vocabularioDoNewsNaoDeriva` já trava os dois lados |
  | **paginação da lista** | cursor, como o feed já faz | teto de 30 (`TETO_DA_LISTA`), **dito na tela**. Só dói quando passar de 30 artigos |

  **A ordem que eu sugiro**, se for retomar: paginação (menor, e a fundação já
  existe no feed) → agendamento (o banco já aceita) → capa por upload (o maior,
  e o único que mexe em egress).

- ⬜ `[26/09]` 🔵 **Gerenciar as fontes do radar pela TELA**

  Hoje ligar, desligar e acrescentar fonte é `UPDATE`/`INSERT` no banco — o passo
  a passo, **com a conferência de `curl` que vem antes**, está no
  `docs/OPERACAO.md`.

  **Por que não entrou agora:** é um CRUD inteiro (listar, criar, validar a URL,
  ativar/desativar) e o radar já funciona sem ele com 12 fontes. Trocar uma fonte
  é coisa de mês, não de dia.

  **O que a tela precisaria fazer e o banco não faz sozinho:** bater no feed antes
  de salvar. Fonte que responde 403 entra na lista, consome uma requisição por
  clique e contribui com zero — e isso não gera erro nenhum, só uma linha no
  "não responderam".

  ---

- ⬜ `[25/09]` 🔵 **A procedência da IA é AUTODECLARADA, não registrada**

  `news_articles.redigido_com_ia` é marcado pelo painel quando o editor aplica o
  rascunho. Serve à **procedência honesta**, não a fiscalizar: quem quiser
  esconder, desmarca salvando de novo.

  **O que fecharia de verdade:** registrar cada geração em `admin_logs` — quem
  pediu, quando, e o tamanho das notas. Aí a trilha responde *"esse texto veio de
  IA?"* sem depender de ninguém marcar.

  **Por que não entrou agora:** é action nova em `lib/logMeta.js` (com ícone, que
  tem trava), e a Edge Function teria de gravar por conta — mais superfície num
  bloco que já está grande. E o volume é de algumas matérias por dia, então o
  risco de alguém "esconder" hoje é teórico.

  ---

- ⬜ `[25/09]` 🔵 **A política de dados da Groq é INFERIDA, não lida**

  O provedor foi escolhido pelo que **deu para verificar** (ver
  `docs/DECISOES-FERRAMENTAL.md`, 25/09): os termos do Gemini grátis dizem, com
  todas as letras, que usam o conteúdo para melhorar produtos do Google e que
  *"human reviewers may read, annotate, and process your API input and output"* —
  e pedem para não submeter informação confidencial. Rascunho de matéria é
  conteúdo não publicado, então o Gemini grátis está fora.

  **O que eu NÃO consegui verificar:** a frase "não treinamos com os seus dados"
  no texto oficial da Groq. Terceiros afirmam; terceiro não é fonte (§1.1). O DPA
  deles diz algo mais estreito — processar só para prestar o serviço — e a
  **ausência** da cláusula de "melhorar nossos produtos" é a diferença real.

  **O que resolveria:** escrever para a Groq e guardar a resposta, ou pagar o
  Gemini. Decisão dele, e só vale a pena quando o News tiver conteúdo que doa
  vazar.

  ---

- ⬜ `[25/09]` 🔵 **A wordlist inteira é legível por qualquer pessoa logada**

  Achado enquanto eu fechava a SEC-053. `blocked_words_select` é `USING (true)`:
  qualquer conta lê as **322** palavras da lista de moderação pela REST API. Quem
  tem a lista tem o mapa para contorná-la.

  **Por que NÃO fechei junto, e não é preguiça.** O compositor, o mural, os
  comentários e o chat leem essa lista **pelo cliente** (`useBlockedWords`) para
  avisar a pessoa **antes** de ela enviar. Fechar a policy apagaria esse aviso —
  e é exatamente a classe de conserto que já derrubou o site três vezes aqui
  (revogar coluna de `profiles` parou post, comentário, mural e chat).

  **O que muda de verdade se fechar:** nada passa a escapar da moderação — o
  banco checa sozinho (`checar_palavras_bloqueadas`, e os triggers de post,
  comentário e chat). O que se perde é o aviso amigável: a pessoa publica e o
  conteúdo é ocultado/enfileirado depois, em vez de ela ser avisada na hora.

  Isso é **decisão de produto**, não de segurança:

  | Saída | Ganha | Perde |
  | --- | --- | --- |
  | **deixar como está** | aviso antes de enviar | a lista é pública para quem tem conta |
  | **fechar a policy** | a lista vira segredo da equipe | o aviso some; a pessoa descobre depois |
  | **RPC `SECURITY DEFINER` que responde só "este texto tem termo bloqueado?"** | os dois: aviso mantido, lista escondida | uma ida ao servidor por checagem — e é **exatamente** a conta do §0.2 regra 2 (quantas vezes por dia isso roda?) |

  **Minha recomendação:** a terceira, **se e quando** a lista virar algo que
  valha esconder. Hoje ela é lista de palavrão, não de estratégia — 🔵 de
  propósito.

  > ### ✅ `[25/09]` ELE DECIDIU: fazer a RPC
  >
  > *"Pode fazer tbm a rpc que só responde tem termo bloqueado"*. Ou seja: o aviso
  > antes de enviar continua, e a lista deixa de ser legível por qualquer conta.
  >
  > **O que eu preciso resolver ao construir**, e é o §0.2 regra 2 (*quantas vezes
  > por dia isso roda?*): hoje a checagem é local e custa zero — uma ida ao
  > servidor por tecla digitada seria inaceitável. O desenho tem de ser
  > **sob demanda** (ao enviar, ou com espera depois de parar de digitar), nunca
  > a cada tecla.

  ---

- ⬜ `[25/09]` 🔵 **Revisitar WYSIWYG se o editor sair do caminho crítico**

  Hoje **não**: 331,4 kB brutos contra 7,1 kB ([DESEMPENHO.md](docs/DESEMPENHO.md),
  [DECISOES.md](docs/DECISOES.md)).

  > **`[26/09]` O GATILHO DISPAROU, e é decisão dele.** O item dizia: *"se o
  > compositor virar rota própria, ele sai do carregamento inicial"*. Virou. O
  > pedaço do feed caiu de **19.333 para 6.088 bytes (−68%)**, e o compositor
  > agora é um pedaço de 15.551 B que só chega quando alguém clica em publicar.
  >
  > **O que mudou:** o peso do editor deixou de ser pago por quem só rola o feed.
  > **O que NÃO mudou:** a objeção de colagem de HTML, que é independente do peso
  > — e 331,4 kB continuam sendo 331,4 kB para quem abre `/publicar`.
  >
  > **Minha recomendação: continuar não.** O editor de hoje resolve o que o site
  > precisa, e o ganho de um WYSIWYG é conforto de escrita para a equipe e alguns
  > usuários — contra 46× de peso numa rota que existe justamente para ser
  > confortável. Reabrir vale se ele achar o editor atual ruim de usar na prática,
  > não pelo peso ter saído do caminho crítico.

  ---

- ⬜ `[17/09]` 🟠 **PROMPT 1 · AUDITORIA TÉCNICA PÓS-LANDING (Lighthouse/PageSpeed)**

  **O que é:** auditoria técnica do **GamerHub inteiro**, guiada pelo PageSpeed,
  em 6 camadas e por prioridade — uma de cada vez, com diagnóstico → decisão →
  implementação → validação.

  **A regra que manda mais alto, e é dele:** *"NÃO quero uma caça ao 100/100"*.
  Performance só se mexe com **problema real, ganho relevante e risco baixo** —
  ganho teórico ou incerto é **não implementar**.

  **A LANDING É ÁREA PROTEGIDA.** *"Está finalizada"*. Pode ser verificada quanto
  a defeito técnico real, mas **não sofre alteração visual ou estrutural para
  agradar métrica**. Proibido remover animação, Framer Motion, imagem, cena ou
  composição por causa de Lighthouse.

  **O escopo é por FINALIDADE, não uniforme:** landing ≠ página pública ≠
  autenticada ≠ administrativa ≠ legal. Não aplicar regra de SEO de página
  pública em área logada; não indexar admin; não usar `robots.txt` como
  segurança.

  | Camada | O que | Estado |
  | --- | --- | --- |
  | 🔴 1 | console | ✅ **diagnosticado em 17/09** com o PageSpeed dele. TODOS os erros são o mesmo: o WebSocket de realtime falhando DNS no runner do Google. Não é defeito para quem usa — mas revelou o achado abaixo |
  | 🟠 2 | `robots.txt` · `sitemap.xml` | ✅ **FEITO em 17/09** — ver `db/2026-09-17-prompt1-etapa1.md` |
  | 🟡 3 | titles · meta descriptions · canonical · **JSON-LD** | ✅ **FEITO em 17/09** — 6 títulos únicos de 6, canonical por página, e o JSON-LD com **um** tipo (`WebSite`). Ver `db/2026-09-17-prompt1-etapa3.md` |
  | 🟢 4 | acessibilidade — problema concreto, preservando a direção artística | ✅ **FEITO em 17/09** — medido em navegador nas 5 rotas: 0 botão sem nome, 0 link sem texto, 0 imagem sem `alt`, nenhum salto de cabeçalho. **2 defeitos reais**, os dois corrigidos |
  | 🔵 5 | performance — **só com evidência** | ✅ **DIAGNOSTICADA em 17/09, e a evidência disse para NÃO mexer.** Três investigações, zero otimizações: a minha proposta do Supabase estava errada (quem puxa o chunk é o `useAuth`), o CSS não tem gordura (49,4 dos 70,5 kB são nossos, o purge está certo), e separar o `framer-motion` **estourou o orçamento** — chunk menor comprime pior. Ver `db/2026-09-17-etapa5-e-o-alvo-inexistente.md` |
  | ⚪ 6 | `llms.txt` | ✅ **FEITO em 17/09** |

  **ACHADO DA ETAPA 1, já medido em produção — e é falha MUDA:**

  ```
  /robots.txt   -> HTTP 200 · text/html
  /sitemap.xml  -> HTTP 200 · text/html
  /llms.txt     -> HTTP 200 · text/html
  ```

  Nenhum dos três existe em `public/`. O `vercel.json` tem
  `"rewrites": [{ "source": "/(.*)", "destination": "/" }]`, que **captura tudo** —
  então o crawler pede `robots.txt` e recebe **o HTML do site com status 200**.
  É pior do que 404: o 404 diz "não existe"; o 200 com HTML diz "existe" e entrega
  lixo. Ninguém vê, nada loga, nenhum teste falha (§1.5).

- ⬜ `[08/10]` 🔵 **Offline de verdade — decisão dele, ainda aberta.**

  Hoje o site sem rede mostra uma tela dizendo que caiu. Mostrar **o feed que a
  pessoa já viu** é outro bloco: mexe no React Query (persistir o cache de
  consultas) e levanta a pergunta de **por quanto tempo** um post velho pode
  ser mostrado como se fosse de agora.

  Ele respondeu "pode ir" para a Fase 1 + aviso de offline, e esta parte ficou
  explicitamente de fora. Fica registrada para não se perder.


- ⬜ `[02/10]` **React 19.3 e `lucide-react` 1.48 ficaram de fora, e a conta já
  está feita.** *Decisão dele em 02/10, com a medição na mão.*

  | pacote | custo gzip | por que ficou |
  | --- | --- | --- |
  | `react` · `react-dom` 19.2.8 → 19.3.0 | **+8,4 kB** | embute `<ViewTransition />` e Fragment Refs, que o `src/` **não usa** (grep: zero). Das dezenas de correções, **uma** nos alcança (`useDeferredValue` travando, no painel do fundador) e o sintoma nunca foi relatado |
  | `lucide-react` 1.37 → 1.48 | **+2,4 kB** | ícones que já temos |
  | `@types/react` · `@types/react-dom` | 0 | acompanham o React — tipo à frente do runtime anuncia API que não existe |

  **Quando revisitar:** correção que nos alcance, vontade de usar
  `<ViewTransition />`, ou advisory. **O teto terá de subir junto** — hoje está
  em 229 e o React sozinho leva para ~237.

  Detalhe e as alternativas recusadas em `docs/DECISOES-FERRAMENTAL.md`.


- ⬜ `[18/09]` **Revogar as colunas derivadas de `posts` — a SEGUNDA camada da
  SEC-027.** *Só depois do deploy desta branch, e a ordem importa.*

  A SEC-027 fechou a manipulação com um trigger. O trigger funciona, mas é
  **camada única** — e a lição do SEC-025 é exatamente essa: desabilitado,
  renomeado, ou num caminho onde `current_user` não seja `authenticated`, a
  porta reabre em silêncio.

  ```sql
  REVOKE UPDATE (was_live, expires_at, created_at, live_ended_at,
                 live_kind, live_kind_label, id, user_id) ON public.posts FROM authenticated;
  REVOKE INSERT (was_live, expires_at, created_at, live_ended_at,
                 deleted_at, hidden_at, edited_at)        ON public.posts FROM authenticated;
  ```

  **Por que não foi junto:** até o deploy desta branch o `postService` ainda
  manda `was_live` no corpo do INSERT, e revogar antes faria **publicar post
  parar** na janela entre a migration e o deploy. O código já foi corrigido —
  falta o deploy chegar na `main`.

  **O que NUNCA pode entrar nesse revoke:** `hidden_at` e `deleted_at` no
  UPDATE. A moderação grava `hidden_at` por UPDATE direto de tabela e admin
  também é `authenticated` — revogar derruba o painel.

- ⬜ `[09/10]` 🔵 **O feed não tem UM post vivo.** *`[09/10]` o número
  desta linha era **326**; medido hoje, são **4** no total e **zero** vivos — a
  retenção levou o resto.*

  Encontrado durante o pentest: **todos** os posts têm `deleted_at` preenchido.
  É consistente com um site novo (o conteúdo real ainda não existe) somado ao
  e2e, que cria e apaga post a cada rodada de CI — as contas `claudetester` e
  `claudestaff` sozinhas respondem por **322** deles.

  Não é achado de segurança e não mexi em nada. Está aqui porque é o tipo de
  número que ninguém confere e que explicaria um feed vazio, e porque agora o
  XP depende dele (SEC-028): post apagado deixou de pagar.


## 🟢 Recomendado

- ⬜ `[10/10]` 🟢 **Job vermelho num passo `run:` simples não diz POR QUÊ.** A
  anotação devolveu `Process completed with exit code 1` e nada mais — as
  travas de 03/10 (`salvarEvidencia`) e 09/10 (`vitest`) cobrem os roteiros e
  os testes unitários, e **um passo de uma linha ficou de fora**. Custou seis
  execuções locais procurando o roteiro errado antes de eu parar e perguntar à
  API.

  **Não precisa de mecanismo novo** (§9.8, perguntas 1 e 5): a API já devolve
  a conclusão passo a passo, e o comando está escrito no `OPERACAO.md`. O que
  cabe decidir é se vale um passo `if: failure()` que imprima o nome do passo
  falho como anotação — ganho pequeno, manutenção permanente. **Minha
  recomendação: deixar como comando documentado**, e só mecanizar se isso me
  pegar uma segunda vez.

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

- ⬜ `[24/09]` 🟢 **O portão de "nenhum arquivo acima de 300 linhas" NÃO
  enxerga `e2e/` nem `scripts/`.** *Achado ao fazer o split: o
  `fim-de-sessao.mjs` varre só `src/` e ainda exclui `__tests__`. Hoje há
  **dois arquivos acima do teto fora do alcance dele** — `e2e/portas-do-banco.mjs`
  (608 linhas) e `e2e/painel-admin.mjs` (384). O portão não está errado, está
  **incompleto**, e o efeito é o mesmo das cotas que estouram em silêncio: ele
  imprime "OK nenhum arquivo acima de 300" e a frase não é verdade. Duas saídas:
  ampliar a varredura (e aí os dois reprovam até serem divididos) ou dizer na
  mensagem QUAL pasta ele olhou. Prefiro ampliar — mas isso obriga a dividir os
  dois antes, então é trabalho, não ajuste.*

- ⬜ `[24/09]` 🟢 **Medir o tamanho do lote do feed com dado de verdade.** *O 20
  foi escolhido por ser menor que os 30 de antes, não por medição — o feed
  está vazio. O que medir, com dado semeado: custo de render por card (com e
  sem mídia, em aparelho lento), bytes por lote, e rolagem no celular. Muda um
  número só (`TAMANHO_DO_LOTE`), e a trava garante que ele não passe do teto
  da RPC.*

- ⬜ `[24/09]` 🟢 **O E2E não exercita a paginação nem o aviso de novidade.**
  *O `cicloDoPost` publica um post só, então nunca há segunda página; e o aviso
  de novidade exigiria duas sessões simultâneas. Os dois caminhos estão
  cobertos por trava de contrato e por prova em ROLLBACK, mas não por navegador
  — e é honesto dizer qual é qual.*

- ⬜ `[09/10]` 🔵 **O mural ganha a BARRA do editor?** *A renderização já
  entrou em 09/10 — quem escreve `**oi**` no mural agora vê negrito, com o
  mesmo corte do comentário (sem separador).*

  na aba padrão**.

  Resultado, com a tela recém-carregada: o cabeçalho conta `1 ao vivo`, a aba
  `Gameplays` mostra `(1)`, e o miolo diz *"Nenhuma live acontecendo agora —
  volte mais tarde!"*.

  **Não é defeito**: separar live de jogador de live da comunidade é de
  propósito. É leitura de tela. Quem acabou de ficar ao vivo cai numa aba que
  diz que não tem nada.

  Saídas possíveis (decisão de produto): abrir na primeira aba **que tem
  conteúdo** · esconder a contagem quando a aba está vazia mas o site não ·
  trocar o texto vazio por *"nenhuma aqui — veja em Gameplays (1)"*.


- ⬜ `[12/09]` 🟢 **A falha do `e2e/fluxos.mjs` manda investigar o lugar
  errado.** *Achado hoje, custou alguns minutos de investigação minha.*

  **O que aconteceu.** O job `fluxos autenticados` reprovou dizendo *"o portão
  de boas-vindas NÃO apareceu depois do login"*, e listou três coisas para
  conferir no portão. Nenhuma era a causa: o dump da tela mostrava a URL ainda
  em `/login` e o botão em **"AGUARDE..."** — o `signInWithPassword` nem tinha
  voltado. O portão não apareceu porque **o login não aconteceu**.

  **Por que importa.** É a regra §1.5 na letra: *toda mensagem de erro tem que
  ser verdadeira*. "Você não tem permissão" quando o motivo é outro é pior do
  que "erro desconhecido", porque manda alguém investigar permissão por horas.
  Aqui o alvo errado é o portão.

  **O conserto:** antes de escolher a mensagem, desambiguar os dois estados —
  ainda em `/login` com o botão travado (**o login não voltou**, quase sempre
  rede/serviço externo) × já autenticado e o portão ausente (**a causa que as
  três dicas descrevem**). Mesma disciplina do "0 linhas é AMBÍGUO" do §1.5.

  **Foi flake nesta vez** — o re-run do MESMO commit passou nos 6 jobs, e
  nenhum dos 17 arquivos do PR #195 está no caminho do login. Mas o teto de
  2,5 s para uma chamada de rede a serviço externo vai reprovar de novo, e a
  próxima pessoa vai reler as mesmas três dicas erradas.

- ⬜ `[05/09]` 🟢 **A query de índice nunca usado do §6.1 não serve neste
  volume — e isso precisa estar escrito antes de alguém agir nela.**

  Rodada hoje, ela devolveu **72 índices** com `idx_scan = 0` *(`[09/10]`: hoje são **178**)* — **incluindo as
  chaves primárias de quase toda tabela**. Não é dívida: é que o site tem poucos
  usuários e a maioria dos caminhos nunca foi exercida. Apagar índice por esse
  sinal seria estrago, não faxina.

  **O que fazer:** deixá-la de fora da bateria enquanto o volume for este, ou
  trocá-la por uma que compare `idx_scan` **entre** índices da mesma tabela (o
  que distingue "ninguém usa este banco" de "ninguém usa este índice"). Enquanto
  não houver tráfego real, nenhuma das duas responde nada.


- ⬜ `[11/09]` **Medir a landing NOVA em campo — o antes/depois que sobrou.**
  *A cena 3D saiu; falta o número de usuário real do que ficou no lugar.*

  **Por que o item de 29/08 foi reescrito.** Ele pedia repetir o PageSpeed "no
  preset padrão" para fechar o antes/depois da cena 3D, e trazia toda a
  investigação de por que 30.182 ms caíam em "Other": o custo de uma cena WebGL
  é por **pixel**, não por byte. Nada disso é acionável hoje — **a cena foi
  removida em 11/09**, junto com `three`, `@react-three/fiber` e o
  `e2e/cena-3d.mjs` que vigiava o laço de animação. O raciocínio inteiro está
  guardado em [DESEMPENHO.md](docs/DESEMPENHO.md), que é onde medição mora.

  **O que continua valendo, e é o único pedaço vivo:** o site nunca teve
  medição de campo do hero. O laboratório oscila — duas medições do mesmo site
  em 27/08 discordaram **4×** no TBT —, e o Vercel Speed Insights já está
  instalado e é o único que responde por quem TEM GPU.

  | Onde | Como |
  | --- | --- |
  | **Vercel Speed Insights** | já instalado; é o único que mede usuário real |
  | **PageSpeed Insights** | `pagespeed.web.dev`, colar a URL, aba Desktop |
  | **Chrome no PC** | F12 → Lighthouse → Desktop + Performance → Analyze page load |

  Sempre no mesmo preset e em **janela anônima** (§0.3, regra 5: mesma
  ferramenta, mesmo aparelho). O portão do CI continua sendo **byte**
  (`scripts/orcamento-de-bytes.mjs`), porque tempo de laboratório oscila e
  portão que balança vira alarme falso.

  **A limitação do meu ambiente, e ela vale para qualquer medição futura:** este
  Chromium **não tem GPU** — a CPU faz o trabalho da placa. Todo número de
  renderização que eu produzir daqui é artefato de ambiente, e usá-lo para
  julgar a máquina dele seria vender inferência como fato (§1.1). É por isso que
  a medição de campo depende dele, e não de mim.

  > **`[11/09]` Este item substitui TRÊS que foram removidos hoje**, todos sobre
  > a cena 3D que deixou de existir: o custo por pixel (`[02/09]` 🟠), as sete
  > `pointLight` dos arcos (`[01/09]` 🟡) e o modelo em ferramenta 3D externa
  > (`[11/09]` 🟡). Nenhuma medição se perdeu — a de pixel e a das luzes estão em
  > [`DESEMPENHO.md`](docs/DESEMPENHO.md), e a conta de Meshopt × Draco está em
  > [`DECISOES.md`](docs/DECISOES.md). O que saiu foi a **fila**: pendência sobre
  > código apagado não é pendência, é entulho que faz o backlog parecer maior do
  > que é (§6.2, regra 2).


## 🔵 Só quando o volume crescer

- ⬜ `[11/09]` 🔵 **Post apagado fica na tabela para sempre — sem prazo de
  retenção.**

  Medido hoje, ao conferir a queixa do dono sobre o post de teste no ar: os
  roteiros do CI deixam **214 linhas** em `posts` marcadas com `[e2e ` ou
  `[painel `, desde 30/08. **Nenhuma aparece no feed** — todas têm `deleted_at`
  preenchido, porque o apagar do site é SUAVE. Ou seja: a limpeza dos testes
  funciona, e o que sobra é linha morta.

  O `cleanup_old_data` tem prazo para `admin_logs`, `notifications`,
  `login_attempts`, `live_chat` e `contact_messages` — e **nenhum** para post
  apagado (§6.1, item 5: tabela que só cresce).

  **Por que não fiz agora:** 214 linhas não pesam em nada, e o prazo certo é
  decisão de produto, não minha — "quantos dias um post apagado ainda pode ser
  restaurado?" é uma pergunta de moderação. É uma linha no `cleanup_old_data`
  quando o dono disser o número.

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
  fatias (`src/lib/`, <!--n:src.lib.arquivos-->207<!--/n--> arq ·
  <!--n:src.lib.linhas-->27.057<!--/n--> linhas; `src/services/`,
  <!--n:src.services.arquivos-->26<!--/n--> arq ·
  <!--n:src.services.linhas-->2.568<!--/n--> linhas) concentram quase todo o
  benefício — é onde mora
  toda a conversa com o Supabase e a lógica pura já 100% testada. Gatilho
  sugerido: a próxima migration que renomeie ou remova coluna.
- ⬜ `[21/08]` **2FA no login.**
- ⬜ `[21/08]` **Afinar detecção de ban** (hoje realtime + poll de 60s de reserva).

## ⏸️ `[09/10]` DESATIVADO — decisão JÁ TOMADA, não é fila

> Pedido dele em 09/10: *"tô quase te pedindo pra criar um outro bloco no
> backlog de itens desativados, pra esses casos de decisões de custos ou algo
> assim"*.

**Por que este bloco existe, e a prova de que precisava existir.** Em 17/09 ele
escreveu, na linha 1182 deste arquivo: *"ligar o contador de tentativas não dá,
é pago esqueceu?"*. Em 09/10 eu listei o mesmo contador para ele como *"só
depende de mim"* — depois de reler a fila.

Não foi falta de informação: o item **dizia** que era plano pago, por extenso, e
com link para a documentação. Foi o lugar. Ele morava numa seção chamada
*"precisa de ação ou decisão do dono"*, marcado 🟠, e o `inicio-de-sessao.sh`
imprime todo `- ⬜` com 🔴 ou 🟠 como prioridade da sessão. **O gatilho que
existe para eu não esquecer os itens era o que me fazia ressuscitar estes.**

**A diferença entre este bloco e a fila, em uma frase:** a fila é o que falta
decidir; aqui a decisão **já foi tomada**, e reabrir exige ele dizer que mudou
de ideia — não eu lembrar que existe.

**A marca é `- ⏸️`, não `- ⬜`**, e isso não é estética: as duas máquinas que
leem este arquivo procuram `^- ⬜`. O contador de itens abertos para de somá-los
e o gatilho de sessão para de imprimi-los, sem precisar de regra nova nem de eu
lembrar (§9.8, pergunta 5). A trava `backlogDesativadoNaoRessuscita.test.js`
reprova quem escrever `- ⬜` aqui dentro.

**O que NÃO muda:** nada foi apagado. Cada item continua inteiro, com a
medição, o custo e o que o desbloquearia. Item que some em silêncio é o oposto
do que este arquivo serve.

### Por CUSTO — plano pago ou assinatura

- ⏸️ `[11/09]` 🟠 **O contador de tentativas de login nunca foi LIGADO.** *Ação
  de painel — eu não alcanço.*

  Queixa do dono: *"não tá contando os logins errado"*. **Ele está certo, e
  medido:** `login_attempts` tem **0 linhas** e `max(updated_at)` é *nunca*. Nos
  logs do GoTrue das últimas 24 h houve **9 logins** e o único `run_hook`
  registrado foi o da `send-email` — o de verificação de senha não aparece
  nenhuma vez.

  **NÃO é "faltou clicar", e eu afirmei isso antes de conferir.** O
  `Password Verification Attempt` **não existe no plano Free**: a tabela da
  [documentação de Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
  o marca como `Teams and Enterprise`, enquanto quatro outros aparecem como
  `Free, Pro`. O projeto **já sabia** — está num comentário em
  `src/pages/Login.jsx` desde 28/08 — e eu diagnostiquei pelo banco sem ler o
  comentário que estava no caminho.

  A função existe, está correta e foi **provada em ROLLBACK** (4 erradas contam,
  a 5ª bloqueia por 15 min, acertar limpa). Ela simplesmente **nunca é chamada**.

  **A DECISÃO É SUA, e são duas opções honestas:**

  | Opção | O que muda | Custo |
  | --- | --- | --- |
  | **A. Tirar a promessa da tela** | a mensagem "Conta bloqueada por excesso de tentativas" sai, e o site deixa de prometer o que não faz. A função e a migration ficam guardadas, prontas para o dia do upgrade | zero |
  | **B. Subir de plano** | o hook liga e o contador passa a valer | mensalidade do Supabase |

  **O que está fora:** contar do lado do cliente. Foi exatamente a brecha
  fechada em 28/08 — qualquer um forjava o bloqueio de qualquer e-mail sem
  saber a senha.

  Enquanto isso, quem protege contra força bruta é o rate limit do próprio
  GoTrue, que é server-side e não depende desta tela.

- ⏸️ `[28/08]` **Contar falha de login de verdade exige plano Team.** A função
  `hook_de_verificacao_de_senha` está no banco, testada e com `EXECUTE` só para
  o `supabase_auth_admin` — mas o *Password Verification Attempt hook* aparece
  cinza no painel: **"Team or Enterprise Plan required"**. O outro caminho
  também está fechado: `auth.audit_log_entries` está vazia, zero linhas desde
  sempre. **O que já está resolvido:** ninguém consegue mais fabricar alerta de
  segurança, e força bruta continua barrada pelo rate limit do próprio GoTrue.
  O que falta é só a contagem para avisar a equipe. Mesma família do HIBP —
  decisão de custo, não de código. Ver [SEGURANCA.md](docs/SEGURANCA.md).

- ⏸️ `[18/09]` 🔵 **A proteção contra senha vazada está DESLIGADA — e não dá
  para ligar no plano Free.** *Decisão de CUSTO, não ação de painel.*

  Apareceu no Security Advisor durante a auditoria das 48:
  `auth_leaked_password_protection` desligado. O Supabase checaria a senha
  escolhida contra o HaveIBeenPwned e recusaria as que já vazaram.

  > **`[18/09]` EU ESCREVI ESTE ITEM ERRADO E O DONO QUASE PAGOU POR ISSO.**
  > A primeira versão era um passo a passo mandando ele abrir o painel e ligar
  > um toggle. **O toggle não existe no plano Free.** A documentação oficial é
  > explícita: *"Leaked password protection is available on the **Pro Plan and
  > above**"* — conferido em 18/09 em
  > https://supabase.com/docs/guides/auth/password-security
  >
  > O item `[22/08]` já dizia isso — *"só no plano Pro (~US$25/mês)"* — e eu
  > criei um segundo item contradizendo o primeiro, sem conferir nenhum dos
  > dois. Os dois estão unificados aqui.
  >
  > **A falha é exatamente a que o §9.12 descreve:** *"passo a passo sem essa
  > conferência é armadilha bem formatada"*. E ela veio no mesmo dia em que eu
  > declarei ao dono que tinha pulado a pesquisa de documentação no prompt das
  > 48 — ou seja, não foi descuido isolado: foi a mesma omissão, duas vezes.

  **O que o Advisor não diz:** ele marca o recurso como desligado mesmo em
  projeto que não pode ligá-lo. O alerta é genérico, não é acionável aqui.

  **Custo:** ~US$25/mês (Pro). **Decisão dele.** Enquanto não for, a política
  de senha do próprio site é o que protege — ver o item `[12/09]` sobre a
  política do painel de Auth nunca ter sido conferida.

- ⏸️ `[23/08]` 🟠 **Migrar o envio de email para fora do Gmail.** *`[05/09]` O
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


### PAUSADO por ele — não é custo, é prioridade

- ⏸️ `[08/10]` 🟠 **A landing trava no app — e o portão por aparelho do §0.3
  nunca foi construído.** *🟡 decisão dele: aprovar o portão por MEDIÇÃO.*

  **Confirmado por ele:** *"a maioria é na landing page"*. O feed aguenta. Não
  é o WebView — é a decoração.

  **O que a investigação DESCARTOU, medindo:**

  | | |
  | --- | --- |
  | JavaScript por quadro | `useProgressoDeRolagem` usa `MotionValue`, sem render do React por quadro. O erro que custou 714 ms no `FluxoDeDados` já está registrado no `DESEMPENHO.md` e não se repete |
  | peso das imagens | 42 arquivos, 3,3 MB, já em variantes responsivas (828 px para celular alto, 1600 para largo) |

  **O que sobra, e eu NÃO consigo medir daqui:** quantas camadas pintam ao
  mesmo tempo. Depende da GPU do aparelho dele.

  **A proposta, e ela esbarra numa regra do próprio projeto.** O §0.3, regra 2,
  prevê um portão por aparelho que **nunca existiu**. Mas a regra 6 fecha o
  caminho óbvio: *"detectar aparelho é medir, não identificar"* — ler modelo e
  GPU foi RECUSADO por ser impressão digital.

  Então o portão tem de medir **o próprio desenho**: contar quadros perdidos
  nos primeiros ~1,5 s e, se estiver ruim, cair para a cena **parada** que já
  existe para `prefers-reduced-motion` (`PrologoParado`, e o caminho "composição
  parada, não vazia" do `PortalDoAtoZero`). Não é construir uma segunda landing
  — é religar o que já está lá por outro motivo.

  **A escolha explícita de quem olha VENCE a medição**, sempre (§0.3, regra 2).

  **O risco, dito antes de construir:** medição de quadro no começo erra se o
  aparelho estiver ocupado abrindo o app — ela acusaria lentidão inexistente e
  cortaria o enfeite de quem não precisava. Por isso o corte não pode ser
  permanente nem vencer a escolha de ninguém.

  **As três perguntas para ele:** (1) aprova o portão por medição? (2) o corte
  vale só na landing ou no site logado também? (3) botão visível para religar
  os efeitos, ou basta o `prefers-reduced-motion` do sistema?


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
