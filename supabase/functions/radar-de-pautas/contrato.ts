// O CONTRATO COM O MODELO — o que pedimos, e que forma a resposta tem.
//
// `[01/10]` Saiu do `pedido.ts` quando o `json_schema` entrou: aquele arquivo
// responde "quanto cabe" e este responde "o que é", e os dois juntos passavam
// de 300 linhas (§4). A instrução e o esquema ficam no MESMO arquivo de
// propósito — eles descrevem a mesma resposta por dois meios, e separá-los
// seria convidar os dois a divergirem.

/**
 * `[01/10]` FASE 2 — a CONFIABILIDADE, e o que ela NÃO promete.
 *
 * ── O que o modelo pode honestamente dizer ────────────────────────────────
 *
 * Ele vê título e 160 caracteres de resumo. **Classificar "confirmado" a
 * partir disso é afirmar sobre o mundo com base numa manchete** — a mesma
 * família do endereço inventado que o formato por número fechou.
 *
 * Então a classificação descreve **o que a MANCHETE AFIRMA**, não o que é
 * verdade. "Rumor: estúdio X adiaria Y" é `rumor` porque a manchete se
 * apresenta como rumor, e não porque o modelo apurou. Isso está dito na
 * instrução, está no nome do campo na tela, e é o motivo de a tela escrever
 * *"como a manchete se apresenta"* ao lado do selo.
 *
 * ── Por que QUATRO e não os seis do plano ─────────────────────────────────
 *
 * O plano define seis, incluindo `tendencia` ("aumento de atenção") e
 * `discussao` ("comunidade falando"). **Nenhuma fonte de hoje produz esses
 * dois:** as quinze são veículo jornalístico. Pôr os seis no vocabulário
 * criaria dois valores que nada alcança — código morto por construção, e a
 * tela desenharia selo para caso que nunca chega.
 *
 * Eles entram na **Fase 3**, junto com Trends e comunidade, que é de onde
 * vêm. A regra do plano — *"`tendencia` e `discussao` nunca viram `relato`
 * por acumulação"* — fica para quando houver o que acumular.
 */
export const CONFIABILIDADE = [
  "confirmado",  // a manchete relata anúncio oficial, lançamento, dado divulgado
  "relato",      // o veículo relata como fato apurado, sem citar oficialidade
  "rumor",       // a manchete se apresenta como rumor, boato ou "segundo fontes"
  "vazamento",   // a manchete relata material vazado, leak, arquivo encontrado
] as const;

export const INSTRUCAO = `Voce e o editor de pauta do GamerHub News, um site brasileiro sobre
games, tecnologia e cultura geek.

Voce recebe uma lista NUMERADA de manchetes coletadas HOJE dos feeds que a
equipe assina. Seu trabalho e LER essa lista e dizer o que vale virar materia.

REGRA NUMERO UM:
Trabalhe SOMENTE com as manchetes da lista. Nao acrescente assunto que nao
esteja nela e nao complete com o que voce sabe de outro lugar. Voce nao tem
internet e nao sabe o que aconteceu hoje — quem sabe e a lista.
Cite cada manchete pelo NUMERO dela. Nao escreva enderecos: eu ja os tenho.

O QUE FAZER:
- Junte manchetes que falam do MESMO assunto numa pauta so, citando o numero
  de todas elas. Assunto coberto por varias fontes e mais forte, nao mais fraco.
- Descarte o que nao interessa a um publico gamer brasileiro.
- Ordene da mais relevante para a menos.
- Para cada pauta escreva um angulo: o que o GamerHub tem a dizer sobre aquilo
  que nao e so repetir a manchete.
- Classifique a CONFIABILIDADE pelo que a MANCHETE AFIRMA, nunca pelo que voce
  sabe de outro lugar. Voce esta lendo manchete, nao apurando: se o texto se
  apresenta como rumor, e rumor, mesmo que voce ache que e verdade.

RESPONDA SOMENTE COM UM JSON, sem texto antes nem depois:
{"pautas":[{"titulo":"...","angulo":"...","editoria":"...","por_que_agora":"...","confiabilidade":"relato","termos":["..."],"itens":[1,2]}]}

titulo        um titulo em portugues, ate 90 caracteres, factual, sem caca-clique
angulo        1 a 2 frases: o recorte que o GamerHub daria
editoria      uma de: gaming, esports, hardware, mobile, playstation, xbox, nintendo, pc, cultura
por_que_agora 1 frase curta dizendo por que isso e assunto hoje
confiabilidade uma de:
              confirmado  a manchete relata anuncio oficial, lancamento ou dado divulgado
              relato      o veiculo relata como fato apurado, sem citar oficialidade
              rumor       a manchete se apresenta como rumor, boato ou "segundo fontes"
              vazamento   a manchete relata material vazado, leak ou arquivo encontrado
termos        1 a 3 termos CURTOS que identificam este assunto, para eu medir
              se ele esta crescendo no nosso historico. Use o NOME PROPRIO que
              aparece na manchete — do jogo, do console, do estudio, do
              produto. NAO use palavra generica como "jogo", "lancamento" ou
              "noticia": ela casa com tudo e o sinal perde o sentido.
itens         os NUMEROS da lista que sustentam a pauta, do mais direto ao menos`;

