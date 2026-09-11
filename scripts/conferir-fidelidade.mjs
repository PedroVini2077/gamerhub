// A prova de que o SVG derivado é FIEL à arte — em número, não em opinião.
//
// `[11/09]` O dono pediu uma coisa só ao mandar a marca pronta: *"pelo amor de
// Deus, eu preciso de fidelidade nisso aqui"*. "Ficou parecido" é exatamente o
// tipo de afirmação que o §1.1 proíbe — é impressão minha sobre o meu próprio
// trabalho.
//
// Então aqui a fidelidade vira medida: desenha o SVG gerado e o recorte da arte
// no MESMO tamanho, compara pixel a pixel, e devolve a porcentagem que discorda.
// Salva também um mapa da diferença, onde vermelho é onde os dois discordam.
//
// Uso:  node scripts/conferir-fidelidade.mjs <arte.png>

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LADO = 512;

const arte = process.argv[2];
const { d, recorte } = JSON.parse(readFileSync('/tmp/marca/caminho.json', 'utf8'));

const nav = await chromium.launch({ executablePath: CHROMIUM });
const pagina = await (await nav.newContext()).newPage();
const b64 = readFileSync(arte).toString('base64');

const r = await pagina.evaluate(async ({ b64, d, recorte, LADO }) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();

  // A arte, recortada e normalizada para o mesmo quadrado do SVG.
  // Primeiro recorta cru, para achar a CAIXA da marca. Sem isto, a margem
  // branca do icone arredondado entra na conta e vira "diferenca" — que nao e
  // diferenca de forma nenhuma, e foi o que deu 86% na primeira medicao.
  const cru = document.createElement('canvas');
  cru.width = recorte.sw; cru.height = recorte.sh;
  const cc = cru.getContext('2d');
  cc.fillStyle = '#fff'; cc.fillRect(0, 0, cru.width, cru.height);
  cc.drawImage(img, recorte.sx, recorte.sy, recorte.sw, recorte.sh, 0, 0, cru.width, cru.height);
  const px = cc.getImageData(0, 0, cru.width, cru.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < cru.height; y++) {
    for (let x = 0; x < cru.width; x++) {
      const i = (y * cru.width + x) * 4;
      if ((px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) < 110) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const maior = Math.max(cw, ch);

  const orig = document.createElement('canvas');
  orig.width = orig.height = LADO;
  const oc = orig.getContext('2d');
  oc.fillStyle = '#fff'; oc.fillRect(0, 0, LADO, LADO);
  // Mesma normalizacao que o tracador faz: centraliza no maior lado.
  const esc = LADO / maior;
  oc.drawImage(cru, x0, y0, cw, ch,
    (LADO - cw * esc) / 2, (LADO - ch * esc) / 2, cw * esc, ch * esc);

  // O SVG gerado, no mesmo quadrado.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${LADO}" height="${LADO}">`
    + `<rect width="100" height="100" fill="#fff"/>`
    + `<path d="${d}" fill="#000" fill-rule="evenodd"/></svg>`;
  const imgSvg = new Image();
  imgSvg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  await imgSvg.decode();
  const meu = document.createElement('canvas');
  meu.width = meu.height = LADO;
  meu.getContext('2d').drawImage(imgSvg, 0, 0, LADO, LADO);

  // Binariza os dois do mesmo jeito e conta onde discordam.
  const a = oc.getImageData(0, 0, LADO, LADO).data;
  const b = meu.getContext('2d').getImageData(0, 0, LADO, LADO).data;
  const diff = document.createElement('canvas');
  diff.width = diff.height = LADO;
  const dc = diff.getContext('2d');
  const saida = dc.createImageData(LADO, LADO);

  let discordam = 0, marcaOrig = 0, marcaMinha = 0;
  for (let i = 0; i < a.length; i += 4) {
    const escuroA = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) < 110;
    const escuroB = (b[i] * 0.299 + b[i + 1] * 0.587 + b[i + 2] * 0.114) < 110;
    if (escuroA) marcaOrig++;
    if (escuroB) marcaMinha++;
    if (escuroA !== escuroB) {
      discordam++;
      saida.data[i] = 255; saida.data[i + 1] = 0; saida.data[i + 2] = 0; saida.data[i + 3] = 255;
    } else if (escuroA) {
      saida.data[i] = saida.data[i + 1] = saida.data[i + 2] = 40; saida.data[i + 3] = 255;
    } else {
      saida.data[i] = saida.data[i + 1] = saida.data[i + 2] = 255; saida.data[i + 3] = 255;
    }
  }
  dc.putImageData(saida, 0, 0);

  // Lado a lado, para olho humano: arte | meu | diferença
  const lado = document.createElement('canvas');
  lado.width = LADO * 3; lado.height = LADO;
  const lc = lado.getContext('2d');
  lc.drawImage(orig, 0, 0);
  lc.drawImage(meu, LADO, 0);
  lc.drawImage(diff, LADO * 2, 0);

  return {
    discordam, marcaOrig, marcaMinha, total: LADO * LADO,
    ladoALado: lado.toDataURL('image/png').split(',')[1],
  };
}, { b64, d, recorte, LADO });

writeFileSync('/tmp/marca/comparacao.png', Buffer.from(r.ladoALado, 'base64'));

const pct = (r.discordam / r.total) * 100;
// Só a área da marca importa: acertar o fundo branco é de graça.
const uniao = r.marcaOrig + r.marcaMinha - (r.marcaOrig + r.marcaMinha - r.discordam) / 2;
const pctMarca = (r.discordam / Math.max(1, uniao)) * 100;

console.log(`\n  pixels da marca — arte: ${r.marcaOrig}  meu: ${r.marcaMinha}`);
console.log(`  discordam: ${r.discordam}  (${pct.toFixed(2)}% da tela, `
  + `${pctMarca.toFixed(2)}% da area da marca)`);
console.log('\n  comparacao (arte | meu | diferenca) em /tmp/marca/comparacao.png\n');

await nav.close();
