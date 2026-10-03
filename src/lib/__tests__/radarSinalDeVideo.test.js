import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  montarUrlDaBusca, montarConsulta, lerRespostaDaBusca, buscarVideos,
  motivoDaFalha, TETO_DE_BUSCAS_POR_CLIQUE, JANELA_DE_HORAS, TETO_DE_TERMOS,
} from '../../../supabase/functions/radar-de-pautas/youtube.ts';
import {
  contarVideosDaPauta, rotuloDeVideo, termosQueDistinguem,
} from '../../../supabase/functions/radar-de-pautas/contagemDeVideo.ts';
import { seloDeVideo } from '../news/sinalDeVideo';

/**
 * `[02/10]` FASE 4 do radar — o sinal de video, nos jeitos de quebrar que NAO
 * gritam.
 *
 * ── (1) Os tres parametros que parecem opcionais ─────────────────────────
 *
 * **`type=video`** nao e teoria: o primeiro teste real do dono, no navegador,
 * voltou um **CANAL**. Sem o parametro, `search.list` mistura canal, playlist
 * e video, e o radar anexaria "um canal" a uma pauta — contando como se fosse
 * video, sem erro nenhum.
 *
 * **`order=date`** — o padrao e `relevance`, que devolve o video mais popular
 * de tres anos atras. Para "esta falando disso HOJE" isso e a resposta errada
 * com cara de certa, que e a pior especie.
 *
 * **`publishedAfter`** — e o que faz o sinal significar "hoje" em vez de
 * "algum dia".
 *
 * ── (2) A COTA, que e o teto que morde ───────────────────────────────────
 *
 * `search.list` tem teto SEPARADO de **100 por dia**, enquanto o geral e
 * 10.000 unidades. Responder "quantas vezes por dia?" contra as 10.000 daria
 * uma falsa folga de 100x. Uma busca por clique; fonte que sobrar do teto e
 * **DITA**, nunca ignorada em silencio (§4).
 *
 * ── (3) Contar VIDEO, nao casamento ──────────────────────────────────────
 *
 * Um video cujo titulo bate com tres termos da mesma pauta e um video. Contar
 * casamentos faria a pauta com mais sinonimos ganhar sozinha — o "score
 * magico" que o plano recusa, so que disfarcado de contagem.
 *
 * ── (4) O vocabulario nao pode divergir entre servidor e tela ────────────
 *
 * O servidor produz o texto e a tela so desenha o que sabe explicar. Se o
 * formato mudar de um lado, o selo some e **nada estoura** (§1.5).
 *
 * ── Provada reinjetando o bug (§2) ───────────────────────────────────────
 *
 * Seis reinjecoes, uma por checagem — ver o relatorio da sessao.
 */

const CHAVE = 'CHAVE-DE-TESTE';

function resposta(items) {
  return JSON.stringify({ kind: 'youtube#searchListResponse', regionCode: 'BR', items });
}
const video = (id, title) => ({
  id: { kind: 'youtube#video', videoId: id },
  snippet: { title, channelTitle: 'Canal X', publishedAt: '2026-10-02T12:00:00Z' },
});
const canal = (id, title) => ({
  id: { kind: 'youtube#channel', channelId: id },
  snippet: { title, channelTitle: title, publishedAt: '2026-10-02T12:00:00Z' },
});

