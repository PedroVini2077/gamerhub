import { lazy, Suspense, useState } from 'react';

const LandingScene = lazy(() => import('./scene3d/LandingScene'));

// A cena 3D é o maior asset do site (~236KB gzip de three.js + fiber). É
// decorativa, então nunca deve ser baixada quando não vai ser aproveitada.
// `lazy()` mantém ela fora do bundle inicial; as checagens abaixo evitam até
// o download do chunk nos casos em que ela é desperdício:
//
//  - `prefers-reduced-motion`: o usuário pediu menos movimento.
//  - `saveData`: o usuário está em modo de economia de dados.
//  - conexão 2g/3g: baixar 236KB de enfeite antes do conteúdo é ruim de verdade.
//  - pouca memória (`deviceMemory` <= 1GB): WebGL trava mais do que enfeita.
//
// Todas as APIs são opcionais e só existem em parte dos browsers — na dúvida,
// mantém a cena (comportamento de antes).
function shouldRender3D() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

    const conn = navigator.connection;
    if (conn?.saveData) return false;
    if (conn?.effectiveType && /(^|-)(2g|3g)$/.test(conn.effectiveType)) return false;

    if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 1) return false;

    return true;
  } catch {
    return true;
  }
}

// Decorativo: aria-hidden + pointer-events-none.
export default function Scene3D({ className = '' }) {
  const [enabled] = useState(shouldRender3D);

  if (!enabled) return null;

  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      <Suspense fallback={null}>
        <LandingScene />
      </Suspense>
    </div>
  );
}
