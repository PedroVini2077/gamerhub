# Moderação por IA de mídia — imagem e vídeo

> A política por categoria, os limiares, as medições que os produziram e o
> caminho de vídeo. Saiu de [MODERACAO.md](MODERACAO.md) em 28/08, quando
> passou de 150 linhas — a regra do `CLAUDE.md` §6.2: seção grande demais vira
> arquivo próprio, porque documento gigante é onde a informação desatualizada
> se esconde.
>
> O resto da moderação — fila, denúncia, wordlist, banimento e recurso — segue
> em [MODERACAO.md](MODERACAO.md). As decisões e o que foi **descartado**, em
> [DECISOES.md](DECISOES.md).

[← voltar para o README](../README.md)

## `[28/08]` A política de imagem, e por que ela tem estes números

| Categoria | Piso | Destino | Roda em imagem? | Por quê |
| --- | --- | --- | --- | --- |
| `sexual` | 0.55 | **oculta** | sim | folgado de propósito: é quem cobre esta classe em imagem |
| `sexual/minors` | 0.10 | oculta | **NÃO — só texto** | ver abaixo |
| `self-harm` | 0.50 | **oculta** | sim | |
| `self-harm/intent` | 0.40 | **oculta** | sim | |
| `self-harm/instructions` | 0.30 | **oculta** | sim | |
| `violence/graphic` | **0.95** | **enfileira** | sim | a única que separa gore de ação comum |
| `violence` | — | **nada** | sim | aposentada em 28/08 |

### `[29/08]` A nota que decide e a nota que se registra são diferentes

A `moderate-image` manda `p_score = 1` de propósito: a política por categoria já
bateu o martelo, e o dial do painel não deve desfazer o que os pisos fixos
decidiram. O efeito colateral era que **todo item de imagem aparecia na fila com
"score 1"** — quem revisa não distinguia um 0.96 raspando o piso de um 0.99
gritante, e são casos com decisões diferentes.

`apply_ai_moderation` ganhou `p_score_real`: `p_score` continua decidindo,
`p_score_real` é o que fica gravado em `moderation_queue.metadata` e no texto do
log. Sem ele, cai no comportamento antigo — nenhum chamador existente mudou.

### `sexual/minors` não vale para imagem — e o piso de 0.10 nunca disparou

**Fato conferido na documentação da OpenAI, não dedução.** A
`omni-moderation-latest` aplica a imagem **seis** categorias: `sexual`,
`violence`, `violence/graphic` e as três de `self-harm`. `sexual/minors` — como
`hate*`, `harassment*` e `illicit*` — é **text only**.

O piso de 0.10 que está no mapa de imagem, portanto, **nunca protegeu nada
ali**, e não vai proteger enquanto a API for assim.

**Como apareceu:** no dia seguinte a passarmos a registrar todas as notas, o
log mostrou `sexual/minors=-` em toda análise enquanto as outras vinham com
número. É o retorno exato do que o §1.5 chama de *configuração que pode
silenciosamente nunca funcionar* — e a instrumentação a pegou em menos de 24 h.

**O que cobre esta classe em imagem é `sexual` em 0.55**, que roda e **oculta na
hora**. O piso dele é deliberadamente mais folgado que o do texto justamente
para pegar o caso duvidoso. **O caminho de texto (`moderate-text`) continua com
`sexual/minors` ativo e funcionando** — lá a categoria é suportada.

O piso ficou no mapa, com o aviso ao lado, por duas razões: removê-lo pareceria
mudança de política, e ele volta a valer sozinho no dia em que a OpenAI
estender a categoria. O que não podia continuar era alguém ler aquele `0.10` e
concluir que há detecção de menor em imagem. Travado por teste, e o log agora
marca a diferença entre "não veio e não deveria vir" (`-(so_texto)`) e "não
veio e deveria" (`-`).

### Por que `violence` foi aposentada, e não apenas subiu de piso

