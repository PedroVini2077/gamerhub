/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

/**
 * `[01/10]` O atalho de publicar no celular — e as DUAS formas de errar.
 *
 * ── A lacuna que ele apontou ──────────────────────────────────────────────
 *
 * *"no celular, a sidebar fica fechada e, quando o usuário rola o Feed, a
 * LinhaDePublicar sai do viewport — então o acesso rápido para criar post
 * desaparece"*. No desktop não acontece: a barra está sempre aberta.
 *
 * ── Por que isto precisa de trava, se é "só um botão" ─────────────────────
 *
 * Porque as duas formas de quebrá-lo são MUDAS (§1.5):
 *
 *   1. **Aparecer cedo demais.** Se o estado inicial virar `false`, o atalho
 *      pisca em toda carga com a linha na cara da pessoa. Ninguém reporta um
 *      piscar; o build passa; nenhum teste de rota quebra.
 *   2. **Não aparecer nunca.** Se o `ref` sair do elemento, ou o
 *      `IntersectionObserver` deixar de ser ligado, o atalho simplesmente não
 *      existe. A tela fica igual à de antes — que é o estado de defeito.
 *
 * E uma terceira, que é a cara: **ele aparecer no desktop**, onde a barra já
 * resolve e ele vira enfeite flutuando sobre o conteúdo.
 */

const auth = { user: { id: 'u1' }, profile: { id: 'u1', username: 'teste' } };
const navegou = vi.fn();

vi.mock('../../../hooks/useAuth.jsx', () => ({ useAuth: () => auth }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navegou }));
vi.mock('../../ui/Avatar', () => ({ default: () => null }));

const { default: LinhaDePublicar } = await import('../LinhaDePublicar');

/**
 * Um `IntersectionObserver` de mentira cujo gatilho este teste controla.
 *
 * O jsdom não tem o de verdade. Sem este dublê o componente cairia no caminho
 * degradado (`naTela` preso em `true`) e o teste provaria apenas que o atalho
 * nunca aparece — verde sobre a feature desligada, que é o pior resultado.
 */
let dispararVisibilidade;
function instalarObservador() {
  const inscritos = [];
  dispararVisibilidade = (visivel) => act(() => {
    inscritos.forEach((cb) => cb([{ isIntersecting: visivel }]));
  });
  globalThis.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { inscritos.push(this.cb); }
    disconnect() { const i = inscritos.indexOf(this.cb); if (i >= 0) inscritos.splice(i, 1); }
    unobserve() {}
  };
}

const atalho = () => document.querySelector('[data-publicar="flutuante"]');

beforeEach(() => { auth.profile = { id: 'u1', username: 'teste' }; instalarObservador(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); delete globalThis.IntersectionObserver; });

describe('o atalho só existe quando a linha saiu da tela', () => {
  it('NÃO aparece na carga, com a linha visível', () => {
    render(<LinhaDePublicar />);
    expect(atalho(), 'o atalho apareceu com a linha ainda na tela. Se o estado '
      + 'inicial de `useNaTela` virou `false`, ele pisca em TODA carga da pagina '
      + '— e piscar nao e algo que alguem reporta.').toBeNull();
  });

  it('aparece quando a linha sai, e some quando ela volta', () => {
    render(<LinhaDePublicar />);

    dispararVisibilidade(false);
    expect(atalho(), 'a linha saiu da viewport e nenhum atalho apareceu. No '
      + 'celular isso deixa a pessoa SEM caminho para publicar ate rolar tudo '
      + 'de volta — a barra lateral esta fechada.').not.toBeNull();

    dispararVisibilidade(true);
    expect(atalho(), 'a linha voltou a aparecer e o atalho ficou. Dois caminhos '
      + 'para a mesma acao na mesma tela, um deles flutuando por cima do feed.')
      .toBeNull();
  });

  it('não está no DOM quando escondido — não é `display:none`', () => {
    // Atalho montado e invisivel e anunciado pelo leitor de tela sem a pessoa
    // poder usar. O `md:hidden` cuida do DESKTOP; o estado cuida do resto.
    render(<LinhaDePublicar />);
    expect(document.body.innerHTML).not.toContain('data-publicar="flutuante"');
  });
});

describe('o atalho é do CELULAR, e não conflita com a barra lateral', () => {
  it('some no breakpoint em que a barra lateral deixa de ser gaveta', () => {
    render(<LinhaDePublicar />);
    dispararVisibilidade(false);
    // A barra e `md:translate-x-0`: de `md:` para cima ela esta sempre aberta
    // e ja tem o botao. O atalho ali seria enfeite sobre o conteudo.
    expect(atalho().className, 'o atalho perdeu o `md:hidden` e passou a '
      + 'aparecer no desktop, onde a barra lateral ja resolve.')
      .toContain('md:hidden');
  });

  it('fica ABAIXO do véu da barra lateral', () => {
    render(<LinhaDePublicar />);
    dispararVisibilidade(false);
    const z = atalho().className.match(/z-\[(\d+)\]/)?.[1];
    expect(z, 'o atalho ficou sem z-index explicito').toBeDefined();
    // O veu e `z-20` e a gaveta `z-30` (Sidebar.jsx). Passar de 20 faz o
    // atalho flutuar POR CIMA do menu aberto, clicavel, em cima dos itens.
    expect(Number(z), 'o atalho subiu para cima do veu da barra lateral (z-20). '
      + 'Com o menu do celular aberto ele passa a flutuar sobre os itens do '
      + 'menu em vez de escurecer junto.').toBeLessThan(20);
  });
});

describe('o atalho não duplica regra nem lógica', () => {
  it('leva para a MESMA rota, pela MESMA navegação', () => {
    render(<LinhaDePublicar />);
    dispararVisibilidade(false);
    fireEvent.click(atalho());
    expect(navegou).toHaveBeenCalledWith('/publicar');
  });

  it('tem nome acessível', () => {
    render(<LinhaDePublicar />);
    dispararVisibilidade(false);
    expect(atalho().getAttribute('aria-label')).toBe('Criar post');
  });

  it('não existe para quem NÃO pode publicar', () => {
    // A regra mora nos `return null` do componente e governa o atalho de
    // graca. Se ele for movido para fora, ela precisa ser REESCRITA la — e
    // duas copias da mesma regra divergem (§4). Este teste e o que acusa.
    auth.profile = { id: 'u1', suspended_until: '2099-01-01T00:00:00Z' };
    const { container } = render(<LinhaDePublicar />);
    expect(container.innerHTML, 'conta suspensa ganhou um atalho para uma tela '
      + 'que o banco vai recusar').toBe('');
  });
});

describe('navegador sem IntersectionObserver', () => {
  it('degrada para NENHUM atalho, nunca para um atalho preso', () => {
    // Degradar ao contrario grudaria um botao flutuante sobre o conteudo sem
    // jeito de sumir. A linha continua la: perder o atalho nao perde a acao.
    delete globalThis.IntersectionObserver;
    render(<LinhaDePublicar />);
    expect(atalho()).toBeNull();
    expect(document.querySelector('[data-publicar="linha"]')).not.toBeNull();
  });
});
