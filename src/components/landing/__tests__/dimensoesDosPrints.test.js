import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIMENSOES_DOS_PRINTS } from '../dimensoesDosPrints';

// A trava do `dimensoesDosPrints.js`. Aquele arquivo declara o tamanho de cada
// print para o `<img>` reservar espaço e o conteúdo não pular durante a
// rolagem. Número escrito à mão ao lado de um binário diverge sozinho: basta
// alguém trocar um print por outro de proporção diferente. Este teste abre os
// JPEGs de verdade e confere.
//
// Para ver a trava funcionando, mude qualquer número no mapa e rode de novo.

const PASTA = join(dirname(fileURLToPath(import.meta.url)), '../../../assets/landing');

/**
 * Lê largura e altura do cabeçalho de um JPEG, sem biblioteca.
 *
 * Um JPEG é uma sequência de segmentos que começam com 0xFF seguido do código
 * do marcador. O tamanho da imagem está no marcador SOF ("Start Of Frame"),
 * que vai de 0xC0 a 0xCF — com três exceções que NÃO são SOF e carregam outra
 * coisa: 0xC4 (tabela de Huffman), 0xC8 (extensão JPEG) e 0xCC (definição
 * aritmética). Dentro do segmento SOF: 2 bytes de tamanho, 1 de precisão,
 * depois altura e largura, 2 bytes cada, big-endian.
 */
function lerDimensoesJpeg(caminho) {
  const b = readFileSync(caminho);
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error(`${caminho} não começa com o cabeçalho JPEG (FFD8)`);

  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marcador = b[i + 1];
    const ehSof = marcador >= 0xc0 && marcador <= 0xcf
      && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;
    if (ehSof) return { altura: b.readUInt16BE(i + 5), largura: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${caminho}: nenhum marcador SOF encontrado — arquivo corrompido?`);
}

describe('dimensões declaradas dos prints da landing', () => {
  it('cobre exatamente os arquivos que existem na pasta', () => {
    const naPasta = readdirSync(PASTA)
      .filter(n => n.endsWith('.jpg'))
      .map(n => n.replace(/\.jpg$/, ''))
      .sort();
    const declarados = Object.keys(DIMENSOES_DOS_PRINTS).sort();

    expect(
      declarados,
      'print novo em src/assets/landing/ sem entrada em dimensoesDosPrints.js '
      + '(ou entrada sobrando para um arquivo que não existe mais) — o <img> '
      + 'ficaria sem width/height e o conteúdo voltaria a pular na rolagem',
    ).toEqual(naPasta);
  });

  for (const [nome, esperado] of Object.entries(DIMENSOES_DOS_PRINTS)) {
    it(`${nome}.jpg tem o tamanho declarado`, () => {
      const real = lerDimensoesJpeg(join(PASTA, `${nome}.jpg`));
      expect(
        real,
        `dimensoesDosPrints.js diz que ${nome}.jpg é ${esperado.largura}x${esperado.altura}, `
        + `mas o arquivo é ${real.largura}x${real.altura}. Corrija o mapa — o número errado `
        + 'reserva o espaço errado e o conteúdo pula quando a imagem carrega.',
      ).toEqual(esperado);
    });
  }
});
