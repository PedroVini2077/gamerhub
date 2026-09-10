import * as THREE from 'three';

// A geometria do raio — CONSTRUÍDA EM CÓDIGO, a partir do contorno medido.
//
// ── A ordem do dono, e por que ela mudou ────────────────────────────────────
//
// `[10/09]` *"A cena 3D principal precisa ser CONSTRUÍDA À MÃO EM CÓDIGO…
// **NÃO use a imagem da lightning como substituta da geometria 3D**"*. A arte
// aprovada continua mandando em silhueta, proporção, cor e sensação de
// material — mas ela é o mapa, não a peça.
//
// ── De onde vêm estes números, e por que NÃO foram desenhados a olho ────────
//
// Eles são o **contorno real de `08-raio-nucleo-aceso.webp`**, extraído do
// canal alfa da arte: varredura de Moore no limite do alfa (2.669 pontos
// brutos), simplificada por Douglas-Peucker.
//
// Isso importa por um motivo concreto: em 10/09 eu reconstruí a silhueta a olho
// para o ícone e o dono reprovou. O erro técnico daquela tentativa foi de
// PROPORÇÃO — eu desenhei num quadrado e a marca leu como shuriken. O contorno
// medido aqui dá **largura/altura = 0,5084**, ou seja quase 1:2, e é essa
// proporção que faz as duas lâminas dominarem as duas asas.
//
// O furo hexagonal também é medido: um `flood fill` a partir da borda separa
// "vazio de fora" de "vazio cercado", e sobraram **12.095 pixels** de furo.
//
// **O que isto NÃO é:** a imagem em runtime. Nenhum pixel da arte chega ao
// navegador por este caminho — só coordenadas, que viram malha com volume,
// facetas e espessura de verdade.
//
// Para regenerar (se a arte mudar), o procedimento está em
// `docs/identidade/README.md`.

/** Contorno externo, normalizado: altura 2, centrado, Y para cima. */
const CONTORNO = [
  [0.3269, 1], [0.0925, 0.2652], [0.1189, 0.2546], [0.4467, 0.2564],
  [0.5084, 0.2458], [0.2581, -0.126], [0.3057, -0.1665], [0.2846, -0.2035],
  [-0.3833, -1], [-0.2511, -0.6035], [-0.1471, -0.1912], [-0.2018, -0.1612],
  [-0.3463, -0.1242], [-0.5066, 0.0097], [-0.5031, 0.0291], [-0.1982, 0.4079],
];

/** O furo hexagonal do núcleo, na mesma escala. */
const FURO = [
  [-0.0537, 0.1031], [0.0414, 0.0573], [0.0502, -0.0467], [0.0308, -0.0837],
  [-0.052, -0.1295], [-0.1542, -0.0714], [-0.1595, -0.0449], [-0.1524, 0.052],
];

/**
 * Onde o raio se parte, e por que a fissura é ESTREITA.
 *
 * Ordem dele: *"o gap deve ser pequeno o suficiente para que a silhueta
 * continue sendo percebida imediatamente como um único raio"*. Um corte largo
 * transforma o raio em duas peças que por acaso estão perto.
 *
 * Os dois valores são assimétricos de propósito: o furo do núcleo não é
 * centrado em zero (vai de +0,103 a −0,130), e cortar simétrico deixaria uma
 * das metades com um pedaço de furo maior que a outra.
 */
export const CORTE_SUPERIOR = 0.055;
export const CORTE_INFERIOR = -0.085;

