// O contorno MEDIDO da marca — os dados, e só os dados.
//
// ── De onde vêm, e por que este arquivo existe separado ─────────────────────
//
// `[10/09]` De `docs/identidade/referencias/01-simbolo-mestre.webp`, por
// `scripts/silhueta-da-marca.mjs`: 3.133 pontos brutos de contorno, traçados por
// varredura de Moore sobre a máscara, simplificados por Douglas–Peucker com
// `eps = 2,5 px`. O furo saiu do mesmo passo — região apagada que o
// preenchimento a partir da borda **não** alcança.
//
// ── A correção que este arquivo carrega ─────────────────────────────────────
//
// A versão anterior também era medida — e mesmo assim o dono disse que estava
// *"totalmente deformado"*. O erro não foi digitar de olho: foi **simplificar
// até destruir a forma**. 2.669 pontos brutos viraram **16**, e com 16 pontos
// os entalhes ao redor do núcleo, o recorte das asas e o degrau das lâminas
// simplesmente não existem — sobra um losango com pontas.
//
// A proporção estava certa (0,5084 contra os 0,4939 medidos agora). O que
// faltava era **detalhe de silhueta**, e é por isso que aqui são 81 pontos e
// não 16: cada entalhe precisa de vértice para existir.
//
// ── A convenção ────────────────────────────────────────────────────────────
//
// Altura 2, centrado na origem, **Y para cima** (a imagem cresce para baixo, e
// a normalização inverte). O externo é **anti-horário** e o furo é **horário**,
// que é o que `THREE.Shape` + `Path` esperam para o furo furar de verdade.

/** Contorno externo: 81 pontos. Largura/altura medida: **0,4939**. */
export const CONTORNO = [
  [0.3623, 0.9978], [0.3066, 0.9376], [0.2865, 0.9287], [0.2821, 0.9175],
  [0.2664, 0.9153], [0.2018, 0.8439], [0.175, 0.8305], [0.1505, 0.7926],
  [0.1126, 0.7614], [-0.0056, 0.6299], [-0.0279, 0.592], [-0.1014, 0.5229],
  [-0.1104, 0.5028], [-0.2241, 0.3802], [-0.2486, 0.3378], [-0.2598, 0.3333],
  [-0.3266, 0.2464], [-0.3712, 0.1728], [-0.3935, 0.1527], [-0.4939, -0.0323],
  [-0.0635, 0.1795], [-0.0613, 0.2508], [-0.0346, 0.2932], [0.0078, 0.2642],
  [0.0078, 0.1594], [-0.0011, 0.1371], [0.0078, 0.1327], [-0.0479, 0.1304],
  [-0.0814, 0.1193], [-0.097, 0.1014], [-0.1104, 0.0992], [-0.1104, 0.0903],
  [-0.2263, 0.0323], [-0.2129, -0.0769], [-0.2441, -0.0591], [-0.4203, -0.0546],
  [-0.456, -0.0658], [-0.4025, -0.1371], [-0.3579, -0.1706], [-0.2821, -0.2085],
  [-0.2352, -0.2196], [-0.2241, -0.2308], [-0.2018, -0.2308], [-0.1572, -0.2642],
  [-0.1661, -0.3579], [-0.2219, -0.6321], [-0.2241, -0.6856], [-0.2575, -0.8172],
  [-0.2642, -0.8194], [-0.2598, -0.8283], [-0.3043, -1], [-0.2441, -0.9264],
  [-0.1929, -0.8863], [-0.1171, -0.7837], [-0.1014, -0.777], [-0.0613, -0.7168],
  [-0.0591, -0.7012], [-0.01, -0.641], [-0.0123, -0.6276], [0.0011, -0.6232],
  [0.0145, -0.5853], [0.3088, -0.2085], [0.1215, -0.1014], [0.1237, 0.0301],
  [0.0858, 0.0546], [0.0925, 0.0591], [0.0836, 0.0725], [0.1014, 0.0881],
  [0.1349, 0.0881], [0.1817, 0.0613], [0.1862, -0.0702], [0.291, -0.1282],
  [0.4939, 0.1951], [0.4381, 0.1996], [0.4025, 0.2152], [0.155, 0.2285],
  [0.1304, 0.2419], [0.126, 0.2731], [0.1171, 0.2642], [0.3356, 0.8952],
  [0.3645, 1],
];

/**
 * O furo central: 38 pontos.
 *
 * Não é um hexágono limpo — é o hexágono **mais o pé que desce dele**, que é o
 * que a arte mostra. Vai de `y = +0,075` a `y = −0,345`, ou seja **21% da
 * altura da peça**: é ele que abre o espaço onde o núcleo mora.
 */
export const FURO = [
[-0.0256, 0.0502], [-0.0123, 0.0479], [-0.01, 0.0368], [0.0123, 0.039],
  [0.0479, 0.01], [0.0591, 0.0078], [0.0546, 0.0145], [0.0747, 0.0033],
  [0.0747, -0.1148], [0.039, -0.1416], [0.0167, -0.1416], [0.0167, -0.1527],
  [-0.0056, -0.1572], [-0.0256, -0.1817], [-0.0234, -0.2107], [-0.0123, -0.2285],
  [0.0234, -0.2152], [-0.0323, -0.3445], [-0.0346, -0.3333], [-0.0635, -0.3155],
  [-0.0635, -0.2062], [-0.0457, -0.1906], [-0.0457, -0.1795], [-0.0613, -0.1572],
  [-0.0725, -0.1594], [-0.0925, -0.1394], [-0.1037, -0.1416], [-0.1171, -0.1349],
  [-0.1171, -0.126], [-0.1394, -0.1215], [-0.1394, 0.0056], [-0.1081, 0.0123],
  [-0.0769, 0.039], [-0.0658, 0.0346], [-0.0524, 0.0524], [-0.0591, 0.0479],
  [-0.0502, 0.0412], [-0.0256, 0.0479],
];

/** Centro geométrico do furo — onde o núcleo fica suspenso. */
export const CENTRO_DO_NUCLEO = (() => {
  const xs = FURO.map((p) => p[0]);
  const ys = FURO.map((p) => p[1]);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
})();

/** Largura do furo, usada para dimensionar o núcleo sem número mágico. */
export const LARGURA_DO_FURO = (() => {
  const xs = FURO.map((p) => p[0]);
  return Math.max(...xs) - Math.min(...xs);
})();

/**
 * Onde a peça se parte — uma FISSURA FINA, não um vão.
 *
 * `[10/09]` A primeira tentativa cortou nas duas bordas do furo, e o resultado
 * está renderizado: como o furo ocupa 21% da altura, as duas metades ficaram
 * separadas por um buraco enorme com uma pedrinha flutuando no meio. Não lia
 * como raio partido — lia como três objetos soltos.
 *
 * A ordem original do dono já dizia o certo: *"o gap deve ser pequeno o
 * suficiente para que a silhueta continue sendo percebida imediatamente como um
 * único raio"*. Então o corte é uma faixa estreita **centrada no núcleo**, e o
 * furo hexagonal continua sendo furo — é dentro dele que o núcleo mora.
 */
const MEIA_FISSURA = 0.028;
export const CORTE_SUPERIOR = CENTRO_DO_NUCLEO[1] + MEIA_FISSURA;
export const CORTE_INFERIOR = CENTRO_DO_NUCLEO[1] - MEIA_FISSURA;
