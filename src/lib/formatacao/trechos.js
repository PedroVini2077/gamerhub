/**
 * `[08/10]` AS MARCAÇÕES DE TRECHO — e por que isto deixou de ser regex.
 *
 * ── O bug que originou este arquivo, medido antes de tocar em nada ─────────
 *
 * O dono relatou: *"sempre que NEGRITO e ITÁLICO aparecem aninhados um dentro
 * do outro, existe conflito... nos dois sentidos"*, e que numa combinação de
 * `__` com `~~` os til apareciam **literalmente na tela**.
 *
 * Rodando o analisador sobre a matriz inteira, antes de qualquer correção:
 *
 *   pares aninhados (12)            10 OK · 2 FALHA   -> só negrito↔itálico
 *   três e quatro recursos (48)      8 OK · 40 FALHA
 *
 * ── A causa raiz tem DUAS metades, e consertar uma só não resolve ──────────
 *
 * **(1) A classe de conteúdo excluía o próprio delimitador.** O negrito era uma
 * regex cujo miolo era `[^*\n]+` — ou seja, proibia `*` no meio. Então
 * `**a *b* c**` NUNCA poderia casar como negrito: o conteúdo tem um asterisco.
 * Negrito contendo itálico era impossível por construção.
 *
 * **(2) O itálico casava ATRAVESSANDO metade de um `**`.** Esta é a que
 * explica o relato do `~~` literal, e eu não a tinha previsto. Em
 * `*a~~a**azb**b~~b*` a regex de itálico abre no `*` do início, corre até o
 * PRIMEIRO `*` do `**`, e fecha ali — porque o `(?!\w)` dela aceita `*` como
 * próximo caractere. O resultado era:
 *
 *   italico["a~~a"] + italico["azb"] + italico["b~~b"]
 *
 * Os `~~` não "falharam": eles ficaram **órfãos dentro de um itálico que não
 * deveria existir**. O texto inteiro se desalinha a partir do primeiro erro.
 *
 * ── Por que a saída não é "melhorar a regex" ──────────────────────────────
 *
 * Delimitador SIMÉTRICO aninhado não é linguagem regular com lookaround: para
 * saber onde `**` fecha é preciso **percorrer** e decidir, a cada posição, se
 * aquele `*` pertence a um `**` ou é um itálico. Uma regex que tentasse isso
 * seria ilegível e continuaria errando no caso seguinte.
 *
 * Aqui é um varredor: acha a abertura mais à ESQUERDA, procura o fechamento
 * correspondente pulando o que não serve, e **recorre no conteúdo**. O
 * aninhamento sai de graça, em qualquer profundidade e em qualquer ordem.
 *
 * ── O que foi preservado de propósito, e está medido na trava ──────────────
 *
 * Todo o comportamento de delimitador inválido ou literal: `**sem fechar`,
 * `2 * 3 * 4`, `a*b*c`, `***tres***`, `****quatro****`, `~~~tres til~~~`,
 * `snake_case_aqui`. Nada disso muda — e nada some da tela, que é a regra
 * mais importante deste subsistema.
 *
 * **Uma única mudança deliberada:** `__a_b__` passou de texto literal para
 * sublinhado de `a_b`. Pela regra velha, `_` no meio impedia o casamento; pela
 * nova, o par externo casa e o `_` solto é conteúdo. É o comportamento certo —
 * e é o mesmo motivo que fazia negrito não aceitar itálico dentro.
 */

import { corValida, tamanhoValido } from './vocabulario';

/**
 * Delimitadores simétricos, **do mais longo para o mais curto**.
 *
 * `**` antes de `*` não é detalhe: na mesma posição, o mais longo tem de ganhar,
 * senão `**x**` abriria como itálico e sobraria asterisco.
 *
 * `palavra: true` carrega as duas guardas que só o itálico tem — ele não abre
 * depois de letra nem fecha antes dela, para `a*b*c` e `snake_case` não virarem
 * marcação. `__` e `~~` nunca tiveram essa guarda e continuam sem.
 */
const SIMETRICOS = [
  { tipo: 'negrito', marca: '**' },
  { tipo: 'sublinhado', marca: '__' },
  { tipo: 'tachado', marca: '~~' },
  { tipo: 'italico', marca: '*', palavra: true },
];

/**
 * Marcações com abertura e fechamento DIFERENTES. Estas continuam em regex, e
 * com razão: colchete não é ambíguo — `[cor=x]` nunca pode ser confundido com
 * `[/cor]`, então o problema que obrigou o varredor não existe aqui.
 */
