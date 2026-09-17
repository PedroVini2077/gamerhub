import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { aplicarMeta } from '../../lib/metaDaPagina';

/**
 * `[17/09]` Ajusta `<title>`, `description` e `canonical` quando a rota muda.
 *
 * Irmão do `RolagemDeRota`, e pelo mesmo motivo estrutural: **navegação do
 * React Router não é carregamento de documento**. O navegador não recarrega o
 * `index.html`, então o `<title>` que veio dele fica — e as seis páginas
 * públicas se anunciavam todas como *"GamerHub — a comunidade gamer
 * brasileira"*.
 *
 * Para quem indexa, seis endereços que se anunciam igual são a mesma página.
 *
 * ── Por que o catálogo mora em `lib/` e não aqui ────────────────────────────
 *
 * Porque o teste de contrato precisa ler o catálogo **sem montar React**: ele
 * cruza as rotas públicas do router com as chaves de `META` e falha se alguma
 * ficar de fora. Num componente, isso exigiria renderizar para descobrir.
 *
 * ── O que este componente NÃO faz, de propósito ─────────────────────────────
 *
 * Não toca em `og:` nem em `twitter:`. Raspador de cartão social **não executa
 * JavaScript** — mexer neles aqui não chegaria ao WhatsApp nem ao Discord, e
 * criaria a ilusão de que o cartão muda por página. Eles seguem estáticos no
 * `index.html`, que é onde esses leitores conseguem vê-los.
 *
 * Não inventa meta para rota que não está no catálogo: página atrás de login
 * não deve se anunciar para quem indexa, e o `robots.txt` já pede para não
 * rastreá-la.
 */
export default function MetaDaRota() {
  const { pathname } = useLocation();

  useEffect(() => {
    aplicarMeta(pathname);
  }, [pathname]);

  return null;
}
