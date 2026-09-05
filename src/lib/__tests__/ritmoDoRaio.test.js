import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrerFontes } from './varrerFontes';
import { criarRitmo, avancar, agendarProximo } from '../ritmoDoRaio';

/**
 * Trava do bug de 01/09: o raio ficava mudo depois de sair da viewport e voltar.
 *
 * A causa é do `@react-three/fiber` e está no fonte dele (`setFrameloop`):
 *
 *     clock.stop(); clock.elapsedTime = 0;
 *     if (frameloop !== 'never') { clock.start(); clock.elapsedTime = 0; }
 *
 * O relógio da cena ZERA a cada mudança de `frameloop` — e ele muda toda vez
 * que a cena sai e volta para a tela. Quem agendava em cima de
 * `clock.elapsedTime` ficava esperando um instante que não chegaria mais.
 *
 * A varredura de classe achou CINCO ocorrências, não uma: os arcos do raio, o
 * flash de trovão, a entrada das formas, a entrada da logo e duas oscilações.
 * As três primeiras faziam coisas SUMIREM da tela.
 */
describe('ritmo por delta', () => {
  it('dispara quando o tempo acumulado alcança o agendado', () => {
    const r = criarRitmo(0.5);
    expect(avancar(r, 0.2)).toBe(false);
    expect(avancar(r, 0.2)).toBe(false);
    expect(avancar(r, 0.2)).toBe(true);
  });

  it('sobrevive a uma pausa longa sem queimar vários disparos de uma vez', () => {
    // Aba em segundo plano: o navegador segura o rAF e o primeiro quadro de
    // volta traz um delta enorme. Sem teto, o raio "estouraria" tudo junto.
    const r = criarRitmo(0.5);
    expect(avancar(r, 30)).toBe(true);
    expect(r.tempo).toBeLessThanOrEqual(1);
  });

  it('agenda o próximo relativo ao PRÓPRIO tempo, não a um relógio externo', () => {
    const r = criarRitmo(0);
    avancar(r, 0.6);
    agendarProximo(r, 1, 2, () => 0.5);   // sorteio fixo: 1.5s
    expect(r.proximo).toBeCloseTo(0.6 + 1.5, 5);
  });
});

/**
 * A trava que realmente impede a volta do bug.
 *
 * O teste acima prova que o helper funciona — mas alguém pode reescrever a cena
 * usando `clock.elapsedTime` de novo e ele continuaria verde. Testar só o
 * helper seria "teste que não consegue falhar", que é um padrão de falha
 * catalogado meu.
 */
describe('nenhum componente da cena depende do relógio que o R3F zera', () => {
  it('varre scene3d/ atrás de clock.elapsedTime em código', () => {
    const dir = 'src/components/landing/scene3d';
    const infratores = [];

    // `varrerFontes` estoura se a pasta sumir — sem isso, renomear `scene3d/`
    // deixaria esta trava verde para sempre sem ler uma linha.
    for (const arquivo of varrerFontes(dir)) {
      readFileSync(arquivo, 'utf8').split('\n').forEach((linha, i) => {
        const semComentario = linha.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        if (semComentario.includes('clock.elapsedTime')) {
          infratores.push(`${arquivo.split('/').pop()}:${i + 1}`);
        }
      });
    }

    expect(infratores, infratores.length === 0 ? '' : (
      `\n  ${infratores.length} uso(s) de clock.elapsedTime na cena 3D:\n`
      + infratores.map(v => `    ${v}`).join('\n')
      + '\n\n  O R3F ZERA esse relógio toda vez que o `frameloop` muda — e ele muda\n'
      + '  a cada vez que a cena sai e volta para a viewport.\n\n'
      + '  Animação de entrada baseada nele REFAZ a entrada (a logo e as formas\n'
      + '  chegaram a SUMIR); agendamento baseado nele fica esperando um\n'
      + '  instante que nunca mais chega (o raio ficava mudo).\n\n'
      + '  Use tempo acumulado a partir do `delta` — `lib/ritmoDoRaio.js` para\n'
      + '  agendamento, ou o `useTempoAcumulado` do SceneObjects para animação.\n'
    )).toEqual([]);
  });
});
