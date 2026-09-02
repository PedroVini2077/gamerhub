import { describe, it, expect } from 'vitest';
import { varrerFontes } from './varrerFontes';

/**
 * A guarda do varredor precisa ser provada como qualquer outra trava — senão
 * ela é só mais uma coisa que dizemos que funciona.
 */
describe('varrerFontes', () => {
  it('encontra os arquivos de uma pasta que existe', () => {
    const achados = varrerFontes('src/lib');
    expect(achados.length).toBeGreaterThan(10);
    expect(achados.every(f => f.endsWith('.js') || f.endsWith('.jsx'))).toBe(true);
  });

  it('ignora __tests__ por padrão', () => {
    expect(varrerFontes('src/lib').some(f => f.includes('__tests__'))).toBe(false);
    expect(varrerFontes('src/lib', { comTestes: true })
      .some(f => f.includes('__tests__'))).toBe(true);
  });

  it('ESTOURA quando a pasta não existe — o ponto inteiro da função', () => {
    // Este é o caso que a função existe para pegar: caminho errado devolvendo
    // lista vazia, e a trava que a chamou passando verde sem olhar nada.
    expect(() => varrerFontes('src/pasta-que-foi-renomeada'))
      .toThrow(/nao encontrou arquivo nenhum/);
  });
});
