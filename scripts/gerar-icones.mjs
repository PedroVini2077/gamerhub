// Gera favicon e ícones do PWA a partir da FONTE ÚNICA do caminho da marca.
//
// `[11/09]` Existe para que nenhum ícone seja uma cópia à mão. Todos saem de
// `src/lib/marca.js`, que por sua vez foi derivado da arte do dono por medição
// (`scripts/tracar-marca.mjs`). Trocar a marca é trocar a arte e rodar de novo —
// nunca editar um PNG.
//
// Por que PNG para o PWA e SVG para o favicon: o navegador aceita SVG no
// favicon há anos e ele fica nítido em qualquer densidade, mas Android e iOS
// ainda querem bitmap no manifesto e no apple-touch.
//
// Uso:  node scripts/gerar-icones.mjs

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../src/lib/marca.js';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** O fundo dos ícones de app. Igual ao `theme-color` do site. */
const FUNDO = '#060608';

/**
 * O que gerar. `margem` é a folga em torno da marca, em fração do lado.
 *
 * O apple-touch NÃO é transparente e leva margem maior de propósito: o iOS
 * recorta o ícone em quadrado arredondado e corta o que encostar na borda.
 */
const ALVOS = [
  { arquivo: 'public/icone-192.png', lado: 192, margem: 0.16, fundo: FUNDO },
  { arquivo: 'public/icone-512.png', lado: 512, margem: 0.16, fundo: FUNDO },
  { arquivo: 'public/apple-touch-icon.png', lado: 180, margem: 0.20, fundo: FUNDO },
  // Maskable: o Android corta um círculo de ~80% do lado. Margem grande, ou a
  // marca perde as pontas do hexágono no recorte.
  { arquivo: 'public/icone-maskable-512.png', lado: 512, margem: 0.28, fundo: FUNDO },
];

/** O SVG da marca, com ou sem fundo. Usado pelo favicon e pelos PNGs. */
export function svgDaMarca({ fundo = null, margem = 0, lado = 100 } = {}) {
  const escala = 1 - margem * 2;
  const deslocamento = (100 * margem);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${lado}" height="${lado}">`
    + `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">`
    + PARADAS_DO_GRADIENTE.map(({ pos, cor }) =>
        `<stop offset="${pos}%" stop-color="${cor}"/>`).join('')
    + `</linearGradient></defs>`
    + (fundo ? `<rect width="100" height="100" rx="22" fill="${fundo}"/>` : '')
    + `<g transform="translate(${deslocamento} ${deslocamento}) scale(${escala})">`
    + `<path d="${CAMINHO_DA_MARCA}" fill="url(#g)" fill-rule="evenodd"/></g></svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync('public', { recursive: true });

  // O favicon é SVG: nítido em qualquer densidade, e sem fundo para respeitar
  // a aba clara ou escura do navegador.
  writeFileSync('public/favicon.svg', svgDaMarca());

  const nav = await chromium.launch({ executablePath: CHROMIUM });
  const pagina = await (await nav.newContext()).newPage();

  for (const alvo of ALVOS) {
    const svg = svgDaMarca({ fundo: alvo.fundo, margem: alvo.margem, lado: alvo.lado });
    const b64 = await pagina.evaluate(async ({ svg, lado }) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = lado;
      c.getContext('2d').drawImage(img, 0, 0, lado, lado);
      return c.toDataURL('image/png').split(',')[1];
    }, { svg, lado: alvo.lado });
    writeFileSync(alvo.arquivo, Buffer.from(b64, 'base64'));
    console.log(`  ${alvo.arquivo.padEnd(34)} ${alvo.lado}px`);
  }

  await nav.close();
  console.log('\n  favicon.svg + 4 PNGs gerados da fonte unica.\n');
}