describe('o sinal de vídeo — a URL da busca', () => {
  const FONTE = 'https://www.googleapis.com/youtube/v3/search?q=ignorado';
  const url = new URL(montarUrlDaBusca(FONTE, ['gta 6'], CHAVE, new Date('2026-10-02T12:00:00Z')));

  it('pede type=video — sem isso volta CANAL, e voltou', () => {
    expect(
      url.searchParams.get('type'),
      'o `type=video` sumiu da busca do YouTube.\n'
      + '    Sem ele o `search.list` mistura canal, playlist e video — o primeiro\n'
      + '    teste real voltou um CANAL. Ele entraria na contagem como se fosse\n'
      + '    video e o sinal passaria a medir outra coisa, sem erro nenhum.',
    ).toBe('video');
  });

  it('a consulta sai das PAUTAS, não da linha da fonte', () => {
    expect(
      url.searchParams.get('q'),
      'o `q` deixou de vir dos termos das pautas.\n'
      + '    Consulta generica com UMA chamada nao acha nada: `games OR gameplay`\n'
      + '    ordenado por data devolve os 50 uploads mais recentes que mencionam\n'
      + '    "games", e a chance de dois falarem da pauta e quase nula. Foi o que\n'
      + '    aconteceu no 1o clique real — 16 fontes lidas, nenhum selo, nenhuma\n'
      + '    falha. A consulta e a pergunta tem de ser a mesma coisa.',
    ).toBe('"gta 6"');
  });

  it('termo com espaço vai entre ASPAS, e aspa solta não vaza', () => {
    expect(
      montarConsulta(['grand theft auto', 'nacon']),
      'termo com espaco sem aspas vira palavras soltas, e a busca passa a casar\n'
      + '    com qualquer video que diga "auto".',
    ).toBe('"grand theft auto" OR nacon');

    expect(
      montarConsulta(['o "melhor" jogo']),
      'aspa DENTRO do termo sobreviveu. Ela quebra a expressao inteira do lado\n'
      + '    do Google — e isso volta `200` com resultado errado, nao erro.',
    ).toBe('"o melhor jogo"');

    expect(montarConsulta([]), 'sem termo o `q` tem de ser vazio').toBe('');
    expect(
      montarConsulta(Array.from({ length: 40 }, (_, i) => `termo${i}`)).split(' OR '),
      `a consulta passou de ${TETO_DE_TERMOS} termos`,
    ).toHaveLength(TETO_DE_TERMOS);
  });

  it('o CADASTRO não consegue desligar a proteção', () => {
    // Uma fonte cadastrada com `type=channel` e `order=viewCount` — o estrago
    // do primeiro teste real, so que vindo de uma linha de tabela.
    const torta = 'https://www.googleapis.com/youtube/v3/search'
      + '?q=games&type=channel&order=viewCount&publishedAfter=2020-01-01T00:00:00Z';
    const u = new URL(montarUrlDaBusca(torta, ['gta 6'], CHAVE, new Date('2026-10-02T12:00:00Z')));
    expect(
      [u.searchParams.get('type'), u.searchParams.get('order')],
      'a URL cadastrada na fonte conseguiu mudar `type` ou `order`.\n'
      + '    Quem cadastra escolhe o ASSUNTO; os parametros que decidem se o\n'
      + '    sinal significa alguma coisa nao sao configuracao. Uma linha de\n'
      + '    tabela com `type=channel` traria canal — o bug do primeiro teste\n'
      + '    real, so que sem ninguem reler a linha.',
    ).toEqual(['video', 'relevance']);
    expect(u.searchParams.get('publishedAfter')).toBe('2026-10-01T12:00:00.000Z');
    expect(
      u.searchParams.get('q'),
      'o `q` da linha da fonte sobreviveu. Ele e ignorado de proposito desde\n'
      + '    `[02/10]`: a consulta sai das pautas, e a linha so carrega a base\n'
      + '    (endpoint, regiao, idioma).',
    ).toBe('"gta 6"');
  });

  it('a chave NUNCA vem do cadastro — ela vem do ambiente', () => {
    const comChaveFalsa = 'https://www.googleapis.com/youtube/v3/search?q=games&key=CHAVE-DO-BANCO';
    const u = new URL(montarUrlDaBusca(comChaveFalsa, ['gta 6'], CHAVE));
    expect(
      u.searchParams.get('key'),
      'uma chave escrita na linha da fonte sobreviveu.\n'
      + '    Segredo em tabela que a equipe le e segredo compartilhado com a\n'
      + '    equipe inteira — e ele iria para o log de quem depurar a URL.',
    ).toBe(CHAVE);
  });

  it('pede order=relevance e uma janela de 24h', () => {
    // `[02/10]` Era `date`, e eu estava errado. A 1a versao nao achou NADA no
    // primeiro clique real, e o motivo era este somado a consulta generica:
    // `date` dentro de uma janela de 24h so troca relevancia por hora de
    // upload — o `publishedAfter` ja garante "hoje" sozinho.
    expect(
      url.searchParams.get('order'),
      'o `order` saiu de `relevance`. Dentro da janela de 24h, ordenar por DATA\n'
      + '    devolve os uploads mais recentes (canais pequenos postando qualquer\n'
      + '    coisa) em vez dos mais relevantes para os termos das pautas.\n'
      + '    Foi exatamente isso que fez o sinal nao achar nada no 1o clique.',
    ).toBe('relevance');

    const desde = url.searchParams.get('publishedAfter');
    expect(desde, 'o `publishedAfter` sumiu — sem a janela o sinal deixa de significar "hoje".')
      .toBeTruthy();
    const horas = (Date.parse('2026-10-02T12:00:00Z') - Date.parse(desde)) / 3600_000;
    expect(horas, `a janela virou ${horas}h; o combinado e ${JANELA_DE_HORAS}h.`)
      .toBe(JANELA_DE_HORAS);
  });
});

