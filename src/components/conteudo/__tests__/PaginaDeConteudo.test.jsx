/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaginaDeConteudo from '../PaginaDeConteudo';

/**
 * ── O que esta trava impede ─────────────────────────────────────────────────
 *
 * O dono pediu em 02/09 que **todas as abas da barra lateral** tivessem o
 * fundo animado, *"assim como o sobre"*. O jeito frágil de entregar isso seria
 * pôr `<FundoAnimado />` em cada página: quatro linhas iguais, e a quinta
 * página nasce sem — porque quem a escrever não vai saber que precisa.
 *
 * O fundo mora na CASCA, então toda página que a usa ganha por construção.
 * Este teste garante que ele continua lá: se alguém tirar, quatro abas ficam
 * sem fundo de uma vez — e **ninguém reporta enfeite ausente como bug**, então
 * o sintoma some da percepção de todo mundo.
 *
 * ── As três regras que o enfeite não pode perder ────────────────────────────
 *
 * Estão testadas aqui, e não só escritas no componente, porque as três são
 * invisíveis quando quebram: ninguém percebe que o fundo roubou um clique até
 * tentar clicar num link que está por baixo dele.
 */
// O `whileInView` do Framer usa `IntersectionObserver`, que o jsdom não tem.
// O mínimo que faz a montagem acontecer — este teste não mede revelação por
// rolagem, mede o que a casca DESENHA.
beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  });
});

afterEach(cleanup);

const BLOCOS = [{
  id: 'x', titulo: 'Um bloco', icone: 'Mail', pendente: false,
  paragrafos: ['texto'],
}];

function montar() {
  return render(
    <MemoryRouter>
      <PaginaDeConteudo eyebrow="X" titulo="T" blocos={BLOCOS} />
    </MemoryRouter>,
  );
}

describe('a casca das páginas públicas', () => {
  it('desenha o fundo animado — toda aba ganha por construção', () => {
    const { container } = montar();
    const camada = container.querySelector('.camada-de-fundo');
    expect(camada,
      'O fundo animado sumiu da casca. Isso deixa /privacidade, /regras,\n'
      + '  /termos e /contato sem fundo DE UMA VEZ — e ninguem reporta enfeite\n'
      + '  ausente como bug, entao o sintoma some da percepcao de todo mundo.')
      .not.toBeNull();
    expect(camada.children.length,
      'a camada existe mas esta vazia — nenhuma forma para animar').toBeGreaterThan(0);
  });

  it('o fundo NÃO rouba clique do texto', () => {
    const { container } = montar();
    expect(container.querySelector('.camada-de-fundo').className)
      .toContain('pointer-events-none');
  });

  it('o fundo some para quem pediu MENOS MOVIMENTO no sistema', () => {
    // Nao e acessibilidade decorativa: movimento de fundo dispara enjoo em
    // quem tem sensibilidade vestibular.
    const { container } = montar();
    expect(container.querySelector('.camada-de-fundo').className)
      .toContain('motion-reduce:hidden');
  });

  it('o leitor de tela não anuncia a decoração', () => {
    const { container } = montar();
    expect(container.querySelector('.camada-de-fundo').getAttribute('aria-hidden'))
      .toBe('true');
  });

  it('o conteúdo fica ACIMA do fundo', () => {
    // Sem isto o fundo passaria por cima do texto — a diferenca entre
    // ambientacao e poluicao.
    const { container } = montar();
    expect(container.querySelector('.relative.z-10'),
      'o conteudo perdeu o `relative z-10`').not.toBeNull();
  });
});
