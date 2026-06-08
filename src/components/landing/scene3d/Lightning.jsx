import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Eletricidade EXCLUSIVA do Hero: arcos de raio que disparam em volta da logo
// + flashes de "trovão". Cada arco carrega sua própria luz, que acende no
// ponto onde ele "atinge" — assim ilumina de verdade o que está por perto
// (a logo, os objetos flutuantes), igual um relâmpago real clareia o céu por
// onde passa, em vez de só desenhar uma linha brilhante. Tudo imperativo no
// useFrame (sem re-render do React). Decorativo; a cena já respeita
// prefers-reduced-motion (Scene3D nem monta nesse caso).

const SEGMENTS = 9;
const ORIGIN = new THREE.Vector3(0, 1.45, -0.7); // perto da logo

// Um arco: relâmpago em zigue-zague que "estala" e some, com intervalos
// aleatórios. Caminho gerado por interpolação + jitter perpendicular. A
// geometria é acessada só via lineRef dentro do useFrame (nunca no render).
const LINE_LIFE = 0.2;
const LIGHT_LIFE = 0.36;

function Arc({ color, spread = 0.5, reach = 1.4, gap = [0.6, 2.2], delay = 0 }) {
  const lineRef = useRef(null);
  const matRef = useRef(null);
  const lightRef = useRef(null);
  // `delay` (constante por arco) desencontra o primeiro disparo sem usar
  // Math.random no render; a aleatoriedade real fica no useFrame.
  const timing = useRef({ next: delay, life: 0, lightLife: 0 });

  useFrame(({ clock }, delta) => {
    const geometry = lineRef.current?.geometry;
    if (!geometry) return;
    const T = timing.current;
    if (T.life > 0) {
      T.life -= delta;
      // O traço "estala" — some rápido e seco, igual um relâmpago de verdade.
      if (matRef.current) matRef.current.opacity = Math.max(0, T.life / LINE_LIFE);
    }
    if (T.lightLife > 0) {
      T.lightLife -= delta;
      // A luz dura um pouco mais e segue uma curva em sino (sobe e desce
      // suave) — brilho residual de relâmpago no ambiente, não um flash de
      // câmera ligando/desligando seco feito a logo "piscar".
      const p = THREE.MathUtils.clamp(1 - T.lightLife / LIGHT_LIFE, 0, 1);
      if (lightRef.current) lightRef.current.intensity = Math.sin(p * Math.PI) * 4.5;
    }
    if (clock.elapsedTime >= T.next) {
      const angle = Math.random() * Math.PI * 2;
      const r = reach * (0.5 + Math.random() * 0.6);
      const tx = ORIGIN.x + Math.cos(angle) * r;
      const ty = ORIGIN.y + Math.sin(angle) * r * 0.8;
      const tz = ORIGIN.z + (Math.random() - 0.5) * 0.6;
      const pos = geometry.attributes.position.array;
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const j = i > 0 && i < SEGMENTS ? spread : 0;
        pos[i * 3]     = THREE.MathUtils.lerp(ORIGIN.x, tx, t) + (Math.random() - 0.5) * j;
        pos[i * 3 + 1] = THREE.MathUtils.lerp(ORIGIN.y, ty, t) + (Math.random() - 0.5) * j;
        pos[i * 3 + 2] = THREE.MathUtils.lerp(ORIGIN.z, tz, t) + (Math.random() - 0.5) * j * 0.5;
      }
      geometry.attributes.position.needsUpdate = true;
      T.life = LINE_LIFE;
      T.lightLife = LIGHT_LIFE;
      if (matRef.current) matRef.current.opacity = 1;
      // A luz fica no meio do caminho do arco — ilumina de verdade a área
      // por onde ele passou (logo + objetos por perto), na cor do raio,
      // exatamente como um relâmpago real clareia o que está ao redor (a
      // posição é fixada aqui; a intensidade sobe/desce sozinha no useFrame).
      if (lightRef.current) {
        lightRef.current.position.set(
          THREE.MathUtils.lerp(ORIGIN.x, tx, 0.5),
          THREE.MathUtils.lerp(ORIGIN.y, ty, 0.5),
          THREE.MathUtils.lerp(ORIGIN.z, tz, 0.5) + 0.5,
        );
      }
      T.next = clock.elapsedTime + gap[0] + Math.random() * (gap[1] - gap[0]);
    }
  });

  return (
    <>
      <pointLight ref={lightRef} color={color} intensity={0} distance={4} decay={1.7} />
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array((SEGMENTS + 1) * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </line>
    </>
  );
}

// Flash de trovão: a luz dá um pico curto e some, de tempos em tempos.
function ThunderFlash() {
  const ref = useRef(null);
  const timing = useRef({ next: 2.5, life: 0 });

  useFrame(({ clock }, delta) => {
    const T = timing.current;
    if (T.life > 0) {
      T.life -= delta;
      if (ref.current) ref.current.intensity = Math.max(0, T.life / 0.12) * 3.2;
    }
    if (clock.elapsedTime >= T.next) {
      T.life = 0.12;
      T.next = clock.elapsedTime + 2 + Math.random() * 4;
    }
  });

  return <pointLight ref={ref} position={[0, 1.45, 0.8]} intensity={0} color="#d8ffe6" distance={9} />;
}

export default function Lightning() {
  return (
    <group>
      <Arc color="#7df9ff" spread={0.42} reach={1.5} gap={[0.5, 1.6]} delay={0.4} />
      <Arc color="#39ff14" spread={0.55} reach={1.3} gap={[0.7, 2.0]} delay={1.1} />
      <Arc color="#bf00ff" spread={0.38} reach={1.6} gap={[0.9, 2.4]} delay={1.8} />
      <ThunderFlash />
    </group>
  );
}
