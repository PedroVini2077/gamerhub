# Decisões de banco e de autorização

> Por que o **banco** é assim. Irmão de [`DECISOES.md`](DECISOES.md) (produto)
> e [`DECISOES-FERRAMENTAL.md`](DECISOES-FERRAMENTAL.md) (esteira).

---

## Por que este arquivo existe — e por que ele NÃO é uma pasta de ADRs

As decisões de arquitetura deste banco **já estão escritas**, e bem: cada uma
mora no comentário da migration que a aplicou. Essa prosa é boa de propósito e
é **imutável na prática** — a migration já rodou, editar o arquivo não muda o
banco, e **23 travas leem o texto das migrations**, então reescrevê-las quebra
teste.

O problema nunca foi a ausência da explicação. Foi **achá-la**: responder *"por
que o guard de colunas é `SECURITY INVOKER`?"* exigia grep em 214 migrations.

O plano original dizia criar **ADRs, um a um, copiando a prosa**. Ao executar,
eu discordei de duas coisas — e a decisão está aqui em vez de escondida:

| O plano dizia | O que foi feito | Por quê |
| --- | --- | --- |
| criar `ADR-001`, `ADR-002`… | usar os IDs que **já existem** (`SEC-*`, `LIVE-*`) | um segundo espaço de IDs apontando para o mesmo fato é a duplicação que o §4 proíbe. `SEC-027` já é citado em migration, teste, `SEGURANCA.md` e `INVARIANTES.md` |
| um arquivo por decisão | **um índice** | *"NÃO CRIE 500 ARQUIVOS"* foi pedido explícito. O que faltava era navegação, e navegação se resolve com índice |
| **copiar** a prosa | **resumir** a decisão e o descarte, e apontar para a prosa | copiar cria a segunda fonte que envelhece. Cada entrada aqui é autossuficiente para **decidir**; a história inteira fica onde sempre esteve |

**A consequência honesta:** quem quiser o detalhe — o número medido, o
`ROLLBACK` que provou, o caso que não foi visto — abre a migration. Este arquivo
responde *"o que foi decidido, o que foi recusado, e onde está o resto"*.

### O que entra aqui, e o que não

| Entra | Não entra |
| --- | --- |
| decisão de **desenho** do banco que sobrevive ao bug que a originou | correção pontual sem decisão junto (vai em `SEGURANCA.md` e na migration) |
| alternativa **recusada**, com o motivo | a regra permanente em si — isso é [`INVARIANTES.md`](INVARIANTES.md) |
| trade-off aceito de propósito | o que **impede** a regressão — isso é [`TRAVAS.md`](TRAVAS.md) |

---

## Autorização — quem pode, e em que ordem se pergunta

### `SEC-005` · `anon` alcança uma tabela, por COLUNA

**Decidido:** `anon` lê `site_config (key, value, updated_at)` e **mais nada**.
Régua do dono, em 12/09.

**Recusado:** manter os grants amplos porque *"a RLS está segurando"*. Estava
mesmo — medido: `anon` tinha SELECT em 26 de 29 tabelas e só três devolviam
linha. O que se fecha aqui não é um vazamento em curso, é a **distância entre o
que a policy permite hoje e o que o privilégio permitiria** no dia em que
alguém escrever uma policy nova com `USING (true)`.

**Por coluna, e não a tabela:** para que coluna nova nasça fechada.
`updated_by` já tinha sido revogada assim no SEC-005.

**A exceção é única e tem motivo:** `site_config` carrega o modo manutenção. Sem
ela, o site fora do ar não consegue dizer que está fora do ar.

**O resto do público passa por função**, não por tabela — `username_disponivel`,
`check_login_status`, `verify-contact`. Privilégio de **função** não é tocado
por revoke de **tabela**.

→ `supabase/migrations/20260912164012_anon_nao_le_nada_exceto_site_config.sql`

### `[25/09]` NEWS · Quem escreve não é quem publica, e o guarda é TRIGGER

**Decidido (dele, saída B):** publicar e agendar é de super admin e owner;
admin cria, edita e manda para revisão. Editar o que **já está no ar** também é
do super.

**Recusado 1 — deixar `is_staff()` publicar (como nasceu).** Erro editorial
publicado é público e não desfaz. O prompt dele pedia explicitamente para "não
assumir que todo admin possui todas essas capacidades".

