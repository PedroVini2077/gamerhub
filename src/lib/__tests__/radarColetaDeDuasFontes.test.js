import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  lerGdelt, dataDaGdelt, coletarDasApis,
  ESPACO_ENTRE_CONSULTAS_MS, TETO_DE_CONSULTAS, TIMEOUT_DA_CONSULTA_MS,
} from '../../../supabase/functions/radar-de-pautas/gdelt.ts';
import { coletarTudo } from '../../../supabase/functions/radar-de-pautas/coleta.ts';
import { lerFeed } from '../../../supabase/functions/radar-de-pautas/rss.ts';

/**
 * `[01/10]` FASE 1 do radar: a segunda fonte de coleta.
 *
 * ── O que a fase entrega, e o que ela arrisca ─────────────────────────────
 *
 * O radar respondia *"o que as 13 fontes que escolhemos publicaram?"*. Um feed
 * só enxerga o próprio site, então ele nunca responde *"o que saiu FORA das
 * minhas fontes"* — que é a pergunta do dono. A GDELT indexa notícia do mundo
 * inteiro, de graça e sem chave.
 *
 * O risco que ela traz é de uma família que este projeto já conhece: **um
 * coletor novo que falha calado derruba ou empobrece o que já funcionava**.
 * Por isso as três perguntas aqui são de falha, não de sucesso.
 *
 * ── A exigência do dono que esta trava transforma em máquina ──────────────
 *
 * *"Não crie lógica específica, palavras-chave hardcoded, fontes especiais,
 * pesos especiais ou tratamento especial para GTA, Rockstar, Marvel, Avengers
 * ou qualquer outro assunto... Por favor, valide explicitamente durante a
 * implementação que nenhuma parte da solução ficou dependente"*.
 *
 * "Validei durante a implementação" é promessa que envelhece no próximo PR.
 * O último bloco daqui **varre o código** e reprova se algum assunto aparecer.
 */

const PASTA = 'supabase/functions/radar-de-pautas';
const ARQUIVOS = readdirSync(PASTA).filter((n) => n.endsWith('.ts'));

describe('o leitor da GDELT nao estoura com o que ela realmente devolve', () => {
  // Ela responde de TRÊS jeitos, e dois não são JSON. Um `JSON.parse` solto
  // derrubaria a coleta do RSS junto — o critério 6 da Fase 1 proíbe.
  it('le a resposta normal', () => {
    const corpo = JSON.stringify({ articles: [
      { url: 'https://exemplo.com/a', title: 'Titulo  com   espaco', seendate: '20261001T134500Z' },
      { url: 'https://exemplo.org/b', title: 'Outro', seendate: '20261001T120000Z' },
    ] });
    const itens = lerGdelt(corpo);
    expect(itens).toHaveLength(2);
    expect(itens[0].titulo).toBe('Titulo com espaco');
    expect(itens[0].publicado_em).toBe('2026-10-01T13:45:00.000Z');
  });

  it('o 429 vem em TEXTO PURO, e nao pode estourar', () => {
    // Medido: `Please limit requests to one every 5 seconds or contact...`
    expect(() => lerGdelt('Please limit requests to one every 5 seconds')).not.toThrow();
    expect(lerGdelt('Please limit requests to one every 5 seconds')).toEqual([]);
  });

  it('HTML, JSON sem `articles` e lixo tambem nao estouram', () => {
    for (const corpo of ['<html><body>erro</body></html>', '{}', '{"articles":"nao e lista"}', '', 'null']) {
      expect(() => lerGdelt(corpo), `estourou com ${JSON.stringify(corpo.slice(0, 20))}`).not.toThrow();
      expect(lerGdelt(corpo)).toEqual([]);
    }
  });

  it('descarta artigo sem titulo ou sem endereco ABSOLUTO', () => {
    const corpo = JSON.stringify({ articles: [
      { url: 'https://ok.com/x', title: 'Vale' },
      { url: 'https://sem-titulo.com/y', title: '' },
      { url: '/relativo', title: 'Tem titulo' },
      { title: 'Sem url nenhuma' },
    ] });
    expect(lerGdelt(corpo).map((i) => i.url)).toEqual(['https://ok.com/x']);
  });

  it('data invalida vira `null`, nunca um palpite', () => {
    // Data errada num radar de ATUALIDADE ordena a lista errado, e ninguem ve.
    expect(dataDaGdelt('20261001T134500Z')).toBe('2026-10-01T13:45:00.000Z');
    for (const ruim of ['ontem', '2026-10-01', '', null, undefined, 42, '20261332T999999Z']) {
      expect(dataDaGdelt(ruim), `${ruim} deveria dar null`).toBeNull();
    }
  });

  it('o resumo vem VAZIO — a GDELT nao devolve um, e inventar seria pior', () => {
    // Preencher com o dominio ou a data seria fabricar conteudo editorial a
    // partir de metadado, e o modelo leria aquilo como apuracao.
    const [i] = lerGdelt(JSON.stringify({ articles: [{ url: 'https://a.com/x', title: 'T', domain: 'a.com' }] }));
    expect(i.resumo).toBe('');
  });
});

