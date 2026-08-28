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

## 6. Auditoria periódica (plano em 4 fases)

Quando o dono pedir "auditoria", "testes do site", "caçar bugs/brechas" ou
similar. **Uma fase por vez**, relatório ao fim de cada uma.

> Fases 1–3 olham cada camada por dentro. A **Fase 4** olha se elas concordam
> entre si — é a fase que pega o bug que não estoura em lugar nenhum.

> **Sobre aprovação:** o padrão é relatar e esperar antes de aplicar correções
> amplas. **Exceção:** falha de segurança explorável se fecha na hora (§1.3) —
> relatando junto o que foi feito. Refactor e mudança de comportamento sempre
> esperam aprovação.

### FASE 0 — Inventário (obrigatória, antes de qualquer fase)

Auditoria sem inventário vira amostragem disfarçada. Antes de começar, gerar a
**lista fechada de tudo que precisa ser olhado** e trabalhar em cima dela:

```bash
find src -name '*.jsx' -o -name '*.js' | xargs wc -l | sort -rn   # todo o código
```
```sql
-- toda a superfície do banco
select tablename from pg_tables where schemaname='public';
select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public';
select tablename, policyname, cmd from pg_policies where schemaname='public';
```

Anotar os totais (ex.: "131 arquivos / 14.362 linhas · 27 tabelas · 52 funções
`SECURITY DEFINER`"). **Esses números são a meta de cobertura** e vão no
relatório final como `lidos X de Y`.

### Cobertura: o padrão é LER TUDO

Este projeto tem ~14 mil linhas. **Isso é lível por inteiro** — não é grande o
bastante pra justificar amostragem. O padrão passa a ser:

- **Ler 100% do código** de `src/`, arquivo por arquivo, percorrendo a lista da
  Fase 0. Grep serve para *achar* rápido, **nunca** para substituir a leitura.
- **Ler 100% do corpo** das funções `SECURITY DEFINER`. Metadados (quem
  executa, tem `search_path`, checa role) provam **cobertura**, não
  **corretude**: 6 falhas reais já passaram por eles com os guards "certos" e
  erro no meio do código — `admin_unlock_login` que barrava o próprio fundador,
  `soft_delete_post` sem hierarquia, `total_xp` nunca preenchido.
- **Enumerar 100%** de tabelas, policies, FKs, índices e triggers.

Se por algum motivo não der pra ler tudo numa sessão, **registrar onde parei**
(no `BACKLOG.md`) e retomar dali — nunca declarar a fase concluída com leitura
parcial.

### Honestidade sobre o método

**Ao relatar, dizer qual método foi usado e o número real de cobertura** —
"li 131 de 131 arquivos" ou "li 40 de 131, parei em X". Nunca deixar parecer
que "olhei tudo" quando foi grep. Se a fase foi parcial, ela está **parcial**,
não concluída.

### Ao achar algo, CORRIGIR — não só listar

Auditoria que só produz lista não serve. Para cada achado:
1. **Reproduzir** (§1.2) — provar que existe, com teste que falha.
2. **Corrigir** de verdade, testando em `ROLLBACK` antes de produção.
3. **Reverificar** que morreu **e** que os caminhos vizinhos não quebraram.
4. Registrar no relatório: causa raiz, como provei, como validei.

Achado que eu decidir **não** corrigir agora vai pro `BACKLOG.md` com o motivo
explícito — nunca some em silêncio.

### FASE 1 — Frontend
- `npm run build` limpo · lint (0 erros) · testes verdes.
- Rules of Hooks (nenhum hook após early return/condicional).
- Memory leaks: subscription/timer/realtime sem cleanup.
- Race conditions: `useEffect` que busca dado com dep variável sem guarda de
  cancelamento (resposta velha sobrescrevendo a nova).
- Validação de input; estados de loading/erro cobertos.
- **Segurança:** `dangerouslySetInnerHTML`/`innerHTML`/`eval`; `href`/`src`
  vindos de dado de usuário; `target="_blank"` sem `rel`; checagem de permissão
  que só existe no cliente.
- Acessibilidade: botão só-ícone sem nome acessível.
- Emoji na UI; `window.confirm`/`prompt`.

### FASE 2 — Backend
- **Enumerar todas** as funções `SECURITY DEFINER` com: quem pode executar,
  tem `search_path`?, usa `auth.uid()`?, checa role?
- **Ler o corpo** de: (a) toda função sem checagem de identidade que seja
  chamável por `anon`/`authenticated`; (b) toda função que escreve em tabela de
  outro usuário; (c) toda função de moderação/permissão. Registrar quantas de
  quantas foram lidas.
- Validação de parâmetro (a função confia no que o cliente mandou?).
- Lógica de negócio: ban, bloqueio de login, XP, moderação.
- Tratamento de erro e risco de SQL injection (concatenação de string).

### FASE 3 — Banco
- RLS ligado em **todas** as tabelas; policy por comando (SELECT/INSERT/
  UPDATE/DELETE) — **tabela sem policy de UPDATE nega em silêncio**.
- Policy de SELECT que exponha dado sensível a `anon`/`authenticated`.
- Publicação realtime (`supabase_realtime`) e `REPLICA IDENTITY`.
- Índices em coluna filtrada/ordenada; FK sem índice de cobertura.
- Integridade: FK e regra de `ON DELETE` (um `NO ACTION` esquecido trava
  exclusão de conta).
- `get_advisors` security **e** performance.

### FASE 4 — Deriva entre o código e o banco

> A fase que faltava. As Fases 1, 2 e 3 olham cada lado **por dentro** e o
> encontram saudável. Esta olha se os dois **concordam entre si** — e foi de
> onde saíram três bugs em um único dia, todos invisíveis em runtime.

**Por que existe uma fase só pra isso.** O frontend estava correto. O banco
estava correto. O que estava errado era a *combinação*: o código assinava uma
tabela que a publicação não continha, mapeava tipos que o banco não produzia
mais sozinho, e casava palavras por uma regra diferente da do trigger. Ler
qualquer um dos dois lados isoladamente não revela nada.

**O sintoma característico:** nada estoura, nada loga, e a funcionalidade
simplesmente **não acontece**. Ver §1.5.

#### A varredura — confrontar código × banco, item a item

| O que confrontar | Como achar a deriva | O caso real |
| --- | --- | --- |
| **Assinaturas de realtime** × publicação `supabase_realtime` | listar `table: 'x'` e `useRealtime('x')` no código, cruzar com `pg_publication_tables` | `unban_requests` e `live_reactivation_requests` assinadas e nunca publicadas |
| **Mapas de tipo no JS** × valores que o banco realmente grava | ver o que os triggers/RPCs inserem em colunas de tipo (`content_type`, `trigger_type`, `action`) | `chat` chegou na fila e não existia em nenhum mapa |
| **Regras de casamento/validação duplicadas** | mesma decisão implementada nos dois lados (wordlist, bloqueio de login, hierarquia) | cliente casava palavra exata, banco passou a casar plural |
| **Listas de papéis escritas à mão** × `role_rank()`/`is_staff()`/`is_super()` | `grep` por `'admin'`, `'super_admin'`, `'owner'` literais | 14 policies sem `owner`, três vezes |
| **Privilégio de COLUNA** × o que a tela lê | `information_schema.column_privileges` vs os `select()` do código | colunas de `profiles` revogadas derrubaram post, comentário, mural e chat |
| **Actions gravadas pelo banco** × mapa de ícones do painel | `grep` em `prosrc` por `INSERT INTO admin_logs` | 14 actions sem ícone, invisíveis pro teste que só varria `src/` |
| **Funções de trigger expostas como RPC** | `get_advisors` → `anon_security_definer_function_executable` | `checar_palavras_bloqueadas` chamável via `/rest/v1/rpc/` |
| **Tabelas sem policy de UPDATE** × telas que fazem update | `pg_policies` sem `cmd IN ('UPDATE','ALL')` | moderação de comentário e mural quebrada por meses, em silêncio |

Consultas de apoio:

```sql
-- tabelas assinadas no código que NÃO estão publicadas
select tablename from pg_publication_tables
 where pubname='supabase_realtime' and schemaname='public';

-- tabela sem policy de UPDATE nega em silêncio
select t.tablename from pg_tables t where t.schemaname='public'
 and not exists (select 1 from pg_policies p where p.schemaname='public'
                  and p.tablename=t.tablename and p.cmd in ('UPDATE','ALL'));

-- coluna revogada que alguma policy/função ainda lê
select tablename, policyname from pg_policies
 where coalesce(qual,'')||coalesce(with_check,'') ilike '%coluna%';
```

```bash
# toda assinatura de realtime do código
grep -rn "table: '\|useRealtime('" src/ --include=*.js --include=*.jsx
```

#### A regra que fecha a fase

**Toda deriva encontrada vira teste de contrato (§2), não só correção.** Deriva
não é um bug pontual: é um par de lugares que precisa concordar para sempre, e
que vai divergir de novo na próxima mudança. Corrigir sem travar aqui é
garantir que a Fase 4 da próxima auditoria vai achar exatamente a mesma coisa.

---

### O lembrete — para "ele pede" não virar "ninguém lembra"

A auditoria continua sendo decisão do dono, mas a **lembrança** não pode
depender da memória dele. `.github/workflows/lembrete-de-auditoria.yml` roda
todo dia 1º, lê a data do relatório mais recente em `db/AAAA-MM-DD-*.md` e, se
passou de **90 dias**, abre uma issue no repositório.

Três escolhas deliberadas: a data vem do **relatório**, não de um número escrito
à mão que poderia divergir do que aconteceu (§1.4); é **issue** e não email,
porque issue fica; e ele **confere se já existe uma aberta** antes de criar,
porque lembrete mensal repetido vira ruído e ruído ensina a ignorar o canal
(§0.2). Ele não roda auditoria, não reprova nada e não cobra — só avisa.

---

## 6.1 FAXINA — bateria de otimização (obrigatória e automática)

> Pedido do dono: *"essa faxina que estamos fazendo — otimizando, caçando bugs,
> egress — é algo obrigatório, e tem que ser automático, como jogar fora lixo"*.

**Faxina ≠ auditoria.** A auditoria (§6) procura **falha**: brecha, bug, regra
que não cobre um caminho. A faxina procura **excesso e desperdício**: código
morto, duplicação, consulta cara, byte trafegado à toa. As duas são
obrigatórias e nenhuma substitui a outra.

**Quando roda, sem o dono pedir:**
- ao fechar um bloco de trabalho (antes do PR);
- quando eu mesmo esbarrar num item da lista, mesmo fazendo outra coisa (§0);
- por inteiro, quando o dono disser "faxina".

### A bateria

**1. Código morto e duplicado**
```bash
find src -name '*.jsx' -o -name '*.js' | xargs wc -l | sort -rn | head -15
```
- Arquivo > 300 linhas → dividir agora (§4).
- Função exportada sem nenhum call site → apagar. *(Cuidado: referência passada
  como valor — `queryFn: fn` — não é chamada; conferir antes de apagar.)*
- Mesma lógica/UI em 2+ lugares → extrair. Cópias divergem: já aconteceu com
  ícones de log, rótulos de cargo, cores de cargo e a regra de bloqueio de
  login.

**2. Egress — a cota mais apertada *do Supabase*** (não a mais apertada do
projeto: o teto de deploys da Vercel estourou primeiro — ver §0.2)
- Imagem sem compressão antes do upload (`lib/image.js`).
- `cacheControl` longo em arquivo de path único.
- `SELECT *` onde a tela usa 4 colunas.
- N+1: uma consulta por card em vez de uma em lote.
- Realtime assinando tabela de alto volume, ou `event:'*'` sem filtro. Custa
  por (mudanças × conexões) e só dói quando escala.

**3. Carregamento**
- Rota/asset pesado sem `lazy`.
- Componente caro montando fora da viewport (`LazyVisible`).
- Vídeo/mídia baixando sem clique.

**4. Memória e ciclo de vida**
- `createObjectURL` sem `revokeObjectURL` — segura o arquivo inteiro na RAM.
- `setInterval`/`setTimeout`/subscription sem cleanup.
- Efeito com deps que remontam canal de realtime a cada render.

**5. Banco**
```sql
select * from pg_stat_user_indexes where idx_scan = 0;  -- índice nunca usado
```
- FK sem índice de cobertura; coluna filtrada/ordenada sem índice.
- Tabela append-only sem retenção (`admin_logs`, `login_attempts`, `live_chat`).
- `get_advisors` (security **e** performance) depois de mexer em schema.

**6. Saúde do projeto**
```bash
npm audit            # 0 vulnerabilidades
npm run lint         # 0 erros; warnings não podem AUMENTAR
npx vitest run       # tudo verde
npm run build        # limpo
node e2e/smoke.mjs   # rotas de pé num navegador real
```

### Regras da faxina

- **Medir antes e depois.** "Otimizei" sem número é opinião. Dizer o antes → o
  depois: 918 → 197 linhas, 16 → 12 warnings, 8 → 0 vulnerabilidades.
- **Uma otimização por commit**, reversível.
- **Não trocar correção por maquiagem.** Suprimir warning com `disable` não é
  faxina — se for necessário, o motivo vai escrito ao lado no código e é dito
  ao dono que foi supressão, não conserto.
- **O que eu decidir NÃO otimizar vai pro `BACKLOG.md` com o motivo.**

---