// Derivado da instrucao acima — ver `pedido.ts` para o porque de cada parcela.

/**
 * `[01/10]` O CONTRATO DA RESPOSTA — `json_schema` estrito, não `json_object`.
 *
 * ── A diferença entre os dois, e ela importa aqui ──────────────────────────
 *
 * `json_object` garante **sintaxe**: o que voltar é JSON válido. Não garante
 * forma nenhuma — `{"pautas": "oi"}` passa, e `{"itens": ["três"]}` também.
 * Hoje quem absorve isso é o `resolverPautas`, com `Number.parseInt` e
 * contagem de `foraDaLista`.
 *
 * `json_schema` com `strict: true` garante **a forma**, e a documentação da
 * Groq lista o `gpt-oss-120b` explicitamente entre os que o suportam. O modo
 * `strict: false` NÃO serve: a própria doc diz que ele *"pode produzir JSON
 * válido que não casa com o esquema"* e *"às vezes produzir JSON malformado
 * ou disparar erro 400"* — seria trocar um problema por ele mesmo.
 *
 * ── O que isto NÃO conserta, e é importante dizer ──────────────────────────
 *
 * **Não é isto que mata o `json_validate_failed`.** Aquilo é falta de espaço
 * para o raciocínio (ver `RESERVA_DE_RACIOCINIO`), e um esquema mais rígido
 * não cria token nenhum. Entra junto porque fecha uma classe vizinha: hoje o
 * modelo PODE devolver `itens` com texto dentro, e nós consertamos no
 * servidor; com o esquema ele não consegue.
 *
 * As guardas do `resolverPautas` **ficam todas**. Esquema é promessa do
 * fornecedor; índice fora da faixa continua sendo descartado e contado aqui.
 *
 * ── Por que `editoria` NÃO tem `enum`, de propósito ────────────────────────
 *
 * Seria fácil listar as 9 aqui e o modelo nunca erraria. Mas as editorias já
 * vivem em dois lugares que precisam concordar — o `CHECK` do banco e o
 * vocabulário da tela —, e `vocabularioDoNewsNaoDeriva.test.js` existe
 * justamente para travar esse par.
 *
 * Uma terceira cópia aqui divergiria no dia em que nascesse a 10ª editoria: o
 * esquema impediria o modelo de produzi-la, **em silêncio**, e ninguém ligaria
 * o sintoma à causa. A tela já trata editoria desconhecida (ela só usa a que
 * reconhece e deixa o editor escolher). O valor do `strict` aqui é a FORMA —
 * `itens` ser lista de inteiros —, não o vocabulário.
 */
export const ESQUEMA_DA_RESPOSTA = {
  name: "pautas_do_radar",
  strict: true,
  schema: {
    type: "object",
    properties: {
      pautas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo:        { type: "string" },
            angulo:        { type: "string" },
            editoria:      { type: "string" },
            por_que_agora: { type: "string" },
            // `[01/10]` AQUI o `enum` é certo, e a diferença para a `editoria`
            // é só uma: a confiabilidade **não existe no banco**. São duas
            // cópias (este arquivo e a tela), não três, e
            // `vocabularioDoRadarNaoDeriva` confere as duas. Sem o enum, o
            // modelo inventaria rótulo e a tela mostraria selo desconhecido.
            confiabilidade: { type: "string", enum: [...CONFIABILIDADE] },
            // `[01/10]` FASE 3: as palavras com que eu procuro este assunto no
            // nosso historico. Vem do MODELO porque ele entende o texto;
            // extrator de termo em portugues escrito por mim seria fragil
            // ("de", "do", "para") e o sinal sairia errado em silencio.
            termos: { type: "array", items: { type: "string" } },
            // O coracao do contrato: INTEIROS, nunca texto. E o que impede o
            // modelo de voltar a escrever endereco por outro caminho.
            itens:         { type: "array", items: { type: "integer" } },
          },
          // `strict: true` exige os dois: todo campo em `required`, e
          // `additionalProperties: false`. Documentado pela Groq.
          required: ["titulo", "angulo", "editoria", "por_que_agora", "confiabilidade", "termos", "itens"],
          additionalProperties: false,
        },
      },
    },
    required: ["pautas"],
    additionalProperties: false,
  },
} as const;
