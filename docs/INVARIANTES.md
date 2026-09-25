# Invariantes do GamerHub

> **Para que este arquivo existe:** guardar, com ID estável, as regras que
> **nunca podem ser quebradas** — e ligar cada uma ao achado que a originou, à
> trava que a protege e ao código que a implementa.
>
> Ele responde uma pergunta só: **"o que nunca pode acontecer?"**.
>
> Para *"como a segurança funciona hoje"* → [SEGURANCA.md](SEGURANCA.md).
> Para *"o que encontramos e como investigamos"* → `db/AAAA-MM-DD-*.md`.
> Para *"por que escolhemos esta solução"* → [DECISOES.md](DECISOES.md).
> Para *"o que falta fazer"* → [`BACKLOG.md`](../BACKLOG.md).

[← voltar para o README](../README.md)

---

## Por que esta camada passou a existir

Até 19/09 toda regra permanente deste projeto existia **implícita, dentro do
teste que a protegia**. Isso funciona enquanto alguém lembra do teste — e falha
exatamente quando não lembra.

O sintoma mediu-se assim: existem **147** arquivos de teste, roteiro e portão no
repositório, e o inventário do `CLAUDE.md` citava **43**. O problema nunca foi a
diferença de número; foi não haver como perguntar *"esta regra tem proteção?"*
sem abrir 147 arquivos.

**A inversão que este arquivo faz:**

```
ANTES   achado -> teste            "será que alguém lembrou de testar isso?"
HOJE    achado -> INVARIANTE -> testes que a protegem
                                   "essa coisa nova cabe em qual INV?"
```

A diferença aparece quando surge uma fonte de XP nova amanhã: a pergunta deixa
de ser sobre memória e passa a ser sobre cobertura de uma regra escrita.

### O que este arquivo NÃO é

- **Não é a história.** O relato de cada achado continua em `db/` e no
  `SEGURANCA.md`. Aqui fica a regra que sobreviveu ao achado.
- **Não substitui trava nenhuma.** Documento não impede bug; quem impede é a
  coluna "protegida por". Invariante sem trava é intenção, e está marcada como
  tal.
- **Não inventa regra.** Toda linha abaixo foi **derivada** de uma trava que já
  existe e já roda. Nada aqui é aspiracional.

### Como os IDs funcionam

`INV-<DOMÍNIO>-<NNN>`. O ID **não muda** e **não é reaproveitado**: se uma regra
deixar de valer, ela é marcada como revogada com a data e o motivo, e o número
morre com ela. Isso é o que permite `git log -S'INV-XP-001'` achar tudo que
encostou naquela regra.

Os IDs históricos (`N*`, `SEC-*`, `LIVE-*`) **continuam valendo** e aparecem na
coluna "nasceu de". Eles ligam a regra ao commit, à migration e ao relatório —
a cadeia que o `docs/SEGURANCA.md` já contava em prosa.

---

## XP — o que pode e o que não pode pagar

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-XP-001** | Conteúdo **fora do ar não paga XP**, em nenhuma das quatro formas de ganhar: post, curtida, comentário e live | N8, N9, N10 · SEC-028 · LIVE-040 | `src/lib/__tests__/xpSegueOQueEstaNoAr.test.js` |
| **INV-XP-002** | O bônus de perfil exige **caractere visível** — `trim()` não basta, porque não corta U+200B, U+00A0, U+3000, U+FEFF nem U+2060 | N3 · SEC-046 | `src/lib/__tests__/xpSoPagaOQueAparece.test.js` |
| **INV-XP-003** | Ninguém soma `posts.likes` — a coluna **foi apagada**, e três lugares já somaram ela achando que valia algo | — | `src/lib/__tests__/xpNaoLeColunaMorta.test.js` |
| **INV-XP-004** | A moderação alcança o XP de uma live **mesmo depois que o cron apagou o post** | LIVE-052 | `src/lib/__tests__/moderacaoDeXpDeLive.test.js` |