const COLCHETES = [
  { tipo: 'cor', re: /\[cor=([a-z]+)\]([\s\S]*?)\[\/cor\]/ },
  { tipo: 'tamanho', re: /\[tamanho=([a-z]+)\]([\s\S]*?)\[\/tamanho\]/ },
  // Link: só a forma explícita `[texto](url)`. URL solta no meio do texto NÃO
  // vira link — decidir por conta própria o que é endereço em entrada de
  // usuário é como brecha nasce (ver `lib/url.js`).
  { tipo: 'link', re: /\[([^\]\n]+)\]\(([^)\s]+)\)/ },
];

const ESPACO = /\s/;
const PALAVRA = /\w/;

/** Quantos caracteres do marcador sobraram como TEXTO na árvore. */
function sobraramLiterais(nos, caractere) {
  let quantos = 0;
  for (const no of nos) {
    if (no.tipo === 'texto') {
      for (const c of no.valor) if (c === caractere) quantos += 1;
    } else if (no.filhos) {
      quantos += sobraramLiterais(no.filhos, caractere);
    }
  }
  return quantos;
}

/** O tamanho da sequência de `caractere` que começa em `j`. */
function tamanhoDoRun(texto, j, caractere) {
  let n = 0;
  while (texto[j + n] === caractere) n += 1;
  return n;
}

/**
 * O fechamento de `marca` a partir de `desde`, ou `-1`.
 *
 * ── `[08/10]` O BUG DO RUN ADJACENTE, e por que ele exigiu mudar a escolha ──
 *
 * `**Negrito com *itálico***` saía como `negrito["Negrito com *itálico"] + "*"`:
 * um asterisco literal na tela e o itálico perdido. Os três asteriscos do fim
 * são **dois fechamentos colados** — um do itálico e um do negrito —, e a
 * versão anterior pegava sempre os da ESQUERDA.
 *
 * Ela estava pegando os caracteres errados: quem abriu por ÚLTIMO fecha
 * PRIMEIRO, então o itálico leva o asterisco da esquerda e o negrito leva os
 * dois da direita. Pegar da esquerda deixava o itálico sem par.
 *
 * ── Como a escolha é feita, e por que não é contagem ────────────────────────
 *
 * A tentação era contar delimitadores pendentes dentro do conteúdo. Medido:
 * não funciona, porque abertura que NUNCA fecha conta igual — `__a_b__` tem um
 * `_` solto no meio, e a contagem o trataria como pendente, recusando um
 * fechamento legítimo.
 *
 * O critério que funciona é o resultado, não a contagem: para cada corte
 * possível do run, **analisa o conteúdo e conta quantos caracteres do marcador
 * SOBRARAM como texto**. Zero sobra é o corte certo. É a mesma pergunta que o
 * dono fez olhando a tela — *"apareceram asteriscos literais"* — só que feita
 * pelo parser antes de desenhar.
 *
 * ── A reserva, e o caso que ela protege ─────────────────────────────────────
 *
 * Nem todo texto consegue zerar: `**a 2 * 3 b**` tem um asterisco que é
 * multiplicação, e ele SOBRA de propósito. Por isso o primeiro candidato viável
 * fica guardado como reserva e é usado quando nenhum zera — senão a conta do
 * autor faria o negrito inteiro desaparecer.
 *
 * E a reserva só vale depois de varrer o resto: em `*a **b** c*` o run do meio
 * não zera (ele é o fechamento do negrito, não do itálico) e o do fim zera.
 * Devolver a reserva cedo demais fecharia o itálico dentro do negrito.
 *
 * ── As recusas que vieram de antes, cada uma com um caso real ───────────────
 *
 * - **quebra de linha encerra a busca.** As regexes antigas usavam `[^…\n]+`,
 *   ou seja, marcação nunca atravessou linha. Mantido: `**a` numa linha e `b**`
 *   na seguinte continua sendo texto.
 * - **fechamento colado em espaço não fecha.** Mesma regra do CommonMark que já
 *   existia nos lookarounds: `*a *` não marca nada.
 * - **itálico não fecha antes de letra.** `a*b*c` continua sendo texto.
 */
