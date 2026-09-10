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

## O que NÃO foi auditado, e é a maior parte

Dito explicitamente porque o §97 manda: *"se não conseguir provar, diga NÃO
CONSEGUI PROVAR"*.

- as **48 funções alcançáveis** pelo cliente, uma a uma, com as 30 perguntas;
- os fluxos de **role, ban, suspensão e moderação** (§10 a §14 do prompt 2);
- **IDOR/BOLA** função a função;
- **upsert**, **mass assignment**, **RPC chaining**, **confused deputy**;
- **isolamento de sessão**: cache, logout, role stale, downgrade;
- a **matriz de permissões** 29 ações × 4 papéis.

Nada disso está "provavelmente ok". Está **não verificado**.
