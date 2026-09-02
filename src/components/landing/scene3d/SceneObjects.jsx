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

/**
 * Tempo acumulado a partir do `delta`, e NÃO `clock.elapsedTime`.
 *
 * O `@react-three/fiber` zera o relógio da cena a cada mudança de `frameloop`
 * (`setFrameloop` faz `clock.elapsedTime = 0`), e ele muda toda vez que a cena
 * sai e volta para a viewport. Ver `lib/ritmoDoRaio.js`, onde o mesmo defeito
 * deixava o raio mudo.
 *
 * Cada componente acumula o seu: assim não existe ordem de execução entre
 * `useFrame`s para dar errado. O teto de 1 s protege do salto que o navegador
 * entrega no primeiro quadro depois de a aba ficar em segundo plano.
 */
function useTempoAcumulado() {
  const t = useRef(0);
  return { t, avanca: (delta) => { t.current += Math.min(delta, 1); } };
}

function useBob(ref, { speed = 1, amplitude = 0.18, baseY = 0, phase = 0 }) {
  const tempo = useTempoAcumulado();
  useFrame((_estado, delta) => {
    tempo.avanca(delta);
    if (!ref.current) return;
    // Com o relógio da cena, o seno saltava de fase ao voltar para a tela e os
    // objetos davam um pulo. Com tempo acumulado, a oscilação continua de onde
    // parou.
    ref.current.position.y = baseY + Math.sin(tempo.t.current * speed + phase) * amplitude;
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

  const tempoDaLogo = useTempoAcumulado();
  useFrame((_estado, delta) => {
    tempoDaLogo.avanca(delta);
    // O caso mais visível da classe: com o relógio da cena zerando a cada
    // volta para a viewport, `growP` voltava a 0 e A LOGO encolhia até sumir
    // para refazer a entrada. Tempo acumulado faz a entrada acontecer uma vez.
    const t = tempoDaLogo.t.current;
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
      <mesh ref={meshRef} geometry={geometry} rotation={[0.34, 0, 0]} scale={0} renderOrder={1}>
        <meshStandardMaterial ref={matRef} color="#1e8c0c" emissive="#39ff14" emissiveIntensity={0.55} metalness={0.55} roughness={0.28} />
      </mesh>
    </group>
  );
}

// ─── Formas geométricas flutuantes ──────────────────────────────────────────
// Todas as formas são wireframe com depthWrite={false} para ficarem sempre
// atrás de qualquer outro objeto da cena (o raio usa renderOrder=1).

const WIRE = { wireframe: true, depthWrite: false };

// Dois icosaedros contra-rotativos — cara de grafo/rede digital.
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
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} {...WIRE} />
      </mesh>
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[0.74, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} {...WIRE} />
      </mesh>
    </group>
  );
}

function RingModel({ color }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.6;
    ref.current.rotation.z += delta * 0.25;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[0.48, 0.18, 16, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} {...WIRE} />
    </mesh>
  );
}

function DiamondModel({ color }) {
  const ref = useRef(null);
  const tempo = useTempoAcumulado();
  useFrame((_estado, delta) => {
    tempo.avanca(delta);
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.7;
    ref.current.rotation.x = Math.sin(tempo.t.current * 0.4) * 0.3;
  });
  return (
    <group ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} {...WIRE} />
      </mesh>
    </group>
  );
}

function DodecaModel({ color }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.38;
    ref.current.rotation.x += delta * 0.22;
  });
  return (
    <mesh ref={ref}>
      <dodecahedronGeometry args={[0.62, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} {...WIRE} />
    </mesh>
  );
}

const MODELS = { gem: GemModel, ring: RingModel, diamond: DiamondModel, dodeca: DodecaModel };

const SHAPES = [
  { kind: 'gem',     color: '#39ff14', fx: -0.72, y:  1.45, z: -1,   scale: 0.9,  speed: 0.6, phase: 0   },
  { kind: 'ring',    color: '#bf00ff', fx:  0.74, y:  1.5,  z: -1.2, scale: 0.95, speed: 0.8, phase: 1.4 },
  { kind: 'diamond', color: '#ffb020', fx: -0.66, y: -1.55, z: -1.4, scale: 0.85, speed: 0.5, phase: 2.6 },
  { kind: 'dodeca',  color: '#00ffff', fx:  0.72, y: -1.45, z: -1.6, scale: 0.9,  speed: 0.9, phase: 3.8 },
];

function FloatingShape({ kind, color, x, y, z, modelScale, sizeScale, speed, phase, index }) {
  const ref = useRef(null);
  const delay = SHAPE_BASE_DELAY + index * SHAPE_STAGGER;
  const Model = MODELS[kind];
  useBob(ref, { speed, amplitude: 0.28, baseY: y, phase });

  const tempoDaEntrada = useTempoAcumulado();
  useFrame((_estado, delta) => {
    tempoDaEntrada.avanca(delta);
    // Este era o caso PIOR da mesma classe: com o relógio zerando, `popP`
    // voltava a 0, a escala ia a zero e as formas SUMIAM para refazer a
    // animação de entrada a cada volta para a viewport. Com tempo acumulado a
    // entrada acontece uma vez só, como sempre foi a intenção.
    const popP = THREE.MathUtils.clamp((tempoDaEntrada.t.current - delay) / SHAPE_POP_TIME, 0, 1);
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
