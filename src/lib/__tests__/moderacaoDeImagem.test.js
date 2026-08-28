import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trava do bug de 28/08/2026: `too_many_images`.
 *
 * ── O que aconteceu ────────────────────────────────────────────────────────
 *
 * A `moderate-image` mandava as imagens do post todas de uma vez, num `input`
 * só. A API `omni-moderation-latest` aceita **uma imagem por requisição** e
 * respondia:
 *
 *     400 too_many_images — "Number of images (4) exceeds maximum of 1"
 *
 * O efeito não era degradação, era TUDO OU NADA: post de 1 imagem era
 * analisado; post de 2 ou mais **não era analisado de forma nenhuma**. E a
 * moderação de vídeo, que nasceu mandando vários quadros numa chamada só,
 * nunca funcionou um único dia.
 *
 * ── Por que ninguém percebeu ───────────────────────────────────────────────
 *
 * Porque o caminho é fire-and-forget: o site dispara e não espera resposta.
 * Do lado de quem publica, "moderação não achou nada" e "moderação nunca
 * rodou" são exatamente a mesma tela. O `gritar()` em `admin_logs` foi o que
 * tornou o bug visível — e mesmo assim ele só dizia "provedor não respondeu",
 * porque o 400 morria num `console.error` (§1.5, fonte 7).
 *
 * ── Por que um teste de contrato, e não um teste de unidade ────────────────
 *
 * O erro não estava numa lógica que dá para chamar de dentro do Vitest: estava
 * no FORMATO de uma requisição HTTP para um serviço externo, dentro de código
 * Deno. O que dá para travar é a forma como o corpo é montado no fonte — do
 * mesmo jeito que `tiposDeConteudo.test.js` confronta o mapa `FONTES` da
 * `moderate-text`.
 *
 * Provado injetando o bug de volta: com `input: urls.map(...)` no lugar, este
 * arquivo falha nomeando `too_many_images`.
 */

const EDGE = join(
  import.meta.dirname, '../../../supabase/functions/moderate-image/index.ts',
);

const fonte = readFileSync(EDGE, 'utf8');

/** O corpo da função que fala com a OpenAI. */
function corpoDoViaOpenAI() {
  const m = fonte.match(/async function viaOpenAI[\s\S]*?\n}/);
  return m ? m[0] : '';
}

/** Lê um dos mapas de piso (`OCULTA` / `SO_ENFILEIRA`) como `{categoria: nota}`. */
function pisos(nome) {
  const bloco = fonte.match(
    new RegExp(`const ${nome}: Record<string, number> = \\{([\\s\\S]*?)\\n\\};`),
  );
  if (!bloco) return null;
  return Object.fromEntries(
    [...bloco[1].matchAll(/"([^"]+)":\s*([\d.]+)/g)].map(m => [m[1], Number(m[2])]),
  );
}

describe('moderate-image — uma imagem por requisição da OpenAI', () => {
  const corpo = corpoDoViaOpenAI();

  it('acha a função (guarda contra o regex quebrar em silêncio)', () => {
    expect(corpo, 'não consegui ler viaOpenAI de moderate-image/index.ts').toContain('OPENAI_URL');
  });

  it('declara o limite de 1 imagem por requisição', () => {
    const m = fonte.match(/MAX_IMAGENS_POR_REQUISICAO\s*=\s*(\d+)/);
    expect(m, 'a constante que documenta o limite da API sumiu').not.toBeNull();
    expect(
      Number(m[1]),
      'A `omni-moderation-latest` aceita no máximo 1 imagem por chamada.\n'
      + 'Se a OpenAI passar a aceitar mais, mude aqui E no corpo da requisição —\n'
      + 'mudar só um dos dois é a deriva que este teste existe para pegar.',
    ).toBe(1);
  });

  it('monta o input a partir do LOTE, nunca da lista inteira de uma vez', () => {
    const linhaInput = corpo.match(/input:.*/)?.[0] ?? '';

    expect(
      linhaInput,
      'O `input` da moderação voltou a receber a lista de imagens de uma vez.\n'
      + 'A API responde 400 too_many_images e o post inteiro passa SEM ANÁLISE —\n'
      + 'não é análise pior, é análise nenhuma, e em silêncio.\n'
      + 'O certo é fatiar `urls` em lotes de MAX_IMAGENS_POR_REQUISICAO; a\n'
      + 'agregação por pior caso em `decidir()` dá o mesmo resultado final.',
    ).not.toMatch(/urls\.map/);

    expect(linhaInput, 'esperava o `input` montado a partir do lote').toMatch(/lote/);
  });

  it('fatia as URLs pelo tamanho declarado do lote', () => {
    expect(
      corpo,
      'Sem o laço, só a primeira imagem do post seria analisada. E o passo tem\n'
      + 'que ser a constante: um passo escrito à mão diverge dela no dia em que\n'
      + 'a API mudar (§4, fonte única).',
    ).toMatch(/i \+= MAX_IMAGENS_POR_REQUISICAO/);
    expect(corpo).toMatch(/urls\.slice\(i, i \+ MAX_IMAGENS_POR_REQUISICAO\)/);
  });

  it('trata "nenhuma imagem respondeu" como NÃO ANALISADO, não como limpo', () => {
    expect(
      corpo,
      'Devolver um veredito vazio aqui diria "analisei e está limpo" sobre imagem\n'
      + 'que ninguém olhou. Quem chama precisa receber `null` para gritar em\n'
      + '`admin_logs` (§1.5).',
    ).toMatch(/if\s*\(analisadas === 0\)\s*return null/);
  });

  it('a análise parcial vira aviso na trilha de auditoria', () => {
    expect(
      fonte,
      'Com uma requisição por imagem, 3 de 4 podem responder. Sem este aviso, a\n'
      + 'imagem que ficou de fora é indistinguível de imagem aprovada.',
    ).toMatch(/analise parcial/);
  });
});

