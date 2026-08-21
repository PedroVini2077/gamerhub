# GamerHub — Instruções de trabalho

> Como o dono quer que eu (Claude) trabalhe neste projeto. Não é documentação
> de features — para isso, ver o `README.md`. Para o que está pendente, o
> `BACKLOG.md`.

---

## 0. A prioridade do projeto

**Segurança, bugs e otimização vêm antes de qualquer outra coisa.** Não é uma
área do projeto entre outras — é *a* parte mais importante. Site bonito com
sujeira embaixo do tapete não interessa: o objetivo é uma base sólida, que
aguente crescer e não vire ruína.

Ordem de prioridade quando houver conflito:

1. **Falha de segurança** — fecha na hora (§1.3).
2. **Bug** — diagnostica e mata na 1ª ou 2ª tentativa (§1.2).
3. **Dívida estrutural** — arquivo gigante, código duplicado, lógica confusa
   (§4). Isso não é "estética": arquivo que ninguém consegue ler é onde a
   próxima falha vai se esconder.
4. **Performance / custo** — egress, N+1, bundle.
5. **Feature nova** — por último, e só se o resto estiver de pé.

Se eu estiver mexendo em algo e esbarrar num item de 1 a 3, **eu paro e trato**,
mesmo que não seja o que foi pedido — avisando o que encontrei e o que fiz.

---

## 1. Postura (as três regras que valem acima de tudo)

### 1.1 Sinceridade — sempre, em tudo

- **Nunca dizer que algo foi verificado se não foi.** Separar sempre o que eu
  *testei* do que eu *suponho*. Se rodei um teste, dizer qual. Se não rodei,
  dizer "não testei isso".
- **Não inflar entrega.** Se corrigi 3 de 5 coisas, dizer 3 de 5 — e quais 2
  ficaram, por quê. Nada de esconder o que faltou no meio de um resumo bonito.
- **Admitir limite de conhecimento.** Se não sei se algo funciona (ex.: como o
  Realtime trata privilégio de coluna), dizer que não sei e ou testar, ou
  projetar de um jeito que não dependa da resposta.
- **Corrigir o dono quando ele estiver enganado sobre o diagnóstico.** Ele
  descreve o *sintoma* — o sintoma é sempre verdadeiro, a *causa* que ele supõe
  pode não ser. Investigar a causa real e explicar a diferença com clareza, sem
  rodeio e sem constrangimento. Exemplo real: "o site conta email que não
  existe como cadastrado" — o sintoma era real, mas a causa não era contagem
  errada, era o trigger criar o perfil antes da confirmação.
- **Se eu quebrei algo, falo primeiro.** Antes que ele descubra.
- **Nada de "provavelmente funciona".** Ou funciona e eu provei, ou eu digo que
  não validei.

### 1.2 Diagnosticar antes de consertar — matar o bug na 1ª ou 2ª tentativa

O dono já perdeu sessões inteiras com correção por tentativa e erro. Isso
acontece quando eu **chuto a causa** em vez de encontrá-la. Proibido chutar.

**O método, em ordem, sem pular etapa:**

1. **Reproduzir.** Antes de tocar em qualquer código, provar que o bug existe,
   com um teste/consulta que falha. Se não consigo reproduzir, ainda não
   entendi o problema — e mexer no código nesse estado é chute.
2. **Localizar a causa raiz**, não o sintoma. Perguntar "por que?" até chegar
   no mecanismo. "O painel não oculta o comentário" → por quê? → o update
   afeta 0 linhas → por quê? → não existe policy de UPDATE → **essa** é a causa.
3. **Explicar o mecanismo** antes de corrigir. Se não consigo explicar em uma
   frase por que o bug acontece, não entendi ainda.
4. **Corrigir a causa**, uma coisa de cada vez. Nunca mudar 3 coisas na
   esperança de que uma resolva — isso é chute com passos extras, e destrói a
   informação de qual delas era o problema.
5. **Provar que morreu:** o teste que falhava agora passa.
6. **Provar que não quebrei nada:** rodar os caminhos vizinhos que dependiam do
   comportamento antigo.

**Sinais de que estou chutando** (parar imediatamente e voltar ao passo 1):
- "vou tentar mudar isso e ver se resolve"
- mexer em algo sem saber explicar como aquilo causaria o sintoma
- a mesma área falhar 2× seguidas com correções diferentes
- justificar com "deve ser cache/timing/coisa do navegador" sem evidência

**Se depois de 2 tentativas o bug continuar vivo:** parar de tentar consertar.
Voltar e instrumentar — logar valores reais, rodar a consulta isolada, testar a
hipótese diretamente. Relatar ao dono o que já foi descartado e com que
evidência. Insistir no escuro é o que consome sessão.

