import { describe, it, expect } from 'vitest';
import { analisarFormatacao } from '../analisar';

/**
 * `[08/10]` AS MARCAÇÕES ANINHADAS, E O SEPARADOR DE SEÇÃO.
 *
 * ── O bug, medido antes de tocar em nada ──────────────────────────────────
 *
 * O dono relatou conflito entre negrito e itálico aninhados, "nos dois
 * sentidos", e `~~` aparecendo literalmente na tela numa combinação com `__`.
 * Rodando a matriz contra o analisador de então:
 *
 *   pares aninhados (12)          10 OK ·  2 FALHA
 *   três e quatro recursos (48)    8 OK · 40 FALHA
 *
 * ── Por que uma MATRIZ, e não os casos relatados ──────────────────────────
 *
 * Porque consertar os dois exemplos dele deixaria 38 quebrados. O relato era a
 * ponta: a causa raiz atingia toda combinação que misturasse `*` com qualquer
 * outra coisa. A matriz é a varredura de CLASSE do §1.3 aplicada a um bug —
 * *"onde mais esse mesmo padrão existe?"*.
 *
 * Ela é gerada, não escrita à mão: 12 pares + 24 ordens de três + 24 de quatro.
 * Escrever 60 casos na mão garantiria esquecer alguns, e justamente os
 * esquecidos seriam os que ninguém testou antes.
 *
 * ── A armadilha que eu mesmo caí ao montar isto ───────────────────────────
 *
 * A primeira versão do gerador escrevia `*a...b*` SEM espaço, e 15 casos
 * "falharam". Não era o parser: `a*azb*b` é o mesmo caso de `a*b*c`, que NÃO
 * pode virar itálico e nunca pôde. **O defeito estava na minha fixture**, e eu
 * quase corrigi um parser correto. Por isso o gerador abaixo separa com espaço,
 * e por isso existe o bloco "o que NÃO pode virar marcação" logo depois: sem
 * ele, alguém "consertaria" o parser para fazer a matriz passar.
 */

const MARCAS = { negrito: '**', italico: '*', sublinhado: '__', tachado: '~~' };
const NOMES = Object.keys(MARCAS);

/** Todas as permutações de uma lista — as 24 ordens de quatro recursos. */
function ordens(lista) {
  if (lista.length <= 1) return [lista];
  return lista.flatMap((x, i) => ordens([...lista.slice(0, i), ...lista.slice(i + 1)])
    .map((resto) => [x, ...resto]));
}

/**
 * Monta o texto aninhado com os fechamentos SEPARADOS por texto.
 *
 * O ESPAÇO em volta do miolo não é estética: sem ele, o itálico encosta em
 * letra e é recusado de propósito (`a*b*c`).
 */
function aninharSeparado(nomes) {
  let texto = 'miolo';
  for (let i = nomes.length - 1; i >= 0; i -= 1) {
    const m = MARCAS[nomes[i]];
    texto = `${m}a ${texto} b${m}`;
  }
  return texto;
}

/**
 * `[08/10]` O mesmo aninhamento com os fechamentos COLADOS — e esta é a forma
 * que o defeito exigia.
 *
 * ── Por que a matriz de 60 casos não pegou nada ────────────────────────────
 *
 * Porque o gerador acima escreve `b` antes de todo fechamento. Com um `b` no
 * meio, os delimitadores nunca ficam adjacentes, e **nenhum dos 60 casos
 * produzia um `***`** — que é exatamente onde o parser errava.
 *
 * O dono escreveu `**Negrito com *itálico***` num post de verdade e o site
 * mostrou um asterisco literal. A matriz, verde, nunca tinha escrito aquilo.
 *
 * **A lição não é "faltava um caso": é que o gerador escolhia a forma fácil.**
 * Texto real cola marcação em pontuação e em outra marcação; teste gerado com
 * separador no meio exercita a gramática pelo lado que não dói.
 */
function aninharColado(nomes) {
  let texto = 'miolo';
  for (let i = nomes.length - 1; i >= 0; i -= 1) {
    const m = MARCAS[nomes[i]];
    texto = `${m}a ${texto}${m}`;
  }
  return texto;
}

/** Os tipos presentes na árvore, de cima para baixo. */
function tipos(nos, achados = new Set()) {
  for (const no of nos) {
    if (no.tipo !== 'texto') achados.add(no.tipo);
    if (no.filhos) tipos(no.filhos, achados);
  }
  return achados;
}