> **INV-XP-001 é a que mais voltou.** Ela foi aplicada em *uma* das quatro
> formas de ganhar XP e as outras três ficaram abertas por um dia — é o caso que
> deu origem a esta página inteira.

---

## LIVE — os estados que não coexistem

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-LIVE-001** | Live **no ar** não tem `live_ended_at` | SEC-034 | `CHECK posts_live_no_ar_nao_tem_fim` · `autorizacaoAntesDeExistencia.test.js` |
| **INV-LIVE-002** | Live **apagada** não fica no ar (`is_live` × `deleted_at`) | LIVE-050 | `CHECK posts_live_apagada_nao_fica_no_ar` · `liveApagadaNaoVoltaAoAr.test.js` |
| **INV-LIVE-003** | Live **oculta** não fica no ar (`is_live` × `hidden_at`) | LIVE-051 | `CHECK posts_live_oculta_nao_fica_no_ar` · `moderacaoAlcancaLiveNoAr.test.js` |
| **INV-LIVE-004** | O prazo da live é **derivado de uma duração**, nunca declarado pelo cliente | LIVE-041 | `src/lib/__tests__/prazoDaLive.test.js` |

> **As três primeiras são a MESMA regra em pares de coluna diferentes**, e é por
> isso que elas estão juntas: a 001 existia sozinha, e as outras duas foram
> encontradas perguntando *"onde mais esse par existe?"*. Se aparecer uma quarta
> coluna de "fora do ar", ela entra aqui antes de virar bug.

---

## CONTEÚDO — ciclo de vida e interação

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-CONTEUDO-001** | Coluna de ciclo de vida é **derivada pelo servidor**, nunca declarada pelo cliente (`was_live`, `expires_at`, `live_ended_at`, `created_at`, `user_id`, `hidden_at`, `deleted_at`) | N2, N4 · SEC-027 | `src/lib/__tests__/colunasDerivadasDoPost.test.js` |
| **INV-CONTEUDO-002** | Não se **interage** com conteúdo que não está no ar, e interação de post fora do ar não é **legível** por conta comum | N11, N12 · SEC-029 · SEC-041 | `xpSegueOQueEstaNoAr.test.js` · `colunasDerivadasDoPost.test.js` |
| **INV-CONTEUDO-003** | Resposta pertence ao **mesmo post** do comentário pai — e **aparece como resposta**: recuada sob o pai, nunca como comentário solto | SEC-033 | `src/lib/__tests__/autorizacaoAntesDeExistencia.test.js` · **`[24/09]`** `e2e/comentar.mjs` (o lado visível: o bloco do pai tem de CONTER a resposta) |
| **INV-CONTEUDO-004** | Escrever em conteúdo alheio respeita a **hierarquia de cargo** | SEC-009 | `src/lib/__tests__/hierarquiaNoConteudo.test.js` |
| **INV-CONTEUDO-005** | **`[24/09]`** O post que o CI publica **não fica no banco para sempre**: a retenção o apaga de verdade 2h depois do soft delete, e o padrão exige o **relógio** da marca — título de gente que comece com `[e2e ` não casa | — | `src/lib/__tests__/retencaoDePostDeTeste.test.js` |
| **INV-CONTEUDO-006** | **`[24/09]`** A página do feed é **keyset por `(created_at, id)`** e a RPC que a produz é **`SECURITY INVOKER`** — é a RLS que recorta. Sob `DEFINER` o feed listaria conteúdo moderado para todo mundo, sem erro nenhum. E o lote do cliente + 1 nunca passa do teto da RPC, senão o "carregar mais" some com posts por ler | — | `src/lib/__tests__/paginacaoDoFeed.test.js` |
| **INV-CONTEUDO-007** | **`[24/09]`** `posts.category` **foi apagada** — e nenhuma função de trigger pode voltar a lê-la: `NEW.category` num trigger de `posts` derruba o **publicar** para todo mundo (`record "new" has no field "category"`, medido). A classificação também não volta à tela sem passar por `DECISOES.md` | autorizado em 24/09, depois de a trava reprovar o primeiro DROP | `src/lib/__tests__/categoriaSaiuDaExperiencia.test.js` |

