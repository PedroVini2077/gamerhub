import { describe, it, expect } from 'vitest';
import { nadaFoiDesenhado } from '../framesDeVideo';

/**
 * Trava do quadro em branco — a falha de vídeo mais perigosa que já apareceu.
 *
 * ── O que ela impede ────────────────────────────────────────────────────────
 *
 * `ctx.drawImage(video, …)` com um vídeo que o navegador NÃO decodificou não
 * lança exceção: ele simplesmente não desenha. O `<canvas>` nasce inteiramente
 * transparente, então `toDataURL` devolve um JPEG válido, do tamanho certo, e
 * em branco.
 *
 * Esse JPEG seguia para a moderação, que respondia `score 0`, e o vídeo era
 * gravado como **analisado e limpo**. Isso é pior do que não analisar: a
 * ausência de análise aparece como pendência, enquanto a análise falsa afirma
 * que alguém olhou. É a sétima fonte de silêncio do §1.5 na sua forma mais
 * cara — o sistema não fica mudo, ele **mente**.
 *
 * ── Por que alpha, e não brilho ─────────────────────────────────────────────
 *
 * Um quadro legitimamente preto (abertura de vídeo, corte, fade) é conteúdo
 * real e precisa passar. Quadro de vídeo é sempre OPACO — alpha 255 — porque a
 * decodificação escreve os quatro canais. Alpha 0 em toda a amostra não é
 * julgamento sobre o que a imagem mostra: é a prova de que nenhum pixel foi
 * escrito ali.
 *
 * Para ver a trava funcionando: troque o `dados[i] !== 0` de
 * `nadaFoiDesenhado` por `false` e rode — o teste do quadro transparente
 * falha dizendo que um canvas vazio passou por conteúdo.
 */

/** Monta um buffer RGBA de `n` pixels com o alpha pedido. */
const pixels = (n, alpha, cor = 0) =>
  Uint8ClampedArray.from(
    Array.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? alpha : cor)),
  );

describe('nadaFoiDesenhado — o quadro em branco não pode virar "limpo"', () => {
  it('canvas intocado (tudo transparente) é reprovado', () => {
    expect(
      nadaFoiDesenhado(pixels(64, 0)),
      'Um canvas onde o drawImage não escreveu nada passou por quadro válido.\n'
      + 'Esse JPEG em branco vai para a moderação, volta com score 0, e o vídeo\n'
      + 'fica registrado como ANALISADO E LIMPO sem nunca ter sido olhado.',
    ).toBe(true);
  });

  it('quadro preto de verdade (opaco) é aceito — é conteúdo', () => {
    expect(
      nadaFoiDesenhado(pixels(64, 255, 0)),
      'Fade, corte e abertura de vídeo são pretos e OPACOS. Reprová-los\n'
      + 'transformaria vídeo legítimo em "não analisado" — o erro oposto.',
    ).toBe(false);
  });

  it('quadro colorido normal é aceito', () => {
    expect(nadaFoiDesenhado(pixels(64, 255, 128))).toBe(false);
  });

  it('basta UM pixel opaco para o quadro valer', () => {
    const dados = pixels(64, 0);
    dados[3] = 255;
    expect(
      nadaFoiDesenhado(dados),
      'Vídeo com borda transparente ou letterbox ainda é vídeo desenhado.',
    ).toBe(false);
  });

  it('buffer vazio ou ausente conta como nada desenhado', () => {
    expect(nadaFoiDesenhado(new Uint8ClampedArray(0))).toBe(true);
    expect(nadaFoiDesenhado(undefined)).toBe(true);
    expect(nadaFoiDesenhado(null)).toBe(true);
  });
});
