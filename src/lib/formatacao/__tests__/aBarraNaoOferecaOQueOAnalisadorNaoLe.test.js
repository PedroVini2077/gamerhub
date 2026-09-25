import { describe, it, expect } from 'vitest';
import { CORES, TAMANHOS, RECURSOS_COMPLETOS, envolverCor, envolverTamanho, MARCACOES } from '../vocabulario';
import { analisarFormatacao, temFormatacao } from '../analisar';

/**
 * `[25/09]` A BARRA NÃO PODE OFERECER O QUE O ANALISADOR NÃO SABE LER.
 *
 * ── A falha que esta trava cobre, e ela é MUDA ────────────────────────────
 *
 * A barra de ferramentas e o analisador são duas listas que precisam
 * concordar: uma escreve marcação, a outra a reconhece. Hoje elas moram perto
 * (`vocabulario.js` e `analisar.js`) e por isso parecem uma coisa só — mas são
 * duas, e duas listas divergem (§4, fonte única).
 *
 * O dia em que alguém somar um recurso à barra sem ensinar o analisador,
 * **nada estoura**: o botão funciona, escreve os marcadores no campo, e o
 * resultado aparece como lixo cru na tela de quem lê o post. Nenhum erro,
 * nenhum log, nenhum teste vermelho — o §1.5 na letra.
 *
 * ── Por que ela nasceu agora ──────────────────────────────────────────────
 *
 * A prévia AO VIVO passou a depender de `temFormatacao()`. Se essa função
 * deixar de ser derivada da árvore e virar uma lista própria de marcadores —
 * que é o atalho óbvio para quem for mexer nela —, a divergência ganha uma
 * TERCEIRA lista para desalinhar, e o sintoma fica ainda mais sutil: tudo
 * funciona, só a prévia não aparece.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . recurso 'brilho' somado a RECURSOS_COMPLETOS sem regra no analisador
 *        -> falhou nomeando o recurso que a barra oferece e ninguém lê
 *   . temFormatacao trocada por /\*\*|~~|\[cor=/.test(texto)
 *        -> falhou na lista e na citação, que não têm marcador de trecho
 */

/** O que a barra de fato escreve no campo, para cada recurso que ela oferece. */
const O_QUE_A_BARRA_ESCREVE = {
  negrito: () => `${MARCACOES.negrito.abre}x${MARCACOES.negrito.fecha}`,
  italico: () => `${MARCACOES.italico.abre}x${MARCACOES.italico.fecha}`,
  sublinhado: () => `${MARCACOES.sublinhado.abre}x${MARCACOES.sublinhado.fecha}`,
  tachado: () => `${MARCACOES.tachado.abre}x${MARCACOES.tachado.fecha}`,
  cor: () => { const { abre, fecha } = envolverCor(Object.keys(CORES)[0]); return `${abre}x${fecha}`; },
  tamanho: () => { const { abre, fecha } = envolverTamanho(Object.keys(TAMANHOS)[0]); return `${abre}x${fecha}`; },
  lista: () => '- x',
  citacao: () => '> x',
  link: () => '[x](https://exemplo.com)',
};