**Ao entregar um fix, dizer sempre:** qual era a causa raiz, como provei que era
ela, e como provei que morreu.

### 1.3 Segurança proativa

> IA que desenvolve sozinha tem fama de deixar brecha. O dono não quer que o
> GamerHub seja mais um caso desses.

- **Nunca entregar só "funciona".** Antes de dar qualquer coisa por pronta —
  feature, fix, refactor, mudança de banco — pensar ativamente em como aquilo
  pode ser abusado: dado forjado, RLS que não cobre um caminho, RPC chamável
  por quem não devia, input sem validação, condição de corrida, edge case de
  permissão (dono da linha × admin × owner), enumeração de dados.
- **Brecha que só vira problema amanhã se fecha hoje.** Base pequena não é
  desculpa. Se o código fica em produção, o buraco fica junto. Achou algo que
  "não quebrou ainda" por sorte ou baixo volume? Corrigir igual.
- **Desconfiar de proteção acidental.** Se algo só está seguro por efeito
  colateral de outra regra, isso não é proteção — é sorte esperando expirar.
  Caso real: o autor podia alterar `hidden_at` do próprio post, e só não
  conseguia porque a policy de SELECT escondia o post moderado dele. Bastava
  alguém adicionar um "seu post foi ocultado" na UI pra abrir o bypass.
- **Validação no cliente não vale nada sozinha.** O site usa a `anon key`:
  qualquer pessoa chama a REST API direto e pula o frontend inteiro. Toda regra
  precisa existir também no banco (RLS, CHECK, trigger, ou RPC com checagem).
- Na dúvida entre brecha real e paranoia, **tratar como brecha** e registrar a
  decisão — corrigida, ou por que foi considerada segura. Nunca deixar em
  silêncio.

---

## 2. Definição de pronto

Uma entrega só está pronta quando **todos** estes itens passam:

- [ ] `npm run build` — sem erro
- [ ] `npm run lint` — **0 erros** (warnings: não aumentar o número existente)
- [ ] `npm test` — tudo verde
- [ ] Mudou lógica de banco/RPC/RLS? Testado em transação com `ROLLBACK`
      **antes** de aplicar em produção (ver §5)
- [ ] Os caminhos que **não** podiam quebrar foram testados explicitamente
- [ ] Pensei em como abusar disso (§1.3) e fechei o que achei
- [ ] `README.md` atualizado se mudou comportamento/estrutura
- [ ] `BACKLOG.md` atualizado se resolveu ou descobriu pendência
- [ ] Script de teste avulso: rodou, passou, **apagou** (nunca commitar)

---

## 3. Stack

- **Frontend:** React 19 + Vite + Tailwind + Framer Motion. Testes: Vitest.
- **Backend/DB:** Supabase (Postgres 17), project_id `yuqbdcoljlvncxdnesxk`.
- **Deploy:** Vercel (SPA com rewrite para `/`).
- Cliente usa **apenas a anon key**. A segurança real está no RLS + funções
  `SECURITY DEFINER`.

---

## 4. Regras de código

### Organização — nunca deixar arquivo gigante

Arquivo grande não é problema de estilo: é onde bug e brecha se escondem,
porque ninguém consegue ler tudo de uma vez pra revisar. Foi exatamente assim
que a moderação de comentário ficou quebrada por meses sem ninguém notar.

**Gatilhos objetivos para dividir** (qualquer um já basta):

| Gatilho | Ação |
| ------- | ---- |
| Arquivo > 300 linhas | Dividir. > 500 é dívida que **precisa** entrar no backlog. |
| Mistura responsabilidades (busca dados + estado + UI + regra de negócio) | Separar por responsabilidade, não por tamanho. |
| Mesma UI repetida em 2+ lugares | Extrair componente. |
| Mesma lógica repetida em 2+ lugares | Extrair hook ou util. |
| Acesso ao Supabase dentro de componente | Mover pro service do domínio. |
| Preciso rolar o arquivo pra entender uma função | Já passou do ponto. |

**Como dividir sem quebrar** (a ordem importa):
1. Extrair **sem mudar comportamento** — só mover código e ajustar imports.
2. `npm run build` + `npm test` a cada extração, não só no fim.
3. Uma extração por commit, pra ficar reversível.
4. Só depois, se fizer sentido, melhorar a lógica extraída — nunca junto.

- **Pensar em escalabilidade, não só em funcionar.** "Aguenta crescer e é fácil
  de manter" faz parte do requisito.
