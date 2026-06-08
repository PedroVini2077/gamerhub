import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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

  // Em telas estreitas o logo encolhe um pouco pra não dominar a largura.
  const scale = THREE.MathUtils.clamp(viewport.width / 6, 0.72, 1);

  // Flutua de leve (menos que os objetos ao redor).
  useBob(groupRef, { speed: 0.7, amplitude: 0.1, baseY: 1.45 });

  useFrame(({ clock }, delta) => {
    // Giro contínuo no eixo Y revela a espessura/profundidade da extrusão.
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.5;
    // Flicker elétrico: zumbido neon constante + faísca forte ocasional —
    // dá vida de "energizado" à logo sem custo (só mexe na intensidade).
    if (matRef.current) {
      const buzz = Math.sin(clock.elapsedTime * 38) * 0.07;
      const spark = Math.random() < 0.025 ? Math.random() * 0.9 : 0;
      matRef.current.emissiveIntensity = 0.55 + buzz + spark;
    }
  });

  return (
    <group ref={groupRef} position={[0, 1.45, -1]} scale={scale}>
      {/* Inclinação fixa no X pra sempre mostrar um pouco do topo (volume). */}
      <mesh ref={meshRef} geometry={geometry} rotation={[0.34, 0, 0]}>
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

function FloatingShape({ kind, color, x, y, z, scale, sizeScale, speed, phase }) {
  const ref = useRef(null);
  useBob(ref, { speed, amplitude: 0.3, baseY: y, phase });
  useTilt(ref, { speed: speed * 0.7, amplitude: 0.5, phase });

  return (
    <mesh ref={ref} position={[x, y, z]} scale={sizeScale}>
      <ShapeGeometry kind={kind} scale={scale} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        wireframe
        transparent
        opacity={0.55}
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
    <FloatingShape key={i} {...shape} x={shape.fx * halfWidth} sizeScale={sizeScale} />
  ));
}
