// Extrai a silhueta do simbolo mestre: contorno externo + furos internos.
// Roda num Chromium de verdade so para DECODIFICAR o webp; toda a geometria
// e feita aqui, em JS, sobre os pixels crus.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = '/home/user/gamerhub';
const ARTE = process.argv[2] ?? 'docs/identidade/referencias/01-simbolo-mestre.webp';
const LIMIAR = Number(process.argv[3] ?? 42);
// `[10/09]` A arte mestra do 3D vem com BRILHO ao redor da peca, e brilho e
// claro: so luminancia nao separa. O discriminante e a SATURACAO — o cristal e
// saturado (croma/valor ~ 1), o brilho e lavado (~0,3). `SAT` liga esse
// segundo criterio; 0 mantem o comportamento antigo, para arte sobre preto.
const SAT = Number(process.argv[5] ?? 0);
// `[10/09]` Raio do FECHAMENTO morfologico (dilata, depois erode), em pixels.
// Arte facetada tem linhas escuras entre as faces, e onde uma delas encosta na
// borda ela abre uma fenda que serrilha a silhueta inteira. Fechar tapa fenda
// mais estreita que o raio e devolve o contorno; 0 desliga.
const FECHAR = Number(process.argv[6] ?? 0);

const srv = http.createServer((q, s) => {
  const rota = decodeURIComponent(q.url.split('?')[0]);
  if (rota === '/') { s.writeHead(200, { 'Content-Type': 'text/html' }); s.end('<!doctype html><meta charset=utf-8>'); return; }
  const f = path.join(RAIZ, rota);
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'image/webp' });
    s.end(d);
  });
});

await new Promise((r) => srv.listen(4612, r));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage();
// A pagina precisa ser da MESMA origem do servidor: `about:blank` + imagem de
// `localhost` tinge o canvas e o `getImageData` passa a ser negado.
await p.goto('http://localhost:4612/');
const { w, h, lum, sat } = await p.evaluate(async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const out = new Array(c.width * c.height);
  const sat = new Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) {
    const R = d[i * 4], G = d[i * 4 + 1], B = d[i * 4 + 2];
    out[i] = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const V = Math.max(R, G, B);
    sat[i] = V ? (V - Math.min(R, G, B)) / V : 0;
  }
  return { w: c.width, h: c.height, lum: out, sat };
}, `http://localhost:4612/${ARTE}`);
await b.close(); srv.close();

const dentro = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
const aceso = (x, y) => dentro(x, y)
  && lum[y * w + x] > LIMIAR
  && (SAT === 0 || sat[y * w + x] >= SAT);

// ── Fundo: tudo que e apagado E alcancavel a partir da borda ────────────────
const fundo = new Uint8Array(w * h);
{
  const fila = [];
  for (let x = 0; x < w; x++) { fila.push([x, 0], [x, h - 1]); }
  for (let y = 0; y < h; y++) { fila.push([0, y], [w - 1, y]); }
  while (fila.length) {
    const [x, y] = fila.pop();
    if (!dentro(x, y) || fundo[y * w + x] || aceso(x, y)) continue;
    fundo[y * w + x] = 1;
    fila.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}
// A peca = tudo que NAO e fundo. Isso tapa os furos de proposito; eles voltam
// abaixo, como componentes apagados que a borda nao alcanca.
let mascara = new Uint8Array(w * h);
for (let i = 0; i < mascara.length; i++) mascara[i] = fundo[i] ? 0 : 1;

// ── Fechamento: dilata FECHAR, erode FECHAR ────────────────────────────────
// Feito com transformada de distancia por eixo (duas passadas 1D por operacao),
// que e O(w*h) e nao O(w*h*r^2) — a arte tem 1,5 milhao de pixels.
function distanciaAte(alvo, m) {
  const INF = 1e9; const d = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = INF;
    for (let x = 0; x < w; x++) { acc = m[y * w + x] === alvo ? 0 : acc + 1; d[y * w + x] = acc; }
    acc = INF;
    for (let x = w - 1; x >= 0; x--) { acc = m[y * w + x] === alvo ? 0 : acc + 1; d[y * w + x] = Math.min(d[y * w + x], acc); }
  }
  const col = new Float64Array(h); const saida = new Float64Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = d[y * w + x] ** 2;
    for (let y = 0; y < h; y++) {
      let melhor = col[y];
      for (let k = 1; k < h; k++) {
        const q = k * k; if (q >= melhor) break;
        if (y - k >= 0) melhor = Math.min(melhor, col[y - k] + q);
        if (y + k < h) melhor = Math.min(melhor, col[y + k] + q);
      }
      saida[y * w + x] = Math.sqrt(melhor);
    }
  }
  return saida;
}
if (FECHAR > 0) {
  const dFora = distanciaAte(1, mascara);            // distancia ate a peca
  const dilatada = new Uint8Array(w * h);
  for (let i = 0; i < dilatada.length; i++) dilatada[i] = dFora[i] <= FECHAR ? 1 : 0;
  const dDentro = distanciaAte(0, dilatada);         // distancia ate o vazio
  const erodida = new Uint8Array(w * h);
  for (let i = 0; i < erodida.length; i++) erodida[i] = dDentro[i] > FECHAR ? 1 : 0;
  mascara = erodida;
}
const peca = (x, y) => dentro(x, y) && mascara[y * w + x] === 1;

