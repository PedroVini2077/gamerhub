# `[10/09/2026]` Auditoria de segurança — o que a FASE 1 apurou

> **O que é este arquivo.** O retrato de um dia. Ele **deve envelhecer**, e o
> varredor de documentação o ignora de propósito. O estado atual mora em
> `docs/SEGURANCA.md`.

## De onde veio

Três prompts do dono, escritos **pelo ChatGPT** com acesso parcial ao
repositório. Ele deu junto a instrução que definiu o método: *"vamos seguir as
nossas regras e sempre verificar o que é verdade ou não"*.

Isso muda tudo: **cada afirmação técnica dentro dos prompts é hipótese até ser
conferida na fonte** (§1.4). Duas se confirmaram, uma se explicou sozinha, e a
maior descoberta do dia **não estava em nenhum deles**.

## Os três achados

| ID | O quê | Severidade | Estado |
| --- | --- | --- | --- |
| SEC-001 | `game_keys.key_code` legível **sem conta** | 🟠 | **FECHADO** |
| SEC-002 | `SEGURANCA.md` afirmando o que deixou de ser verdade | 🔵 | **FECHADO** |
| SEC-003 | `TRUNCATE` para `anon` em 27 de 29 tabelas | 🟠 | **FECHADO** |
| SEC-004 | a wordlist inteira legível sem conta | 🔵 | **FECHADO** |
| SEC-005 | `site_config.updated_by` legível por `anon` | 🔵 | **FECHADO** |
| SEC-006 | o cache do React Query **atravessava a troca de conta** | 🟡 | **FECHADO** |

### SEC-001 — a contradição entre a tela e a policy

A **interface** exige login: `/keys` está atrás de `RequireAuth`, o `RightPanel`
só existe logado. A **policy** não exigia nada — `Public keys` é `SELECT` para
`{public}` com `USING (true)`, e `key_code` estava no grant de `anon`.

Comprovado como `anon`, em `ROLLBACK`: **3 chaves reais**. Amostra mascarada
(`CY******************`); nenhuma chave copiada para lugar nenhum.

**O filtro do frontend nunca protegeu:** `useAdminData.js` faz `select('*')` e o
`!k.is_promo` roda no JavaScript. Quem chama o REST direto não passa pelo nosso
código.

### SEC-003 — o achado que ninguém pediu

Apareceu **investigando por que a correção do SEC-001 não funcionou**. O
`REVOKE SELECT (key_code) FROM anon` rodou **sem erro** e não mudou nada — o
grant de **tabela** cobre todas as colunas, e o de coluna vira irrelevante.

Ao ler a ACL da tabela para entender, apareceu `anon=arwdDxtm`: SELECT, INSERT,
UPDATE, DELETE **e TRUNCATE**.

**Provado:** `anon` truncou `game_keys` de **6 para 0 linhas**. RLS **não se
aplica a TRUNCATE**.

**Por que 🟠 e não 🔴**, e as duas metades foram verificadas:

1. o PostgREST **não expõe TRUNCATE** — os verbos são GET/POST/PATCH/DELETE;
2. o `DELETE`, que ele **expõe**, foi testado nas **29 tabelas** como `anon` e
   apagou **zero linhas** — a RLS segurou todas.

Era privilégio de destruição total sem detonador conhecido. O que não existia
era **defesa em profundidade**.

**A origem não é código nosso:** nenhuma migration deste repositório contém
`GRANT ALL`. Vem do template padrão do Supabase — e isso vale para qualquer
projeto na plataforma.

## O que a FASE 1 apurou de BOM, com evidência

| | |
| --- | --- |
| RLS ligada | **29 de 29** tabelas |
| `SECURITY DEFINER` sem `search_path` | **0** de 77 |
| funções com grant padrão para `PUBLIC` | **0** |
| escrevem sem `auth.uid()` **e** alcançáveis pelo cliente | **0** |
| `can_moderate_content` | usa `>` **estrito** — admin não modera outro admin |
| `role_rank` de valor desconhecido | cai em **0**, o menos privilegiado |
| `DELETE` por `anon` nas 29 tabelas | **0 linhas** apagadas |