/** Todo o texto puro da árvore — onde delimitador órfão apareceria. */
function texto(nos) {
  return nos.map((n) => (n.tipo === 'texto' ? n.valor : texto(n.filhos ?? []))).join('');
}

function arvore(entrada) {
  const blocos = analisarFormatacao(entrada);
  return blocos.flatMap((b) => b.filhos ?? []);
}

describe('marcação aninhada funciona em qualquer ordem e profundidade', () => {
  const combinacoes = [
    ...ordens(NOMES).map((o) => o.slice(0, 2)).filter((o, i, t) =>
      t.findIndex((x) => x.join() === o.join()) === i),
    ...[['negrito', 'italico', 'sublinhado'], ['negrito', 'italico', 'tachado'],
      ['negrito', 'sublinhado', 'tachado'], ['italico', 'sublinhado', 'tachado']]
      .flatMap((c) => ordens(c)),
    ...ordens(NOMES),
  ];

  // Cada combinação é testada nas DUAS formas: com os fechamentos separados por
  // texto e com eles COLADOS. A segunda é a que faltava.
  const casos = combinacoes.flatMap((c) => [
    [`${c.join(' > ')} — fechamentos separados`, c, aninharSeparado],
    [`${c.join(' > ')} — fechamentos COLADOS`, c, aninharColado],
  ]);

  it.each(casos)('%s', (_rotulo, nomes, montar) => {
    const entrada = montar(nomes);
    const nos = arvore(entrada);
    const presentes = tipos(nos);

    const faltando = nomes.filter((n) => !presentes.has(n));
    expect(faltando, [
      `A marcação aninhada ${nomes.join(' > ')} não foi reconhecida inteira.`,
      `Entrada:  ${JSON.stringify(entrada)}`,
      `Faltou:   ${faltando.join(', ')}`,
      '',
      'Era este o bug de 08/10, e ele tinha DUAS metades: a classe de conteúdo',
      'excluía o próprio delimitador (negrito não podia conter itálico), e a',
      'regex de itálico casava atravessando metade de um `**`, desalinhando o',
      'resto do texto. Ver `src/lib/formatacao/trechos.js`.',
    ].join('\n')).toEqual([]);

    // A segunda metade do bug aparecia assim: o delimitador NÃO sumia e NÃO
    // marcava — ficava órfão no meio do texto, visível para quem lê o post.
    const cru = texto(nos);
    expect(/[*_~]/.test(cru), [
      `Sobrou delimitador como TEXTO em ${nomes.join(' > ')}.`,
      `Entrada: ${JSON.stringify(entrada)}`,
      `Texto que chegaria na tela: ${JSON.stringify(cru)}`,
      '',
      'Foi exatamente isto que o dono viu e relatou como "os ~~ apareceram',
      'literalmente": eles não falharam sozinhos — ficaram órfãos dentro de um',
      'itálico que não deveria existir.',
    ].join('\n')).toBe(false);
  });
});

