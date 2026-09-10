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

## O que NÃO foi auditado, e é a maior parte

Dito explicitamente porque o §97 manda: *"se não conseguir provar, diga NÃO
CONSEGUI PROVAR"*.

- as funções alcançáveis **fora** do recorte de classe C/D acima — as que não
  escrevem, ou que não recebem UUID. São a maioria das 48, e o risco delas é
  menor por construção, mas **não foram lidas uma a uma**;
- o fluxo de **moderação de conteúdo** (§14 do prompt 2) — a escalada de
  **role** e o **ban/suspensão** foram auditados e estão acima;
- **RPC chaining** e **confused deputy** — upsert e mass assignment foram
  auditados e estão acima;
- **isolamento de sessão**: cache, logout, role stale, downgrade;
- a **matriz de permissões** 29 ações × 4 papéis.

Nada disso está "provavelmente ok". Está **não verificado**.