// ── Moore: contorno de uma regiao, dado um ponto de partida na fronteira ────
function tracar(x0, y0, pertence) {
  const viz = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const pontos = [];
  let x = x0, y = y0, dir = 6;              // entrou vindo de cima
  const inicio = `${x0},${y0}`;
  for (let passo = 0; passo < w * h * 4; passo++) {
    pontos.push([x, y]);
    let achou = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8;
      const nx = x + viz[d][0], ny = y + viz[d][1];
      if (pertence(nx, ny)) { x = nx; y = ny; dir = d; achou = true; break; }
    }
    if (!achou) break;
    if (`${x},${y}` === inicio && pontos.length > 8) break;
  }
  return pontos;
}

// ── A peca e o MAIOR componente, nao o primeiro que aparece ────────────────
//
// `[10/09]` Isto ja custou uma rodada: varrendo de cima para baixo, o primeiro
// pixel encontrado era uma particula solta de brilho saturado em `(792, 1)`, e
// o tracado morria ali com 1 ponto. Arte com brilho tem sujeira; a peca e a
// maior mancha, e isso e criterio, nao palpite.
const marca = new Int32Array(w * h).fill(-1);
const componentes = [];
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (!peca(x, y) || marca[y * w + x] >= 0) continue;
    const id = componentes.length;
    let n = 0; const fila = [[x, y]];
    while (fila.length) {
      const [cx, cy] = fila.pop();
      const j = cy * w + cx;
      if (!peca(cx, cy) || marca[j] >= 0) continue;
      marca[j] = id; n++;
      fila.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    componentes.push({ id, n, x, y });
  }
}
componentes.sort((a, b) => b.n - a.n);
const alvo = componentes[0];
const naPeca = (x, y) => dentro(x, y) && marca[y * w + x] === alvo.id;
const externo = tracar(alvo.x, alvo.y, naPeca);

// ── Furos: componentes APAGADOS que a borda nao alcanca ─────────────────────
const visto = new Uint8Array(w * h);
const furos = [];
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    // Um FURO e pixel apagado que a borda nao alcanca. Nao da para testar por
    // `peca()`: ela e "tudo que nao e fundo", e por definicao isso INCLUI o
    // furo — foi assim que o furo hexagonal sumiu na primeira versao.
    if (visto[i] || fundo[i] || aceso(x, y)) continue;
    // componente apagado interno
    const comp = []; const fila = [[x, y]];
    while (fila.length) {
      const [cx, cy] = fila.pop();
      const j = cy * w + cx;
      if (!dentro(cx, cy) || visto[j] || fundo[j] || aceso(cx, cy)) continue;
      visto[j] = 1; comp.push([cx, cy]);
      fila.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    if (comp.length < 400) continue;                       // ruido
    // o furo tem que estar DENTRO da peca escolhida, nao de uma sujeira solta
    const vizinhoDaPeca = comp.some(([cx, cy]) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dx, dy]) => aceso(cx + dx, cy + dy)));
    if (!vizinhoDaPeca) continue;
    comp.sort((a, c) => (a[1] - c[1]) || (a[0] - c[0]));
    const [fx, fy] = comp[0];
    if (comp.some(([cx, cy]) => cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1)) continue;
    const apagadoInterno = (px, py) => dentro(px, py) && !fundo[py * w + px] && !aceso(px, py);
    furos.push({ area: comp.length, contorno: tracar(fx, fy, apagadoInterno) });
  }
}

// ── Douglas-Peucker ─────────────────────────────────────────────────────────
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const d2 = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = dx * dx + dy * dy;
    if (!L) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L;
    t = Math.max(0, Math.min(1, t));
    return (p[0] - (a[0] + t * dx)) ** 2 + (p[1] - (a[1] + t * dy)) ** 2;
  };
  let iMax = 0, dMax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = d2(pts[i], pts[0], pts[pts.length - 1]);
    if (d > dMax) { dMax = d; iMax = i; }
  }
  if (dMax > eps * eps) {
    return [...dp(pts.slice(0, iMax + 1), eps).slice(0, -1), ...dp(pts.slice(iMax), eps)];
  }
  return [pts[0], pts[pts.length - 1]];
}

const EPS = Number(process.argv[4] ?? 3.0);
const simp = (c) => dp(c, EPS);

const ex = simp(externo);
furos.sort((a, b) => b.area - a.area);
const fs2 = furos.map((f) => ({ area: f.area, pts: simp(f.contorno) }));

console.log(JSON.stringify({
  arte: ARTE, w, h, limiar: LIMIAR, eps: EPS, sat: SAT, fechar: FECHAR,
  componentes: componentes.slice(0, 4).map((c) => c.n),
  externo: { bruto: externo.length, simplificado: ex.length, pts: ex },
  furos: fs2.map((f) => ({ area: f.area, n: f.pts.length, pts: f.pts })),
}));