describe('`[01/10]` resumo que so REPETE o titulo e descartado', () => {
  // ── Por que isto existe, e o numero ─────────────────────────────────────
  //
  // O feed de BUSCA do Google News preenche `<description>` com um link cujo
  // texto e o proprio titulo mais o nome do veiculo:
  //
  //   titulo : Upscaling com IA chega em breve para PS5 - PlayStation.Blog BR
  //   resumo : Upscaling com IA chega em breve para PS5 PlayStation.Blog BR
  //
  // Mandar os dois ao modelo custa DUAS VEZES o mesmo fato dentro de um
  // pedido com teto de tokens medido — e foi esse teto que decidiu quantas
  // manchetes cabem (`RESERVA_DE_RACIOCINIO`). Resumo de 160 chars repetindo
  // o titulo e 160 chars a menos para manchete de verdade.
  //
  // ── E por que a regra e GENERICA ────────────────────────────────────────
  //
  // Nao e tratamento especial para o Google News: e qualidade de feed. Feed
  // nenhum ganha excecao, e o leitor continua sem saber de que fornecedor
  // veio o XML.

  const feed = (titulo, descricao) => `<rss><channel><item>
    <title>${titulo}</title><link>https://x.com/a</link>
    <description>${descricao}</description></item></channel></rss>`;

  it('descarta o resumo que e o titulo de novo', () => {
    const [i] = lerFeed(feed(
      'Upscaling com IA chega em breve para PS5 - PlayStation.Blog BR',
      'Upscaling com IA chega em breve para PS5  PlayStation.Blog BR'));
    expect(i.resumo, 'o resumo repetido voltou a ocupar orcamento de token com '
      + 'o mesmo fato que o titulo ja diz').toBe('');
  });

  it('PRESERVA resumo de verdade — e esta e a metade que nao pode quebrar', () => {
    // Os 13 feeds reais trazem resumo legitimo. Medido em 01/10 contra
    // Canaltech, PC Gamer e GameSpot: 15 de 15 itens mantiveram o resumo.
    const [i] = lerFeed(feed(
      'Diablo 4 ganha temporada nova',
      'A Blizzard detalhou as mudancas de balanceamento e o novo chefe que '
      + 'aparece no fim do ato tres, alem da data de inicio.'));
    expect(i.resumo, 'resumo LEGITIMO foi descartado. Isso empobrece as 13 '
      + 'fontes reais para resolver um defeito de uma.').toContain('Blizzard');
  });

  it('o limiar nao e igualdade exata — o repetido quase nunca e identico', () => {
    // Vem sem o hifen, com o veiculo colado, com espaco a mais. Comparar por
    // igualdade deixaria todos passarem.
    const [i] = lerFeed(feed(
      'Nintendo reduz preco do Controle Switch Pro na Amazon',
      'Nintendo reduz o preco do Controle Switch Pro na Amazon hoje'));
    expect(i.resumo).toBe('');
  });

  it('resumo que REPETE PARTE do titulo mas acrescenta fato NAO e descartado', () => {
    // ── Este caso nasceu de uma reinjecao que NAO falhou ────────────────
    //
    // Eu tinha um teste de "preserva resumo legitimo", mas o resumo dele nao
    // compartilhava palavra NENHUMA com o titulo — entao nenhum limiar, por
    // mais agressivo, o mataria. Baixei o limiar de 0,8 para 0,1 e os 55
    // testes passaram.
    //
    // O caso realista perigoso e este: resumo que repete o nome do produto
    // (porque e do que ele fala) e acrescenta o preco, o prazo, a loja. Com
    // limiar apertado demais, ele some — e some em SILENCIO, levando junto o
    // unico fato que o titulo nao tinha.
    const [i] = lerFeed(feed(
      'Nintendo Switch OLED tem oferta no Dia das Criancas',
      'O Nintendo Switch OLED esta com desconto de R$ 400 na Amazon ate domingo.'));
    expect(i.resumo, 'resumo que repete o nome do produto e acrescenta preco e '
      + 'prazo foi descartado. O limiar de `soRepeteOTitulo` ficou agressivo '
      + 'demais, e o fato novo some em silencio junto com a repeticao.')
      .toContain('400');
  });

  it('resumo CURTO que acrescenta fato novo fica', () => {
    const [i] = lerFeed(feed('Xbox anuncia Mythic Achievements',
      'Chega em novembro para assinantes do Game Pass Ultimate.'));
    expect(i.resumo).toContain('novembro');
  });
});

