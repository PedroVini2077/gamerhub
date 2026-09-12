import hero1600 from '../assets/landing/cenas/1-hero-larga-1600.webp';
import hero1200 from '../assets/landing/cenas/1-hero-larga-1200.webp';
import hero828 from '../assets/landing/cenas/1-hero-larga-828.webp';
import feed1600 from '../assets/landing/cenas/2-feed-larga-1600.webp';
import feed1200 from '../assets/landing/cenas/2-feed-larga-1200.webp';
import feed828 from '../assets/landing/cenas/2-feed-larga-828.webp';
import comunidade1600 from '../assets/landing/cenas/3-comunidade-larga-1600.webp';
import comunidade1200 from '../assets/landing/cenas/3-comunidade-larga-1200.webp';
import comunidade828 from '../assets/landing/cenas/3-comunidade-larga-828.webp';
import keys1600 from '../assets/landing/cenas/4-keys-larga-1600.webp';
import keys1200 from '../assets/landing/cenas/4-keys-larga-1200.webp';
import keys828 from '../assets/landing/cenas/4-keys-larga-828.webp';
import ranks1600 from '../assets/landing/cenas/5-ranks-larga-1600.webp';
import ranks1200 from '../assets/landing/cenas/5-ranks-larga-1200.webp';
import ranks828 from '../assets/landing/cenas/5-ranks-larga-828.webp';
import lives1600 from '../assets/landing/cenas/6-lives-larga-1600.webp';
import lives1200 from '../assets/landing/cenas/6-lives-larga-1200.webp';
import lives828 from '../assets/landing/cenas/6-lives-larga-828.webp';
import cta1600 from '../assets/landing/cenas/7-cta-larga-1600.webp';
import cta1200 from '../assets/landing/cenas/7-cta-larga-1200.webp';
import cta828 from '../assets/landing/cenas/7-cta-larga-828.webp';

/**
 * As artes das cenas da landing, numa fonte só.
 *
 * ── Por que este arquivo existe ─────────────────────────────────────────────
 *
 * `[12/09]` Cada cena tem **três** arquivos (1600, 1200 e 828 px) e um `srcset`
 * que os amarra. Escrito à mão dentro de cada seção, isso seria a mesma string
 * repetida sete vezes — e a sétima ia divergir. Aqui a `Landing` pede a cena
 * pelo nome e recebe o `src` e o `srcSet` prontos.
 *
 * ── De onde os arquivos vêm ─────────────────────────────────────────────────
 *
 * De `npm run cenas`, que os deriva das referências em
 * `docs/identidade/referencias/cenas/`. **Nada aqui é editado à mão** — trocar
 * uma arte é trocar a referência e rodar o gerador, exatamente como nos ícones.
 *
 * ── As medidas ──────────────────────────────────────────────────────────────
 *
 * As artes originais são 1672×940. `LARGURA`/`ALTURA` abaixo existem para o
 * `<img>` reservar o espaço antes de a imagem chegar — sem elas a página
 * empurra o conteúdo para baixo quando cada cena carrega, que é o pior tipo de
 * salto porque acontece enquanto a pessoa está lendo.
 */

export const LARGURA = 1672;
export const ALTURA = 940;

const par = (g, m, p) => ({
  src: g,
  srcSet: `${p} 828w, ${m} 1200w, ${g} 1600w`,
});

/**
 * Mapa EXPLÍCITO, e não montagem por string: cena que ninguém mapeou devolve
 * `undefined` e estoura na hora, em vez de virar um `<img>` sem `src` — que o
 * navegador desenha como um retângulo vazio, sem erro nenhum (§4).
 */
export const CENAS = {
  hero: par(hero1600, hero1200, hero828),
  feed: par(feed1600, feed1200, feed828),
  comunidade: par(comunidade1600, comunidade1200, comunidade828),
  keys: par(keys1600, keys1200, keys828),
  ranks: par(ranks1600, ranks1200, ranks828),
  lives: par(lives1600, lives1200, lives828),
  cta: par(cta1600, cta1200, cta828),
};
