import * as THREE from 'three';

// Transformar um contorno 2D num SÓLIDO de cristal — o passo que faltava.
//
// ── O diagnóstico, com número ───────────────────────────────────────────────
//
// `[10/09]` A peça anterior tinha **436 triângulos** e era uma extrusão
// chapada: duas tampas planas ligadas por uma parede reta. Nenhuma faceta,
// nenhuma mudança de plano, nenhuma espessura variável. O dono comparou com a
// arte e disse *"totalmente deformado"*, e o prompt dele descreve exatamente o
// erro: *"geometria simples + shader complexo = 'cristal'"* é o que **não**
// fazer.
//
// O modelo de referência que ele mandou tem **15.805 triângulos** e, de perfil,
// uma seção de LÂMINA — fina nas pontas, abaulada no núcleo. Foi essa vista
// lateral que fechou o diagnóstico: o problema nunca foi o material.
//
// ── Os três passos, e por que nesta ordem ───────────────────────────────────
//
// | Passo | O que resolve |
// | --- | --- |
// | **1. extrudar com chanfro** | dá a aresta viva e as duas mudanças de plano que separam vidro de plástico pintado |
// | **2. subdividir** | a tampa da extrusão só tem vértice na BORDA. Sem subdividir não existe onde abaular — o passo 3 não teria em que pegar |
// | **3. moldar pelo Z** | cada vértice recebe altura em função da distância até a borda: 0 na aresta, máximo no miolo. É o que produz a lâmina |
//
// Inverter 2 e 3 devolve a peça chapada, e foi assim que a primeira tentativa
// saiu — eu moldei uma malha que não tinha vértice interno para mover.

/** Distância de um ponto ao segmento `a-b`, no plano. */
function distanciaAoSegmento(px, py, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const comprimento = dx * dx + dy * dy;
  if (comprimento === 0) return Math.hypot(px - a[0], py - a[1]);
  let t = ((px - a[0]) * dx + (py - a[1]) * dy) / comprimento;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/**
 * Distância até a borda MAIS PRÓXIMA, contando o furo.
 *
 * O furo conta como borda de propósito: sem isso a peça engrossaria por cima do
 * buraco do núcleo, e a parede interna dele perderia a aresta.
 */
function distanciaAteABorda(px, py, aneis) {
  let menor = Infinity;
  for (const anel of aneis) {
    for (let i = 0; i < anel.length; i++) {
      const d = distanciaAoSegmento(px, py, anel[i], anel[(i + 1) % anel.length]);
      if (d < menor) menor = d;
    }
  }
  return menor;
}

/**
 * Uma passada de subdivisão em malha NÃO indexada: cada triângulo vira quatro.
 *
 * Não indexada de propósito — a peça é facetada, e faceta exige normal por
 * face, o que exige vértice por face. Compartilhar vértice suavizaria
 * exatamente o que a gente quer que fique duro.
 */
function subdividir(posicoes) {
  const saida = new Float32Array(posicoes.length * 4);
  let k = 0;
  // Os pontos médios ficam em arrays JS, NÃO em espaço de rascunho dentro de
  // `saida`: o último triângulo escreveria além do fim e o `Float32Array`
  // engoliria a escrita em silêncio, devolvendo `undefined` na leitura de volta
  // — malha inteira com `NaN`, sem erro nenhum.
  const ler = (i) => [posicoes[i], posicoes[i + 1], posicoes[i + 2]];
  const medio = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, (u[2] + v[2]) / 2];
  const por = (v) => { saida[k] = v[0]; saida[k + 1] = v[1]; saida[k + 2] = v[2]; k += 3; };
  for (let t = 0; t < posicoes.length; t += 9) {
    const A = ler(t), B = ler(t + 3), C = ler(t + 6);
    const AB = medio(A, B), BC = medio(B, C), CA = medio(C, A);
    por(A); por(AB); por(CA);
    por(AB); por(B); por(BC);
    por(CA); por(BC); por(C);
    por(AB); por(BC); por(CA);
  }
  return saida;
}

/**
 * O perfil da lâmina: quanta espessura existe a `d` da borda.
 *
 * `Math.sqrt` e não linear porque a subida tem que ser RÁPIDA junto da aresta e
 * lenta no miolo — é o que dá aresta fina com corpo cheio. Linear produz um
 * telhado de duas águas, que lê como origami, não como cristal.
 */
function perfilDaLamina(d, alcance) {
  const t = Math.min(1, d / alcance);
  return Math.sqrt(t);
}

/**
 * Constrói o sólido.
 *
 * @param {number[][]} externo contorno anti-horário
 * @param {number[][][]} furos contornos horários
 */
export function construirSolido(externo, furos, {
  espessura = 0.17,
  alcance = 0.20,
  chanfro = 0.016,
  segmentosDeChanfro = 3,
  subdivisoes = 1,
  afinarLonge = null,
} = {}) {
  const forma = new THREE.Shape(externo.map(([x, y]) => new THREE.Vector2(x, y)));
  forma.holes = furos.map((f) => new THREE.Path(f.map(([x, y]) => new THREE.Vector2(x, y))));

  const bruta = new THREE.ExtrudeGeometry(forma, {
    depth: espessura,
    bevelEnabled: true,
    bevelSegments: segmentosDeChanfro,
    bevelSize: chanfro,
    bevelThickness: chanfro * 1.6,
    steps: 1,
    curveSegments: 1,
  });
  // Centrar SÓ em Z, e isto não é detalhe: a moldagem mede a distância de cada
  // vértice até o polígono ORIGINAL, então mexer em X ou Y aqui faria a peça ser
  // moldada por um contorno que não é o dela. Em Z é obrigatório — a extrusão
  // nasce de 0 a `espessura`, e a moldagem lê o SINAL de Z para saber de que
  // lado da lâmina o vértice está. Sem centrar, o sinal é sempre positivo e a
  // peça sai com uma face só.
  bruta.translate(0, 0, -espessura / 2);

  let posicoes = bruta.toNonIndexed().attributes.position.array.slice();
  bruta.dispose();
  for (let i = 0; i < subdivisoes; i++) posicoes = subdividir(posicoes);

  // ── Moldar ────────────────────────────────────────────────────────────────
  const aneis = [externo, ...furos];
  for (let i = 0; i < posicoes.length; i += 3) {
    const x = posicoes[i];
    const y = posicoes[i + 1];
    const lado = Math.sign(posicoes[i + 2]) || 1;
    const d = distanciaAteABorda(x, y, aneis);
    let z = lado * (espessura / 2) * perfilDaLamina(d, alcance);
    // A peça é mais grossa perto do núcleo e afina nas pontas — é a seção que
    // o modelo de referência mostra de perfil, e o que impede as duas lâminas
    // de lerem como papel recortado.
    if (afinarLonge) {
      const r = Math.hypot(x - afinarLonge.centro[0], y - afinarLonge.centro[1]);
      const k = Math.max(afinarLonge.minimo, 1 - (r / afinarLonge.alcance) ** 1.5);
      z *= k;
    }
    posicoes[i + 2] = z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  geo.computeVertexNormals();   // não indexada -> normal por FACE, faceta dura
  return geo;
}

/** Quantos triângulos tem uma geometria construída aqui. */
export function triangulos(geo) {
  return geo.attributes.position.count / 3;
}
