import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTENT_LABEL, FONTE_DO_CONTEUDO, TABELA_DO_AUTOR, linkDoConteudo,
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

  it('mural vai para o mural', () => {
    expect(linkDoConteudo('mural', { id: 'm1' })).toBe('/community');
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
    expect(
      app,
      'A rota `/post/:id` sumiu do App. O botão "ver no site" continua na fila,\n'
      + 'continua clicável, e leva para a página de 404 — link quebrado que\n'
      + 'nenhum teste de unidade pegaria, porque o caminho em si está certo.',
    ).toContain('path="/post/:id"');
    expect(app).toMatch(/import\('\.\/pages\/PostPage'\)/);
  });
});