---

## AUTORIZAÇÃO — quem pode, e em que ordem se pergunta

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-AUTZ-001** | **Autorização antes de existência.** `SECURITY DEFINER` que procura o alvo antes de checar quem chama vira oráculo de existência | N5 · SEC-032 | `src/lib/__tests__/autorizacaoAntesDeExistencia.test.js` |
| **INV-AUTZ-002** | **Autorização antes de validar entrada** — senão a mensagem de erro distingue alvo que existe de alvo que não existe | SEC-031 | `src/lib/__tests__/colunasDerivadasDoPost.test.js` |
| **INV-AUTZ-003** | **Operador punido não manda.** Banido ou suspenso não exerce ação administrativa — o cargo não basta, o estado dele faz parte da autorização | N43, N44, N46, N47 · SEC-043 | `src/lib/__tests__/estadoDoOperador.test.js` |
| **INV-AUTZ-004** | Hierarquia sempre por **função** (`role_rank`, `is_staff`, `is_super`, `can_moderate_content`), **nunca lista literal** de papéis | SEC-025 · (3 falhas repetidas) | `punicaoRespeitaHierarquia.test.js` · `src/lib/roles.js` |
| **INV-AUTZ-005** | Guard de papel **não compara com NULL** — em SQL `NULL < 1` é `NULL` e o `IF` não dispara | N1 · SEC-030 | `src/lib/__tests__/guardDePapelNaoAceitaNull.test.js` |

---

## WORKFLOW — decisão administrativa sobre estado que muda

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-WF-001** | Uma decisão está vinculada à **geração do estado** que ela contesta — aprovar um pedido do BAN A não pode remover o BAN B | N41, N42 · SEC-044 | `src/lib/__tests__/decisaoRevalidaEstado.test.js` |
| **INV-WF-002** | Toda decisão **revalida o alvo no momento em que é tomada**, nunca sobre o retrato guardado quando o pedido foi criado | N25, N26, N27, N38, N39 · SEC-045 | `src/lib/__tests__/decisaoRevalidaEstado.test.js` |

> As duas são a mesma família vista de dois ângulos: **autorização criada para um
> estado antigo agindo sobre um estado novo**. Sete achados distintos do
> levantamento externo eram esta única coisa.

---

