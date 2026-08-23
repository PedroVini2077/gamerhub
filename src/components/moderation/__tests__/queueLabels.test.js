import { describe, it, expect } from 'vitest';
import { CONTENT_LABEL, ACTION_POINTS, podeSerOcultado, FONTE_DO_CONTEUDO as FONTE, TABELA_DO_AUTOR, SEM_PUNICAO } from '../queueLabels';

// Os tipos que o banco realmente coloca em `moderation_queue.content_type`.
// Saem de `checar_palavras_bloqueadas` (posts/comments/community_posts/
// live_chat), de `apply_ai_moderation` e do trigger de denúncias.
//
// Não há CHECK constraint nessa coluna, então nada no banco impede um tipo novo
// de aparecer — e foi assim que `chat` chegou na fila e encontrou um mapa que
// não o conhecia: o card ficou em "Carregando..." para sempre, porque o
// fallback mandava a busca para `community_posts`.
const TIPOS_DA_FILA = ['post', 'comment', 'mural', 'chat'];

describe('mapas da fila de moderação', () => {
  it.each(TIPOS_DA_FILA)('%s tem rótulo', tipo => {
    expect(CONTENT_LABEL[tipo]).toBeTruthy();
  });

  it.each(TIPOS_DA_FILA)('%s sabe de qual tabela ler a prévia', tipo => {
    expect(FONTE[tipo]?.tabela).toBeTruthy();
    expect(FONTE[tipo]?.cols).toContain('user_id');
  });

  it.each(TIPOS_DA_FILA)('%s sabe de qual tabela tirar o autor', tipo => {
    expect(TABELA_DO_AUTOR[tipo]).toBeTruthy();
  });

  it('nenhum mapa usa fallback silencioso para tipo desconhecido', () => {
    expect(FONTE.tipo_que_nao_existe).toBeUndefined();
    expect(CONTENT_LABEL.tipo_que_nao_existe).toBeUndefined();
    expect(TABELA_DO_AUTOR.tipo_que_nao_existe).toBeUndefined();
  });
});

describe('podeSerOcultado', () => {
  // `live_chat` não tem coluna `hidden_at`. Confirmar um item de chat na fila
  // apaga a mensagem; nos outros tipos, oculta. Se esta regra divergir, o botão
  // volta a prometer "Confirmar ocultação" sem nada acontecer.
  it('chat não se oculta', () => {
    expect(podeSerOcultado('chat')).toBe(false);
  });

  it.each(['post', 'comment', 'mural'])('%s se oculta', tipo => {
    expect(podeSerOcultado(tipo)).toBe(true);
  });
});


// ── Escolha de punição ───────────────────────────────────────────────────────
//
// Regressão de desenho: aprovar um item sem marcar ação gerava ZERO ponto, em
// silêncio. Como a escalação automática (8 pontos suspende, 15 bane) só é
// alimentada por esses cliques, o hábito de "aprovar e seguir" fazia a punição
// existir no papel e nunca disparar. "Não punir" passou a ser uma opção que se
// MARCA — o painel recusa confirmar sem escolha.
describe('ações e pontos', () => {
  it('"sem punição" existe e vale 0', () => {
    expect(ACTION_POINTS[SEM_PUNICAO]).toBe(0);
  });

  it('toda ação oferecida no painel tem pontuação definida', () => {
    for (const acao of ['none', 'warn', 'hide', 'suspend_1d', 'suspend_7d']) {
      expect(ACTION_POINTS[acao]).toBeTypeOf('number');
    }
  });

  it('ação desconhecida não tem pontuação — não cai num padrão', () => {
    expect(ACTION_POINTS.acao_inventada).toBeUndefined();
  });

  // Os limiares vivem em `site_config` (mod_suspend_threshold=8,
  // mod_ban_threshold=15). Mexer nos pontos sem olhar os limiares muda o
  // comportamento da punição automática sem ninguém perceber.
  it('mantém a escala combinada com os limiares do banco', () => {
    expect(ACTION_POINTS).toEqual({ none: 0, warn: 1, hide: 2, suspend_1d: 5, suspend_7d: 10 });
  });
});
