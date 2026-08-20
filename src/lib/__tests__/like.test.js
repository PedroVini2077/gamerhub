import { describe, it, expect, vi, beforeEach } from 'vitest';

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: toastError, success: vi.fn() },
}));

const { runLikeToggle } = await import('../like');

// Cenário que o teste protege: o erro do servidor era ignorado, então o coração
// acendia e o número subia mesmo quando nada tinha sido salvo (RLS bloqueando
// conta suspensa/banida, rede caindo). O estado só voltava no próximo refetch.
function harness(initialLiked, initialCount) {
  const state = { liked: initialLiked, count: initialCount };
  return {
    state,
    apply:  () => { state.liked = !initialLiked; state.count += initialLiked ? -1 : 1; },
    revert: () => { state.liked = initialLiked;  state.count += initialLiked ? 1 : -1; },
  };
}

beforeEach(() => toastError.mockClear());

describe('runLikeToggle', () => {
  it('curtir com sucesso mantém o estado otimista', async () => {
    const h = harness(false, 4);
    const ok = await runLikeToggle({
      liked: false, apply: h.apply, revert: h.revert,
      like: async () => ({ error: null }),
      unlike: async () => { throw new Error('não deveria chamar unlike'); },
    });
    expect(ok).toBe(true);
    expect(h.state).toEqual({ liked: true, count: 5 });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('descurtir com sucesso mantém o estado otimista', async () => {
    const h = harness(true, 4);
    const ok = await runLikeToggle({
      liked: true, apply: h.apply, revert: h.revert,
      like: async () => { throw new Error('não deveria chamar like'); },
      unlike: async () => ({ error: null }),
    });
    expect(ok).toBe(true);
    expect(h.state).toEqual({ liked: false, count: 3 });
  });

  it('erro ao curtir DESFAZ e avisa o usuário', async () => {
    const h = harness(false, 4);
    const ok = await runLikeToggle({
      liked: false, apply: h.apply, revert: h.revert,
      like: async () => ({ error: { message: 'new row violates row-level security policy' } }),
      unlike: async () => ({ error: null }),
    });
    expect(ok).toBe(false);
    expect(h.state).toEqual({ liked: false, count: 4 }); // voltou ao original
    expect(toastError).toHaveBeenCalledOnce();
  });

  it('erro ao descurtir também desfaz', async () => {
    const h = harness(true, 7);
    const ok = await runLikeToggle({
      liked: true, apply: h.apply, revert: h.revert,
      like: async () => ({ error: null }),
      unlike: async () => ({ error: { message: 'falhou' } }),
    });
    expect(ok).toBe(false);
    expect(h.state).toEqual({ liked: true, count: 7 });
    expect(toastError).toHaveBeenCalledOnce();
  });

  it('resposta sem envelope (undefined) conta como sucesso, não quebra', async () => {
    const h = harness(false, 0);
    const ok = await runLikeToggle({
      liked: false, apply: h.apply, revert: h.revert,
      like: async () => undefined,
      unlike: async () => undefined,
    });
    expect(ok).toBe(true);
    expect(h.state).toEqual({ liked: true, count: 1 });
  });
});
