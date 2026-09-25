<!--
  Parte do `CLAUDE.md`, puxada por `@import`. O motivo do corte está no §6.2
  regra 5: seção acima de ~150 linhas vira arquivo próprio, e o CLAUDE.md
  chegou a 900 linhas — o teto que ele mesmo impõe — em 24/09.
-->

## 6.3 Os mecanismos que não dependem da minha memória

> Ordem do dono em 29/08, depois de eu falhar **duas vezes na mesma sessão**:
> *"quero algum tipo de gatilho pra vc poder ler a documentação e principalmente
> sua própria memória (CLAUDE.md), nada mais pode falhar"*.

**O que essa cobrança revelou, e é o motivo desta seção existir.** As duas
falhas foram com as regras **escritas, certas, e lidas por mim no começo da
sessão**: escrevi medição no `FUNCIONALIDADES.md` (o lugar é `DESEMPENHO.md`) e
deixei seis arquivos novos fora do `ARQUITETURA.md`. Nenhum portão acusou,
porque nenhum deles olhava isso.

A tabela do §2 já dizia o que fazer: *"comentário explicando o porquê"* é a
**mais fraca** das cinco travas, e só vale *"quando nenhum dos quatro couber"*.
Responder a uma falha de cumprimento escrevendo **mais uma regra** seria repetir
exatamente o que não funcionou. Por isso o que entrou foi mecanismo, não texto.

