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

// fx = posição X relativa à largura visível (–1..1) — assim os objetos ficam
// nos cantos em qualquer proporção de tela, inclusive no celular (retrato).
const SHAPES = [
  { kind: 'icosahedron', color: '#bf00ff', fx: -0.72, y: 1.45,  z: -1,   scale: 0.46, speed: 0.6, phase: 0 },
  { kind: 'octahedron',  color: '#00ffff', fx: 0.74,  y: 1.5,   z: -1.2, scale: 0.4,  speed: 0.8, phase: 1.4 },
  { kind: 'torus',       color: '#39ff14', fx: -0.66, y: -1.55, z: -1.4, scale: 0.34, speed: 0.5, phase: 2.6 },
  { kind: 'icosahedron', color: '#00ffff', fx: 0.72,  y: -1.45, z: -1.6, scale: 0.27, speed: 0.9, phase: 3.8 },
];

function ShapeGeometry({ kind, scale }) {
  if (kind === 'octahedron') return <octahedronGeometry args={[scale, 0]} />;
  if (kind === 'torus') return <torusGeometry args={[scale, scale * 0.4, 12, 28]} />;
  return <icosahedronGeometry args={[scale, 0]} />;
}

function FloatingShape({ kind, color, x, y, z, scale, sizeScale, speed, phase, index }) {
  const ref = useRef(null);
  const matRef = useRef(null);
  const delay = SHAPE_BASE_DELAY + index * SHAPE_STAGGER;
  useBob(ref, { speed, amplitude: 0.3, baseY: y, phase });
  useTilt(ref, { speed: speed * 0.7, amplitude: 0.5, phase });

  useFrame(({ clock }) => {
    // Cada objeto "materializa" com um leve estouro (overshoot) defasado no
    // tempo — como se fossem condensando a partir da energia do raio central.
    const popP = THREE.MathUtils.clamp((clock.elapsedTime - delay) / SHAPE_POP_TIME, 0, 1);
    const pop = popP <= 0 ? 0 : easeOutBack(popP);
    if (ref.current) ref.current.scale.setScalar(sizeScale * Math.max(pop, 0));
    if (matRef.current) matRef.current.opacity = 0.55 * THREE.MathUtils.clamp(popP, 0, 1);
  });

  return (
    <mesh ref={ref} position={[x, y, z]} scale={0}>
      <ShapeGeometry kind={kind} scale={scale} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        wireframe
        transparent
        opacity={0}
      />
    </mesh>
  );
}

// Objetos geométricos flutuantes ao redor do logo — wireframe translúcido pra
// dar profundidade sem competir visualmente com o raio central. Posições e
// tamanho se adaptam à largura da viewport (aparecem também no celular).
export function FloatingShapes() {
  const { viewport } = useThree();
  const halfWidth = viewport.width / 2;
  const sizeScale = THREE.MathUtils.clamp(viewport.width / 6, 0.55, 1);

  return SHAPES.map((shape, i) => (
    <FloatingShape key={i} {...shape} index={i} x={shape.fx * halfWidth} sizeScale={sizeScale} />
  ));
}
