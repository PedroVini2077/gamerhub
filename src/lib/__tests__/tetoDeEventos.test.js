import { describe, it, expect } from 'vitest';
import { criarLimitador, LIMITE_PADRAO } from '../tetoDeEventos';

/**
 * Trava da cota do Sentry (CLAUDE.md §0.2 e §2).
 *
 * O que este teste impede de voltar: um bug em laço de render mandando
 * centenas de eventos, queimando os 5.000/mês do plano Free e fazendo o
 * Sentry descartar TUDO em silêncio pelo resto do mês.
 *
 * As três saídas do limitador têm que estar travadas, não só a feliz:
 *   1. abaixo do teto  -> passa o evento
 *   2. no estouro      -> UM aviso que conta a história
 *   3. depois do aviso -> silêncio (senão o próprio aviso vira a rajada)
 */

const erro = (mensagem) => ({
  exception: { values: [{ value: mensagem }] },
  extra: { rota: '/feed' },
});

describe('teto de eventos por sessão do Sentry', () => {
  it('deixa passar tudo enquanto está abaixo do teto', () => {
    const lim = criarLimitador(3);
    expect(lim.filtrar(erro('a'))).not.toBeNull();
    expect(lim.filtrar(erro('b'))).not.toBeNull();
    expect(lim.filtrar(erro('c'))).not.toBeNull();
    expect(lim.enviados()).toBe(3);
  });

  it('não mexe no evento que passa', () => {
    const lim = criarLimitador(3);
    const original = erro('intacto');
    expect(lim.filtrar(original)).toBe(original);
  });

  it('no estouro, troca o evento por UM aviso que carrega o último erro', () => {
    const lim = criarLimitador(2);
    lim.filtrar(erro('a'));
    lim.filtrar(erro('b'));

    const aviso = lim.filtrar(erro('o erro que estourou o teto'));

    expect(aviso, 'o estouro não pode virar silêncio — some do radar').not.toBeNull();
    expect(aviso.level).toBe('warning');
    expect(aviso.message).toMatch(/Teto de 2 eventos/);
    expect(aviso.extra.ultimo_erro).toBe('o erro que estourou o teto');
    expect(aviso.extra.teto).toBe(2);
  });

  it('o aviso não leva o stack do erro original', () => {
    // Se levasse, o Sentry agruparia o aviso dentro do issue da própria rajada
    // e ele se perderia exatamente no lugar onde precisa aparecer.
    const lim = criarLimitador(1);
    lim.filtrar(erro('a'));
    const aviso = lim.filtrar(erro('b'));
    expect(aviso.exception).toBeUndefined();
  });

  it('agrupa todos os avisos num issue só, entre sessões', () => {
    const lim = criarLimitador(1);
    lim.filtrar(erro('a'));
    expect(lim.filtrar(erro('b')).fingerprint).toEqual(['teto-de-eventos-por-sessao']);
  });

  it('depois do aviso, descarta — senão o aviso vira a rajada', () => {
    const lim = criarLimitador(1);
    lim.filtrar(erro('a'));
    lim.filtrar(erro('b')); // vira o aviso

    for (let i = 0; i < 500; i++) {
      expect(lim.filtrar(erro(`rajada ${i}`))).toBeNull();
    }
  });

  it('uma rajada de 1.000 erros custa no máximo teto+1 eventos de cota', () => {
    // É a garantia que interessa: qualquer laço de render, por pior que seja,
    // não consegue queimar a cota mensal.
    const lim = criarLimitador(20);
    let gastos = 0;
    for (let i = 0; i < 1000; i++) {
      if (lim.filtrar(erro(`laço ${i}`)) !== null) gastos += 1;
    }
    expect(gastos).toBe(21);
  });

  it('o teto padrão cabe na cota mensal do plano Free', () => {
    // 5.000/mês ÷ 30 dias = ~166/dia. Com 3 usuários e várias sessões por dia,
    // o teto por sessão precisa ser bem menor que isso para uma sessão ruim não
    // comer o dia inteiro. Se alguém subir muito este número, o teste avisa.
    expect(LIMITE_PADRAO).toBeLessThanOrEqual(30);
    expect(LIMITE_PADRAO).toBeGreaterThanOrEqual(5);
  });
});
