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
| `funcaoDeTriggerNaoEhRpc.test.js` | `INV-PORTA-001` |
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
| `retencaoDePostDeTeste.test.js` | **`[24/09]`** prefixo de teste novo no E2E que a retenção do banco não conheça — o lixo voltaria a se acumular **em silêncio**, porque nada quebra quando sobra linha. E o padrão perdendo o relógio, o que faria o site destruir post de gente | `INV-CONTEUDO-005` |
| `paginacaoDoFeed.test.js` | **`[24/09]`** as três falhas MUDAS do feed paginado: a RPC virando `SECURITY DEFINER` (a RLS deixa de valer e o feed lista conteúdo moderado), os dois ramos do cursor virando um `OR` (**medido**: derruba o Index Cond para Filter — 100 linhas lidas e jogadas fora numa página de 20), e o lote crescendo até o teto da RPC (o item extra some e o "carregar mais" desaparece com posts por ler) | `INV-CONTEUDO-006` |
| `categoriaSaiuDaExperiencia.test.js` | **`[24/09]`** trigger voltando a ler `NEW.category`/`OLD.category` — a coluna foi apagada, e lê-la derruba o **publicar** —, e o seletor voltando ao feed. Olha a definição **vigente** do trigger, não o histórico: acusar a migration antiga seria reprovar o passado. Ignora prosa que cita o campo. *Ela nasceu protegendo o CONTRÁRIO (proibir o DROP) e reprovou o primeiro drop antes de a decisão mudar* | `INV-CONTEUDO-007` |
| `curtirFicaNaLinhaDoComentar.test.js` | **`[24/09]`** o botão de curtir **sumindo da tela**. Ele deixou de morar onde é usado (o `PostCard` o entrega à `CommentSection` como `acoes`, para as duas ações dividirem uma faixa só): se um dos dois lados da ponte cair, o coração desaparece **sem erro, sem log e sem teste quebrando** — e é a interação mais usada do feed | `INV-TELA-007` **`[25/09]`** e o `data-comentario` do `CommentCard`, que é a âncora do roteiro de resposta — sem ela ele volta a contar níveis de DOM, o que já reprovou DUAS respostas corretas |
| `buscaNaoVazaNemMente.test.js` | **`[24/09]`** as três falhas mudas da busca: `buscar_posts` virando `DEFINER` (a RLS deixa de valer e a busca acha conteúdo moderado — a lista só fica maior, nada estoura), `buscar_pessoas` ganhando coluna no `RETURNS` (é `DEFINER` por necessidade, então o **recorte** é a defesa), e aba oferecida sem área que a atenda — vazio que a pessoa lê como "não achei" | `INV-PORTA-010` |
| `formatacaoNaoVirarHtml.test.jsx` | **`[25/09]`** a formatação de post virando HTML. Renderiza de verdade (jsdom) e exige que `javascript:`, `data:`, `vbscript:` e `file:` **não** virem `href`; que `<script>`, `<img onerror>`, `<iframe>` e `<svg onload>` apareçam como **texto**; e varre `src/` inteiro exigindo que o projeto siga em **zero** `dangerouslySetInnerHTML` | `INV-TELA-008` |
| `corETamanhoSaoFechados.test.jsx` | **`[25/09]`** cor/tamanho aceitando valor fora do vocabulário, `style` montado a partir do nó (proteção acidental: "o React recusa CSS malformado"), e o comentário ganhando poder que o post não tem. Confere também que o nó guarda **nome**, nunca `#hex`/`rgb`/`url()` | `INV-TELA-009` |
| `comentarioNaoSomeDepoisDeAparecer.test.jsx` | **`[24/09]`** o bug real numa tela: a busca disparada ao abrir a seção respondendo depois da disparada ao enviar, e apagando o comentário recém-criado | `INV-TELA-005` |
| `buscaConcorrenteTemGuarda.test.js` | **`[24/09]`** a guarda sendo removida de uma das buscas conhecidas — e a marca `novoPedido()` migrando para DEPOIS do `await`, que a deixaria verde sem proteger nada | `INV-TELA-005` |
| `htmlNaoVazaProsa.test.js` | **`[24/09]`** comentário de implementação voltando ao HTML que o visitante baixa — e, do outro lado, a prosa sendo **apagada** em vez de mudada de lugar | `INV-PORTA-009` |
| `auditorDoBancoEhOuvido.test.js` | o mensageiro do auditor perdendo o `GRANT` (CI fica mudo), o auditor sendo aberto ao `anon` (vaza nomes), e a lista branca **engordando em silêncio** — e, desde a SEC-051, também a lista de **isentas da checagem de literal de papel** | `INV-PORTA-006` |
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

## Como manter isto verdadeiro

**Trava nova entra aqui no mesmo PR**, com o `INV-*` ao lado. Se não houver
invariante, ou ela se escreve, ou fica a linha `— sem INV` dizendo a verdade.

**Este arquivo é vigiado pelos portões que já existem:** todo caminho citado é
conferido pelo `documentacao-quebrada.mjs`, e o `territorio.mjs` o liga às
pastas de teste. Não foi criado mecanismo novo — a espiral de controle é
justamente o que o `EXECUCAO.md` §9.8 proíbe.