> **O `0` da quarta linha foi provado, não aceito.** A mesma consulta devolve
> **48** quando afrouxo a condição — então o `[]` é resultado, não varredura
> quebrada dando verde falso (§1.5).

## O que o prompt suspeitava e se explicou sozinho

`profiles?select=id` respondendo **200** era, para o ChatGPT, motivo de
auditoria. A explicação é benigna e verificável: **privilégio no Postgres é por
COLUNA**. `authenticated` lê 16 colunas de `profiles` e **não** lê `birth_date`,
`email` nem o histórico de ban. A migration de hardening de 21/08 está
funcionando.

## A lição técnica que vale mais que os três achados

**`REVOKE SELECT (coluna)` não faz nada enquanto existir grant de tabela.**

Ela roda sem erro, sem aviso, e deixa a falha aberta. Sem o teste em `ROLLBACK`
exigido pelo §5, eu teria declarado o SEC-001 corrigido com ele intacto — e o
relatório diria "fechado".

## As 12 policies `USING (true)` — auditadas

**Nenhuma é vulnerabilidade por si, e o motivo importa:** as 12 são **SELECT**.
Não existe **nenhuma** `WITH CHECK (true)` em tabela com `user_id`, `role`,
`status` ou `approved` — que era o alerta principal do §20 do prompt.

O que decide o que vaza, no desenho deste projeto, é o **grant de coluna**: a
policy libera a linha, o grant decide o que se lê dela. Foi olhando por essa
lente que saíram o SEC-001, o SEC-004 e o SEC-005.

**Uma constatação que muda a leitura de tudo:** `user_id` e `created_by` são
legíveis por `anon` em 8 das 10 tabelas restantes — **mas `profiles` está
fechado para `anon`**, então UUID não vira nome. A cadeia de identificação está
quebrada, e é isso que rebaixa esses casos de 🟡 para ruído.

## Escalada vertical — auditada, e fechada

**Cinco caminhos alteram `profiles.role`**, achados por busca semântica no corpo
das funções (não pelo nome): `owner_set_role`, `admin_set_role`,
`decide_role_demotion`, `decide_staff_trial`, `review_staff_nomination`.

`owner_set_role` chamou atenção por **não** usar `role_rank` nem `is_super` —
mas ler o corpo mostrou que aqui a lista literal é **correta**, não bug:
`is_super()` seria mais **fraco**, porque incluiria `super_admin`. Ela ainda
impede auto-alteração, não aceita `'owner'` entre os destinos possíveis, protege
o fundador e grava auditoria com o ator real.

### O teste que decide, com a role conferida DEPOIS

| Tentativa, como `user` | Resultado |
| --- | --- |
| virar `owner` via `owner_set_role` | **negado** — *"apenas o fundador pode alterar roles"* |
| auto-promover via `admin_set_role` | **negado** — *"admin necessário"* |
| rebaixar o fundador | **negado** |
| `UPDATE profiles SET role='owner'` direto | **passou sem erro** |
| **a role no fim** | **continua `user`** |
| **a role do fundador no fim** | **continua `owner`** |

**A quarta linha é a razão de este teste existir.** O comando não deu erro
nenhum — e não mudou nada: o trigger `guard_profile_privileged_cols` reverteu
por baixo. É a fonte de silêncio nº 3 do §1.5 ("trigger-guarda que reverte"),
aqui trabalhando a favor.

Se eu tivesse conferido só se houve erro, teria concluído errado **nos dois
sentidos**: "passou" na quarta, e "está tudo negado" sem saber se a role mudou.
É exatamente o que o §72 do prompt exige — *"não aceite que a função retornou
erro sem verificar que a role permaneceu intacta"*.

**Defesa em profundidade confirmada:** a RPC nega **e** o trigger reverte.

