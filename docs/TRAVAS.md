# Inventário das travas

> **Para que este arquivo existe:** responder, sem abrir 149 arquivos, a
> pergunta *"esta regra tem proteção, e quem é que protege?"*.
>
> Ele é o par do [INVARIANTES.md](INVARIANTES.md): lá está **o que nunca pode
> acontecer**; aqui está **o que impede**.

[← voltar para o README](../README.md)

---

## O problema que ele resolve, com número

O `CLAUDE.md` §6.3 tem uma tabela de mecanismos. Medido em 19/09: o
repositório tem **149** arquivos de teste, roteiro e script, e aquela tabela
citava **43**.

**Mas o buraco nunca foi a diferença de número.** A tabela do `CLAUDE.md` é uma
seleção deliberada — ela conta *a história* dos mecanismos que nasceram de uma
falha real, e essa história tem valor próprio. O que faltava era outra coisa:
**nada dizia quais dos 149 são trava e quais são teste comum.** Sem essa
separação, "43 de 149" não significa nada, e a pergunta *"isto está protegido?"*
não tem resposta barata.

Este arquivo classifica os 149. A tabela do `CLAUDE.md` continua sendo o
**relato**; esta é a **planta**.

### A conta honesta

| Natureza | Quantos | Reprova? |
| --- | --- | --- |
| Portões de CI (script) | 9 | **sim** |
| Travas de invariante (leem as migrations) | 23 | **sim**, no `npm test` |
| Travas de contrato (leem `src/`) | 18 | **sim**, no `npm test` |
| Roteiros E2E | 19 | **sim**, no CI |
| Robôs que avisam | 4 | não — abrem issue |
| Testes comuns (lógica isolada) | 62 | sim, mas não são trava |
| **Não são trava** (utilitário, gerador, ajudante) | 14 | — |

> Os 14 da última linha estão **nomeados** mais abaixo de propósito. Item que
> parece trava e não é produz a pior das confianças: alguém conta com ele.

---

## 1 · Portões do CI — reprovam o PR

Rodam no `ci.yml` (salvo onde indicado) e barram a classe inteira.

| Portão | O que impede | Invariante |
| --- | --- | --- |
| `scripts/mapa-de-arquivos.mjs` | arquivo em `src/` que o `ARQUITETURA.md` não conhece | — |
| `scripts/segredos-vazados.mjs` | chave privada, `service_role`, token ou senha em arquivo rastreado | — |
| `scripts/documentacao-quebrada.mjs` | documento citando arquivo que não existe | — |
| `scripts/numeros-do-projeto.mjs` | número escrito num documento que não bate com o projeto | — |
| `scripts/territorio-coberto.mjs` | pasta do sistema sem documento responsável | — |
| `scripts/orcamento-de-bytes.mjs` | regressão de peso no carregamento inicial | — |
| `scripts/espelho-de-migrations.mjs` | migration aplicada no banco e ausente do repositório | — |
| `e2e/portas-do-banco.mjs` → `contagem_de_achados_de_seguranca()` | **`[24/09]`** RPC administrativa sem a guarda do operador · função de trigger virando RPC · função nova alcançável por `anon`. O auditor já existia desde a SEC-049 e **ninguém conseguia chamá-lo** | `INV-PORTA-006` |
| `scripts/vercel-ignore.sh` | branch nova gastando deploy da Vercel | — |
| `scripts/edges-implantadas.mjs` | Edge Function **no ar** que não veio deste código | — |

> **`[24/09]` O último saiu do lugar errado.** O `CLAUDE.md` dizia *"ainda NÃO
> está no CI"*. Conferido hoje: ele roda no `implantar-edges.yml`, automático em
> `push` para `main` quando `supabase/functions` muda. A frase era verdade
> quando foi escrita e envelheceu — corrigida lá.

---

## 2 · Travas de invariante — leem as migrations

Confrontam o que o **banco** faz com o que a regra manda. São as que pegam a
deriva que não estoura em lugar nenhum.

| Trava | Invariante que protege |
| --- | --- |
| `xpSegueOQueEstaNoAr.test.js` | `INV-XP-001` · `INV-CONTEUDO-002` |
| `xpSoPagaOQueAparece.test.js` | `INV-XP-002` |
| `xpNaoLeColunaMorta.test.js` | `INV-XP-003` |
| `moderacaoDeXpDeLive.test.js` | `INV-XP-004` |
| `prazoDaLive.test.js` | `INV-LIVE-004` |
| `liveApagadaNaoVoltaAoAr.test.js` | `INV-LIVE-002` |
| `moderacaoAlcancaLiveNoAr.test.js` | `INV-LIVE-003` |
| `colunasDerivadasDoPost.test.js` | `INV-CONTEUDO-001` · `INV-AUTZ-002` |
| `hierarquiaNoConteudo.test.js` | `INV-CONTEUDO-004` |
| `autorizacaoAntesDeExistencia.test.js` | `INV-AUTZ-001` · `INV-CONTEUDO-003` · `INV-LIVE-001` |
| `estadoDoOperador.test.js` | `INV-AUTZ-003` |
| `punicaoRespeitaHierarquia.test.js` | `INV-AUTZ-004` |
| `guardDePapelNaoAceitaNull.test.js` | `INV-AUTZ-005` · `INV-CONTRATO-004` |
| `decisaoRevalidaEstado.test.js` | `INV-WF-001` · `INV-WF-002` |
| `infracaoTemInversa.test.js` | `INV-WF-003` · `INV-WF-004` |
| `formatacaoAninhaEmQualquerOrdem.test.js` | `INV-TELA-022` |
| `funcaoDeTriggerNaoEhRpc.test.js` | `INV-PORTA-001` |
| `funcaoNovaNasceFechada.test.js` | `INV-PORTA-015` |
| `retencaoHibrida.test.js` | `INV-TRILHA-003` |
| `radarSinalDeVideo.test.js` | `INV-EDIT-014` |
| `perfilTemOsCamposDoE2e.test.js` | `INV-TELA-018` |
| `duasContasAchaAsTelas.test.js` | `INV-TELA-019` · `INV-TELA-020` |
| `falhaDoE2eEhLegivelDeFora.test.js` | `INV-TELA-021` |
| `colunasPrivilegiadasDeProfiles.test.js` | `INV-PORTA-003` |
| `contadorDeLoginFechado.test.js` | `INV-PORTA-005` |
| `trilhaNaoEhForjavel.test.js` | `INV-TRILHA-001` |
| `notifMeta.test.js` | `INV-CONTRATO-003` |
| `siteConfigChavesFechadas.test.js` | `INV-CONTRATO-002` |
| `exclusaoPedeSenha.test.js` | `INV-CONTA-001` |
| `aceiteNasceComAConta.test.js` | `INV-CONTA-003` |
| `logMeta.test.js` (via `actionsDoBanco.js`) | `INV-TRILHA-002` |

