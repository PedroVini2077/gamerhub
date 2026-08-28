import { lazy, Suspense, useEffect, useState } from 'react';
import Scene2D from './Scene2D';
import { modoDaCena } from '../../lib/cena3D';

const LandingScene = lazy(() => import('./scene3d/LandingScene'));

// ── O problema que este arquivo resolve ─────────────────────────────────────
//
// A cena 3D é o maior asset do site: 887 KB de JavaScript (236 KB comprimidos),
// quase tudo three.js. O código usa cinco símbolos da biblioteca, mas o
// renderer WebGL inteiro vem junto — tree-shaking não alcança isso.
//
// Ela já era `lazy()`, o que a mantém fora do bundle inicial. Só que `lazy()`
// separa o chunk, **não adia o download**: o `<Scene3D>` mora dentro do Hero,
// que é a primeira coisa que um visitante vê, então o pedido saía no mesmo
// instante da montagem. Para quem chega no site, era caminho crítico com
// outro nome.
//
// O Lighthouse de 27/08/2026 mediu, num celular mediano: 13,9 s de main
// thread, 3,7 s de bloqueio e 9,7 s até ficar interativo — com o servidor
// respondendo em 30 ms. E era esse bloqueio que engolia o raio de abertura:
// animação do framer-motion é guiada por relógio, então main thread travada
// não a deixa lenta, faz ela PULAR para o estado final.
//
// Duas defesas, e elas são independentes:
//
//  1. **Quem recebe a cena 3D** — só aparelho que dá conta, ou quem pediu
//     explicitamente. Essa decisão mora em `lib/cena3D.js`, porque o
//     `BotaoCena3D` precisa da mesma resposta para saber o que oferecer.
//  2. **Quando ela é baixada** — nunca durante o carregamento inicial. É o que
//     este arquivo resolve.
//
// Quem não recebe a 3D não fica sem nada: a `Scene2D` desenha o mesmo arranjo
// em SVG + CSS, com custo de JavaScript zero.

// Teto para o `requestIdleCallback`: se o navegador nunca ficar ocioso, a cena
// entra assim mesmo.
const TETO_DE_ESPERA_MS = 3000;

// Usado onde `requestIdleCallback` não existe (Safari mais antigo). Fica acima
// da duração da intro (~1,27 s) para o raio ter a main thread só para ele.
const ESPERA_SEM_IDLE_MS = 1500;

// Teto ABSOLUTO, contado da montagem e independente de qualquer evento.
//
// A primeira versão deste arquivo esperava o evento `load` antes de agendar o
// ocioso, e isso era falha silenciosa esperando acontecer: `load` só dispara
// quando TODO recurso inicial termina, incluindo o CSS de fonte do Google. Se
// esse pedido pendura — proxy corporativo, rede ruim, domínio bloqueado — o
// `load` nunca chega e a cena nunca aparece. Ninguém reclamaria: é enfeite,
// então some sem erro, sem log e sem teste quebrando (CLAUDE.md §1.5).
//
// Não é hipótese. Medido no sandbox onde o Google Fonts é inalcançável:
// `document.readyState` ficou em `interactive` por 9 s e o canvas nunca montou.
const TETO_ABSOLUTO_MS = 2500;

/**
 * Libera a cena 3D no primeiro destes dois que acontecer:
 *
 *  - o carregamento inicial terminar (`load`) **e** o navegador ficar ocioso —
 *    o caminho normal, que dá a main thread inteira para a intro;
 *  - o teto absoluto estourar — a rede de segurança, para o caso de o `load`
 *    nunca chegar (ver `TETO_ABSOLUTO_MS`).
 *
 * As duas condições do caminho normal importam. Esperar só o ocioso não basta:
 * durante a intro há folga entre os quadros, e o `requestIdleCallback`
 * dispararia em plena animação. Esperar só o `load` também não basta: ele
 * marca o fim do download, não o fim do trabalho de CPU.
 */
function useCenaLiberada(ativo) {
  const [liberada, setLiberada] = useState(false);

  useEffect(() => {
    if (!ativo) return undefined;

    let cancelado = false;
    let cancelarOcioso = () => {};

    const liberar = () => { if (!cancelado) setLiberada(true); };

    // Rede de segurança: corre desde a montagem, em paralelo com tudo abaixo,
    // e não depende de evento nenhum.
    const idTetoAbsoluto = window.setTimeout(liberar, TETO_ABSOLUTO_MS);

    const agendarNoOcioso = () => {
      if (cancelado) return;
      if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(liberar, { timeout: TETO_DE_ESPERA_MS });
        cancelarOcioso = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(liberar, ESPERA_SEM_IDLE_MS);
        cancelarOcioso = () => window.clearTimeout(id);
      }
    };

    // `readyState === 'complete'` cobre o caso de o React montar depois do
    // `load` — aí o evento já passou e esperar por ele travaria para sempre.
    if (document.readyState === 'complete') agendarNoOcioso();
    else window.addEventListener('load', agendarNoOcioso, { once: true });

    return () => {
      cancelado = true;
      window.clearTimeout(idTetoAbsoluto);
      cancelarOcioso();
      window.removeEventListener('load', agendarNoOcioso);
    };
  }, [ativo]);

  return liberada;
}

// Decorativo: `aria-hidden` + `pointer-events-none`.
export default function Scene3D({ className = '' }) {
  // `useState(fn)` roda a decisão uma vez, na montagem — o modo não muda no
  // meio da sessão (trocar exige recarregar; ver `BotaoCena3D`), e reavaliar
  // a cada render só gastaria trabalho.
  const [modo] = useState(modoDaCena);
  const cena3DLiberada = useCenaLiberada(modo === 'completo');

  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      {modo === 'completo' && cena3DLiberada ? (
        // A `Scene2D` como fallback do Suspense mantém o Hero decorado
        // enquanto os 887 KB chegam, em vez de deixar um buraco.
        <Suspense fallback={<Scene2D />}>
          <LandingScene />
        </Suspense>
      ) : (
        <Scene2D />
      )}
    </div>
  );
}