## PORTAS — o que cada papel alcança

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-PORTA-001** | **Função de trigger não é RPC.** Ela nasce chamável por `anon` em `/rest/v1/rpc/`, porque o `pg_default_acl` dá `EXECUTE` a toda função criada pelo `postgres` | SEC-042 | `src/lib/__tests__/funcaoDeTriggerNaoEhRpc.test.js` |
| **INV-PORTA-002** | `anon` alcança **`site_config (key, value, updated_at)` e mais nada** | SEC-005 · régua de papéis de 12/09 | `e2e/portas-do-banco.mjs` (as duas direções) |
| **INV-PORTA-003** | As colunas pessoais de `profiles` não são legíveis por quem não é dono | SEC-025 | `colunasPrivilegiadasDeProfiles.test.js` · `e2e/portas-do-banco.mjs` |
| **INV-PORTA-004** | Os cabeçalhos de segurança da borda existem **com o valor certo** — presença não basta, `SAMEORIGIN` no lugar de `DENY` é proteção enfraquecida | — | `e2e/portas-da-web.mjs` · `portasDaWebNaoEsvaziam.test.js` |
| **INV-PORTA-005** | As três portas do contador de login ficam fechadas para `authenticated` | — | `src/lib/__tests__/contadorDeLoginFechado.test.js` |
| **INV-PORTA-006** | Nenhuma função nasce alcançável por `anon` **fora da lista branca escrita** — e o auditor que verifica isso tem de ser **ouvível pelo CI** | SEC-042 · SEC-043 · SEC-050 | `e2e/portas-do-banco.mjs` · `src/lib/__tests__/auditorDoBancoEhOuvido.test.js` |
| **INV-PORTA-007** | O navegador **não executa script de origem que não esteja na CSP** — e a política é verificada num navegador de verdade antes de ir ao ar, nunca só escrita | — | `e2e/politica-de-conteudo.mjs` |
| **INV-PORTA-008** | **`[24/09]`** A CSP continua **no ar** e as seis diretivas que não têm motivo legítimo de crescer (`default-src`, `script-src`, `object-src`, `base-uri`, `frame-ancestors`, `form-action`) continuam **com o valor exato** — presença não é proteção: `script-src 'self' 'unsafe-inline'` passa em qualquer checagem de "contém 'self'" | — | `e2e/portas-da-web.mjs` · `portasDaWebNaoEsvaziam.test.js` |
| **INV-PORTA-009** | **`[24/09]`** O HTML servido ao visitante **não carrega prosa de implementação** — comentário de HTML, diferente do JSX, não é removido pelo build e vai inteiro para o `dist/`. A explicação mora no `ARQUITETURA.md`, e a trava confere as **duas** pontas: nenhum comentário no HTML **e** a seção de destino continuar de pé com o conteúdo dentro | — | `src/lib/__tests__/htmlNaoVazaProsa.test.js` |
| **INV-PORTA-010** | **`[24/09]`** A **busca** não passa por cima da RLS: `buscar_posts` é `SECURITY INVOKER` — provado em ROLLBACK, usuário comum buscando o termo de um post **ocultado** recebe zero. E `buscar_pessoas`, que precisa ser `DEFINER` (as colunas pessoais de `profiles` são revogadas desde a SEC-025), devolve **só** `id`, `username`, `avatar_url` e `role` — o recorte é a defesa | SEC-025 | `src/lib/__tests__/buscaNaoVazaNemMente.test.js` |
| **INV-PORTA-011** | **`[25/09]`** Tabela nova **nasce aberta** neste banco (medido: `authenticated` ganha `arwdm` do `pg_default_acl`, sem ninguém escrever `GRANT`) — então toda tabela nova leva `REVOKE ALL` explícito, e nenhuma fica com grant para `anon`/`authenticated` **sem policy nenhuma**: a proteção seria acidental, e cai na primeira policy que alguém escrever | SEC-005 · SEC-052 | 5ª checagem de `auditoria_de_operadores()`, ouvida pelo CI via `contagem_de_achados_de_seguranca()` |
| **INV-PORTA-012** | **`[25/09]`** Policy **nunca** escreve hierarquia à mão. `is_staff()`/`is_super()` embutem `operador_ativo()`; `role_rank(...) >= 2` na policy reimplementa metade da regra e perde a pergunta *"quem chama ainda está apto?"* — um admin **banido** lia a fila, a trilha inteira e escrevia na wordlist. Exceção só com motivo escrito na migration E no mapa da trava | SEC-043 (a mesma regra, aplicada só nas RPCs) · SEC-053 | 6ª checagem de `auditoria_de_operadores()`, ouvida pelo CI via `contagem_de_achados_de_seguranca()` · `auditorDoBancoEhOuvido.test.js` |
| **INV-EDIT-001** | **`[25/09]`** Quem **escreve** no News não é quem **publica**. Pôr um artigo no ar — `published` ou `scheduled` — e mexer no que já está no ar é só de super admin e owner; admin cria, edita e manda para revisão. Quem impede é o **banco** (trigger que levanta exceção), nunca a tela | decisão do dono em 25/09, saída B | `news_guarda_a_publicacao` (trigger) · `src/lib/news/__tests__/vocabularioDoNewsNaoDeriva.test.js` |
| **INV-EDIT-002** | **`[25/09]`** Rascunho nasce **sem corpo**: `conteudo` só é exigido quando o artigo vai ao ar (`published`/`scheduled`). Exigir na criação quebra a única coisa que um rascunho é — o artigo antes do texto — e a mesma condição impede **esvaziar** matéria que já está sendo lida | bug achado pelo dono em 25/09 | `CHECK news_articles_corpo_exigido_no_ar` · `e2e/painel-admin.mjs` |
| **INV-EDIT-003** | **`[25/09]`** **Nada no News é preenchido sozinho.** Toda sugestão — a do assistente determinístico e a da IA — é um BOTÃO, nem em campo vazio. Quem assina a matéria é quem clicou | pergunta dele em 25/09 | `assistenteSugereNaoDecide.test.js` · `rascunhoDeIaNaoDeriva.test.js` |
| **INV-EDIT-004** | **`[25/09]`** **A IA redige, não apura.** Ela só escreve a partir das NOTAS que o editor forneceu (mínimo de 40 caracteres, cobrado no servidor), e marca `[CONFERIR: …]` no lugar do que falta em vez de preencher. Texto redigido a partir de um título **inventa** fato, data e número — e sai assinado pelo GamerHub | decisão do dono em 25/09 | `rascunhoDeIaNaoDeriva.test.js` |
| **INV-EDIT-005** | **`[25/09]`** **A IA nunca escreve no banco.** A Edge Function devolve o rascunho na resposta e não tem caminho para `news_articles` — ela roda com a service role para gritar em `admin_logs`, e uma escrita ali passaria por cima de toda a RLS e de todo o corte editorial, publicando sem revisor, sem erro e sem log. Rascunhar é de `is_staff()` | *"ela não vai postar nada sozinha"* (dono, 25/09) | `rascunhoDeIaNaoDeriva.test.js` |
| **INV-EDIT-006** | **`[25/09]`** **Matéria rascunhada por IA diz que foi.** A marca chega às três telas que listam matéria, e a lista do painel **pede a coluna** — sem ela o campo volta `undefined` e o selo some em silêncio. O revisor precisa saber ANTES de ler: texto de modelo é plausível por construção, e plausível é o que passa por leitura corrida | idem | `redigido_com_ia` (coluna) · `rascunhoDeIaNaoDeriva.test.js` |
| **INV-EDIT-007** | **`[26/09]`** **Fonte de pauta é endereço REAL.** O radar só cita URLs que vieram dos feeds coletados — endereço que o modelo escreveu e não estava na lista é descartado antes de sair do servidor, e pauta que perde todas as fontes não chega na tela. Uma URL inventada de um site conhecido é indistinguível de apuração para quem lê | pedido dele em 26/09 (*"as fontes confiáveis"*) | `radarDePautasNaoInventa.test.js` |
| **INV-TELA-012** | **`[26/09]`** **O Postgres cru não chega na tela.** Todo erro de escrita passa pelo tradutor no `fail()` — um lugar, os 64 gatilhos de constraint do banco — e o texto original **não se perde**: fica em `tecnico`, atrás de um "detalhes". As duas falhas são simétricas: despejar o inglês é verdade inútil, e trocar por "algo deu errado" apaga quem for investigar | o dono leu `violates check constraint "news_articles_corpo_exigido_no_ar"` na tela, em 26/09 | `erroDoBancoNaoVazaCru.test.js` |

