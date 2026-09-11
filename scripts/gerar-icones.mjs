// Gera favicon e ícones do PWA a partir da FONTE ÚNICA do caminho da marca.
//
// `[11/09]` Existe para que nenhum ícone seja uma cópia à mão. Todos saem de
// `src/lib/marca.js`, que por sua vez foi derivado da arte do dono por medição
// (`scripts/tracar-marca.mjs`). Trocar a marca é trocar a arte e rodar de novo —
// nunca editar um PNG.
//
// Por que três formatos, e cada um por um motivo MEDIDO:
//
//   favicon ......... SVG. Nítido em qualquer densidade e pesa 1,9 kB.
//   manifesto ....... WebP. O corpo novo do ícone é um gradiente suave, e PNG
//                     comprime gradiente muito mal: o de 512 dava **274 kB**.
//                     Medido no mesmo desenho: WebP a 0,92 dá **13 kB** — 21×
//                     menos, sem diferença visível num ícone. (Posterizar o PNG
//                     para 5 bits chegava a 93 kB e ainda perdia banding.)
//   apple-touch ..... PNG, e é EXCEÇÃO obrigatória: o iOS não aceita WebP em
//                     `<link rel="apple-touch-icon">`. Ele tem 180 px, então o
//                     custo do formato pior é pequeno.
//
// Uso:  node scripts/gerar-icones.mjs

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../src/lib/marca.js';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** O fundo dos ícones de app. Igual ao `theme-color` do site. */
const FUNDO = '#060608';

/**
 * `[11/09]` O CORPO do ícone — e por que ele deixou de ser um quadrado chapado.
 *
 * Pedido do dono, com print da tela de início: *"a do pwa tem que ser bonitinho
 * poxa"*. Renderizei os ícones nos tamanhos de uso, sobre cinco papéis de
 * parede, e o defeito ficou visível em vez de opinável:
 *
 *   sobre papel de parede PRETO ... o quadrado `#060608` FUNDE com o fundo. Não
 *                                   sobra ícone: sobra a marca flutuando, sem
 *                                   corpo, como adesivo recortado
 *   sobre papel de parede claro .... o quadrado aparece, mas chapado e sem vida
 *
 * As três camadas abaixo resolvem isso sem inventar identidade nova — todas
 * saem de cores que a marca já tem:
 *
 *   1. um gradiente vertical sutil no corpo (nasce um pouco mais claro no alto),
 *      que dá volume e impede a fusão com o preto;
 *   2. um BRILHO por trás da marca, verde de um lado e roxo do outro, na direção
 *      do próprio gradiente dela — é a assinatura do site;
 *   3. uma borda interna de 1 px em branco quase transparente, que **desenha a
 *      silhueta** do ícone mesmo quando o papel de parede é preto puro.
 *
 * Nada disso toca no desenho da marca: ela continua vindo inteira de
 * `src/lib/marca.js`, e trocar a arte continua sendo trocar a arte e rodar de
 * novo (§4, fonte única).
 */
const TOPO_DO_CORPO = '#12131a';

/**
 * O que gerar. `margem` é a folga em torno da marca, em fração do lado.
 *
 * `[11/09]` As margens diminuíram, e é medição e não gosto: no print a marca
 * ocupava pouco do quadrado e o ícone lia como "logo perdida numa caixa". E o
 * `maskable` era o pior caso — com margem de 0,28 o recorte circular do Android
 * deixava um anel preto enorme em volta de uma marca pequena.
 *
 * O `apple-touch` continua com a maior margem das três: o iOS aplica a máscara
 * DELE por cima, e o que encostar na borda é cortado.
 */
