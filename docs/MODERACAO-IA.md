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
> **O que ainda falta:** confirmar a causa. O próximo vídeo publicado vai
> mostrar o aviso na tela, e aí sabemos se é extração vazia ou outra coisa.

**Falha de extração grita.** Vídeo corrompido ou de codec desconhecido devolve
lista vazia, e lista vazia é tratada como **"não analisado"**, nunca como
"analisado e limpo": vai para o Sentry via `registrarErro`. Sem isso seria
silêncio absoluto — a mesma forma de falha que manteve a moderação por IA
quebrada em 26 de 26 chamadas.

**Trava:** `lib/__tests__/moderacaoDeMidia.test.js` varre `src/` e exige que
todo arquivo que chama `moderateImages` também chame `moderateVideos` — salvo
os que aceitam só imagem, que precisam estar numa lista com o motivo e são
conferidos contra o `accept` do próprio input.