| Mecanismo | Quando roda | O que ele pega |
| --- | --- | --- |
| `scripts/inicio-de-sessao.sh` | **sozinho**, no `SessionStart` | põe na minha frente o estado real: pendência não commitada, os itens 🔴/🟠 do backlog **por extenso**, e há quantos dias cada documento não é tocado |
| `scripts/fim-de-sessao.mjs` (`npm run fim`) | **eu rodo antes de encerrar** | o que o CI nunca viu: trabalho não commitado, commit não empurrado, arquivo acima de 300 linhas, contador do backlog mentindo |
| `scripts/mapa-de-arquivos.mjs` | CI, **reprova** | arquivo em `src/` que o `ARQUITETURA.md` não conhece |
| `scripts/segredos-vazados.mjs` | CI, **reprova** | chave privada, `service_role`, token ou senha em arquivo rastreado |
| `scripts/documentacao-quebrada.mjs` | CI, **reprova** | documento citando arquivo que não existe mais |
| `scripts/numeros-do-projeto.mjs` (`npm run numeros`) | CI, **reprova** | **número escrito num documento que não bate com o projeto** — o AUDITORIA dizia "14.362 linhas" com 28.679 |
| `scripts/territorio-coberto.mjs` | CI, **reprova** | pasta do sistema que **nenhum documento** se considera dono — era o caso da pasta do texto da política de privacidade |
| `scripts/documentacao-a-revisar.mjs` (`npm run docs`) | **eu rodo antes de fechar** | quais documentos **esta sessão** tornou suspeitos, e o que mudou embaixo de cada um |
| `scripts/documentacao-envelhecida.mjs` | dia 1º, **abre issue** | documento atrás do código — **inclusive `CLAUDE.md` e os `docs/regras/`**, que até 02/09 eram os únicos sem vigilância |
| `e2e/portas-do-banco.mjs` | CI, **reprova** | porta do banco que abriu — **e porta que fechou**, que já derrubou o site 3× |
| `contagem_de_achados_de_seguranca()` + `auditorDoBancoEhOuvido.test.js` | CI, **reprova** | `[24/09]` o auditor do banco (SEC-049) fazia 3 checagens de classe e tinha `EXECUTE` revogado de TODO MUNDO — só rodava quando eu perguntava. Agora um mensageiro devolve **o número** de achados (nunca os nomes, que virariam mapa) e o `portas-do-banco` o chama com a anon key. É **detecção**: fechar o `pg_default_acl` foi medido e o do `supabase_admin` dá `permission denied`. **`[25/09]` São SEIS checagens** — as cinco de função/tabela mais a de POLICY com hierarquia à mão (SEC-053), que era a superfície sobre a qual ele imprimia zero sem nunca ter olhado |
| `e2e/portas-da-web.mjs` (`npm run test:web`) | CI, **reprova** | a BORDA HTTP: cabeçalho de segurança que sumiu **ou que foi enfraquecido** (compara por VALOR, não por presença), arquivo sensível vazando e mapa de fonte publicado. Escrito à mão em vez de scanner pronto porque o rewrite de SPA faz `/.env` devolver **200 com o `index.html`** — medido —, e todo scanner de caminho chamaria isso de vazamento |
| `e2e/politica-de-conteudo.mjs` (`npm run test:csp`) | CI, **reprova** | CSP que quebra o site. Sobe o `dist` com a política **lida do `vercel.json`** e carrega 6 rotas num Chromium de verdade. Sonda `frame-src` e `connect-src`, que rota pública não exercita, e tem um **controle** — sem ele "0 violações" podia significar "a rede do CI não saiu" |
| `portasDaWebNaoEsvaziam.test.js` | `npm test`, **reprova** | a lista do portão acima sendo **esvaziada**. Portão de lista vazia não falha nunca e continua imprimindo "nenhuma falha" — o `varrerFontes` para quem lê lista em vez de pasta |
| `e2e/conteudo-visivel.mjs` | CI, **reprova** | conteúdo no DOM e invisível na tela, em janela de celular |
| `e2e/navegacao.mjs` | CI, **reprova** | página abrindo no lugar errado, âncora morta, botão voltar atropelado |
| `e2e/sem-banco.mjs` | CI, **reprova** | banco fora do ar derrubando o que **não** depende dele |
| `e2e/artes-da-arena.mjs` | CI, **reprova** | arte da tela de entrada carregando pedaço do adversário — o corte que o orçamento de bytes não vê |
| `src/lib/tabelasSemUpdate.js` | `npm test`, **reprova** | `update` em tabela sem policy — 0 linhas e **nenhum erro** |
| `src/lib/__tests__/varrerFontes.js` | usado pelas travas | trava que varre pasta e **não leu arquivo nenhum**: sem ele, renomear a pasta deixa o teste verde para sempre |
| `e2e/publicarPost.mjs` | CI, **reprova** | publicar que não aparece — e ele diz **o que a tela disse** em vez de um `waiting for locator` mudo |
| `conteudoDoSobre.test.js` | `npm test`, **reprova** | mídia de terceiro em `src/assets/som/` **sem crédito visível**: licença CC-BY exige atribuição, e sem ela o site usa a obra sem licença |
| `documentosLegais.test.js` | `npm test`, **reprova** | documento público que ninguém aceita, e versão fora do formato que o `CHECK` do banco exige |
| `src/lib/somAmbiente.js` (teste) | `npm test`, **reprova** | duas instâncias de áudio tocando juntas — a janela entre o clique e o download terminar |
| `portaoAntesDoSite.test.js` | `npm test`, **reprova** | o site aparecendo **antes** do portão — a marca de entrada lida depois da pintura |
| `trilhaNaoEhForjavel.test.js` | `npm test`, **reprova** | action que o cliente registra e o banco **recusa em silêncio** (`logAudit` engole o erro de propósito) |
| `campoDeSenhaUnico.test.js` | `npm test`, **reprova** | `<input type="password">` solto, fora do `CampoDeSenha` — o olho de mostrar/ocultar sumiria só naquele campo |
| `voltarNaoEhRedirecionador.test.jsx` | `npm test`, **reprova** | o `?de=` do botão "Voltar" aceitando destino de FORA do site — redirecionamento aberto |
| `logoutEhLocal.test.js` | `npm test`, **reprova** | ponto de saída com o escopo errado. O `supabase-js` usa **global por omissão**, então sair no celular volta a derrubar o PC só por escrever `signOut()` |
| `documentosLegais.test.js` (impressão) | `npm test`, **reprova** | texto de documento legal mudando **por baixo de quem já aceitou** — cobre a lista de arquivos de cada documento |
| `aceiteNasceComAConta.test.js` | `npm test`, **reprova** | deriva entre o documento que o CLIENTE manda no cadastro e o que o `handle_new_user` aceita. O trigger pula item desconhecido de propósito (para não derrubar o cadastro), então a divergência faz o aceite sumir **em silêncio** |
| `cofre.test.js` (reset) | `npm test`, **reprova** | o "Esqueci o código" do cofre voltando a ser **dois cliques** — cobre as duas pontas: a tela abrir o `ResetDoCofre`, e ele conferir a senha no SERVIDOR **antes** de confirmar |
| `scripts/branches-abandonadas.mjs` + `branchesAbandonadas.test.js` | segunda, **abre issue** · `npm test`, **reprova** | branch que sobrou de PR fechado. A issue é semanal e **não reprova** — branch órfã não quebra nada. O teste reprova outra coisa: a branch de trabalho do §8 sair da lista de protegidas, o que faria o robô sugerir apagar onde o trabalho vive |
| `scripts/impressao-das-edges.mjs` + `impressaoDasEdges.test.js` | `npm test`, **reprova** | Edge Function editada com a **impressão velha**. A impressão é derivada do código — inclusive dos arquivos IRMÃOS da pasta —, e não uma data escrita à mão, que reproduziria o problema: esquecer de subir o número faz os dois lados concordarem num valor velho |
| `scripts/edges-implantadas.mjs` (`npm run edges`) | **CI** (`implantar-edges.yml`), em `push` para `main` que toque `supabase/functions` — `[24/09]` esta coluna dizia *"ainda NÃO está no CI"*, e envelheceu | função **no ar** que não foi gerada deste código. Foi o buraco que deixou as duas correções da `send-email` mortas por 5 dias. Fora do CI de propósito: 7 das 8 esperam uma ação do dono (`BACKLOG.md`), e portão que grita por algo que ninguém pode resolver ensina a ignorar o canal |
| `e2e/__tests__/sobrasAntigas.test.js` | `npm test`, **reprova** | as DUAS falhas opostas do detector de post de teste esquecido: deixar de ver um prefixo (foi assim que um `[painel ]` ficou no ar), e chamar de sobra o post do job que roda **em paralelo** contra o mesmo banco |
| `colunasDerivadasDoPost.test.js` | `npm test`, **reprova** | coluna de `posts` que o cliente voltou a declarar. `was_live` vale +30 XP: sem o trigger, um `PATCH` na REST API dava XP de live sem live. Cobre INSERT **e** UPDATE — testar só o `PATCH` deixava metade do buraco |
| `autorizacaoAntesDeExistencia.test.js` | `npm test`, **reprova** | `SECURITY DEFINER` que procura o alvo **antes** de checar quem chama, virando oráculo de existência. Varre a **classe**: o mapa de exceções exige motivo escrito, e foi ele que achou a 6ª função que a auditoria externa não viu |
| `xpSegueOQueEstaNoAr.test.js` | `npm test`, **reprova** | XP pago por conteúdo que a moderação tirou do ar, e interação de post fora do ar voltando a ser legível. Cobre as **quatro** formas de ganhar XP — a regra existia desde 17/09 e eu a tinha aplicado em uma |
| `funcaoDeTriggerNaoEhRpc.test.js` | `npm test`, **reprova** | função de **trigger** nova sem `REVOKE EXECUTE` — ela nasce chamável por `anon` via `/rest/v1/rpc/`, porque o `pg_default_acl` do schema dá `EXECUTE` a toda função criada pelo `postgres`. Fechar isso na raiz é mudança de contrato e está proposta no `BACKLOG.md`; até lá, a trava é o que segura a classe |
| `prazoDaLive.test.js` | `npm test`, **reprova** | o guard de colunas de `posts` voltando a ser `SECURITY DEFINER`, e derivação escrita **abaixo** do recorte de `v_comum`. Sob DEFINER o `current_user` vira o dono da função para todo mundo e a SEC-027 inteira desliga em silêncio — foi o que eu quase entreguei no PR #217 |
| `estadoDoOperador.test.js` | `npm test`, **reprova** | RPC administrativa que não pergunta se **quem chama** ainda está apto. Admin banido ou suspenso continuava mandando no site: o estado do operador nunca tinha feito parte da autorização, só o cargo dele |
| `decisaoRevalidaEstado.test.js` | `npm test`, **reprova** | decisão administrativa julgando um **retrato velho**. Aprovar um pedido de unban do BAN A removia o BAN B, porque o pedido não carregava a geração do estado que ele contestava |
| `xpSoPagaOQueAparece.test.js` | `npm test`, **reprova** | bônus de perfil pago por campo que não tem **caractere visível**. `trim()` só corta espaço ASCII: U+200B, U+00A0, U+3000, U+FEFF e U+2060 sobrevivem a ele, e um perfil de espaços invisíveis pagava igual a um preenchido |
| `liveApagadaNaoVoltaAoAr.test.js` | `npm test`, **reprova** | live de post **apagado** voltando ao ar pelo painel, e cada ciclo gravando uma sessão que paga XP. O CHECK do SEC-034 cobria `is_live` × `live_ended_at` e deixou `is_live` × `deleted_at` de fora — mesma classe, o par que ninguém olhou |
| `moderacaoAlcancaLiveNoAr.test.js` | `npm test`, **reprova** | moderação que não alcança a live **ainda no ar**. A invalidação do XP é retrospectiva e a live no ar não tem sessão para invalidar — ocultar ou apagar durante a transmissão deixava os 30 XP com o autor. Cobre as duas pontas: o banco e os dois lugares da TELA que listavam a live oculta como "ao vivo" para a própria equipe |
| `moderacaoDeXpDeLive.test.js` | `npm test`, **reprova** | o acoplamento invisível das três formas de invalidar o XP de uma live: elas convivem na MESMA coluna e o TEXTO dela é o mecanismo. Se o motivo manual colidir com o automático, restaurar um post passa a desfazer por baixo uma decisão que uma pessoa tomou — e nada quebra, porque restaurar continua funcionando |
| `useApenasAUltimaResposta.test.js` · `comentarioNaoSomeDepoisDeAparecer.test.jsx` · `buscaConcorrenteTemGuarda.test.js` | `npm test`, **reprova** | `[24/09]` a CORRIDA entre duas buscas da mesma lista: a disparada por um efeito e a disparada depois de uma escrita. Se a primeira responder por último, devolve o estado de ANTES e apaga o que acabou de aparecer — o comentário sumia da tela, vivo no banco, sem erro e sem log. É a 3ª armadilha da FASE 1 do §6, que estava escrita na régua e nunca tinha sido testada. As três camadas são o hook, a tela e a **lista dos casos conhecidos**, que também exige a marca do pedido ANTES do `await` |
| `vocabularioDoNewsNaoDeriva.test.js` | `npm test`, **reprova** | `[25/09]` a deriva entre o vocabulário do News na TELA e o `CHECK` do BANCO — 9 editorias e 5 estados, nos dois sentidos. O lado perigoso é o banco ganhar um valor que a tela não conhece: o artigo aparece **sem rótulo** e nada estoura. Cobre também `scheduled` contar como "no ar", sem o que o corte editorial é furável agendando para daqui a um minuto. **Ela achou um defeito nela mesma no 1º run**: a extração não aceitava `_` e descartava `in_review` em silêncio — a "cobertura que não cobre" dentro do próprio mecanismo que existe para pegá-la |