describe('as consultas de API vao EM SERIE, com o espaco que a GDELT exige', () => {
  const fonte = (n) => ({ id: `f${n}`, nome: `consulta ${n}`, url: `https://api.gdelt/${n}` });
  const corpoCom = (t) => JSON.stringify({ articles: [{ url: `https://x.com/${t}`, title: t }] });

  it('espera entre uma consulta e a seguinte, e NAO antes da primeira', async () => {
    // Paralelizar aqui garantiria 429 em tudo menos na primeira. E cobrar 5 s
    // do editor para a PRIMEIRA seria pagar pedagio sem estrada.
    //
    // O teto vai EXPLICITO (2) e nao vem da constante de producao, que hoje e
    // 1. O comportamento tem de continuar provado para o dia em que o teto
    // subir — senao a regra do espacamento ficaria sem teste justamente
    // enquanto ela nao e exercitada, e voltaria quebrada.
    const esperas = [];
    const { itens } = await coletarDasApis(
      [fonte(1), fonte(2)],
      async (u) => ({ ok: true, status: 200, texto: corpoCom(u.slice(-1)) }),
      async (ms) => { esperas.push(ms); },
      2,
    );
    expect(esperas, 'o espacamento sumiu — a GDELT vai recusar da 2a em diante')
      .toEqual([ESPACO_ENTRE_CONSULTAS_MS]);
    expect(itens).toHaveLength(2);
  });

  it('o 429 de uma consulta NAO derruba as outras, e vira recado em portugues', async () => {
    let n = 0;
    const { itens, comFalha } = await coletarDasApis(
      [fonte(1), fonte(2)],
      async () => (++n === 1
        ? { ok: false, status: 429, texto: 'Please limit requests' }
        : { ok: true, status: 200, texto: corpoCom('b') }),
      async () => {},
      2,
    );
    expect(itens, 'a segunda consulta morreu junto com o 429 da primeira').toHaveLength(1);
    expect(comFalha[0].motivo, '"HTTP 429" sozinho manda procurar defeito nosso, e o '
      + 'limite e da GDELT').toMatch(/limite dela, nao nosso/);
  });

  it('`buscar` que LANCA nao derruba a coleta', async () => {
    const { itens, comFalha } = await coletarDasApis(
      [fonte(1)], async () => { throw new Error('rede caiu'); }, async () => {},
    );
    expect(itens).toEqual([]);
    expect(comFalha[0].motivo).toBe('rede caiu');
  });

  it('`[01/10]` o teto de PRODUCAO e 1, e o timeout dela e maior que o do RSS', async () => {
    // ── O primeiro clique real desmentiu a previsao ──────────────────────
    //
    // Eu projetei esperando `429`. Da Edge Function veio `Signal timed out.`
    // nas duas consultas: nao e recusa, e LENTIDAO. E o numero que provava
    // isso ja estava medido antes do clique — a GDELT levou 10,8 s e depois
    // 12,3 s so para devolver um `429`, que nem consulta o indice.
    //
    // Com 20 s de teto, duas consultas em serie custariam ate 45 s de espera
    // para quem clicou. Uma com chance real de responder vale mais.
    expect(TETO_DE_CONSULTAS, 'o teto de consultas por clique subiu. Com '
      + `${TIMEOUT_DA_CONSULTA_MS / 1000}s de timeout cada, 2 consultas em serie `
      + 'passam de 45 s de espera para o editor. Subir isto exige tirar a '
      + 'coleta de dentro do clique.').toBe(1);

    expect(TIMEOUT_DA_CONSULTA_MS, 'o timeout da GDELT voltou a ser pequeno. '
      + 'Medido duas vezes: ela leva 10-12 s so para devolver um 429. Com o '
      + 'teto do RSS (10 s) ela estoura SEMPRE — foi o que o primeiro clique '
      + 'real mostrou, com `Signal timed out.` nas duas consultas.')
      .toBeGreaterThanOrEqual(15_000);
  });

  it('timeout vira recado que DIZ o teto, nao `Signal timed out.`', async () => {
    // `Signal timed out.` sozinho nao diz nada para quem le a tela — eu
    // mesmo precisei abrir o codigo para saber qual era o numero.
    const { comFalha } = await coletarDasApis(
      [fonte(1)],
      async () => { throw new Error('Signal timed out.'); },
      async () => {},
    );
    expect(comFalha[0].motivo).toMatch(/nao respondeu em \d+s/);
  });

  it('consulta que ficou FORA do teto e dita, nao cortada em silencio', async () => {
    const muitas = [1, 2, 3, 4, 5].map(fonte);
    const { comFalha } = await coletarDasApis(
      muitas, async () => ({ ok: true, status: 200, texto: corpoCom('x') }), async () => {},
    );
    // Fonte cadastrada que nunca e consultada aparece como ativa no painel e
    // nunca traz nada: "cobertura que nao cobre" (§1.5).
    expect(comFalha.some((f) => /fora do teto/.test(f.motivo)),
      `fonte alem do teto de ${TETO_DE_CONSULTAS} sumiu sem aviso`).toBe(true);
  });
});