**Recusado 2 — papel `editor` novo.** Mexer em `role_rank` encosta em todo o
sistema de hierarquia, e isso já derrubou o site três vezes. O ganho só aparece
quando existir gente que escreve e não modera; hoje não existe.

**Recusado 3 — guardar por POLICY.** Foi a primeira ideia e não serve por dois
motivos independentes: `WITH CHECK` só enxerga a linha **nova**, e guardar
"editar o que já está no ar" exige ver a **velha**; e policy nega com **0 linhas
e nenhum erro** — o admin clicaria em publicar e nada aconteceria (§1.5). O
trigger levanta exceção, e a mensagem chega no toast dizendo o que fazer.

**`scheduled` conta como publicar**, e isso não é detalhe: agendar é publicar
com atraso. Se só `published` fosse guardado, o admin agendaria para daqui a um
minuto e o corte viraria enfeite.

**A inversa existe (§5):** `in_review` é estado novo, e o admin puxa de volta
para `draft` sozinho. Sem ele, o admin escreveria e ficaria preso sem caminho.

→ `supabase/migrations/20260925120000_news_corte_editorial_b.sql`

### `SEC-054` · O literal `role = 'owner'` sai das oito

**Decidido (dele):** `is_owner()` nas cinco funções do painel do Fundador e nas
três policies de `site_config`. Consequência aceita e dita antes: `is_owner()` é
`role_rank >= 4`, então um cargo futuro acima de owner herdaria o painel.

**Recusado — pôr `exige_operador_ativo()` nas cinco.** Ninguém consegue banir o
fundador pelo produto (hierarquia estrita), então guardá-las só criaria o risco
de trancá-lo fora do próprio painel **sem inversa**.

**Recusado — reescrever os cinco corpos à mão.** São longos, e um deslize
silencioso em qualquer um é uma RPC de painel quebrada. A migration lê a
definição real, troca só a guarda, e **estoura se o padrão não casar**.

**O que se aprendeu, e vale mais do que a troca:** assim que ela entrou, o
auditor foi de 0 para 5 achados — as cinco mudaram de **checagem**, não de
risco. Isso é o mecanismo funcionando, e foi ele que obrigou as três listas de
isenção a serem revistas no mesmo PR em vez de ficarem mentindo.

→ `supabase/migrations/20260925121000_sec_054_is_owner_nas_oito.sql`
→ `supabase/migrations/20260925122000_sec_054b_listas_de_isencao_acompanham.sql`

### `SEC-053` · Policy nunca escreve hierarquia à mão

**Decidido:** toda policy pergunta cargo por `is_staff()`/`is_super()`/
`is_owner()`. 23 policies escreviam `role_rank(...) >= 2` ou a lista literal, e
por isso **não herdavam `operador_ativo()`** — um admin BANIDO lia a fila de
moderação, a trilha de 4.102 linhas e escrevia na wordlist. Medido em ROLLBACK,
com papel real.

**Recusado 1 — deixar como estava porque "só afeta quem já foi banido".** É
justamente o contrário: quem foi banido é, por definição, o adversário, e o
banimento é o remédio. Além disso `ban_user` **não revoga sessão** — ele escreve
`banned = true` em `profiles` e nada mais, então o token continua válido e o
refresh continua funcionando. Não é janela curta; é acesso contínuo.

**Recusado 2 — somar `AND operador_ativo()` ao lado do `role_rank`.** Resolveria
as 23 e deixaria a FORMA errada de pé, para a 24ª repetir. A troca por
`is_staff()` remove a duplicação em vez de corrigir cada cópia — §4, fonte
única.

**Recusado 3 — trocar também o literal `role = 'owner'` das três policies de
`site_config`.** Cheguei a fazer e **desfiz no mesmo dia**: a SEC-051 já
registrou essa troca como decisão de semântica do dono (`is_owner()` é
`rank >= 4`, o literal é `= 'owner'`). Elas ficaram isentas com o motivo escrito,
e a decisão está no `BACKLOG.md` junto com as cinco funções do painel.

**Como se soube que não quebrou:** a mesma transação mediu **quatro** personas —
admin ativo, usuário comum, admin banido e owner. O banido ficou idêntico ao
usuário comum (rebaixado, não trancado) e o ativo e o owner não perderam nada.
Essa medição existe porque três correções de segurança anteriores derrubaram o
site exatamente aqui.

