import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Curvas de entrada — funções puras do tempo decorrido (sem Math.random/Date.now,
// pra respeitar a pureza exigida pelo React em código de render/useFrame).
function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

const LOGO_GROW_TIME = 0.85;  // duração do crescimento do raio (segundos)
const LOGO_FLASH_TIME = 0.45; // duração do flash de luz que "acende" o raio

const SHAPE_BASE_DELAY = 0.25; // espera antes do primeiro objeto aparecer
const SHAPE_STAGGER = 0.16;    // intervalo entre o aparecimento de cada objeto
const SHAPE_POP_TIME = 0.6;    // duração do "pop" de cada objeto

// Silhueta de raio — mesmo desenho do ícone Zap (lucide) da marca, extrudado
// em 3D com bastante profundidade pra ler como objeto sólido, não chapa.
function useBoltGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.06, 0.85);
    shape.lineTo(-0.7, -0.12);
    shape.lineTo(-0.04, -0.12);
    shape.lineTo(-0.06, -0.85);
    shape.lineTo(0.7, 0.12);
    shape.lineTo(0.04, 0.12);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 4,
    });
    geometry.center();
    return geometry;
  }, []);
}

// Sobe/desce suavemente — só a posição Y, sem mexer em rotação.
function useBob(ref, { speed = 1, amplitude = 0.18, baseY = 0, phase = 0 }) {
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = baseY + Math.sin(clock.elapsedTime * speed + phase) * amplitude;
  });
}

// Balanço suave de rotação nos eixos X/Y — usado pelos objetos wireframe
// (sem "frente" definida, então qualquer ângulo fica bem).
function useTilt(ref, { speed = 1, amplitude = 0.5, phase = 0 }) {
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + phase;
    ref.current.rotation.x = Math.sin(t * 0.6) * amplitude;
    ref.current.rotation.y = Math.cos(t * 0.5) * amplitude;
  });
}

export function LogoBolt() {
  const geometry = useBoltGeometry();
  const { viewport } = useThree();
  const groupRef = useRef(null);
  const meshRef = useRef(null);
  const matRef = useRef(null);
  const flashRef = useRef(null);

  // Em telas estreitas o logo encolhe um pouco pra não dominar a largura.
  const scale = THREE.MathUtils.clamp(viewport.width / 6, 0.72, 1);

  // Flutua de leve (menos que os objetos ao redor).
  useBob(groupRef, { speed: 0.7, amplitude: 0.1, baseY: 1.45 });

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;

    // Nasce de um clarão — o raio "surge" iluminado por um flash que estoura
    // e decai rápido, e o sólido cresce de dentro dele (igual um raio de
    // verdade: primeiro a luz, depois a forma se revela).
    const growP = THREE.MathUtils.clamp(t / LOGO_GROW_TIME, 0, 1);
    const entranceScale = easeOutCubic(growP);
    const flashP = THREE.MathUtils.clamp(t / LOGO_FLASH_TIME, 0, 1);
    const flashBurst = (1 - flashP) ** 2; // 1 → 0, decaimento rápido

    if (meshRef.current) {
      // Giro contínuo no eixo Y revela a espessura/profundidade da extrusão.
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.scale.setScalar(entranceScale);
    }
    if (flashRef.current) {
      flashRef.current.intensity = flashBurst * 14;
    }
    // Zumbido neon suave (duas ondas sobrepostas, sem saltos bruscos) — dá
    // vida de "energizado" sem competir com o flash real dos raios, que
    // agora é quem ilumina a logo de fato. Durante o nascimento, o brilho
    // recebe um boost extra que acompanha o flash.
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.55 + Math.sin(t * 1.7) * 0.06 + Math.sin(t * 11) * 0.03 + flashBurst * 1.4;
    }
  });

  return (
    <group ref={groupRef} position={[0, 1.45, -1]} scale={scale}>
      {/* Clarão que acompanha o nascimento do raio — estoura e decai rápido. */}
      <pointLight ref={flashRef} position={[0, 0, 1.2]} color="#aaffaa" intensity={0} distance={6} />
      {/* Inclinação fixa no X pra sempre mostrar um pouco do topo (volume). */}
      <mesh ref={meshRef} geometry={geometry} rotation={[0.34, 0, 0]} scale={0}>
        <meshStandardMaterial
          ref={matRef}
          color="#1e8c0c"
          emissive="#39ff14"
          emissiveIntensity={0.55}
          metalness={0.55}
          roughness={0.28}
        />
      </mesh>
    </group>
  );
}

// ─── Objetos gamer flutuantes ────────────────────────────────────────────────
// Trocamos os sólidos abstratos (icosaedro/octaedro/toro) por objetos com cara
// de game — gamepad, headset, troféu e caveira — montados com primitivas 3D
// reais (volumétricos, com profundidade de verdade), não chapas extrudadas.

