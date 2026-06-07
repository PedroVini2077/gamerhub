import { describe, it, expect } from 'vitest';
import { formatNumber } from '../format';

describe('formatNumber', () => {
  it('mantém números abaixo de mil como string', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(999)).toBe('999');
  });

  it('abrevia milhares com k', () => {
    expect(formatNumber(1000)).toBe('1k');
    expect(formatNumber(1500)).toBe('1.5k');
    expect(formatNumber(12000)).toBe('12k');
  });

  it('abrevia milhões com M', () => {
    expect(formatNumber(1_000_000)).toBe('1M');
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });

  it('abrevia bilhões com B', () => {
    expect(formatNumber(1_000_000_000)).toBe('1B');
    expect(formatNumber(2_500_000_000)).toBe('2.5B');
  });
});
