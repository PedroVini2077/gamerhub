import urlDaTrilha from '../assets/som/universe-loop.opus?url';

/**
 * A trilha ambiente da landing: baixar, decodificar e tocar em laço.
 *
 * ── A obra, e o crédito que a licença EXIGE ─────────────────────────────────
 *
 *   "Universe" — AiTechEye · CC BY 4.0 · opengameart.org
 *
 * CC-BY não é domínio público: ela permite usar e adaptar, **desde que o
 * crédito apareça**. Por isso ele está na `/sobre` e não só neste comentário —
 * crédito que só existe no código-fonte não cumpre a licença.
 *
 * ── O arquivo foi ADAPTADO, e a licença permite — mas exige dizer ───────────
 *
 * O original não é um loop, apesar de o autor descrevê-lo assim. Medido:
 *
 *   RMS dos primeiros 10 ms .... 0,2440   (começa cheio)
 *   RMS dos últimos 10 ms ...... 0,0013   (termina em quase silêncio)
 *
 * Tocar aquilo em laço daria, a cada 41 s, uma música morrendo até o silêncio
 * e voltando de repente no volume cheio. Não é estalo — é pior, é a faixa
 * REINICIANDO na cara de quem está lendo a página.
 *
 * O que foi feito: recortada a região entre 1 s (depois do fade-in) e 37 s
 * (antes da cauda), e as pontas costuradas com um crossfade de 3 s em curva de
 * cosseno. O resultado, medido no arquivo final:
 *
 *   RMS início 0,1484  vs  RMS fim 0,1576   (antes: 0,2440 vs 0,0013)
 *   salto na emenda ..... 35 dB abaixo do pico
 *
 * ── Formato e tamanho ──────────────────────────────────────────────────────
 *
 *   original ..... Ogg Vorbis estéreo 195 kbps, 41,1 s, 980 KB
 *   publicado .... Opus estéreo 56 kbps, 36,0 s, **296 KB**
 *
 * Opus porque a 56 kbps ele entrega, neste material e neste volume, o que o
 * Vorbis entregava a 195. Suportado por todo navegador que este site atende.
 *
 * ── O custo que ninguém vê, dito com número ────────────────────────────────
 *
 * `decodeAudioData` guarda PCM descompactado: 36 s × 48 kHz × 2 canais ×
 * 4 bytes = **~13,8 MB de RAM** enquanto o som está ligado. É o preço de um
 * laço sem emenda — a alternativa (`<audio loop>`) transmite e quase não gasta
 * memória, mas o laço dela tem furo audível em vários navegadores.
 *
 * Os 13,8 MB só existem para quem LIGOU o som, e são devolvidos ao desligar e
 * ao sair da landing. Se um dia isso incomodar no celular, o caminho é mono:
 * metade da memória e 240 KB.
 */

/** Onde o laço vira. Menor que o arquivo de propósito — ver abaixo. */
const FIM_DO_LACO_S = 36;

let buffer = null;
let carregando = null;

/**
 * Baixa e decodifica, uma vez só.
 *
 * `carregando` guarda a PROMESSA, e não um booleano: dois cliques rápidos
 * pegam a mesma promessa em vez de dispararem dois downloads do mesmo arquivo.
 *
 * @returns {Promise<AudioBuffer|null>} `null` quando não deu — rede fora,
 *   arquivo inalcançável, navegador sem suporte ao codec. Quem chama cai no
 *   som sintetizado.
 */
export function carregarTrilha(contexto) {
  if (buffer) return Promise.resolve(buffer);
  if (carregando) return carregando;

  carregando = fetch(urlDaTrilha)
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
    // `decodeAudioData` com callback E promessa: o Safari antigo só tem a
    // forma com callback, e ela é a que funciona nos dois.
    .then(dados => new Promise((resolve, reject) => {
      contexto.decodeAudioData(dados, resolve, reject);
    }))
    .then((decodificado) => { buffer = decodificado; return buffer; })
    .catch(() => {
      // Deixa `carregando` nulo para uma tentativa futura poder acontecer —
      // rede que caiu uma vez pode voltar.
      carregando = null;
      return null;
    });

  return carregando;
}

/**
 * Cria a fonte em laço, já conectada ao destino dado.
 *
 * `loopEnd` explícito e não "o fim do buffer": o Opus escreve alguns
 * milissegundos de preenchimento no fim, e deixar o laço virar lá colocaria
 * silêncio dentro da volta — o furo que este arquivo inteiro existe para
 * evitar. Conferido: o arquivo decodifica em 36,000 s exatos, então o corte
 * cai exatamente onde o crossfade foi costurado.
 */
export function criarFonteEmLaco(contexto, destino, bufferDecodificado) {
  const fonte = contexto.createBufferSource();
  fonte.buffer = bufferDecodificado;
  fonte.loop = true;
  fonte.loopStart = 0;
  fonte.loopEnd = Math.min(FIM_DO_LACO_S, bufferDecodificado.duration);
  fonte.connect(destino);
  fonte.start();
  return fonte;
}

/** Só para o teste: esquece o que já foi baixado. */
export function esquecerTrilha() {
  buffer = null;
  carregando = null;
}
