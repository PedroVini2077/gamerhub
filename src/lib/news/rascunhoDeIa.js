/**
 * `[25/09]` O RASCUNHO DE IA pelo lado que é regra pura.
 *
 * Nada aqui fala com o servidor, e essa é a razão de o arquivo existir: tudo
 * neste módulo é **contrato com a Edge Function** — o mínimo de notas que ela
 * exige e o marcador que ela escreve. A trava que vigia esses dois contratos
 * precisa importá-los sem arrastar o cliente do Supabase junto, que estoura
 * fora do navegador por falta de variável de ambiente.
 *
 * Mesma divisão do resto de `lib/news/`: vocabulário e regra ficam aqui, a
 * conversa com o servidor fica no service.
 */

/**
 * O mínimo de notas para a IA ter do que redigir.
 *
 * **Espelha a checagem da Edge Function**, que é quem de fato recusa — o site
 * usa a `anon key` e qualquer um chama a função direto. Este número existe para
 * a tela poder dizer "faltam N caracteres" antes de gastar a chamada, não para
 * proteger nada. A trava `rascunhoDeIaNaoDeriva.test.js` exige que os dois
 * sejam iguais.
 */
export const MINIMO_DE_NOTAS = 40;

/**
 * O marcador que o modelo escreve no lugar do que as NOTAS não tinham.
 *
 * Ele é um **contrato entre dois lugares**: a instrução do sistema, dentro de
 * `supabase/functions/redigir-materia/index.ts`, manda escrever exatamente
 * `[CONFERIR: o que falta]`; esta expressão é quem os conta na tela. Se um
 * mudar e o outro não, a tela passa a dizer "0 lacunas" sobre um rascunho cheio
 * delas — e "0 lacunas" é a frase que faz o revisor ler com menos atenção.
 *
 * Por isso existe `rascunhoDeIaNaoDeriva.test.js`: ele lê a instrução do
 * servidor e exige que o marcador de lá case aqui.
 *
 * `i` porque o modelo às vezes devolve `[Conferir: …]`, e os dois-pontos são
 * opcionais pelo mesmo motivo — cobertura que casa só a forma exata é a
 * cobertura que não cobre (§1.5, fonte 6).
 */
export const MARCADOR_DE_LACUNA = /\[\s*conferir\s*:?/gi;

/**
 * Quantas lacunas o modelo marcou no rascunho inteiro.
 *
 * Conta em todos os campos porque o marcador pode cair no título tanto quanto
 * no corpo — e um título com lacuna é pior, porque é o que se lê primeiro.
 */
export function lacunasDoRascunho(rascunho) {
  if (!rascunho) return 0;
  const tudo = [rascunho.titulo, rascunho.subtitulo, rascunho.resumo, rascunho.corpo]
    .filter(Boolean).join('\n');
  return (tudo.match(MARCADOR_DE_LACUNA) ?? []).length;
}