describe('a barra de ferramentas e o analisador concordam', () => {
  it('todo recurso oferecido tem exemplo aqui — senão a trava não o cobre', () => {
    const semExemplo = RECURSOS_COMPLETOS.filter((r) => !O_QUE_A_BARRA_ESCREVE[r]);
    expect(semExemplo, [
      `Recurso novo na barra sem exemplo nesta trava: ${semExemplo.join(', ')}.`,
      'Acrescente em O_QUE_A_BARRA_ESCREVE o que o botão escreve no campo.',
      'Sem isso a trava passa a aprovar um recurso que ela nunca conferiu.',
    ].join('\n')).toEqual([]);
  });

  it.each(RECURSOS_COMPLETOS)('o analisador entende o que o botão "%s" escreve', (recurso) => {
    const escrito = O_QUE_A_BARRA_ESCREVE[recurso]();
    const blocos = analisarFormatacao(escrito);

    expect(temFormatacao(blocos), [
      `A barra oferece "${recurso}" e o analisador NÃO o reconhece.`,
      `Ela escreveria ${JSON.stringify(escrito)} no campo, e isso viraria texto cru`,
      'na tela de quem lê o post — sem erro, sem log, sem nada (§1.5).',
      'Ou ensine o analisador (src/lib/formatacao/analisar.js, TRECHOS),',
      `ou tire "${recurso}" de RECURSOS_COMPLETOS.`,
    ].join('\n')).toBe(true);
  });

  it('texto sem marcação nenhuma NÃO liga a prévia', () => {
    // Se ligasse, a prévia seria o mesmo texto duas vezes na tela — a poluição
    // que o dono reclamou, pelo outro lado.
    for (const puro of ['oi', 'duas\nlinhas', 'um - hifen no meio', 'conta 2 * 3 * 4']) {
      expect(temFormatacao(analisarFormatacao(puro)), `"${puro}" nao tem formatacao`).toBe(false);
    }
    expect(temFormatacao(analisarFormatacao(''))).toBe(false);
  });

  /**
   * `[25/09]` ACHADO POR ESTA TRAVA, no primeiro run: `conta 2 * 3 * 4` vinha
   * como formatado, porque ` 3 ` casava como itálico. Na tela a conta que a
   * pessoa escreveu perderia os asteriscos e o 3 sairia inclinado.
   *
   * Não é caso de canto num site de gamers — "5 * 2 de dano", "3 * 100 de XP"
   * e larguras `1920 * 1080` são escrita normal.
   *
   * A causa: o par só pode marcar quando ENCOSTA no texto. É a regra do
   * CommonMark, e ela valia para os quatro pares — corrigida na classe (§1.3),
   * não só no `*` que apareceu.
   */
  it.each([
    ['conta 2 * 3 * 4', 'italico'],
    ['a ** b ** c', 'negrito'],
    ['a __ b __ c', 'sublinhado'],
    ['a ~~ b ~~ c', 'tachado'],
    ['3 * 100 de XP', 'italico'],
    ['tela 1920 * 1080 * 2', 'italico'],
  ])('marcador solto no meio do espaço NÃO formata: %s', (texto) => {
    const blocos = analisarFormatacao(texto);
    expect(temFormatacao(blocos), [
      `${JSON.stringify(texto)} foi lido como se tivesse formatação.`,
      'Um par de marcadores só marca quando ENCOSTA no texto — `* x *` não é',
      'itálico, é uma conta. Sem isso o site come os asteriscos de quem escreve',
      'multiplicação, e o texto aparece diferente do que a pessoa digitou.',
      'Ver os lookarounds (?!\\s) / (?<!\\s) em TRECHOS, analisar.js.',
    ].join('\n')).toBe(false);

    // E o texto tem de sair INTEIRO, com os asteriscos que ela digitou.
    const [bloco] = blocos;
    expect(bloco.filhos.map((n) => n.valor).join('')).toBe(texto);
  });

  it('mas o par COLADO no texto continua formatando', () => {
    for (const bom of ['**forte**', '*inclinado*', '__sublinhado__', '~~riscado~~', 'a **b** c']) {
      expect(temFormatacao(analisarFormatacao(bom)), `"${bom}" deveria formatar`).toBe(true);
    }
  });

  it('cor e tamanho não têm nome em comum', () => {
    // Hoje o analisador os distingue pelo MARCADOR (`[cor=` × `[tamanho=`), e
    // por isso um nome repetido não quebraria nada AGORA. Fica travado porque
    // qualquer sintaxe mais curta — a primeira ideia de quem for enxugar o
    // marcador — passaria a resolver o nome por busca, e aí o repetido some
    // num dos dois mapas em silêncio.
    const repetidos = Object.keys(CORES).filter((n) => Object.hasOwn(TAMANHOS, n));
    expect(repetidos, `Nome em CORES e em TAMANHOS ao mesmo tempo: ${repetidos.join(', ')}`).toEqual([]);
  });
});