describe('o sinal de vídeo — ler a resposta', () => {
  it('descarta o que NAO e video, mesmo com type=video', () => {
    const lidos = lerRespostaDaBusca(resposta([
      canal('UC1', 'Canal de Games'),
      video('v1', 'Review do jogo novo'),
    ]));
    expect(
      lidos.map((v) => v.titulo),
      'um CANAL passou pelo leitor.\n'
      + '    Confiar so no parametro `type=video` e confiar que ninguem vai\n'
      + '    edita-lo um dia — e a resposta real do primeiro teste trouxe\n'
      + '    exatamente um canal. O `id.kind` tem de ser conferido aqui.',
    ).toEqual(['Review do jogo novo']);
  });

  it('resposta que nao e JSON nao derruba nada', () => {
    expect(lerRespostaDaBusca('<html>502</html>')).toEqual([]);
  });
});

describe('o sinal de vídeo — a cota', () => {
  const buscar = async () => ({ ok: true, status: 200, texto: resposta([video('v1', 'Um video')]) });

  it('faz UMA busca por clique, e DIZ qual fonte ficou de fora', async () => {
    const base = 'https://www.googleapis.com/youtube/v3/search?q=';
    const fontes = [
      { nome: 'YouTube · games', url: `${base}games` },
      { nome: 'YouTube · tecnologia', url: `${base}tecnologia` },
      { nome: 'YouTube · geek', url: `${base}geek` },
    ];
    let chamadas = 0;
    const contando = async (u) => { chamadas += 1; return buscar(u); };

    const r = await buscarVideos(fontes, ['gta 6'], CHAVE, contando);

    expect(
      chamadas,
      `fez ${chamadas} buscas num clique so, e o teto e ${TETO_DE_BUSCAS_POR_CLIQUE}.\n`
      + '    `search.list` tem teto SEPARADO de 100 por dia — o geral de 10.000\n'
      + '    unidades nao protege. Uma por pauta acabaria com a cota em 12 cliques.',
    ).toBe(TETO_DE_BUSCAS_POR_CLIQUE);

    expect(
      r.comFalha.map((f) => f.nome),
      'as fontes que ficaram fora do teto sumiram em SILENCIO.\n'
      + '    Fonte cadastrada e ativa que nunca e consultada, sem nada dizer, e\n'
      + '    a "cobertura que nao cobre" (§1.5): a tela diria "3 fontes" sobre\n'
      + '    uma que foi lida.',
    ).toEqual(['YouTube · tecnologia', 'YouTube · geek']);
  });

  it('sem chave o radar segue inteiro, e o motivo e DITO', async () => {
    const r = await buscarVideos([{ nome: 'YouTube', url: 'https://x.test/?q=games' }], ['gta 6'], undefined, buscar);
    expect(r.videos).toEqual([]);
    expect(
      r.comFalha[0]?.motivo,
      'sem `YOUTUBE_API_KEY` o sinal precisa dizer que ficou de fora.\n'
      + '    Calar faria a ausencia do selo parecer "nao ha video sobre isso",\n'
      + '    que e uma afirmacao — e errada.',
    ).toMatch(/YOUTUBE_API_KEY/);
  });

  it('a cota estourada vira frase em portugues, nao codigo cru', () => {
    const corpo = JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } });
    expect(motivoDaFalha(403, corpo)).toMatch(/cota diaria/i);
    // O desconhecido mostra o codigo em vez de inventar explicacao.
    expect(motivoDaFalha(418, '{}')).toBe('HTTP 418');
  });
});

