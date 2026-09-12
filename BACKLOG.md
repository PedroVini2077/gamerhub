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

### `[11/09]` REFORMULAÇÃO DA LANDING — em fatias, mergeando cada uma

**Ordem do dono:** *"eu realmente quero reformular toda a landing, não só a
cena, vai fazendo o que pode e a gente vai ajeitando no decorrer"*. E a correção
dele, que eu precisava ouvir: *"eu nunca te pedi pra fazer em 3D, acho que no
prompt tá explícito"* — e estava: *"prefiro isso a adicionar 3D apenas para
deixar a página mais impressionante"*.

**Objetivo:** a landing dos três atos — a fenda, o que converge, você já está
dentro. Ver `docs/identidade/BRIEFING-2026-09.md`.

#### `[11/09]` PLANO DA FATIA 2 — em execução

Ele aprovou: frase **"Aqui o jogo continua."**, marca **pintada**, **brilho de
objeto polido** que abre a landing, **~2,15 s**, e a marca com **vai e vem
próprio, "como se estivesse no espaço"**, mais reação ao ponteiro.

| Etapa | O que é | Estado |
| --- | --- | --- |
| A | `lib/tempoDaAbertura.js` — o orçamento de tempo numa fonte só, lida pelo componente, pelo CSS e pelo teste | a fazer |
| B | O ponteiro passa a ter **UM** ouvinte, escrevendo em `:root` — hoje o `FluxoDeDados` escreve no próprio contêiner e ninguém de fora enxerga | a fazer |
| C | A abertura reescrita: pinta → frase → brilho → abre | a fazer |
| D | `MarcaFlutuante` no hero: deriva própria + ponteiro | a fazer |
| E | Travas e documentação | a fazer |

**Sobre a memória da abertura: NÃO há o que construir.** Ele pediu que ela não
volte ao trocar de aba, só ao fechar e abrir. Conferido em
`src/lib/introJaVista.js`: já é `sessionStorage`, que sobrevive a recarregar e a
navegar pelo site e **morre quando a aba fecha** — exatamente o pedido. O que
muda é só o tempo que ela dura quando toca.

> **`[11/09]` A fila abaixo foi REESCRITA.** Ele mandou um segundo briefing, bem
> mais ambicioso — a landing como **experiência de scroll**, não como sequência
> de seções. Está inteiro em
> [`docs/identidade/BRIEFING-LANDING-2026-09.md`](docs/identidade/BRIEFING-LANDING-2026-09.md),
> com a análise do que existe hoje e a direção proposta.
>
> **Ele avisou que as imagens de referência ainda NÃO existem** — *"eu não tenho
> elas agora, eu vou ter que gerar, deixa isso pendente"* —, e que o plano pode
> mudar quando chegarem: *"provavelmente vamos ter que mudar o que estamos
> fazendo, mas vamos só estruturar antes de fazer"*. Por isso a fila é ordenada
> pelo que **não** depende delas.

> **`[11/09]` O MÉTODO, definido por ele:** *"vamos fazer em blocos? uma coisa
> por vez... nesse momento não vamos implementar, vamos idealizar, anotar e
> implementar"*. Cada fatia passa por **idealizar → anotar → implementar**, e só
> avança quando a anterior estiver redonda: *"quando tiver redondo partimos pro
> resto"*.
>
> **Bloco em idealização agora: a ABERTURA (fatia 2).** Tudo dele está em
> [`BRIEFING-LANDING-2026-09.md`](docs/identidade/BRIEFING-LANDING-2026-09.md),
> com as propostas de frase, as três leituras de "montar", a restrição técnica
> que decide o desenho e os 6 pontos ainda em aberto.

| Fatia | O que é | Depende das imagens? | Estado |
| --- | --- | --- | --- |
| **1** | Matar a cena 3D e trocar o fundo do hero por **convergência** em SVG/CSS | não | **feita** |
| 2 | A abertura (`AberturaDaMarca`): marca pintada por uma luz, a mesma luz revela "Aqui o jogo continua", reflexo polido, e a marca **assenta no hero** flutuando e seguindo o ponteiro | não | **feita** |
| 3 | **O mecanismo de cena presa** (sticky + progresso de scroll), sem arte nova | não | a fazer — é a fundação das outras |
| 4 | Comunidade: *"tem gente aqui"* | em parte | espera a 3 |
| 5 | Feed vivo | em parte | espera a 3 |
| 6 | Lives — a cena mais cinematográfica | **sim** | espera as imagens |
| 7 | Keys & Promos — descoberta | **sim** | espera as imagens |
| 8 | XP/ranks — o scroll como progressão | não | espera a 3 |
| 9 | O fecho, na porta do login | não | espera as anteriores |