### A fragilidade desta categoria, dita com todas as letras

**As 23 leem SQL como TEXTO.** Isso é o que as torna possíveis sem credencial
de banco no CI — e é também o modo delas falharem:

- **prosa citando comando.** Comentário de migration que menciona um `UPDATE`
  já foi contado como código. Por isso toda uma delas tira comentário **antes**
  de medir. Já aconteceu ~10 vezes.
- **âncora posicional.** A da SEC-043 pegava *"o último bloco `DO $inj$`"* — e
  no dia em que nasceu um segundo bloco ela passou a ler o errado e reprovou
  **25 RPCs intactas**, anunciando falha de segurança onde não havia. Hoje a
  âncora é o **conteúdo**.
- **metacaractere no literal.** Uma conferência de âncora usou o texto
  `NEW.hidden_at := now();` como **padrão** de regex: os parênteses viraram
  grupo vazio e ela acusou **0 ocorrências num texto que tinha 1**.
- **o corpo que não mora em arquivo.** A SEC-043 injetou a guarda reescrevendo
  as funções **no banco**; a migration guarda a versão pré-injeção. Uma
  varredura de arquivo ingênua acusa **7 falsos positivos** — conferido no
  `pg_proc`: as 7 estão guardadas.

> **A pergunta para qualquer trava nova desta família:** ela verifica
> **estrutura** ou está procurando uma **frase**? As quatro falhas acima foram
> todas do segundo tipo.

---

## 3 · Travas de contrato — leem `src/`

Garantem que dois lugares do código continuem concordando.

