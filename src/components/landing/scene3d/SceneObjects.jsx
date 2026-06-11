import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function easeOutCubic(t) { return 1 - (1 - t) ** 3; }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

const LOGO_GROW_TIME  = 0.85;
const LOGO_FLASH_TIME = 0.45;
const SHAPE_BASE_DELAY = 0.25;
const SHAPE_STAGGER    = 0.16;
const SHAPE_POP_TIME   = 0.6;

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
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.28, bevelEnabled: true,
      bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4,
    });
    geo.center();
    return geo;
  }, []);
}

function useBob(ref, { speed = 1, amplitude = 0.18, baseY = 0, phase = 0 }) {
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = baseY + Math.sin(clock.elapsedTime * speed + phase) * amplitude;
  });
}

export function LogoBolt() {
  const geometry = useBoltGeometry();
  const { viewport } = useThree();
  const groupRef = useRef(null);
  const meshRef  = useRef(null);
  const matRef   = useRef(null);
  const flashRef = useRef(null);

  const scale = THREE.MathUtils.clamp(viewport.width / 6, 0.72, 1);
  useBob(groupRef, { speed: 0.7, amplitude: 0.1, baseY: 1.45 });

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const growP  = THREE.MathUtils.clamp(t / LOGO_GROW_TIME,  0, 1);
    const flashP = THREE.MathUtils.clamp(t / LOGO_FLASH_TIME, 0, 1);
    const flashBurst = (1 - flashP) ** 2;
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.scale.setScalar(easeOutCubic(growP));
    }
    if (flashRef.current) flashRef.current.intensity = flashBurst * 14;
    if (matRef.current)   matRef.current.emissiveIntensity = 0.55 + Math.sin(t * 1.7) * 0.06 + Math.sin(t * 11) * 0.03 + flashBurst * 1.4;
  });

  return (
    <group ref={groupRef} position={[0, 1.45, -1]} scale={scale}>
      <pointLight ref={flashRef} position={[0, 0, 1.2]} color="#aaffaa" intensity={0} distance={6} />
      <mesh ref={meshRef} geometry={geometry} rotation={[0.34, 0, 0]} scale={0}>
        <meshStandardMaterial ref={matRef} color="#1e8c0c" emissive="#39ff14" emissiveIntensity={0.55} metalness={0.55} roughness={0.28} />
      </mesh>
    </group>
  );
}

// ─── Formas geométricas flutuantes ──────────────────────────────────────────

// Icosaedro: sólido neon + cage wireframe sobrepost — cara de cristal/gema.
function GemModel({ color }) {
  const innerRef = useRef(null);
  const outerRef = useRef(null);
  useFrame((_, delta) => {
    if (innerRef.current) { innerRef.current.rotation.y += delta * 0.55; innerRef.current.rotation.x += delta * 0.22; }
    if (outerRef.current) { outerRef.current.rotation.y -= delta * 0.28; outerRef.current.rotation.z += delta * 0.18; }
  });
  return (
    <group>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.52, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.7} roughness={0.15} />
      </mesh>
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[0.74, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

// Toro girando no próprio eixo — forma clássica, leitura imediata.
function RingModel({ color }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.6;
    ref.current.rotation.z += delta * 0.25;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[0.48, 0.18, 20, 40]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.48} metalness={0.6} roughness={0.22} />
    </mesh>
  );
}

// Octaedro (diamante) girando lentamente — facetas nítidas captam a luz bem.
function DiamondModel({ color }) {
  const ref = useRef(null);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.7;
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.4) * 0.3;
  });
  return (
    <group ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.48} metalness={0.75} roughness={0.12} />
      </mesh>
    </group>
  );
}

// Torus knot — forma complexa, muito sci-fi, auto-oclusão cria profundidade.
function KnotModel({ color }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.42;
    ref.current.rotation.x += delta * 0.18;
  });
  return (
    <mesh ref={ref}>
      <torusKnotGeometry args={[0.38, 0.12, 110, 16, 2, 3]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} metalness={0.6} roughness={0.25} />
    </mesh>
  );
}

const MODELS = { gem: GemModel, ring: RingModel, diamond: DiamondModel, knot: KnotModel };

const SHAPES = [
  { kind: 'gem',     color: '#39ff14', fx: -0.72, y:  1.45, z: -1,   scale: 0.9,  speed: 0.6, phase: 0   },
  { kind: 'ring',    color: '#bf00ff', fx:  0.74, y:  1.5,  z: -1.2, scale: 0.95, speed: 0.8, phase: 1.4 },
  { kind: 'diamond', color: '#ffb020', fx: -0.66, y: -1.55, z: -1.4, scale: 0.85, speed: 0.5, phase: 2.6 },
  { kind: 'knot',    color: '#00ffff', fx:  0.72, y: -1.45, z: -1.6, scale: 0.9,  speed: 0.9, phase: 3.8 },
];

function FloatingShape({ kind, color, x, y, z, modelScale, sizeScale, speed, phase, index }) {
  const ref = useRef(null);
  const delay = SHAPE_BASE_DELAY + index * SHAPE_STAGGER;
  const Model = MODELS[kind];
  useBob(ref, { speed, amplitude: 0.28, baseY: y, phase });

  useFrame(({ clock }) => {
    const popP = THREE.MathUtils.clamp((clock.elapsedTime - delay) / SHAPE_POP_TIME, 0, 1);
    const pop  = popP <= 0 ? 0 : easeOutBack(popP);
    if (ref.current) ref.current.scale.setScalar(sizeScale * modelScale * Math.max(pop, 0));
  });

  return (
    <group ref={ref} position={[x, y, z]} scale={0}>
      <Model color={color} />
    </group>
  );
}

export function FloatingShapes() {
  const { viewport } = useThree();
  const halfWidth = viewport.width / 2;
  const sizeScale = THREE.MathUtils.clamp(viewport.width / 6, 0.55, 1);

  return SHAPES.map((shape, i) => (
    <FloatingShape key={i} {...shape} index={i} x={shape.fx * halfWidth} modelScale={shape.scale} sizeScale={sizeScale} />
  ));
}