describe('os dois coletores convivem — e um nao derruba o outro', () => {
  const RSS = '<rss><item><title>Do feed</title><link>https://feed.com/a</link></item></rss>';
  const GDELT = JSON.stringify({ articles: [{ url: 'https://gdelt.com/b', title: 'Da api' }] });
  const fontes = [
    { id: 'r1', nome: 'Feed', url: 'https://feed.com/rss', tipo: 'rss' },
    { id: 'a1', nome: 'GDELT', url: 'https://api.gdelt/q', tipo: 'api' },
  ];

  it('junta o que veio dos dois, cada item com a fonte dele', async () => {
    const { itens } = await coletarTudo(fontes,
      async (u) => ({ ok: true, status: 200, texto: u.includes('gdelt') ? GDELT : RSS }),
      async () => {});
    expect(itens.map((i) => i.fonte_nome).sort()).toEqual(['Feed', 'GDELT']);
  });

  it('a GDELT recusando NAO tira o RSS do ar — e o inverso tambem', async () => {
    // Criterio 6 da Fase 1, na letra. E o simetrico, que o criterio nao
    // escreveu mas vale igual: o feed caindo nao pode levar a API junto.
    const soRss = await coletarTudo(fontes,
      async (u) => (u.includes('gdelt')
        ? { ok: false, status: 429, texto: 'Please limit' }
        : { ok: true, status: 200, texto: RSS }),
      async () => {});
    expect(soRss.itens.map((i) => i.fonte_nome)).toEqual(['Feed']);

    const soApi = await coletarTudo(fontes,
      async (u) => (u.includes('gdelt')
        ? { ok: true, status: 200, texto: GDELT }
        : { ok: false, status: 503, texto: '' }),
      async () => {});
    expect(soApi.itens.map((i) => i.fonte_nome)).toEqual(['GDELT']);
  });

  it('`[01/10]` a API recebe o timeout MAIOR, e o RSS continua com o dele', async () => {
    // ── Este teste existe porque a reinjecao C NAO falhou ────────────────
    //
    // Eu tinha dois testes sobre o timeout: que a constante existe e que ela
    // e >= 15 s. Os dois passavam com a chamada em `coleta.ts` tirando o
    // argumento — ou seja, a GDELT voltava ao teto do RSS e NADA acusava.
    // Era exatamente o defeito do primeiro clique real, de volta em
    // silencio. Descoberto reinjetando, que e o unico jeito de achar isto.
    //
    // A forma forte: olhar o teto que cada coletor REALMENTE pede.
    const tetos = {};
    await coletarTudo(fontes, async (url, tetoMs) => {
      tetos[url.includes('gdelt') ? 'api' : 'rss'] = tetoMs;
      return { ok: true, status: 200, texto: url.includes('gdelt') ? GDELT : RSS };
    }, async () => {});

    expect(tetos.api, 'a consulta de API deixou de receber o timeout proprio e '
      + 'caiu no teto do RSS. A GDELT leva 10-12 s so para devolver um 429: com '
      + '10 s ela estoura SEMPRE, e a tela diz "Signal timed out." sem que nada '
      + 'quebre. Conserto: `buscar(u, TIMEOUT_DA_CONSULTA_MS)` em `coleta.ts`.')
      .toBe(TIMEOUT_DA_CONSULTA_MS);

    expect(tetos.rss, 'o RSS herdou o timeout longo da GDELT. Sao treze feeds, '
      + 'e um site morto passaria a prender o editor pelo dobro do tempo.')
      .not.toBe(TIMEOUT_DA_CONSULTA_MS);
  });

  it('tipo DESCONHECIDO grita, em vez de cair num `else`', async () => {
    // Fonte cadastrada com tipo que ninguem le apareceria ATIVA no painel e
    // nunca traria nada. E o fallback silencioso do §4, em forma de dado.
    const { comFalha } = await coletarTudo(
      [{ id: 'x', nome: 'Fonte torta', url: 'https://x.com', tipo: 'scraping' }],
      async () => ({ ok: true, status: 200, texto: RSS }), async () => {});
    expect(comFalha[0].motivo).toMatch(/tipo "scraping" nao tem coletor/);
  });
});