function acharFechamento(texto, { marca, palavra }, desde) {
  const caractere = marca[0];
  let reserva = -1;

  for (let j = desde + 1; j < texto.length; j += 1) {
    if (texto[j] === '\n') break;
    if (texto[j] !== caractere) continue;

    const run = tamanhoDoRun(texto, j, caractere);
    const ultimo = j + run - 1;
    // Run curto demais, ou colado em espaço: não fecha nada. O `j = ultimo`
    // pula o run inteiro — sem isso, o caractere seguinte seria testado como
    // se fosse o começo de outro run.
    if (run < marca.length || ESPACO.test(texto[j - 1])) { j = ultimo; continue; }

    // Os cortes possíveis: quantos caracteres do run ficam para os
    // delimitadores de dentro, que abriram depois e fecham antes.
    let melhor = null;
    for (let sobra = 0; sobra <= run - marca.length; sobra += 1) {
      const fim = j + sobra;
      if (palavra && PALAVRA.test(texto[fim + marca.length] ?? '')) continue;
      const nota = sobraramLiterais(analisarTrechos(texto.slice(desde, fim)), caractere);
      if (melhor === null || nota < melhor.nota) melhor = { fim, nota };
      if (nota === 0) break;
    }

    if (melhor?.nota === 0) return melhor.fim;
    if (melhor && reserva === -1) reserva = melhor.fim;
    j = ultimo;
  }

  return reserva;
}

/**
 * A marcação simétrica que abre mais à ESQUERDA, ou `null`.
 *
 * A guarda que parece estranha e não é: **abertura seguida do mesmo caractere
 * da marca é pulada**. Ela é o que preserva `***tres***` e `****quatro****`
 * exatamente como eram antes — o `**` de fora não abre porque o próximo
 * caractere também é `*`, e quem acaba abrindo é o par colado ao texto. Sem
 * ela, o conteúdo sairia como `*tres` dentro do negrito.
 */
function acharSimetrico(texto) {
  for (let i = 0; i < texto.length; i += 1) {
    for (const d of SIMETRICOS) {
      if (!texto.startsWith(d.marca, i)) continue;

      const ini = i + d.marca.length;
      const apos = texto[ini];
      if (apos === undefined || ESPACO.test(apos)) continue;
      if (apos === d.marca[0]) continue;
      if (d.palavra && PALAVRA.test(texto[i - 1] ?? '')) continue;

      const fim = acharFechamento(texto, d, ini);
      if (fim === -1) continue;

      return {
        tipo: d.tipo,
        indice: i,
        conteudo: texto.slice(ini, fim),
        termina: fim + d.marca.length,
      };
    }
  }
  return null;
}

/**
 * Quebra um texto simples nos trechos marcados. Devolve nós de linha.
 *
 * A ordem é sempre **a do texto**, nunca a da lista de marcações: a que
 * aparecer primeiro vence. Sem isso a saída dependeria de como as regras foram
 * escritas, e um itálico no começo seria ignorado por um negrito no fim.
 */
export function analisarTrechos(texto) {
  if (!texto) return [];

  let melhor = acharSimetrico(texto);

  for (const { tipo, re } of COLCHETES) {
    const m = re.exec(texto);
    if (!m) continue;
    if (melhor && m.index >= melhor.indice) continue;
    melhor = {
      tipo,
      indice: m.index,
      termina: m.index + m[0].length,
      bruto: m,
    };
  }

  if (!melhor) return [{ tipo: 'texto', valor: texto }];

  const antes = texto.slice(0, melhor.indice);
  const depois = texto.slice(melhor.termina);

  let no;
  if (melhor.tipo === 'link') {
    no = { tipo: 'link', texto: melhor.bruto[1], url: melhor.bruto[2] };
  } else if (melhor.tipo === 'cor' || melhor.tipo === 'tamanho') {
    const nome = melhor.bruto[1];
    const conhecido = melhor.tipo === 'cor' ? corValida(nome) : tamanhoValido(nome);
    // Nome fora do vocabulário NÃO vira estilo e NÃO some: o trecho inteiro
    // volta a ser texto, com a marcação à mostra. Escolher um valor por conta
    // própria aqui seria o fallback silencioso que o §4 proíbe.
    no = conhecido
      ? { tipo: melhor.tipo, nome, filhos: analisarTrechos(melhor.bruto[2]) }
      : { tipo: 'texto', valor: melhor.bruto[0] };
  } else {
    // Recursão no CONTEÚDO da marca. Ela termina porque o conteúdo é sempre
    // menor que a entrada — os delimitadores saíram.
    no = { tipo: melhor.tipo, filhos: analisarTrechos(melhor.conteudo) };
  }

  return [
    ...(antes ? analisarTrechos(antes) : []),
    no,
    ...(depois ? analisarTrechos(depois) : []),
  ];
}