describe('o sinal de vídeo — a contagem', () => {
  it('conta VIDEO, nao casamento de termo', () => {
    const videos = lerRespostaDaBusca(resposta([
      video('v1', 'Gears of War E-Day: tudo sobre o gameplay do novo Gears'),
    ]));
    expect(
      contarVideosDaPauta(['gears of war', 'e-day', 'gears'], videos),
      'um video que bate com tres termos foi contado mais de uma vez.\n'
      + '    A pauta com mais sinonimos ganharia sozinha — e o "score magico"\n'
      + '    que o plano recusa, disfarcado de contagem.',
    ).toBe(1);
  });

  it('casa sem acento e sem caixa', () => {
    const videos = lerRespostaDaBusca(resposta([video('v1', 'POKÉMON Legends chegou')]));
    expect(contarVideosDaPauta(['pokemon'], videos)).toBe(1);
  });

  it('termo curto demais nao conta', () => {
    const videos = lerRespostaDaBusca(resposta([video('v1', 'EA Sports FC 27')]));
    expect(
      contarVideosDaPauta(['EA'], videos),
      'termo de 2 letras casou. Ele aparece dentro de dezenas de palavras, e o\n'
      + '    numero viraria ruido com cara de medida — mesma regua do sinal de\n'
      + '    aceleracao, que exige 3 caracteres.',
    ).toBe(0);
  });
});