- **Fonte única de verdade.** Se a mesma informação existe em dois lugares,
  eles vão divergir. Já aconteceu: os dois painéis de log tinham mapas de
  ícones próprios e desatualizados (hoje unificados em `lib/logMeta.js`, com
  teste que falha se alguém esquecer de registrar uma action nova).

### Erros
- **Nunca engolir erro.** `const { data } = await supabase...` descarta o
  `error` silenciosamente. Em operação de escrita isso é proibido.
- **`count: 'exact'` + tratar 0 linhas como erro** em update/delete. RLS nega
  **em silêncio**, devolvendo 0 linhas sem erro — sem essa checagem, o app diz
  "sucesso" e nada aconteceu. Foi exatamente isso que escondeu, por muito
  tempo, o fato de a moderação de comentário e mural nunca ter funcionado.
- Atualização otimista precisa de **rollback + aviso** quando o servidor recusa
  (ver `lib/like.js`).

### UI
- **Sem emojis na UI.** Só `lucide-react`, ou `react-icons/fa6` para marcas
  (Discord, Twitch, YouTube). Emoji dá cara de chatbot. Isso inclui setas
  tipográficas (`→`, `←`) em botão: usar ícone.
- **Botão de atualizar: loading mínimo de 500ms** —
  `Promise.all([fetch(), new Promise(r => setTimeout(r, 500))])`, com
  `disabled={refreshing}` e `className={refreshing ? 'animate-spin' : ''}`.
- **Nada de `window.confirm` / `window.prompt` / `alert`.** Usar `ConfirmModal`
  / `ReasonModal`.
- Modais via `createPortal`, fundo `rgba(0,0,0,0.92)`, card
  `bg-dark-800 rounded-2xl`, animação `animate-fade-up`.
- Tipografia mono para dado técnico, `font-display` para título.
- Animações: variantes compartilhadas de `lib/motion.js` — não duplicar.
- **Acessibilidade:** botão só-ícone precisa de `aria-label`; toggle precisa de
  `aria-pressed`.

### URLs e mídia
- **Toda URL vinda de usuário passa por `safeExternalUrl`** (`lib/url.js`)
  antes de virar `href`. Só `http`/`https`. Isso já foi um XSS armazenado real.
- Imagem de upload passa por `lib/image.js` (compressão) — egress é a cota mais
  apertada do plano Free.

---

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
- Não confiar em `posts.likes` — a coluna existe mas nenhum trigger a mantém.

---

## 6. Auditoria periódica (plano em 3 fases)

Quando o dono pedir "auditoria", "testes do site", "caçar bugs/brechas" ou
similar. **Uma fase por vez**, relatório ao fim de cada uma.

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

---

## 7. Processo para mudanças estruturais

- **Antes de alterar**, apresentar análise/plano e **aguardar aprovação**.
- Mudanças graduais e justificadas. Não reescrever do zero, não reorganizar sem
  necessidade, não mudar comportamento/visual/rotas/auth/integrações por conta
  própria.
- Preferir mudança **aditiva** (que não altera o caminho feliz).
- Após cada alteração relevante, informar: arquivos mudados, o que mudou, por
  quê, benefício e risco.
- **Arquivos de alto risco** (mexer só com teste explícito dos dois lados):
  `hooks/useAuth.jsx`, `pages/Login.jsx`, `lib/supabase.js`, qualquer policy de
  RLS, qualquer `SECURITY DEFINER`. Quebrar `useAuth` derruba o site inteiro.

---

## 8. Git — incluindo PR e merge

- Trabalhar na branch combinada com o dono (hoje:
  `claude/gamerhub-technical-summary-vhguK`). Não criar branch nova sem
  permissão.
- Commit explicando **o problema**, não só a mudança: o que estava errado, como
  foi comprovado, o que foi feito.

### Fechar o ciclo: PR + merge são minha responsabilidade

O dono **não** quer mergear na mão. Ao concluir um bloco de trabalho (feature,
fix, fase de auditoria), eu fecho o ciclo inteiro:

1. `git push -u origin <branch>`
2. Abrir o PR (`create_pull_request`, base `main`) com corpo explicando **o
   problema, a correção e como foi validado** — não só a lista de arquivos.
3. Mergear (`merge_pull_request`, `squash`).
4. Sincronizar a branch local com a `main` já mergeada:
   `git checkout main && git pull --ff-only origin main && git checkout -B <branch>`
5. Informar o número do PR ao dono.

**Só mergear com a definição de pronto (§2) cumprida** — build, lint, testes e
validação no banco. Se algo estiver falhando, o PR fica aberto e eu aviso; não
mergear "pra não deixar pendente".
