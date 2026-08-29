import { describe, it, expect } from 'vitest';
import { proximoDegrau, DEGRAUS_DE_RESOLUCAO } from '../resolucaoDaCena';

/**
 * Trava da resolução adaptativa da cena 3D.
 *
 * ── Por que ela existe, com o número ────────────────────────────────────────
 *
 * Medido em 29/08 num navegador de verdade, janela de 8 s com o Hero na tela:
 * com `dpr` em 1,5 a thread principal ficava **99% ocupada** e cada quadro era
 * uma long task (88 quadros, 88 long tasks, 8.066 ms bloqueados). Baixando o
 * `dpr` para 0,5, o mesmo trecho fez **zero** long tasks.
 *
 * ── O que NENHUM teste de navegador daqui consegue provar ───────────────────
 *
 * Metade do comportamento. Este ambiente rasteriza por software (SwiftShader),
 * então a cena só desce de degrau — a subida, que é o que protege quem TEM
 * GPU de ficar preso na resolução mais baixa, nunca acontece aqui. Testar só o
 * que o ambiente alcança deixaria a metade cara invisível até alguém reclamar
 * que a landing ficou borrada no PC bom.
 *
 * Para ver a trava funcionando: troque `degrau < teto` por
 * `degrau < DEGRAUS.length - 1` em `proximoDegrau` e rode — o teste da
 * oscilação falha nomeando o problema.
 */

const TOPO = DEGRAUS_DE_RESOLUCAO.length - 1;

describe('proximoDegrau — a cena sobe se der, desce se precisar', () => {
  it('começa no degrau mais barato', () => {
    expect(
      DEGRAUS_DE_RESOLUCAO[0],
      'O primeiro degrau deixou de ser o mais barato. A cena passa a pagar a\n'
      + 'conta cheia durante a amostragem, que cai bem no meio do carregamento —\n'
      + 'exatamente a janela que o Lighthouse observa e o visitante sente.',
    ).toBe(Math.min(...DEGRAUS_DE_RESOLUCAO));
  });

  it('SOBE quando os quadros estão folgados (a metade que o CI não vê)', () => {
    const r = proximoDegrau({ degrau: 0, teto: TOPO, mediana: 16.7 });
    expect(
      r.degrau,
      'Máquina segurando 60 fps confortáveis não subiu de resolução.\n'
      + 'Quem tem GPU ficaria preso na resolução mais baixa para sempre — a\n'
      + 'cena borrada num PC que não tem problema nenhum.',
    ).toBe(1);
  });

  it('DESCE quando os quadros atrasam', () => {
    const r = proximoDegrau({ degrau: TOPO, teto: TOPO, mediana: 60 });
    expect(
      r.degrau,
      'Quadros de 60 ms (o que foi medido com dpr 1,5 em rasterização por\n'
      + 'software) não rebaixaram a resolução. É esse caminho que derruba os\n'
      + '8.066 ms de thread principal bloqueada.',
    ).toBe(TOPO - 1);
  });

  it('NÃO volta a subir depois de descer — senão pisca para sempre', () => {
    let e = { degrau: TOPO, teto: TOPO };
    e = proximoDegrau({ ...e, mediana: 60 });
    const depois = proximoDegrau({ ...e, mediana: 10 });
    expect(
      depois.degrau,
      'A resolução voltou a subir depois de ter sido rebaixada.\n'
      + 'Numa máquina no limiar isso vira oscilação permanente entre dois\n'
      + 'degraus, e resolução piscando incomoda mais do que resolução baixa e\n'
      + 'estável. O primeiro rebaixamento é o veredito daquele aparelho.',
    ).toBe(e.degrau);
  });

  it('não desce abaixo do piso nem sobe acima do teto', () => {
    expect(proximoDegrau({ degrau: 0, teto: 0, mediana: 999 }).degrau).toBe(0);
    expect(proximoDegrau({ degrau: TOPO, teto: TOPO, mediana: 1 }).degrau).toBe(TOPO);
  });

  it('a faixa morta entre os dois limites não mexe em nada', () => {
    const r = proximoDegrau({ degrau: 1, teto: TOPO, mediana: 21 });
    expect(r.degrau).toBe(1);
  });
});
