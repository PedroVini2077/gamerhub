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

import { corValida, tamanhoValido } from './vocabulario';

/** Um parágrafo em branco separa blocos. Linha isolada continua no mesmo. */
const LINHA_DE_LISTA = /^[-*]\s+(.*)$/;
const LINHA_DE_CITACAO = /^>\s?(.*)$/;

/**
 * Marcações de trecho, em ordem de tentativa.
 *
 * `negrito` antes de `italico` não é detalhe: `**x**` casaria como itálico de
 * `*x*` com asteriscos sobrando se a ordem se invertesse.
 */
const TRECHOS = [
  { tipo: 'negrito', re: /\*\*([^*\n]+)\*\*/ },
  { tipo: 'italico', re: /(?<![*\w])\*([^*\n]+)\*(?!\w)/ },
  { tipo: 'sublinhado', re: /__([^_\n]+)__/ },
  { tipo: 'tachado', re: /~~([^~\n]+)~~/ },
  // `[25/09]` Cor e tamanho. O NOME é capturado, nunca um valor de CSS — e a
  // validade dele é conferida abaixo, contra o vocabulário fechado. Nome
  // desconhecido não vira palpite nem some: volta a ser texto.
  { tipo: 'cor',      re: /\[cor=([a-z]+)\]([\s\S]*?)\[\/cor\]/ },
  { tipo: 'tamanho',  re: /\[tamanho=([a-z]+)\]([\s\S]*?)\[\/tamanho\]/ },
  // Link: só a forma explícita `[texto](url)`. URL solta no meio do texto NÃO
  // vira link — decidir por conta própria o que é endereço em entrada de
  // usuário é como brecha nasce (ver `lib/url.js`).
  { tipo: 'link', re: /\[([^\]\n]+)\]\(([^)\s]+)\)/ },
];

/** Quebra um texto simples nos trechos marcados. Devolve nós de linha. */
function analisarTrechos(texto) {
  if (!texto) return [];

  // Acha a marcação que aparece PRIMEIRO no texto — não a primeira da lista.
  // Sem isso, um itálico no começo seria ignorado por causa de um negrito no
  // fim, e a saída dependeria da ordem das regras em vez da do texto.
  let melhor = null;
  for (const { tipo, re } of TRECHOS) {
    const m = re.exec(texto);
    if (m && (melhor === null || m.index < melhor.m.index)) melhor = { tipo, m };
  }
  if (!melhor) return [{ tipo: 'texto', valor: texto }];

  const { tipo, m } = melhor;
  const antes = texto.slice(0, m.index);
  const depois = texto.slice(m.index + m[0].length);

  let no;
  if (tipo === 'link') {
    no = { tipo: 'link', texto: m[1], url: m[2] };
  } else if (tipo === 'cor' || tipo === 'tamanho') {
    const nome = m[1];
    const conhecido = tipo === 'cor' ? corValida(nome) : tamanhoValido(nome);
    // Nome fora do vocabulário NÃO vira estilo e NÃO some: o trecho inteiro
    // volta a ser texto, com a marcação à mostra. Escolher um valor por conta
    // própria aqui seria o fallback silencioso que o §4 proíbe.
    no = conhecido
      ? { tipo, nome, filhos: analisarTrechos(m[2]) }
      : { tipo: 'texto', valor: m[0] };
  } else {
    // Recursão só no CONTEÚDO da marca: `**a *b* c**` funciona, e a recursão
    // termina porque o conteúdo é sempre menor que a entrada.
    no = { tipo, filhos: analisarTrechos(m[1]) };
  }

  return [
    ...(antes ? analisarTrechos(antes) : []),
    no,
    ...(depois ? analisarTrechos(depois) : []),
  ];
}

/**
 * Transforma o texto de um post na árvore que a tela desenha.
 *
 * @param {unknown} texto
 * @returns {Array<{tipo: string}>} blocos: `paragrafo`, `lista` ou `citacao`
 */
export function analisarFormatacao(texto) {
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

  return blocos;
}
