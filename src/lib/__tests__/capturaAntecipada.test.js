import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { iniciarCapturaAntecipada, LIMITE_DA_FILA } from '../capturaAntecipada';

// Esta é a trava do carregamento sob demanda do Sentry.
//
// Tirar o `@sentry/react` do chunk inicial só é aceitável porque a captura
// antecipada cobre a janela até ele subir — e "cobre" é uma afirmação que
// precisa de prova, não de comentário. Erro perdido nessa janela seria
// invisível por construção: nada estoura, nada loga, ninguém descobre
// (CLAUDE.md §1.5). Se este arquivo passar a falhar, o certo é voltar o Sentry
// para o carregamento síncrono, não afrouxar o teste.
//
// O módulo fala com o `window` global. Como não há DOM nos testes deste
// projeto, o stub abaixo registra os ouvintes e permite disparar eventos à mão.

let ouvintes;

beforeEach(() => {
  ouvintes = new Map();
  globalThis.window = {
    addEventListener: (tipo, fn) => {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo).add(fn);
    },
    removeEventListener: (tipo, fn) => ouvintes.get(tipo)?.delete(fn),
  };
});

afterEach(() => { delete globalThis.window; });

function disparar(tipo, evento) {
  for (const fn of ouvintes.get(tipo) ?? []) fn(evento);
}

describe('captura antecipada de erros (antes de o Sentry carregar)', () => {
  it('guarda a exceção de um erro global', () => {
    const captura = iniciarCapturaAntecipada();
    const falha = new Error('quebrou durante a montagem');

    disparar('error', { error: falha, message: 'quebrou durante a montagem' });

    const guardados = captura.encerrar();
    expect(guardados).toHaveLength(1);
    expect(guardados[0].erro).toBe(falha);
    expect(guardados[0].origem).toBe('window.error');
  });

  it('guarda promessa rejeitada, mesmo quando o motivo não é um Error', () => {
    const captura = iniciarCapturaAntecipada();

    disparar('unhandledrejection', { reason: 'recusado pelo servidor' });

    const guardados = captura.encerrar();
    expect(guardados).toHaveLength(1);
    expect(guardados[0].erro).toBeInstanceOf(Error);
    expect(guardados[0].erro.message).toBe('recusado pelo servidor');
    expect(guardados[0].origem).toBe('unhandledrejection');
  });

  it('ignora falha de recurso (imagem/script que não carregou)', () => {
    const captura = iniciarCapturaAntecipada();

    // Evento `error` de recurso tem o elemento como alvo e nenhuma exceção.
    // Reportar isso como bug do site é ruído — foi a lição da fadiga de alarme.
    disparar('error', { target: { tagName: 'IMG' }, message: '' });

    expect(
      captura.encerrar(),
      'falha ao carregar um recurso não é exceção de JavaScript e não deve virar evento',
    ).toHaveLength(0);
  });

  it('para no teto e conta quantos descartou', () => {
    const captura = iniciarCapturaAntecipada();

    for (let i = 0; i < LIMITE_DA_FILA + 7; i += 1) {
      disparar('error', { error: new Error(`erro ${i}`) });
    }

    expect(
      captura.tamanho(),
      'sem teto, um bug em laço de render enche a memória antes de o Sentry subir',
    ).toBe(LIMITE_DA_FILA);
    expect(captura.descartados()).toBe(7);
    expect(captura.encerrar()).toHaveLength(LIMITE_DA_FILA);
  });

  it('para de capturar depois de encerrada — quem assume é o Sentry', () => {
    const captura = iniciarCapturaAntecipada();
    captura.encerrar();

    disparar('error', { error: new Error('depois do Sentry subir') });

    expect(
      captura.tamanho(),
      'captura ainda ativa depois do encerrar significa evento contado duas vezes',
    ).toBe(0);
  });
});