describe('o sinal de vídeo — termo genérico não carrega o número', () => {
  // O caso REAL do 2o clique: duas pautas de PS5 marcaram 15 videos cada,
  // porque as duas trazem `ps5` e 15 videos do dia falam de PS5. O numero nao
  // estava errado — estava respondendo OUTRA pergunta.
  const PAUTAS = [
    { termos: ['ps5', 'emulacao', 'exploit'] },
    { termos: ['ps5', 'nacon', 'controlador'] },
  ];

  it('termo que aparece em DUAS pautas sai da contagem', () => {
    const d = termosQueDistinguem(PAUTAS);
    expect(
      d.has('ps5'),
      '`ps5` continua contando, e ele serve as DUAS pautas.\n'
      + '    Palavra que serve a varias pautas nao distingue nenhuma — e a tela\n'
      + '    passa a dizer "15 videos sobre o controle da Nacon" quando o que\n'
      + '    ela mediu foi "15 videos que falam PS5".',
    ).toBe(false);
    expect([...d].sort()).toEqual(['controlador', 'emulacao', 'exploit', 'nacon']);
  });

  it('as duas pautas de PS5 deixam de ter o MESMO número', () => {
    // Os quatro falam de PS5; so dois falam de exploit e um da Nacon.
    const videos = lerRespostaDaBusca(resposta([
      video('v1', 'PS5 hoje: as novidades'),
      video('v2', 'Novo exploit no PS5'),
      video('v3', 'Outro exploit chega ao PS5'),
      video('v4', 'Nacon revela controlador para PS5'),
    ]));
    const d = termosQueDistinguem(PAUTAS);

    const semFiltro = PAUTAS.map((p) => contarVideosDaPauta(p.termos, videos));
    const comFiltro = PAUTAS.map((p) => contarVideosDaPauta(p.termos, videos, d));

    // O defeito, reproduzido: o termo compartilhado iguala as duas em 4.
    expect(
      semFiltro,
      'o caso que produziu o defeito deixou de existir no fixture — sem ele\n'
      + '    esta trava nao prova nada.',
    ).toEqual([4, 4]);

    expect(
      comFiltro,
      'as duas pautas continuam com o mesmo numero, medindo o termo que elas\n'
      + '    compartilham em vez do que as separa.',
    ).toEqual([2, 1]);
  });

  it('termo repetido DENTRO da mesma pauta não a torna genérica', () => {
    const d = termosQueDistinguem([{ termos: ['gta', 'gta', 'gta 6'] }]);
    expect(
      d.has('gta'),
      '`gta` saiu da contagem por aparecer duas vezes na MESMA pauta.\n'
      + '    Isso e a pauta falando duas vezes, nao duas pautas disputando.',
    ).toBe(true);
  });

  it('o `sinais.ts` REALMENTE passa o filtro — senão nada disto vale', () => {
    // Descoberto reinjetando: tirar o 3o argumento da chamada em `sinais.ts`
    // faz tudo voltar a inflar, e NENHUM teste acusava — as funcoes puras
    // continuam corretas, so ninguem as usa direito. Mesma classe da prop que
    // deixa de ser passada e transforma o clique em nada.
    const SINAIS = readFileSync('supabase/functions/radar-de-pautas/sinais.ts', 'utf8');
    expect(SINAIS.length, 'sinais.ts veio vazio — o caminho mudou?').toBeGreaterThan(200);
    expect(
      /contarVideosDaPauta\(\s*p\.termos,\s*[^)]*,\s*distinguem\s*\)/.test(SINAIS),
      '`sinais.ts` chama `contarVideosDaPauta` SEM o conjunto de termos que\n'
      + '    distinguem.\n'
      + '    O 3o argumento e opcional de proposito (a funcao pura precisa poder\n'
      + '    ser exercitada sem ele), e e justamente isso que torna a omissao\n'
      + '    silenciosa: tudo compila, os testes puros passam, e o numero da tela\n'
      + '    volta a medir o termo que as pautas compartilham.',
    ).toBe(true);
  });

  it('pauta só com termo genérico fica SEM sinal, e isso é o certo', () => {
    const videos = lerRespostaDaBusca(resposta([video('v1', 'PS5 e Xbox'), video('v2', 'PS5 novo')]));
    const d = termosQueDistinguem([{ termos: ['ps5'] }, { termos: ['ps5'] }]);
    expect(
      rotuloDeVideo(contarVideosDaPauta(['ps5'], videos, d)),
      'pauta sem termo proprio ganhou selo. Nao da para distinguir, entao nao\n'
      + '    se afirma nada — melhor sem selo do que com um que mede o vizinho.',
    ).toBe('');
  });
});

describe('o sinal de vídeo — servidor e tela falam a MESMA língua', () => {
  it('o que o servidor produz, a tela desenha', () => {
    for (const n of [2, 3, 17]) {
      const cru = rotuloDeVideo(n);
      expect(cru, `o servidor devolveu vazio para ${n} videos`).toBeTruthy();
      expect(
        seloDeVideo(cru),
        `o servidor produziu "${cru}" e a tela devolveu null — o selo some e\n`
        + '    NADA estoura (§1.5). O formato esta nos dois lados:\n'
        + '    `rotuloDeVideo` em radar-de-pautas/youtube.ts e a regex `FORMA`\n'
        + '    em src/lib/news/sinalDeVideo.js. Mude os dois juntos.',
      ).not.toBeNull();
    }
  });

  it('um video so NAO vira selo', () => {
    expect(
      rotuloDeVideo(1),
      'um canal qualquer postando sobre o assunto nao e sinal de nada, e selo\n'
      + '    que aparece sempre deixa de informar.',
    ).toBe('');
    expect(seloDeVideo('')).toBeNull();
  });

  it('a tela recusa texto que ela nao sabe explicar', () => {
    for (const lixo of ['muitos videos', '5 videos ontem', '<b>3 videos hoje</b>', null, 7]) {
      expect(seloDeVideo(lixo), `a tela aceitou ${JSON.stringify(lixo)}`).toBeNull();
    }
  });
});
