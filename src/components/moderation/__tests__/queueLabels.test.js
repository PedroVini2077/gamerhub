import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTENT_LABEL, FONTE_DO_CONTEUDO, TABELA_DO_AUTOR, linkDoConteudo,
  TIPOS_DE_GATILHO, TRIGGER_LABEL, TRIGGER_COLOR,
} from '../queueLabels';

/**
 * Travas da prévia da fila de moderação.
 *
 * ── O que motivou ───────────────────────────────────────────────────────────
 *
 * Achado do dono em 29/08: na fila "só aparece o conteúdo de texto, agora
 * imagens, e até mesmo vídeos não aparecem". Um post denunciado **por causa da
 * imagem** era julgado às cegas.
 *
 * Nada nessa tela dava erro. Ela só mostrava menos do que existia — que é a
 * forma de falha mais difícil de perceber, porque não há nada para perceber.
 * Por isso as travas aqui são sobre COMPLETUDE, não sobre erro.
 */

const TIPOS = Object.keys(CONTENT_LABEL);

describe('a fila conhece todos os tipos de conteúdo', () => {
  it('todo tipo rotulado tem fonte de leitura', () => {
    for (const tipo of TIPOS) {
      expect(
        FONTE_DO_CONTEUDO[tipo],
        `O tipo "${tipo}" aparece na fila mas ninguém sabe de onde ler o conteúdo\n`
        + 'dele. O card vai ficar em "Tipo de conteúdo desconhecido" — foi assim\n'
        + 'que o tipo `chat` passou meses caindo na tabela errada.',
      ).toBeTruthy();
    }
  });

  it('todo tipo rotulado tem tabela de autor (para violação e banimento)', () => {
    for (const tipo of TIPOS) {
      expect(TABELA_DO_AUTOR[tipo], `sem tabela de autor para "${tipo}"`).toBeTruthy();
    }
  });
});

describe('linkDoConteudo — leva ao lugar certo, ou a lugar nenhum', () => {
  it('post vai para a própria página', () => {
    expect(linkDoConteudo('post', { id: 'p1' })).toBe('/post/p1');
  });

  it('comentário vai para o POST em que ele foi escrito', () => {
    expect(
      linkDoConteudo('comment', { id: 'c1', post_id: 'p9' }),
      'Um comentário não tem página própria. Mandar para `/post/<id-do-comentário>`\n'
      + 'levaria a um post que não existe.',
    ).toBe('/post/p9');
  });

  it('chat vai para a live', () => {
    expect(linkDoConteudo('chat', { id: 'm1', post_id: 'live7' })).toBe('/lives/live7');
  });

  it('mural vai para a mensagem, não para a lista', () => {
    expect(
      linkDoConteudo('mural', { id: 'm1' }),
      'O link do mural voltou a apontar para `/community`. A lista é paginada:\n'
      + 'uma mensagem antiga pode nem estar na primeira página, e o moderador\n'
      + 'clicaria em "ver no site" sem encontrar nada.',
    ).toBe('/mural/m1');
  });

  it('sem a coluna que o link precisa, devolve NULL — não um caminho quebrado', () => {
    expect(
      linkDoConteudo('comment', { id: 'c1' }),
      'Sem `post_id`, o link do comentário virou um caminho inventado.\n'
      + 'Preferimos não mostrar botão a mostrar um que leva ao lugar errado:\n'
      + 'o moderador julgaria outro conteúdo.',
    ).toBeNull();
    expect(linkDoConteudo('chat', { id: 'm1' })).toBeNull();
  });

  it('tipo desconhecido não ganha destino chutado', () => {
    expect(linkDoConteudo('rascunho', { id: 'x' })).toBeNull();
    expect(linkDoConteudo('post', null)).toBeNull();
  });
});

describe('as colunas carregadas sustentam o link', () => {
  // Esta é a trava mais importante do arquivo, e a menos óbvia: o link do
  // comentário e o do chat dependem de `post_id` vir na consulta. Se alguém
  // enxugar as colunas, `linkDoConteudo` passa a devolver `null`, o botão
  // "ver no site" simplesmente DESAPARECE, e nada acusa — nem erro, nem teste,
  // nem log (§1.5).
  it.each([['comment'], ['chat']])('`%s` carrega post_id', (tipo) => {
    expect(
      FONTE_DO_CONTEUDO[tipo].cols,
      `As colunas de "${tipo}" deixaram de trazer \`post_id\`. O botão "ver no\n`
      + 'site" some da fila sem erro nenhum, e volta a não haver como abrir o\n'
      + 'conteúdo denunciado.',
    ).toContain('post_id');
  });
});