A pergunta que decidiu não foi "qual número acerta mais", foi **o que a equipe
faria com o item**. Um print de jogo de ação na fila é aprovado — sempre, todas
as vezes. Um sinal que dispara no caso comum e cujo veredito é sempre o mesmo
não é sinal, é ruído. E fila 100% ruído ensina a ignorar a fila, o que cega
também os avisos que importam (`CLAUDE.md` §0.2, 4ª regra).

Num site de jogos, "há violência na imagem" é o **estado normal do conteúdo**.
Nenhum piso conserta uma categoria que não separa nada.

### O que se perde, dito sem maquiagem

Gore leve — entre 0.80 e 0.95 — deixa de ser revisado por uma pessoa. Continua
coberto por denúncia, pela wordlist do texto que acompanha o post, e pela
moderação manual. A troca é deliberada: errar para baixo enchia a fila e fazia
ninguém olhar item nenhum; errar para cima deixa passar o caso duvidoso e
mantém a fila útil para o caso grave.

**Nada disto afrouxa o que oculta.** `sexual*` e `self-harm*` seguem iguais, e
há teste travando que nenhuma categoria de violência caia no mapa que oculta —
um `Ctrl+X` entre os dois mapas faria o site derrubar print de jogo sozinho, e
o autor descobriria pelo post sumindo.

### Como ajustar da próxima vez sem sessão de teste

O buraco que esta decisão expôs: as notas eram calculadas e **jogadas fora**. O
log contava só a categoria vencedora, e o corpo da resposta é descartado pelo
chamador (fire-and-forget) — então ajustar piso exigia pedir posts de teste, um
a um.

Desde a v13 toda análise registra as notas de **todas** as categorias com piso,
tenham disparado ou não:

```
[moderate-image] openai post/<id> analisadas=4/4 categoria=- score=0.000 acao=nada
  | notas: violence/graphic=0.812 violence=0.943 sexual=0.021 sexual/minors=0.000 ...
```

A distribuição passa a se acumular sozinha com o uso normal do site. Onde ler:
painel da Supabase → Edge Functions → `moderate-image` → Logs.

---

## `[28/08]` Vídeo, por amostragem de quadros

**O buraco:** vídeo era o único tipo de mídia que subia sem **nenhuma**
checagem. Em `postService.js`, só `type === 'image'` entrava na lista mandada
para a IA — texto, imagem e link eram moderados; vídeo passava direto. Ninguém
escreveu isso de propósito: nasceu no dia em que o formulário passou a aceitar
vídeo e a moderação não acompanhou.

**Como funciona.** `lib/framesDeVideo.js` extrai **3 quadros** (a 1/6, 3/6 e
5/6 da duração) num `<canvas>`, a 512px e JPEG 0.7, e `moderateVideos` os manda
**embutidos** (`data:`) para a mesma `moderate-image` que já analisa imagem.

**Nenhum caminho novo de análise foi preciso:** a API da OpenAI aceita `data:`
no mesmo campo `image_url.url`, e o `fetch()` do Deno — usado pela reserva do
Hugging Face — também resolve `data:`. A mudança na Edge Function foi só de
**validação**, com teto de **400 KB por imagem embutida**. Esse teto existe
porque `data:` é a única entrada cujo tamanho quem chama controla: URL de
storage pesa ~100 bytes, quadro embutido pesa centenas de KB, e sem limite uma
conta manda 4 imagens gigantes e queima cota da OpenAI.

> **Correção do mesmo dia — e ela apagou este parágrafo por 40 minutos.** A
> `moderate-image` mandava as imagens todas num `input` só, e a
> `omni-moderation-latest` aceita **uma por requisição**:
> `400 too_many_images`. Não era degradação, era tudo ou nada — post com 1
> imagem funcionava, post com 2 ou mais não era analisado, e **a moderação de
> vídeo, que nasce mandando 3 quadros de uma vez, nunca funcionou um dia
> sequer**. Hoje a função fatia em lotes de `MAX_IMAGENS_POR_REQUISICAO`
> (= 1), e o resultado é idêntico ao que uma chamada única daria, porque a
> agregação sempre foi por pior caso entre as imagens. Travado por
> `src/lib/__tests__/moderacaoDeImagem.test.js`, que lê o fonte da Edge
> Function. Ver [OPERACAO.md](OPERACAO.md) para como o bug apareceu no
> `admin_logs`.

