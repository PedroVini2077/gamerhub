/**
 * Tamanho real, em pixels, de cada print da landing.
 *
 * ── Por que isto existe ─────────────────────────────────────────────────────
 *
 * Sem `width`/`height` no `<img>`, o navegador não sabe quanto espaço reservar
 * e o conteúdo abaixo pula quando a imagem chega. As imagens são `loading
 * ="lazy"` e ficam abaixo da dobra, então esse pulo acontece durante a ROLAGEM
 * do usuário — e é justamente o que o CLS de 0,007 do Lighthouse não pega, já
 * que ele mede a janela inicial e não rola a página.
 *
 * ── Por que isto não vira mentira ───────────────────────────────────────────
 *
 * Número escrito à mão ao lado de um arquivo binário é fonte de verdade
 * duplicada, e duplicata diverge (CLAUDE.md §4): bastaria alguém trocar um
 * print por outro de proporção diferente e esquecer daqui. Por isso existe
 * `__tests__/dimensoesDosPrints.test.js`, que abre os JPEGs de verdade, lê o
 * cabeçalho e falha se algum número aqui não bater.
 */
export const DIMENSOES_DOS_PRINTS = {
  feed:  { largura: 760, altura: 394 },
  mural: { largura: 760, altura: 422 },
  lives: { largura: 760, altura: 253 },
  keys:  { largura: 760, altura: 296 },
  ranks: { largura: 760, altura: 366 },
};