**A trava:** 6ª checagem de `auditoria_de_operadores()`. As cinco anteriores
olhavam função e tabela — **nenhuma olhava policy**, que é o motivo de a SEC-043
ter ficado meia-feita por seis dias sem ninguém ver.

→ `supabase/migrations/20260925040147_sec_053_policies_perguntam_o_estado_do_operador.sql`
→ `supabase/migrations/20260925041200_sec_053b_site_config_volta_ao_literal.sql`

### `SEC-031` · `SEC-032` · Autorização vem antes de tudo, inclusive de existir

**Decidido:** quem não pode chamar descobre isso **antes** de qualquer validação
de entrada ou busca do alvo.

**O que estava em jogo** não era a mensagem, era a **ordem**. `request_role_
demotion` respondia *"Usuário não encontrado"* antes de checar o cargo de quem
chamava: qualquer pessoa logada distinguia uuid que existe de uuid que não
existe, e um laço em cima disso **enumera contas**.

**Recusado:** trocar as mensagens no atacado. Pedido explícito — *"não mude
simplesmente todas as mensagens sem avaliar o impacto"*. Nenhum texto mudou;
quem tem permissão continua recebendo os mesmos.

**E a distinção que o atacado apagaria:** `get_user_xp` devolve `0` tanto para
conta real sem atividade quanto para uuid inexistente — ali o oráculo **não
existe de fato**, e marcá-lo seria trabalho sem ganho.

**A exceção é escrita.** A trava varre a classe inteira e exige **motivo escrito**
para cada função isenta — foi ela, e não eu, que achou a quinta e a sexta.

→ `supabase/migrations/20260918114400_sec_031_autorizacao_antes_de_validacao.sql` ·
`supabase/migrations/20260918150043_sec_032_a_varredura_de_classe_do_oraculo_de_existencia.sql`

### `SEC-008` · Toda entrada de RPC tem FAIXA, não só tipo

**Decidido:** número de entrada tem piso **e teto** explícitos, com o limite
superior justificado por escrito no SQL.

`p_trial_days` tinha piso e nenhum teto. Provado em `ROLLBACK`: indicação
aprovada com **3.650.000 dias** — cargo virou `admin` e a revisão ficou para
o ano **12020**.

**Por que importa mesmo sendo chamada por super admin:** o trial é exatamente o
que autoriza um super admin a promover **sem o fundador**. Um trial que vence no
ano 12020 é uma promoção definitiva com outro nome.

→ `supabase/migrations/20260910143000_faixa_para_os_dias_de_avaliacao_de_staff.sql`

---

## Ciclo de vida do conteúdo

### `SEC-027` · O cliente declara INTENÇÃO; o servidor deriva o VALOR

**Decidido:** as colunas de ciclo de vida de `posts` (`was_live`, `expires_at`,
`live_ended_at`, `user_id`, `hidden_at`, `deleted_at`) são derivadas por trigger
e nunca vêm do cliente. Um mecanismo fechou **cinco** achados.

**O que sobrou de propósito:** `is_live` continua gravável pelo autor nos dois
sentidos, porque o formulário de edição deixa o autor marcar o próprio post como
live — tirar isso seria mudar o produto, não fechar brecha.

**O que NÃO foi revogado, e por que revogar quebraria o site:** `hidden_at` e
`deleted_at` mantêm o `GRANT` para `authenticated`, porque a moderação grava
`hidden_at` por `UPDATE` direto de tabela e admin **também é** `authenticated`.
Revogar a coluna teria derrubado o painel — a classe exata do erro do SEC-025.

**O guard é `SECURITY INVOKER`, e isso não é detalhe:** sob `DEFINER` o
`current_user` vira o dono da função para todo mundo, e a SEC-027 inteira
desliga em silêncio. Protegido por `prazoDaLive.test.js`.

→ `supabase/migrations/20260918114000_sec_027_ciclo_de_vida_do_post_sai_da_mao_do_cliente.sql`

### `LIVE-041` · O prazo da live é uma DURAÇÃO escolhida, não um instante escrito

**Decidido:** o autor escolhe uma duração (15 min a 24 h); o banco calcula
`expires_at`. A faixa é `CHECK`, não validação de tela — o site usa a anon key.

**Recusado:** devolver `expires_at` ao cliente. A `cleanup_expired_posts` faz
`DELETE` **de verdade** por essa coluna, então escrevê-la é destruir conteúdo sob
moderação pulando a janela de 30 dias que existe para o admin restaurar.

