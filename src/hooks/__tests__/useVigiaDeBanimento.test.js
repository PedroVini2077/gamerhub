/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

/**
 * Trava do vigia de banimento — a parte que saiu do `useAuth.jsx`.
 *
 * ── Por que ela existe, e por que só existe DEPOIS da divisão ───────────────
 *
 * O `useAuth` inteiro nunca foi testável: ele depende de sessão do Supabase, de
 * realtime, de React e da árvore de contexto, e um teste dele viraria um teste
 * dos mocks. Por isso a única trava que havia era leitura de fonte.
 *
 * Separado, este pedaço vira montável de verdade — e é exatamente o pedaço
 * arriscado da divisão.
 *
 * ── O risco que a divisão introduziu ────────────────────────────────────────
 *
 * Dentro do `useAuth`, o `revalidate` era declarado DENTRO do efeito, com
 * dependência só de `user?.id`: o canal nascia uma vez por usuário. Ao virar
 * parâmetro, ele passou a entrar nas dependências do efeito — e um callback
 * recriado a cada render derrubaria e reabriria o canal de realtime **em todo
 * render**.
 *
 * Isso não quebra nada visível: o site continua funcionando. Ele só passa a
 * abrir e fechar conexão sem parar, queimando a cota que o §0.2 vigia — e o
 * sintoma apareceria como "egress subiu" semanas depois, sem ninguém saber por
 * quê. É falha silenciosa de manual (§1.5).
 *
 * Para ver a trava funcionando: tire o `useCallback` do `revalidar` em
 * `useAuth.jsx` — o teste de "não reassina" continua verde (ele testa o hook,
 * não o chamador), mas o de contrato lá embaixo falha apontando o arquivo.
 */

const canais = [];
const removidos = [];

vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: (nome) => {
      const canal = {
        nome,
        aoMudar: null,
        on(_tipo, _filtro, cb) { canal.aoMudar = cb; return canal; },
        subscribe() { return canal; },
      };
      canais.push(canal);
      return canal;
    },
    removeChannel: (c) => { removidos.push(c.nome); },
  },
}));

const { useVigiaDeBanimento } = await import('../useVigiaDeBanimento');

const UM = 'user-1';

beforeEach(() => {
  canais.length = 0;
  removidos.length = 0;
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true, get: () => 'visible',
  });
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useVigiaDeBanimento', () => {
  it('assina UMA vez e não reassina quando o callback é estável', () => {
    const revalidar = vi.fn();
    const { rerender } = renderHook(() => useVigiaDeBanimento(UM, revalidar));

    expect(canais).toHaveLength(1);
    rerender();
    rerender();
    rerender();

    expect(
      canais.length,
      'O canal de realtime foi reaberto a cada render. Isso não quebra nada\n'
      + 'visível — o site continua funcionando — mas abre e fecha conexão sem\n'
      + 'parar, e o sintoma aparece como "o egress subiu" semanas depois.\n'
      + 'Confira as dependências do efeito e se quem chama passa um callback\n'
      + 'estável (`useCallback`).',
    ).toBe(1);
  });

  it('REASSINA quando o usuário muda — e larga o canal anterior', () => {
    const revalidar = vi.fn();
    const { rerender } = renderHook(
      ({ id }) => useVigiaDeBanimento(id, revalidar),
      { initialProps: { id: UM } },
    );
    rerender({ id: 'user-2' });

    expect(canais).toHaveLength(2);
    expect(
      removidos,
      'O canal do usuário anterior não foi removido ao trocar de conta.',
    ).toContain(`profile-ban-watch-${UM}`);
  });

  it('sem usuário, não abre canal nenhum', () => {
    renderHook(() => useVigiaDeBanimento(undefined, vi.fn()));
    expect(canais).toHaveLength(0);
  });

  it('o evento de realtime só revalida quando `banned` é verdadeiro', () => {
    const revalidar = vi.fn();
    renderHook(() => useVigiaDeBanimento(UM, revalidar));

    act(() => canais[0].aoMudar({ new: { banned: false } }));
    expect(revalidar).not.toHaveBeenCalled();

    act(() => canais[0].aoMudar({ new: { banned: true } }));
    expect(revalidar).toHaveBeenCalledTimes(1);
  });

  it('o poll de 60 s revalida com a aba visível', () => {
    const revalidar = vi.fn();
    renderHook(() => useVigiaDeBanimento(UM, revalidar));

    act(() => { vi.advanceTimersByTime(60000); });
    expect(revalidar).toHaveBeenCalledTimes(1);
  });

  it('o poll NÃO revalida com a aba em segundo plano', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => 'hidden',
    });
    const revalidar = vi.fn();
    renderHook(() => useVigiaDeBanimento(UM, revalidar));

    act(() => { vi.advanceTimersByTime(180000); });
    expect(
      revalidar,
      'O poll voltou a rodar com a aba escondida. Antes eram 20 s SEMPRE — um\n'
      + 'SELECT por usuário logado a cada 20 s, inclusive sem ninguém olhando.',
    ).not.toHaveBeenCalled();
  });

  it('desmontar solta o canal, o timer e o ouvinte', () => {
    const revalidar = vi.fn();
    const desligar = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useVigiaDeBanimento(UM, revalidar));

    unmount();

    expect(removidos).toContain(`profile-ban-watch-${UM}`);
    expect(desligar).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    revalidar.mockClear();
    act(() => { vi.advanceTimersByTime(300000); });
    expect(
      revalidar,
      'O `setInterval` continuou vivo depois da desmontagem — vazamento de\n'
      + 'timer, e ele segue consultando o banco para sempre.',
    ).not.toHaveBeenCalled();
  });
});

/**
 * Trava de CONTRATO com quem chama.
 *
 * O teste de cima prova que o hook não reassina com um callback estável. Ele
 * não pode provar que o `useAuth` passa um callback estável — e é lá que o
 * erro moraria. Isto é legível direto do fonte.
 */
describe('useAuth passa um callback estável para o vigia', () => {
  it('`revalidar` é memoizado', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fonte = readFileSync(join(import.meta.dirname, '../useAuth.jsx'), 'utf8');

    expect(
      fonte,
      'O `revalidar` que vai para o `useVigiaDeBanimento` deixou de ser\n'
      + 'memoizado. Ele entra nas dependências de um efeito que abre canal de\n'
      + 'realtime: sem `useCallback`, o canal é derrubado e reaberto a cada\n'
      + 'render do provider de autenticação — que é a raiz da árvore inteira.',
    ).toMatch(/const revalidar = useCallback\(/);

    for (const nome of ['fetchProfile', 'applyBannedCheck']) {
      expect(
        fonte,
        `\`${nome}\` deixou de ser memoizado. Ele entra em \`revalidar\`, então\n`
        + 'desestabilizá-lo desestabiliza o callback do vigia junto.',
      ).toMatch(new RegExp(`const ${nome} = useCallback\\(`));
    }
  });
});
