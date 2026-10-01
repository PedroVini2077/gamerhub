import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lerFeed, fatiaJusta } from '../../../supabase/functions/radar-de-pautas/rss.ts';
import {
  ORCAMENTO_DA_LISTA, montarPedido, resolverPautas,
  orcamentoDaLista, TPM_DO_PLANO, RESERVA_DE_SAIDA, CHARS_POR_TOKEN,
  RESUMO_PARA_O_MODELO, RESERVA_DE_RACIOCINIO, RESERVA_DA_RESPOSTA,
  TETO_DE_PAUTAS, TOKENS_POR_PAUTA,
} from '../../../supabase/functions/radar-de-pautas/pedido.ts';
import { INSTRUCAO } from '../../../supabase/functions/radar-de-pautas/contrato.ts';

/**
 * `[26/09]` O radar de pautas não pode inventar notícia nem fonte.
 *
 * ── Por que esta trava é diferente das outras de IA ───────────────────────
 *
 * A `redigir-materia` recusa trabalhar sem notas: o editor é obrigado a trazer
 * o fato. O radar **não pode** fazer isso — a função dele é justamente trazer
 * o fato. Então a garantia tem de vir de outro lugar: os fatos entram por RSS
 * de fontes cadastradas, e o modelo só reordena o que entrou.
 *
 * Isso cria uma superfície que a outra não tem: o modelo devolve **endereços**.
 * Nada impede um LLM de escrever `https://www.ign.com/noticia-plausivel` — e
 * uma URL inventada de um site conhecido é indistinguível de apuração, do lado
 * de quem lê. A guarda é conjunto fechado, e esta trava existe para ela.
 */

const CAMINHO = 'supabase/functions/radar-de-pautas/index.ts';
const FONTE = readFileSync(CAMINHO, 'utf8');

if (FONTE.length < 3000) {
  throw new Error(
    `${CAMINHO} tem ${FONTE.length} caracteres — pequeno demais para ser a funcao.\n`
    + '  Ela foi movida ou apagada? Sem esta guarda, as travas deste arquivo\n'
    + '  passariam verde sem ter lido uma linha do que vigiam.');
}

/** Monta um item como o que sai do RSS, com fonte e id. */
const item = (n, extra = {}) => ({
  titulo: `Manchete ${n}`,
  url: `https://fonte${n % 3}.com/noticia-${n}`,
  resumo: `resumo ${n} `.repeat(60).slice(0, 400),   // 400 chars, como o limpar()
  publicado_em: null,
  fonte_id: `f${n % 3}`,
  fonte_nome: `Fonte ${n % 3}`,
  ...extra,
});