**O teto de 24 h não é novo:** era o do cron desde junho. Ele só deixou de ser
invisível.

→ `supabase/migrations/20260918225237_live_041_o_prazo_da_live_ganha_dono_e_e_derivado_de_uma_duracao.sql`

---

## XP

### `SEC-028` · O XP conta o que EXISTE, e a fórmula é uma só

**Decidido:** uma view (`xp_dos_usuarios`) como fonte única, filtrando
`deleted_at` e `hidden_at`.

Eram **três** fórmulas. Conferido linha a linha: só o bônus de perfil divergia —
140 contra 60. **Vale a escala de `get_user_xp`** porque é a que a pessoa vê;
adotar a do owner mudaria o número de todo mundo para fechar uma divergência
interna — o rabo abanando o cachorro.

**O que estava errado era pior que a divergência:** nenhuma das três filtrava
conteúdo removido. **Ocultar conteúdo era punição sem efeito** — inclusive o XP
que leva a pessoa aos 1.000 de `check_staff_eligibility`.

**VIEW e não função por usuário:** os painéis listam centenas de perfis. Chamar
`get_user_xp` por linha seria um N+1 dentro do SQL.

→ `supabase/migrations/20260918114100_sec_028_xp_conta_so_o_que_existe_e_fonte_unica.sql`

### `SEC-046` · Bônus de perfil exige caractere VISÍVEL

**Decidido:** `length(trim(x)) > 0` não bastava. `trim()` corta espaço ASCII e
deixa passar U+200B, U+00A0, U+3000, U+FEFF e U+2060 — um perfil de espaços
invisíveis pagava igual a um preenchido.

→ `supabase/migrations/20260919034016_sec_046_bonus_de_perfil_exige_caractere_visivel_nao_so_trim.sql` ·
`xpSoPagaOQueAparece.test.js`

---

## Live

### `LIVE-036` · A live que aconteceu vira registro próprio

**Decidido:** `lives_realizadas` guarda o que a live **foi**, desacoplada do post.

**O problema não tinha sido decidido por ninguém.** O XP é contado na hora,
somando linhas que existem; e um cron de junho apaga fisicamente toda live
encerrada há mais de 15 minutos. As duas decisões nunca se encontraram:

```
14h00  fica ao vivo    -> o post existe -> +30 XP
14h40  encerra a live  -> o post existe -> +30 XP
14h55  o cron apaga    -> não existe    ->  +0 XP
```

**O XP de live deste site durava 15 minutos**, por efeito colateral.

**Recusado:** parar de apagar o post. O post carrega um `embed_url`; acabada a
transmissão o embed não mostra nada, e manter encheria o feed de card quebrado.
O conserto não é segurar o post — é **soltar o XP dele**.

→ `supabase/migrations/20260918165238_live_036_a_live_que_aconteceu_vira_registro_proprio.sql`

### `LIVE-038` · Reativar é ato de equipe, e o autor ganha uma PORTA

**Decidido:** o autor deixa de alternar `is_live` e passa a **pedir**. As duas
coisas na mesma migration, porque tirar o poder antes de existir a porta
deixaria a pessoa sem nada.

**Recusado:** afrouxar a policy da tabela. Aceitar o autor obrigaria a expressar
*"é o dono da live, e a live é dele, e ela já acabou, e não existe pedido
pendente"* dentro de um `WITH CHECK`. Com `SECURITY DEFINER` a tabela continua
fechada e as regras ficam num lugar que dá para ler — padrão já existente em
`solicitar_revisao_do_proprio_ban`.

**E o cron parou de apagar live com pedido pendente**, senão a porta seria
decorativa.

→ `supabase/migrations/20260918165710_live_038_reativar_vira_ato_de_equipe_e_o_autor_ganha_porta.sql`

### `LIVE-052` · A moderação alcança a live DEPOIS do cron — por RPC

**Decidido:** três RPCs `SECURITY DEFINER` (`listar_`, `invalidar_`,
`revalidar_live_realizada`).

A invalidação do XP era um trigger em `posts`. Sem post não há `UPDATE`, então o
XP virava permanente — medido: **8 de 10 sessões** fora do alcance da moderação.
É a regra da inversa do [`BANCO.md`](regras/BANCO.md) pelo avesso: ida e volta
existiam, e **as duas expiravam junto com o post**.

**Recusado:** abrir a tabela para a equipe. `lives_realizadas` tem RLS ligada,
zero policies e zero grants; abri-la daria leitura e escrita amplas a todo
`authenticated` com cargo — o oposto da régua de papéis.

