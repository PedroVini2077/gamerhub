import * as THREE from 'three';

// O material do raio — um `ShaderMaterial` escrito à mão.
//
// ── Por que shader, e não `meshStandardMaterial` ────────────────────────────
//
// Ordem do dono: *"a aparência precisa parecer MATERIAL, não simplesmente um
// objeto verde com `emissiveIntensity`"*. Ele está descrevendo exatamente o que
// a cena tinha antes — `meshStandardMaterial` com `emissive: '#39ff14'`.
//
// ── Por que NÃO entrou o `MeshTransmissionMaterial` do drei ─────────────────
//
// Ele é a resposta óbvia para "cristal", e foi recusado com motivo: ele
// **renderiza a cena inteira para um buffer a cada quadro** para conseguir a
// refração. Numa cena que já custa 708 kB e que existe atrás de um portão de
// desempenho, isso é o oposto do pedido *"não quero trocar performance por
// efeitos inúteis"*. Além disso, o `drei` quebraria o `extend()` seletivo que
// segura o tamanho do chunk.
//
// O que este shader faz no lugar: **Fresnel + energia interna + ruído**, que
// são os três sinais que o olho lê como cristal. Custo: zero byte de
// biblioteca — `ShaderMaterial` é `three` puro.
//
// ── Os quatro sinais, e o que cada um resolve ───────────────────────────────
//
// | Sinal | O que ele produz |
// | --- | --- |
// | **Fresnel** | a aresta acende e a face fica translúcida. É o que separa vidro de plástico pintado |
// | **energia interna** | ruído lento por dentro do volume — a peça parece ter algo VIVO, não ser sólida |
// | **rampa cromática** | ciano de um lado, magenta do outro, verde no corpo. Vem direto da arte aprovada |
// | **luz do núcleo** | a face mais perto do núcleo recebe mais luz. É o que faz o pulso do core ILUMINAR as metades, e não só piscar sozinho |

const vertexShader = /* glsl */ `
  varying vec3 vNormalMundo;
  varying vec3 vParaCamera;
  varying vec3 vPosicaoLocal;

  void main() {
    vPosicaoLocal = position;
    vNormalMundo  = normalize(mat3(modelMatrix) * normal);

    vec4 posicaoMundo = modelMatrix * vec4(position, 1.0);
    vParaCamera = normalize(cameraPosition - posicaoMundo.xyz);

    gl_Position = projectionMatrix * viewMatrix * posicaoMundo;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTempo;
  uniform float uPulso;        // 0..1 — a respiração do núcleo
  uniform vec3  uCorBase;
  uniform vec3  uCorBorda;     // ciano
  uniform vec3  uCorFuga;      // magenta/roxo
  uniform vec3  uNucleo;       // posição do núcleo, em espaço LOCAL
  uniform float uOpacidade;
  uniform float uMaterializacao; // 0..1 — quanto da peça já existe
  uniform float uBranco;         // quanto a luz do núcleo puxa para o branco

  varying vec3 vNormalMundo;
  varying vec3 vParaCamera;
  varying vec3 vPosicaoLocal;

  // Ruído de valor barato. Três oitavas bastam para "energia" — mais do que
  // isso não se enxerga num objeto deste tamanho e custa por pixel.
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float ruido(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float energia(vec3 p) {
    return ruido(p * 2.4) * 0.55
         + ruido(p * 5.7) * 0.30
         + ruido(p * 11.3) * 0.15;
  }

  void main() {
    // ── Fresnel: a aresta acende, a face abre ────────────────────────────
    float faceando = clamp(dot(normalize(vNormalMundo), normalize(vParaCamera)), 0.0, 1.0);
    float fresnel  = pow(1.0 - faceando, 3.0);

    // ── Energia interna, correndo devagar pelo volume ────────────────────
    vec3  fluxo = vPosicaoLocal + vec3(0.0, uTempo * 0.16, uTempo * 0.05);
    float veia  = energia(fluxo);
    // smoothstep estreito: vira VEIO de luz em vez de névoa uniforme.
    veia = smoothstep(0.42, 0.78, veia);

    // ── A luz do núcleo ilumina as faces internas ────────────────────────
    float distNucleo = length(vPosicaoLocal - uNucleo);
    // Queda ACENTUADA (6.5 e nao 2.1): o raio tem so ~2 unidades de altura, e
    // com queda suave o termo saturava o corpo INTEIRO de branco — a peca
    // lia como menta palido em vez do verde eletrico da identidade. Medido no
    // primeiro render da cena.
    float doNucleo   = exp(-distNucleo * 6.5) * (0.45 + uPulso * 0.75);

    // ── A rampa cromática, lida da arte aprovada ─────────────────────────
    // O lado que olha para +X puxa magenta; o que olha para -X puxa ciano.
    float lado = clamp(vNormalMundo.x * 0.5 + 0.5, 0.0, 1.0);
    vec3  cromatica = mix(uCorBorda, uCorFuga, lado);

    vec3 cor = uCorBase;
    cor = mix(cor, cromatica, fresnel * 0.55);           // aresta cromática
    cor += uCorBase * veia * 0.55;                        // veios internos
    cor += mix(uCorBase, vec3(1.0), uBranco) * doNucleo;  // luz do core

    // ── Transparência: face aberta, aresta fechada ───────────────────────
    float alfa = uOpacidade + fresnel * 0.55 + veia * 0.12 + doNucleo * 0.25;

    // ── Materialização: a peça se monta de BAIXO para cima ───────────────
    // Não é fade: é um limiar que corre pelo corpo, então a peça parece
    // ganhar existência em vez de aparecer translúcida.
    float frente = (vPosicaoLocal.y + 1.2) / 2.4;
    float existe = smoothstep(frente - 0.22, frente + 0.02, uMaterializacao);
    alfa *= existe;
    cor  += vec3(1.0) * (1.0 - existe) * step(0.001, existe) * 0.35;

    gl_FragColor = vec4(cor, clamp(alfa, 0.0, 1.0));
  }
`;