describe('a fonte de cada pauta e REAL — e agora por CONSTRUCAO', () => {
  // ── A mudanca, e por que ela e mais forte do que o filtro antiga ─────────
  //
  // Antes: o modelo devolvia URLs e nos descartavamos as que nao estavam no
  // conjunto coletado. Funcionava — pegou 1 endereco inventado em producao,
  // em 28/09. Mas a garantia dependia do filtro existir e ser consultado.
  //
  // Agora: o modelo devolve NUMERO. Nao ha campo onde escrever um endereco, e
  // a URL sai do item que nos mesmos mandamos. Citar fonte que nao existe
  // deixou de ser algo que se filtra e passou a ser algo que nao cabe.

  const usados = [item(1), item(2), item(3)];

  it('resolve o numero no endereco REAL, e o modelo nao escreve endereco nenhum', () => {
    const { pautas, foraDaLista } = resolverPautas(
      { pautas: [{ titulo: 'T', angulo: 'A', editoria: 'gaming', por_que_agora: 'P', itens: [1, 3] }] },
      usados, 8,
    );
    expect(foraDaLista).toBe(0);
    expect(pautas[0].urls).toEqual([usados[0].url, usados[2].url]);
  });

  it('ignora QUALQUER endereco que o modelo tente mandar por fora', () => {
    // Se um dia o modelo resolver devolver `urls` apesar da instrucao, nada
    // disso pode chegar na tela: o resolvedor so olha `itens`.
    const { pautas } = resolverPautas({
      pautas: [{
        titulo: 'T', angulo: 'A', editoria: 'gaming', por_que_agora: 'P',
        itens: [2], urls: ['https://www.ign.com/noticia-que-nao-existe'],
      }],
    }, usados, 8);
    expect(pautas[0].urls, 'o endereco inventado entrou na resposta. Ele e '
      + 'indistinguivel de apuracao do lado de quem le.').toEqual([usados[1].url]);
  });

  it('numero fora da faixa, texto e lixo contam como fora da lista', () => {
    const { pautas, foraDaLista } = resolverPautas({
      pautas: [{ titulo: 'T', angulo: 'A', editoria: 'g', por_que_agora: 'p',
        itens: [1, 99, 0, -2, 'tres', null, 2.5] }],
    }, usados, 8);
    expect(foraDaLista, 'indice invalido passou como se fosse fonte').toBe(6);
    expect(pautas[0].urls).toEqual([usados[0].url]);
  });

  it('pauta que perdeu TODAS as fontes e DESCARTADA', () => {
    // Deixar passar seria pior do que nao ter guarda: ela chegaria na tela
    // com titulo e angulo, parecendo apurada, e sem nada que o editor
    // pudesse abrir para conferir.
    const { pautas, foraDaLista } = resolverPautas(
      { pautas: [{ titulo: 'Parece apurada', angulo: 'A', itens: [42] }] }, usados, 8,
    );
    expect(pautas).toEqual([]);
    expect(foraDaLista).toBe(1);
  });

  it('o mesmo numero citado duas vezes nao vira duas fontes', () => {
    const { pautas } = resolverPautas(
      { pautas: [{ titulo: 'T', angulo: 'A', itens: [2, 2, 2] }] }, usados, 8,
    );
    expect(pautas[0].urls).toHaveLength(1);
  });

  it('resposta sem `pautas`, nula ou com lixo nao estoura', () => {
    for (const r of [{}, null, { pautas: 'nao e lista' }, { pautas: [null, 7] }]) {
      expect(() => resolverPautas(r, usados, 8)).not.toThrow();
      expect(resolverPautas(r, usados, 8).pautas).toEqual([]);
    }
  });

  it('as NOTAS levam o resumo INTEIRO, nao o cortado que o modelo viu', () => {
    // O corte em 160 existe para o orcamento do pedido. As notas sao o que a
    // `redigir-materia` exige para escrever — cortar ali empobreceria o
    // rascunho por um motivo que nao tem nada a ver com ele.
    const { pautas } = resolverPautas({ pautas: [{ titulo: 'T', itens: [1] }] }, usados, 8);
    expect(usados[0].resumo.length).toBe(400);
    expect(pautas[0].notas).toContain(usados[0].resumo);
  });
});

