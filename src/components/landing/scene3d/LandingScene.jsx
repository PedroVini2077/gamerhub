import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { LogoBolt, FloatingShapes } from './SceneObjects';
import Lightning from './Lightning';
import ResolucaoAdaptativa from './ResolucaoAdaptativa';
import { DEGRAUS_DE_RESOLUCAO } from '../../../lib/resolucaoDaCena';

/**
 * O laço de animação só roda enquanto a cena está NA TELA.
 *
 * ── O número que motivou isto ───────────────────────────────────────────────
 *
 * PageSpeed de 28/08, desktop, repartição da thread principal:
 *
 *     Other                       29.441 ms   <- o laço de animação
 *     Script Evaluation              789 ms
 *     Script Parsing & Compilation    79 ms
 *
 * 96% do tempo estava em "Other", que num app WebGL é o `requestAnimationFrame`
 * rodando. Parsear e executar os 887 KB custa menos de 900 ms — ou seja, o
 * problema NUNCA foi o tamanho do arquivo, e a otimização que eu ia fazer
 * (cortar 20% de bytes) teria mexido nos 789 ms e deixado os 29.441 ms
 * intactos. Foi o perfil de CPU que apontou o lugar certo; byte e CPU são
 * contas diferentes (`CLAUDE.md` §0.3).
 *
 * ── Por que `IntersectionObserver`, e não `frameloop="demand"` ──────────────
 *
 * `demand` só desenha quando algo pede um quadro, e esta cena é animada por
 * natureza — o logo gira, os sólidos flutuam, o raio pisca. Com `demand` ela
 * congelaria enquanto visível, que é justamente quando ela precisa animar.
 *
 * O desperdício real é outro: a cena fica no Hero, no topo da página, e
 * continuava desenhando 60 vezes por segundo **depois que o visitante rolou
 * para longe dela**. Ninguém vê e a CPU paga. Parar aí não custa nada em
 * experiência e devolve a thread principal.
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
      // Uma margem generosa: volta a animar um pouco antes de reaparecer, para
      // a cena nunca ser vista parada durante a rolagem.
      { rootMargin: '200px' },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [ref]);

  return visivel;
}

// Cena 3D exclusiva do Hero — carregada sob demanda (ver Scene3D.jsx) pra não
// pesar no bundle inicial. Só geometria simples + materiais emissivos: leve o
// bastante pra rodar liso mesmo em devices mais fracos.
export default function LandingScene() {
  const involucro = useRef(null);
  const visivel = useVisivel(involucro);

  return (
    <div ref={involucro} style={{ width: '100%', height: '100%' }}>
    <Canvas
      // Começa no degrau mais barato e sobe se o aparelho aguentar — ver
      // `ResolucaoAdaptativa`, que tem a medição que motivou isto.
      dpr={DEGRAUS_DE_RESOLUCAO[0]}
      // `antialias` SAIU. Ele multiplica o custo por pixel justamente na conta
      // que se mostrou dominante, e numa cena de formas brilhantes e difusas o
      // serrilhado que ele suaviza quase não aparece. Medido: 88 -> 133 quadros
      // na mesma janela, só tirando ele e o dpr de 1,5 para 1.
      gl={{ antialias: false, alpha: true }}
      camera={{ position: [0, 0, 5.5], fov: 42 }}
      frameloop={visivel ? 'always' : 'never'}
    >
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
    </Canvas>
    </div>
  );
}
