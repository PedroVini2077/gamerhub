import conv1600 from '../assets/landing/cenas/1-convergencia-larga-1600.webp';
import conv1200 from '../assets/landing/cenas/1-convergencia-larga-1200.webp';
import conv828 from '../assets/landing/cenas/1-convergencia-larga-828.webp';
import campo1600 from '../assets/landing/cenas/2-campo-larga-1600.webp';
import campo1200 from '../assets/landing/cenas/2-campo-larga-1200.webp';
import campo828 from '../assets/landing/cenas/2-campo-larga-828.webp';
import fluxo1600 from '../assets/landing/cenas/3-fluxo-larga-1600.webp';
import fluxo1200 from '../assets/landing/cenas/3-fluxo-larga-1200.webp';
import fluxo828 from '../assets/landing/cenas/3-fluxo-larga-828.webp';
import fratura1600 from '../assets/landing/cenas/4-fratura-larga-1600.webp';
import fratura1200 from '../assets/landing/cenas/4-fratura-larga-1200.webp';
import fratura828 from '../assets/landing/cenas/4-fratura-larga-828.webp';
import marca1600 from '../assets/landing/cenas/5-marca-larga-1600.webp';
import marca1200 from '../assets/landing/cenas/5-marca-larga-1200.webp';
import marca828 from '../assets/landing/cenas/5-marca-larga-828.webp';

import convA828 from '../assets/landing/cenas/1-convergencia-alta-828.webp';
import convA620 from '../assets/landing/cenas/1-convergencia-alta-620.webp';
import convA420 from '../assets/landing/cenas/1-convergencia-alta-420.webp';
import campoA828 from '../assets/landing/cenas/2-campo-alta-828.webp';
import campoA620 from '../assets/landing/cenas/2-campo-alta-620.webp';
import campoA420 from '../assets/landing/cenas/2-campo-alta-420.webp';
import fluxoA828 from '../assets/landing/cenas/3-fluxo-alta-828.webp';
import fluxoA620 from '../assets/landing/cenas/3-fluxo-alta-620.webp';
import fluxoA420 from '../assets/landing/cenas/3-fluxo-alta-420.webp';
import fraturaA828 from '../assets/landing/cenas/4-fratura-alta-828.webp';
import fraturaA620 from '../assets/landing/cenas/4-fratura-alta-620.webp';
import fraturaA420 from '../assets/landing/cenas/4-fratura-alta-420.webp';
import marcaA828 from '../assets/landing/cenas/5-marca-alta-828.webp';
import marcaA620 from '../assets/landing/cenas/5-marca-alta-620.webp';
import marcaA420 from '../assets/landing/cenas/5-marca-alta-420.webp';

/**
 * As artes da landing, numa fonte só.
 *
 * ── `[26/09]` DE OITO CENAS PARA CINCO PLACAS — a ideia foi dele ───────────
 *
 * Eram oito artes, uma por seção, e **seis delas desenhavam a interface do
 * produto**: barra lateral, card, contador, o conteúdo daquela feature. Ele
 * viu o problema antes de eu resistir a ele: *"ficar criando artes toda hora
 * não vai dar"*.
 *
 * Os dois custos, medidos:
 *
 * | | antes | agora |
 * | --- | --- | --- |
 * | arquivos | 48 | **30** |
 * | peso no repositório | 4.551 kB | **2.508 kB** (−45%) |
 * | custo de uma seção nova | 2 composições feitas à mão | **zero** |
 *
 * E o custo que não se mede em byte: arte que desenha a interface **envelhece
 * no próximo redesenho**, e a landing passa a mostrar um site que não existe
 * mais. As placas de hoje não desenham tela nenhuma — rocha, cristal, neon,
 * fenda —, então não há o que envelhecer nelas.
 *
 * ── Por que REPETIR placa entre seções não é defeito aqui ──────────────────
 *
 * Quando essa saída foi levantada, eu mesmo anotei o risco: *"as cenas ficam
 * parecidas entre si"*. A resposta é dele, e é de desenho, não de arte:
 * *"essas imagens são apenas uma ambientação... vc vai trabalhar bastante com
 * animações e SVG daqui pra frente"*.
 *
 * O que separa uma seção da outra deixou de ser o fundo e passou a ser a
 * camada por cima — sobreposição, movimento, SVG. Essa camada não pesa em KB
 * de imagem e não envelhece junto com o produto, porque ela **é** o produto.
 *
 * A única regra que o mapa abaixo respeita: **nenhuma placa se repete em
 * seções vizinhas**. Na ordem da página — hero · feed · news · mural · lives ·
 * keys · ranks · cta — sai 1·3·2·4·3·2·4·5. Placa repetida na rolagem seguida
 * é o que faz a página parecer travada.
 *
 * ── De onde os arquivos vêm ────────────────────────────────────────────────
 *
 * De `npm run cenas`, que os deriva das referências em
 * `docs/identidade/referencias/cenas/` e `…/cenas-retrato/`. **Nada aqui é
 * editado à mão** — trocar uma placa é trocar a referência e rodar o gerador.
 */

/** A placa LARGA (16:9), do computador. */
export const LARGURA = 1672;
export const ALTURA = 940;

/**
 * A placa de RETRATO, do celular — `[12/09]`.
 *
 * Ela não é um recorte da larga: é uma **composição própria**. A medição que
 * decidiu isso mostrou que espremer 16:9 numa tela em pé deixava o texto da
 * interface desenhada com 2–3 px. Hoje não há interface desenhada, mas a razão
 * continua valendo para a composição: corte não escolhe enquadramento, só
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

/** As cinco placas, pelo que cada uma É — não pela seção onde ela aparece. */
export const PLACAS = {
  convergencia: par(conv1600, conv1200, conv828, convA828, convA620, convA420),
  campo:        par(campo1600, campo1200, campo828, campoA828, campoA620, campoA420),
  fluxo:        par(fluxo1600, fluxo1200, fluxo828, fluxoA828, fluxoA620, fluxoA420),
  fratura:      par(fratura1600, fratura1200, fratura828, fraturaA828, fraturaA620, fraturaA420),
  marca:        par(marca1600, marca1200, marca828, marcaA828, marcaA620, marcaA420),
};

/**
 * Mapa EXPLÍCITO de seção para placa.
 *
 * Cena que ninguém mapeou devolve `undefined` e estoura na hora, em vez de
 * virar um `<img>` sem `src` — que o navegador desenha como um retângulo
 * vazio, sem erro nenhum (§4). A trava `cenasDaLanding.test.js` confere que
 * toda seção da página tem entrada aqui.
 *
 * O motivo de cada escolha está escrito porque "qual placa vai em qual seção"
 * é a única decisão de gosto deste arquivo — e decisão de gosto sem motivo
 * escrito é a que alguém reverte por engano.
 */
export const CENAS = {
  hero:       PLACAS.convergencia, // tudo converge para um ponto: é o hub
  feed:       PLACAS.fluxo,        // fitas correndo — o que passa
  news:       PLACAS.campo,        // campo denso de fragmentos: muitas fontes
  comunidade: PLACAS.fratura,      // estilhaços grandes e próximos: gente perto
  lives:      PLACAS.fluxo,        // o fluxo, agora ao vivo
  keys:       PLACAS.campo,        // achar a peça no meio do campo
  ranks:      PLACAS.fratura,      // a escalada, em arestas
  cta:        PLACAS.marca,        // a marca fecha
};
