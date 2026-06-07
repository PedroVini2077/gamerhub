import { describe, it, expect } from 'vitest';
import { getPasswordStrength, STRENGTH_LABELS, STRENGTH_COLORS } from '../password';

describe('getPasswordStrength', () => {
  it('retorna 0 para vazio/nulo/undefined', () => {
    expect(getPasswordStrength('')).toBe(0);
    expect(getPasswordStrength(null)).toBe(0);
    expect(getPasswordStrength(undefined)).toBe(0);
  });

  it('senha curta e simples pontua baixo', () => {
    expect(getPasswordStrength('abc')).toBe(0);      // < 8, sem variedade
    expect(getPasswordStrength('abcdefgh')).toBe(1); // só comprimento >= 8
  });

  it('soma pontos por maiúscula+minúscula, dígito e símbolo', () => {
    expect(getPasswordStrength('Abcdefgh')).toBe(2);   // len8 + case
    expect(getPasswordStrength('Abcdefg1')).toBe(3);   // len8 + case + dígito
    expect(getPasswordStrength('Abcdef1!')).toBe(4);   // len8 + case + dígito + símbolo
  });

  it('nunca passa de 4 (cap)', () => {
    expect(getPasswordStrength('Abcdefghijkl1!@#')).toBe(4); // atingiria 5, mas capa em 4
  });

  it('rótulos e cores têm 5 posições alinhadas (0–4)', () => {
    expect(STRENGTH_LABELS).toHaveLength(5);
    expect(STRENGTH_COLORS).toHaveLength(5);
    expect(STRENGTH_LABELS[4]).toBe('Forte');
  });
});