---

## TRILHA — o que fica gravado

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-TRILHA-001** | A trilha de auditoria **não é forjável** pelo cliente | — | `src/lib/__tests__/trilhaNaoEhForjavel.test.js` |
| **INV-TRILHA-002** | Toda `action` que o banco grava tem **ícone registrado** — senão aparece no painel com o genérico e ninguém nota | Fase 4 (11 actions órfãs) | `src/lib/__tests__/logMeta.test.js` |

---

## CONTRATO — código e banco têm de concordar

> Esta família inteira nasceu da **Fase 4** da auditoria: os dois lados estavam
> certos por dentro, e errados **entre si**. O sintoma é sempre o mesmo — nada
> estoura, nada loga, a funcionalidade simplesmente não acontece.

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-CONTRATO-001** | Assinatura de realtime só em tabela **publicada** — senão `subscribe()` responde `SUBSCRIBED` e nenhum evento chega, para sempre | Fase 4 | `src/lib/__tests__/realtimeTables.test.js` |
| **INV-CONTRATO-002** | As chaves do `site_config` são as mesmas na RPC e no painel | — | `src/lib/__tests__/siteConfigChavesFechadas.test.js` |
| **INV-CONTRATO-003** | O que o banco grava em notificação é o que o sino sabe mostrar | — | `src/lib/__tests__/notifMeta.test.js` |
| **INV-CONTRATO-004** | Os motivos de ban são os mesmos no modal e no banco | — | `src/lib/__tests__/guardDePapelNaoAceitaNull.test.js` |
| **INV-CONTRATO-005** | Ninguém dá `update` em tabela **sem policy de UPDATE** — a RLS nega em silêncio, com 0 linhas e nenhum erro | (moderação quebrada por meses) | `src/lib/__tests__/tabelasSemUpdate.test.js` |
| **INV-CONTRATO-006** | Escrita que pode ser negada **confere quantas linhas caíram** | idem | `src/lib/__tests__/apagarConfereLinhas.test.js` |
| **INV-CONTRATO-007** | Todo tipo da fila de moderação existe nos **três** mapas: rótulo, tabela de leitura e tabela de autor — e o link leva ao lugar certo, ou a lugar nenhum | (o `chat` que caiu no `else`) | `src/components/moderation/__tests__/queueLabels.test.js` |

