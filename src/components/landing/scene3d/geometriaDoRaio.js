import * as THREE from 'three';

import {
  CONTORNO, FURO, CENTRO_DO_NUCLEO, LARGURA_DO_FURO,
  CORTE_SUPERIOR, CORTE_INFERIOR,
} from './contornoDaMarca';
import { construirSolido } from './solidoDeCristal';

export { CENTRO_DO_NUCLEO, CORTE_SUPERIOR, CORTE_INFERIOR };

// A geometria do raio — montada a partir do contorno medido.
//
// ── O que mudou em `[10/09]`, e o número que justifica ──────────────────────
//
// A primeira versão foi entregue e o dono disse: *"não está parecido com as
// imagens que te mandei, está totalmente deformado"*. Dois erros, e o segundo
// só apareceu quando eu finalmente **olhei** a peça:
//
// | Erro | O que era | O que é agora |
// | --- | --- | --- |
// | silhueta | contorno simplificado a **16 pontos** — sem entalhe, sem degrau | **81 pontos** medidos (`contornoDaMarca.js`) |
// | volume | extrusão chapada, **436 triângulos** no conjunto | sólido moldado com seção de lâmina (`solidoDeCristal.js`) |
//
// O modelo de referência que ele mandou tem 15.805 triângulos e uma seção de
// lâmina. A conta de 36× de diferença é o que explica o "deformado" melhor do
// que qualquer ajuste de shader teria explicado.
//
// ── Este arquivo só MONTA ───────────────────────────────────────────────────
//
// Os dados moram em `contornoDaMarca.js` e a construção do sólido em
// `solidoDeCristal.js`. Aqui ficam as três peças da cena e o corte que as
// separa — e mais nada, para o arquivo não voltar a acumular papel (§4).

/**
 * Corta um polígono por uma reta horizontal (Sutherland–Hodgman).
 *
 * `acima = true` mantém o que está em `y >= corte`.
 *
 * Meia-reta é região convexa, que é a condição do algoritmo — o polígono de
 * entrada pode ser côncavo, e o do raio é bastante.
 */
function cortarNaHorizontal(poligono, corte, acima) {
  const dentro = (p) => (acima ? p[1] >= corte : p[1] <= corte);
  const cruzar = (a, b) => {
    const t = (corte - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), corte];
  };

  const saida = [];
  for (let i = 0; i < poligono.length; i++) {
    const atual = poligono[i];
    const anterior = poligono[(i + poligono.length - 1) % poligono.length];
    const atualDentro = dentro(atual);
    const anteriorDentro = dentro(anterior);

    if (atualDentro) {
      if (!anteriorDentro) saida.push(cruzar(anterior, atual));
      saida.push(atual);
    } else if (anteriorDentro) {
      saida.push(cruzar(anterior, atual));
    }
  }
  return saida;
}

