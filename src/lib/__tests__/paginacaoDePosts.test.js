import { describe, it, expect } from 'vitest';
import { faixaDaPagina, TAMANHO_DA_PAGINA, SUB_ABAS } from '../paginacaoDePosts';

/**
 * Trava da paginação por sub-aba do painel de posts.
 *
 * ── O que ela impede ────────────────────────────────────────────────────────
 *
 * Que o "Carregar mais" volte a continuar de onde a lista INTEIRA parou, em vez
 * de onde a sub-aba visível parou. Esse era o bug: 20 posts misturados
 * carregados, 8 deles ativos, e o clique seguinte continuava do índice 20 —
 * pulando 12 posts ativos que nunca apareceriam na tela.
 *
 * Offset errado não estoura: ele pula ou repete linhas em silêncio, e do lado
 * de quem clica é idêntico a "não tem mais nada" (§1.5).
 *
 * Para ver a trava funcionando: troque `jaCarregados` por `posts.length` no
 * chamador, ou o `de` por `0` aqui — os testes de continuação falham dizendo
 * quantos posts sumiriam.
 */

describe('faixaDaPagina — cada sub-aba continua de onde ELA parou', () => {
  it('a primeira página começa do zero nas duas sub-abas', () => {
    expect(faixaDaPagina('active', 0)).toEqual({ apagados: false, de: 0, ate: TAMANHO_DA_PAGINA - 1 });
    expect(faixaDaPagina('deleted', 0)).toEqual({ apagados: true, de: 0, ate: TAMANHO_DA_PAGINA - 1 });
  });

  it('continua do total DAQUELA sub-aba, não da lista inteira', () => {
    // O caso real do CI: 20 posts carregados, 8 ativos. A página seguinte de
    // ativos tem que começar no 8, não no 20.
    expect(
      faixaDaPagina('active', 8),
      'A paginação de "Posts ativos" continuou de um índice que não é o número\n'
      + 'de posts ativos na tela. Com 8 ativos dentro de 20 carregados,\n'
      + 'continuar do 20 pula 12 posts ativos — e o admin nunca os vê, sem\n'
      + 'nada indicando que sumiram.',
    ).toEqual({ apagados: false, de: 8, ate: 8 + TAMANHO_DA_PAGINA - 1 });

    expect(faixaDaPagina('deleted', 12)).toEqual({
      apagados: true, de: 12, ate: 12 + TAMANHO_DA_PAGINA - 1,
    });
  });

  it('as duas sub-abas filtram por lados OPOSTOS de deleted_at', () => {
    expect(faixaDaPagina('active', 0).apagados).toBe(false);
    expect(faixaDaPagina('deleted', 0).apagados).toBe(true);
  });

  it('sub-aba desconhecida ESTOURA, em vez de escolher uma', () => {
    expect(
      () => faixaDaPagina('rascunhos', 0),
      'Uma sub-aba nova passou a cair silenciosamente numa das duas existentes.\n'
      + 'É o fallback silencioso do §4: o painel mostraria a lista errada sem\n'
      + 'nada acusar. Acrescente a sub-aba em SUB_ABAS e trate o filtro dela.',
    ).toThrow(/sub-aba desconhecida/);
    expect(() => faixaDaPagina(undefined, 0)).toThrow();
  });

  it('índice negativo não vira faixa inválida', () => {
    expect(faixaDaPagina('active', -5).de).toBe(0);
  });

  it('SUB_ABAS é a fonte única dos nomes', () => {
    expect(SUB_ABAS).toEqual(['active', 'deleted']);
  });
});