describe('o ORCAMENTO do pedido — a trava do HTTP 413', () => {
  // ── O defeito que ela conserta, e ele esta MEDIDO em admin_logs ──────────
  //
  // O radar falhou em 7 de 7 chamadas entre 26 e 28/09. O corpo do erro da
  // Groq, gravado por `gritar()`:
  //
  //   "Request too large ... on tokens per minute (TPM): Limit 8000,
  //    Requested 9231, please reduce your message size"
  //
  // Nao era corpo HTTP grande demais: era o teto por MINUTO batido por uma
  // requisicao so — e a Groq soma o `max_tokens` ao que voce pediu.

  const estimarTokens = (chars) => Math.ceil(chars / CHARS_POR_TOKEN);

  it('o pedido INTEIRO cabe no teto por minuto, com folga', () => {
    const pedido = estimarTokens(INSTRUCAO.length + ORCAMENTO_DA_LISTA) + RESERVA_DE_SAIDA;
    expect(pedido, `o pedido maximo estimado e ${pedido} tokens e o teto do plano `
      + `e ${TPM_DO_PLANO}. A Groq responde HTTP 413 e o radar nao ordena nada — `
      + 'foi assim em 7 de 7 chamadas entre 26 e 28/09. Reduza RESERVA_DE_SAIDA, '
      + 'encurte a INSTRUCAO, ou baixe FOLGA em supabase/functions/radar-de-pautas/'
      + 'pedido.ts.').toBeLessThanOrEqual(TPM_DO_PLANO);
  });

  it('a lista NUNCA passa do orcamento, nem com item patologico', () => {
    // Fonte que comece a devolver resumo gigante nao pode derrubar o radar:
    // o certo e entrar menos item, nao estourar o pedido.
    const monstros = Array.from({ length: 200 }, (_, n) =>
      item(n, { titulo: 'T'.repeat(300), resumo: 'R'.repeat(400) }));
    const { lista, usados, chars } = montarPedido(monstros, ORCAMENTO_DA_LISTA);
    expect(chars).toBeLessThanOrEqual(ORCAMENTO_DA_LISTA);
    expect(lista.length).toBeLessThanOrEqual(ORCAMENTO_DA_LISTA);
    expect(usados.length).toBeGreaterThan(0);
  });

  it('`[01/10]` o PISO de itens que ainda cabe — e a troca que ele representa', () => {
    // ── Este numero MUDOU, e a mudanca e o custo de um conserto ───────────
    //
    // Era 60. Hoje sao ~54 no pior caso, porque a reserva de saida subiu de
    // 1.300 para 2.400 tokens: o `gpt-oss-120b` gasta a cadeia de pensamento
    // do MESMO teto, e com 1.300 ele as vezes nao sobrava espaco para
    // escrever a resposta — `json_validate_failed` com `failed_generation`
    // VAZIO. Ver `RESERVA_DE_RACIOCINIO`.
    //
    // A troca e deliberada: 54 manchetes com a IA funcionando valem mais do
    // que 60 com ela falhando de forma intermitente. Parte do custo foi
    // recuperada corrigindo `CHARS_POR_TOKEN` de 3,6 para o medido (4,3).
    //
    // ── Por que 50 e o piso, e nao um numero redondo qualquer ─────────────
    //
    // Sao 15 fontes ativas e a `fatiaJusta` faz rodizio entre elas. Abaixo de
    // 50 cada fonte contribui com menos de 4 manchetes, e a leitura editorial
    // passa a decidir sobre uma amostra fina demais para agrupar assunto
    // repetido — que e a razao de o modelo estar nessa etapa.
    const PISO = 50;

    // Pior caso de propósito: TODO resumo no limite de 160 que o modelo ve.
    // O conteudo real e mais curto (242 chars por linha, medidos), entao o
    // numero de verdade fica acima deste.
    const pessimistas = Array.from({ length: 80 }, (_, n) =>
      item(n, { titulo: 'T'.repeat(77), resumo: 'R'.repeat(400) }));
    const { usados } = montarPedido(pessimistas, ORCAMENTO_DA_LISTA);

    expect(usados.length, `o orcamento passou a caber so ${usados.length} manchetes, `
      + `abaixo do piso de ${PISO}. Alguem subiu RESERVA_DE_SAIDA ou a INSTRUCAO `
      + 'cresceu. Com 15 fontes em rodizio, menos de 50 itens da menos de 4 por '
      + 'fonte — fino demais para o modelo agrupar assunto repetido, que e a '
      + 'razao de ele estar nessa etapa.').toBeGreaterThanOrEqual(PISO);
  });

  it('`[01/10]` a RESPOSTA cabe nas pautas que o modelo vai escrever', () => {
    // ── A trava que faltava, e a falta dela me custou DUAS rodadas ───────
    //
    //   1a  max_tokens 1.300 -> failed_generation VAZIO
    //       o raciocinio comeu tudo antes de o modelo escrever
    //   2a  max_tokens 2.400 -> failed_generation TRUNCADO:
    //       `{"pautas":[{"titulo":"Nintendo lanca bundle... EA Spor`
    //       o raciocinio coube, a RESPOSTA nao
    //
    // Nos dois casos eu tinha uma conta na cabeca e nenhuma no teste. A
    // relacao `reserva >= pautas x custo da pauta` e o que faltava: ela
    // transforma "eu acho que cabe" em conta conferida a cada `npm test`.
    const precisa = TETO_DE_PAUTAS * TOKENS_POR_PAUTA;
    expect(RESERVA_DA_RESPOSTA, `a reserva da resposta (${RESERVA_DA_RESPOSTA}) nao `
      + `cobre ${TETO_DE_PAUTAS} pautas a ${TOKENS_POR_PAUTA} tokens = ${precisa}.\n\n`
      + '  O modelo comeca a escrever e o `max_tokens` acaba NO MEIO do JSON.\n'
      + '  A Groq devolve HTTP 400 `json_validate_failed` com um\n'
      + '  `failed_generation` cortado — foi assim em 01/10, com 8 pautas e\n'
      + '  1.000 de reserva.\n\n'
      + '  Quem subir TETO_DE_PAUTAS tem de subir RESERVA_DA_RESPOSTA junto.')
      .toBeGreaterThanOrEqual(precisa);
  });

  it('`[01/10]` a reserva de saida cobre RESPOSTA + RACIOCINIO', () => {
    // A regressao de 01/10, virada trava. `max_tokens` na Groq cobre os dois,
    // e o `gpt-oss-120b` gasta 300-900 tokens pensando ANTES de escrever.
    // Quem baixar isto de novo quebra o radar de um jeito INTERMITENTE, que e
    // o mais caro de diagnosticar.
    expect(RESERVA_DE_SAIDA, `a reserva de saida (${RESERVA_DE_SAIDA}) nao cobre mais `
      + `a resposta (${RESERVA_DA_RESPOSTA}) mais o raciocinio (${RESERVA_DE_RACIOCINIO}).\n\n`
      + '  O `gpt-oss-120b` e modelo de RACIOCINIO: a cadeia de pensamento sai\n'
      + '  do MESMO `max_tokens` da resposta. Sem espaco para os dois, o\n'
      + '  `content` volta VAZIO e a Groq recusa com HTTP 400\n'
      + '  `json_validate_failed` / `failed_generation: ""`.\n\n'
      + '  Foi exatamente isso em 01/10, depois de eu baixar para 1.300.')
      .toBeGreaterThanOrEqual(RESERVA_DA_RESPOSTA + RESERVA_DE_RACIOCINIO);
  });

  it('a numeracao e contigua a partir de 1 — e e ela que resolve o endereco', () => {
    // Se a numeracao da lista nao bater com o indice de `usados`, o modelo
    // cita o item 5 e nos devolvemos a fonte do 7. Nada estoura: sai uma
    // pauta com fonte real que nao sustenta ela. E o pior caso possivel.
    const { lista, usados } = montarPedido([item(1), item(2), item(3)], ORCAMENTO_DA_LISTA);
    usados.forEach((u, i) => {
      expect(lista).toContain(`${i + 1}. [${u.fonte_nome}] ${u.titulo}`);
    });
    const { pautas } = resolverPautas({ pautas: [{ titulo: 'T', itens: [2] }] }, usados, 8);
    expect(pautas[0].urls).toEqual([usados[1].url]);
  });

  it('a lista NAO leva endereco — era 6.027 dos 27.310 chars medidos', () => {
    const { lista } = montarPedido([item(1), item(2)], ORCAMENTO_DA_LISTA);
    expect(lista, 'a URL voltou para a lista. Alem de inflar o pedido, ela '
      + 'ensina o modelo a escrever endereco — que e exatamente o que o '
      + 'formato por numero existe para impedir.').not.toMatch(/https?:\/\//);
  });

  it('o resumo vai CORTADO para o modelo', () => {
    const { lista } = montarPedido([item(1, { resumo: 'R'.repeat(400) })], ORCAMENTO_DA_LISTA);
    expect(lista).toContain('R'.repeat(RESUMO_PARA_O_MODELO));
    expect(lista).not.toContain('R'.repeat(RESUMO_PARA_O_MODELO + 1));
  });

  it('o orcamento e DERIVADO: instrucao maior encolhe a lista', () => {
    // Se alguem dobrar a instrucao e o orcamento nao reagir, o pedido volta a
    // estourar — e o numero escrito a mao envelheceria calado.
    expect(orcamentoDaLista(INSTRUCAO.repeat(4)))
      .toBeLessThan(orcamentoDaLista(INSTRUCAO));
  });
});

describe('`[01/10]` o corpo da resposta nunca perde campo no caminho de FALHA', () => {
  // ── A tela MENTIA, e o print dele mostrou ────────────────────────────────
  //
  //     "170 manchetes de 0 fontes"   <- com TREZE fontes funcionando
  //
  // So o retorno de sucesso carregava `fontes`. Os cinco caminhos de falha
  // nao, e o cliente faz `?? 0`. E a classe "dois lugares que precisam
  // concordar" do §4, na forma mais traicoeira: o caminho feliz esta certo,
  // entao o defeito so aparece quando ja houve outro problema.

  it('toda resposta com `status` passa pelo montador unico', () => {
    // As respostas de porta fechada (401/403/502/503) ficam de fora de
    // proposito: elas acontecem ANTES de haver coleta, entao `coletados` e
    // `fontes` nem existem. O recorte e "depois que a coleta aconteceu".
    const depoisDaColeta = FONTE.slice(FONTE.indexOf('const corpo = ('));
    const soltas = [...depoisDaColeta.matchAll(/return responder\(\{[^)]*?status:/gs)];

    expect(soltas.length, 'apareceu um `return responder({ status: ... })` montado '
      + 'a mao depois da coleta. Ele vai esquecer `fontes` como os cinco '
      + 'anteriores esqueceram, e a tela volta a dizer "0 fontes" com treze '
      + 'funcionando. Use `responder(corpo({ ... }))`.').toBe(0);
  });

  it('o montador inclui os campos que a TELA le', () => {
    const montador = FONTE.slice(FONTE.indexOf('const corpo = ('),
                                 FONTE.indexOf('const corpo = (') + 400);
    for (const campo of ['coletados', 'fontes', 'comFalha', 'pautas']) {
      expect(montador, `o montador perdeu \`${campo}\`, que o cliente le com `
        + '`?? 0` ou `?? []` — some em silencio e a tela mostra numero errado')
        .toMatch(new RegExp(`\\b${campo}\\b`));
    }
  });
});

describe('a porta e o pedido', () => {
  it('exige `is_staff()`, nao so estar logado', () => {
    expect(FONTE).toMatch(/rpc\(\s*"is_staff"\s*\)/);
    expect(FONTE).toMatch(/ehEquipe\s*!==\s*true[\s\S]{0,200}?403/);
  });

  it('a instrucao proibe assunto fora da lista, e manda citar por NUMERO', () => {
    expect(INSTRUCAO).toMatch(/SOMENTE com as manchetes da lista/);
    expect(INSTRUCAO, 'a instrucao parou de mandar citar por numero. O modelo '
      + 'volta a escrever endereco, e o resolvedor descarta tudo em silencio — '
      + 'o radar passa a devolver zero pauta sem dizer por que.')
      .toMatch(/Cite cada manchete pelo NUMERO/);
    expect(INSTRUCAO).toMatch(/Nao escreva enderecos/);
  });

  it('`[01/10]` a coleta esta no modulo proprio, e nao de volta aqui', () => {
    // Esta checagem MUDOU, e a razao e que a trava antiga acusou certo.
    //
    // Ela exigia `comFalha.push(` dentro do `index.ts`, e reprovou quando a
    // Fase 1 moveu a coleta para `coleta.ts`. A garantia nao sumiu — mudou de
    // casa —, mas um grep nao sabe a diferenca entre "mudou de casa" e
    // "sumiu", e esse e exatamente o limite da forma mais fraca da tabela do
    // §2.
    //
    // A garantia de verdade ("fonte que falha nao derruba as outras") passou
    // a ser provada por EXECUCAO, em `radarColetaDeDuasFontes.test.js`, que
    // chama `coletarTudo` com um coletor quebrado e confere que o outro
    // entregou. Repetir o grep aqui criaria duas fontes de verdade para a
    // mesma regra (§4) — e a mais fraca venceria, porque falha primeiro.
    //
    // O que sobra para esta linha e o que so o `index.ts` pode responder:
    // que ele DELEGA, em vez de ter trazido a coleta de volta para dentro.
    expect(FONTE, 'a coleta voltou para dentro do index.ts. Ela saiu de la na '
      + 'Fase 1 por dois motivos: o limite de 300 linhas do §4, e porque dentro '
      + 'do `Deno.serve` nenhum teste a alcancava.').toMatch(/coletarTudo\(/);
    expect(FONTE, 'o index.ts voltou a montar `comFalha` por conta propria — '
      + 'agora ha duas listas de falha e elas vao divergir')
      .not.toMatch(/comFalha\.push\(/);
  });

  it('`[01/10]` o pedido usa json_schema ESTRITO, e pede raciocinio BAIXO', () => {
    // As duas linhas que o 400 de 01/10 produziu. `strict: false` nao serve:
    // a doc da Groq diz que ele "pode produzir JSON valido que nao casa com o
    // esquema" e "as vezes disparar erro 400" — seria trocar o problema por
    // ele mesmo.
    expect(FONTE, 'o `response_format` voltou para `json_object`, que garante '
      + 'SINTAXE e nao FORMA').toMatch(/type:\s*"json_schema"/);
    expect(FONTE, 'o `reasoning_effort` sumiu. Sem ele a cadeia de pensamento '
      + 'do gpt-oss-120b volta a comer o `max_tokens` da resposta, e o HTTP 400 '
      + '`json_validate_failed` com `failed_generation` vazio volta junto.')
      .toMatch(/reasoning_effort:\s*"low"/);
  });

  it('`[01/10]` o esquema exige INTEIRO em `itens`, e e estrito', () => {
    const CONTRATO = readFileSync('supabase/functions/radar-de-pautas/contrato.ts', 'utf8');
    // Se `itens` virar `string`, o modelo pode voltar a mandar endereco por
    // dentro de um campo que era para ser so indice.
    expect(CONTRATO).toMatch(/itens:\s*\{\s*type:\s*"array",\s*items:\s*\{\s*type:\s*"integer"/);
    expect(CONTRATO, '`strict: true` sumiu — sem ele a Groq usa melhor-esforco, '
      + 'que a propria doc diz que pode nao casar com o esquema')
      .toMatch(/strict:\s*true/);
    expect(CONTRATO, '`additionalProperties: false` e `required` sao EXIGIDOS '
      + 'pelo modo estrito da Groq; sem eles a chamada e recusada')
      .toMatch(/additionalProperties:\s*false/);

    // ── `enum` NAO e proibido; `enum` de EDITORIA e ───────────────────
    //
    // `[01/10]` Esta checagem MUDOU, e a mudanca e deliberada. Ela dizia
    // "nenhum `enum`", e a Fase 2 trouxe um legitimo. A regra real nunca foi
    // sobre `enum` — e sobre QUANTAS COPIAS do vocabulario existem:
    //
    //   editoria        banco (CHECK) + tela + aqui = TRES. Um `enum` aqui
    //                   divergiria no dia da 10a editoria, impedindo o modelo
    //                   de produzi-la EM SILENCIO.
    //   confiabilidade  aqui + tela = DUAS, e nenhuma no banco. O `enum` e o
    //                   que impede o modelo de inventar rotulo que a tela nao
    //                   sabe desenhar.
    //
    // Afrouxar para "nenhum enum" OU para "enum liberado" erraria metade dos
    // casos. A checagem agora e sobre o par certo.
    const campoEditoria = CONTRATO.match(/editoria:\s*\{[^}]*\}/)?.[0] ?? '';
    expect(campoEditoria, 'a `editoria` ganhou um `enum`. Ela ja vive no CHECK '
      + 'do banco e no vocabulario da tela: uma 3a copia diverge no dia da 10a '
      + 'editoria, e o esquema passa a IMPEDIR o modelo de produzi-la sem que '
      + 'nada acuse.').not.toMatch(/enum/);

    expect(CONTRATO, 'o `enum` da confiabilidade virou lista literal. Ele tem '
      + 'de vir de `CONFIABILIDADE`, senao o esquema e a tela passam a ter '
      + 'listas proprias e divergem na primeira classificacao nova.')
      .toMatch(/confiabilidade:\s*\{[^}]*enum:\s*\[\.\.\.CONFIABILIDADE\]/);
  });
});

describe('o leitor de RSS', () => {
  const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item>
      <title><![CDATA[Jogo X ganha data de lançamento]]></title>
      <link>https://exemplo.com/jogo-x</link>
      <description>&lt;p&gt;O estúdio anunciou &amp;amp; confirmou.&lt;/p&gt;</description>
      <pubDate>Fri, 26 Sep 2026 10:00:00 GMT</pubDate>
    </item>
    <item><title>Sem link</title><description>nada</description></item>
    <item><title>Link relativo</title><link>/interno</link></item>
  </channel></rss>`;

  const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>Console Y baixa de preço</title>
      <link href="https://exemplo.org/console-y" rel="alternate"/>
      <summary>Corte de 20% anunciado.</summary>
      <updated>2026-09-26T09:00:00Z</updated>
    </entry>
  </feed>`;

  it('le RSS 2.0, com CDATA e entidade', () => {
    const [primeiro] = lerFeed(RSS);
    expect(primeiro.titulo).toBe('Jogo X ganha data de lançamento');
    expect(primeiro.url).toBe('https://exemplo.com/jogo-x');
    // CDATA desfeito, tag removida, entidade resolvida — nessa ordem.
    expect(primeiro.resumo).toBe('O estúdio anunciou & confirmou.');
    expect(primeiro.publicado_em).toMatch(/^2026-09-26T/);
  });

  it('le Atom, onde o link e ATRIBUTO e nao conteudo', () => {
    // Os dois formatos convivem entre as 12 fontes. Ler so RSS deixaria as
    // de Atom devolvendo zero item — em silencio, porque feed vazio e um
    // estado legitimo.
    const [e] = lerFeed(ATOM);
    expect(e.titulo).toBe('Console Y baixa de preço');
    expect(e.url).toBe('https://exemplo.org/console-y');
  });

  it('descarta item sem endereco ABSOLUTO, e nao o inventa', () => {
    // Item sem link ou com link relativo viraria pauta sem fonte abrivel.
    // Completar a URL com o dominio do feed seria adivinhar.
    const urls = lerFeed(RSS).map((i) => i.url);
    expect(urls).toEqual(['https://exemplo.com/jogo-x']);
  });

  it('feed quebrado devolve lista vazia em vez de estourar', () => {
    expect(lerFeed('isto nao e xml')).toEqual([]);
    expect(lerFeed('')).toEqual([]);
  });

  it('respeita o teto de itens por feed', () => {
    const muitos = `<rss>${'<item><title>t</title><link>https://a.com/x</link></item>'.repeat(40)}</rss>`;
    expect(lerFeed(muitos, 15)).toHaveLength(15);
  });
});

describe('a fatia que vai ao modelo e JUSTA entre as fontes', () => {
  // O defeito era `slice(0, 60)` sobre uma lista preenchida na ordem em que o
  // `Promise.all` termina: as fontes RAPIDAS comiam as vagas das boas. Nada
  // estourava — a resposta saia plausivel, so mais pobre.
  const criar = (fonte, n) => Array.from({ length: n }, (_, i) => ({ fonte, i }));

  it('a fonte GRANDE nao engole a vaga da pequena', () => {
    const itens = [...criar('gigante', 100), ...criar('pequena', 3)];
    const fatia = fatiaJusta(itens, (x) => x.fonte, 10);

    const daPequena = fatia.filter((x) => x.fonte === 'pequena').length;
    expect(daPequena, 'a fonte pequena perdeu lugar para a grande. Era o bug: '
      + 'Eurogamer e RPS devolvem 100 itens cada, e tres fontes rapidas podiam '
      + 'ocupar as 60 vagas antes de as outras dez chegarem.').toBe(3);
    expect(fatia).toHaveLength(10);
  });

  it('os PRIMEIROS de cada fonte vem primeiro — sao os mais recentes', () => {
    const itens = [...criar('a', 5), ...criar('b', 5), ...criar('c', 5)];
    const fatia = fatiaJusta(itens, (x) => x.fonte, 6);
    // rodizio: a0 b0 c0 a1 b1 c1 — e nao a0 a1 a2 a3 a4 b0
    expect(fatia.map((x) => `${x.fonte}${x.i}`)).toEqual(['a0', 'b0', 'c0', 'a1', 'b1', 'c1']);
  });

  it('nao gira para sempre quando ha menos itens que o teto', () => {
    // Sem a saida do laco isto travaria a Edge Function — e travar e pior do
    // que devolver pouco.
    expect(fatiaJusta(criar('a', 2), (x) => x.fonte, 50)).toHaveLength(2);
    expect(fatiaJusta([], (x) => x.fonte, 50)).toEqual([]);
    expect(fatiaJusta(criar('a', 9), (x) => x.fonte, 0)).toEqual([]);
  });
});