/** Área com sinal — serve para descartar sobra degenerada do corte. */
function area(poligono) {
  let a = 0;
  for (let i = 0; i < poligono.length; i++) {
    const [x1, y1] = poligono[i];
    const [x2, y2] = poligono[(i + 1) % poligono.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Um furo só entra na metade se sobrar furo de verdade depois do corte.
 *
 * O corte passa **rente** à borda do furo (é ela que define onde a peça se
 * parte), então o resto do outro lado é uma lasca de área quase zero. Extrudar
 * essa lasca produz parede interna com espessura de nada — que aparece como
 * artefato preto piscando na aresta, e não como detalhe.
 */
const AREA_MINIMA_DE_FURO = 1e-3;

function furoUtil(poligono) {
  return poligono.length >= 3 && Math.abs(area(poligono)) > AREA_MINIMA_DE_FURO;
}

/**
 * Espessura e afinamento — os números que dão a seção de LÂMINA.
 *
 * `alcance` é a distância, a partir da borda, em que a peça atinge a espessura
 * cheia. Baixo demais e a peça vira uma placa com a aresta lixada; alto demais
 * e ela vira uma lente, perdendo a face.
 *
 * `afinarLonge` é o que faz as pontas ficarem finas e o miolo cheio, medido a
 * partir do núcleo — a peça é mais densa onde a energia mora.
 */
const LAMINA = {
  espessura: 0.46,
  alcance: 0.12,
  chanfro: 0.014,
  segmentosDeChanfro: 3,
  subdivisoes: 1,
  afinarLonge: { centro: CENTRO_DO_NUCLEO, alcance: 1.45, minimo: 0.26 },
};

/**
 * As duas metades do raio, já com volume.
 *
 * Cada uma mantém o **X e o Y originais**: a posição relativa das duas metades
 * *é* a silhueta. Centralizar cada uma sozinha desmontaria o raio.
 */
export function construirMetades() {
  const superior = cortarNaHorizontal(CONTORNO, CORTE_SUPERIOR, true);
  const inferior = cortarNaHorizontal(CONTORNO, CORTE_INFERIOR, false);

  const furoSuperior = cortarNaHorizontal(FURO, CORTE_SUPERIOR, true);
  const furoInferior = cortarNaHorizontal(FURO, CORTE_INFERIOR, false);

  return {
    superior: construirSolido(superior, furoUtil(furoSuperior) ? [furoSuperior] : [], LAMINA),
    inferior: construirSolido(inferior, furoUtil(furoInferior) ? [furoInferior] : [], LAMINA),
  };
}

/**
 * O núcleo — uma estrutura cristalina, e **não uma esfera brilhante**.
 *
 * Ordem dele: *"o core não deve ser uma esfera genérica. Crie uma pequena
 * estrutura cristalina/energética… camada externa, núcleo interno"*.
 *
 * São **duas** peças concêntricas, e é essa a diferença para a versão anterior:
 *
 * | Peça | O que é | Por que |
 * | --- | --- | --- |
 * | casca | hexágono da largura do furo, com chanfro forte | é a face que o furo emoldura — a mesma família geométrica da peça |
 * | miolo | o mesmo hexágono a 46%, girado 30° | as arestas de um cruzam as faces do outro, e é isso que lê como "gerando energia" em vez de "aceso" |
 *
 * `[10/09]` O raio antigo saía de `max(largura, altura)` do furo — e o furo tem
 * 0,214 de largura por 0,419 de altura, então o núcleo nascia com **o dobro da
 * largura do buraco** e atravessava a peça. Agora sai da LARGURA, que é a
 * dimensão que o aperta.
 */
function hexagono(raio, giro = 0) {
  const pontos = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6 + giro;
    pontos.push([Math.cos(a) * raio, Math.sin(a) * raio]);
  }
  return pontos;
}

export function construirNucleo() {
  const raio = LARGURA_DO_FURO * 0.47;
  const casca = construirSolido(hexagono(raio), [], {
    espessura: raio * 1.5, alcance: raio * 0.75, chanfro: raio * 0.12,
    segmentosDeChanfro: 2, subdivisoes: 1,
  });
  const miolo = construirSolido(hexagono(raio * 0.46, Math.PI / 6), [], {
    espessura: raio * 1.1, alcance: raio * 0.4, chanfro: raio * 0.06,
    segmentosDeChanfro: 1, subdivisoes: 1,
  });
  // `mergeGeometries` mora em `three/addons`, não no namespace — e trazer o
  // addon quebraria o `extend()` seletivo que segura o tamanho deste chunk.
  // Juntar duas malhas não indexadas de um atributo só é uma concatenação.
  const geo = juntar([casca, miolo]);
  casca.dispose(); miolo.dispose();
  geo.computeVertexNormals();
  return geo;
}

/** Junta geometrias não indexadas de mesmo atributo — `three` puro, sem addons. */
function juntar(geometrias) {
  const total = geometrias.reduce((s, g) => s + g.attributes.position.array.length, 0);
  const posicoes = new Float32Array(total);
  let off = 0;
  for (const g of geometrias) {
    posicoes.set(g.attributes.position.array, off);
    off += g.attributes.position.array.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  return geo;
}

/**
 * A família de fragmentos — lascas do PRÓPRIO raio.
 *
 * Ordem dele: *"não reutilize simplesmente BoxGeometry, SphereGeometry,
 * TorusGeometry, IcosahedronGeometry como objetos decorativos genéricos"*.
 *
 * Cada lasca é uma cunha tirada de um trecho do contorno: quatro vértices
 * consecutivos da borda, fechados num ponto puxado para dentro. O resultado
 * herda os ângulos da peça — que é o que faz parecer que se desprendeu dela, e
 * não que veio de outra caixa de ferramentas.
 *
 * `[10/09]` Antes eram trechos de 3 pontos encolhidos 50% em volta do próprio
 * centro, o que produzia lascas quase equiláteras — o dono viu "cápsulas". A
 * cunha tem uma ponta afiada, que é a linguagem do raio.
 */
export function construirLascas() {
  const lascas = [];
  const passo = 11;                          // 81 pontos -> 7 lascas distintas
  for (let i = 0; i < CONTORNO.length - 3; i += passo) {
    const trecho = CONTORNO.slice(i, i + 4);
    if (trecho.length < 4) continue;

    const cx = trecho.reduce((s, p) => s + p[0], 0) / trecho.length;
    const cy = trecho.reduce((s, p) => s + p[1], 0) / trecho.length;
    // A borda fica; a ponta vai para o lado de DENTRO, além do centro. É o que
    // transforma um pedaço de contorno numa cunha.
    const pontos = [
      ...trecho.map(([x, y]) => [x - cx, y - cy]),
      [-cx * 0.55, -cy * 0.55],
    ];
    if (Math.abs(area(pontos)) < 1e-4) continue;
    const orientado = area(pontos) < 0 ? pontos.reverse() : pontos;

    lascas.push(construirSolido(orientado, [], {
      espessura: 0.075, alcance: 0.05, chanfro: 0.008,
      segmentosDeChanfro: 2, subdivisoes: 0,
    }));
  }
  return lascas;
}