**As PERGUNTAS que eu fiz, e onde cada uma parou.** Gravadas porque pergunta que
vive só na conversa some com a sessão — foi assim que quatro pedidos dele se
perderam em 01/09.

| # | Pergunta | Resposta |
| --- | --- | --- |
| 1 | Qual frase aparece com a marca na abertura? | ✅ **"Aqui o jogo continua."** |
| 2 | Quanto tempo a abertura pode durar, e a 2ª visita ganha versão curta? | 🟡 **em aberto** — proposta de 2,15 s e versão curta no briefing, esperando ele |
| 3 | O que "montar" quer dizer no desenho? | ✅ **pintada**, e depois o brilho de objeto polido |
| 4 | As artes que ele vai gerar são FUNDO ou PEÇAS? | 🟡 **em aberto** — *"cada print vai ter sua arte própria"* sugere composição, mas ele não respondeu a pergunta diretamente |
| 5 | O molde `FeatureSection` morre, ou fica nas seções menores? | ✅ **morre** — *"cada print vai ter sua arte própria"* |

**`[11/09]` O TETO DE AMBIÇÃO da landing, na palavra dele:** *"na landing é onde
eu mais quero gastar... não precisa ser pesado, mas tem que ter impactante"*.

Isso muda uma calibragem que eu vinha usando errado. Eu tratava "não pode
pesar" como "faça o mínimo"; ele está dizendo outra coisa — **a landing é onde o
esforço deve se concentrar**, e o limite é o *peso*, não a *ambição*. As duas
coisas não são a mesma: o `ConvergenciaDoHub` é impactante e custa 3,2 kB.

**Por que isso fica escrito aqui e não só na conversa:** na hora de escolher
entre uma cena mais simples e uma mais ousada, é esta frase que decide o empate
— e sem ela registrada, eu escolheria a simples achando que estou sendo
responsável.

**Por que a 3 vem antes das cenas, e não depois:** cena presa é MECANISMO —
altura reservada, progresso, o que acontece no celular, o que acontece com
`prefers-reduced-motion`. Construir uma vez com teste e reusar é o oposto de
escrever cinco animações parecidas que divergem (§4). Fazer as Lives primeiro e
extrair o mecanismo depois é o caminho que produz duplicação.

**Critério de sucesso da fatia 1:** nenhum raio na landing, o orçamento de bytes
cai, e o hero conta "ponto de encontro" sem depender de 3D.

**Fatia 1 — FEITA, com o que ela custou e o que ela NÃO rendeu.** Saiu a cena
inteira (wrapper, fallback 2D, a pasta, o botão de escolha, o portão por
aparelho), `three`, `@react-three/fiber`, `lib/ritmoDoRaio.js` e o
`e2e/cena-3d.mjs` com o job de CI que o rodava. A intro deixou de desenhar o
raio: hoje é a marca que se desenha. No lugar do hero entrou
`ConvergenciaDoHub`.

**Sinceridade sobre o critério de sucesso que eu mesmo escrevi acima:** ele
dizia *"o orçamento de bytes cai"*, e **não caiu** — carregamento inicial em
735,0 kB / 222,9 kB gzip, exatamente o de antes, e o chunk da `Landing` subiu
17,9 → 21,1 kB porque o SVG novo mora nele. O critério estava errado, não a
entrega: a cena era `lazy` atrás do portão por aparelho, então nunca esteve no
carregamento inicial. O que sumiu foram os 708 kB de quem **recebia** a cena e
os 5.877 ms de thread em 6 s de página parada. Medição em
[`DESEMPENHO.md`](docs/DESEMPENHO.md).

**Calibragem da convergência, em dois passos, cada um a partir de um print.** A
1ª versão traçava a reta inteira até o centro e sumia o texto por opacidade — as
linhas cruzavam o título assim mesmo. A correção é geométrica: cada traço para
na borda de uma elipse que envolve o texto. A 2ª versão tinha 11 pontos
animados ao mesmo tempo, o elemento mais brilhante da tela; hoje 1 em cada 3
trajetos leva ponto. Conferido em 1280×800 e em 400×800.

---

---

**Última conferência contra o sistema:** 11/09/2026 ·
**34 itens abertos** (+ 1 ideia sem compromisso)

## 🔴 ACHADOS DE SEGURANÇA — `[10/09]`

