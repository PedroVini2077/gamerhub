import { describe, it, expect } from 'vitest';
import { CONTENT_LABEL, ACTION_POINTS, podeSerOcultado, FONTE_DO_CONTEUDO as FONTE, TABELA_DO_AUTOR } from '../queueLabels';

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

describe('ACTION_POINTS', () => {
  // Os limiares de escalação vivem em `site_config`: 8 suspende, 15 bane.
  // Se alguém mexer nos pontos sem olhar os limiares, a punição automática
  // muda de comportamento sem ninguém perceber.
  it('mantém a escala combinada com os limiares do banco', () => {
    expect(ACTION_POINTS).toEqual({ warn: 1, hide: 2, suspend_1d: 5, suspend_7d: 10 });
  });
});