| Trava | O que impede | Invariante |
| --- | --- | --- |
| `realtimeTables.test.js` | assinatura de realtime em tabela não publicada | `INV-CONTRATO-001` |
| `tabelasSemUpdate.test.js` | `update` em tabela sem policy — 0 linhas, nenhum erro | `INV-CONTRATO-005` |
| `apagarConfereLinhas.test.js` | escrita que pode ser negada sem conferir linhas | `INV-CONTRATO-006` |
| `portasDaWebNaoEsvaziam.test.js` | as **duas** listas do portão da borda sendo esvaziadas — cabeçalhos e diretivas travadas da CSP | `INV-PORTA-004` · `INV-PORTA-008` |
| `useApenasAUltimaResposta.test.js` | **`[24/09]`** a guarda de corrida em si: pedido velho se declarando válido, identidade instável (que reassinaria realtime em laço) e contador vazando entre montagens | `INV-TELA-005` |
| `novidadeDoFeed.test.js` | **`[24/09]`** o aviso de novidade prometendo post que a recarga não traz, e o contador sem teto. O caso de CONTRATO **lê o `fetchFeedPosts`**: filtro novo na consulta que o aviso ignore reprova nomeando a coluna | `INV-TELA-006` |
| `retencaoDePostDeTeste.test.js` | **`[24/09]`** prefixo de teste novo no E2E que a retenção do banco não conheça — o lixo voltaria a se acumular **em silêncio**, porque nada quebra quando sobra linha. E o padrão perdendo o relógio, o que faria o site destruir post de gente. **`[01/10]` Passou a cobrir o lado do NEWS**, onde a sobra é por construção (a conta do CI é `admin` e `news_articles_delete` exige `is_super()`): as DUAS cópias do padrão — a rede diária e a limpeza de 10 em 10 min — têm de ser idênticas, nenhuma pode alcançar `published`/`scheduled`, e a janela de tolerância para a rodada em curso precisa existir | `INV-CONTEUDO-005` |
| `paginacaoDoFeed.test.js` | **`[24/09]`** as três falhas MUDAS do feed paginado: a RPC virando `SECURITY DEFINER` (a RLS deixa de valer e o feed lista conteúdo moderado), os dois ramos do cursor virando um `OR` (**medido**: derruba o Index Cond para Filter — 100 linhas lidas e jogadas fora numa página de 20), e o lote crescendo até o teto da RPC (o item extra some e o "carregar mais" desaparece com posts por ler) | `INV-CONTEUDO-006` |
| `categoriaSaiuDaExperiencia.test.js` | **`[24/09]`** trigger voltando a ler `NEW.category`/`OLD.category` — a coluna foi apagada, e lê-la derruba o **publicar** —, e o seletor voltando ao feed. Olha a definição **vigente** do trigger, não o histórico: acusar a migration antiga seria reprovar o passado. Ignora prosa que cita o campo. *Ela nasceu protegendo o CONTRÁRIO (proibir o DROP) e reprovou o primeiro drop antes de a decisão mudar* | `INV-CONTEUDO-007` |
| `curtirFicaNaLinhaDoComentar.test.js` | **`[24/09]`** o botão de curtir **sumindo da tela**. Ele deixou de morar onde é usado (o `PostCard` o entrega à `CommentSection` como `acoes`, para as duas ações dividirem uma faixa só): se um dos dois lados da ponte cair, o coração desaparece **sem erro, sem log e sem teste quebrando** — e é a interação mais usada do feed. **`[25/09]`** Guarda também o `data-comentario` do `CommentCard`, âncora do roteiro de resposta — sem ela ele volta a contar níveis de DOM, o que já reprovou DUAS respostas corretas | `INV-TELA-007` |
| `buscaNaoVazaNemMente.test.js` | **`[24/09]`** as três falhas mudas da busca: `buscar_posts` virando `DEFINER` (a RLS deixa de valer e a busca acha conteúdo moderado — a lista só fica maior, nada estoura), `buscar_pessoas` ganhando coluna no `RETURNS` (é `DEFINER` por necessidade, então o **recorte** é a defesa), e aba oferecida sem área que a atenda — vazio que a pessoa lê como "não achei" | `INV-PORTA-010` |
| `formatacaoNaoVirarHtml.test.jsx` | **`[25/09]`** a formatação de post virando HTML. Renderiza de verdade (jsdom) e exige que `javascript:`, `data:`, `vbscript:` e `file:` **não** virem `href`; que `<script>`, `<img onerror>`, `<iframe>` e `<svg onload>` apareçam como **texto**; e varre `src/` inteiro exigindo que o projeto siga em **zero** `dangerouslySetInnerHTML` | `INV-TELA-008` |
| `corETamanhoSaoFechados.test.jsx` | **`[25/09]`** cor/tamanho aceitando valor fora do vocabulário, `style` montado a partir do nó (proteção acidental: "o React recusa CSS malformado"), e o comentário ganhando poder que o post não tem. Confere também que o nó guarda **nome**, nunca `#hex`/`rgb`/`url()` | `INV-TELA-009` |
| `aBarraNaoOferecaOQueOAnalisadorNaoLe.test.js` | **`[25/09]`** as duas listas que precisam concordar — o que a **barra escreve** e o que o **analisador lê**. Divergir é mudo: o botão funciona e o marcador aparece cru na tela de quem lê. Cobre também a decisão da prévia ao vivo (`temFormatacao`), que precisa continuar **derivada da árvore** e não virar uma terceira lista de marcadores. Achou no 1º run que ` 3 ` em `2 * 3 * 4` virava itálico | `INV-TELA-010` |
| `vocabularioDoNewsNaoDeriva.test.js` | **`[25/09]`** a deriva entre o vocabulário do News na TELA e o `CHECK` do BANCO, nos dois sentidos: valor que o banco aceita e a tela não conhece aparece **sem rótulo e sem erro**; valor que a tela oferece e o banco recusa vira erro de constraint na cara do editor. Cobre também `scheduled` contar como "no ar". Ela achou um defeito NELA MESMA no primeiro run: a extração de valores não aceitava `_`, e descartava `in_review` em silêncio | `INV-TELA-011` · `INV-EDIT-001` |
| `rascunhoDeIaNaoDeriva.test.js` | **`[25/09]`** as quatro derivas da IA do News, todas MUDAS: (1) a Edge Function ganhando um caminho de escrita — ela usa service role para gritar em `admin_logs`, então um `.from('news_articles')` ali publicaria sem revisor, sem erro e sem log; (2) a porta deixando de exigir `is_staff()`; (3) o mínimo de notas divergindo entre a tela e o servidor, que é o que impede o modelo de escrever a partir de um título só; (4) o marcador `[CONFERIR: …]` mudando de um lado só — a tela passaria a dizer "0 lacunas" sobre um rascunho cheio delas, e "0 lacunas" é a frase que faz o revisor ler com menos atenção. Guarda também a coluna `redigido_com_ia` na lista do painel e a marca nas três telas. **Provada reinjetando as quatro** | `INV-EDIT-003` · `INV-EDIT-004` · `INV-EDIT-005` · `INV-EDIT-006` |
| `modeloDaIaEhDoNossoPlano.test.js` | **`[26/09]`** string de modelo entrando numa Edge Function sem alguém ter conferido a tabela de limites **do nosso plano**. Ela não chama a Groq — exigiria a chave no CI, e trocar incerteza de monitoramento por credencial exposta é a conta ruim de sempre (§0.2). É lista escrita, como a das fontes, e está declarada como tal. Cobre também o `semCerca` antes do `JSON.parse`: trocar de modelo troca o hábito de embrulhar o JSON em ```` ```json ```` | `INV-EDIT-008` |
| `capacidadeNaoVoltaAoCargo.test.js` | **`[01/10]`** o padrão `{isAdmin && <Controle/>}` voltando à UI. O alvo é **estreito de propósito** — só o `{bandeira && <Componente` dentro de JSX, que é inequivocamente "mostrar controle por causa do cargo". Regex amplo quebraria os cinco usos legítimos (badge, `roleRank`, `canModerate`, `canModerateLive`, gate de rota), e isenção exige **motivo escrito**. Cobre também o mapa: capacidade sem proteção no banco reprova, e `cargos: [...]` no lugar de `rankMinimo` reprova. **Achou 2 no 1º run — e um deles era colisão de nome real**: `isOwner` querendo dizer "dono deste post" num arquivo e "o fundador" noutro | `INV-AUTZ-010` · `INV-AUTZ-011` |
| `radarDePautasNaoInventa.test.js` | **`[26/09]`** o radar citando fonte que ele mesmo escreveu. Exige o conjunto fechado de endereços coletados **e** que alguém o consulte, que pauta sem fonte válida seja descartada, e que o descarte **grite** (modelo inventando URL é sinal de que o prompt parou de segurar). Cobre também o leitor de RSS nos dois formatos — **ela achou um bug real no 1º run**: o parser tirava as tags ANTES de decodificar as entidades, e o HTML escapado do `description` virava texto literal no resumo. **`[01/10]` Deixou de ser regex no texto-fonte e passou a EXECUTAR** `montarPedido`/`resolverPautas`, e ganhou o orçamento do pedido: ela reprova se entrada + `max_tokens` passarem do teto por minuto da Groq, se a URL voltar para dentro do prompt, ou se a numeração deixar de bater com o índice que resolve o endereço — esse último é o pior caso, porque sai uma pauta com fonte real que não sustenta ela | `INV-EDIT-007` |
| `radarDePautasNaoInventa.test.js` (orçamento) | **`[01/10]`** `max_tokens` voltando a não caber **resposta + raciocínio**. O `gpt-oss-120b` gasta 300–900 tokens de cadeia de pensamento do MESMO teto, e com 1.300 o `content` voltava VAZIO — `HTTP 400 json_validate_failed` com `failed_generation: ""`, **intermitente**, que é o mais caro de diagnosticar. Cobre também o `reasoning_effort: "low"` sumindo, o `response_format` voltando a `json_object` (garante sintaxe, não forma), `itens` deixando de ser `integer`, e um `enum` de editoria aparecendo no esquema — que seria a 3ª cópia do vocabulário e divergiria no dia da 10ª editoria | `INV-EDIT-009` |
| `radarColetaDeDuasFontes.test.js` | **`[01/10]`** a Fase 1 do radar: o 2º coletor derrubando o 1º, e o motor deixando de ser genérico. A GDELT responde de **três** jeitos e dois não são JSON — o `429` vem em TEXTO PURO, e um `JSON.parse` solto levaria a coleta dos 13 feeds junto. Cobre o espaçamento em série (paralelizar garante `429`), tipo de fonte sem coletor (apareceria ATIVA no painel sem trazer nada), e **varre o código da Edge Function atrás de assunto específico** — a exigência dele de que nada dependa de GTA/Marvel virada máquina. **Ela achou um defeito nela mesma no 1º run**: marcava `playstation`/`xbox`/`nintendo`, que são EDITORIAS nossas e não assunto, e isso a obrigou a nomear a fronteira — taxonomia pode estar no código, assunto de matéria não. **`[01/10]` Ganhou a conta da RESPOSTA e o montador ÚNICO do corpo:** `RESERVA_DA_RESPOSTA >= TETO_DE_PAUTAS × TOKENS_POR_PAUTA` — eu errei esse dimensionamento **duas vezes no mesmo dia** (`failed_generation` vazio com 1.300, truncado com 2.400), sempre com a conta na cabeça e nenhuma no teste; agora quem subir o teto de pautas é obrigado a subir a reserva. E toda resposta depois da coleta passa pelo mesmo montador, porque só o caminho de SUCESSO carregava `fontes` e a tela dizia **"170 manchetes de 0 fontes"** com treze funcionando. **`[01/10]` Ganhou a RETENTATIVA para `5xx`, e a linha que a impede de virar abuso:** `503` é, pela definição do HTTP, *"tente de novo"*, e nós desistíamos na primeira — o 1º clique com o Google News voltou `503` nas duas consultas. A trava exige que `5xx` repita **uma** vez e que `429`/`403`/`404` **não** repitam: insistir num `429` gasta mais da cota que o servidor disse que esgotou, e foi assim que a GDELT morreu. Cobre também a mensagem dizer que já tentou duas vezes ("HTTP 503" parece soluço; "503 nas duas" é sintoma) e os 13 feeds continuarem em paralelo. **`[01/10]` Ganhou o descarte de RESUMO REDUNDANTE:** feed que preenche `description` com o próprio título (o de busca do Google News faz isso) custaria duas vezes o mesmo fato dentro do pedido com teto de tokens medido. A regra é genérica — qualidade de feed, não tratamento de fornecedor — e a trava protege os DOIS lados: descarta o repetido **e** preserva resumo que repete parte do título mas acrescenta preço, prazo ou loja. **Esse segundo caso nasceu de uma reinjeção que NÃO falhou:** meu teste de "resumo legítimo" não compartilhava palavra nenhuma com o título, então nenhum limiar o mataria. **`[01/10]` Ganhou o TIMEOUT depois do 1º clique real:** a GDELT não deu `429` como eu previ, deu `Signal timed out.` — ela leva 10–12 s só para recusar, e herdava os 10 s do RSS. A trava exige que a API receba o teto próprio, e **essa checagem nasceu de uma reinjeção que NÃO falhou**: os dois testes que eu tinha passavam com a chamada sem o argumento, ou seja o defeito voltava em silêncio | `INV-EDIT-008` |
| `vocabularioDoRadarNaoDeriva.test.js` | **`[01/10]`** o vocabulário de confiabilidade do radar divergindo entre o `contrato.ts` (o `enum` que o modelo recebe) e a tela — nos **dois** sentidos. O lado mudo é o servidor ganhar um valor que a tela não conhece: a pauta aparece **sem selo**, nada estoura, e o editor conclui que o modelo não classificou quando ele classificou. O outro lado é selo desenhado para caso que nunca chega, que é código morto parecendo feature. Cobre também a **ressalva na tela** (*"como a MANCHETE se apresenta"*): sem ela, "Confirmado" parece verificação do GamerHub, e o modelo só leu o título | `INV-EDIT-010` |
| `radarSinalDeAceleracao.test.js` | **`[01/10]`** a FASE 3 do radar, e o bug que a divisão dela revelou. **O sinal:** rótulo que diz mais do que os números sustentam — divisão por zero virando `Infinityx o normal`, a pauta herdando a média em vez do termo que carrega o sinal, `esfriando` deixando de ser dito. Exige também que o sinal seja a **última** coisa do fluxo (subi-lo faria uma falha de enfeite custar as pautas) e que seja **uma** consulta com os termos de todas as pautas, não uma por pauta. **O vocabulário não deriva**, e a lista do servidor é levantada EXECUTANDO `rotuloDaAceleracao` numa grade de 41×41 — não por regex, que foi como o `vocabularioDoNewsNaoDeriva` descartou `in_review` em silêncio —, com um **controle** que reprova se a grade não produzir rótulo nenhum. **E o bug real, que é de classe:** o `index.ts` montava toda resposta num builder `corpo()`, e um `const corpo = await res.text()` dentro do `if (!res.ok)` o sombreava — `corpo({...})` lançava `TypeError`, o `try/catch` em volta engolia, e **toda** falha da Groq (cota, 413, 400) chegava na tela como *"A IA respondeu algo que eu nao entendi"*. O `admin_logs` ficava certo, então só mentia para quem clicou, que é o caso que o §1.5 chama de pior do que erro nenhum. A tradução virou `falhaDaGroq.ts`, pura e executada por teste; a sombra virou checagem no texto-fonte com a mensagem explicando o mecanismo | `INV-EDIT-011` · `INV-EDIT-012` |
| `padraoDeBuscaNaoVazaCuringa.test.js` | **`[02/10]`** SEC-055: valor de fora chegando cru num `ILIKE`. Ela varre as migrations **por bloco de função** — não por linha, e isso não é detalhe: `buscar_pessoas` escapa numa linha e compara na seguinte, então a varredura linha a linha **acusou a própria correção** no 1º run. Exige `escapar_curinga` no corpo de toda função que compara contra operando concatenado, com mapa de perdões que **cobra motivo escrito** e reprova perdão cujo arquivo sumiu. Checa também que a função de escape existe (renomeá-la deixaria a varredura procurando um nome morto e **passando verde sobre código vulnerável**) e que ela trata a **barra antes** de `%` e `_` — sem isso, um termo terminado em `\` faz o Postgres levantar erro na cara de quem buscou. **Ela achou um falso positivo nela mesma no 1º run:** a policy `"User insere proprio like de comentario"` tem *like* no NOME, e por isso a varredura passou a tirar identificador entre aspas antes de olhar | `INV-PORTA-014` |
| `editoriaProvavelNaoChuta.test.js` | **`[02/10]`** a sugestão de editoria voltando a decidir por **tamanho de palavra**. A regra era *"a pista mais longa ganha"*, e `temporada` (9 letras) vencia `jogo` (4): «Diablo IV temporada 15 … transforma o jogo …» era sugerido como **Filmes e Séries**. Medido antes do conserto: **4 de 6 casos errados**, e os 2 que acertavam acertavam pelo motivo errado. A trava guarda a propriedade, não a lista: **palavra que ACOMPANHA nunca decide sozinha**, e isso é verificado varrendo o próprio vocabulário — palavra ambígua acrescentada amanhã entra na checagem sem ninguém lembrar. Cobre também a coerência das duas camadas (nenhuma palavra em dois `definem`, nenhuma nos dois tipos), o empate devolvendo `null`, e o corpo entrando como apoio sem atropelar o título. **E ela reprova se alguém acrescentar `diablo` ao vocabulário**: o caso que originou o conserto tem de passar pela arquitetura, senão a trava prova a lista e a classe de erro continua viva | `INV-EDIT-013` |
| `sugestaoQueConcordaNaoCala.test.jsx` · `assistenteSugereNaoDecide.test.js` (avisos) | **`[02/10]`** o painel de sugestões do News **calando quando concorda**, e o aviso que **mentia**. Ele relatou *"as sugestões não estão aparecendo mais"*: não era bug, era o conserto da editoria funcionando — os rascunhos vêm do radar com a editoria preenchida, e o botão só aparece quando a sugestão discorda. Enquanto ela errava, discordava; quando acertou, sumiu. **Silêncio é resposta ambígua**: não distingue "conferi e está certo" de "não consegui dizer nada". A trava exige a linha de confirmação **sem botão**, que a discordância continue sendo botão que ninguém clica sozinho, que a tela **não** confirme uma editoria que o assistente não sugeriu, e que matéria completa continue mostrando nada. **A reinjeção dessa última NÃO falhou na 1ª vez** — a fixture usava um título que devolve `null`, então não havia confirmação para virar motivo de nada. Do lado dos avisos: corpo vazio e corpo curto são mensagens diferentes, a do vazio **não pode falar em "final"** (truncamento de um texto que nunca começou), e todo aviso tem de nomear o campo ou a ação | `INV-EDIT-013` |
| `scripts/tipos-das-edges.mjs` (`npm run tipos`) | **`[02/10]`** Edge Function que **não compila**. Era o único código do projeto que ninguém compilava: o `npm run build` só olha `src/`, as travas que leem uma Edge Function a leem como TEXTO, e o Supabase implanta sem checar tipo. O `deno check` acusa `TS2349 This expression is not callable` no `const corpo` que sombreava o montador da resposta do radar — o bug que fez toda recusa da Groq virar a mensagem errada na tela. Usa `--node-modules-dir=auto` em vez de um `deno.json` no repositório, porque esse arquivo ficaria na árvore que o CLI empacota e implanta. **Conta o que olhou e reprova se olhou zero**, que é a lição do `varrerFontes` | — | **`[02/10]` Ele nasceu sujando o repositório, e o PORTÃO DE BYTES o pegou:** `--node-modules-dir=auto` com a raiz no projeto instalou `openai` no `node_modules/`, e o Vite o arrastou para o pacote — **790,6 kB contra 749,8 kB** depois de um `npm ci` limpo, 41 kB que ninguém importou. Hoje a checagem roda numa cópia em `/tmp` e os caminhos voltam reescritos
| `tiposDasEdgesNaoPoluiORepo.test.js` | **`[02/10]`** o portão de tipos voltando a instalar dentro do repositório. **O CI não teria pegado**: lá o orçamento de bytes roda ANTES do `npm run tipos`, então o sintoma só aparece em quem builda depois — na máquina da pessoa. Exige a cópia em `/tmp`, o `cwd` nela, o `finally` que a apaga (senão cada falha deixa um `node_modules` inteiro lá) e o caminho do erro voltando a apontar para o repositório. **É trava de texto-fonte, e isso está dito**: a prova de verdade seria rodar o script e olhar o `node_modules`, e o `deno` não existe quando o `npm test` roda | — |
| `branchesAbandonadas.test.js` (pré-site) | **`[02/10]`** o robô semanal pedindo para apagar uma **funcionalidade**. A issue #224 listava `preview` como órfã toda segunda — e ela é o pré-site sob demanda de 17/09, cujo desenho é justamente **não ter PR**. O CI, do outro lado, já **reprovava** quem desligasse o deploy dela: dois mecanismos do mesmo repositório discordando sobre a mesma branch, por semanas, porque *"branch órfã" soa inofensivo*. A trava liga os dois lados em vez de listar o nome: **branch com deploy ligado em `vercel.json` tem de estar nas protegidas** — e tem controle que reprova se a lista de ligadas ficar vazia | — |
| `segredosDaRestauracao.test.js` | **`[02/10]`** a lista de secrets do `supabase/migrations/README.md` envelhecendo. Ela dizia cinco e o código lia **nove** — faltavam `GROQ_API_KEY`, `TURNSTILE_SECRET_KEY` e os `SMTP_*`. Quem restaurasse o banco por aquele arquivo levantaria um site em que o News não redige, o radar não busca e o contato recusa todo mundo, **sem erro na tela de ninguém**: §1.5 aplicado à recuperação de desastre, que é literalmente o que aquela pasta existe para não ter. A trava **lê os `Deno.env.get()`** das 10 funções e reprova nos dois sentidos — secret que o código lê e o README não cita, e secret que o README promete e ninguém lê mais | — |
| `erroDoBancoNaoVazaCru.test.js` | **`[26/09]`** o texto do Postgres voltando para a tela. Três frentes: o `fail()` deixar de traduzir (e aí TODO service regride de uma vez), o mapa ganhar frase em inglês, e **constraint nova nas migrations sem frase em português** — foi assim que `corpo_exigido_no_ar` só foi descoberta quando o dono a esbarrou. **Ela achou 6 constraints sem frase no 1º run** | `INV-TELA-012` |
| `fonteEscrevePortugues.test.js` | **`[26/09]`** fonte não conferida entrando no site, e fonte **reprovada** voltando. Ela é deliberadamente do tipo mais fraco (lista escrita), e o motivo está no cabeçalho de `lib/fontesConferidas.js`: o defeito da Orbitron era **perceptual** — o glifo existia, era diferente da crase e era mais largo que ela. As quatro medições que eu tentaria fazer passariam. Cobre também a fonte de display continuar **local** (`@font-face` + `/fonts/*.woff2`), para a troca não reabrir o achado de privacidade de 01/09 | `INV-TELA-013` |
| `publicarTemCaminho.test.js` | **`[26/09]`** a rota `/publicar` ficando sem porta, e a edição de post voltando a ser um campo cru. **Ela nasceu fraca e as reinjeções mostraram:** as duas primeiras versões procuravam `LinhaDePublicar` e `EditorDeTexto` no arquivo **inteiro**, e a linha de `import` sozinha as fazia passar sobre um feed sem porta e uma edição sem editor. Hoje conferem o JSX **montado** e o recorte do bloco de edição. **`[26/09]`** Ganhou a checagem de **colisão de nome**: o botão que NAVEGA não pode se chamar como o que ENVIA — foi o que reprovou o CI, e o estrago maior não era o `strict mode violation` e sim o `painel-admin.mjs` perder a checagem do corte editorial, que procura exatamente por um botão "Publicar" | `INV-TELA-014` · `INV-TELA-015` · `INV-TELA-016` |
| `rewriteNaoMenteSobreCaminho.test.js` | **`[01/10]`** o rewrite de SPA voltando a responder `200` com HTML por `/.well-known/`. Caminho de máquina (RFC 8615) que devolve a casca do site faz a ferramenta que sonda acreditar que o arquivo existe — o Lighthouse 13.5 reprovava `ard-schema` com *"Malformed JSON: Unexpected token '<'"*, e com `404` a mesma auditoria vira `notApplicable`. Reprova nos DOIS sentidos: fechar demais derruba a navegação do site inteiro, inclusive a tela de 404 do próprio router. A conferência na PRODUÇÃO é a lista `NAO_PODEM_RECEBER_O_APP` de `e2e/portas-da-web.mjs`, guardada contra esvaziamento pelo `portasDaWebNaoEsvaziam`. Ela entrou num segundo passo porque aquele portão mede o site NO AR: a afirmação só vira verdade depois do deploy que o merge dispara — o limite está escrito no `DECISOES-FERRAMENTAL.md` | `INV-PORTA-013` |
| `atalhoDePublicarNoCelular.test.jsx` | **`[01/10]`** as duas formas MUDAS de quebrar o atalho flutuante do feed: aparecer cedo demais (um piscar em toda carga, que ninguém reporta) e não aparecer nunca (a tela fica idêntica à do defeito). Cobre também o desktop — onde a barra lateral já resolve e ele seria enfeite — e o z-index, que acima do véu da gaveta faria o botão flutuar por cima do menu aberto | `INV-TELA-012` |
| `slugRespeitaOBanco.test.js` | **`[25/09]`** o slug que a TELA monta contra o `CHECK` `news_articles_slug_formato`. Não é falha silenciosa — ela grita —, mas grita para a pessoa errada: o editor recebe `violates check constraint` em jargão de Postgres **depois** de ter escrito a matéria inteira. Cobre acento, espaço, pontuação nas pontas, e o caso do título que não vira slug nenhum (só emoji), que devolve vazio em vez de inventar um link permanente | `INV-EDIT-001` |
| `assistenteSugereNaoDecide.test.js` | **`[25/09]`** o assistente do News **inventando**. A linha que ele guarda: tudo o que o assistente devolve vem do texto que a PESSOA já escreveu. No dia em que alguém plugar um modelo, a tentação óbvia é deixá-lo redigir a matéria a partir do título — e isso produz fato inventado com a marca do GamerHub assinando. Cobre o chute por omissão (`?? 'gaming'`), o casamento sem fronteira de palavra (`familia` → IA), e o resumo cortado no meio da palavra | `INV-EDIT-003` |
| `e2e/painel-admin.mjs` (passo do News) | **`[25/09]`** criar rascunho pelo NAVEGADOR, que é o único lugar onde o `INSERT` que roda é o de verdade. Nasceu de um bug que o DONO achou: `conteudo` era `NOT NULL` e criar matéria estava **quebrado** — eu tinha provado leitura e corte editorial em ROLLBACK, os dois COM `conteudo`, e nunca rodei o insert que o painel executa (§1.2: provei o caminho que eu tinha na cabeça). O mesmo passo cobre a outra metade de graça: a conta é `admin`, então o botão **Publicar não pode aparecer** | `INV-EDIT-001` |
| `comentarioNaoSomeDepoisDeAparecer.test.jsx` | **`[24/09]`** o bug real numa tela: a busca disparada ao abrir a seção respondendo depois da disparada ao enviar, e apagando o comentário recém-criado | `INV-TELA-005` |
| `buscaConcorrenteTemGuarda.test.js` | **`[24/09]`** a guarda sendo removida de uma das buscas conhecidas — e a marca `novoPedido()` migrando para DEPOIS do `await`, que a deixaria verde sem proteger nada | `INV-TELA-005` |
| `htmlNaoVazaProsa.test.js` | **`[24/09]`** comentário de implementação voltando ao HTML que o visitante baixa — e, do outro lado, a prosa sendo **apagada** em vez de mudada de lugar | `INV-PORTA-009` |
| `auditorDoBancoEhOuvido.test.js` | o mensageiro do auditor perdendo o `GRANT` (CI fica mudo), o auditor sendo aberto ao `anon` (vaza nomes), e a lista branca **engordando em silêncio** — e, desde a SEC-051, também a lista de **isentas da checagem de literal de papel** | `INV-PORTA-006` · `INV-PORTA-011` · `INV-PORTA-012` **`[25/09]`** O auditor tem **seis** checagens — a 5ª (SEC-052) acusa tabela com grant e zero policies, a 6ª (SEC-053) acusa POLICY com hierarquia à mão. A trava cobre as **três** listas de exceção, e desde 25/09 captura o rótulo do dólar em vez de exigir `$fn$`: a SEC-052 trocou para `$function$` e a deixou **cega por um PR**, conferindo a versão da SEC-051. Hoje ela também compara quantas definições enxerga com quantos arquivos definem a função |
| `cofre.test.js` | código do cofre guardado em texto; reset em 2 cliques | `INV-CONTA-004` |
| `documentosLegais.test.js` | texto legal mudando por baixo de quem aceitou | `INV-CONTA-005` |
| `logoutEhLocal.test.js` | `signOut()` com escopo global derrubando outro aparelho | `INV-CONTA-002` |
| `voltarNaoEhRedirecionador.test.jsx` | `?de=` aceitando destino de fora do site | `INV-NAV-001` |
| `campoDeSenhaUnico.test.js` | `<input type="password">` fora do `CampoDeSenha` | `INV-TELA-002` |
| `portaoAntesDoSite.test.js` | o site pintando antes do portão de entrada | `INV-TELA-003` |
| `queueLabels.test.js` | tipo da fila faltando num dos três mapas | `INV-CONTRATO-007` |
| `roles.test.js` | `canModerateLive` com combinação de papel errada | `INV-AUTZ-004` |
| `conteudoDoSobre.test.js` | mídia de terceiro sem crédito visível (CC-BY) | `INV-LEGAL-001` · `INV-LEGAL-002` |
| `conteudoDaPrivacidade.test.js` | o texto legal chegando quebrado na tela | `INV-LEGAL-002` |
| `cadastroSemSelectEmProfiles.test.js` | cadastro lendo `profiles` antes de existir | `INV-CONTA-006` |
| `cacheNaoAtravessaTrocaDeConta.test.js` | dado de uma conta vazando para a seguinte | `INV-CONTA-007` |
| `respostaDeContatoNaoMente.test.js` | resposta de contato afirmando envio que não houve | `INV-TELA-001` |
| `varrerFontes.test.js` | **meta-trava**: trava que varre pasta e não lê arquivo nenhum | — |

> **`[24/09]` As 9 linhas "sem INV" foram fechadas.** Elas protegiam algo real
> e a regra nunca tinha sido escrita — exatamente o estado em que a regra do XP
> viveu até ser aplicada em 1 dos 4 caminhos. Viraram `INV-NAV-001`,
> `INV-TELA-001/002/003`, `INV-LEGAL-001/002`, `INV-CONTRATO-007` e
> `INV-CONTA-006/007`, todas **derivadas** do que a trava já afirma.
>
> **Nenhuma linha desta tabela deve voltar a dizer "sem INV" sem motivo escrito
> ao lado.** Trava sem regra escrita é conhecimento que só existe dentro do
> teste.

---

## 4 · Roteiros E2E — o caminho real, num navegador

| Roteiro | O que cobre |
| --- | --- |
| `portas-do-banco.mjs` | REST API com a `anon key` real — as duas direções |
| `politica-de-conteudo.mjs` | **`[24/09]`** a CSP quebrando o site: 6 rotas num Chromium de verdade, mais sonda de `frame-src` e `connect-src` — e um **controle** que prova que o roteiro distingue política de falha de rede |
| `portas-da-web.mjs` | a borda HTTP: cabeçalho por VALOR, vazamento, source map — **`[24/09]`** e as seis diretivas travadas da CSP, comparadas por igualdade |
| `portas-fechadas.mjs` | as Edge Functions recusando quem não deve |
| `fluxos.mjs` · `publicarPost.mjs` · `comentar.mjs` · `curtir.mjs` | publicar, comentar, **responder**, **curtir** e o caminho autenticado. **`[24/09]`** a resposta aninhada é conferida por **estrutura** (`INV-CONTEUDO-003`): o bloco do comentário pai tem de conter o texto da resposta, que é o que o aninhamento é. Resposta que entra como comentário solto não estoura nada. **`[24/09]`** o `curtir.mjs` (`INV-TELA-004`) confere depois de **recarregar**: a curtida é otimista, então a tela sozinha não é testemunha — e o descurtir é o lado que a RLS nega em 204 **sem erro** |
| `lives.mjs` | criar, encerrar, reativar e apagar live, conferindo o ESTADO |
| `painel-admin.mjs` | o painel da equipe |
| `smoke.mjs` · `rotas.mjs` · `navegacao.mjs` | rotas de pé, âncora morta, botão voltar |
| `conteudo-visivel.mjs` | conteúdo no DOM e invisível na tela, em janela de celular |
| `sem-banco.mjs` | banco fora do ar derrubando o que não depende dele |
| `realtime-do-anonimo.mjs` | landing de deslogado abrindo WebSocket (custo por conexão) |
| `artes-da-arena.mjs` | arte da entrada carregando pedaço do adversário |
| `quadros-de-video.mjs` · `som-ambiente.mjs` · `portaoDeEntrada.mjs` | mídia, áudio, portão |
| `terceiro-no-contato.mjs` | o formulário público e o captcha |

---

## 5 · Robôs que AVISAM — não reprovam

Deliberado: indício não vira build vermelho, porque portão que grita por
indício vira ruído, e ruído ensina a ignorar o canal.

| Robô | Quando | O que faz |
| --- | --- | --- |
| `documentacao-envelhecida.mjs` | dia 1º | abre issue com documento atrás do código |
| `branches-abandonadas.mjs` | segunda | abre issue com branch de PR fechado |
| `lembrete-de-auditoria.yml` | dia 1º | abre issue se passou de 90 dias sem auditoria |
| `lembrete-de-mutacao.yml` | agendado | lembra do teste de mutação |

---

## 6 · Testes comuns — 62 arquivos

Cobrem lógica isolada: `format`, `date`, `url`, `password`, `embed`, `image`,
`like`, `ranks`, `wordlist`, `marca`, as cenas da landing, os hooks de UI, e por
aí. **São valiosos e não são travas** — não impedem uma classe de mudança, e
não devem ser contados como proteção quando alguém perguntar "isto está
coberto?".

---

## 7 · O que NÃO é trava — nomeado de propósito

| Arquivo | O que é |
| --- | --- |
| `e2e/util.mjs` · `e2e/arena/medidas.mjs` | ajudantes dos roteiros |
| `scripts/territorio.mjs` | **mapa** lido pelos portões — dado, não portão |
| `scripts/gerar-icones.mjs` · `gerar-cenas-da-landing.mjs` · `tracar-marca.mjs` | geradores de asset |
| `scripts/conferir-fidelidade.mjs` | ferramenta de conferência visual, rodada à mão |
| `scripts/inicio-de-sessao.sh` | põe o estado na frente no começo da sessão |
| `scripts/fim-de-sessao.mjs` | checklist do fim — **não roda no CI** |
| `scripts/documentacao-a-revisar.mjs` | lista de leitura, não veredito |
| `scripts/impressao-das-edges.mjs` | gera a impressão que a trava compara |

---

## 7 · ⚠️ `[09/10]` AS 42 QUE FALTAVAM — e por que o inventário não percebeu

Medido hoje, com o mesmo critério das seções acima: **113 arquivos de teste
leem algum arquivo do projeto** (é isso que separa trava de teste comum), e o
inventário nomeava **71**. Cobertura real: **63%**.

### A causa, e ela está escrita no fim deste arquivo

O fecho dizia: *"este arquivo é vigiado pelos portões que já existem"*.

**Vigilância de mão única.** O `documentacao-quebrada.mjs` confere se todo
caminho CITADO aqui existe. Nenhum portão conferia o contrário — se toda trava
que EXISTE está citada aqui. Então o inventário envelheceu do único jeito que
nada acusava: por omissão.

É a mesma falha que o dono apontou sobre a tabela da política de privacidade,
e que o `CLAUDE.md` §6.3 registra sobre a própria tabela de mecanismos — *lista
que se apresenta como o inventário e não é deixa de ser verdade para quem a
lê*. Inclusive para mim, na sessão em que eu for procurar se já existe trava
para alguma coisa.

**Agora existe o portão da outra direção:**
`inventarioDeTravasEstaCompleto.test.js`.

### O que estas linhas são, e o que NÃO são

A coluna "o que ela prova" é o `describe()` de cada arquivo, **extraído do
código**, não redigido agora — o mesmo princípio do §1.4: a fonte que executa
vence a memória. A natureza vem do que cada uma LÊ, que é critério mensurável:

| lê | natureza |
| --- | --- |
| `supabase/migrations` | trava de invariante |
| `src/` | trava de contrato |
| `.github/workflows`, `scripts/`, `package.json` | trava da esteira |

**O que falta, dito com todas as letras:** as travas desta seção ainda não
foram relidas uma a uma para ganhar `INV-*` próprio — as que já citam um
invariante no código o trazem; o resto aparece com `—`. Isso é menos preciso
que as seções 1–6, e está aqui **declarado** em vez de disfarçado de completo.

**34 que leem o `src/`**

| Trava | O que ela prova | Invariante |
| --- | --- | --- |
| `telaDePausa.test.js` | a tela de pausa mostra o motivo que o dono escreveu | — |
| `assuntosDeContato.test.js` | assuntos do contato | — |
| `secoesDaLanding.test.js` | as seções declaradas existem na página | — |
| `useAuth.test.js` | useAuth — os dois logouts | — |
| `usePostComposer.test.js` | usePostComposer — ciclo de vida das prévias | — |
| `useVigiaDeBanimento.test.js` | useVigiaDeBanimento | — |
| `abertura.test.js` | o tempo da abertura | — |
| `animacaoComAtraso.test.js` | animação com atraso não pode nascer acesa | — |
| `cenasVivas.test.js` | a varredura não pode ficar vazia | — |
| `continuidadeDaLanding.test.js` | o fundo da landing | — |
| `conviteDeInstalacaoNaoInsiste.test.js` | o convite de instalação não insiste nem chega tarde | — |
| `cspDoAppSegueADaWeb.test.js` | a política de conteúdo do app segue a da web | — |
| `dadosEstruturados.test.js` | dados estruturados | — |
| `deployPendenteNaoEhAfrouxamento.test.js` | deploy pendente não é afrouxamento | — |
| `entradaDeInstalacaoNaoSome.test.js` | a entrada de instalação não some nem chuta | — |
| `envioDeEmailTemDoisCaminhos.test.js` | o envio de e-mail mantém as propriedades que seguram o cadastro | — |
| `errosDeAuth.test.js` | erros de autenticação | — |
| `metaDaPagina.test.js` | meta por página | — |
| `moderacaoDeImagem.test.js` | moderate-image — uma imagem por requisição da OpenAI | — |
| `moderacaoDeMidia.test.js` | todo caminho que modera imagem também modera vídeo | — |
| `ocultarTemInversa.test.js` | ocultar tem inversa alcançável pela tela | — |
| `prologo.test.js` | o roteiro dos atos | — |
| `relatoDeFalhaDeVideo.test.js` | relato de falha de vídeo — navegador × moderate-image | — |
| `robotsSitemapLlms.test.js` | robots.txt, sitemap.xml e llms.txt | — |
| `rotasComSom.test.js` | rotas com som ambiente | — |
| `rotasE2E.test.js` | rotas exercitadas pelos testes de navegador | — |
| `semPromessaDeBloqueio.test.js` | a tela de entrada não promete bloqueio por tentativas | — |
| `sinaisDoAtoZero.test.js` | os sinais de vida do ATO 0 | — |
| `tailwind4MantemAAparencia.test.js` | o Tailwind 4 não mudou a aparência do site | — |
| `tiposDeConteudo.test.js` | tipos de conteúdo — o contrato entre quem produz e quem modera | — |
| `modosDoLogin.test.js` | todo modo da tela de entrada tem frase própria | — |
| `edgeFunctionsParseiam.test.js` | as Edge Functions são código válido | — |
| `orcamentoVeOCss.test.js` | o orçamento de bytes enxerga o CSS | — |
| `regrasCarregadas.test.js` | CLAUDE.md — as regras continuam sendo carregadas | — |
| `transformDoCssNaoBrigaComTailwind.test.js` | classe nossa e utilitária do Tailwind disputando `translate`/`rotate`/`scale` — a marca do hero saiu 55 px da tela no celular | — |
| `vazioDaAbaNaoMenteSobreOSite.test.jsx` | o vazio de uma aba afirmando sobre o SITE o que só sabe da ABA — "1 ao vivo" no cabeçalho e "nenhuma live acontecendo" no miolo, juntos. *(Não usa `readFileSync`, então o portão de completude não a exige: ela exercita o componente. Está aqui porque protege um invariante de leitura.)* | — |
| `falhaDoVitestEhLegivelDeFora.test.js` | falha de teste unitário no CI devolvendo só `exit code 1` — o log vive em outro host e a API não o alcança | — |
| `textoDeGenteNaoVaiCru.test.js` | superfície de CORPO desenhando texto de usuário sem o `TextoFormatado` — o mural era a última, e quem escrevesse `**oi**` via os asteriscos | — |

**8 que leem a ESTEIRA (CI, scripts, package.json)**

| Trava | O que ela prova | Invariante |
| --- | --- | --- |
| `cenasDaLanding.test.js` | as artes das cenas | — |
| `marca.test.js` | a marca | — |
| `servicoDeCacheNaoPrendeNaVersaoVelha.test.js` | o service worker não prende ninguém na versão velha | — |
| `advisoriesAceitosTemMotivo.test.js` | exceção de advisory é decisão escrita | — |
| `backlogDesativadoNaoRessuscita.test.js` | o bloco de itens desativados não ressuscita sozinho | — |
| `cssNaoPerdeAsset.test.js` | o CSS não perde asset no caminho para o pacote | — |
| `documentacaoQuebrada.test.js` | portão de documentação quebrada | — |
| `segredosVazados.test.js` | o portão de segredos — senha em texto | — |
---

## Como manter isto verdadeiro

**Trava nova entra aqui no mesmo PR**, com o `INV-*` ao lado. Se não houver
invariante, ou ela se escreve, ou fica a linha `— sem INV` dizendo a verdade.

**Este arquivo é vigiado nos DOIS sentidos**, e até 09/10 era só num:

| sentido | quem confere | o que pega |
| --- | --- | --- |
| o que está citado aqui EXISTE | `documentacao-quebrada.mjs` | trava apagada ou renomeada |
| o que EXISTE está citado aqui | `inventarioDeTravasEstaCompleto.test.js` | **trava nova que ninguém registrou** |

> **`[09/10]` O fecho anterior dizia que os portões existentes bastavam, e que
> criar mecanismo novo seria a espiral de controle do §9.8.** Estava errado, e
> o número mostrou: o inventário tinha caído para **63%** sem nada acusar. A
> pergunta 2 daquele mesmo §9.8 é *"ele está realmente falhando, ou eu não o
> usei?"* — aqui ele não falhou nem deixou de ser usado: **ele nunca olhou
> para esse lado.** Isso é buraco de cobertura, não espiral.
>
> E o conserto é uma checagem, não um script com portão e documentação: a
> própria regra do §9.8, pergunta 5, aplicada ao conserto dela.