- ✅ **SEC-001 · `game_keys.key_code` legível sem conta** — **FECHADO**.
  Migration `key_code_deixa_de_ser_legivel_sem_conta`, trava em
  `e2e/portas-do-banco.mjs`. Reproduzido antes, reconferido depois.
- ✅ **SEC-002 · `SEGURANCA.md` afirmava que `anon` via `(id, username)` de
  `profiles`** — **FECHADO**. Já não era verdade; texto corrigido com a
  evidência (`information_schema.column_privileges`).
- ✅ **SEC-003 · `TRUNCATE` concedido a `anon` em 27 de 29 tabelas** —
  **FECHADO**. Migration `revogar_truncate_de_anon_e_authenticated`, com
  `ALTER DEFAULT PRIVILEGES` para as tabelas futuras.
- ✅ **SEC-004 · a wordlist inteira era legível sem conta** (322 palavras com a
  severidade — o mapa de como contornar o filtro) — **FECHADO**. 🔵
- ✅ **SEC-006 · o cache do React Query atravessava a troca de conta** —
  **FECHADO**. 🟡 Era a consequência de backend que faltava para o spoof de
  `role` do DevTools deixar de ser inofensivo.
- ✅ **SEC-005 · `site_config.updated_by` legível por `anon`** — **FECHADO**, e
  com ele o item 🔵 que estava **aberto no backlog desde 01/09**. Deu para
  fechar sem decisão nova porque duas coisas mudaram: `profiles` foi revogado de
  `anon` (o UUID já não vira nome) e nenhuma tela pública lê essa coluna.
- ✅ **SEC-007 · a moderação de conteúdo dizia ter apagado o que não apagou** —
  **FECHADO**. 🟡 Ver a lixeira é `role_rank >= 2` (plana), apagar é
  `can_moderate_content` (hierarquia estrita): o admin **enxerga** o post do
  owner e não pode apagá-lo, e a RLS recusa com **0 linhas e nenhum erro**. O
  toast dizia "apagado permanentemente" e a trilha gravava a exclusão. Medido em
  `ROLLBACK` (a tela contava 176, o banco apagava 175). Varrido por CLASSE: dos
  17 `delete()` de `src/`, **6 corrigidos** e 4 marcados como 0-linhas legítimo.
  Trava `apagarConfereLinhas.test.js`, provada reinjetando o bug.
- ✅ **SEC-008 · o período de avaliação de staff podia acabar no ano 12020** —
  **FECHADO**. 🟡 `review_staff_nomination(p_trial_days)` e
  `decide_staff_trial(p_extend_days)` tinham piso e **nenhum teto** — a mesma
  falha da suspensão até 2126. Importa porque o trial é o que autoriza um super
  admin a promover **sem o fundador**, e nada cobra o vencimento por máquina
  (não há cron sobre `trial_review_date`). Provado em `ROLLBACK`: 3.650.000 dias
  aceitos, cargo virou `admin`, revisão para 12020-01-20. Faixa de 7–180 dias
  (extensão 1–90, total 365) **e** `CHECK` no banco — a trava que torna o dado
  errado impossível, e que sobrevive a alguém reescrever a função.
- ✅ **SEC-009 · o UPDATE de conteúdo ignorava a hierarquia que o DELETE
  respeita** — **FECHADO**. 🟠 O mais sério do dia: um admin **reescreveu e
  ocultou** um post do fundador por `PATCH` direto, enquanto o
  `soft_delete_post` recusava o mesmo post por falta de permissão. As três
  tabelas de conteúdo tinham `DELETE` com hierarquia estrita e `UPDATE` com
  cargo plano (`is_staff()` / `role_rank >= 2`). Corrigido nas seis policies,
  cada cenário testado em `ROLLBACK` (moderação segue viva, autor segue
  editando). Trava `hierarquiaNoConteudo.test.js`.
- ✅ **SEC-010 · a trilha atribuía ao AUTOR a ação feita por outra pessoa** —
  **FECHADO**. 🟡 `log_post_event` gravava o dono do post como ator. Agora grava
  `auth.uid()` (caindo para o autor quando não há sessão — o cron), nomeia os
  dois no texto e sobe para `warning` quando quem age não é o autor.

> **A auditoria CONTINUA.** As três primeiras frentes fecharam, mas o piso do
> §6 pede muito mais: as **48 funções alcançáveis** uma a uma, as **12 policies
> com `USING (true)`**, os fluxos de role/ban/moderação, IDOR, upsert, mass
> assignment e o isolamento de sessão. O que já foi apurado está em
> `db/2026-09-10-auditoria-seguranca.md`.

## 🟡 ACHADOS OPERACIONAIS — `[10/09]`