describe('os casos do post real — fechamentos colados (08/10)', () => {
  /**
   * O defeito que o dono viu no feed, na URL do post de teste. A frase
   * publicada era, literalmente:
   *
   *     **Negrito com *itálico***; *itálico com **negrito***.
   *
   * O primeiro saía como `negrito["Negrito com *itálico"] + "*"` — asterisco
   * literal na tela e itálico perdido. O segundo funcionava **por acidente**:
   * o guard que pulava `**` ao procurar fechamento de `*` caía, por sorte, na
   * posição certa. Os dois estão aqui para que nenhum volte a depender de sorte.
   */

  /** O caminho de tipos até o nó mais fundo, para checar a HIERARQUIA. */
  function caminho(nos) {
    for (const no of nos) {
      if (no.tipo === 'texto') continue;
      return [no.tipo, ...(no.filhos ? caminho(no.filhos) : [])];
    }
    return [];
  }

  /** O texto visível de um tipo de nó, onde quer que ele esteja. */
  function conteudoDe(nos, tipo) {
    for (const no of nos) {
      if (no.tipo === tipo) return texto(no.filhos ?? []);
      if (no.filhos) {
        const achado = conteudoDe(no.filhos, tipo);
        if (achado !== null) return achado;
      }
    }
    return null;
  }

  const CASOS = [
    ['A — negrito envolvendo itálico', '**Negrito com *itálico***',
      ['negrito', 'italico'], 'Negrito com itálico', 'itálico', ''],
    ['B — itálico envolvendo negrito', '*Itálico com **negrito***',
      ['italico', 'negrito'], 'Itálico com negrito', 'negrito', ''],
  ];

  it.each(CASOS)('%s', (_r, entrada, hierarquia, fora, dentro, cauda) => {
    const nos = arvore(entrada);

    expect(caminho(nos), [
      `A hierarquia de ${JSON.stringify(entrada)} saiu errada.`,
      'O de FORA tem de envolver o de DENTRO — se os dois virarem irmãos, o',
      'texto continua legível e a ênfase fica no lugar errado.',
    ].join('\n')).toEqual(hierarquia);

    expect(conteudoDe(nos, hierarquia[0]), 'o trecho externo perdeu ou ganhou texto.')
      .toBe(fora);
    expect(conteudoDe(nos, hierarquia[1]), 'o trecho interno não é só o que devia ser.')
      .toBe(dentro);

    expect(texto(nos).replace(fora, ''), [
      `Sobrou marcador como TEXTO em ${JSON.stringify(entrada)}.`,
      'Era isto que aparecia na tela do feed: um asterisco solto depois do',
      'negrito, porque o fechamento pegou os caracteres da ESQUERDA do run.',
    ].join('\n')).toBe(cauda);
  });

  // A pontuação não pode mudar a associação dos marcadores — ela fica FORA do
  // trecho formatado, como o autor escreveu.
  const PONTUACAO = ['.', ',', ';', ':', ')', '!', '?', '...'];

  it.each(PONTUACAO)('pontuação %s depois do fechamento fica de fora', (p) => {
    for (const [, entrada, hierarquia, fora] of CASOS) {
      const nos = arvore(entrada + p);
      expect(caminho(nos), `${JSON.stringify(entrada + p)} mudou a hierarquia.`)
        .toEqual(hierarquia);
      expect(conteudoDe(nos, hierarquia[0]), `${JSON.stringify(p)} entrou no trecho formatado.`)
        .toBe(fora);
      expect(texto(nos).endsWith(p), `${JSON.stringify(p)} sumiu do fim.`).toBe(true);
    }
  });

  it('entre parênteses, os dois lados ficam de fora', () => {
    const nos = arvore('(**Negrito com *itálico***)');
    expect(caminho(nos)).toEqual(['negrito', 'italico']);
    expect(texto(nos)).toBe('(Negrito com itálico)');
  });

  it('marcador que NÃO fecha nada continua dentro do trecho formatado', () => {
    // `[08/10]` Esta entrou por reinjeção: apagar a "reserva" de
    // `acharFechamento` não quebrava NENHUM teste, e ela é o que impede o
    // conteúdo de desaparecer quando nenhum corte zera.
    //
    // Aqui o asterisco do meio é MULTIPLICAÇÃO — ele sobra de propósito, e
    // nenhum corte do run final consegue zerar a conta. Sem a reserva o
    // negrito inteiro deixa de existir e a frase vira texto cru.
    const nos = arvore('**a 2 * 3 b**');
    expect(tipos(nos), 'o negrito sumiu porque o conteúdo tinha um asterisco literal.')
      .toEqual(new Set(['negrito']));
    expect(texto(nos), 'a conta do autor foi alterada.').toBe('a 2 * 3 b');
  });

  it('a frase INTEIRA do post, com os dois casos na mesma linha', () => {
    const nos = arvore('**Negrito com *itálico***; *itálico com **negrito***.');
    expect(texto(nos), 'o texto visível mudou — sobrou ou sumiu caractere.')
      .toBe('Negrito com itálico; itálico com negrito.');
    expect(tipos(nos)).toEqual(new Set(['negrito', 'italico']));
  });
});