→ `supabase/migrations/20260919124653_live_052_a_moderacao_alcanca_a_live_depois_do_cron.sql`

---

## News

### `[02/10]` O escape de coringa é UMA função, não um `replace` por chamador

**A decisão.** `buscar_pessoas` e `news_aceleracao_de_termos` comparam contra
um valor que veio de fora (o usuário; o modelo). As duas passaram a usar
`public.escapar_curinga()`.

| Alternativa recusada | Por quê |
| --- | --- |
| `replace(replace(x,'%','\%'),'_','\_')` em cada chamador | é o que o radar fazia, e **já tinha divergido antes de existir o segundo chamador**: faltava a barra, então um termo terminado em `\` fazia o Postgres levantar erro. Duas cópias de uma regra divergem (§4) |
| `quote_literal` / `format('%L')` | **resolveria outro problema.** O valor é parâmetro — não há injeção aqui. O estrago é o coringa, e escapar aspas não toca nele |
| validar no cliente (recusar `%` na caixa de busca) | o site usa a `anon key`: a REST API é chamável direto (§1.3). E recusar seria pior produto — quem busca `100%` tem direito de achar |
| `GRANT` da função para `authenticated` | ninguém a chama de fora. Ela só serve de dentro de RPC `DEFINER`, que roda com o privilégio do dono |

**A ordem dentro dela é a parte não óbvia:** a barra é escapada **primeiro**,
senão os `\` que o próprio escape introduz seriam escapados de novo pelos
`replace` seguintes.

A história inteira está na migration
`20261002014550_escapar_curinga_fecha_a_enumeracao_pela_busca_de_pessoas.sql`;
o achado, em [SEGURANCA.md](SEGURANCA.md) (SEC-055).

### `[01/10]` O sinal de aceleração sai do NOSSO histórico, não de um fornecedor

**A decisão.** A Fase 3 do radar precisava responder *"isto está crescendo?"*.
O plano previa `TimelineVol` da GDELT e Google Trends. Ambos caíram no mesmo
dia — a GDELT por teto **por IP** (7 tentativas, 2 IPs, 0 sucessos) e o Trends
por trazer loteria e futebol na própria auditoria que o avaliou. A contagem
passou a sair de `news_items_raw`, via `news_aceleracao_de_termos`.

| Alternativa recusada | Por quê |
| --- | --- |
| esperar uma fonte de tendência que funcione | a Fase 3 ficaria parada por um fornecedor; o valor dela nunca foi a fonte, é o sinal anexado ao evento |
| uma consulta por pauta | 8 pautas × 3 termos seriam 24 `ILIKE` por clique. É uma chamada, com os termos de todas |
| devolver um score numérico | o plano pedia *"sem score mágico"*. `5x o normal` quem lê refaz na mão; "87 de relevância" não |
| contador desnormalizado por termo | é a lição de `posts.likes` (`BANCO.md`): contador desnormalizado desincroniza no primeiro caminho que alguém esquecer. 772 linhas contam na hora |

**O trade-off aceito, e ele está escrito na tela:** isto mede **os veículos que
assinamos publicando**, não o público buscando. É um sinal mais estreito e mais
honesto do que o Trends teria sido — e a dica de cada selo diz "veículos" para
que ninguém conclua o contrário.

**O limite que fica:** base curta chama de `novo` o que talvez só seja *"novo
para nós"*. Ela engorda sozinha a cada busca, e dizer isso é mais barato do que
esconder. A prosa inteira está em
`20261001220000_news_aceleracao_de_termos_para_a_fase_3_do_radar.sql`.

---

## Vigilância

### `SEC-050` · O auditor devolve NÚMERO para o CI, e NOMES só para o dono

**Decidido:** duas funções. `auditoria_de_operadores()` devolve nomes e fica
fechada; `contagem_de_achados_de_seguranca()` devolve um `int` e é chamável pelo
CI com a anon key.

**O que estava errado não era o auditor** — ele já fazia as checagens. Era o
`EXECUTE` revogado de todo mundo: **só rodava quando eu perguntava**. Auditor que
depende de alguém lembrar é a mesma classe do §1.5.

**Recusado:** abrir o auditor direto. Ele devolve nomes — seria entregar, para
qualquer um na internet, a lista das funções fracas do site: um mapa de onde
bater.

→ `supabase/migrations/20260924115147_sec_050_o_auditor_ganha_um_mensageiro_que_o_ci_consegue_ouvir.sql`

---

### `[02/10]` `SEC-056` · O banco escreve o `REVOKE` sozinho — EVENT TRIGGER

**Decidido:** um event trigger em `ddl_command_end`, filtrando a tag
`CREATE FUNCTION`, que roda `REVOKE EXECUTE ... FROM PUBLIC, anon` em toda
função nova de `public`. Quatro exceções em lista branca, medidas em
`pg_proc.proacl`.

**O problema não era nenhuma função**: as quatro que o `anon` alcança são as
quatro que ele deve alcançar. Era o **default** — `pg_default_acl` dá `EXECUTE`
a `anon` e a `PUBLIC` em toda função criada, e a defesa era eu lembrar do
`REVOKE` em cada migration.

**Recusado 1 — `ALTER DEFAULT PRIVILEGES`.** Medido: tira o `anon` do
`pg_default_acl` do `postgres` e **não tira o `PUBLIC`**; e a entrada do
`supabase_admin` responde `permission denied to change default privileges`.
Foi essa medição que, em 24/09, eu generalizei errado para *"não é alcançável"*
— era verdade da tentativa, não do objetivo.

**Recusado 2 — continuar só com a detecção (SEC-050).** Ela fica, e é o que
cobre a falha do trigger. Mas detectar depois de a função estar no ar é pior do
que a função nascer fechada, e a lista branca existe dos dois lados agora.

**Recusado 3 — o event trigger levantar exceção ao falhar.** Seria o §1.5 bem
cumprido e o site mal servido: erro em event trigger **aborta o comando que o
disparou**, ou seja, travaria toda migration do projeto. A escolha é engolir, e
pagar com a detecção do SEC-050, que já está no CI.

**O que isso muda no dia a dia:** função nova que o público precisa passou a
exigir **duas** linhas — o `CREATE` e um `GRANT ... TO anon` com o motivo
escrito. Abrir virou ato deliberado; antes, fechar é que era.

→ `supabase/migrations/20261002190000_sec056_funcao_nova_nasce_fechada_para_anon.sql`

---

### `[02/10]` Retenção HÍBRIDA — e por que a margem é derivada, não parâmetro

**Decidido:** teto de quantidade somado ao prazo, dentro do `cleanup_old_data()`
que já existe. `admin_logs` 365d + 80.000 · `admin_notifications` **365d (nova)**
+ 20.000 · `notifications` lida+30d + **500 por usuário**. Margem de corte em
125% do teto. Duas funções auxiliares, `aplicar_teto_de_linhas(tabela, teto)` e
`aplicar_teto_por_usuario(teto)`.

**Os números são medidos, não escolhidos:** 139 linhas/dia de média em
`admin_logs` nos 30 dias até 02/10, pico de 924 num dia. 80.000 é **1,6x** a
projeção anual da média, então em operação normal o teto apaga zero.

**Recusado 1 — teto sem margem.** Cortar no número exato faz a tabela que
encosta no teto perder algumas linhas **toda noite, para sempre** — e cada
passada dispararia o aviso do §1.5 até ele virar ruído. Era restrição
explícita do dono.

**Recusado 2 — a margem como segundo parâmetro.** Dois números independentes
divergem, e margem só faz sentido em relação ao teto. Ela é `ceil(teto * 1.25)`.

**Recusado 3 — teto GLOBAL em `notifications`.** Faria o usuário movimentado
apagar a notificação do usuário quieto, e quem recebe pouco é quem mais sente
a perda. O corte é por `PARTITION BY user_id`.

**Recusado 4 — fazer o teto inline no `cleanup_old_data()`.** Provar que o
corte respeita o teto exigiria fabricar 80.000 linhas. Com a função auxiliar o
**mesmo caminho de código** se prova em ROLLBACK com teto 10 — e foi assim que
a margem, a idempotência e o lado do corte foram verificados.

**Recusado 5 — nome de tabela dinâmico com `format('%I')`.** Ele impede
injeção e não impede apontar a faxina para a tabela errada, que é o estrago
que importa. Mapa fechado, com `RAISE` no `ELSE`.

→ `supabase/migrations/20261002200000_retencao_hibrida_tempo_mais_quantidade.sql`

---

### `[02/10]` `news_sources.tipo = 'youtube'` — tipo próprio, não `api`

**Decidido:** a fonte de vídeo da Fase 4 entra com um tipo novo no `CHECK`, e
o `index.ts` a separa antes de chamar o `coletarTudo`.

**Por quê:** YouTube produz **sinal**, não manchete. O `coletarTudo` despacha
por tipo e só conhece quem alimenta a lista que vai ao modelo — uma fonte de
vídeo ali seria lida como manchete, e "um youtuber disse" passaria a valer o
mesmo que "a Eurogamer publicou". O radar inteiro existe para não fazer isso.

**Recusado 1 — entrar como `api`.** Funcionaria no dia 1 e quebraria no dia em
que alguém lesse a tabela e concluísse que vídeo é fonte. Tipo é documentação
executável.

**Recusado 2 — guardar só o termo de busca, sem URL.** `news_sources` tem
`CHECK (url ~* '^https?://')`. Relaxar a regra para um tipo é regra com
exceção, e regra com exceção é regra que ninguém confere.

> **⚠️ `[02/10]` E a linha deixou de guardar o assunto, horas depois.** A 1ª
> versão punha `q=games OR gameplay OR …` aqui, e o **primeiro clique real não
> achou nada**: 16 fontes lidas, nenhum selo, nenhuma falha. Consulta genérica
> + `order=date` devolve os 50 uploads mais recentes que mencionam "games", e
> a chance de dois falarem da pauta é quase nula.
>
> Hoje o `q` sai dos termos das **próprias pautas**, e a linha carrega só a
> base. O motor fica ainda mais cego ao assunto do que o desenho original
> pedia: nem a tabela o nomeia.
>
> → `20261002204449_radar_fase_4_a_consulta_de_video_sai_das_pautas.sql`

**Recusado 3 — deixar o cadastro mandar nos parâmetros.** `type`, `order` e
`publishedAfter` são sobrescritos pelo código. Sem `type=video` a API devolve
**canal** — medido no primeiro teste real da chave —, e esse estrago vindo de
uma linha de tabela que ninguém releu é pior do que vindo do código. Mesma
lógica do teto que mora na RPC e não no dropdown.

→ `supabase/migrations/20261002202240_radar_fase_4_fonte_de_video_do_youtube.sql`

---

## `[25/09]` A procedência da IA é uma COLUNA autodeclarada, não uma trilha

**Decidido:** `news_articles.redigido_com_ia boolean NOT NULL DEFAULT false`,
marcado **pelo painel** quando o editor aplica o rascunho gerado.

**Por que existe:** o corte editorial já garante que nada vai ao ar sem revisão
humana. Ele não garante **memória** — daqui a três meses, olhando uma matéria,
ninguém teria como saber se o texto nasceu de um modelo. Isso importa em dois
momentos concretos: na revisão (matéria de IA merece leitura mais desconfiada, e
o revisor precisa saber **antes** de ler) e no histórico (se um erro aparecer
publicado, a primeira pergunta vai ser *"isso veio de IA?"*).

**`DEFAULT false` e `NOT NULL`**: matéria antiga e matéria escrita à mão nascem
corretamente marcadas, sem nulo ambíguo no meio querendo dizer "não sei".

**Recusado: trigger que marcasse sozinho.** O banco não tem como saber de onde
veio o texto — quem sabe é o painel, no clique. Um trigger teria de adivinhar, e
adivinhar é o fallback silencioso do §4 com outro nome.

**O limite, escrito de propósito:** sendo autodeclarada, ela serve à
**procedência honesta**, não a fiscalizar quem queira esconder — salvando de
novo, desmarca. O que fecharia de verdade é registrar cada geração em
`admin_logs`, e isso está no `BACKLOG.md` como item próprio.

Provado em ROLLBACK 3/3: admin cria marcado, a marca persiste, e as linhas
existentes ficam em `false`.

→ `supabase/migrations/20260925170000_news_marca_o_que_foi_redigido_com_ia.sql`

---

## O que este índice ainda NÃO cobre

São **53** migrations com ID `SEC-*`/`LIVE-*` e 214 no total; as entradas acima
são as que carregam **decisão de desenho**, não correção pontual. A separação foi
feita lendo o cabeçalho das 53, e ela é julgamento meu — se uma decisão que
importa ficou de fora, ela está na migration, não perdida.

O que fica registrado como limite: **este arquivo é índice, não espelho.** Ele
cresce quando uma decisão nova de banco for tomada, no mesmo PR que a aplica.
