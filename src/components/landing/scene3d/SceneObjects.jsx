import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Silhueta de raio — mesmo desenho do ícone Zap (lucide) da marca, extrudado
// em 3D. É o "logo" que flutua no centro do Hero.
function useBoltGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.083, 0.83);
    shape.lineTo(-0.75, -0.17);
    shape.lineTo(0, -0.17);
    shape.lineTo(-0.083, -0.83);
    shape.lineTo(0.75, 0.17);
    shape.lineTo(0, 0.17);
    shape.closePath();

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 3,
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
  const groupRef = useRef(null);
  const meshRef = useRef(null);

  useBob(groupRef, { speed: 0.8, amplitude: 0.16, baseY: 1.6 });
  // Giro no próprio plano (eixo Z) — mantém a "cara" do raio sempre virada
  // pra câmera, em vez de mostrar a borda fina da extrusão de lado.
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.z -= delta * 0.28;
  });

  return (
    <group ref={groupRef} position={[0, 1.6, -1.6]} scale={0.92}>
      <mesh ref={meshRef} geometry={geometry} rotation={[0.3, 0, 0]}>
        <meshStandardMaterial
          color="#0d3d05"
          emissive="#39ff14"
          emissiveIntensity={0.9}
          metalness={0.3}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

const SHAPES = [
  { kind: 'icosahedron', color: '#bf00ff', position: [-2.5, 1.1, -1],    scale: 0.46, speed: 0.6, phase: 0 },
  { kind: 'octahedron',  color: '#00ffff', position: [2.4, -0.9, -0.6],  scale: 0.4,  speed: 0.8, phase: 1.4 },
  { kind: 'torus',       color: '#39ff14', position: [-1.9, -1.5, -1.4], scale: 0.34, speed: 0.5, phase: 2.6 },
  { kind: 'icosahedron', color: '#00ffff', position: [2.1, 1.6, -1.6],   scale: 0.27, speed: 0.9, phase: 3.8 },
];

function ShapeGeometry({ kind, scale }) {
  if (kind === 'octahedron') return <octahedronGeometry args={[scale, 0]} />;
  if (kind === 'torus') return <torusGeometry args={[scale, scale * 0.4, 12, 28]} />;
  return <icosahedronGeometry args={[scale, 0]} />;
}

function FloatingShape({ kind, color, position, scale, speed, phase }) {
  const ref = useRef(null);
  useBob(ref, { speed, amplitude: 0.3, baseY: position[1], phase });
  useTilt(ref, { speed: speed * 0.7, amplitude: 0.5, phase });

  return (
    <mesh ref={ref} position={position}>
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
// dar profundidade sem competir visualmente com o raio central.
export function FloatingShapes() {
  return SHAPES.map((shape, i) => <FloatingShape key={i} {...shape} />);
}
