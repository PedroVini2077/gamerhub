# `[17/09]` As 8 Edge Functions no ar — e uma delas não compilava

## O que destravou

O dono gerou um *Personal Access Token* do Supabase e me passou. Com ele,
`npx supabase functions deploy` implanta **do disco** — sem eu retranscrever
~2.100 linhas de código de produção numa chamada de ferramenta, que era o
motivo de eu ter parado em 10/09.

> **O token foi usado e precisa ser trocado.** Ele foi colado no chat em texto
> puro, e um PAT dá acesso de gerência ao projeto inteiro. Não entrou em arquivo
> nenhum do repositório — ficou num arquivo temporário da sessão, fora da árvore
> do git. Mesmo assim, o certo é revogar e gerar outro.

## O resultado

```
antes:  OK cleanup-orphans · DIVERGE nas outras 7
depois: OK nas 8
```

**Pela primeira vez o que roda em produção é o que está no repositório** —
inclusive as duas correções da `send-email` que estavam mortas desde 10/09.

## 🔴 O achado: `moderate-text` não compilava, e estava assim no repositório

A quarta implantação **falhou**, e a mensagem era de sintaxe:

```
Failed to bundle the function (reason: The module's source code could not be
parsed: Expected ',', got 'IMPRESSAO_DESTE_CODIGO' at index.ts:15:7
```

O arquivo estava assim:

```ts
import {

// A impressao deste codigo...
const IMPRESSAO_DESTE_CODIGO = "89ad5d8ab21747fb";
  DIAL_PADRAO, viaOpenAI, viaHuggingFace, type Decisao,
} from "./politica.ts";
```

A constante da impressão tinha sido posta **dentro de um `import` de várias
linhas**, partindo o import ao meio.

### A causa raiz, e ela NÃO é o script

A primeira hipótese óbvia é que o `scripts/impressao-das-edges.mjs` inseriu no
lugar errado. **Fui ler, e não foi:**

```js
function gravar(nome) {
  const antes = readFileSync(caminho, 'utf8');
  if (!LINHA.test(antes)) return false;   // <- nao existe? nao faz nada
  const depois = antes.replace(LINHA, `const ${NOME} = "${novo}";`);
```

Ele **só substitui** uma linha que já existe — não insere e não move. Então a
constante foi colocada **à mão**, numa sessão anterior, no lugar errado. O
script apenas continuou reescrevendo o valor de uma linha que estava num lugar
inválido, sem nunca perguntar se o arquivo ainda era código.

### Por que NENHUM portão pegou — e esta é a parte que importa

| Portão | Por que passou |
| --- | --- |
| `npm run build` | o Vite compila `src/`. `supabase/functions/` roda em **Deno** e não entra no build |
| `npm run lint` | o ESLint do projeto não cobre essa pasta |
| `npm test` | nenhum teste **lia** esses arquivos como código |
| `impressaoDasEdges.test.js` | compara **hash de texto** — e texto quebrado tem hash igual a texto válido |
| `npm run edges` | pergunta a impressão à função **no ar**. A do ar era a versão velha e sã |

O repositório carregava um arquivo inválido com **tudo verde**, e o único motivo
de ninguém notar era que ele **nunca tinha sido implantado**. No dia em que
fosse, quebraria — e foi exatamente o que aconteceu.

É a mesma família do §1.5: a informação existia, e não chegava a lugar nenhum.

## A trava — `scripts/__tests__/edgeFunctionsParseiam.test.js`

Duas asserções, e as duas provadas reinjetando **o bug original, na letra**:

| Asserção | O que pega |
| --- | --- |
| todo arquivo de `supabase/functions/` **parseia** | o caso geral: qualquer erro de sintaxe, em qualquer arquivo da pasta |
| a constante fica no **nível de cima** | o caso específico que aconteceu, com mensagem que diz o que fazer |

A segunda existe porque *"Expected ',', got 'IMPRESSAO_DESTE_CODIGO'"* é verdade
mas não ensina: quem esbarrar nela daqui a seis meses precisa saber que o script
**não move** a constante, e que foi edição manual que a pôs ali.

### Como ela parseia sem dependência nova, e o caminho que eu descartei MEDINDO

Primeira tentativa: `node --experimental-strip-types --check`. **Devolveu exit 0
no arquivo quebrado** — não parseia TypeScript de verdade nesse modo. Portão que
aprova o caso exato que existe para pegar é pior do que portão nenhum, então foi
descartado.

Segunda: `vm.SourceTextModule`. Funciona, mas exige a flag
`--experimental-vm-modules`, que o vitest não liga — e a guarda que eu tinha
escrito reprovou dizendo isso, em vez de passar calada.

O que ficou: **`module.stripTypeScriptTypes`**. Para *tirar* os tipos ele
precisa **parsear**, e num arquivo inválido ele lança
`ERR_INVALID_TYPESCRIPT_SYNTAX` — com a mesma frase que o Supabase devolveu.
Sem dependência nova, sem flag: `node:module` é do próprio Node.

## Validação

- `npm run edges`: **8/8 OK** contra o ambiente real
- `npm run impressao-edges`: 1 impressão atualizada (a da `moderate-text`, que
  mudou porque o arquivo mudou)
- 674 testes verdes · build limpo · lint 0 erros
