/**
 * `[25/09]` FORMATAÇÃO DE POST — o analisador, que produz uma ÁRVORE.
 *
 * ── A decisão de segurança, e ela é a razão de tudo aqui ──────────────────
 *
 * O pedido é negrito, itálico, tachado, listas, citação e link. O caminho
 * "óbvio" seria uma biblioteca de Markdown gerando HTML e um sanitizador
 * depois. **Não foi esse.**
 *
 * Este módulo devolve uma **árvore de nós** (`{ tipo, ... }`), e quem desenha
 * transforma cada nó num elemento React. Em nenhum ponto existe string de
 * HTML — então `dangerouslySetInnerHTML` não é "evitado com disciplina", ele
 * **não tem onde ser usado**. A classe inteira de XSS por marcação some por
 * construção, não por vigilância.
 *
 * Sanitizar HTML é o desenho oposto: produz-se o perigo e depois tenta-se
 * tirá-lo. Funciona enquanto o sanitizador conhecer todos os truques — e a
 * história de `mXSS` é a história de sanitizadores bons sendo contornados. O
 * projeto hoje tem **zero** `dangerouslySetInnerHTML`; manter esse zero vale
 * mais do que qualquer conveniência.
 *
 * ── Por que escrito à mão, e não uma dependência ──────────────────────────
 *
 * Porque o que se aceita é uma lista fechada e pequena, e porque uma
 * biblioteca de Markdown traz o CommonMark inteiro — HTML embutido, imagens
 * por URL, referências, entidades. Cada um desses é superfície que ninguém
 * pediu. Aqui o que não está escrito **não existe**.
 *
 * ── O que ele NÃO faz, dito com todas as letras ───────────────────────────
 *
 * Não tem título, imagem, tabela, HTML, código em bloco nem aninhamento de
 * lista. Não é Markdown: é um subconjunto com a mesma cara. Texto que use
 * marcação fora da lista fica **como está** — o que o autor escreveu aparece.
 *
 * `[25/09]` Cor e tamanho entraram como `[cor=nome]…[/cor]`, e o NOME vem de
 * um vocabulário fechado (`vocabulario.js`). O analisador nunca vê um valor de
 * CSS — vê um nome, confere se existe, e devolve o nome. Quem traduz para
 * classe é quem desenha.
 *
 * ── O texto guardado continua sendo TEXTO ─────────────────────────────────
 *
 * Nada muda no banco. `posts.content` guarda exatamente o que a pessoa
 * digitou, com os asteriscos. Post antigo sem marcação nenhuma atravessa este
 * analisador e sai igual — por isso a mudança não precisou de migration nem
 * de conversão de dado.
 */

import { analisarTrechos } from './trechos';

/** Um parágrafo em branco separa blocos. Linha isolada continua no mesmo. */
const LINHA_DE_LISTA = /^[-*]\s+(.*)$/;

/**
 * `[08/10]` SEPARADOR DE SEÇÃO — exatamente três hifens, sozinhos na linha.
 *
 * É regra de LINHA, não de trecho, e isso não é detalhe de implementação: pôr
 * `---` entre as marcações de trecho faria `a --- b` virar uma régua no meio da
 * frase. Aqui, só a linha inteira conta — então hífen no meio do texto continua
 * sendo hífen, sem precisar de nenhuma guarda.
 *
 * **Por que EXATAMENTE três.** `--` é travessão digitado à mão e aparece em
 * texto normal; `----` é alguém decorando. Aceitar faixas de tamanho variável
 * transformaria um erro de digitação em elemento visual, que é o oposto de
 * previsível. O `{3}` com âncoras nas duas pontas é o que fecha isso.
 *
 * **Espaço em volta é tolerado** porque espaço à direita é invisível: recusar
 * `--- ` faria a régua sumir sem que ninguém conseguisse ver por quê (§1.5).
 *
 * Não colide com lista: `LINHA_DE_LISTA` exige **espaço** depois do `-`, e
 * `---` não tem. Medido antes de escrever, não deduzido.
 */
