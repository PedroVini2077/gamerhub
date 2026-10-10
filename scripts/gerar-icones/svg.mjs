import { CAMINHO_DA_MARCA, PARADAS_DO_GRADIENTE } from '../../src/lib/marca.js';

/**
 * Os construtores de SVG — o cartão social e a marca.
 *
 * `[10/10]` Separados de `gerar-icones.mjs` no corte de 313 linhas (teto 300,
 * §4). O corte é por responsabilidade: aqui se MONTA o SVG; lá se decide quais
 * alvos gerar e se escreve em disco.
 *
 * O `d` da marca e as paradas do gradiente continuam vindo de
 * `src/lib/marca.js` — fonte única, porque três cópias de um `d` de 487
 * caracteres é a divergência esperando acontecer.
 */
/**
 * O cartão de compartilhamento: a arte recortada em 1200×630, escurecida no pé,
 * com a marca assinando o canto.
 *
 * ── O recorte, e por que ele não é opcional ─────────────────────────────────
 *
 * A arte é 1672×940 (16:9 = 1,778) e o cartão é 1,905. Esticar para preencher
 * deformaria a cena; deixar sobra criaria duas tarjas pretas que o WhatsApp
 * mostra como se fossem parte da imagem. Então é COBRIR: escala pela maior
 * razão e corta o que passar — 22 px em cima e 22 embaixo, longe do assunto.
 */
function svgDoCartao({ largura, altura, arteBase64, larguraDaArte, alturaDaArte }) {
  const escala = Math.max(largura / larguraDaArte, altura / alturaDaArte);
  const l = larguraDaArte * escala;
  const a = alturaDaArte * escala;
  const x = (largura - l) / 2;
  const y = (altura - a) / 2;

  // A marca no canto: 11% da altura do cartão. Grande o bastante para ser
  // reconhecida na prévia pequena do WhatsApp, pequena o bastante para não
  // brigar com o monograma que já está desenhado no meio da arte.
  const ladoDaMarca = altura * 0.11;
  const folga = altura * 0.055;
  const paradas = PARADAS_DO_GRADIENTE.map(({ pos, cor }) =>
    `<stop offset="${pos}%" stop-color="${cor}"/>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`
    + ` viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}">`
    + `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">${paradas}</linearGradient>`
    // Véu só no pé: ele existe para a marca do canto ter contraste, não para
    // apagar a arte. Um véu uniforme deixaria o cartão cinza — o oposto do
    // motivo de trocar a marca chapada pela arte.
    + `<linearGradient id="veu" x1="0%" y1="100%" x2="0%" y2="0%">`
    + `<stop offset="0%" stop-color="${FUNDO}" stop-opacity="0.88"/>`
    + `<stop offset="34%" stop-color="${FUNDO}" stop-opacity="0.28"/>`
    + `<stop offset="70%" stop-color="${FUNDO}" stop-opacity="0"/></linearGradient></defs>`
    + `<rect width="${largura}" height="${altura}" fill="${FUNDO}"/>`
    + `<image x="${x}" y="${y}" width="${l}" height="${a}"`
    + ` xlink:href="data:image/webp;base64,${arteBase64}"/>`
    + `<rect width="${largura}" height="${altura}" fill="url(#veu)"/>`
    + `<g transform="translate(${folga} ${altura - folga - ladoDaMarca})`
    + ` scale(${ladoDaMarca / 100})">`
    + `<path d="${CAMINHO_DA_MARCA}" fill="url(#g)" fill-rule="evenodd"/></g></svg>`;
}

/**
 * O SVG da marca, com ou sem corpo. Usado pelo favicon e pelos PNGs.
 *
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.corpo] Desenhar o fundo do ícone de app. Sem ele sai
 *   só a marca em fundo transparente, que é o que o favicon usa.
 */
/**
 * `[12/09]` A BORDA do corpo foi REMOVIDA, a pedido do dono.
 *
 * Havia aqui um `<rect>` de contorno com o gradiente da marca, e um `recuo`
 * para ele sobreviver à máscara do Android. Ele mandou tirar: *"pode tirar a
 * borda tbm do aplicativo PWA, percebi que esse gradiante que vc fez, e essas
 * luzes elas já fazem o trabalho de dar as 'bordas' do app, sem precisar de uma
 * borda física"*.
 *
 * Ele está certo sobre o mecanismo: o corpo é um gradiente do topo (mais claro)
 * para o fundo (preto) com dois halos radiais por cima, e é isso que separa o
 * ícone do papel de parede. A borda somava um segundo desenho para o mesmo
 * trabalho.
 *
 * **O que NÃO se perde junto, porque é lição de unidade e não de gosto:** num
 * `viewBox` que vale o TAMANHO do arquivo (192, 512, 1200), número constante
 * significa proporções diferentes em cada saída — `stroke-width="1.2"` era
 * 0,23% do lado no de 512, ou 0,3 pixel na tela. Se algum dia voltar a existir
 * traço aqui, a espessura tem que ser fração do lado (`cx / 96`), e o que for
 * desenhado perto da borda do `maskable` é cortado pelo launcher, que só
 * garante o círculo central de 80%.
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
      : '')
    + `<g transform="translate(${deslocamentoX} ${deslocamentoY}) scale(${escala})">`
    + `<path d="${CAMINHO_DA_MARCA}" fill="url(#g)" fill-rule="evenodd"/></g></svg>`;
}