const ALVOS = [
  { arquivo: 'public/icone-192.webp', lado: 192, margem: 0.13, raio: 22 },
  { arquivo: 'public/icone-512.webp', lado: 512, margem: 0.13, raio: 22 },
  // `[11/09]` `raio: 0` nos dois de baixo, e isso é conserto de um defeito real,
  // não preferência. iOS e Android aplicam a máscara DELES por cima do arquivo.
  // Com cantos já arredondados aqui, o canto é cortado DUAS vezes: sobra um fio
  // transparente na quina, que o sistema pinta de preto. Quadrado cheio é o que
  // as duas plataformas pedem — quem desenha a forma é o aparelho.
  { arquivo: 'public/apple-touch-icon.png', lado: 180, margem: 0.17, raio: 0 },
  // Maskable: o Android corta um círculo de ~80% do lado, então a marca precisa
  // caber DENTRO desse círculo — mas não tão dentro que sobre anel vazio.
  { arquivo: 'public/icone-maskable-512.webp', lado: 512, margem: 0.22, raio: 0 },
  // `[11/09]` O cartão de compartilhamento (`og:image`). Ele faltava, e o buraco
  // era visível: link do site colado no WhatsApp ou no Discord aparecia **sem
  // imagem nenhuma**, só com título e descrição.
  //
  // Sem texto de propósito: a fonte de display do site não existe aqui dentro, e
  // desenhar o nome numa fonte de sistema entregaria uma marca que o site não
  // usa. O título e a descrição já viajam nas metatags ao lado da imagem — o
  // trabalho do cartão é ser reconhecível, e disso a marca dá conta.
  //
  // **JPEG e não WebP, e a escolha foi pesquisada.** WebP hoje é aceito pelo
  // WhatsApp e pelo Twitter, mas o rastreador do Facebook ainda falha em
  // parte dos casos — e a falha é MUDA: o link simplesmente aparece sem
  // imagem, como aparecia antes de este arquivo existir. Trocar um formato
  // moderno por um que sempre funciona é a conta certa aqui, porque quem baixa
  // este arquivo é o servidor da rede social, uma vez, e não o visitante a
  // cada visita — o argumento de peso que decidiu os ícones não vale para ele.
  {
    arquivo: 'public/cartao-1200x630.jpg',
    largura: 1200, altura: 630, margem: 0.26, raio: 0,
  },
];

/**
 * O SVG da marca, com ou sem corpo. Usado pelo favicon e pelos PNGs.
 *
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.corpo] Desenhar o fundo do ícone de app. Sem ele sai
 *   só a marca em fundo transparente, que é o que o favicon usa.
 */
