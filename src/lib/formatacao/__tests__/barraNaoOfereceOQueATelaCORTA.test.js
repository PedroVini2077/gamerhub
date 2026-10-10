import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { RECURSOS_DE_COMENTARIO, RECURSOS_COMPLETOS } from '../vocabulario';

/**
 * `[10/10]` A BARRA DE UMA TELA NÃO OFERECE O QUE AQUELA TELA CORTA.
 *
 * ── A trava irmã, e por que esta é diferente ────────────────────────────────
 *
 * `aBarraNaoOferecaOQueOAnalisadorNaoLe` já cobre a pergunta GLOBAL: a barra
 * não pode escrever marcador que o **analisador** não sabe ler. Ela olha o
 * vocabulário contra o parser, e os dois são compartilhados.
 *
 * O que ela **não** vê é o recorte POR TELA. O `TextoFormatado` aceita
 * `separador={false}`, e o mural e o comentário passam exatamente isso — o
 * `---` é ruído numa conversa de duas linhas. Então existe um segundo par que
 * precisa concordar, e ele é local:
 *
 *     o `recursos` que a BARRA daquela tela oferece
 *     × o que o RENDERIZADOR daquela tela aceita
 *
 * ── A morte silenciosa, e ela nasceu agora ──────────────────────────────────
 *
 * Em 10/10 o mural ganhou a barra. Se alguém trocar o `recursos` dele por
 * `RECURSOS_COMPLETOS` — que é o padrão do componente, então basta **omitir** a
 * prop —, a barra passa a oferecer o botão de separador. A pessoa clica,
 * escreve `---`, envia… e o `TextoFormatado` com `separador={false}` o
 * descarta.
 *
 * **Nada estoura.** O build passa, o lint passa, a mensagem é publicada, e o
 * texto aparece sem o separador que ela acabou de inserir. Indistinguível de
 * "o site comeu o que eu escrevi" — e o caminho mais provável para isso não é
 * maldade, é alguém apagar uma prop achando que o padrão serve.
 *
 * ── O que ela NÃO faz, dito antes que alguém confie demais ──────────────────
 *
 * Ela cobre o par `separador` × `separador={false}`, que é o único recorte por
 * tela que existe hoje. Se o `TextoFormatado` ganhar um segundo interruptor
 * (`cor={false}`, digamos), esta trava **não** o vê — e a linha de baixo a faz
 * reprovar nesse dia, para o aviso chegar antes do bug.
 */

/** Os pares tela-por-tela: quem desenha o compositor × quem renderiza. */
const PARES = [
  {
    nome: 'mural da comunidade',
    barra: 'src/components/community/MuralForm.jsx',
    tela: 'src/components/community/MuralCard.jsx',
  },
  {
    nome: 'comentário do feed',
    barra: 'src/components/feed/CommentComposer.jsx',
    tela: 'src/components/feed/CommentCard.jsx',
  },
];

/** Sem os comentários: o cabeçalho de cada arquivo CITA as duas coisas. */
const semProsa = (caminho) => readFileSync(caminho, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
  .replace(/\/\/[^\n]*/g, ' ');

describe('a barra de cada tela não oferece o que aquela tela corta', () => {
  it('o vocabulário tem `separador` no completo e NÃO no de comentário', () => {
    // Vacuidade: se os dois conjuntos ficarem iguais, as checagens abaixo
    // passam sem distinguir nada — e a pergunta inteira deixa de existir.
    expect(
      RECURSOS_COMPLETOS.includes('separador'),
      '`separador` saiu de `RECURSOS_COMPLETOS`. Esta trava compara os dois\n'
      + 'conjuntos para saber o que é "poder a mais"; sem a diferença, ela não\n'
      + 'tem o que comparar.',
    ).toBe(true);

    expect(
      RECURSOS_DE_COMENTARIO.includes('separador'),
      '`separador` ENTROU em `RECURSOS_DE_COMENTARIO`.\n\n'
      + 'As duas telas que usam esse conjunto renderizam com `separador={false}`:\n'
      + 'o botão passaria a inserir `---` e o renderizador o descartaria, sem\n'
      + 'erro e sem log. Se a decisão mudou, o `separador={false}` das telas tem\n'
      + 'de sair no MESMO PR.',
    ).toBe(false);
  });

  it.each(PARES)('$nome: a tela corta o separador, então a barra não o oferece', ({ barra, tela }) => {
    const codigoDaTela = semProsa(tela);
    const codigoDaBarra = semProsa(barra);

    // 1. A tela realmente corta? Se deixar de cortar, esta checagem não se
    //    aplica mais — e dizer isso em voz alta é melhor do que passar calada.
    const corta = /separador=\{false\}/.test(codigoDaTela);
    expect(
      corta,
      `${tela} deixou de passar \`separador={false}\`.\n\n`
      + 'Isso não é necessariamente erro — pode ser decisão de passar a aceitar\n'
      + 'o separador nesta tela. Mas aí a barra correspondente tem de ganhar o\n'
      + 'recurso junto, e esta trava precisa ser atualizada para o par novo.\n'
      + 'Parar aqui é deliberado: o par deixou de ser o que a trava afirma.',
    ).toBe(true);

    // 2. A barra usa o conjunto reduzido, e não o padrão do componente.
    //    `RECURSOS_COMPLETOS` é o padrão, então OMITIR a prop é o jeito mais
    //    fácil de abrir o buraco — e o que menos parece uma mudança.
    expect(
      /recursos=\{RECURSOS_DE_COMENTARIO\}/.test(codigoDaBarra),
      `${barra} não passa \`recursos={RECURSOS_DE_COMENTARIO}\` ao editor.\n\n`
      + 'O padrão do `EditorDeTexto` é `RECURSOS_COMPLETOS`, que inclui o\n'
      + 'separador — então basta OMITIR a prop para a barra passar a oferecer um\n'
      + `botão cujo marcador ${tela} descarta.\n\n`
      + 'A pessoa clica, escreve `---`, envia, e o texto aparece sem ele. Nada\n'
      + 'estoura: parece que o site comeu o que ela escreveu.',
    ).toBe(true);
  });

  it('o `EditorDeTexto` continua tendo o completo como PADRÃO', () => {
    // É por isso que a checagem acima pergunta pela presença da prop em vez da
    // ausência do recurso: o risco mora no padrão silencioso, não num valor
    // escrito errado.
    expect(
      /recursos = RECURSOS_COMPLETOS/.test(readFileSync('src/components/ui/EditorDeTexto.jsx', 'utf8')),
      'o padrão de `recursos` no `EditorDeTexto` mudou.\n\n'
      + 'Se ele passou a ser o conjunto reduzido, a checagem acima perdeu o\n'
      + 'motivo de existir na forma que tem — ela exige a prop ESCRITA porque\n'
      + 'omiti-la hoje dá poder a mais. Reavalie as duas juntas.',
    ).toBe(true);
  });
});