// Material neon padrão (corpo dos objetos) — emissivo pra brilhar sozinho mesmo
// contra o fundo escuro, no mesmo tom dos raios da marca.
function NeonMaterial({ color, double }) {
  return (
    <meshStandardMaterial
      color={color} emissive={color} emissiveIntensity={0.45}
      metalness={0.45} roughness={0.32}
      side={double ? THREE.DoubleSide : THREE.FrontSide}
    />
  );
}

// Material escuro pros recortes (botões, almofadas do headset, olhos da caveira)
// — dá contraste pra leitura da forma sem precisar de uma segunda cor neon.
function DarkMaterial() {
  return <meshStandardMaterial color="#0b0e13" emissive="#0b0e13" emissiveIntensity={0.15} metalness={0.3} roughness={0.6} />;
}

// Caixa com cantos arredondados (silhueta retangular + bevel + profundidade) —
// dá volumes limpos pro gamepad/headset, bem melhor que esferas/icosaedros
// fundidos (que saíam "blobados").
function roundedBoxGeometry(w, h, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const bevel = Math.min(0.05, r * 0.6);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: d - bevel * 2, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8,
  });
  geo.center();
  return geo;
}

function RoundedBox({ w, h, d, r = 0.12, color, dark, ...props }) {
  const geo = useMemo(() => roundedBoxGeometry(w, h, d, r), [w, h, d, r]);
  return <mesh geometry={geo} {...props}>{dark ? <DarkMaterial /> : <NeonMaterial color={color} />}</mesh>;
}

// Controle de videogame: corpo e grips arredondados + analógicos, d-pad e botões.
function GamepadModel({ color }) {
  const buttons = [[0.2, 0.18], [0.2, 0.04], [0.13, 0.11], [0.27, 0.11]];
  return (
    <group rotation={[0.18, 0, 0]}>
      <RoundedBox w={1.25} h={0.6} d={0.32} r={0.27} color={color} />
      <RoundedBox w={0.42} h={0.66} d={0.3} r={0.19} color={color} position={[-0.5, -0.27, 0]} rotation={[0, 0, 0.5]} />
      <RoundedBox w={0.42} h={0.66} d={0.3} r={0.19} color={color} position={[0.5, -0.27, 0]} rotation={[0, 0, -0.5]} />
      {/* analógicos (base + cabeça) */}
      {[-0.27, 0.34].map((sx, i) => (
        <group key={i} position={[sx, -0.06, 0.17]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.11, 0.07, 16]} /><DarkMaterial /></mesh>
          <mesh position={[0, 0, 0.05]}><sphereGeometry args={[0.085, 14, 14]} /><DarkMaterial /></mesh>
        </group>
      ))}
      {/* d-pad (cruz) */}
      <mesh position={[-0.32, 0.16, 0.17]}><boxGeometry args={[0.17, 0.055, 0.06]} /><DarkMaterial /></mesh>
      <mesh position={[-0.32, 0.16, 0.17]}><boxGeometry args={[0.055, 0.17, 0.06]} /><DarkMaterial /></mesh>
      {/* botões de ação */}
      {buttons.map(([bx, by], i) => (
        <mesh key={i} position={[bx, by, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.06, 12]} /><DarkMaterial />
        </mesh>
      ))}
    </group>
  );
}

// Headset gamer: arco no topo + conchas com almofada + haste de microfone.
function HeadsetModel({ color }) {
  return (
    <group>
      {/* arco (levemente achatado) */}
      <mesh scale={[1, 0.92, 1]}>
        <torusGeometry args={[0.6, 0.1, 16, 32, Math.PI]} /><NeonMaterial color={color} />
      </mesh>
      {/* conchas + almofada externa, espelhadas */}
      {[-1, 1].map((s, i) => (
        <group key={i}>
          <mesh position={[0.6 * s, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.23, 0.23, 0.22, 24]} /><NeonMaterial color={color} />
          </mesh>
          <mesh position={[0.72 * s, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.04, 24]} /><DarkMaterial />
          </mesh>
        </group>
      ))}
      {/* haste do microfone saindo da concha esquerda, curvando pra frente */}
      <mesh position={[-0.66, -0.3, 0.14]} rotation={[0.55, 0, 0.4]}>
        <cylinderGeometry args={[0.022, 0.022, 0.42, 8]} /><NeonMaterial color={color} />
      </mesh>
      <mesh position={[-0.5, -0.5, 0.3]}><sphereGeometry args={[0.055, 12, 12]} /><DarkMaterial /></mesh>
    </group>
  );
}

