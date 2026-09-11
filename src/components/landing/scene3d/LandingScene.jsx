import { useEffect, useRef, useState } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import {
  AmbientLight, BufferAttribute, BufferGeometry, DirectionalLight,
  DodecahedronGeometry, Group, IcosahedronGeometry, Line, LineBasicMaterial,
  Mesh, MeshStandardMaterial, OctahedronGeometry, PointLight, TorusGeometry,
} from 'three';
import { LogoBolt, FloatingShapes } from './SceneObjects';
import Lightning from './Lightning';

/**
 * A cena 3D do Hero — montada por `createRoot`, e não por `<Canvas>`.
 *
 * ── `[29/08]` O QUE FOI DESFEITO, e por quê ─────────────────────────────────
 *
 * Numa tentativa de otimizar, esta cena ganhou resolução adaptativa, antialias
 * desligado e um fade de entrada. O dono testou no celular e no PC e reprovou —
 * três vezes, cada vez com um sintoma novo:
 *
 * | Sintoma | Causa |
 * | --- | --- |
 * | "começa muito pixelada" | a resolução começava em `dpr` 0,5 |
 * | "a luz verde não fica tão forte" | resolução baixa borra o degradê do `pointLight` |
 * | "o raio às vezes é cortado pela metade" / cena escura | o fade de 500 ms, pego no meio |
 *
 * **Tudo isso saiu.** O `dpr` e o `gl` voltaram a ser exatamente os de antes, e
 * não há mais fade nem remontagem.
 *
 * A lição, e é minha: eu estava otimizando o número do Lighthouse contra a
 * coisa que o número existe para medir. Para a ferramenta, cena feia e cena
 * bonita valem igual — e eu insisti três rodadas antes de aceitar isso.
 *
 * ── O que FICOU, porque é invisível e está medido ───────────────────────────
 *
 * **1. `createRoot` no lugar de `<Canvas>`.** O `<Canvas>` traz o sistema de
 * eventos de ponteiro do fiber (raycasting a cada movimento), e esta cena não
 * tem um único manipulador de clique — é decoração. Vale −20% do chunk
 * (888 → 708 kB), com zero efeito no que aparece na tela.
 *
 * **2. O laço parado fora da tela.** Um `IntersectionObserver` desliga o
 * `frameloop` quando a cena sai da viewport: ninguém vê, e a CPU parava de
 * pagar. Medido: 0 desenhos com a cena longe.
 *
 * ── O que o `<Canvas>` fazia e agora é nosso ────────────────────────────────
 *
 * | O que ele fazia | O que fazemos |
 * | --- | --- |
 * | medir o contêiner e reconfigurar ao redimensionar | `ResizeObserver` chamando `configure({ size })` |
 * | esperar ter tamanho antes de renderizar | não renderizamos com 0×0 — senão o canvas nasce vazio e nunca se recupera |
 * | soltar o contexto WebGL ao desmontar | `root.unmount()` no cleanup |
 *
 * `e2e/cena-3d.mjs` cobre os três, e todos foram provados reinjetando o defeito.
 */

// O catálogo do fiber, explícito. Cada nome aqui vira uma tag JSX minúscula:
// `Mesh` -> `<mesh>`, `MeshStandardMaterial` -> `<meshStandardMaterial>`.
//
// Registrar só o que a cena usa é o que permite ao empacotador descartar o
// resto — e é também uma lista fechada: uma tag nova que ninguém registrar
// falha na hora, em vez de virar um nó silenciosamente ignorado (§4).
extend({
  AmbientLight, BufferAttribute, BufferGeometry, DirectionalLight,
  DodecahedronGeometry, Group, IcosahedronGeometry, Line, LineBasicMaterial,
  Mesh, MeshStandardMaterial, OctahedronGeometry, PointLight, TorusGeometry,
});

const CAMERA = { position: [0, 0, 5.5], fov: 42 };
// Exatamente como era antes de 29/08. Ver o bloco no topo do arquivo sobre o
// que foi desfeito e por quê.
const DPR = [1, 1.5];
const GL = { antialias: true, alpha: true };

