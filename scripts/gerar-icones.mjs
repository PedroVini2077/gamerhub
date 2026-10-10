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
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../src/lib/marca.js';

const CHROMIUM = process.env.CHROMIUM_BIN ?? '/opt/pw-browsers/chromium';

/**
 * `[12/09]` A arte de abertura, para o CARTÃO de compartilhamento.
 *
 * Decisão do dono, com estas palavras: *"pode colocar ela no cartão de
 * compartilhamento"*. Ela é a mesma arte do ATO 0 da landing — quem clica no
 * link vê exatamente o que a prévia prometeu, e é isso que um cartão precisa
 * fazer.
 *
 * A fonte é a REFERÊNCIA, não a versão gerada em `src/assets/`: aquelas já
 * passaram por uma compressão a 0,80 para a web, e recomprimir imagem
 * comprimida empilha artefato. Aqui parte-se do original, uma vez só.
 */
// `[26/09]` Era `1-hero.webp`, que deixou de existir quando as oito cenas por
// feature viraram cinco placas de ambiente. A placa da entrada agora é a
// convergência — mesmo papel, nome novo. Sem esta linha atualizada,
// `npm run icones` falharia só na próxima vez que alguém o rodasse.
const ARTE_DO_CARTAO = 'docs/identidade/referencias/cenas/1-convergencia.webp';

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
 *   3. uma borda interna no GRADIENTE DA MARCA, que **desenha a silhueta** do
 *      ícone mesmo quando o papel de parede é preto puro.
 *
 * `[12/09]` **A borda existia e não aparecia** — ela era `1.2` num `viewBox` de
 * 512, ou seja 0,23% do lado, a 10% de branco. Na tela de início isso é 0,3
 * pixel, que é o mesmo defeito de unidade dos traços de 0,18 px da landing. Ele
 * relatou o sintoma: *"o app tá com a logo e o fundo preto, faltou uma borda"*.
 * Agora a espessura é fração do lado (1/96) e a cor é a da marca.
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
  //
  // **`[12/09]` Ele deixou de ser a marca sozinha e passou a ser A ARTE.** O
  // comentário acima continua valendo no que decidiu o formato; o que mudou é o
  // conteúdo. A marca num fundo escuro identificava o site e não dizia nada
  // sobre ele — e cartão é a única coisa que muita gente vê antes de clicar.
  //
  // A marca continua no cartão, pequena, no canto: assinatura, não assunto. O
  // centro é da arte, que já traz o monograma desenhado dentro dela.
  {
    arquivo: 'public/cartao-1200x630.jpg',
    largura: 1200, altura: 630, margem: 0.26, raio: 0, arte: ARTE_DO_CARTAO,
  },
];

// ── `[10/10]` Os construtores de SVG saíram para `gerar-icones/svg.mjs` ────
//
// Corte de 313 linhas (§4). Aqui ficou a decisão de quais alvos gerar e a
// escrita em disco; lá ficou a montagem do SVG. O `svgDaMarca` é reexportado
// porque a trava `cenasDaLanding` e o `index.html` dependem dele.
import { svgDoCartao, svgDaMarca } from './gerar-icones/svg.mjs';

export { svgDaMarca };


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
    const svg = alvo.arte
      ? svgDoCartao({
        largura,
        altura,
        arteBase64: readFileSync(alvo.arte).toString('base64'),
        // As medidas da arte de referência. Escritas aqui e conferidas pela
        // trava: se a fonte mudar de proporção, o recorte silenciosamente
        // passaria a cortar o assunto em vez das bordas.
        larguraDaArte: 1672,
        alturaDaArte: 940,
      })
      : svgDaMarca({
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