describe('quem tem mídia declara de onde ela vem', () => {
  it.each([['post', 'post_media'], ['mural', 'community_post_media']])(
    '`%s` lê mídia de `%s`', (tipo, tabela) => {
      expect(
        FONTE_DO_CONTEUDO[tipo].midia?.tabela,
        `"${tipo}" parou de declarar de onde vem a mídia. A prévia volta a\n`
        + 'mostrar só o texto — e um post denunciado POR CAUSA DA IMAGEM volta a\n'
        + 'ser julgado às cegas, que é exatamente o bug de 29/08.',
      ).toBe(tabela);
    },
  );

  it('comentário e chat não têm mídia, e isso é explícito', () => {
    expect(FONTE_DO_CONTEUDO.comment.midia).toBeUndefined();
    expect(FONTE_DO_CONTEUDO.chat.midia).toBeUndefined();
  });
});

describe('a rota que o link do post usa existe de verdade', () => {
  it('`/post/:id` está registrada no App', () => {
    const app = readFileSync(
      join(import.meta.dirname, '../../../App.jsx'), 'utf8',
    );
    // `[02/09]` As declarações `lazy()` saíram do `App.jsx` para o
    // `paginasLazy.js`, quando o `App` passou de 300 linhas (§4). Esta trava
    // acusou a mudança na hora — que é o trabalho dela. O conserto é olhar
    // onde a declaração mora AGORA, e não afrouxar a asserção: se ela passasse
    // a aceitar a ausência, deixaria de pegar a rota realmente removida.
    const lazyPages = readFileSync(
      join(import.meta.dirname, '../../../paginasLazy.js'), 'utf8',
    );
    expect(
      app,
      'A rota `/post/:id` sumiu do App. O botão "ver no site" continua na fila,\n'
      + 'continua clicável, e leva para a página de 404 — link quebrado que\n'
      + 'nenhum teste de unidade pegaria, porque o caminho em si está certo.',
    ).toContain('path="/post/:id"');
    expect(lazyPages).toMatch(/import\('\.\/pages\/PostPage'\)/);
    expect(
      app,
      'A rota `/mural/:id` sumiu do App — mesmo problema, para o mural.',
    ).toContain('path="/mural/:id"');
    expect(app).toMatch(/import\('\.\/pages\/MuralPage'\)/);
  });
});

describe('todo tipo de gatilho tem rótulo e cor', () => {
  // Deriva clássica desta base: o banco aceita um valor que o painel não sabe
  // desenhar. O resultado é `undefined` no lugar do rótulo — nada estoura, e o
  // moderador vê um item sem saber por que ele está ali.
  it.each(TIPOS_DE_GATILHO)('`%s` aparece nos dois mapas', (tipo) => {
    expect(
      TRIGGER_LABEL[tipo],
      `O gatilho "${tipo}" é aceito pelo banco mas não tem rótulo no painel.\n`
      + 'O card mostraria "undefined" onde deveria dizer por que o item está na\n'
      + 'fila — e a razão de estar ali é a informação mais importante do card.',
    ).toBeTruthy();
    expect(TRIGGER_COLOR[tipo], `sem cor para "${tipo}"`).toBeTruthy();
  });

  it('`sem_analise` NÃO se descreve como acusação', () => {
    // Ele é o único que significa "ninguém conseguiu olhar", e não "alguma
    // checagem apontou". Descrevê-lo como os outros faria o moderador julgar
    // pelo critério errado (§1.5).
    expect(
      TRIGGER_LABEL.sem_analise,
      'O rótulo de `sem_analise` passou a sugerir que algo foi detectado.\n'
      + 'Ele existe justamente para o caso em que NADA foi analisado.',
    ).toMatch(/não analisad/i);
  });

  it('a lista de gatilhos não encolheu sem os mapas acompanharem', () => {
    for (const tipo of Object.keys(TRIGGER_LABEL)) {
      expect(
        TIPOS_DE_GATILHO,
        `"${tipo}" tem rótulo mas saiu de TIPOS_DE_GATILHO — os dois lados\n`
        + 'precisam concordar, senão o teste acima deixa de cobri-lo.',
      ).toContain(tipo);
    }
  });
});

describe('o link da aba Denúncias funciona só com o que a denúncia guarda', () => {
  // A denúncia guarda `content_type` e `content_id`, e mais nada. Para post e
  // mural isso basta. Para comentário e chat o destino depende do post, que a
  // denúncia NÃO guarda — então ali não há botão.
  //
  // Inventar `/post/<id-do-comentário>` levaria o moderador a um post que não
  // existe, ou pior, a outro conteúdo (§4).
  it('post e mural têm link a partir do id sozinho', () => {
    expect(linkDoConteudo('post', { id: 'p1' })).toBe('/post/p1');
    expect(linkDoConteudo('mural', { id: 'm1' })).toBe('/mural/m1');
  });

  it('comentário e chat NÃO têm link a partir do id sozinho', () => {
    expect(
      linkDoConteudo('comment', { id: 'c1' }),
      'O link do comentário passou a ser montado a partir do id dele. Na aba\n'
      + 'Denúncias isso levaria a `/post/<id-do-comentário>` — um post que não\n'
      + 'existe, ou o conteúdo errado.',
    ).toBeNull();
    expect(linkDoConteudo('chat', { id: 'x1' })).toBeNull();
  });
});