/**
 * O laço de animação só roda enquanto a cena está NA TELA.
 *
 * O desperdício que isto fecha: a cena fica no Hero, no topo da página, e
 * continuava desenhando 60 vezes por segundo depois que o visitante rolou para
 * longe dela. Ninguém vê e a CPU paga.
 *
 * `IntersectionObserver` e não `frameloop="demand"` puro: `demand` só desenha
 * quando alguém pede um quadro, e esta cena é animada por natureza — com
 * `demand` ela congelaria justamente enquanto visível.
 */
function useVisivel(ref) {
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const alvo = ref.current;
    // Navegador sem IntersectionObserver mantém o comportamento antigo
    // (sempre animando) em vez de ficar com a cena congelada para sempre —
    // ausência de API não pode virar funcionalidade quebrada.
    if (!alvo || typeof IntersectionObserver === 'undefined') return undefined;

    const observador = new IntersectionObserver(
      ([entrada]) => setVisivel(entrada.isIntersecting),
      // Margem generosa: volta a animar um pouco antes de reaparecer, para a
      // cena nunca ser vista parada durante a rolagem.
      { rootMargin: '200px' },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [ref]);

  return visivel;
}

function Conteudo() {
  return (
    <>
      <ambientLight intensity={0.35} />
      {/* Luz principal branca em ângulo: cria sombreado nas faces e realça a
          profundidade da extrusão enquanto o logo gira. */}
      <directionalLight position={[3, 4, 5]} intensity={1.6} color="#eafff0" />
      <pointLight position={[4, 3, 4]} intensity={1.2} color="#39ff14" />
      <pointLight position={[-4, -2, 3]} intensity={1.1} color="#bf00ff" />
      <LogoBolt />
      <FloatingShapes />
      <Lightning />
    </>
  );
}

export default function LandingScene() {
  const involucro = useRef(null);
  const tela = useRef(null);
  const raiz = useRef(null);
  const visivel = useVisivel(involucro);
  // Espelho do `visivel` numa ref: a raiz pode ser recriada (ver `semAntialias`)
  // e precisa nascer já com o `frameloop` certo. Ler o estado direto no efeito
  // de montagem exigiria pô-lo nas dependências — e aí a cena remontaria a cada
  // rolagem, jogando fora o contexto WebGL várias vezes por sessão.
  const visivelRef = useRef(visivel);


  useEffect(() => {
    const canvas = tela.current;
    const alvo = involucro.current;
    if (!canvas || !alvo) return undefined;

    const raizLocal = createRoot(canvas);
    raiz.current = raizLocal;
    let renderizou = false;

    const aplicar = () => {
      const width = alvo.clientWidth;
      const height = alvo.clientHeight;
      // Configurar com 0×0 deixa o canvas vazio e ele não se recupera sozinho.
      // O `<Canvas>` esperava a medição; aqui a espera é esta guarda, e o
      // `ResizeObserver` abaixo dispara de novo assim que houver tamanho.
      if (!width || !height) return;
      raizLocal.configure({
        camera: CAMERA, gl: GL, dpr: DPR,
        // O `frameloop` vai junto da criação, lido de uma ref: a raiz precisa
        // nascer já sabendo se a cena está visível.
        frameloop: visivelRef.current ? 'always' : 'never',
        size: { width, height, top: 0, left: 0 },
      });
      if (!renderizou) {
        raizLocal.render(<Conteudo />);
        renderizou = true;
      }
    };

    aplicar();
    const observador = new ResizeObserver(aplicar);
    observador.observe(alvo);

    return () => {
      observador.disconnect();
      raiz.current = null;
      raizLocal.unmount();
    };
  }, []);

  // O `frameloop` é reconfigurado à parte, e não dentro do efeito de montagem:
  // ele muda com a rolagem, e recriar a raiz a cada mudança jogaria fora o
  // contexto WebGL inteiro várias vezes por sessão.
  useEffect(() => {
    // A ref é sincronizada AQUI, e não no corpo do componente: escrever ref
    // durante o render é o que o `react-hooks/refs` acusa, e com razão — o
    // render pode acontecer sem que o efeito chegue a rodar.
    visivelRef.current = visivel;
    raiz.current?.configure({ frameloop: visivel ? 'always' : 'never' });
  }, [visivel]);

  return (
    <div ref={involucro} style={{ width: '100%', height: '100%' }}>
      <canvas ref={tela} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