## IDOR / BOLA — a classe prioritária, auditada

O §11 marcou como **classe prioritária** porque já aconteceu aqui, em
`check_staff_eligibility`. O recorte que importa: função **alcançável pelo
cliente**, que recebe **UUID**, e que **não usa `auth.uid()`** — ou seja, cujo
alvo é escolhido inteiramente por quem chama.

**São duas, e as duas se sustentam:**

| Função | Por que não é IDOR |
| --- | --- |
| `contato_dados_para_resposta(p_id)` | primeira linha é `IF NOT is_staff() THEN RAISE`. Ler qualquer mensagem **é** o desenho — a equipe responde o contato |
| `get_user_xp(p_user_id)` | devolve o mesmo XP que a tela `/ranks` já mostra a quem tem conta. Não há dado novo em passar o UUID de outra pessoa |

As duas estão concedidas **só a `authenticated`** — `anon` foi revogado na
migration de 05/09, e continua revogado.

## Ban e suspensão — a frente com histórico de falha real aqui

Testado com **fixture dentro da transação**: um `user` foi promovido a `admin` e
outro a `super_admin` só para o teste, e o `ROLLBACK` desfez tudo. Nenhum dado
real foi alterado (§94).

| Tentativa, como `admin` | Resultado |
| --- | --- |
| banir o **owner** | negado — *"cannot ban equal or higher"* |
| suspender o **owner** | negado — *"cannot suspend equal or higher"* |
| banir um **super_admin** | negado — *"cannot ban equal or higher"* |
| suspender por **36.500 dias** | negado — *"deve ser de 1 a 30 dias"* |
| suspender com `p_days = NULL` | **negado** — *"deve ser de 1 a 30 dias"* |
| desbanir o owner | negado — *"super_admin required"* |
| **estado do owner no fim** | `banned=false` · `suspenso=null` |

**As duas linhas que mais importam:**

O **36.500** é a falha histórica deste projeto — a suspensão que virou ano 2126
e, sem inversa, virou banimento permanente pulando a hierarquia. **Continua
fechada.**

O **`NULL`** é a armadilha do SQL que o `BANCO.md` documenta: `NULL < 1` é
`NULL`, e um `IF` ingênuo **não dispara**. A função trata explicitamente — se
não tratasse, `p_days = NULL` passaria pela faixa e produziria uma suspensão sem
data.

E o `unban_user`, que meu regex não conseguiu confirmar como "checa o alvo",
**nega pelo cargo**: desbanir exige `super_admin`. O regex era inconclusivo; o
comportamento é claro.

## Upsert e mass assignment — auditados

O §53 avisa que **upsert é esquecido em auditoria porque parece um INSERT**.
São dois no projeto, e o §63 aponta um `update(form)`:

| Onde | Veredito |
| --- | --- |
| `aceiteService` → `policy_acceptances` | **correto**. `WITH CHECK (user_id = auth.uid())` torna **impossível** registrar aceite em nome de outra pessoa |
| `useAdminNotifications` → `admin_notification_reads` | **correto**. `WITH CHECK` exige ser staff **e** `admin_id = auth.uid()` — dupla checagem |
| `KeyEditor` → `update(form)` | **baixo**. `game_keys` exige `is_staff()` no UPDATE, e a tabela não tem coluna de privilégio: mandar campo a mais não escala nada |

**O primeiro é o que mais importava.** `policy_acceptances` é a prova de
consentimento da LGPD — se desse para inserir em nome de outro, a trilha inteira
passaria a mentir, e o projeto perderia justamente o que o desenho de 02/09 foi
construído para garantir.

## Escalada de SEGUNDA ORDEM — a classe que o §62 marcou como prioridade

O ataque que o prompt descreve: *"cria nomination → manipula status → chama
approve → ganha role"*. Alterar um estado aparentemente inocente e depois usá-lo
para obter privilégio.

