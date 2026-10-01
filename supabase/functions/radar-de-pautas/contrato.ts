// O CONTRATO COM O MODELO — o que pedimos, e que forma a resposta tem.
//
// `[01/10]` Saiu do `pedido.ts` quando o `json_schema` entrou: aquele arquivo
// responde "quanto cabe" e este responde "o que é", e os dois juntos passavam
// de 300 linhas (§4). A instrução e o esquema ficam no MESMO arquivo de
// propósito — eles descrevem a mesma resposta por dois meios, e separá-los
// seria convidar os dois a divergirem.

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

RESPONDA SOMENTE COM UM JSON, sem texto antes nem depois:
{"pautas":[{"titulo":"...","angulo":"...","editoria":"...","por_que_agora":"...","itens":[1,2]}]}

titulo        um titulo em portugues, ate 90 caracteres, factual, sem caca-clique
angulo        1 a 2 frases: o recorte que o GamerHub daria
editoria      uma de: gaming, esports, hardware, mobile, playstation, xbox, nintendo, pc, cultura
por_que_agora 1 frase curta dizendo por que isso e assunto hoje
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
            // O coracao do contrato: INTEIROS, nunca texto. E o que impede o
            // modelo de voltar a escrever endereco por outro caminho.
            itens:         { type: "array", items: { type: "integer" } },
          },
          // `strict: true` exige os dois: todo campo em `required`, e
          // `additionalProperties: false`. Documentado pela Groq.
          required: ["titulo", "angulo", "editoria", "por_que_agora", "itens"],
          additionalProperties: false,
        },
      },
    },
    required: ["pautas"],
    additionalProperties: false,
  },
} as const;