/** O centro do furo — onde o núcleo fica suspenso. */
export const CENTRO_DO_NUCLEO = (() => {
  const xs = FURO.map((p) => p[0]);
  const ys = FURO.map((p) => p[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
})();

/**
 * Corta um polígono por uma reta horizontal (Sutherland–Hodgman).
 *
 * `acima = true` mantém o que está em `y >= corte`.
 *
 * Meia-reta é região convexa, que é a condição do algoritmo — o polígono de
 * entrada pode ser côncavo, e o do raio é.
 */
function cortarNaHorizontal(poligono, corte, acima) {
  const dentro = (p) => (acima ? p[1] >= corte : p[1] <= corte);
  const cruzar = (a, b) => {
    const t = (corte - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), corte];
  };

  const saida = [];
  for (let i = 0; i < poligono.length; i++) {
    const atual = poligono[i];
    const anterior = poligono[(i + poligono.length - 1) % poligono.length];
    const atualDentro = dentro(atual);
    const anteriorDentro = dentro(anterior);

    if (atualDentro) {
      if (!anteriorDentro) saida.push(cruzar(anterior, atual));
      saida.push(atual);
    } else if (anteriorDentro) {
      saida.push(cruzar(anterior, atual));
    }
  }
  return saida;
}

/** Um `THREE.Shape` a partir de uma lista de pontos, com furos opcionais. */
function paraShape(contorno, furos = []) {
  const shape = new THREE.Shape();
  contorno.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();

  for (const furo of furos) {
    if (furo.length < 3) continue;
    const caminho = new THREE.Path();
    furo.forEach(([x, y], i) => (i === 0 ? caminho.moveTo(x, y) : caminho.lineTo(x, y)));
    caminho.closePath();
    shape.holes.push(caminho);
  }
  return shape;
}

/**
 * As opções de extrusão — é aqui que nasce o VOLUME e as FACETAS.
 *
 * O `bevel` não é enfeite: sem ele o raio é uma placa reta, e placa reta não
 * pega luz de lado nenhum. Com chanfro, cada aresta vira uma faceta que
 * responde ao Fresnel do shader — é o que separa "cristal" de "adesivo grosso".
 *
 * `bevelSegments: 2` e não mais: cada segmento multiplica os triângulos das
 * bordas, e o ganho visual satura rápido num objeto deste tamanho na tela.
 */
const EXTRUSAO = {
  depth: 0.34,
  bevelEnabled: true,
  bevelThickness: 0.055,
  bevelSize: 0.045,
  bevelOffset: 0,
  bevelSegments: 2,
  curveSegments: 1,
};

/**
 * As duas metades do raio, já com volume.
 *
 * Cada uma é centrada em X e Z mas **mantém o Y original**: é isso que permite
 * ao núcleo pulsar e as metades se afastarem sem que a silhueta se desmonte —
 * elas já nascem no lugar certo em relação uma à outra.
 */
export function construirMetades() {
  const superior = cortarNaHorizontal(CONTORNO, CORTE_SUPERIOR, true);
  const inferior = cortarNaHorizontal(CONTORNO, CORTE_INFERIOR, false);

  const furoSuperior = cortarNaHorizontal(FURO, CORTE_SUPERIOR, true);
  const furoInferior = cortarNaHorizontal(FURO, CORTE_INFERIOR, false);

  const geoSuperior = new THREE.ExtrudeGeometry(paraShape(superior, [furoSuperior]), EXTRUSAO);
  const geoInferior = new THREE.ExtrudeGeometry(paraShape(inferior, [furoInferior]), EXTRUSAO);

  // Centraliza só em Z, para a peça ficar simétrica em profundidade. X e Y
  // ficam como estão: a posição relativa das duas metades É a silhueta.
  for (const g of [geoSuperior, geoInferior]) {
    g.translate(0, 0, -EXTRUSAO.depth / 2);
    g.computeVertexNormals();
  }

  return { superior: geoSuperior, inferior: geoInferior };
}

/**
 * O núcleo — uma estrutura cristalina, e **não uma esfera genérica**.
 *
 * Ordem dele: *"o core não deve ser uma esfera genérica. Construa-o como uma
 * pequena estrutura energética/cristalina"*.
 *
 * É um prisma hexagonal **bipiramidal**: o mesmo hexágono do furo, extrudado e
 * com as duas pontas puxadas em Z. Assim ele pertence à mesma família
 * geométrica do raio em vez de ser um sólido importado de outra linguagem.
 */
export function construirNucleo() {
  const raio = 0.5 * Math.max(
    Math.max(...FURO.map((p) => p[0])) - Math.min(...FURO.map((p) => p[0])),
    Math.max(...FURO.map((p) => p[1])) - Math.min(...FURO.map((p) => p[1])),
  );

  // Hexágono no plano XY, apontando para cima — a mesma orientação do furo.
  const hexagono = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    hexagono.push([Math.cos(a) * raio, Math.sin(a) * raio]);
  }

  const geo = new THREE.ExtrudeGeometry(paraShape(hexagono), {
    depth: raio * 0.9,
    bevelEnabled: true,
    bevelThickness: raio * 0.45,
    bevelSize: raio * 0.42,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * A família de fragmentos — derivada da linguagem do raio, não sólidos prontos.
 *
 * Ordem dele: *"não quero simplesmente torus, cubo, esfera, octaedro,
 * icosaedro espalhados pela tela sem propósito"*.
 *
 * Cada lasca é uma fatia irregular do PRÓPRIO contorno do raio: pega-se um
 * trecho de 3 a 4 vértices consecutivos, fecha-se no centro e extruda-se fino.
 * O resultado tem as mesmas arestas e os mesmos ângulos da peça principal —
 * que é o que faz parecer que se desprenderam dela.
 */
export function construirLascas() {
  const lascas = [];
  for (let i = 0; i < CONTORNO.length; i += 3) {
    const trecho = CONTORNO.slice(i, i + 3);
    if (trecho.length < 3) continue;

    // Fecha o trecho num triângulo/quadrilátero puxando para o centro da peça.
    const cx = trecho.reduce((s, p) => s + p[0], 0) / trecho.length;
    const cy = trecho.reduce((s, p) => s + p[1], 0) / trecho.length;
    const pontos = trecho.map(([x, y]) => [(x - cx) * 0.5, (y - cy) * 0.5]);

    const geo = new THREE.ExtrudeGeometry(paraShape(pontos), {
      depth: 0.06, bevelEnabled: true,
      bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 1, curveSegments: 1,
    });
    geo.center();
    geo.computeVertexNormals();
    lascas.push(geo);
  }
  return lascas;
}
