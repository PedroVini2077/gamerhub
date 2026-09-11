// Deriva o SVG da marca A PARTIR DA ARTE, por medição — não por redesenho.
//
// ── Por que este script existe ──────────────────────────────────────────────
//
// `[11/09]` O dono trouxe a marca pronta (um monograma GH hexagonal) e pediu
// uma coisa só: *"pelo amor de Deus, eu preciso de fidelidade nisso aqui"*.
//
// Eu já tinha tentado desenhar marca duas vezes neste projeto, e as duas foram
// recusadas — a última com a palavra exata: *"muito gradadão"*. Redesenhar no
// olho seria a terceira tentativa do mesmo erro.
//
// Então o caminho aqui é outro: **ler os pixels da arte dele** e derivar a
// geometria. O que sai não é a minha interpretação do desenho; é o desenho.
//
// ── Como ele funciona ───────────────────────────────────────────────────────
//
// 1. recorta o ícone monocromático (preto sobre branco) da folha de arte —
//    é a versão mais limpa, sem gradiente nem brilho para atrapalhar;
// 2. binariza: escuro = marca, claro = fundo;
// 3. acha os contornos, incluindo os VAZIOS de dentro (as contraformas do G e
//    do H) — sem eles a marca vira um borrão sólido;
// 4. simplifica cada contorno por Ramer–Douglas–Peucker. A marca é feita de
//    retas, então centenas de pixels viram poucos vértices **sem perder forma**;
// 5. emite um `path` com `fill-rule: evenodd`, que é o que faz os vazios serem
//    vazios.
//
// ── A prova, e ela é medida ─────────────────────────────────────────────────
//
// `scripts/conferir-fidelidade.mjs` desenha o SVG gerado por cima do recorte
// original e conta os pixels que discordam. Fidelidade aqui é número, não
// opinião minha sobre o meu próprio trabalho.
//
// Uso:  node scripts/tracar-marca.mjs <arte.png>

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

/** O Chromium que já vem no ambiente. O do Playwright mudou de revisão no bump. */
const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/**
 * Onde o ícone monocromático está na folha, em fração da imagem.
 *
 * Medido na folha de 1536x1024 que o dono mandou: é o quarto ícone da fileira
 * de baixo, marca preta sobre fundo branco.
 */
const RECORTE = { x0: 0.408, x1: 0.532, y0: 0.752, y1: 0.936 };

/** Acima disto o pixel é fundo. O ícone é preto puro sobre branco puro. */
const LIMIAR = 110;

/**
 * Tolerância do RDP, em pixels da grade ampliada.
 *
 * NÃO é "menor = mais fiel". A arte de origem é pequena e anti-serrilhada, então
 * a borda binarizada vira uma ESCADA de ~2 px. Com tolerância abaixo da altura
 * do degrau, o RDP preserva cada degrau — 387 vértices numa forma de ~20 retas,
 * e a diagonal do hexágono sai serrilhada. Acima dela, a reta passa por dentro
 * da escada, que é o que a arte original queria dizer.
 */
const TOLERANCIA = 2.6;

const arte = process.argv[2];
if (!arte) {
  console.error('\n  uso: node scripts/tracar-marca.mjs <arte.png>\n');
  process.exit(1);
}

const nav = await chromium.launch({ executablePath: CHROMIUM });
const pagina = await (await nav.newContext()).newPage();
const b64 = readFileSync(arte).toString('base64');

/** Recorta e amplia: mais pixels no contorno = vértice mais preciso. */
const { largura, altura, bits, recorte } = await pagina.evaluate(
  async ({ b64, RECORTE, LIMIAR }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();

    const sx = Math.round(img.naturalWidth * RECORTE.x0);
    const sy = Math.round(img.naturalHeight * RECORTE.y0);
    const sw = Math.round(img.naturalWidth * (RECORTE.x1 - RECORTE.x0));
    const sh = Math.round(img.naturalHeight * (RECORTE.y1 - RECORTE.y0));

    const escala = 3;
    const c = document.createElement('canvas');
    c.width = sw * escala; c.height = sh * escala;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);

    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const bits = new Array(c.width * c.height);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      // Luminância. O alfa entra porque a folha pode ter fundo transparente.
      const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      bits[p] = (d[i + 3] > 128 && lum < LIMIAR) ? 1 : 0;
    }
    return {
      largura: c.width, altura: c.height, bits,
      recorte: { sx, sy, sw, sh },
      base: c.toDataURL('image/png').split(',')[1],
    };
  },
  { b64, RECORTE, LIMIAR },
);

const dentro = (x, y) => x >= 0 && y >= 0 && x < largura && y < altura;
const marca = (x, y) => (dentro(x, y) ? bits[y * largura + x] === 1 : false);

