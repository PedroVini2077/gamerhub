import { Canvas } from '@react-three/fiber';
import { LogoBolt, FloatingShapes } from './SceneObjects';

// Cena 3D exclusiva do Hero — carregada sob demanda (ver Scene3D.jsx) pra não
// pesar no bundle inicial. Só geometria simples + materiais emissivos: leve o
// bastante pra rodar liso mesmo em devices mais fracos.
export default function LandingScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 5.5], fov: 42 }}
    >
      <ambientLight intensity={0.45} />
      <pointLight position={[4, 3, 4]} intensity={1.4} color="#39ff14" />
      <pointLight position={[-4, -2, 3]} intensity={1.1} color="#bf00ff" />
      <LogoBolt />
      <FloatingShapes />
    </Canvas>
  );
}
