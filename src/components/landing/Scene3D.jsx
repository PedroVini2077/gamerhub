import { lazy, Suspense, useState } from 'react';

const LandingScene = lazy(() => import('./scene3d/LandingScene'));

// Só renderiza a cena 3D se o usuário não pediu menos movimento —
// lazy() já cuida do code-split (bundle inicial fica leve). Decorativo:
// aria-hidden + pointer-events-none.
export default function Scene3D({ className = '' }) {
  const [enabled] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (!enabled) return null;

  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      <Suspense fallback={null}>
        <LandingScene />
      </Suspense>
    </div>
  );
}