### O que os mecanismos NÃO fazem — e por que isso está escrito aqui

> Pergunta do dono em 30/08, no minuto seguinte à entrega: *"esse script te faz
> lembrar dessas regras ou testes? ... te faz lembrar de **tudo** oq vc precisa
> fazer na sessão?"*.

**Não. E não tem conserto em código.** Dos 13 itens da definição de pronto (§2),
os mecanismos acima cobrem **seis** — os que uma máquina consegue medir. Os
outros sete são de julgamento, e o principal deles é justamente o de segurança:
não existe comando que responda *"eu pensei em como alguém abusaria disto?"*.

| Verificado por máquina | Só por julgamento |
| --- | --- |
| build · lint · testes | **pensar como o atacante (§1.3)** |
| arquivo acima de 300 linhas | o bug virou trava, e a trava foi provada (§2) |
| contador do backlog | teste dos três canais (§1.5) |
| arquivo fora do `ARQUITETURA.md` | faxina no que toquei (§6.1) |
| documento citando arquivo que sumiu | caminhos que não podiam quebrar (§1.2) |
| trabalho não commitado ou não empurrado | mudança de banco testada em `ROLLBACK` (§5) |

**Fingir que verifica seria pior do que não verificar.** Um portão que dá verde
sobre julgamento ensina a confiar num sinal que não sustenta nada — a mesma
falha das cotas que estouram em silêncio (§0.2), só que pelo lado da falsa
confiança. Por isso `npm run fim` termina dizendo, com todas as letras, que
verde ali **não** quer dizer pronto: quer dizer que o que dá para medir por
máquina está medido.