export function svgDaMarca({
  corpo = false, margem = 0, lado = 100, raio = 22, largura = null, altura = null,
} = {}) {
  // `[11/09]` Caixa RETANGULAR opcional, para o cartão de compartilhamento
  // (1200×630). A marca continua quadrada e centrada: esticá-la para preencher
  // um retângulo deformaria o monograma, que é o oposto de ter uma marca.
  const cx = largura ?? lado;
  const cy = altura ?? lado;
  const menor = Math.min(cx, cy);
  const escala = ((1 - margem * 2) * menor) / 100;
  const deslocamentoX = (cx - 100 * escala) / 2;
  const deslocamentoY = (cy - 100 * escala) / 2;
  const paradas = PARADAS_DO_GRADIENTE.map(({ pos, cor }) =>
    `<stop offset="${pos}%" stop-color="${cor}"/>`).join('');

  // As duas pontas do gradiente da marca — é de onde o brilho tira a cor, para
  // não existir uma segunda paleta escondida no gerador.
  const verde = PARADAS_DO_GRADIENTE[0].cor;
  const roxo = PARADAS_DO_GRADIENTE[PARADAS_DO_GRADIENTE.length - 1].cor;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cx} ${cy}" width="${cx}" height="${cy}">`
    + `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">${paradas}</linearGradient>`
    + `<linearGradient id="corpo" x1="0%" y1="0%" x2="0%" y2="100%">`
    + `<stop offset="0%" stop-color="${TOPO_DO_CORPO}"/>`
    + `<stop offset="100%" stop-color="${FUNDO}"/></linearGradient>`
    + `<radialGradient id="brilhoVerde" cx="28%" cy="42%" r="46%">`
    + `<stop offset="0%" stop-color="${verde}" stop-opacity="0.30"/>`
    + `<stop offset="100%" stop-color="${verde}" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="brilhoRoxo" cx="74%" cy="60%" r="46%">`
    + `<stop offset="0%" stop-color="${roxo}" stop-opacity="0.26"/>`
    + `<stop offset="100%" stop-color="${roxo}" stop-opacity="0"/></radialGradient>`
    + `</defs>`
    + (corpo
      ? `<rect width="${cx}" height="${cy}" rx="${raio}" fill="url(#corpo)"/>`
        + `<rect width="${cx}" height="${cy}" rx="${raio}" fill="url(#brilhoVerde)"/>`
        + `<rect width="${cx}" height="${cy}" rx="${raio}" fill="url(#brilhoRoxo)"/>`
        // A silhueta. `stroke` fica MEIO dentro e meio fora do caminho, então o
        // retângulo é encolhido em meia espessura — senão metade da borda sai
        // do viewBox e o ícone fica com um fio cortado nos quatro lados.
        + `<rect x="0.6" y="0.6" width="${cx - 1.2}" height="${cy - 1.2}"`
        + ` rx="${Math.max(raio - 0.6, 0)}"`
        + ` fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="1.2"/>`
      : '')
    + `<g transform="translate(${deslocamentoX} ${deslocamentoY}) scale(${escala})">`
    + `<path d="${CAMINHO_DA_MARCA}" fill="url(#g)" fill-rule="evenodd"/></g></svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync('public', { recursive: true });

  // `[11/09]` O favicon GANHOU CORPO, e o motivo é medição.
  //
  // Ele era a marca em fundo transparente, "para respeitar a aba clara ou
  // escura". Renderizado a 16 px — que é o tamanho em que ele realmente vive —
  // isso vira um borrão: as contraformas do GH ficam com menos de 1 px e o
  // desenho some no fundo da aba, seja ela clara ou escura.
  //
  // Com o corpo escuro, a 16 px ele deixa de ser um borrão e passa a ser uma
  // FICHA reconhecível: uma pastilha escura com um brilho verde-roxo dentro.
  // Não se lê "GH" nesse tamanho — ninguém lê monograma a 16 px —, mas se
  // reconhece o site, que é a única função do favicon.
  //
  // E ele passa a ser o MESMO objeto do ícone do app, que é o que o dono pediu:
  // *"já temos uma marca, agora é usar em todo lugar"*.
  writeFileSync('public/favicon.svg', svgDaMarca({ corpo: true, margem: 0.13 }));

  const nav = await chromium.launch({ executablePath: CHROMIUM });
  const pagina = await (await nav.newContext()).newPage();

  for (const alvo of ALVOS) {
    const largura = alvo.largura ?? alvo.lado;
    const altura = alvo.altura ?? alvo.lado;
    const svg = svgDaMarca({
      corpo: true, margem: alvo.margem, raio: alvo.raio, largura, altura,
    });
    const formato = alvo.arquivo.endsWith('.webp') ? 'image/webp'
      : alvo.arquivo.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const b64 = await pagina.evaluate(async ({ svg, largura, altura, formato }) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      await img.decode();
      const c = document.createElement('canvas');
      c.width = largura; c.height = altura;
      c.getContext('2d').drawImage(img, 0, 0, largura, altura);
      // 0,92 e não 0,8: num ÍCONE o artefato aparece na borda da marca, que é
      // justamente onde o olho vai. A diferença entre os dois é de 4 kB.
      // O PNG ignora o segundo argumento, então ele pode ir sempre.
      return c.toDataURL(formato, 0.92).split(',')[1];
    }, { svg, largura, altura, formato });
    const dados = Buffer.from(b64, 'base64');
    writeFileSync(alvo.arquivo, dados);
    console.log(`  ${alvo.arquivo.padEnd(34)} ${`${largura}x${altura}`.padStart(9)}`
      + `  ${String(Math.round(dados.length / 1024)).padStart(4)} kB`);
  }

  await nav.close();
  console.log('\n  favicon.svg + 3 WebP + 1 PNG + 1 JPEG gerados da fonte unica.\n');
}