- ⬜ `[11/09]` 🔵 **`soft_delete_post` e `restore_post`: o guard não trata
  `auth.uid()` NULL.** *Proposta — NÃO executei, porque não é explorável hoje
  (§7 🟡: migration pede aprovação).*

  **O risco.** As duas fazem
  `IF auth.uid() <> v_owner AND NOT can_moderate_content(v_owner) THEN RAISE`.
  Em SQL, `NULL <> qualquer_coisa` é **NULL**, e um `IF` com NULL **não
  dispara** — então sem sessão o guard não barra ninguém.

  **Provado em ROLLBACK**, nas duas vias:

  | Papel | Resultado |
  | --- | --- |
  | `anon` | bloqueado — mas por `permission denied for table profiles`, **não pelo guard** |
  | `authenticated` com JWT **sem `sub`** | **apagou post alheio** |

  **O impacto hoje é ZERO**, e isso precisa estar escrito: `anon` não está na
  ACL das funções, e um JWT com `role: authenticated` só existe assinado com o
  segredo do projeto — e o GoTrue sempre põe `sub`. Não há caminho de fora.

  **Por que mesmo assim vale corrigir:** é proteção acidental, exatamente o que
  o §1.3 manda desconfiar. Ela depende de um `GRANT` e de um erro de privilégio
  em `profiles` — não do guard. Este projeto já mudou grant de `anon` mais de
  uma vez; no dia em que isso acontecer, a porta abre sem ninguém perceber.

  **A solução é uma linha em cada função:**
  `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sem sessão'; END IF;`
  mais a trava: o teste em ROLLBACK acima, que hoje passa no caso (b) e
  passaria a falhar.


*Encontrados durante a auditoria de segurança, e **fora do escopo dela**. Estão
aqui, e não corrigidos junto, porque o §21 do protocolo proíbe expandir tarefa
por oportunidade — e nenhum deles é brecha.*

- ✅ `[10/09]` 🟠 **Os `update()` que não conferiam quantas linhas mudaram** —
  **FECHADO**, junto do SEC-009. **6 corrigidos**, sendo dois graves: o item da
  fila de moderação podia não sair de `pending` depois de o conteúdo já ter sido
  ocultado (voltava para a fila e era tratado de novo), e os dois pedidos de
  reativação de live não conferiam **nem `error`, nem contagem**.

  **O número "13" desta linha estava errado, e é correção minha:** o `grep` era
  por LINHA, e chamada quebrada em várias linhas põe o `{ count: 'exact' }` numa
  linha diferente da do `.update(`. O `contatoService.js` já estava certo e foi
  contado como faltando.

- ✅ `[10/09]` 🟡 **A trilha atribuía ao AUTOR a ação feita por outra pessoa** —
  **FECHADO** (SEC-010). `log_post_event` gravava `actor_id := NEW.user_id`, e
  staff editando ou apagando post alheio aparecia como se o próprio autor
  tivesse feito, com `severity = info`. Agora o ator é `auth.uid()` (com queda
  para o autor quando não há sessão — o cron), o texto nomeia os dois, e a
  severidade vira `warning` quando quem age não é o autor.

  **O que isso NÃO recupera:** a trilha **anterior** a hoje. Não dá para saber,
  olhando `admin_logs`, se alguém usou a brecha do SEC-009 antes de ela ser
  fechada — as linhas antigas dizem "o autor fez".

- ⬜ `[10/09]` 🔵 **`unsilenceUser` existe duas vezes**, com assinaturas
  diferentes: `liveService.unsilenceUser({postId, userId})` e
  `useAdminLiveActions.unsilenceUser(id)`. Os dois foram corrigidos junto no
  SEC-007, mas **cópia diverge** (§4, fonte única) — foi assim com os ícones de
  log, os rótulos de cargo e a regra de bloqueio de login. Unificar exige
  decidir uma assinatura só, e o hook apaga por `id` da linha enquanto o serviço
  apaga por par: não é troca mecânica.