/**
 * Contorno por ARESTAS DE FRONTEIRA encadeadas.
 *
 * A primeira versão usava seguidor de parede (vizinhança de Moore) e ficou
 * pingando: varreu a grade inteira e devolveu 1,28 MILHÃO de pontos num
 * contorno só. Este método não tem esse modo de falha, porque não decide para
 * onde virar — ele só liga pedaço com pedaço.
 *
 * A ideia: para cada pixel da marca, toda face que encosta em fundo vira um
 * segmento ORIENTADO, sempre com a marca do mesmo lado. Orientação consistente
 * faz cada vértice da grade ter exatamente uma entrada e uma saída, e os
 * segmentos se encadeiam sozinhos em laços fechados.
 *
 * Brinde: os VAZIOS saem com sentido invertido, que é exatamente o que o
 * `fill-rule` precisa para furar a forma.
 */
function acharContornos() {
  const saindo = new Map();   // "x,y" -> [ [x2,y2], ... ]
  const chave = (x, y) => `${x},${y}`;
  const ligar = (ax, ay, bx, by) => {
    const k = chave(ax, ay);
    if (!saindo.has(k)) saindo.set(k, []);
    saindo.get(k).push([bx, by]);
  };

  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (!marca(x, y)) continue;
      // Sentido horário em coordenada de tela, com a marca sempre à direita.
      if (!marca(x, y - 1)) ligar(x, y, x + 1, y);           // topo
      if (!marca(x + 1, y)) ligar(x + 1, y, x + 1, y + 1);   // direita
      if (!marca(x, y + 1)) ligar(x + 1, y + 1, x, y + 1);   // base
      if (!marca(x - 1, y)) ligar(x, y + 1, x, y);           // esquerda
    }
  }

  const laços = [];
  for (const [k, destinos] of saindo) {
    while (destinos.length) {
      const pontos = [];
      let [cx, cy] = k.split(',').map(Number);
      let seguro = 0;
      while (true) {
        const lista = saindo.get(chave(cx, cy));
        if (!lista || !lista.length) break;
        const [nx, ny] = lista.pop();
        pontos.push([cx, cy]);
        cx = nx; cy = ny;
        if (cx === Number(k.split(',')[0]) && cy === Number(k.split(',')[1])) break;
        if (++seguro > largura * altura) break;
      }
      if (pontos.length >= 8) laços.push(pontos);
    }
  }
  return laços;
}

/** Ramer–Douglas–Peucker: tira vértice que não muda a forma. */
function simplificar(pts, tol) {
  if (pts.length < 3) return pts;
  let pior = 0, indice = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay;
  const norma = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / norma;
    if (d > pior) { pior = d; indice = i; }
  }
  if (pior <= tol) return [pts[0], pts[pts.length - 1]];
  return [
    ...simplificar(pts.slice(0, indice + 1), tol).slice(0, -1),
    ...simplificar(pts.slice(indice), tol),
  ];
}

// ── Acha todos os contornos: a silhueta e os vazios de dentro ──────────────
//
// Varre de cima para baixo. Cada transição fundo->marca que ainda não foi
// visitada abre um contorno novo; cada transição marca->fundo abre o contorno
// de um VAZIO. Sem os vazios, o G e o H somem e sobra um hexágono cheio.
const contornos = acharContornos();

if (!contornos.length) {
  console.error('\n  Nenhum contorno encontrado. O recorte pegou area vazia?');
  console.error(`  Recorte: ${JSON.stringify(recorte)}  limiar: ${LIMIAR}\n`);
  await nav.close();
  process.exit(1);
}

// ── Normaliza para um viewBox de 100x100, preservando proporção ────────────
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const c of contornos) for (const [x, y] of c) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const escalaSaida = 100 / Math.max(maxX - minX, maxY - minY);
const deslocaX = (100 - (maxX - minX) * escalaSaida) / 2;
const deslocaY = (100 - (maxY - minY) * escalaSaida) / 2;
const n = (v) => Math.round(v * 100) / 100;

const partes = contornos.map((c) => {
  const s = simplificar(c, TOLERANCIA);
  const d = s.map(([x, y], i) =>
    `${i ? 'L' : 'M'}${n((x - minX) * escalaSaida + deslocaX)} ${n((y - minY) * escalaSaida + deslocaY)}`);
  return d.join(' ') + ' Z';
});

mkdirSync('/tmp/marca', { recursive: true });
writeFileSync('/tmp/marca/caminho.json', JSON.stringify({
  d: partes.join(' '),
  contornos: contornos.length,
  vertices: partes.reduce((t, p) => t + (p.match(/[ML]/g) || []).length, 0),
  recorte,
}, null, 2));

console.log(`\n  ${contornos.length} contorno(s) · `
  + `${contornos.reduce((t, c) => t + c.length, 0)} pontos brutos -> `
  + `${partes.reduce((t, p) => t + (p.match(/[ML]/g) || []).length, 0)} vertices\n`);
console.log('  caminho salvo em /tmp/marca/caminho.json\n');

await nav.close();
