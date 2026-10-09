import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * O arquivo SEM comentário.
 *
 * `[09/10]` Nasceu de um falso negativo meu: a 1ª versão procurava
 * `TextoFormatado` no arquivo inteiro, e o comentário que EXPLICA a mudança
 * contém o nome. Reinjetando o bug real — o mural voltando ao `<p>` cru — ela
 * passou, porque a prosa a segurava. É a terceira vez nesta sessão que uma
 * checagem lê a própria explicação (`devoConvidar`, `padraoDeBusca`, esta).
 */
function semComentarios(caminho) {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/^\s*\/\/[^\n]*/gm, ' ');
}

/**
 * `[09/10]` TEXTO ESCRITO POR GENTE NÃO VAI CRU PARA A TELA.
 *
 * ── O caso, e ele era o ÚLTIMO ───────────────────────────────────────────
 *
 * Post, comentário e News já passavam pelo `TextoFormatado` desde 25/09. O
 * **mural** continuava com `<p>{item.message}</p>`: quem escrevesse `**oi**`
 * ali via os dois asteriscos na tela.
 *
 * Não quebrava nada. Não tinha erro, não tinha log, e o texto aparecia — só
 * aparecia errado, e só para quem usou marcação. É a classe de defeito que
 * sobrevive porque cada tela é olhada sozinha.
 *
 * ── Por que a lista é FECHADA e nomeada ──────────────────────────────────
 *
 * "Todo lugar que mostra texto de usuário" não é varrível sem falso positivo:
 * nome, apelido, rótulo e título curto são texto de gente e **não** devem ser
 * formatados. Então a trava nomeia as quatro superfícies de CORPO — as que
 * recebem o que a pessoa escreveu para ser lido — e exige o componente em
 * cada uma.
 *
 * Superfície nova não é pega por isto, e isso está dito: o que a trava impede
 * é uma das quatro **voltar** ao texto cru, que é o que aconteceu com o mural
 * por duas semanas sem ninguém notar.
 *
 * ── E o `separador`, que é decisão de TOM ────────────────────────────────
 *
 * `---` vira régua horizontal. No post e no artigo isso é seção; no
 * comentário e no mural é uma linha atravessando um recado de duas frases,
 * sugerindo uma estrutura que ele não tem. Os dois passam `separador={false}`,
 * e a trava guarda isso — é o tipo de detalhe que some num refactor e só
 * reaparece numa tela feia.
 */

/**
 * As superfícies de CORPO — o que a pessoa escreveu PARA SER LIDO.
 *
 * `[09/10]` Eram quatro na 1ª versão desta lista, e o `CartaoDeNoticia`
 * estava nela por suposição minha. Ele **recusa** o `TextoFormatado` de
 * propósito, e explica no próprio arquivo: o `resumo` é texto puro escrito
 * pela equipe, não conteúdo com marcação, e passá-lo pelo analisador faria um
 * asterisco no meio de uma frase virar itálico sem ninguém pedir.
 *
 * Eu descobri isso porque a trava reprovou — ou seja, ela achou um erro MEU
 * antes de achar um do código. Fica como exceção escrita abaixo, não como
 * linha apagada em silêncio.
 */
const SUPERFICIES = [
  { arquivo: 'src/components/feed/PostCard.jsx', separadorFalso: false, nome: 'o post' },
  { arquivo: 'src/components/feed/CommentCard.jsx', separadorFalso: true, nome: 'o comentário' },
  { arquivo: 'src/components/community/MuralCard.jsx', separadorFalso: true, nome: 'o mural' },
  { arquivo: 'src/pages/NewsArtigo.jsx', separadorFalso: false, nome: 'o corpo do artigo' },
];

/** Quem mostra texto de gente e NÃO deve formatar, com o motivo. */
const FORA = [
  {
    arquivo: 'src/components/news/CartaoDeNoticia.jsx',
    motivo: 'o `resumo` é texto puro da equipe; formatar faria um asterisco '
      + 'solto virar itálico sem ninguém pedir',
  },
];

describe('texto escrito por gente não vai cru para a tela', () => {
  it('as quatro superfícies de corpo usam o `TextoFormatado`', () => {
    const cruas = SUPERFICIES
      .filter(({ arquivo }) => !/<TextoFormatado/.test(semComentarios(arquivo)))
      .map(({ arquivo, nome }) => `${nome} (${arquivo})`);

    expect(
      cruas,
      'superfície(s) desenhando o texto CRU de novo:\n'
      + cruas.map((c) => `  - ${c}`).join('\n')
      + '\n\nQuem escrever `**oi**` passa a ver os asteriscos. Nada quebra:\n'
      + 'sem erro, sem log, e o texto aparece — só aparece errado, e só para\n'
      + 'quem usou marcação. Foi assim que o mural ficou de fora por duas\n'
      + 'semanas depois de post, comentário e News já estarem formatados.',
    ).toEqual([]);
  });

  it('o recado curto NÃO ganha régua horizontal', () => {
    const erradas = SUPERFICIES
      .filter((s) => s.separadorFalso)
      .filter(({ arquivo }) => !/separador=\{false\}/.test(semComentarios(arquivo)))
      .map(({ nome }) => nome);

    expect(
      erradas,
      `${erradas.join(' e ')} passou a aceitar o separador \`---\`.\n`
      + 'No post e no artigo a régua marca seção. Num recado de duas frases\n'
      + 'ela atravessa a tela sugerindo uma estrutura que o texto não tem.\n'
      + 'É o mesmo corte de `RECURSOS_DE_COMENTARIO`.',
    ).toEqual([]);
  });

  it('a exceção continua sendo exceção, e continua explicada', () => {
    // Lista de exceção é o mecanismo que apodrece sozinho (mesma lição do
    // `advisories-aceitos`). Se o cartão PASSAR a formatar, a entrada aqui
    // vira mentira — e ninguém notaria, porque os dois testes acima
    // continuariam verdes.
    for (const { arquivo, motivo } of FORA) {
      expect(motivo.length, `a exceção de \`${arquivo}\` ficou sem motivo escrito.`)
        .toBeGreaterThan(40);
      expect(
        /<TextoFormatado/.test(semComentarios(arquivo)),
        `\`${arquivo}\` passou a usar o \`TextoFormatado\`, mas continua na\n`
        + 'lista de exceção dizendo que não usa. Mova para `SUPERFICIES` — ou a\n'
        + 'lista passa a descrever um projeto que não existe.',
      ).toBe(false);
    }
  });

  it('a lista não está vazia nem aponta para arquivo que sumiu', () => {
    // Vacuidade de sempre: lista vazia (ou com caminho morto) faz os dois
    // testes acima passarem sem olhar nada.
    expect(SUPERFICIES.length).toBeGreaterThanOrEqual(4);
    for (const { arquivo } of [...SUPERFICIES, ...FORA]) {
      expect(
        () => readFileSync(arquivo, 'utf8'),
        `\`${arquivo}\` não existe mais — a superfície foi renomeada e esta\n`
        + 'trava passou a vigiar o nada, em silêncio.',
      ).not.toThrow();
    }
  });
});
