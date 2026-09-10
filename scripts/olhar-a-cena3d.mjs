// Renderiza a geometria da cena 3D em PNG, de vários ângulos.
//
// ── Por que este script existe ──────────────────────────────────────────────
//
// `[10/09]` A primeira cena 3D construída em código foi entregue **sem eu ter
// olhado a peça uma vez**. Build passou, teste passou, portão passou — e a
// forma estava deformada. Nenhum portão pega isso: não existe teste automático
// para *"parece com o desenho?"*.
//
// Isto não é portão e não reprova nada. É o passo de OLHAR, virado ferramenta
// para deixar de depender de eu lembrar de fazê-lo.
//
// Uso:
//   node scripts/olhar-a-cena3d.mjs [pasta-de-saida] [--sem-material]
//
// `--sem-material` desliga o shader e usa cinza fosco. É o teste que o dono
// pediu no prompt: *"quando desligarmos glow, bloom, partículas e shaders, a
// lightning ainda deve possuir boa silhueta, volume, facetas e profundidade"*.
// Se a peça só fica boa COM shader, o problema é a malha.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const SAIDA = process.argv[2] ?? 'vistas';
const CRU = process.argv.includes('--sem-material');
const PORTA = 4615;

const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
};

const pagina = `<!doctype html><meta charset=utf-8>
<body style="margin:0;background:#07100b">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
import { construirMetades, construirNucleo, construirLascas, CENTRO_DO_NUCLEO }
  from '/src/components/landing/scene3d/geometriaDoRaio.js';
import { criarMaterialDeCristal, criarMaterialDoNucleo }
  from '/src/components/landing/scene3d/materialDeCristal.js';

const CRU = ${CRU};
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(760, 900); r.setClearColor(0x07100b, 1);
document.body.appendChild(r.domElement);

const cena = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(34, 760 / 900, 0.1, 100);
cena.add(new THREE.AmbientLight(0xffffff, CRU ? 0.55 : 0.28));
const chave = new THREE.DirectionalLight(0xffffff, CRU ? 2.4 : 1.1);
chave.position.set(3, 4, 5); cena.add(chave);
const contra = new THREE.DirectionalLight(CRU ? 0xffffff : 0x7de3ff, CRU ? 1.2 : 1.6);
contra.position.set(-4, 1, -3); cena.add(contra);

const metades = construirMetades();
const nucleo = construirNucleo();
const lascas = construirLascas();
const fosco = () => new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.42, metalness: 0.1 });
const mat = (n) => (CRU ? fosco() : criarMaterialDeCristal({ nucleo: [...CENTRO_DO_NUCLEO, 0] }));

const grupo = new THREE.Group();
grupo.add(new THREE.Mesh(metades.superior, mat()));
grupo.add(new THREE.Mesh(metades.inferior, mat()));
const mn = new THREE.Mesh(nucleo, CRU ? fosco() : criarMaterialDoNucleo());
mn.position.set(CENTRO_DO_NUCLEO[0], CENTRO_DO_NUCLEO[1], 0);
grupo.add(mn);
cena.add(grupo);

// Sem a timeline, os uniforms ficam no estado de REPOUSO — senão a peça
// aparece meio materializada e a foto não diz nada sobre a forma.
grupo.traverse((o) => {
  if (o.material && o.material.uniforms) {
    o.material.uniforms.uMaterializacao.value = 1;
    o.material.uniforms.uPulso.value = 0.4;
  }
});

const caixa = new THREE.Box3().setFromObject(grupo);
const centro = caixa.getCenter(new THREE.Vector3());
const tam = caixa.getSize(new THREE.Vector3());
grupo.position.sub(centro);
const d = Math.max(tam.x, tam.y, tam.z) * 1.9;

const angulos = [
  ['frente', [0, 0, 1]],
  ['tres-quartos', [0.72, 0.18, 0.67]],
  ['perfil', [1, 0, 0.06]],
  ['de-cima', [0.42, 0.74, 0.52]],
];
window.__vistas = [];
for (const [nome, v] of angulos) {
  cam.position.set(v[0] * d, v[1] * d, v[2] * d);
  cam.lookAt(0, 0, 0);
  r.render(cena, cam);
  window.__vistas.push([nome, r.domElement.toDataURL('image/png')]);
}
window.__contas = {
  superior: metades.superior.attributes.position.count / 3,
  inferior: metades.inferior.attributes.position.count / 3,
  nucleo: nucleo.attributes.position.count / 3,
  lascas: lascas.map((g) => g.attributes.position.count / 3),
  tamanho: [tam.x, tam.y, tam.z].map((n) => +n.toFixed(3)),
};
</script>`;

const servidor = http.createServer((req, res) => {
  const rota = decodeURIComponent(req.url.split('?')[0]);
  if (rota === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(pagina); return; }
  // O código-fonte importa sem extensão (`./contornoDaMarca`), que é o que o
  // Vite resolve e o navegador NÃO. Sem este `.js` de reserva o import morre em
  // 404 e a cena nunca monta — foi assim na primeira execução.
  const tentar = (alvo, senao) => fs.readFile(path.join(RAIZ, alvo), (erro, dados) => {
    if (erro) { if (senao) { tentar(senao, null); return; } res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(alvo)] ?? 'text/javascript' });
    res.end(dados);
  });
  tentar(rota, path.extname(rota) ? null : `${rota}.js`);
});

await new Promise((r) => servidor.listen(PORTA, r));
const navegador = await chromium.launch({
  executablePath: fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
    ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const aba = await navegador.newPage({ viewport: { width: 780, height: 920 } });
const problemas = [];
aba.on('pageerror', (e) => problemas.push(e.message));
aba.on('console', (m) => { if (m.type() === 'error') problemas.push(m.text()); });
await aba.goto(`http://localhost:${PORTA}/`);
await aba.waitForFunction('window.__contas', { timeout: 60000 }).catch(() => {});

const contas = await aba.evaluate(() => window.__contas ?? null);
const vistas = await aba.evaluate(() => window.__vistas ?? []);
await navegador.close();
servidor.close();

if (problemas.length) {
  console.error('  ERROS na página:');
  for (const p of problemas.slice(0, 6)) console.error(`    ${p}`);
}
if (!contas) { console.error('  A cena não montou — nada foi renderizado.'); process.exit(1); }

fs.mkdirSync(SAIDA, { recursive: true });
for (const [nome, url] of vistas) {
  fs.writeFileSync(path.join(SAIDA, `${nome}.png`), Buffer.from(url.split(',')[1], 'base64'));
}

const total = contas.superior + contas.inferior + contas.nucleo
  + contas.lascas.reduce((a, b) => a + b, 0);
console.log(`\n  ${CRU ? 'SEM material (só a malha)' : 'com o material de cristal'}`);
console.log(`  superior ${contas.superior} · inferior ${contas.inferior} · núcleo ${contas.nucleo}`);
console.log(`  ${contas.lascas.length} lasca(s) de ${contas.lascas[0] ?? 0} triângulos`);
console.log(`  TOTAL ${total} triângulos · caixa ${contas.tamanho.join(' x ')}`);
console.log(`  ${vistas.length} vista(s) em ${SAIDA}/\n`);