describe('o que NÃO pode virar marcação continua não virando', () => {
  // Este bloco existe para o conserto do aninhamento não ser feito às custas
  // do resto. Todos foram MEDIDOS no parser antigo antes da mudança: é o
  // comportamento que estava certo e tinha de sobreviver.
  const literais = [
    ['abertura sem fechamento', '**sem fechar'],
    ['fechamento sem abertura', 'sem abrir**'],
    ['multiplicação', '2 * 3 * 4'],
    ['asterisco no meio da palavra', 'a*b*c'],
    ['snake_case', 'snake_case_aqui'],
    // `[08/10]` Este entrou DEPOIS, porque a reinjeção mostrou que a guarda
    // de abertura do itálico não estava coberta: `a*b*c` é pego pela guarda
    // de FECHAMENTO (o `c` depois do `*`), então removê-la não quebrava nada.
    // Aqui o fechamento é legítimo e só a abertura recusa.
    ['itálico colado em palavra à esquerda', 'texto*enfase final*'],
    // `[08/10]` Os dois abaixo também entraram por reinjeção: remover a
    // guarda de espaço no fechamento, e a que impede a marcação de
    // atravessar linha, não quebrava NENHUM teste. As duas vinham dos
    // lookarounds e do `[^…\n]` das regexes antigas — comportamento que o
    // varredor tinha de herdar, e que ninguém estava verificando.
    ['fechamento colado em espaço', '*a *'],
    ['marcação não atravessa linha', '**a\nb**'],
  ];

  it.each(literais)('%s', (_rotulo, entrada) => {
    const cru = texto(arvore(entrada));
    expect(cru, [
      `${JSON.stringify(entrada)} deixou de aparecer como o autor escreveu.`,
      'Texto não reconhecido CONTINUA VISÍVEL é a regra mais importante deste',
      'subsistema: o site comendo o que a pessoa digitou, sem dizer nada, é pior',
      'do que não formatar (§1.5).',
    ].join('\n')).toBe(entrada);
  });

  // Estes três não voltam como o texto original — eles marcam o miolo e deixam
  // o resto à mostra. O que importa é que nada SUMIU.
  it.each([['***tres***'], ['****quatro****'], ['~~~tres til~~~']])(
    'runs de três e quatro: %s não perde caractere', (entrada) => {
      const nos = arvore(entrada);
      const visivel = texto(nos);
      expect(entrada.includes(visivel.replace(/[*~]/g, '') || 'x')).toBe(true);
      expect(tipos(nos).size, `${entrada} deixou de marcar o miolo.`).toBeGreaterThan(0);
    },
  );
});

describe('separador de seção — `---` sozinho numa linha', () => {
  const tiposDe = (t, o) => analisarFormatacao(t, o).map((b) => b.tipo).join('|');

  const regras = [
    ['vira régua entre dois blocos', 'a\n---\nb', 'paragrafo|separador|paragrafo'],
    ['no meio da frase continua texto', 'a --- b', 'paragrafo'],
    ['dois hífens não contam', 'a\n--\nb', 'paragrafo'],
    ['quatro hífens não contam', 'a\n----\nb', 'paragrafo'],
    ['espaço em volta é tolerado', 'a\n  ---  \nb', 'paragrafo|separador|paragrafo'],
    ['consecutivos viram um', 'a\n---\n---\n---\nb', 'paragrafo|separador|paragrafo'],
    ['no começo é descartado', '---\na', 'paragrafo'],
    ['no fim é descartado', 'a\n---', 'paragrafo'],
    ['sozinho não produz nada', '---', ''],
    ['entre parágrafos', 'p1\n\n---\n\np2', 'paragrafo|separador|paragrafo'],
    ['entre listas', '- i\n---\n- j', 'lista|separador|lista'],
    ['entre citações', '> c\n---\n> d', 'citacao|separador|citacao'],
    ['item de lista `- --` continua lista', '- --', 'lista'],
  ];

  it.each(regras)('%s', (_rotulo, entrada, esperado) => {
    expect(tiposDe(entrada), [
      `A regra do separador mudou para ${JSON.stringify(entrada)}.`,
      'As bordas foram decididas uma a uma em 08/10 e estão no cabeçalho de',
      '`analisar.js`. "Exatamente três" é o que impede travessão digitado à mão',
      '(`--`) e decoração (`----`) de virarem elemento visual sem querer.',
    ].join('\n')).toBe(esperado);
  });

  it('o COMENTÁRIO não ganha separador, e o `---` dele continua texto', () => {
    // O corte é pedido dele: comentário é conversa curta. A falha aqui seria
    // muda — a régua simplesmente apareceria onde não devia.
    expect(tiposDe('a\n---\nb', { separador: false })).toBe('paragrafo');
    const cru = texto(analisarFormatacao('a\n---\nb', { separador: false })
      .flatMap((b) => b.filhos ?? []));
    expect(cru, 'o `---` do comentário sumiu em vez de continuar texto.').toContain('---');
  });

  it('o separador LIGA por omissão — esquecer mostra, não esconde', () => {
    // Entre duas falhas, a visível é melhor: post perdendo o recurso em
    // silêncio é §1.5; comentário mostrando uma régua é inócuo e óbvio.
    expect(tiposDe('a\n---\nb')).toBe('paragrafo|separador|paragrafo');
  });
});
