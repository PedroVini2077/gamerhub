/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import LivesList from '../LivesList';

afterEach(cleanup);

/**
 * `[09/10]` O VAZIO DA ABA NÃO PODE AFIRMAR COISA SOBRE O SITE.
 *
 * ── O que ele dizia, com uma live no ar ───────────────────────────────────
 *
 *     cabeçalho ........ "1 ao vivo"
 *     aba Gameplays .... "(1)"
 *     o miolo .......... "Nenhuma live acontecendo agora — volte mais tarde!"
 *
 * As três ao mesmo tempo, na mesma tela. **Achado pelo E2E**, não por leitura
 * de código — e é o tipo de coisa que leitura de código não acha, porque cada
 * pedaço está certo sozinho.
 *
 * ── A causa, e por que ela NÃO é juntar as abas ───────────────────────────
 *
 * O `LiveGoModal` sempre define um `live_kind` (padrão `gameplay`), e a aba
 * padrão é `Da comunidade`, que casa com `!live_kind`. Quem acabou de ficar ao
 * vivo cai numa aba que diz que não tem nada.
 *
 * Separar live de jogador de live da comunidade é **deliberado**. O defeito
 * era o texto: ele afirmava sobre o SITE ("nenhuma live acontecendo") o que só
 * sabia sobre a ABA. É a mesma família do fallback silencioso do §4 — escolher
 * uma resposta para uma pergunta que ninguém fez.
 *
 * ── Por que isto é trava e não só conserto ────────────────────────────────
 *
 * Nada quebra quando a frase volta a mentir. O build passa, o lint passa, os
 * dados estão certos, a live existe e está contada ali do lado. O único sinal
 * é alguém ler a tela e achar que o site está vazio — que foi o que aconteceu
 * por semanas.
 */

describe('o vazio da aba não mente sobre o site', () => {
  it('sem live NENHUMA, ele fala do site — e está certo', () => {
    render(<LivesList lives={[]} enterLive={() => {}} totalNoAr={0} />);
    expect(screen.getByText(/Nenhuma live acontecendo agora/)).toBeTruthy();
  });

  it('com live em OUTRA aba, ele para de dizer que não há nenhuma', () => {
    render(<LivesList lives={[]} enterLive={() => {}} totalNoAr={1} irParaAbaComLive={() => {}} />);

    expect(
      screen.queryByText(/Nenhuma live acontecendo agora/),
      'a aba vazia voltou a afirmar que o SITE não tem live nenhuma.\n'
      + 'Ela só sabe da própria aba. Com uma live no ar, a tela mostrava\n'
      + '"1 ao vivo" no cabeçalho, "(1)" na aba ao lado e "nenhuma live\n'
      + 'acontecendo" no miolo — as três juntas, e nada quebrando.',
    ).toBeNull();

    expect(screen.getByText(/Nenhuma live nesta aba/)).toBeTruthy();
  });

  it('ele DIZ quantas há, e a frase concorda em número', () => {
    const { unmount } = render(
      <LivesList lives={[]} enterLive={() => {}} totalNoAr={1} irParaAbaComLive={() => {}} />,
    );
    expect(
      screen.getByText(/Há 1 live no ar/),
      'o singular sumiu — "Há 1 lives no ar" é o tipo de frase que faz a tela\n'
      + 'parecer gerada, não escrita.',
    ).toBeTruthy();
    unmount();

    render(<LivesList lives={[]} enterLive={() => {}} totalNoAr={3} irParaAbaComLive={() => {}} />);
    expect(screen.getByText(/Há 3 lives no ar/)).toBeTruthy();
  });

  it('o caminho de saída existe e LEVA para a aba certa', () => {
    const ir = vi.fn();
    render(<LivesList lives={[]} enterLive={() => {}} totalNoAr={2} irParaAbaComLive={ir} />);

    const botao = screen.getByRole('button', { name: /Ver onde estão/ });
    fireEvent.click(botao);

    expect(
      ir,
      'o botão "Ver onde estão" parou de trocar de aba.\n'
      + 'Dizer que a live está em outro lugar e não levar até lá é meio\n'
      + 'conserto: a pessoa continua tendo de adivinhar qual aba abrir.',
    ).toHaveBeenCalled();
  });

  it('sem aba para onde ir, ele NÃO oferece o botão', () => {
    // Acontece quando a única live está na aba onde a pessoa já está — ou
    // seja, nunca neste vazio. Botão que leva ao mesmo lugar é pior do que
    // botão nenhum: ele promete movimento e não entrega.
    render(<LivesList lives={[]} enterLive={() => {}} totalNoAr={1} />);
    expect(screen.queryByRole('button', { name: /Ver onde estão/ })).toBeNull();
  });
});
