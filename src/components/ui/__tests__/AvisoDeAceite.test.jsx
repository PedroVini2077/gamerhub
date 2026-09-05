/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Trava do aviso de reaceite.
 *
 * ── Por que este componente precisa de teste montado, e não só de lógica ────
 *
 * Ele renderiza dentro do `Layout` da área logada. Se ele estourar, **derruba
 * o site inteiro para quem está logado** — não é enfeite de canto de tela.
 *
 * E a lógica pura (`documentosPendentes`) já tem trava própria; o que **só**
 * aparece montado é a decisão de mostrar ou não mostrar, que é onde mora o
 * comportamento que o dono pediu: *"só avisa sem bloquear"*.
 *
 * ── O caso que mais importa aqui ────────────────────────────────────────────
 *
 * `pendentes === null` significa "não consegui perguntar" — rede caída. Nesse
 * estado o aviso **não pode aparecer**: cutucar quem já aceitou tudo por causa
 * de uma falha de rede é alarme falso, e alarme falso ensina a ignorar o canal
 * (§0.2, 4ª regra).
 */

const mockUseAceites = vi.fn();
vi.mock('../../../hooks/useAceitesPendentes', () => ({
  useAceitesPendentes: () => mockUseAceites(),
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const { default: AvisoDeAceite } = await import('../AvisoDeAceite');
const { DOCUMENTOS } = await import('../../../lib/documentosLegais');

function montar() {
  return render(<MemoryRouter><AvisoDeAceite /></MemoryRouter>);
}

describe('AvisoDeAceite', () => {
  beforeEach(() => {
    mockUseAceites.mockReset();
    try { window.sessionStorage.clear(); } catch { /* jsdom sem storage */ }
  });
  afterEach(cleanup);

  // ── A trava do REACEITE ─────────────────────────────────────────────────
  //
  // O bug que ela impede ja aconteceu, e o relato foi: *"apareceu duas vezes
  // pra mim, sendo que aceitei uma vez ja"*. As duas aparicoes estavam certas —
  // a segunda porque a versao da politica subiu. O que estava errado era a
  // TELA: um segundo pedido identico ao primeiro e indistinguivel de sistema
  // quebrado, e quem le conclui a coisa errada.
  //
  // Sem esta trava, alguem "simplifica" o texto de volta para um so e o aviso
  // volta a parecer defeito — sem nada quebrar.
  it('no REACEITE, diz o que mudou e não repete o texto de primeira vez', () => {
    mockUseAceites.mockReturnValue({
      pendentes: ['privacidade'], aceitar: vi.fn(), enviando: false,
    });
    const { container } = montar();
    const texto = container.textContent;

    expect(texto,
      'reaceite nao pode usar o texto de quem nunca aceitou: para o dono,\n'
      + '  os dois pedidos ficam identicos e o segundo parece bug')
      .not.toContain('Temos documentos para você ler e aceitar');

    // Compara com o `mudou` de DOCUMENTOS em vez de com a frase literal.
    // A primeira versao deste teste cravava a palavra "prazos" e quebrou na
    // primeira vez que o texto do resumo mudou — teste preso a copia acusa
    // edicao de texto como se fosse regressao, e vira ruido (§0.2, 4a regra).
    expect(DOCUMENTOS.privacidade.mudou,
      'a politica precisa dizer o que mudou na ultima versao, senao o aviso\n'
      + '  de reaceite nao tem o que mostrar')
      .toBeTruthy();
    expect(texto,
      'o aviso de reaceite precisa dizer O QUE mudou, e nao so QUE mudou.\n'
      + '  Sem isso a pessoa teria que reler o documento inteiro para achar\n'
      + '  a diferenca — e na pratica ninguem relê: aceita sem ler.')
      .toContain(DOCUMENTOS.privacidade.mudou);
  });

  it('no PRIMEIRO aceite, não fala em mudança nenhuma', () => {
    // O espelho do teste acima. Sem ele, um `mudou` sempre visivel diria a
    // quem acabou de criar conta que "atualizamos" algo que ela nunca viu.
    mockUseAceites.mockReturnValue({
      pendentes: ['privacidade', 'regras', 'termos'], aceitar: vi.fn(), enviando: false,
    });
    const { container } = montar();

    expect(container.textContent,
      'quem nunca aceitou nada nao teve nada "atualizado" — dizer que teve e\n'
      + '  mensagem falsa (§1.5)')
      .toContain('Temos documentos para você ler e aceitar');
    expect(container.textContent).not.toContain(DOCUMENTOS.privacidade.mudou);
  });

  it('NÃO aparece quando a consulta falhou (pendentes = null)', () => {
    mockUseAceites.mockReturnValue({ pendentes: null, aceitar: vi.fn(), enviando: false });
    const { container } = montar();
    expect(container.textContent,
      'com a rede caida o aviso tem que ficar calado, e nao cutucar quem ja aceitou')
      .toBe('');
  });

  it('NÃO aparece quando está tudo aceito', () => {
    mockUseAceites.mockReturnValue({ pendentes: [], aceitar: vi.fn(), enviando: false });
    const { container } = montar();
    expect(container.textContent).toBe('');
  });

  it('aparece com os documentos pendentes, e cada um vira LINK', () => {
    mockUseAceites.mockReturnValue({ pendentes: ['termos'], aceitar: vi.fn(), enviando: false });
    montar();
    const link = screen.getByRole('link', { name: /termos de uso/i });
    // Aba nova: sem isto, ler o documento faria a pessoa PERDER a tela em que
    // estava. O resultado previsivel e ninguem clicar, ou seja, ninguem ler.
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('NÃO bloqueia: existe o botão de adiar, e ele faz o aviso sumir', async () => {
    // O pedido do dono foi explicito: "so avisa sem bloquear".
    mockUseAceites.mockReturnValue({ pendentes: ['termos'], aceitar: vi.fn(), enviando: false });
    const { container } = montar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /ver depois/i })); });
    expect(container.textContent).toBe('');
  });

  it('aceitar que FALHA mantém o aviso na tela', async () => {
    // Sumir com erro faria a pessoa achar que aceitou sem ter aceitado — e do
    // nosso lado, sem registro nenhum. A tela nao pode dizer o que nao
    // aconteceu (§1.5).
    const aceitar = vi.fn().mockResolvedValue({ error: new Error('rede fora') });
    mockUseAceites.mockReturnValue({ pendentes: ['termos'], aceitar, enviando: false });
    const { container } = montar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /li e aceito/i })); });
    await waitFor(() => expect(aceitar).toHaveBeenCalled());
    expect(container.textContent,
      'o aviso sumiu mesmo com o aceite tendo falhado').not.toBe('');
  });
});
