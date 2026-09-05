import { describe, it, expect, vi, afterEach } from 'vitest';
import { isLoginBlocked, segundosRestantes } from '../loginBlock';

/**
 * ── Por que este arquivo nasceu do teste de MUTAÇÃO ─────────────────────────
 *
 * `npm run mutacao`, na primeira execução, deu **0,00%** para o
 * `lib/loginBlock.js`: nenhum mutante morto, porque não havia teste nenhum.
 *
 * E não é um módulo qualquer. Ele é a **fonte única** da pergunta "esta pessoa
 * está impedida de entrar agora?", usada pela página de login e pelo formulário.
 * A suíte inteira estava verde com ele descoberto — que é exatamente o ponto
 * cego que o teste de mutação existe para revelar (`npm test` mede se o teste
 * roda; a mutação mede se ele **detecta**).
 *
 * ── O tempo é congelado de propósito ────────────────────────────────────────
 *
 * As duas funções chamam `Date.now()`. Sem congelar, um teste de "faltam 60
 * segundos" viraria 59 na máquina lenta e o CI ficaria intermitente — alarme
 * falso, do tipo que ensina a ignorar o canal (§0.2, 4ª regra).
 */

const AGORA = new Date('2026-09-02T12:00:00Z');
const emSegundos = (s) => new Date(AGORA.getTime() + s * 1000).toISOString();

afterEach(() => vi.useRealTimers());
const congelar = () => { vi.useFakeTimers(); vi.setSystemTime(AGORA); };

describe('isLoginBlocked', () => {
  it('sem registro de bloqueio, não está bloqueado', () => {
    congelar();
    expect(isLoginBlocked(null)).toBe(false);
    expect(isLoginBlocked(undefined)).toBe(false);
  });

  it('bloqueio PERMANENTE vale mesmo sem data', () => {
    congelar();
    expect(isLoginBlocked({ permanent: true })).toBe(true);
    // A ordem importa: `permanent` é conferido ANTES de `blocked_until`. Se
    // fosse depois, um bloqueio permanente sem data cairia no `return false`.
    expect(isLoginBlocked({ permanent: true, blocked_until: null })).toBe(true);
  });

  it('bloqueio temporário no FUTURO bloqueia', () => {
    congelar();
    expect(isLoginBlocked({ blocked_until: emSegundos(60) })).toBe(true);
  });

  it('bloqueio temporário que JÁ PASSOU não bloqueia mais', () => {
    congelar();
    expect(isLoginBlocked({ blocked_until: emSegundos(-1) })).toBe(false);
  });

  it('exatamente no instante do vencimento, NÃO bloqueia', () => {
    // A fronteira. `>` e não `>=`: no segundo em que vence, a pessoa entra.
    // Trocar um pelo outro deixaria alguém trancado por um segundo a mais, e
    // nenhum teste de "futuro" ou "passado" pegaria isso.
    congelar();
    expect(isLoginBlocked({ blocked_until: emSegundos(0) })).toBe(false);
  });

  it('registro sem `blocked_until` e sem `permanent` não bloqueia', () => {
    congelar();
    expect(isLoginBlocked({ attempts: 3 })).toBe(false);
  });
});

describe('segundosRestantes', () => {
  it('sem bloqueio, zero', () => {
    congelar();
    expect(segundosRestantes(null)).toBe(0);
    expect(segundosRestantes({})).toBe(0);
  });

  it('bloqueio PERMANENTE devolve zero — não há contagem para mostrar', () => {
    // Um contador regressivo num bloqueio permanente prometeria uma liberação
    // que nunca vem. É a tela mentindo (§1.5).
    congelar();
    expect(segundosRestantes({ permanent: true, blocked_until: emSegundos(600) })).toBe(0);
  });

  it('arredonda para CIMA, para nunca mostrar zero com bloqueio ativo', () => {
    congelar();
    // 500 ms restantes: `Math.floor` daria 0 e a tela diria "libere agora" com
    // o bloqueio ainda de pé.
    expect(segundosRestantes({ blocked_until: new Date(AGORA.getTime() + 500).toISOString() }))
      .toBe(1);
  });

  it('bloqueio vencido devolve zero, e nunca negativo', () => {
    congelar();
    expect(segundosRestantes({ blocked_until: emSegundos(-30) })).toBe(0);
  });

  it('conta os segundos certos', () => {
    congelar();
    expect(segundosRestantes({ blocked_until: emSegundos(90) })).toBe(90);
  });
});
