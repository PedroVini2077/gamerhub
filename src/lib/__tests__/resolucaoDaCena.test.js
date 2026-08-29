import { describe, it, expect } from 'vitest';
import {
  proximoDegrau, degrauInicial, quedaDeEmergencia, DEGRAUS_DE_RESOLUCAO,
} from '../resolucaoDaCena';

/**
 * Trava da resolução da cena 3D.
 *
 * ── O que ela impede, e é o oposto do que a versão anterior travava ─────────
 *
 * A primeira versão começava em `dpr` 0,5 e SUBIA. Ela tinha teste, passava, e
 * estava errada — o dono viu em dois aparelhos: *"a cena em 3d ela começa muito
 * pixelada, fica horrível, depois volta ao normal"*, e o brilho do raio, que é
 * o efeito mais bonito da cena, era o que mais sofria.
 *
 * O teste antigo cobria a mecânica (sobe? desce? oscila?) e não a pergunta que
 * importava: **qual é a primeira coisa que o visitante vê?** Era o pior estado
 * possível. Nenhuma medição pegaria isso — o Lighthouse até gostava.
 *
 * Por isso a trava principal aqui não é sobre subir ou descer: é sobre o
 * PRIMEIRO QUADRO já sair no melhor que o aparelho pede.
 */

describe('degrauInicial — o primeiro quadro sai no melhor que dá', () => {
  it('tela comum (dpr 1) começa em 1', () => {
    expect(DEGRAUS_DE_RESOLUCAO[degrauInicial(1)]).toBe(1);
  });

  it('tela de alta densidade começa em 1,5, não acima', () => {
    // O teto de 1,5 é o mesmo do antigo `dpr={[1, 1.5]}`: acima disso o ganho é
    // imperceptível e o custo é por pixel — num celular com dpr 3 seriam 4×
    // mais pixels para desenhar exatamente a mesma coisa.
    expect(DEGRAUS_DE_RESOLUCAO[degrauInicial(3)]).toBe(1.5);
    expect(DEGRAUS_DE_RESOLUCAO[degrauInicial(2)]).toBe(1.5);
  });

  it('NUNCA começa num degrau borrado', () => {
    for (const dpr of [0.5, 1, 1.25, 2, 3, 4]) {
      expect(
        DEGRAUS_DE_RESOLUCAO[degrauInicial(dpr)],
        'A cena voltou a começar abaixo de 1. Foi exatamente isso que o dono viu\n'
        + 'e reprovou: o primeiro quadro que o visitante recebe é o pior estado\n'
        + 'possível, e o brilho do raio some junto. Otimizar o TBT do laboratório\n'
        + 'contra a primeira impressão de quem abre o site é a troca errada.',
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('valor ausente ou zero não quebra a conta', () => {
    expect(DEGRAUS_DE_RESOLUCAO[degrauInicial(0)]).toBe(1);
    expect(DEGRAUS_DE_RESOLUCAO[degrauInicial(undefined)]).toBe(1);
  });
});

describe('proximoDegrau — só desce, e só quando precisa', () => {
  const TOPO = DEGRAUS_DE_RESOLUCAO.length - 1;

  it('desce quando os quadros atrasam', () => {
    expect(
      proximoDegrau({ degrau: TOPO, mediana: 60 }),
      'Quadros de 60 ms não rebaixaram a resolução. É este caminho que protege\n'
      + 'o aparelho fraco — sem ele voltam os 8.066 ms de thread bloqueada.',
    ).toBe(TOPO - 1);
  });

  it('NÃO sobe, mesmo com folga de sobra', () => {
    expect(
      proximoDegrau({ degrau: 1, mediana: 5 }),
      'A cena voltou a subir de resolução. Começando no melhor estado, subir não\n'
      + 'tem para onde ir — e permitir isso faz a cena oscilar entre dois níveis\n'
      + 'numa máquina no limiar, que incomoda mais do que resolução estável.',
    ).toBe(1);
  });

  it('não desce abaixo do piso', () => {
    expect(proximoDegrau({ degrau: 0, mediana: 999 })).toBe(0);
  });

  it('engasgo isolado não rebaixa: o limite é folgado', () => {
    // 24 ms ainda é ~40 fps. Rebaixar aí puniria uma máquina que está bem por
    // causa de outra aba, do próprio carregamento ou de uma coleta de lixo.
    expect(proximoDegrau({ degrau: TOPO, mediana: 24 })).toBe(TOPO);
  });
});

describe('quedaDeEmergencia — um quadro absurdo não espera a amostra', () => {
  // O número que obrigou isto: o CI mediu 1.938 ms de bloqueio numa janela de
  // 2.000 ms. A conta fecha — ~190 ms por quadro no runner × 10 quadros de
  // amostragem = a janela inteira. Esperar a amostra custava DOIS SEGUNDOS de
  // tela travada num aparelho fraco, que é pior do que a pixelação que a
  // mudança veio corrigir: a tela congela em vez de ficar feia.
  it('quadro acima de 100 ms derruba na hora', () => {
    expect(quedaDeEmergencia(190)).toBe(true);
    expect(quedaDeEmergencia(101)).toBe(true);
  });

  it('quadro apenas lento NÃO derruba sozinho — isso é da amostra', () => {
    expect(
      quedaDeEmergencia(40),
      'Um quadro de 40 ms passou a derrubar a resolução sozinho. Aparelho\n'
      + 'normal engasga assim durante o próprio carregamento, e rebaixar por\n'
      + 'causa de um quadro isolado pune quem estava bem.',
    ).toBe(false);
    expect(quedaDeEmergencia(16.7)).toBe(false);
  });

  it('o limite é folgado o bastante para não confundir com 30 fps', () => {
    // 33 ms é 30 fps — ruim, mas não é "não consigo desenhar isto".
    expect(quedaDeEmergencia(33)).toBe(false);
  });
});
