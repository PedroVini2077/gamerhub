/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useDeleteCountdown } from '../useDeleteCountdown';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

const tick = n => act(() => { vi.advanceTimersByTime(n * 1000); });

describe('useDeleteCountdown', () => {
  it('começa parado', () => {
    const { result } = renderHook(() => useDeleteCountdown(5, vi.fn()));
    expect(result.current.remaining).toBeNull();
    expect(result.current.active).toBe(false);
  });

  it('conta de 5 até 1 e dispara a ação ao zerar', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useDeleteCountdown(5, onExpire));

    act(() => result.current.start());
    expect(result.current.remaining).toBe(5);

    tick(1); expect(result.current.remaining).toBe(4);
    tick(3); expect(result.current.remaining).toBe(1);
    expect(onExpire).not.toHaveBeenCalled();

    tick(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.remaining).toBeNull();
  });

  it('cancelar impede a ação', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useDeleteCountdown(5, onExpire));

    act(() => result.current.start());
    tick(2);
    act(() => result.current.cancel());

    expect(result.current.remaining).toBeNull();
    tick(10);
    expect(onExpire).not.toHaveBeenCalled();
  });

  // O BUG: no PostCard o clearInterval reagia às props de engajamento do post,
  // então um refetch do feed no meio da contagem matava o timer sem limpar o
  // estado — o aviso congelava na tela e o post nunca era excluído.
  it('sobrevive a re-render com props novas — a regressão do PostCard', () => {
    const onExpire = vi.fn();
    const { result, rerender } = renderHook(
      ({ likes }) => useDeleteCountdown(5, () => onExpire(likes)),
      { initialProps: { likes: 0 } },
    );

    act(() => result.current.start());
    tick(2);
    expect(result.current.remaining).toBe(3);

    // simula o refetch do feed chegando no meio da contagem
    rerender({ likes: 7 });
    rerender({ likes: 9 });

    expect(result.current.remaining).toBe(3);
    tick(3);
    expect(onExpire).toHaveBeenCalledTimes(1);
    // e usa o valor ATUAL das props, não o congelado no início
    expect(onExpire).toHaveBeenCalledWith(9);
  });

  it('desmontar cancela a contagem em andamento', () => {
    const onExpire = vi.fn();
    const { result, unmount } = renderHook(() => useDeleteCountdown(5, onExpire));

    act(() => result.current.start());
    tick(2);
    unmount();

    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('start durante uma contagem reinicia do começo', () => {
    const { result } = renderHook(() => useDeleteCountdown(5, vi.fn()));
    act(() => result.current.start());
    tick(3);
    expect(result.current.remaining).toBe(2);

    act(() => result.current.start());
    expect(result.current.remaining).toBe(5);
  });
});