/** Verde da identidade, e as duas arestas cromáticas da arte. */
export const PALETA = {
  base: new THREE.Color('#39ff14'),
  borda: new THREE.Color('#7de3ff'),
  fuga: new THREE.Color('#b06bff'),
};

/**
 * Cria o material do cristal.
 *
 * `transparent` com `depthWrite: false` é o par que evita a peça se recortar
 * contra si mesma — sem isso, a metade de trás some atrás da da frente em
 * ângulos rasos.
 */
export function criarMaterialDeCristal({ nucleo = [0, 0, 0], opacidade = 0.34, branco = 0.35 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTempo: { value: 0 },
      uPulso: { value: 0 },
      uCorBase: { value: PALETA.base.clone() },
      uCorBorda: { value: PALETA.borda.clone() },
      uCorFuga: { value: PALETA.fuga.clone() },
      uNucleo: { value: new THREE.Vector3(...nucleo) },
      uOpacidade: { value: opacidade },
      uMaterializacao: { value: 0 },
      uBranco: { value: branco },
    },
  });
}

/**
 * O material do NÚCLEO — o mesmo shader, mas ele é a FONTE, não o receptor.
 *
 * Opacidade alta e `uNucleo` no próprio centro: assim o termo `doNucleo` satura
 * dentro dele e a peça brilha de dentro para fora, em vez de ser iluminada.
 */
export function criarMaterialDoNucleo() {
  // `[10/09]` Duas correções, e a segunda é um achado de §1.5.
  //
  // **1. O núcleo lia como pedra clara.** O termo `doNucleo` puxava 35% para o
  // branco, e como aqui a fonte é o próprio centro da peça, ele saturava o
  // miolo inteiro. A arte mostra o contrário: verde fundo e SATURADO no corpo,
  // com a aresta acesa. Por isso `branco: 0.04` — a luz continua existindo,
  // mas ela é verde, não branca.
  //
  // **2. A `pointLight` que mora no núcleo NÃO FAZ NADA.** Um `ShaderMaterial`
  // cru não recebe luz de cena: sem `lights: true` e sem os chunks de
  // iluminação do three, os uniforms de luz nem existem no programa. A luz
  // estava lá, na cena, sem efeito nenhum — e nada avisava, que é exatamente a
  // forma de falha do §1.5. Ela foi mantida porque as LASCAS e qualquer peça
  // futura com `meshStandardMaterial` a usam; o que mudou é que o brilho do
  // núcleo passou a vir de onde ele pode vir, que é daqui.
  const material = criarMaterialDeCristal({
    nucleo: [0, 0, 0], opacidade: 0.55, branco: 0.04,
  });
  material.uniforms.uCorBase.value = new THREE.Color('#6dff3a');
  material.depthWrite = true;
  return material;
}
