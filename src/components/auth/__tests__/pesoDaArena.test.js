import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trava do PESO das artes do login e do cadastro.
 *
 * ── Por que existe, e por que nenhum portão atual pegaria ───────────────────
 *
 * O `orcamento-de-bytes.mjs` do CI mede **JavaScript e CSS**. Imagem não passa
 * por ele — então trocar estas artes por um PNG de 2,5 MB deixaria o CI verde e
 * a porta de entrada do site pesando megabytes.
 *
 * E 2,5 MB não é exagero retórico: é exatamente o tamanho dos arquivos que o
 * dono mandou. Eles só entraram porque foram recortados no limite do canal alfa
 * e convertidos para WebP em dois tamanhos.
 *
 * ── O que se está protegendo ────────────────────────────────────────────────
 *
 * Login e cadastro são a **camada 2** (§0.4): todo mundo que decide ficar passa
 * por aqui, e boa parte chega no celular, em rede móvel. Enfeite de fundo não
 * pode custar o mesmo que a página inteira.
 *
 * Os tetos abaixo têm folga sobre o tamanho de hoje — eles existem para pegar
 * uma TROCA descuidada, não para brigar por 2 KB. Se uma arte nova legítima não
 * couber, o certo é reexportar menor (ou baixar a qualidade), não subir o teto
 * sem pensar: o número é a decisão, não o obstáculo.
 */
describe('as artes da arena de entrada cabem no que a camada 2 pode pagar', () => {
  const PASTA = 'src/assets/auth';
  const TETO_POR_ARQUIVO = 180 * 1024;   // maior hoje: 150 KB (gelo-guarda-720)
  const TETO_TOTAL       = 800 * 1024;   // hoje: 639 KB, com os dois tamanhos

  const arquivos = readdirSync(PASTA).filter((f) => /\.(webp|png|jpe?g|avif)$/i.test(f));

  it('a pasta tem as artes que a arena importa', () => {
    // Prova que leu de verdade: sem isto, renomear a pasta deixaria os dois
    // testes abaixo verdes para sempre, sobre uma lista vazia.
    expect(arquivos.length,
      `nenhuma imagem em ${PASTA} — a pasta mudou de lugar? Sem isto os tetos\n`
      + '  abaixo não verificam nada.').toBeGreaterThanOrEqual(8);
  });

  it('nenhuma arte sozinha passa do teto', () => {
    const gordas = arquivos
      .map((f) => ({ f, b: statSync(join(PASTA, f)).size }))
      .filter(({ b }) => b > TETO_POR_ARQUIVO);

    expect(gordas.map(({ f, b }) => `${f} (${Math.round(b / 1024)} KB)`),
      'arte acima de 180 KB na tela de entrada.\n'
      + '  Reexporte menor: `ffmpeg -i orig.png -vf "crop=...,scale=-1:720" '
      + '-c:v libwebp -q:v 70 saida.webp`.\n'
      + '  O caminho errado é subir o teto — a camada 2 e a que todo mundo paga.')
      .toEqual([]);
  });

  it('o conjunto todo cabe no teto total', () => {
    const total = arquivos.reduce((n, f) => n + statSync(join(PASTA, f)).size, 0);
    expect(total,
      `as artes da arena somam ${Math.round(total / 1024)} KB, acima do teto de `
      + `${TETO_TOTAL / 1024} KB.\n`
      + '  Lembre que sao DOIS tamanhos por personagem (celular e desktop) — se\n'
      + '  entrou personagem novo, ele trouxe dois arquivos, nao um.')
      .toBeLessThanOrEqual(TETO_TOTAL);
  });
});
