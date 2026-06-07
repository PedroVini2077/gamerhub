import { describe, it, expect, vi, afterEach } from 'vitest';
import { calcAge, MIN_SIGNUP_AGE } from '../date';

describe('calcAge', () => {
  afterEach(() => vi.useRealTimers());

  it('retorna null sem data', () => {
    expect(calcAge(null)).toBe(null);
    expect(calcAge('')).toBe(null);
    expect(calcAge(undefined)).toBe(null);
  });

  it('calcula idade aproximada (com relógio fixo)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00Z'));
    expect(calcAge('2000-01-01')).toBe(26);
    expect(calcAge('2020-01-01')).toBe(6);
  });

  it('distingue claramente acima e abaixo da idade mínima', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00Z'));
    expect(calcAge('2000-01-01')).toBeGreaterThanOrEqual(MIN_SIGNUP_AGE);
    expect(calcAge('2020-01-01')).toBeLessThan(MIN_SIGNUP_AGE);
  });

  it('MIN_SIGNUP_AGE é 13 (LGPD)', () => {
    expect(MIN_SIGNUP_AGE).toBe(13);
  });
});