**Por que quadros e não o vídeo inteiro:** as APIs que analisam vídeo cobram
por segundo. Alguns quadros herdam de graça toda a cobertura da moderação de
imagem — nudez, gore, automutilação — por custo de imagem.

> **O que isto NÃO garante.** Amostragem não é análise completa: um vídeo com
> dois segundos de conteúdo proibido entre os quadros amostrados passa. É uma
> limitação real e assumida — a alternativa era não checar nada, que é o que
> existia antes.

> ### `[28/08]` E ela falhou na primeira vez que rodou de verdade
>
> O dono publicou um vídeo às 22:20. O log da Supabase mostra `moderate-text`
> sendo chamada para aquele post e **`moderate-image` não sendo chamada nenhuma
> vez** — ou seja, a falha aconteceu no navegador, antes da rede.
>
> A causa mais provável é `extrairQuadros` devolver lista vazia (codec que o
> `<canvas>` não abre), mas **isso ainda é hipótese**: o `registrarErro` manda
> para o Sentry, e ninguém olhou lá. Enquanto todo o resto da moderação grita
> em `admin_logs`, este caminho gritava num lugar que não faz parte da rotina.
>
> **O que mudou:** `moderateVideos` passou a devolver
> `{ videos, analisados, semQuadros }` em vez de não devolver nada, e quem
> publica **é avisado na tela** quando o vídeo não pôde ser checado. Não dá
> para gritar em `admin_logs` a partir do cliente: a RPC que registra é
> `service_role`, e abrir um canal de log chamável pelo navegador repetiria o
> erro do `register_login_attempt` — qualquer um forjaria entradas.
>
> **`[29/08]` A causa foi cercada e o caminho endurecido.** O dono repostou e o
> aviso apareceu — confirmando que a extração devolve lista vazia. Investigando,
> o problema de fundo não era uma causa e sim **cinco**, todas terminando no
> mesmo `resolve([])` sem dizer nada: `createObjectURL` estourando, formato não
> decodificado, duração não finita, teto de 15 s, e canvas recusando desenhar.
>
> Agora cada uma diz seu nome, e três coisas mudaram no caminho:
>
> | Mudança | Motivo |
> | --- | --- |
> | trata `duration === Infinity` | caso real e comum em vídeo de celular e de gravação em streaming — era desistência calada |
> | `crossOrigin` removido | a origem é `blob:` do próprio documento, mesma origem por construção: não havia o que proteger, e declarar CORS numa `blob:` só cria recusa silenciosa |
> | vídeo entra no DOM, fora da tela | navegador de celular recusa decodificar elemento solto na memória, e o sintoma é exatamente "nada acontece, sem erro" |
>
> Travado por `e2e/quadros-de-video.mjs`, que fabrica um vídeo real com
> `MediaRecorder` e exige tanto os 3 quadros quanto que um arquivo inválido
> falhe **dizendo por quê**.
>
> ### `[29/08]` Falhou de novo — e desta vez o motivo tinha onde ficar
>
> O dono repostou e o aviso apareceu outra vez. O log da Supabase confirmou o
> mesmo quadro de antes, agora como **fato**, não hipótese: às 03:19:44 UTC a
> `moderate-text` foi chamada para o post e a `moderate-image` **não foi
> chamada nenhuma vez** em toda a janela.
>
> O que ficou claro é que o problema não era só a causa desconhecida: era o
> motivo **não ter onde morar**. Ele existia num toast de 6 segundos e no
> Sentry, e a segunda rodada de investigação começou exatamente do zero da
> primeira.
>
> **Três coisas mudaram.**
>
> **1. O motivo aparece na tela.** O aviso deixou de ser genérico: agora traz a
> causa (`Motivo: o navegador não decodificou o arquivo (tipo: video/mp4)`) e
> dura 12 s em vez de 6.
>
> **2. O motivo vai para o `admin_logs`** — e a afirmação anterior de que "não
> dá para gritar em `admin_logs` a partir do cliente" estava **errada**, o que
> vale registrar. Ela era verdadeira sobre o caminho que eu tinha imaginado
> (uma RPC aberta ao navegador, que qualquer um forjaria). Mas existe um
> caminho que já é autenticado e que já checa dono: a própria `moderate-image`.
> Ela passou a aceitar um corpo com `falha_de_extracao` e **sem imagem nenhuma**,
> e registra a falha com `registrar_falha_de_moderacao`, como já fazia para
> provedor fora do ar.
>
> O ramo fica **depois** da checagem de dono do conteúdo, de propósito: só dá
> para relatar falha sobre conteúdo próprio, então o volume fica preso ao ritmo
> de publicação e não ao que um estranho quiser mandar. A entrada sai com
> severidade `critical` e categoria `moderation` (herdadas da RPC, conferido em
> `pg_proc`), com deduplicação de 1 hora por motivo.
>
> **3. Um buraco pior foi fechado no caminho.** Lendo o código para instrumentar,
> apareceu uma falha que ninguém tinha notado: `ctx.drawImage` com um vídeo que
> o navegador **não decodificou não lança exceção** — ele simplesmente não
> desenha. O `<canvas>` nasce transparente, então saía um JPEG válido, do
> tamanho certo, **em branco**, que ia para a moderação e voltava com
> `score 0`. O vídeo era registrado como **analisado e limpo**.
>
> Isso é pior do que não analisar: a ausência de análise aparece como pendência,
> enquanto a análise falsa afirma que alguém olhou. Agora todo quadro passa por
> `nadaFoiDesenhado` — quadro de vídeo é sempre **opaco**, então alpha 0 em toda
> a amostra prova que nada foi desenhado. Travado em
> `src/lib/__tests__/quadroDesenhado.test.js`, com a contraprova de que quadro
> preto **legítimo** (fade, corte) continua passando.
>
> **Mais dois endurecimentos, cada um com o mecanismo nomeado:**
>
> | Mudança | Mecanismo |
> | --- | --- |
> | `load()` + `play()` mudo antes de amostrar | `preload` é uma DICA, e o Safari do iPhone a ignora fora de gesto do usuário — e o gesto já expirou, porque o upload inteiro aconteceu antes. Sem carga, nem `loadedmetadata` nem `error` disparam: o arquivo fica parado até o teto de 15 s estourar |
> | vigia de 4 s **por salto** | `seeked` não é garantido: navegador já posicionado não dispara nada, e vídeo curto faz as três marcas caírem na mesma granularidade de busca. Sem o vigia, um salto travado consumia os 15 s e levava junto os quadros que já tinham dado certo |
> | exige `videoWidth`/`videoHeight` | o `|| LARGURA_MAXIMA` de antes fabricava um canvas 512×512 que ficava transparente — era um dos caminhos que produziam o quadro em branco acima |
>
> **O que ainda NÃO se sabe, dito com todas as letras:** qual das causas
> disparou no vídeo do dono. Nenhuma das mudanças acima foi feita porque ela
> "provavelmente era a causa" — foram feitas porque cada uma é um caminho real
> de falha silenciosa que estava aberto. A causa em si aparece no próximo vídeo
> que falhar, na trilha e na tela, com nome.