- ✅ `[10/09]` 🟡 **`e2e/artes-da-arena.mjs` era instável no CI** — **FECHADO**.
  Falhava com *"cadastro tem 4 lutador(es), esperava 2"*: o fade cruzado
  flagrado no meio.

  **A causa raiz:** a espera pedia só *"existem 2 `.arena-troca`"*, e isso é
  verdade em **dois** estados — antes de a troca começar (com as artes do
  login) e depois de ela terminar. Fallback silencioso na versão temporal (§4).

  **A janela foi provada**: clicando de dentro da página e lendo a condição na
  mesma tarefa de JS, ela responde `true` com as artes do login ainda na tela.
  Mas **a falha não reproduziu aqui** — pelo caminho real do Playwright a
  condição antiga levou **728 ms**, já com as artes novas: o clique é mais lento
  que o render nesta máquina, e no CI a corrida deu para o outro lado.

  O conserto diz **o que se espera ver**, não quantos elementos: os `src` têm
  que ser diferentes dos de antes. A prova é estrutural, não estatística — 5
  rodadas verdes aqui não valem nada, porque **antes** do conserto também davam
  5/5.

- ⬜ `[10/09]` 🟡 **O orçamento de bytes dá resultado DIFERENTE aqui e no CI.**
  Local, com `npm ci` (mesmo lockfile do CI): **222,4 kB gzip**, acima do teto
  de 222 → reprova. No CI, o mesmo passo **passa**.

  **Medido, não suposto:** com `git stash` das minhas mudanças, o número local é
  **222,4 antes e depois** — ou seja, o que eu fiz custou **0 kB gzip**, e o
  estouro local não é meu.

  A causa provável é a versão do `zlib`/Node mudando a compressão em alguns
  bytes. **Portão que dá veredito diferente por ambiente não é portão** — ele
  reprova quem roda local e libera quem roda no CI, ou o contrário. Vale medir a
  diferença e, se for isso, comparar com uma tolerância explícita em vez de um
  número seco.

  **Não subi o teto**, que seria o conserto errado (§6.1): o número é a decisão,
  não o obstáculo.

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

  ### PARTE 2 — caminhos indiretos, RLS e escalada

  **A entrega central: a matriz REAL de permissões, reconstruída DO BANCO.**
  29 ações × 4 papéis, e depois o confronto que é o ponto —
  **documentação × frontend × RPC × RLS × grants**. Qualquer divergência é achado.

  | Frente | O que procurar, e o que ele proíbe assumir |
  | --- | --- |
  | **escalada vertical** | **todos** os caminhos que alteram `profiles.role`, por busca semântica — não basta achar `owner_set_role`. Inclui `role_change_requests`, nomeações, trial, promoção, rebaixamento, e função antiga preservada por migration |
  | **IDOR / BOLA** | toda função que recebe UUID: *"se um usuário normal trocar esse UUID pelo de outra pessoa, o que acontece?"*. **Classe prioritária** — já aconteceu aqui, em `check_staff_eligibility` |
  | **objeto + ação** | *"caller é admin"* não basta. Admin pode moderar outro admin? super_admin? owner? A checagem tem que olhar o **alvo** |
  | **parâmetros** | classificar A/B/C/D. **C (determina autorização) e D (altera privilégio) pedem revisão manual** |
  | **grants** | *"função verifica autorização internamente"* ≠ *"função deveria estar exposta"*. São coisas diferentes |
  | **`search_path`** | função por função, **sem substituição mecânica** |
  | **retornos** | `RETURNS public.profiles`, `SETOF`, `SELECT *` — coluna nova no futuro não pode virar dado exposto por RPC antiga |
  | **RLS** | por tabela: enabled? **FORCE**? policy por comando? `USING (true)`? dá para inserir em nome de outro? dá para trocar o `user_id`? |
  | **`admin_logs`** | *"uma auditoria não é confiável se o próprio usuário consegue reescrever a história"* — admin pode apagar o próprio rastro? `actor_id` vem de `auth.uid()` ou do cliente? |
  | **false success** | `if (error) return fallback` transformando *permission denied* em `[]`, `0` ou `false`. É o §1.5 nosso, do lado do frontend |
  | **legacy** | função antiga com `EXECUTE` ainda concedido é **porta aberta**, mesmo que o frontend nunca a chame |
  | **migration drift** | reconstruir o **estado final** do banco. *"O que o banco é hoje"* vale mais que *"o que uma migration antiga dizia"* |
  | **race condition** | TOCTOU: verifica autorização → outra transação muda o alvo → escreve. Só onde houver risco real; nada de lock indiscriminado |

  **`game_keys` é o candidato mais provável a achado real, e eu já sei por quê:**
  o frontend faz `game_keys?select=*` e filtra `!k.is_promo` **no JavaScript**.
  Se a tabela tem `key_code` e a RLS não separa promo de não-promo, o filtro é só
  UX — e basta remover o filtro. Ele marcou como **prioridade alta se houver
  exposição de segredo**, com uma ordem junto: **não expor nenhuma chave real
  durante os testes**.

  **Testes: a matriz por papel, e os NEGATIVOS são obrigatórios.** *"O teste mais
  importante é o que tenta quebrar a regra."* Não basta *"admin consegue banir
  user"*; precisa existir *"admin NÃO consegue banir super_admin"* e *"admin NÃO
  consegue alterar role de owner"*. Com tampering de parâmetro: UUID próprio, de
  terceiro, de admin, de owner, inexistente, `NULL`; número em `-1`, `0`, máximo,
  máximo+1, gigante; enum inválido, vazio, `NULL`.

  **O método, e ele proíbe o meu atalho:** reproduzir → identificar a causa →
  corrigir a causa → reproduzir de novo → **regressão** → auditar caminhos
  alternativos. Nada de *"achei SECURITY DEFINER → reescrevi"* ou *"achei
  `SELECT *` → removi"*.

  **Correção sempre por migration NOVA.** *"Nunca reescreva migrations históricas
  para fingir que o problema nunca existiu."*

  **Classificação dos achados:** 🔴 crítico · 🟠 alto · 🟡 médio · 🔵 baixo ·
  ⚪ informativo. E uma trava contra o meu alarmismo: **o spoof do `role` no
  frontend fica como *"client-side trust / expected tamperability"*** enquanto não
  houver consequência no backend.

  **FORA DO ESCOPO** — e a parte 2 acrescenta a metade de baixo:
  - não refatorar, redesenhar tela, mexer em desempenho ou tocar na Landing;
  - achado que não for brecha explorável vira item, não conserto;
  - **não** tentar bloquear DevTools, detectar Network aberto, ofuscar código ou
    criptografar `role` no cliente — *"isso não é segurança real"*;
  - **não** trocar todos os 400 por 403 automaticamente: o requisito é *"operação
    não autorizada não acontece"*, o código HTTP é secundário;
  - **não** trocar 1 consulta por 20 em nome de hardening.

  ### PARTE 3 — execução, e ela proíbe pular para a correção

  **A ordem é `AUDIT → PLAN → IMPLEMENT → VALIDATE → REPORT`**, em 17 fases, com
  a instrução final explícita: *"NÃO pule diretamente para a FASE 11"* (que é
  implementar). A primeira ação é reconstruir o modelo de autorização **sem
  alterar arquivo nenhum**.

  **Todo achado usa estado, não adjetivo:** `CONFIRMADO` · `PROVÁVEL` ·
  `SUSPEITO` · `NÃO REPRODUZIDO` · `MITIGADO` · `CORRIGIDO` · `INFORMATIVO` ·
  `FALSO POSITIVO`. E é a nossa regra §1.1 com outro nome: *"'profiles?select=id
  retorna 200' não significa 'profiles está vulnerável'; 'Response não carregou'
  não significa 'servidor retornou []'"*.

  **Classes de ataque que a parte 3 acrescenta**, e são as que eu não teria
  procurado sozinho:

  | Classe | O que é |
  | --- | --- |
  | **confused deputy** | função privilegiada que aceita *"execute em nome de X"* sem verificar se o caller pode representar X. O parâmetro nunca substitui `auth.uid()` |
  | **segunda ordem** | altera um estado inocente → usa esse estado para ganhar privilégio. Ex.: cria nomination → manipula status → chama approve → ganha role |
  | **mass assignment** | `update(payload)` com objeto vindo do formulário — *"o cliente consegue enviar campos que a UI não possui?"* |
  | **upsert** | *"frequentemente esquecido porque parece um INSERT"*: dá para usar conflito de chave para alterar o que não se poderia `UPDATE`? |
  | **RPC chaining** | A chama B chama C — **B não está protegida só porque A está** |
  | **isolamento de sessão** | cache/React Query: dado de admin sobrevive ao logout? conta seguinte herda? role stale? downgrade durante sessão ativa? |

  **Regressões que ele quer nominalmente:** as quatro RPCs negando; `owner` não
  rebaixável por admin nem por super_admin, nem por caminho indireto;
  auto-promoção negada **com a role conferida intacta depois** (*"não aceite que
  a função retornou erro sem verificar que a role permaneceu"*); matriz
  caller-rank × target-rank × new-role; IDOR por conta.

  **Regra absoluta contra ação perigosa:** não apagar dado real, não alterar role
  de gente real, não banir ninguém real, não revelar segredo, **não desativar RLS
  nem abrir permissão "para testar"**. Teste destrutivo só em fixture.

  **`CLOSED` tem 8 requisitos** — causa, correção, teste positivo, teste
  negativo, caminho alternativo revisado, migration validada, documentação, diff
  revisado. Sem os oito: `PARTIALLY MITIGATED` ou `OPEN`.

  **E a instrução que eu mais preciso obedecer:** *"se não conseguir provar, diga
  NÃO CONSEGUI PROVAR. Não invente."* O relatório não pode dizer *"projeto
  seguro"* — no máximo *"não foram encontradas vulnerabilidades críticas nas
  superfícies auditadas"*, dizendo o que foi testado, o que não foi, e o que
  permanece em aberto.

  > **`[10/09]` O AVISO DO DONO, e ele muda como eu leio os três prompts:** eles
  > foram escritos **pelo ChatGPT**, com acesso parcial ao repositório. *"Vamos
  > seguir as nossas regras e sempre verificar o que é verdade ou não."*
  > Toda afirmação técnica dentro deles — que `get_own_profile` é assim, que
  > `admin_list_users` exige rank ≥ 2, que o frontend filtra `!k.is_promo` — é
  > **hipótese até eu conferir na fonte** (§1.4). Vale inclusive para os quatro
  > `400` que ele observou: são evidência do que aconteceu **naquele momento**,
  > não prova do estado atual do banco.

- 🔄 `[10/09]` 🟠 **1. TESTAR O BREVO — a metade minha está FEITA, falta a dele.**

  **`[10/09]` A Edge Function foi reimplantada** (v33 → v34), com autorização
  dele nesta sessão. A v33 em produção era de ~25/08 e estava **sem duas
  correções que já estavam no repositório desde 05/09**: o relay SMTP e o
  discriminador de severidade. §9.9 na veia — *commit não é deploy*.

  **Provado que a v34 está no ar**, e não pelo número de versão: forcei um tipo
  de falha que não era registrado desde 27/08 (`carimbo de tempo fora da
  janela`, para escapar do limite de 1 linha por hora) e a linha nova trouxe
  `corpo_parece_gotrue: false` — campo que **não existe** na linha de 27/08.

  **O que FALTA, e é só ele que pode fazer:** um **cadastro de verdade** com um
  endereço de teste. Nenhuma trava cobre isso —
  `envioDeEmailTemDoisCaminhos.test.js` garante que as propriedades do código
  não sumam, **não** que o e-mail chega, que a senha do relay está certa, nem
  que o remetente foi aceito no provedor.

  **Se falhar, a mensagem em `admin_logs` diz qual caminho estava em uso**
  (`relay <host>` ou `gmail`) — antes mandaria investigar o provedor errado. E a
  volta é apagar o segredo `SMTP_HOST`: sem ele o código cai no Gmail sozinho,
  sem deploy.

- ⬜ `[10/09]` 🟠 **O vigia das Edge Functions está CONSTRUÍDO e PROVADO — falta
  implantar 7 das 8.** *`[11/09]` O que falta é uma ação do dono, e ela está
  escrita abaixo.*

  **O que já existe e funciona**, com a prova junto:

  | Peça | O que faz | Estado |
  | --- | --- | --- |
  | `scripts/impressao-das-edges.mjs` (`npm run impressao-edges`) | deriva a impressão do CÓDIGO de cada função | pronto |
  | `scripts/__tests__/impressaoDasEdges.test.js` | reprova no `npm test` se a impressão escrita ficou velha | **provado** reinjetando o bug num arquivo IRMÃO (`politica.ts`) |
  | `scripts/edges-implantadas.mjs` (`npm run edges`) | pergunta a impressão a cada função NO AR e compara | **provado**: acusou as 8, e passou a dizer OK na que foi implantada |

  A impressão é derivada do código, e não uma data escrita à mão, justamente
  porque data à mão reproduz o problema: eu edito a função, esqueço de subir o
  número, e os dois lados concordam num valor velho — o portão fica verde no
  caso exato que ele existe para pegar.

  **O que falta, e por que eu parei aqui.** Só `cleanup-orphans` foi implantada
  (v12, e o `npm run edges` já a marca OK). As outras 7 somam **~2.100 linhas**,
  e o único caminho que eu alcanço é passar o código inteiro por uma chamada de
  ferramenta — ou seja, **eu retransscrevendo 2.100 linhas de código de
  produção**. Na `send-email` um caractere perdido derruba o cadastro. Trocar
  isso por um portão de monitoramento é uma conta ruim, e a §0.2 é sobre
  exatamente esse tipo de troca.

  **A ação do dono, e ela resolve de vez:** gerar um *Personal Access Token* em
  `supabase.com/dashboard/account/tokens` e me dar como `SUPABASE_ACCESS_TOKEN`.
  Com ele, `npx supabase functions deploy <nome>` implanta **do disco**, sem
  nada passar por mim — e aí as 7 vão de uma vez, o portão entra no CI, e toda
  implantação futura deixa de depender de transcrição.

  **Enquanto isso, o portão NÃO está no CI**, e isso é deliberado: ligá-lo hoje
  reprovaria todo PR por 7 funções que só o dono pode destravar, e portão que
  grita por algo que ninguém pode resolver ensina a ignorar o canal (§0.2, 4ª
  regra). `npm run edges` responde a pergunta a qualquer momento.

- ⬜ `[11/09]` 🟠 **A MARCA E A LANDING — briefing gravado, esperando UMA decisão.**
  *Tudo em [`docs/identidade/BRIEFING-2026-09.md`](docs/identidade/BRIEFING-2026-09.md);
  as duas imagens dele em `docs/identidade/referencias/12-` e `13-`.*

  **O que o dono já decidiu:** *"eu queria realmente usar GamerHub, G e o GH
  como marca em lugares distintos"* — não é escolher um, é um **sistema** com os
  três. Isso encerra a pergunta que eu tinha feito.

  **`[11/09]` A MARCA ESTÁ IMPLANTADA.** O dono trouxe a arte pronta e escolheu
  a proposta 03; ela foi derivada por medição (não redesenhada) e está no
  favicon, nos ícones do PWA, no cabeçalho e em 11 telas. Ver
  `docs/identidade/README.md`.

  **O que sobra deste item é a LANDING**, que continua a estrutura antiga: a
  recomendação dos três atos — a fenda, o que converge, e você já está dentro —
  não foi implementada. E a decisão do raio 3D no hero está no item acima.

  Duas decisões menores esperam junto: a **tese da fenda** (o verde e o roxo
  param de brigar e passam a se encontrar — custo zero, é narrativa) e a **troca
  da fonte de display**, que pode esperar porque atinge o site inteiro.

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

- ⬜ `[11/09]` 🟠 **O contador de tentativas de login nunca foi LIGADO.** *Ação
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

- ✅ `[05/09]` 🟠 **Rodar FASE 1 e FASE 3 da auditoria** — **FEITAS em 10/09**.
  Relatório em `db/2026-09-10-auditoria-fases-1-e-3.md`.

  **Fase 1:** build/lint/testes limpos; zero `dangerouslySetInnerHTML`, zero
  `target="_blank"` sem `rel`, zero `window.confirm`, zero emoji, zero timer ou
  canal sem cleanup, zero botão só-ícone sem nome acessível. O `innerHTML` do
  `supabase.js` e o `<iframe src>` do `EmbedPlayer` foram auditados e são
  seguros — no segundo, porque as regexes de `lib/embed.js` capturam o id em
  classe fechada que não aceita `/`, `?`, `#`, `:` nem `@`.

  **Corrigido:** duas corridas de `useEffect` (`useBloqueioDeLogin` e
  `FeatureGate`) — resposta antiga podia pintar a tela do estado novo.

  **Fase 3:** RLS ligada nas **29** tabelas, zero FK sem índice, a lista da
  trava `tabelasSemUpdate.js` confere com o banco linha a linha, e nenhuma
  tabela que o site apaga está sem policy de DELETE.

  **Corrigido:** `profiles` **nunca tinha sido analisada** (`last_analyze` e
  `last_autoanalyze` NULL) — a estatística dizia 0 linhas onde há 5, e ela é
  lida em toda policy de RLS. `ANALYZE` em 10 tabelas.

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

- ⬜ `[10/09]` 🔵 **A consulta de índice não usado da §6.1 é inócua neste
  volume.** `select ... where idx_scan = 0` devolve **36 dos índices**, e o
  motivo está medido: `posts` tem 188 linhas, `profiles` 5, `reports` 2. Em
  tabela desse tamanho o planejador escolhe varredura sequencial e **está
  certo** — o índice não é inútil, é para quando crescer.

  Não é para "consertar" agora: derrubar índice com base nisso seria o erro.
  Fica anotado para ninguém reabrir a mesma conclusão daqui a dois meses, e
  porque o sinal só passa a valer depois de tráfego real.

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
  fatias (`src/lib/`, <!--n:src.lib.arquivos-->105<!--/n--> arq ·
  <!--n:src.lib.linhas-->10.009<!--/n--> linhas; `src/services/`,
  <!--n:src.services.arquivos-->17<!--/n--> arq ·
  <!--n:src.services.linhas-->1.825<!--/n--> linhas) concentram quase todo o
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