**Primeira tentativa, e ela não provou nada:** a indicação nem chegou a ser
criada — o candidato não passa nos critérios de elegibilidade. Registrei como
**NÃO TESTADO**, e não como "seguro", porque a barreira que atuou foi outra.

**Segunda tentativa, forçando a condição exata:** a indicação foi inserida por
fora, já com `nominated_by` = o próprio admin que ia revisar.

| Passo | Resultado |
| --- | --- |
| aprovar a **própria** indicação | **negado** — *"apenas super admins ou o fundador podem analisar"* |
| status da indicação | continua `pending` |
| role do candidato | continua `user` |
| `UPDATE staff_nominations SET status='approved'` | **passou sem erro** |
| status depois do UPDATE | **continua `pending`** |

**Há separação de poderes de verdade:** admin **indica**, super_admin ou o
fundador **aprovam**. A cadeia de segunda ordem quebra no elo do meio.

E a última linha repete o padrão que já apareceu duas vezes nesta auditoria: o
comando passa **sem erro** e não muda nada — `staff_nominations` não tem policy
de `UPDATE`, então a RLS nega devolvendo zero linhas. Escrita ali só por RPC.

## As funções de escrita com UUID — o recorte das classes C e D

Em vez de ler 48 corpos, o §15 pede classificação por risco. O recorte que
importa: **alcançável pelo cliente + escreve + recebe UUID + checa cargo mas
não usa `can_moderate_content`**. Deu **nove**, e sete já estavam auditadas
comportamentalmente (role, ban, suspensão, staff). As duas restantes:

- **`admin_delete_unconfirmed_user`** — apaga conta, então foi lida inteira.
  **Valida o alvo de verdade:** `WHERE p.id = p_user_id AND u.confirmed_at IS
  NULL`. Só apaga cadastro **nunca confirmado**, e explode com mensagem clara
  se for outra coisa. Grava auditoria com o ator real.
- **`contato_registrar_resposta`** — exige `is_staff()`; responder qualquer
  mensagem é o desenho.

## SEC-006 — a consequência que faltava para o spoof de `role`

**Este é o achado mais interessante do dia**, porque ele liga a ponta que o
próprio prompt tinha deixado em aberto.

O prompt classificou o spoof de `role` no DevTools como *"client-side trust /
expected tamperability"* — **enquanto não houvesse consequência no backend**. E
mandava não inflar. Estava certo.

**Só que havia uma consequência, e ela não estava no banco: estava no cache.**

O React Query guarda em **memória**, e várias chaves privilegiadas **não levam o
usuário dentro delas**: `['owner_users']`, `['owner_audit_logs']`,
`['owner_stats']`, `['reports']`, `['role_change_requests','pending']`.

Sair do site **não recarrega a página** — só a saída do banido faz `replace`. E
nada limpava o cache: `signOut()` fazia `signOut` no Supabase e
`setProfile(null)`, mais nada.

**A cadeia completa:**

1. o dono entra, abre o painel — cache preenchido com a lista de usuários;
2. sai (sem recarregar a aba);
3. outra pessoa entra na **mesma aba**;
4. forja `role: owner` no DevTools — o teste que o dono já fez;
5. o painel monta;
6. **o React Query serve o cache antes de qualquer refetch ser negado.**

O passo 6 é o que faltava. As RPCs continuam negando — mas o dado renderizado
não veio delas, veio da memória.

