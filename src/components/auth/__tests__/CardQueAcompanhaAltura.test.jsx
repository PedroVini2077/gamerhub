/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';

import CardQueAcompanhaAltura from '../CardQueAcompanhaAltura';

/**
 * Trava do card que acompanha a altura na troca de aba.
 *
 * ── O que pode quebrar em SILÊNCIO aqui ─────────────────────────────────────
 *
 * Duas coisas, e nenhuma delas aparece na tela como erro:
 *
 * 1. **O `ResizeObserver` deixar de ser desconectado.** Um observador vivo depois
 *    de o componente sair segura o nó e roda para sempre. Vazamento não estoura,
 *    não loga e não quebra teste nenhum — é exatamente a família de falha muda
 *    que o §1.5 cataloga, e o §6.1 manda procurar em toda montagem/desmontagem.
 * 2. **A altura nunca ser aplicada.** Se a medição parar de chegar ao elemento,
 *    o card volta a saltar de tamanho — que é o defeito que o dono relatou
 *    (*"simplesmente corta de um pro outro"*) — e a tela continua funcionando.
 *    Ninguém descobre sem olhar.
 *
 * O terceiro caso coberto é o ambiente **sem** `ResizeObserver`: ali o certo é
 * degradar para altura automática, nunca cair.
 */

/** Um `ResizeObserver` de mentira que me deixa disparar a medição na mão. */
function instalarObservadorFalso() {
  const estado = { instancias: [], desconectados: 0 };
  class Falso {
    constructor(callback) {
      this.callback = callback;
      estado.instancias.push(this);
    }
    observe(alvo) { this.alvo = alvo; }
    disconnect() { estado.desconectados += 1; }
    /** Simula o navegador reportando uma altura nova. */
    reportar(altura) { this.callback([{ contentRect: { height: altura } }]); }
  }
  const anterior = globalThis.ResizeObserver;
  globalThis.ResizeObserver = Falso;
  return { estado, restaurar: () => { globalThis.ResizeObserver = anterior; } };
}

afterEach(cleanup);

describe('o card que acompanha a altura na troca de conteúdo', () => {
  it('desconecta o ResizeObserver ao sair — senão é vazamento mudo', () => {
    const { estado, restaurar } = instalarObservadorFalso();
    try {
      const { unmount } = render(
        <CardQueAcompanhaAltura chave="login">conteúdo</CardQueAcompanhaAltura>,
      );
      expect(estado.instancias.length,
        'o componente nem chegou a observar nada — a medição não existe, e a\n'
        + '  altura vai ficar em `auto` para sempre.').toBe(1);

      unmount();
      expect(estado.desconectados,
        'o ResizeObserver ficou vivo depois do desmonte.\n'
        + '  O `useEffect` precisa devolver `() => observador.disconnect()`.\n'
        + '  Observador órfão segura o nó e continua rodando — não estoura,\n'
        + '  não loga, e ninguém descobre (§1.5).').toBe(1);
    } finally {
      restaurar();
    }
  });

  it('aplica em PIXEL a altura medida — é o que impede o card de saltar', async () => {
    const { estado, restaurar } = instalarObservadorFalso();
    try {
      render(
        <CardQueAcompanhaAltura chave="login">
          <p>formulário</p>
        </CardQueAcompanhaAltura>,
      );
      const animado = screen.getByText('formulário').closest('div').parentElement;

      act(() => { estado.instancias[0].reportar(354); });

      // `waitFor` e não asserção direta: a altura chega ANIMADA (280 ms), então
      // o valor final só existe quando a animação termina. Exigir o valor no
      // mesmo instante testaria a ausência da animação — o contrário do que
      // este componente existe para fazer.
      await waitFor(() => {
        expect(animado.style.height,
          'a altura medida não chegou ao elemento animado.\n'
          + '  Sem ela o card volta a saltar de 354 para 877 px de um quadro para\n'
          + '  o outro, que é o defeito relatado pelo dono em 04/09.').toBe('354px');
      });
    } finally {
      restaurar();
    }
  });

  it('sem ResizeObserver no ambiente, degrada para altura automática e NÃO cai', () => {
    const anterior = globalThis.ResizeObserver;
    delete globalThis.ResizeObserver;
    try {
      render(<CardQueAcompanhaAltura chave="login">sem observador</CardQueAcompanhaAltura>);
      expect(screen.getByText('sem observador'),
        'o componente quebrou sem `ResizeObserver`. O enfeite pode faltar; o\n'
        + '  formulário, não.').toBeTruthy();
    } finally {
      globalThis.ResizeObserver = anterior;
    }
  });
});
