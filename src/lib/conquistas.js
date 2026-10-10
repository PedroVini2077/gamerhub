import { CONQUISTAS } from './conquistas/lista';

/**
 * A AVALIAÇÃO das conquistas — a lista em si mora em `conquistas/lista.js`.
 *
 * ── Por que o corte é aqui, e não por tamanho ───────────────────────────────
 *
 * `[10/10]` O arquivo chegou a 294 linhas ao receber a decisão de evento ×
 * estado — abaixo do teto de 300, e perto o bastante para o §4 mandar dividir
 * **antes** de criar dívida, e não depois de passar.
 *
 * O corte separa **dado de regra**: a lista é um catálogo que cresce a cada
 * conquista nova, e a avaliação é uma função que não cresce junto. São as duas
 * coisas que mudam por motivos diferentes.
 *
 * `CONQUISTAS` é **reexportada** aqui de propósito: este arquivo continua sendo
 * a porta única (`lib/conquistas`), então quem já importava não mudou nada, e
 * ninguém precisa saber que existe uma pasta. A alternativa — cada consumidor
 * importando de `conquistas/lista` — espalharia o caminho interno por aí e
 * tornaria o próximo corte uma mudança em N arquivos.
 */
export { CONQUISTAS };

/**
 * Avalia a lista inteira.
 *
 * `desbloqueadas` é opcional, e passá-lo como `null` devolve exatamente o que
 * esta função devolvia antes de a tabela existir — é esse o caminho enquanto o
 * registro não chega, que é o primeiro instante de toda visita.
 *
 * Com ele em mãos, ele faz DUAS coisas, e a segunda mudou em 10/10:
 *
 *   1. a DATA (`em`), só quando ela é verdadeira — ver abaixo;
 *   2. sustenta `concluida` nas conquistas de EVENTO (`permanente: true`),
 *      mesmo que a contagem de agora tenha caído. A medição derivada continua
 *      sendo a única fonte do PROGRESSO (a barra e o "7 / 10").
 *
 * @param {object|null} xp             o que a `get_user_xp` devolveu
 * @param {object|null} perfil         a linha de `profiles`
 * @param {object|null} desbloqueadas  `{ [id]: { desbloqueada_em, retroativa } }`
 * @returns {Array|null}               `null` enquanto faltar dado — nunca uma
 *                                     lista de zeros, que seria mentira
 */
export function avaliarConquistas(xp, perfil, desbloqueadas = null) {
  if (!xp || typeof xp.posts !== 'number') return null;

  return CONQUISTAS.map((c) => {
    const valor = Math.max(0, c.medir({ xp, perfil }) ?? 0);
    const registro = desbloqueadas?.[c.id] ?? null;

    // Conquista sem `permanente` declarado ESTOURA, e não assume um lado.
    // Qualquer padrão aqui seria chute sobre o significado dela: `true` faria
    // um estado mentir, `false` faria um evento mentir — e nos dois casos em
    // silêncio, que é o fallback que o §4 proíbe. Isto é o par em runtime da
    // checagem que o `conquistaNaoDerivaDoBanco` faz em teste.
    if (typeof c.permanente !== 'boolean') {
      throw new Error(
        `A conquista "${c.id}" não declara \`permanente\`. Responda: ela é um `
        + 'EVENTO (aconteceu, e apagar o conteúdo depois não desfaz) ou um '
        + 'ESTADO (afirma algo sobre o perfil AGORA)? Ver o cabeçalho da lista '
        + 'em lib/conquistas.js.',
      );
    }

    // O registro só sustenta "concluída" numa conquista de EVENTO — e a de
    // backfill (`retroativa`) vale aqui de propósito: ela não tem data, mas é
    // prova de que a condição já estava cumprida.
    const registrada = c.permanente && registro !== null;

    return {
      ...c,
      valor: Math.min(valor, c.meta),
      concluida: valor >= c.meta || registrada,
      // Percentual já pronto: a barra não deve fazer conta, e assim as duas
      // (barra e texto) nunca discordam.
      progresso: Math.min(100, Math.round((valor / c.meta) * 100)),
      // `null` tem TRÊS causas aqui, e a tela precisa tratar as três igual:
      // o registro ainda não chegou, não existe, ou é retroativo (a condição
      // já estava cumprida antes de haver registro, então a data é do backfill
      // e não do feito). Em nenhuma delas se mostra data — mostrar a do
      // backfill seria afirmar uma história que ninguém observou (§1.1).
      em: registro && !registro.retroativa ? registro.desbloqueada_em : null,
    };
  });
}

/** Quantas de quantas — o resumo do cabeçalho do card. */
export function contarConcluidas(avaliadas) {
  if (!avaliadas) return null;
  return { feitas: avaliadas.filter((c) => c.concluida).length, total: avaliadas.length };
}