---

## CONTA — sessão, exclusão e aceite

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-CONTA-001** | Apagar a conta **exige a senha**, conferida no servidor | — | `src/lib/__tests__/exclusaoPedeSenha.test.js` |
| **INV-CONTA-002** | Sair é **local**: o `supabase-js` usa escopo global por omissão, então sair no celular derrubaria o PC | — | `src/hooks/__tests__/logoutEhLocal.test.js` |
| **INV-CONTA-003** | O aceite dos documentos legais **nasce com a conta**, e o que o cliente manda tem de bater com o que o `handle_new_user` aceita | — | `src/lib/__tests__/aceiteNasceComAConta.test.js` |
| **INV-CONTA-004** | O código do cofre **nunca é guardado em texto** | — | `src/lib/__tests__/cofre.test.js` |
| **INV-CONTA-005** | Texto de documento legal não muda **por baixo de quem já aceitou** | — | `src/lib/__tests__/documentosLegais.test.js` |
| **INV-CONTA-006** | O cadastro **não lê nem escreve `profiles`** — a linha ainda não existe. Username se checa por RPC, e os campos extras vão no `metadata` do `signUp` | — | `src/services/__tests__/cadastroSemSelectEmProfiles.test.js` |
| **INV-CONTA-007** | O cache **não atravessa troca de conta**, e a limpeza é por **identidade** — não a cada evento de auth, que dispararia em refresh de token | — | `src/hooks/__tests__/cacheNaoAtravessaTrocaDeConta.test.js` |

---

## NAVEGAÇÃO — para onde o site manda a pessoa

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-NAV-001** | O destino do botão "Voltar" é **sempre interno**, e quem **escreve** o `?de=` concorda com quem o **lê** — o link nunca carrega um valor que o leitor recusaria | — | `src/components/conteudo/__tests__/voltarNaoEhRedirecionador.test.jsx` |

> Redirecionamento aberto é a classe: um `?de=` que aceite destino de fora vira
> ponte para phishing com o domínio do GamerHub na barra. A trava cobre os
> **dois lados** de propósito — escritor e leitor discordando é como o buraco
> volta sem ninguém mexer na validação.