describe('o motor e GENERICO — exigencia dele, virada maquina', () => {
  // *"valide explicitamente que nenhuma parte da solucao ficou dependente de
  // GTA, Marvel, Avengers, Rockstar ou qualquer outro topico usado como
  // exemplo"*. Validar na implementacao e promessa que envelhece no proximo
  // PR; isto varre o codigo a cada `npm test`.
  //
  // ── A FRONTEIRA que esta trava me obrigou a nomear, no 1o run ───────────
  //
  // A primeira versao marcava `playstation`, `xbox` e `nintendo` — e estava
  // ERRADA. Aqueles tres sao EDITORIAS do site: vivem no `CHECK` de
  // `news_articles.editoria`, aparecem na instrucao ao modelo porque ele
  // precisa escolher uma, e ja tem trava propria
  // (`vocabularioDoNewsNaoDeriva.test.js`, que os confere contra o banco).
  //
  // A distincao, e ela e a regra: **taxonomia nossa pode estar no codigo;
  // assunto de materia nao pode.** "Editoria xbox" e uma gaveta que existe
  // antes de qualquer noticia; "se o titulo falar de GTA, faca X" e o
  // tratamento especial que ele proibiu.
  //
  // Marcar as editorias aqui seria alarme falso permanente, e alarme que
  // grita a toa cega igual ao silencio (§0.2, 4a regra).
  const ASSUNTOS = [
    'gta', 'rockstar', 'marvel', 'avengers', 'vingadores', 'iphone',
    'steam', 'epic games', 'take-two', 'ubisoft', 'bethesda',
  ];

  it.each(ARQUIVOS)('%s nao cita assunto nenhum no codigo', (arquivo) => {
    const fonte = readFileSync(join(PASTA, arquivo), 'utf8');
    // Os comentarios citam os exemplos DELE de proposito, para explicar a
    // regra. O que nao pode e assunto virar comportamento — entao a varredura
    // olha so o codigo executavel.
    const codigo = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
      .toLowerCase();

    const citados = ASSUNTOS.filter((a) => codigo.includes(a));
    expect(citados, [
      `O código de ${arquivo} passou a citar: ${citados.join(', ')}.`,
      '',
      'Ordem dele, na letra: nada de palavra-chave, fonte, peso ou tratamento',
      'especial para assunto nenhum. GTA e Marvel eram EXEMPLOS DE TESTE.',
      '',
      'O que se procura mora em `news_sources` (`tipo = \'api\'`, a consulta no',
      '`url`), que é DADO — a equipe muda sem deploy, e o motor continua cego',
      'ao tema. Se um assunto precisa de tratamento, ele é uma linha de tabela.',
    ].join('\n')).toEqual([]);
  });

  it('a consulta da GDELT vem da TABELA, nao de uma constante', () => {
    const fonte = readFileSync(join(PASTA, 'gdelt.ts'), 'utf8');
    expect(fonte, 'apareceu uma URL de consulta escrita no codigo. A consulta e '
      + 'uma linha de `news_sources`; no codigo ela chega como `f.url`.')
      .not.toMatch(/api\.gdeltproject\.org[^\s"'`]*query=/);
  });
});