/**
 * Trava da POLÍTICA de violência — o invariante de um site de jogos.
 *
 * Não é sobre qual número está certo: piso é decisão de produto e vai mudar
 * conforme a distribuição aparecer no log. É sobre a linha que não pode ser
 * cruzada por engano — **violência nunca oculta sozinha aqui**.
 *
 * Se `violence` ou `violence/graphic` acabar em `OCULTA`, o site começa a
 * derrubar print de jogo automaticamente, e o autor descobre pelo post
 * sumindo. Um `Ctrl+X` entre os dois mapas basta para isso acontecer sem
 * ninguém notar, porque nenhum teste roda a Edge Function.
 */
describe('moderate-image — política de violência num site de jogos', () => {
  const oculta = pisos('OCULTA');
  const soEnfileira = pisos('SO_ENFILEIRA');

  it('acha os dois mapas (guarda contra o regex quebrar em silêncio)', () => {
    expect(oculta, 'não consegui ler o mapa OCULTA').not.toBeNull();
    expect(soEnfileira, 'não consegui ler o mapa SO_ENFILEIRA').not.toBeNull();
  });

  it('NENHUMA categoria de violência oculta sozinha', () => {
    const violentas = Object.keys(oculta).filter(c => c.startsWith('violence'));

    expect(violentas, violentas.length
      ? 'Categoria de violência foi parar em OCULTA: ' + violentas.join(', ') + '\n'
        + 'Isto faz o site derrubar print de jogo AUTOMATICAMENTE, e o autor\n'
        + 'descobre pelo post sumindo. Nenhum modelo distingue gore de Doom de\n'
        + 'gore real — por isso violência SÓ ENFILEIRA neste projeto.\n'
        + 'Mova de volta para SO_ENFILEIRA.'
      : undefined).toEqual([]);
  });

  it('o que nunca é aceitável continua ocultando', () => {
    // O contrapeso do teste acima: afrouxar violência não pode virar desculpa
    // para afrouxar o resto. Estes três protegem menor de idade e automutilação.
    for (const cat of ['sexual/minors', 'self-harm', 'sexual']) {
      expect(
        oculta[cat],
        `${cat} saiu de OCULTA. Esta categoria oculta na hora, sem fila — é o `
        + 'único caso em que esperar uma pessoa olhar é caro demais.',
      ).toBeTypeOf('number');
    }
    expect(
      oculta['sexual/minors'],
      'o piso de sexual/minors é deliberadamente o mais baixo de todos',
    ).toBeLessThanOrEqual(0.10);
  });

  // `[28/08]` Achado no dia seguinte a passarmos a registrar todas as notas: a
  // OpenAI aplica `sexual/minors` só a TEXTO. Em imagem ela não devolve nota
  // nenhuma, então o piso de 0.10 aqui nunca disparou e nunca vai disparar.
  //
  // Não é brecha — `sexual` em 0.55 vale para imagem e oculta na hora, e é ele
  // que cobre esta classe. Mas é exatamente o tipo de configuração que "pode
  // silenciosamente nunca funcionar" (§1.5): quem lê o mapa conclui que há
  // detecção de menor em imagem, e há apenas o piso escrito.
  it('deixa explícito quais pisos de fato rodam em imagem', () => {
    const lista = fonte.match(/const CATEGORIAS_QUE_VALEM_EM_IMAGEM = \[([\s\S]*?)\]/);
    expect(
      lista,
      'A lista das categorias que a API aplica a IMAGEM sumiu. Sem ela, "o piso\n'
      + 'existe" e "o piso funciona" viram a mesma coisa aos olhos de quem lê —\n'
      + 'e foi assim que o `sexual/minors` passou meses parecendo ativo aqui.',
    ).not.toBeNull();

    // O que de fato protege esta classe em imagem tem que estar entre as que rodam.
    expect(
      lista[1],
      '`sexual` é o ÚNICO piso desta família que roda em imagem. Se ele sair do\n'
      + 'mapa ou desta lista, a classe fica sem cobertura nenhuma em imagem.',
    ).toContain('"sexual"');

    expect(
      fonte,
      'O aviso de que `sexual/minors` é text-only precisa continuar ao lado do\n'
      + 'piso. Sem ele o número de 0.10 parece proteção e não é, em imagem.',
    ).toMatch(/TEXT ONLY na API: inerte em imagem/);
  });

  it('registra as notas de todas as categorias observadas, passem ou não', () => {
    expect(
      fonte,
      'Sem isto as notas são calculadas e jogadas fora: o log só conta a\n'
      + 'categoria vencedora e o corpo da resposta é descartado pelo chamador.\n'
      + 'Aí ajustar piso volta a exigir sessão de teste manual em vez de leitura\n'
      + 'de log — foi exatamente o custo que a decisão de 28/08 pagou.',
    ).toMatch(/CATEGORIAS_OBSERVADAS/);

    const lista = fonte.match(/const CATEGORIAS_OBSERVADAS = \[([\s\S]*?)\]/);
    expect(lista, 'não consegui ler CATEGORIAS_OBSERVADAS').not.toBeNull();
    for (const cat of Object.keys({ ...oculta, ...soEnfileira })) {
      expect(
        lista[1],
        `${cat} decide alguma coisa e não é registrado no log. Toda categoria `
        + 'com piso precisa aparecer em CATEGORIAS_OBSERVADAS, senão não dá para '
        + 'saber por que ela disparou (ou por que não disparou).',
      ).toContain(cat);
    }
  });
});
