<!--
  Este arquivo é PARTE do `CLAUDE.md` — ele é puxado por `@import` e vale
  exatamente como se estivesse escrito lá dentro. Não é documentação do
  produto: é instrução de trabalho.

  Saiu do CLAUDE.md em 28/08/2026, quando o arquivo passou de 1.500 linhas e
  quatro seções estouraram o limite de ~150 do §6.2. A regra que manda dividir
  documento grande é do próprio arquivo; ele estava desobedecendo a si mesmo.

  Ao editar: as referências cruzadas (§1.3, §6.2…) continuam apontando para a
  numeração original, que não mudou. Nada foi reescrito na mudança — só movido.
-->

## 5. Trabalhando com o banco (Supabase MCP)

### O padrão de teste que funciona
Testar RLS de verdade exige **assumir o papel do usuário**, não rodar como
superusuário (que ignora RLS):

```sql
BEGIN;
-- (aplica a mudança que quero testar)

CREATE TEMP TABLE r(k text, v text);
GRANT INSERT, SELECT ON r TO authenticated, anon;   -- senão o papel não escreve nela

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<uuid-do-usuario>","role":"authenticated"}';

DO $$ BEGIN
  -- tentativa que DEVE falhar
  INSERT INTO ...;
  INSERT INTO r VALUES ('teste_x','FALHOU: conseguiu');
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('teste_x','OK: bloqueado');
END $$;

RESET role;
SELECT * FROM r ORDER BY k;   -- precisa ser o ÚLTIMO select
ROLLBACK;
```

**Gotchas que já custaram tempo:**
- `execute_sql` **só devolve o resultado do último `SELECT`** — juntar os
  veredictos numa tabela temporária e fazer um `SELECT` no fim.
- `\echo` e `PERFORM` fora de bloco plpgsql **não existem** ali; usar `DO $$`.
- Papel `authenticated` não escreve em temp table sem `GRANT` explícito.
- Um `EXCEPTION` no meio do bloco **aborta o resto do bloco** — testes
  independentes, cada um no seu `DO $$`.
- Contar linhas de tabela protegida por RLS **enquanto assume um papel sem
  acesso** dá 0 e parece que a feature quebrou. Verificar fora do papel.
- Em função `SECURITY DEFINER`, `current_user` é o **dono da função**, não o
  papel do cliente — é o que faz os guards de trigger não bloquearem as RPCs.
- Trigger dispara **independente de `EXECUTE`**: o Postgres checa esse
  privilégio na criação do trigger, não a cada disparo.

### Regras
- Mudança de schema/função → `apply_migration` (fica no histórico), com nome
  em `snake_case` descritivo.
- Mudança destrutiva (DELETE, DROP, revoke amplo) → **dimensionar antes**
  (`SELECT count(*)`), testar em `ROLLBACK`, e confirmar com o dono se apaga
  dado de usuário.
- Comentar **no SQL** por que a mudança existe. O `CREATE OR REPLACE` sozinho
  não conta a história.
- Rodar `get_advisors` (security + performance) depois de mudar schema.
- Documentar auditoria/mudança grande em `db/AAAA-MM-DD-*.md`.

### Toda ação de estado precisa da INVERSA e da LIMPEZA

> Duas falhas da mesma família apareceram no mesmo dia: suspensão que não tinha
> como ser removida, e fila de moderação que ficava presa para sempre depois do
> ban. Nos dois casos alguém escreveu o caminho de ida e parou ali.

**Ao criar qualquer ação que muda estado, responder as três antes de entregar:**

1. **Qual é a inversa, e quem pode executá-la?**
   Suspender pede tirar. Ocultar pede restaurar. Banir pede desbanir. Promover
   pede rebaixar. Se a inversa não existe, o estado é **permanente** — e aí a
   ação inteira precisa de autorização à altura disso.
   *O caso real:* `apply_suspension` existia sem `lift_suspension`, e o
   trigger-guarda impedia até o `UPDATE` manual. Um `admin` (rank 2) conseguia
   silenciar alguém **para sempre**, e nem o `owner` desfazia — a suspensão
   virava um banimento permanente pulando toda a hierarquia do ban.

2. **Quem passa a apontar para o nada?**
   Ao apagar conteúdo, o que referenciava aquilo? Fila de moderação, denúncias,
   notificações, logs, mídia no storage. **Onde não dá pra ter FK, tem que ter
   trigger** — e `moderation_queue.content_id` aponta pra quatro tabelas
   diferentes, então FK ali é impossível por construção.
   *O caso real:* `ban_user` apagava os posts e deixava os itens da fila
   `pending` apontando para linhas mortas, sem jeito de sair da tela.

3. **Quem precisa ficar sabendo?**
   O alvo da ação, a equipe, e a trilha de auditoria. Ação de moderação que o
   alvo descobre sozinho (porque o post sumiu) é indistinguível de bug, do lado
   dele.

