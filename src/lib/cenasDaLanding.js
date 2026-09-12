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

import heroA828 from '../assets/landing/cenas/1-hero-alta-828.webp';
import heroA620 from '../assets/landing/cenas/1-hero-alta-620.webp';
import heroA420 from '../assets/landing/cenas/1-hero-alta-420.webp';
import feedA828 from '../assets/landing/cenas/2-feed-alta-828.webp';
import feedA620 from '../assets/landing/cenas/2-feed-alta-620.webp';
import feedA420 from '../assets/landing/cenas/2-feed-alta-420.webp';
import comunidadeA828 from '../assets/landing/cenas/3-comunidade-alta-828.webp';
import comunidadeA620 from '../assets/landing/cenas/3-comunidade-alta-620.webp';
import comunidadeA420 from '../assets/landing/cenas/3-comunidade-alta-420.webp';
import keysA828 from '../assets/landing/cenas/4-keys-alta-828.webp';
import keysA620 from '../assets/landing/cenas/4-keys-alta-620.webp';
import keysA420 from '../assets/landing/cenas/4-keys-alta-420.webp';
import ranksA828 from '../assets/landing/cenas/5-ranks-alta-828.webp';
import ranksA620 from '../assets/landing/cenas/5-ranks-alta-620.webp';
import ranksA420 from '../assets/landing/cenas/5-ranks-alta-420.webp';
import livesA828 from '../assets/landing/cenas/6-lives-alta-828.webp';
import livesA620 from '../assets/landing/cenas/6-lives-alta-620.webp';
import livesA420 from '../assets/landing/cenas/6-lives-alta-420.webp';
import ctaA828 from '../assets/landing/cenas/7-cta-alta-828.webp';
import ctaA620 from '../assets/landing/cenas/7-cta-alta-620.webp';
import ctaA420 from '../assets/landing/cenas/7-cta-alta-420.webp';

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

/** A arte LARGA (16:9), do computador. */
export const LARGURA = 1672;
export const ALTURA = 940;

/**
 * A arte de RETRATO, do celular — `[12/09]`.
 *
 * Ela não é um recorte da larga: é uma **composição própria**, que o dono
 * gerou depois de a medição mostrar que espremer 16:9 numa tela em pé deixa o
 * texto da interface com 2–3 px. Corte não escolhe enquadramento; ele só
 * descarta o que sobra.
 */
export const LARGURA_ALTA = 940;
export const ALTURA_ALTA = 1672;

const par = (g, m, p, a828, a620, a420) => ({
  src: g,
  srcSet: `${p} 828w, ${m} 1200w, ${g} 1600w`,
  // O `<picture>` da cena escolhe esta fonte abaixo de 768 px. É **art
  // direction**, não economia de bytes: as duas artes mostram a mesma coisa
  // com composições diferentes, e nenhum `srcset` sozinho sabe trocar de
  // composição — ele só troca de resolução.
  alta: {
    src: a828,
    srcSet: `${a420} 420w, ${a620} 620w, ${a828} 828w`,
  },
});

/**
 * Mapa EXPLÍCITO, e não montagem por string: cena que ninguém mapeou devolve
 * `undefined` e estoura na hora, em vez de virar um `<img>` sem `src` — que o
 * navegador desenha como um retângulo vazio, sem erro nenhum (§4).
 */
export const CENAS = {
  hero: par(hero1600, hero1200, hero828, heroA828, heroA620, heroA420),
  feed: par(feed1600, feed1200, feed828, feedA828, feedA620, feedA420),
  comunidade: par(comunidade1600, comunidade1200, comunidade828, comunidadeA828, comunidadeA620, comunidadeA420),
  keys: par(keys1600, keys1200, keys828, keysA828, keysA620, keysA420),
  ranks: par(ranks1600, ranks1200, ranks828, ranksA828, ranksA620, ranksA420),
  lives: par(lives1600, lives1200, lives828, livesA828, livesA620, livesA420),
  cta: par(cta1600, cta1200, cta828, ctaA828, ctaA620, ctaA420),
};
