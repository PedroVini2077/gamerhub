/**
 * Um quadro que o `<canvas>` recebeu de fato tem pixels OPACOS.
 *
 * ── Por que isto existe, e é a falha mais perigosa das que já apareceram aqui ─
 *
 * `drawImage` com um vídeo que o navegador não decodificou **não lança**: ele
 * simplesmente não desenha nada. O `<canvas>` nasce totalmente transparente,
 * então o resultado é um JPEG válido, do tamanho certo, e em branco — e ele
 * seguia para a moderação, que devolvia `score 0`. O vídeo era então marcado
 * como **analisado e limpo**, que é pior do que não ter sido analisado: o
 * primeiro caso mente, o segundo pelo menos aparece como pendência.
 *
 * Quadro de vídeo é sempre opaco (alpha 255). Alpha 0 em toda a amostra prova
 * que nada foi desenhado — não é julgamento sobre o conteúdo, é a diferença
 * entre ter pixel e não ter.
 *
 * @param {Uint8ClampedArray|number[]} dados RGBA vindo de `getImageData`
 * @returns {boolean} `true` quando NADA foi desenhado
 */
export function nadaFoiDesenhado(dados) {
  if (!dados?.length) return true;
  for (let i = 3; i < dados.length; i += 4) {
    if (dados[i] !== 0) return false;
  }
  return true;
}