**Corrigir sempre pela CLASSE, não pelo caso.** A limpeza da fila não pertence
ao `ban_user` — pertence a *qualquer* caminho que apague conteúdo: o próprio
autor apagando, o admin apagando, exclusão de conta, cascade de FK, e os
caminhos que ainda não existem. Trigger `AFTER DELETE` na tabela cobre todos de
uma vez; consertar dentro do `ban_user` cobriria um.

### Toda entrada de RPC precisa de FAIXA, não só de tipo

`p_days integer` aceita `36500`. Foi assim que uma suspensão de "alguns dias"
virou suspensão até o ano **2126** — e como não havia inversa (acima), virou
banimento permanente.

**O tipo diz o formato; a faixa diz o que faz sentido.** Antes de qualquer
`UPDATE` dentro de uma RPC:

- **Número:** mínimo e máximo explícitos, com `RAISE EXCEPTION` claro e em
  português — a mensagem chega no toast do usuário.
  `IF p_days < 1 OR p_days > 30 THEN RAISE EXCEPTION 'Suspensao deve ser de 1 a 30 dias…'`
- **Texto:** tamanho máximo, e lista fechada quando for enum de fato.
- **UUID de alvo:** existe? é o próprio? tem cargo igual ou superior?
- **Nulo:** `p_days IS NULL` passa por `< 1`? Em SQL, **não** — `NULL < 1` é
  `NULL`, e o `IF` não dispara. Checar `IS NULL` explicitamente.

**O limite superior é decisão de produto, e tem que estar escrita.** "Mais que
30 dias é caso de banimento, que tem hierarquia própria e caminho de reversão"
— isso vai no comentário do SQL, não só na cabeça de quem escreveu.

**Validação no cliente não substitui isto** (§1.3): o site usa a `anon key`, e
o dropdown que só oferece 1 e 7 dias não impede ninguém de chamar a REST API
com 36500.

### Eu passo por cima de toda proteção, e por isso preciso de disciplina própria

O guard `guard_profile_privileged_cols` reverte `role`, `banned` e
`suspended_until` **só quando `current_user` é `authenticated` ou `anon`**.
Pelo MCP eu rodo como `postgres`: o guard não me alcança, e um `UPDATE` direto
passa. O mesmo vale para RLS, para os pisos de moderação e para a hierarquia
de cargos.

**Isso não é brecha do site.** É a diferença entre o que um navegador consegue
fazer (onde a segurança mora, e onde ela segurou) e o que a credencial mestra
do banco consegue fazer (que é o que aquela credencial *é*). O acesso é do
dono, delegado a mim.

**Mas cria um buraco de rastreabilidade que é meu para fechar.** Mudança de
schema fica no histórico (`apply_migration`) e mudança de código fica no PR.
**Mudança de dado por `execute_sql` não deixa nada** — nem no `admin_logs`,
nem no git. Some junto com a conversa.

As três regras:

1. **Mexer em cargo, ban ou suspensão vai pela RPC, nunca por `UPDATE` cru.**
   `owner_set_role`, `ban_user`, `unban_user`, `apply_suspension`,
   `lift_suspension` existem e gravam em `admin_logs`. Um `UPDATE` direto
   chega no mesmo lugar sem deixar rastro — e a trilha de auditoria do dono
   passa a mentir por omissão.
2. **Mudança de dado que não seja de teste é anunciada, com número.** Quantas
   linhas, quais, e por quê — antes de rodar (§5, dimensionar).
3. **Dado de teste que eu crio, eu apago na mesma sessão**, e digo que apaguei.
   Post, perfil, linha de fila. O que não dá para apagar (log já gravado) eu
   aponto.

Se algum dia isso precisar de trava de verdade e não de disciplina, o caminho
é conectar o MCP com um papel restrito em vez do dono. Hoje não dá: auditoria
e migration exigem esse nível. Registrado para quando deixar de exigir.

### Coisas específicas deste banco
- RLS por **linha**; privilégio por **coluna** é por **papel**. "Dono vê tudo do
  próprio, nada do alheio" não se expressa com nenhum dos dois sozinho — precisa
  de RPC `SECURITY DEFINER` (ver `get_own_profile`, `admin_list_users`,
  `get_public_profile`).
- Toda `SECURITY DEFINER` precisa de `SET search_path = public`. Sem isso, a
  resolução de nomes segue o `search_path` de quem chama — vetor clássico de
  escalada.
- Funções admin/owner: `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO
  authenticated`, **além** da checagem interna por `auth.uid()`.
- **Curtida se conta de `post_likes`, nunca de contador em `posts`.**
  `[05/09]` A coluna `posts.likes` **foi apagada** — ela existia sem trigger
  nenhum que a mantivesse, ficou zerada desde sempre, e **três lugares
  diferentes** somaram ela ao longo do tempo achando que valia alguma coisa. O
  histórico está em [DECISOES.md](../DECISOES.md); o que fica como regra é a
  lição: contador desnormalizado exige acertar INSERT **e** DELETE, e
  desincroniza no primeiro caminho que alguém esquecer.

---