// Troféu via superfície de revolução (LatheGeometry) — perfil 2D girado 360°,
// que é exatamente como taças são feitas: base larga → haste fina → taça
// flareada. Bem mais convincente que empilhar cilindros.
function TrophyModel({ color }) {
  const geo = useMemo(() => {
    const profile = [
      [0.0, -0.5], [0.32, -0.5], [0.32, -0.44], [0.13, -0.4], [0.1, -0.34], // base
      [0.07, -0.33], [0.07, -0.15],                                          // haste
      [0.12, -0.12], [0.36, 0.04], [0.4, 0.32], [0.38, 0.36],               // taça
      [0.3, 0.34], [0.3, 0.28],                                             // lábio interno
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(profile, 36);
  }, []);
  return (
    <group position={[0, 0.02, 0]}>
      <mesh geometry={geo}><NeonMaterial color={color} double /></mesh>
      {/* alças laterais */}
      <mesh position={[-0.33, 0.18, 0]} rotation={[0, 0, -0.3]}>
        <torusGeometry args={[0.15, 0.038, 12, 20, Math.PI]} /><NeonMaterial color={color} />
      </mesh>
      <mesh position={[0.33, 0.18, 0]} rotation={[0, 0, Math.PI + 0.3]}>
        <torusGeometry args={[0.15, 0.038, 12, 20, Math.PI]} /><NeonMaterial color={color} />
      </mesh>
    </group>
  );
}

// Caveira low-poly: crânio + maxilar + órbitas/nariz escuros + dentes.
function SkullModel({ color }) {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} scale={[1, 1.05, 0.96]}>
        <icosahedronGeometry args={[0.5, 2]} /><NeonMaterial color={color} />
      </mesh>
      <mesh position={[0, -0.24, 0.06]} scale={[0.6, 0.5, 0.58]}>
        <icosahedronGeometry args={[0.4, 1]} /><NeonMaterial color={color} />
      </mesh>
      {/* órbitas (fundas, levemente ovais) */}
      {[-0.19, 0.19].map((ex, i) => (
        <mesh key={i} position={[ex, 0.18, 0.4]} scale={[1, 1.15, 0.7]}>
          <sphereGeometry args={[0.15, 16, 16]} /><DarkMaterial />
        </mesh>
      ))}
      {/* nariz */}
      <mesh position={[0, 0.0, 0.46]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.06, 0.15, 3]} /><DarkMaterial />
      </mesh>
      {/* dentes: faixa escura + ranhuras neon */}
      <mesh position={[0, -0.33, 0.32]}><boxGeometry args={[0.33, 0.13, 0.12]} /><DarkMaterial /></mesh>
      {[-0.12, -0.04, 0.04, 0.12].map((tx, i) => (
        <mesh key={i} position={[tx, -0.33, 0.39]}><boxGeometry args={[0.022, 0.13, 0.04]} /><NeonMaterial color={color} /></mesh>
      ))}
    </group>
  );
}

const MODELS = { gamepad: GamepadModel, headset: HeadsetModel, trophy: TrophyModel, skull: SkullModel };

// fx = posição X relativa à largura visível (–1..1) — assim os objetos ficam
// nos cantos em qualquer proporção de tela, inclusive no celular (retrato).
const SHAPES = [
  { kind: 'gamepad', color: '#39ff14', fx: -0.72, y: 1.45,  z: -1,   scale: 0.62, speed: 0.6, phase: 0 },
  { kind: 'headset', color: '#bf00ff', fx: 0.74,  y: 1.5,   z: -1.2, scale: 0.58, speed: 0.8, phase: 1.4 },
  { kind: 'trophy',  color: '#ffb020', fx: -0.66, y: -1.55, z: -1.4, scale: 0.56, speed: 0.5, phase: 2.6 },
  { kind: 'skull',   color: '#00ffff', fx: 0.72,  y: -1.45, z: -1.6, scale: 0.5,  speed: 0.9, phase: 3.8 },
];

function FloatingShape({ kind, color, x, y, z, modelScale, sizeScale, speed, phase, index }) {
  const ref = useRef(null);
  const delay = SHAPE_BASE_DELAY + index * SHAPE_STAGGER;
  const Model = MODELS[kind];
  useBob(ref, { speed, amplitude: 0.3, baseY: y, phase });
  useTilt(ref, { speed: speed * 0.7, amplitude: 0.4, phase });

  useFrame(({ clock }) => {
    // Cada objeto "materializa" com um leve estouro (overshoot) defasado no
    // tempo — como se fossem condensando a partir da energia do raio central.
    const popP = THREE.MathUtils.clamp((clock.elapsedTime - delay) / SHAPE_POP_TIME, 0, 1);
    const pop = popP <= 0 ? 0 : easeOutBack(popP);
    if (ref.current) ref.current.scale.setScalar(sizeScale * modelScale * Math.max(pop, 0));
  });

  return (
    <group ref={ref} position={[x, y, z]} scale={0}>
      <Model color={color} />
    </group>
  );
}

// Objetos gamer flutuantes ao redor do logo. Posições e tamanho se adaptam à
// largura da viewport (aparecem também no celular).
export function FloatingShapes() {
  const { viewport } = useThree();
  const halfWidth = viewport.width / 2;
  const sizeScale = THREE.MathUtils.clamp(viewport.width / 6, 0.55, 1);

  return SHAPES.map((shape, i) => (
    <FloatingShape key={i} {...shape} index={i} x={shape.fx * halfWidth} modelScale={shape.scale} sizeScale={sizeScale} />
  ));
}
