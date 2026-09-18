import { describe, it, expect } from 'vitest';

import { sobrasAntigas, IDADE_DE_SOBRA_MS, PREFIXOS_DE_TESTE } from '../publicarPost.mjs';

/**
 * O detector de posts de teste esquecidos — e o alarme falso que ele criou.
 *
 * ── As duas falhas, em dois dias, e são opostas ─────────────────────────────
 *
 * `[10/09]` O detector só conhecia `/\[e2e /`. Um post do teste de PAINEL ficou
 * visível no site com o detector ligado e verde — varredura de caso, não de
 * classe (§1.3).
 *
 * `[11/09]` Consertado para ver os dois prefixos, ele reprovou o PR seguinte —
 * porque os jobs `fluxos autenticados` e `painel de admin` rodam **em paralelo**
 * contra o mesmo banco, e o `fluxos` chamou de sobra o post que o outro job
 * estava usando naquele segundo. Alarme que grita à toa (§0.2, 4ª regra).
 *
 * O que resolve as duas ao mesmo tempo é a IDADE: continua enxergando todo
 * prefixo, e só acusa o que já devia ter sido apagado. Estas travas existem
 * para que nenhuma das duas volte sozinha.
 */
describe('sobras de teste no feed', () => {
  const agora = 1_789_000_000_000;
  const velho = agora - IDADE_DE_SOBRA_MS - 1000;
  const recente = agora - 5000;

  it('acusa sobra antiga de QUALQUER prefixo', () => {
    const titulos = PREFIXOS_DE_TESTE.map((p) => `${p}${velho}] post`);
    expect(
      sobrasAntigas(titulos, agora),
      'Um prefixo de PREFIXOS_DE_TESTE deixou de ser detectado. Foi assim que '
      + 'um post do painel ficou no ar desde 10/09 com o detector verde.',
    ).toHaveLength(PREFIXOS_DE_TESTE.length);
  });

  it('NAO acusa o post de um job que está rodando agora', () => {
    expect(
      sobrasAntigas([`[painel ${recente}] post do teste`], agora),
      'O post de um job concorrente foi chamado de sobra. Os jobs `fluxos` e '
      + '`painel` rodam em paralelo contra o mesmo banco — foi exatamente este '
      + 'alarme falso que reprovou o PR #181.',
    ).toEqual([]);
  });

  // `[18/09]` A regressão que uma revisão externa pediu, e ela é específica de
  // propósito: o caso que quebrou NÃO era "prefixo novo não detectado" — era
  // "prefixo novo detectado, relógio ILEGÍVEL".
  //
  // O `sobrasAntigas` faz duas leituras: `REGEX_DE_SOBRA` (é marca de teste?) e
  // o relógio de dentro dela (de que rodada?). As duas nasciam de listas
  // separadas, e o `[e2e-live ` entrou só na primeira. Efeito: a live de teste
  // passava no primeiro filtro, falhava na leitura do relógio e caía no
  // `return true` — chamada de sobra com UM SEGUNDO de vida.
  //
  // O teste de cima ("acusa sobra antiga de QUALQUER prefixo") não pegava isso,
  // porque ele só usa marcas VELHAS, e velha é sobra pelos dois caminhos. É
  // preciso um caso RECENTE por prefixo para separar os dois.
  it.each(PREFIXOS_DE_TESTE)('lê o relógio do prefixo %s, e não chuta', (prefixo) => {
    expect(
      sobrasAntigas([`${prefixo}${recente}] acabou de nascer`], agora),
      `O relógio de "${prefixo}" deixou de ser lido, então TODA marca deste\n`
      + 'prefixo virou "sobra" — inclusive a do job que está rodando agora.\n\n'
      + 'Causa provável: alguém escreveu um segundo regex à mão em vez de\n'
      + 'derivar de PREFIXOS_DE_TESTE. Já aconteceu duas vezes: na primeira o\n'
      + 'detector não via `[painel `, na segunda não lia o relógio de\n'
      + '`[e2e-live `. Os dois regex saem de ALTERNATIVA_DE_PREFIXOS — mantenha\n'
      + 'assim.',
    ).toEqual([]);
  });

  it('post de usuário de verdade nunca é tocado', () => {
    expect(sobrasAntigas(['Melhor build de Elden Ring', '[naoehteste 1] x'], agora)).toEqual([]);
  });

  it('marca sem relógio conta como sobra, em vez de ser engolida', () => {
    // `marcaDeTeste` SEMPRE põe o número. Um `[e2e ` sem ele veio de outro
    // lugar, e escolher "provavelmente é recente" por ele seria o fallback
    // silencioso do §4.
    expect(sobrasAntigas(['[e2e sem relogio] post'], agora)).toHaveLength(1);
  });
});