**O que os dois gatilhos fazem com os sete itens restantes:** põem a lista na
frente. No **início**, porque no fim ela chegaria tarde demais para mudar *como*
a coisa foi construída — pensar em abuso depois de entregar não é segurança
proativa, é auditoria do próprio erro. E no **fim**, como última chance de
voltar. A resposta de cada um vai **dita ao dono no relatório de entrega**, que
é o único lugar onde ele pode cobrar.

> **`[05/09]` Esta tabela foi conferida contra o sistema**, depois de a issue
> automática de documentação apontar o `CLAUDE.md` como atrasado. Duas coisas
> saíram da conferência: todos os caminhos citados aqui **existem** (verificado
> arquivo a arquivo), e **seis travas estavam faltando** — as de 04–05/09.
>
> A ausência importava pelo mesmo motivo que o dono levantou sobre a tabela da
> política de privacidade: *"aquela tabela abre dizendo 'listados abaixo'"*.
> Lista que se apresenta como o inventário dos mecanismos e não é deixa de ser
> verdade para quem a lê — inclusive para mim, na sessão em que eu for procurar
> se já existe trava para alguma coisa.

### Onde cada coisa escrita mora — a tabela que eu errei

Está no §6.2 por extenso. Repetida aqui em uma linha porque foi **este** acerto
que falhou, e o gatilho de início a mostra em toda sessão:

> medição → `DESEMPENHO.md` · decisão de produto → `DECISOES.md` · **decisão de
> BANCO → `DECISOES-DE-BANCO.md`** · arquivo novo → `ARQUITETURA.md` · o que
> falta → `BACKLOG.md` · quando quebra → `OPERACAO.md` · **regra que nunca pode
> quebrar → `INVARIANTES.md`** · **quem protege a regra → `TRAVAS.md`**

### Nada fica para a próxima sessão — o que isso quer dizer de verdade

A sessão acaba e o contexto morre junto. Então **o que eu comecei, eu fecho**:
sem código não commitado, sem PR sem merge, sem achado que existe só na
conversa. `npm run fim` reprova os três.

**O que essa regra NÃO promete**, porque regra impossível vira regra ignorada
(§0): que todo trabalho caiba numa sessão. Uma auditoria consome uma inteira; um
bug que só reproduz no celular do dono depende dele. O que não cabe vai para o
`BACKLOG.md` **escrito**, com o que já foi descartado e qual evidência
resolveria — nunca para a minha cabeça, que não sobrevive ao fim da sessão.
