import { useEffect, useRef, useState } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import {
  AmbientLight, BufferAttribute, BufferGeometry, DirectionalLight,
  DodecahedronGeometry, Group, IcosahedronGeometry, Line, LineBasicMaterial,
  Mesh, MeshStandardMaterial, OctahedronGeometry, PointLight, TorusGeometry,
} from 'three';
import { LogoBolt, FloatingShapes } from './SceneObjects';
import Lightning from './Lightning';
import ResolucaoAdaptativa from './ResolucaoAdaptativa';
import { DEGRAUS_DE_RESOLUCAO } from '../../../lib/resolucaoDaCena';

/**
 * A cena 3D do Hero — montada por `createRoot`, e não por `<Canvas>`.
 *
 * ── Por que trocar o `<Canvas>`, com o número que decidiu ───────────────────
 *
 * `<Canvas>` traz junto o sistema de eventos de ponteiro do fiber: raycasting
 * a cada movimento do mouse, mapeamento de eventos, medição de camadas. Esta
 * cena **não tem um único manipulador de clique ou de ponteiro** — ela é
 * decoração pura —, então tudo isso era peso morto.
 *
 * Pesado em 29/08, cada biblioteca sozinha (build de lib, sem minificar):
 *
 *     só `three`                       604 kB
 *     `@react-three/fiber` com Canvas  1.420 kB
 *     `@react-three/fiber` só createRoot 1.137 kB   <- −20%
 *
 * E o que sobra importa: o A/B da landing com e sem a cena, sob freio de CPU
 * de 4×, mostrou que a cena responde por **520 ms de thread principal** — e,
 * depois da resolução adaptativa, esses 520 ms são quase todos **carga**
 * (parse e execução dos 888 kB), não mais o laço de animação, que passou a dar
 * zero long tasks.
 *
 * ── O que a troca custa, e como isso foi coberto ────────────────────────────
 *
 * `<Canvas>` faz sozinho duas coisas que agora são nossas:
 *
 * | O que ele fazia | O que fazemos |
 * | --- | --- |
 * | medir o contêiner e reconfigurar ao redimensionar | `ResizeObserver` chamando `configure({ size })` |
 * | esperar ter tamanho antes de renderizar | não renderizamos com 0×0 — senão o canvas nasce vazio e nunca se recupera |
 *
 * `e2e/cena-3d.mjs` cobre os dois: ele reprova se não houver canvas, se a cena
 * não desenhar estando visível, se continuar desenhando fora da tela, se
 * estourar o teto de thread principal, e se o canvas não acompanhar uma
 * mudança de tamanho da janela.
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
// `antialias` desligado: ele multiplica o custo por pixel justamente na conta
// que se mostrou dominante, e numa cena de formas brilhantes e difusas o
// serrilhado que ele suaviza quase não aparece.
const GL = { antialias: false, alpha: true };

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
      <ResolucaoAdaptativa />
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
        camera: CAMERA, gl: GL,
        dpr: DEGRAUS_DE_RESOLUCAO[0],
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
    raiz.current?.configure({ frameloop: visivel ? 'always' : 'never' });
  }, [visivel]);

  return (
    <div ref={involucro} style={{ width: '100%', height: '100%' }}>
      <canvas ref={tela} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