**Severidade 🟡:** exige a mesma aba, logo após a saída de alguém privilegiado,
e DevTools. Não é acesso remoto. Mas é o cenário exato do §67 do prompt ("teste
de session switch"), e o custo de fechar foi de três linhas.

**A correção limpa por IDENTIDADE, não por evento.** `onAuthStateChange` também
dispara em `TOKEN_REFRESHED`, e limpar ali faria o site refazer todas as
consultas de hora em hora — egress à toa, que é a cota mais apertada do plano.

**Trava:** `cacheNaoAtravessaTrocaDeConta.test.js`, provada reinjetando as duas
metades — sem o `clear()`, e com ele disparando a cada evento. Ela vigia também
a **deriva**: chave de painel nova que nasça sem identidade reprova.

## SEC-007 — a moderação de conteúdo: a hierarquia segurou, a TELA mentiu

🟡 **Médio.** Não é escalada: a hierarquia funcionou exatamente como projetada.
O defeito é o site **relatar ações que não aconteceram** — inclusive na trilha
de auditoria do dono.

**A causa raiz é uma assimetria proposital entre duas policies de `posts`:**

| operação | regra | tipo |
| --- | --- | --- |
| VER a lixeira | `role_rank(...) >= 2` | plana — qualquer admin vê tudo |
| APAGAR | `can_moderate_content(user_id)` | hierarquia **estrita** (`>`) |

As duas estão certas isoladamente — é a Fase 4 pura (§6, deriva entre dois
lugares que se olham por dentro e não concordam entre si). Juntas produzem o
caso em que o admin **enxerga na tela** um post que **não pode apagar**: o do
owner, o de outro admin. E `DELETE` recusado pela RLS devolve **0 linhas e
nenhum erro** (§1.5, fonte de silêncio nº 2).

**Provado em `ROLLBACK`**, com um post do owner na lixeira:

```
1_admin_ve_na_lixeira  1 linha(s) — SIM, aparece na tela dele
2_delete_individual    0 linha(s) apagada(s) — BLOQUEADO pela RLS, E SEM ERRO
3_apagar_todos         a tela conta 176, o banco apaga 175 -> A TELA MENTE
```

**O impacto real não é o post sobreviver** — é o que o site diz que fez. O toast
dava *"Post apagado permanentemente"* e o `logAudit` gravava
`admin_permanent_delete_post` em `admin_logs`: uma exclusão que nunca aconteceu,
escrita na trilha que o dono usa para saber o que a equipe fez. O `BANCO.md` já
nomeia esse risco — *"a trilha de auditoria do dono passa a mentir"*.

**Hoje o número não diverge por sorte:** não há post de cargo alto na lixeira. É
o caso do §1.3 — *"achou algo que não quebrou ainda por baixo volume? Corrigir
igual"*.

### A varredura de CLASSE, que é o que valeu a pena

§1.3 manda perguntar *"onde mais esse padrão existe?"*. Varrendo os 17 `delete()`
de `src/`, **8** não conferiam linha nenhuma. Classificados um a um:

| Corrigido — 0 linhas é falha de verdade | O que a pessoa via antes |
| --- | --- |
| `useAdminContentActions` · apagar post da lixeira | "apagado permanentemente", e o post continuava |
| `useAdminContentActions` · apagar TODOS da lixeira | o número da tela, não o do banco |
| `useAdminContentActions` · remover key/promo | "Removido", e o item continuava |
| `useAdminLiveActions` · remover silêncio do chat | trilha dizia "silêncio removido", pessoa seguia calada |
| `liveService.unsilenceUser` | o mesmo, pelo caminho do serviço |
| `moderationService.removeBlockedWord` | palavra some da tela e **continua bloqueando** |

Os outros **quatro** são o caso legítimo de 0 linhas: descurtir o que já não
está curtido é objetivo atingido, não falha (§1.5, *"0 linhas é AMBÍGUO"*), e a
linha é da própria pessoa. Esses ficaram com o marcador `0-linhas-ok:` **e o
motivo escrito ao lado**.

**Trava:** `apagarConfereLinhas.test.js` — varre `src/` e reprova todo
`delete()` do Supabase sem `count: 'exact'`, separando-os dos `.delete()` de
`Set`/`Map` (`objectUrls.js`, `dbHealth.js`) para não virar ruído. Provada
reinjetando o bug: ela falhou nomeando
`src/hooks/useAdminContentActions.js:77`, e voltou ao verde ao restaurar.

O marcador de dispensa **exige motivo escrito** de propósito: silenciar a trava
tem que custar uma frase, senão vira o `eslint-disable` que a §6.1 proíbe.

## SEC-008 — o período de avaliação de staff podia acabar no ano 12020

🟡 **Médio.** Achado pela frente de **RPC chaining / confused deputy**, e a
cadeia é `nominate_staff` → `review_staff_nomination` → `decide_staff_trial`.

**Primeiro, o que a varredura encontrou de BOM**, porque isso também é
resultado. Das 9 funções alcançáveis que chamam outra privilegiada, as quatro
que recebem UUID do chamador estão corretas:

| função | o UUID que ela recebe é… | guarda |
| --- | --- | --- |
| `request_unban(p_user_id)` | o **alvo banido**, nunca o ator | `is_staff()`, e o ator sai de `auth.uid()` |
| `contato_dados_para_resposta(p_id)` | a mensagem, não a pessoa | `is_staff()` antes de ler |
| `check_staff_eligibility(p_user_id)` | qualquer um | `p_user_id <> auth.uid() and role_rank < 2` → nega |
| `nominate_staff(p_candidate_id)` | o candidato | só cria linha `pending`; não promove |

E a **separação de poderes está correta e é deliberada**: `nominate_staff` exige
`v_caller_role = 'super_admin'` (string exata, que exclui o `owner`) para
indicar a super admin — parece a falha de "lista de papéis escrita à mão" que
este projeto já teve três vezes, mas **não é**: a própria mensagem de erro
explica que *"o fundador é o avaliador independente dessas indicações"*. Quem
indica não decide.

### O que estava errado

`review_staff_nomination(p_trial_days)` e `decide_staff_trial(p_extend_days)`
tinham **piso e nenhum teto**:

```
if p_trial_days is null or p_trial_days < 1 then raise ...
```

É a regra do [BANCO.md](../docs/regras/BANCO.md) — *"toda entrada de RPC precisa
de FAIXA, não só de tipo"* — e a **mesma** falha que virou uma suspensão até
2126. Provado em `ROLLBACK`:

```
1_trial_absurdo  ACEITO — 3.650.000 dias
2_consequencia   cargo virou "admin" e a revisao ficou para 12020-01-20
```

**Por que importa, se quem chama já é super admin.** Porque o trial é
exatamente o que autoriza um super admin a promover **sem o fundador**:
`owner_set_role` exige `owner`, e este caminho aceita `role_rank >= 3` *porque o
cargo entra em avaliação*. Um trial que vence no ano 12020 é uma promoção
definitiva com outro nome.

E o vencimento **não é cobrado por máquina nenhuma** — não há cron sobre
`trial_review_date`, conferido em `cron.job`. Quem cobra é uma pessoa vendo o
`TrialCard`, que mostra `daysUntil(trial_review_date)`. Data absurda tira o caso
da frente dessa pessoa para sempre.

**E "a tela não oferece esse número" não protege:** o `roleNominationService`
**nem envia** os dois parâmetros — usa os defaults (45 e 15). O site usa a
`anon key`, e a REST API aceita o que o frontend nunca manda. Efeito colateral
bom: como nenhuma tela envia esses valores, a faixa não quebrou caminho algum.

### As duas correções, e por que são duas

1. **Faixa nos parâmetros** — trial de 7 a 180 dias, extensão de 1 a 90, e o
   trial inteiro limitado a 365 dias contados do início (senão extensões
   repetidas reconstroem o problema em parcelas). Os limites são decisão de
   produto e estão **escritos no SQL**, como manda o BANCO.md.
2. **`CHECK` no banco** — `staff_nominations_trial_max_365d`. Pela tabela do §2,
   é a trava mais forte: torna o dado errado **impossível de existir**, e é a
   única que continua valendo se alguém amanhã reescrever a função e esquecer o
   teto. Testada em `ROLLBACK` nas três pontas: 0 linhas existentes recusadas
   pelo `ALTER`, o trial absurdo recusado, o de 180 dias aceito.

`get_advisors` depois da mudança: **nenhum aviso novo**.

## SEC-009 — o UPDATE de conteúdo ignorava a hierarquia que o DELETE respeita

🟠 **Alto.** Explorável por qualquer conta de **staff**, e é escalada
horizontal de verdade — não é só a tela mentindo, como no SEC-007.

**Provado em `ROLLBACK`**, um admin (rank 2) contra um post do fundador (rank 4):

```
conteudo="TEXTO TROCADO PELO ADMIN" · oculto=true
3_rpc_soft_delete  recusado: Sem permissão para excluir este post
```

O caminho oficial (a RPC) **barrava**, e o `PATCH` direto no PostgREST
**passava**. O admin não conseguia apagar o post do fundador, mas conseguia
**reescrever** e **ocultar** — e reescrever é pior, porque é silencioso: o post
continua no lugar, com outro texto.

### A causa: DELETE e UPDATE discordavam nas três tabelas

| tabela | DELETE | UPDATE (antes) |
| --- | --- | --- |
| `posts` | `can_moderate_content(user_id)` | `... OR is_staff()` |
| `comments` | `can_moderate_content(user_id)` | `role_rank(...) >= 2` |
| `community_posts` | `can_moderate_content(user_id)` | `role_rank(...) >= 2` |

`can_moderate_content` é `role_rank(quem_chama) > role_rank(autor)` —
**estrito**, e é o modelo que este projeto escolheu de propósito. `is_staff()` e
`role_rank >= 2` são planos: qualquer staff alcança qualquer autor, **inclusive
quem está acima dele**.

É Fase 4 pura: os dois lados corretos por dentro, discordando entre si.

### O caminho até aqui — duas hipóteses minhas que o teste derrubou

Registrado porque é o §1.1 em ação, e as duas eram inferência vestida de fato:

1. **"O admin consegue rebaixar o fundador por `PATCH` em `profiles`"** —
   `profiles_update` permite `is_staff()` em qualquer linha, e `authenticated`
   tem `UPDATE` em `role`, `banned` e `suspended_until`. Parecia 🔴. **Testei e
   falhou**: o `UPDATE` respondeu "1 linha, sem erro" e o cargo **não mudou**. O
   `guard_profile_privileged_cols` vivo reverte para **todo** chamador
   `authenticated`, sem condição de rank. Eu havia lido a condição
   `role_rank < 2` no `guard_post_privileged_cols` — outro guard, outra tabela —
   e atribuído ao de `profiles`.
2. **"A correção quebra a edição do autor"** — o primeiro teste da policy nova
   deu `4_autor_edita_o_proprio → 0 linhas`. Não era a policy: o teste anterior,
   no **mesmo post**, tinha setado `hidden_at`, e `posts_select` exige rank ≥ 2
   para enxergar post oculto. O autor não conseguia mais **ler** a linha para
   atualizá-la. Refeito com um post por cenário, deu `1 — OK`.

O segundo é o gotcha que o `BANCO.md` já documenta (*"contar linhas de tabela
protegida por RLS enquanto assume um papel sem acesso dá 0 e parece que a
feature quebrou"*), aplicado a `UPDATE`.

### A correção, e por que as três policies não ficaram iguais

`posts` recebeu exatamente a expressão do `posts_delete`: autor **ou**
hierarquia. `comments` e `community_posts` **não tinham** o ramo do autor —
usuário comum não edita comentário neste site — e acrescentá-lo seria mudança de
comportamento disfarçada de conserto. Elas ficaram com *"é staff **E** (supera o
autor **ou** é o próprio)"*: o `ou é o próprio` existe porque
`can_moderate_content(eu_mesmo)` é falso (`rank > rank`), e sem ele o fundador
perderia a capacidade de ocultar o próprio comentário.

**Não quebra a moderação**, e isso foi medido: ocultar conteúdo é `UPDATE
hidden_at` direto (`setHiddenAt`), então esta policy **é** o caminho da
moderação. O que muda é só o alcance.

**Trava:** `hierarquiaNoConteudo.test.js`, que lê a **última** definição de cada
uma das seis policies nas migrations e exige `can_moderate_content`. Provada
reinjetando o bug numa migration posterior: dois testes falharam nomeando
`posts_update`. **O que ela não cobre, dito com todas as letras:** policy trocada
direto no banco, sem migration.

### Junto: os `update()` que não conferiam a contagem

Mesma varredura de classe do SEC-007, agora do lado do `UPDATE`. **Seis
corrigidos**, e dois eram graves:

- `moderation_queue` — o conteúdo era ocultado e o item podia **não sair de
  `pending`**. Voltava para a fila no carregamento seguinte, já tratado, e o
  moderador tratava de novo;
- os dois pedidos de reativação de live — não conferiam **nem `error`, nem
  contagem**. A live era reativada e o pedido continuava `pending`.

Mais `game_keys`, `reports`, `profiles` (perfil e preferência de notificação) e
`posts`. O de `notifications` (marcar tudo como lido) ficou com o marcador
`0-linhas-ok`: a linha é da própria pessoa e 0 significa "nada não lido".

> **Correção de um número meu.** O `BACKLOG.md` dizia **13** `update()` sem
> contagem. Estava errado: aquele `grep` era por LINHA, e chamada quebrada em
> várias linhas põe o `{ count: 'exact' }` numa linha diferente da do
> `.update(` — o `contatoService.js`, que já estava correto, foi contado como
> faltando. O número real de corrigidos é **6**.
>
> O mesmo defeito estava dentro da trava: ao estendê-la para `update()`, a busca
> olhava 14 linhas fixas e o `count` da chamada **seguinte** dava a anterior por
> conferida. Reinjetei o bug e o teste **passou** — decoração, não trava (§2).
> Agora o trecho para no `;` que fecha o statement, e a reinjeção falha nomeando
> `src/services/moderationService.js:31`.

## O que NÃO foi auditado, e é a maior parte

Dito explicitamente porque o §97 manda: *"se não conseguir provar, diga NÃO
CONSEGUI PROVAR"*.

- as funções alcançáveis **fora** do recorte de classe C/D acima — as que não
  escrevem, ou que não recebem UUID. São a maioria das 48, e o risco delas é
  menor por construção, mas **não foram lidas uma a uma**;
- a **matriz de permissões** 29 ações × 4 papéis — não foi levantada;
- **role stale** e **downgrade durante sessão ativa** — auditado **em parte**, e
  a parte que falta é do lado do navegador.

  **O lado do banco está provado:** nenhuma função e nenhuma policy tira o
  **cargo** do JWT. A varredura por `request.jwt`, `jwt_claims` e `auth.jwt()`
  em `pg_proc` e `pg_policies` devolveu **uma única** ocorrência —
  `notify_admin_new_live`, que lê o `sub` (a identidade, que não envelhece num
  rebaixamento), não o papel. Todo o resto relê `profiles.role` a cada chamada,
  então um `admin` rebaixado perde o poder na chamada seguinte, sem esperar
  refresh de token.

  **O que NÃO foi verificado:** a tela. Se o painel continua montado até o
  próximo carregamento, o rebaixado veria a interface (sem conseguir executar
  nada — o banco nega). Isso é comportamento de front, e exige teste de
  navegador com duas sessões;
- se algum staff **reescreveu conteúdo alheio antes de 10/09**. A brecha existiu
  e não dá para saber pela trilha: `log_post_event` grava a edição com
  `actor_id := NEW.user_id`, ou seja, **atribuída ao autor**, não a quem editou.
  Está no `BACKLOG.md`.

Do que estava nesta lista na versão anterior, saíram duas frentes: o fluxo de
**moderação de conteúdo** (§14 do prompt 2), que produziu o SEC-007, e **RPC
chaining / confused deputy**, que produziu o SEC-008.

Nada disso está "provavelmente ok". Está **não verificado**.
