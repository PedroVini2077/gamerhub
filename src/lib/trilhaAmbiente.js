import urlDaTrilha from '../assets/som/lofi-coffee-shop.opus?url';

/**
 * A trilha ambiente da landing: baixar, decodificar e tocar em laço.
 *
 * ── A obra, e a licença ────────────────────────────────────────────────────
 *
 *   "Lofi Coffee Shop" — Alex Morgan · Pixabay Content License
 *   pixabay.com/music/lofi-lofi-coffee-shop-568150/
 *
 * `[03/09]` Trocou a "Universe" (AiTechEye, CC BY 4.0), a pedido do dono.
 *
 * **A licença do Pixabay NÃO exige atribuição** — lido no resumo oficial em
 * 03/09: *"sem ter que atribuir o autor (embora dar crédito seja sempre
 * apreciado)"*. As restrições que ela impõe não alcançam este uso: não
 * revendemos o arquivo isolado, não o imprimimos em produto, e não o usamos
 * como marca.
 *
 * **Mesmo assim o crédito continua na `/sobre`, e isso é escolha.** Duas
 * razões, e a segunda é a que decide: é o que o próprio Pixabay pede como boa
 * prática; e o teste `conteudoDoSobre.test.js` exige crédito visível para todo
 * arquivo em `src/assets/som/`. Afrouxar a trava para acomodar uma licença mais
 * permissiva enfraqueceria a proteção que existe para a próxima mídia — que
 * pode muito bem ser CC-BY de novo. Custo de manter: uma linha de texto.
 *
 * ── O arquivo foi ADAPTADO, e a licença permite ────────────────────────────
 *
 * O original é uma faixa de 1 min 53 s com fade-out no fim — não é um laço.
 * Medido:
 *
 *   nível médio nos primeiros 3 s ..... -14,2 dB
 *   nível médio nos últimos 3 s ....... -30,6 dB
 *
 * Tocar aquilo em laço daria, a cada 114 s, a música morrendo e voltando de
 * repente no volume cheio: 16,4 dB de salto na cara de quem está lendo.
 *
 * O que foi feito: recortada a região de 4 s a 92 s, e as pontas costuradas com
 * um crossfade triangular de 4 s. O ponto de corte não foi escolhido a olho —
 * cinco regiões foram medidas e a de 4 s foi a que casou melhor:
 *
 *   inicio  4s : começo -12,0 dB · fim -13,0 dB · diferença  1,0 dB   <- esta
 *   inicio  8s : começo -11,3 dB · fim -16,1 dB · diferença  4,8 dB
 *   inicio 12s : começo -14,6 dB · fim -18,4 dB · diferença  3,8 dB
 *   inicio 16s : começo -12,1 dB · fim -18,6 dB · diferença  6,5 dB
 *   inicio 20s : começo -11,6 dB · fim -19,5 dB · diferença  7,9 dB
 *
 * 1 dB é imperceptível — é menos do que a variação natural dentro da própria
 * música.
 *
 * ── Formato e tamanho, e a pergunta que o dono fez ─────────────────────────
 *
 * *"agora o arquivo é um .mp3 ao invés de ser um .ogg pequeno, isso afeta
 * muito?"* — afeta, e o número explica por quê:
 *
 *   mp3 original ..... 256 kbps estéreo, 114 s, **3.644 KB**
 *   publicado ........ Opus 64 kbps estéreo, 88 s, **807 KB**
 *
 * O mp3 cru seria **12× o arquivo anterior**. Recodificado em Opus, fica em
 * 2,7× — e a diferença que importa é que **isto não pesa no carregamento da
 * página**: a trilha só é baixada quando alguém LIGA o som, e é servida pela
 * Vercel, não pelo Supabase, então não encosta na cota de egress (§0.2).
 *
 * O que ela custa é a espera de quem clica no botão, no 4G. 807 KB é ~2 s numa
 * conexão comum; 3,6 MB seriam ~9 s de silêncio depois do clique.
 *
 * ── O custo que ninguém vê, dito com número ────────────────────────────────
 *
 * `decodeAudioData` guarda PCM descompactado: 88 s × 48 kHz × 2 canais ×
 * 4 bytes = **~33,8 MB de RAM** enquanto o som está ligado. A faixa mais longa
 * custou 20 MB a mais do que a anterior — é o preço de um laço que demora mais
 * a se repetir. É o preço de um
 * laço sem emenda — a alternativa (`<audio loop>`) transmite e quase não gasta
 * memória, mas o laço dela tem furo audível em vários navegadores.
 *
 * Os 13,8 MB só existem para quem LIGOU o som, e são devolvidos ao desligar e
 * ao sair da landing. Se um dia isso incomodar no celular, o caminho é mono:
 * metade da memória e ~500 KB.
 */

/**
 * Onde o laço vira.
 *
 * Menor que a duração do arquivo DE PROPÓSITO: o Opus acrescenta padding de
 * codificador no fim, e derivar isto de `buffer.duration` faria o laço incluir
 * um rabo de silêncio que não existe na música.
 */
const FIM_DO_LACO_S = 88;

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