**Falha de extração grita, em três canais.** Vídeo corrompido ou de codec
desconhecido devolve lista vazia, e lista vazia é tratada como **"não
analisado"**, nunca como "analisado e limpo":

| Canal (§1.5) | Onde |
| --- | --- |
| (a) quem está usando | toast de 12 s com o motivo, no formulário do post |
| (b) fica gravado | `admin_logs`, ação `edge_function_error`, via `falha_de_extracao` |
| (c) teste que falha | `e2e/quadros-de-video.mjs` e `src/lib/__tests__/quadroDesenhado.test.js` |

O Sentry continua recebendo via `registrarErro`, agora como quarto canal e não
como o único.

> ### `[29/08]` A terceira rodada — e a mensagem que eu escrevi estava mentindo
>
> Com o motivo finalmente na tela, o dono repostou e apareceu:
> `o navegador não decodificou o arquivo (tipo: video/mp4)`. Progresso — cinco
> causas viraram uma família. Mas ao abrir o código para agir sobre isso,
> **a mensagem se mostrou não confiável**, e por culpa minha:
>
> `video.src = url` já inicia a carga. Logo abaixo eu chamava `video.load()`,
> que **aborta a carga em andamento e recomeça**. O resultado possível disso é
> `MEDIA_ERR_ABORTED` — e a minha frase única relatava qualquer um dos quatro
> `MediaError` como problema de codec. Era o §1.5 ao contrário: não é falha
> silenciosa, é falha que **fala mentira**, o que manda investigar o lugar
> errado por horas.
>
> **O que mudou:**
>
> | Mudança | Por quê |
> | --- | --- |
> | o `load()` redundante saiu | ele podia ser a causa do próprio erro que reportava |
> | os manipuladores vêm ANTES do `src` | atribuir `src` já dispara a carga; registrar depois funcionava por sorte |
> | a mensagem traz o `MediaError` real | `lib/erroDeMidia.js` separa os quatro códigos, e cada um aponta para um lugar diferente: 1 é bug nosso, 2 é a fonte, 3 é o arquivo, 4 é o codec |
> | e traz o `canPlayType` do tipo declarado | resposta do próprio navegador sobre o formato, antes de qualquer dedução |
>
> **O plano B, que é o conserto de verdade.** Todas as causas plausíveis para o
> `<video>` recusar um `blob:` — codec que ele não abre a partir de Blob, `type`
> preenchido errado pelo seletor de arquivos, arquivo que o sistema já não
> entrega — têm a mesma saída: **o vídeo já subiu e já é público**. Então, se o
> arquivo local falhar, a extração é repetida a partir da URL do storage, que o
> navegador trata como mídia comum, igual à que ele toca no feed.
>
> `crossOrigin = 'anonymous'` volta a existir, mas **só nesse caminho**: numa
> URL `blob:` ele criava recusa silenciosa; numa URL de storage ele é
> obrigatório, senão o `<canvas>` fica "tainted" e todo `getImageData` lança.
>
> Custo: um download a mais, de até 10 MB, **só quando o caminho local já
> falhou** (§0.2, regra 2).
>
> **E se falhar dos dois lados**, o motivo sai com as duas metades
> (`arquivo local: … | storage: …`) — e aí a conclusão é mais forte e mais útil:
> o vídeo é indecodificável para aquele navegador, o que significa que ele
> **também não toca no feed** para quem usa o mesmo aparelho.

**Trava de deriva:** `src/lib/__tests__/relatoDeFalhaDeVideo.test.js` exige que
o nome do campo `falha_de_extracao` exista **nos dois lados** (cliente e Edge
Function), que a função continue aceitando corpo sem imagem, e que o ramo do
relato fique depois da checagem de dono. Deriva aqui não estoura em lugar
nenhum: o cliente dispara e descarta, então um campo renomeado de um lado vira
a função respondendo 400 para ninguém.

**Trava:** `lib/__tests__/moderacaoDeMidia.test.js` varre `src/` e exige que
todo arquivo que chama `moderateImages` também chame `moderateVideos` — salvo
os que aceitam só imagem, que precisam estar numa lista com o motivo e são
conferidos contra o `accept` do próprio input.