---

## TELA — o que o site afirma

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-TELA-001** | A tela **não carimba efeito que o servidor não confirmou**: nenhum componente marca `answered` direto, a resposta passa pela Edge Function, e a tela mostra o **texto** da resposta — não só o carimbo | — | `src/components/admin/__tests__/respostaDeContatoNaoMente.test.js` |
| **INV-TELA-002** | Todo campo de senha passa pelo `CampoDeSenha` — `<input type="password">` solto perde o olho de mostrar/ocultar, e no Android ficam **dois** olhos | — | `src/lib/__tests__/campoDeSenhaUnico.test.js` |
| **INV-TELA-003** | A marca de entrada é escrita **antes** de pedir o login ao servidor, e **desfeita em todo caminho que não termina em entrada** | — | `src/lib/__tests__/portaoAntesDoSite.test.js` |
| **INV-TELA-004** | **`[24/09]`** O efeito otimista **sobrevive ao recarregamento**: curtir e descurtir mudam a tela na hora, e o que vale é o que o servidor guardou. O lado de trás é o perigoso — `DELETE` negado pela RLS devolve **204 e zero linhas**, sem erro, então o `runLikeToggle` não reverte e a tela apaga uma curtida que continua no banco | — | `e2e/curtir.mjs` (dentro do `e2e/fluxos.mjs`) |
| **INV-TELA-005** | **`[24/09]`** Busca que roda de **dois gatilhos** descarta a resposta já superada — a resposta VELHA nunca sobrescreve a nova. Sem isso o que a pessoa acabou de criar some da tela, com o dado certo no banco, sem erro e sem log | — | `src/hooks/__tests__/useApenasAUltimaResposta.test.js` · `comentarioNaoSomeDepoisDeAparecer.test.jsx` · `buscaConcorrenteTemGuarda.test.js` |
| **INV-TELA-006** | **`[24/09]`** O aviso de "novas publicações" só conta o que a recarga **de fato traz** — live e post que nasce oculto ficam de fora —, e o número tem **teto**: no limite ele diz `20+` em vez de afirmar precisão que o mecanismo não tem | — | `src/lib/__tests__/novidadeDoFeed.test.js` (inclui o CONTRATO com `fetchFeedPosts`) |
| **INV-TELA-007** | **`[24/09]`** O botão de **curtir** está sempre desenhado — no post comum (dentro da linha do "Comentar") e no post **ao vivo** (onde não há seção de comentário para hospedá-lo). Ele mora num componente e é renderizado por outro; qualquer ponta da ponte que caia faz o coração sumir em silêncio | pedido do dono em 24/09 | `src/components/feed/__tests__/curtirFicaNaLinhaDoComentar.test.js` |
| **INV-TELA-008** | **`[25/09]`** Conteúdo de usuário **nunca vira HTML**: a formatação de post é ÁRVORE → elemento React, o projeto segue em **zero** `dangerouslySetInnerHTML`, e o `href` de link passa por `safeExternalUrl` — URL recusada vira **texto**, não some | o XSS armazenado de ago/2026 (`javascript:` virando href) | `src/lib/formatacao/__tests__/formatacaoNaoVirarHtml.test.jsx` |
| **INV-TELA-009** | **`[25/09]`** Cor e tamanho de texto vêm de **lista fechada**: o usuário escolhe um NOME, e a aparência sai de um mapa para classe — nenhuma string dele vira CSS. Nome desconhecido volta a ser **texto**, não é sanitizado nem sumido. E o comentário oferece um **recorte** do que o post oferece, nunca mais | pedido do dono em 25/09 | `src/lib/formatacao/__tests__/corETamanhoSaoFechados.test.jsx` |
| **INV-TELA-010** | **`[25/09]`** A barra de ferramentas nunca oferece um recurso que o analisador não saiba ler — senão o botão escreve marcador e o leitor do post vê texto cru, sem erro nenhum. E um par de marcadores só formata quando **encosta** no texto: `2 * 3 * 4` é uma conta, não itálico | a própria trava, no 1º run (§1.5) | `src/lib/formatacao/__tests__/aBarraNaoOferecaOQueOAnalisadorNaoLe.test.js` |
| **INV-TELA-011** | **`[25/09]`** O vocabulário do News na tela (9 editorias, 5 estados) é **o mesmo** do `CHECK` do banco. Valor que o banco aceita e a tela não conhece aparece **sem rótulo**, sem erro — e `scheduled` conta como "no ar", senão o corte editorial é furável agendando para daqui a um minuto | FASE 4 do §6 | `vocabularioDoNewsNaoDeriva.test.js` |