const LINHA_SEPARADORA = /^\s*-{3}\s*$/;
const LINHA_DE_CITACAO = /^>\s?(.*)$/;

/**
 * Transforma o texto de um post na árvore que a tela desenha.
 *
 * @param {unknown} texto
 * @returns {Array<{tipo: string}>} blocos: `paragrafo`, `lista` ou `citacao`
 */
export function analisarFormatacao(texto, { separador = true } = {}) {
  if (typeof texto !== 'string' || !texto.trim()) return [];

  const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
  const blocos = [];
  let paragrafo = [];

  const fecharParagrafo = () => {
    if (!paragrafo.length) return;
    blocos.push({ tipo: 'paragrafo', filhos: analisarTrechos(paragrafo.join('\n')) });
    paragrafo = [];
  };

  for (const linha of linhas) {
    // O separador é testado ANTES de tudo: ele encerra o que vier antes, e
    // nenhuma outra regra pode reivindicar a linha.
    if (separador && LINHA_SEPARADORA.test(linha)) {
      fecharParagrafo();
      const anterior = blocos[blocos.length - 1];
      // Separador sem nada antes não separa coisa nenhuma, e dois seguidos são
      // uma régua dupla que ninguém pediu. Os dois casos somem em silêncio DE
      // PROPÓSITO — não há informação do autor a perder, só decoração repetida.
      if (anterior && anterior.tipo !== 'separador') blocos.push({ tipo: 'separador' });
      continue;
    }

    const daLista = LINHA_DE_LISTA.exec(linha);
    const daCitacao = LINHA_DE_CITACAO.exec(linha);

    if (daLista) {
      fecharParagrafo();
      const ultimo = blocos[blocos.length - 1];
      const item = analisarTrechos(daLista[1]);
      // Linhas de lista seguidas viram UMA lista, não uma por linha.
      if (ultimo?.tipo === 'lista') ultimo.itens.push(item);
      else blocos.push({ tipo: 'lista', itens: [item] });
      continue;
    }

    if (daCitacao) {
      fecharParagrafo();
      const ultimo = blocos[blocos.length - 1];
      const linhaCitada = analisarTrechos(daCitacao[1]);
      if (ultimo?.tipo === 'citacao') ultimo.linhas.push(linhaCitada);
      else blocos.push({ tipo: 'citacao', linhas: [linhaCitada] });
      continue;
    }

    if (!linha.trim()) { fecharParagrafo(); continue; }
    paragrafo.push(linha);
  }
  fecharParagrafo();

  // Separador no FIM também não separa nada — mesma regra do começo, aplicada
  // depois porque só aqui se sabe que ele ficou por último.
  if (blocos[blocos.length - 1]?.tipo === 'separador') blocos.pop();

  return blocos;
}

/**
 * `[25/09]` Este texto pede alguma formatação?
 *
 * Existe para a prévia AO VIVO do editor aparecer só quando há o que mostrar.
 * Num texto sem marcação a prévia seria o mesmo texto duas vezes na tela —
 * exatamente a poluição que o dono reclamou, só que do outro lado.
 *
 * É **derivada da árvore**, de propósito, e não uma segunda lista de
 * marcadores: marcação nova passa a contar sozinha aqui. Uma lista à parte
 * divergiria do analisador no primeiro recurso novo (§4, fonte única) — e a
 * falha seria muda: o botão funcionaria e a prévia simplesmente não apareceria.
 *
 * Não precisa descer na árvore: qualquer aninhamento tem um nó não-texto no
 * topo do próprio galho (`**a *b* c**` começa em `negrito`).
 *
 * @param {Array<{tipo: string}>} blocos a saída de `analisarFormatacao`
 */
export function temFormatacao(blocos) {
  return blocos.some((bloco) => (
    bloco.tipo !== 'paragrafo' || bloco.filhos.some((no) => no.tipo !== 'texto')
  ));
}
