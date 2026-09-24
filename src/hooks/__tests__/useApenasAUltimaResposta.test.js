/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApenasAUltimaResposta } from '../useApenasAUltimaResposta';

/**
 * `[24/09]` O guard de corrida, testado sozinho — e no hook DE VERDADE.
 *
 * A prova de ponta a ponta dele é o
 * `src/components/feed/__tests__/comentarioNaoSomeDepoisDeAparecer.test.jsx`,
 * que reproduz o bug real numa tela. Este cobre o mecanismo em si, para que
 * uma mudança no hook falhe APONTANDO O HOOK em vez de derrubar a tela.
 *
 * ── Por que `renderHook` e não uma reimplementação ────────────────────────
 *
 * A primeira versão deste arquivo recriava o corpo do hook com um React de
 * mentira. Passava — e passaria também com o hook REAL quebrado, porque não
 * chegava a executá-lo. Teste que não toca no alvo é decoração, não trava
 * (§2), e eu escrevi um no arquivo que existe para impedir esse tipo de coisa.
 *
 * ── Provado reinjetando ───────────────────────────────────────────────────
 *
 *   . `return () => true` no lugar da comparação -> falhou no pedido VELHO
 *   . contador que não incrementa (`pedido.current`) -> falhou no mesmo lugar
 */
describe('useApenasAUltimaResposta', () => {
  it('o pedido mais NOVO continua valendo, e o velho não', () => {
    const { result } = renderHook(() => useApenasAUltimaResposta());
    const novoPedido = result.current;

    const primeiro = novoPedido();
    const segundo = novoPedido();

    expect(segundo(), 'o último pedido é o que vale').toBe(true);
    expect(primeiro(), [
      'O pedido VELHO se declarou válido depois de outro ter sido feito.',
      '',
      'É exatamente a corrida que o hook existe para matar: a resposta antiga',
      'chegaria por último e sobrescreveria a nova — que foi o comentário',
      'sumindo da tela em 24/09.',
    ].join('\n')).toBe(false);
  });

  it('um pedido sozinho vale — o guard não bloqueia o caso normal', () => {
    const { result } = renderHook(() => useApenasAUltimaResposta());
    const unico = result.current();

    expect(unico(), [
      'O guard invalidou um pedido que não tinha concorrente.',
      '',
      'Isso faria TODA busca ser descartada e a tela nunca carregar — e o',
      'sintoma seria uma lista eternamente vazia, sem erro nenhum.',
    ].join('\n')).toBe(true);
  });

  it('vale para quantos pedidos vierem, não só dois', () => {
    const { result } = renderHook(() => useApenasAUltimaResposta());
    const novoPedido = result.current;
    const guards = [novoPedido(), novoPedido(), novoPedido(), novoPedido()];

    expect(guards.map(g => g())).toEqual([false, false, false, true]);
  });

  it('a identidade da função é ESTÁVEL entre renders', () => {
    const { result, rerender } = renderHook(() => useApenasAUltimaResposta());
    const antes = result.current;
    rerender();

    expect(result.current, [
      'O `novoPedido` mudou de identidade entre renders.',
      '',
      'Ele entra nas deps dos `useCallback` que carregam lista. Identidade',
      'nova a cada render recria o `carregar`, e um `carregar` novo re-dispara',
      'o efeito que o chama — busca em laço, e o canal de realtime que depende',
      'dele seria reassinado sem parar.',
    ].join('\n')).toBe(antes);
  });

  it('cada montagem tem o PRÓPRIO contador', () => {
    const a = renderHook(() => useApenasAUltimaResposta());
    const b = renderHook(() => useApenasAUltimaResposta());

    const pedidoDeA = a.result.current();
    b.result.current();

    expect(pedidoDeA(), [
      'Uma busca de OUTRO componente invalidou a busca deste.',
      '',
      'O contador vazou entre montagens (virou módulo em vez de `useRef`).',
      'Com dois cards de comentário abertos, um anularia o outro e as duas',
      'listas ficariam vazias.',
    ].join('\n')).toBe(true);
  });
});