> `INV-TELA-004` é o caso mais puro desta família: aqui a tela mente **por
> desenho**, e isso é a coisa certa para quem usa. O que a torna uma
> testemunha ruim é justamente isso — por isso a prova é o reload, nunca o
> número logo depois do clique.
>
> `INV-TELA-001` é o §1.5 pelo lado da interface: falha tem de gritar, e tela
> que afirma o que não aconteceu é o oposto — ela **silencia** a falha com uma
> mentira. As duas outras são a mesma ideia em miniatura: o estado que a tela
> mostra tem de corresponder ao que de fato existe.

---

## LEGAL — licença e texto público

| ID | A regra | Nasceu de | Protegida por |
| --- | --- | --- | --- |
| **INV-LEGAL-001** | **Mídia de terceiro tem crédito visível.** A trilha da landing é CC BY 4.0: usar sem crédito é usar **sem licença** | — | `src/components/sobre/__tests__/conteudoDoSobre.test.js` |
| **INV-LEGAL-002** | O texto das páginas legais e institucionais chega **íntegro** na tela: bloco completo, ícone existente no mapa, tabela com o mesmo número de colunas, sem âncora repetida | — | `src/components/privacidade/__tests__/conteudoDaPrivacidade.test.js` · `conteudoDoSobre.test.js` |

> **Por que `INV-CONTA-005` não mudou de família.** Ela também é sobre documento
> legal, mas o que ela protege é o **consentimento** — o texto mudando por baixo
> de quem já aceitou. É uma regra de conta, não de licença. E o ID não se move:
> a regra deste arquivo diz que `INV-*` não muda e não é reaproveitado, senão
> `git log -S` deixa de achar a história.
>
> **O risco que a `INV-LEGAL-001` cobre não é a trilha de hoje** — é a segunda
> mídia, o dia em que alguém largar um arquivo em `src/assets/som/` e esquecer o
> crédito. O site passaria a violar uma licença sem nada acusar.

---

## Como usar isto no dia a dia

**Ao criar qualquer coisa nova**, a pergunta deixa de ser *"lembrei de testar?"*
e passa a ser **"isto cai em qual INV?"**. Uma fonte de XP nova cai em
`INV-XP-001`; uma RPC administrativa nova cai em `INV-AUTZ-003`; uma coluna de
"fora do ar" nova cai na família `INV-LIVE`.

**Ao achar um bug**, depois de corrigir: ele confirma um INV que já existe, ou
revela um que faltava? Se revela, ele entra aqui **junto com a trava** — nunca
sozinho, porque linha sem trava é intenção, não proteção.

**Ao mexer numa trava citada acima**, o INV é o contexto: o teste não está ali
para passar, está ali para segurar aquela regra.

> **Este arquivo é vigiado pelos portões que já existem.** Todo caminho citado
> aqui é conferido pelo `scripts/documentacao-quebrada.mjs`, que reprova o PR se
> um arquivo sumir ou for renomeado. Não foi preciso criar mecanismo novo — e
> criar um a mais seria a espiral de controle que o `EXECUCAO.md` §9.8 proíbe.
