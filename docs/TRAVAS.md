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
| `portasDaWebNaoEsvaziam.test.js` | a lista do portão da borda sendo esvaziada | `INV-PORTA-004` |
| `auditorDoBancoEhOuvido.test.js` | o mensageiro do auditor perdendo o `GRANT` (CI fica mudo), o auditor sendo aberto ao `anon` (vaza nomes), e a lista branca **engordando em silêncio** | `INV-PORTA-006` |
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
| `portas-da-web.mjs` | a borda HTTP: cabeçalho por VALOR, vazamento, source map |
| `portas-fechadas.mjs` | as Edge Functions recusando quem não deve |
| `fluxos.mjs` · `publicarPost.mjs` · `comentar.mjs` | publicar, comentar, o caminho autenticado |
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
