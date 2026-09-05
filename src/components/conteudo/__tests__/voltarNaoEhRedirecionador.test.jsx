/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import BotaoVoltar from '../BotaoVoltar';
import { comVoltaPara } from '../../../lib/url';

/**
 * TRAVA do "Voltar" das páginas públicas — as DUAS metades.
 *
 * ── O bug (05/09) ───────────────────────────────────────────────────────────
 *
 * Relato do dono: *"sabe os links pra ler os termos de uso, privacidade e tals?
 * quando eu clico vai tudo certo, mas quando eu volto… eu volto direto pra
 * landing"*. O botão era `<Link to="/">`: ele nunca voltou, sempre navegou para
 * a landing.
 *
 * **E `navigate(-1)` sozinho não conserta o caso dele**, que é a parte que
 * quase passou batido: os links do cadastro abrem `target="_blank"`, e aba nova
 * nasce **sem histórico**. Por isso a origem viaja num `?de=`, e por isso este
 * teste existe com a URL do cadastro dentro dele — se alguém "simplificar" para
 * só `navigate(-1)`, o relato original volta e nada mais acusa.
 *
 * ── A brecha que a correção poderia ter aberto ──────────────────────────────
 *
 * `?de=` é entrada de usuário. Um "Voltar" que obedecesse cegamente seria
 * **redirecionamento aberto**: `…/termos?de=//site-falso` mostra o nosso
 * domínio na barra, e o clique em "Voltar" leva para fora. Os casos abaixo são
 * os que passariam por uma checagem ingênua de "começa com barra".
 */
const CASOS_DE_ATAQUE = [
  ['//site-falso.com', 'relativa a protocolo: o navegador lê como HOST'],
  ['/\\site-falso.com', 'contrabarra vale como barra na análise do navegador'],
  ['https://site-falso.com', 'URL absoluta'],
  ['http://site-falso.com', 'URL absoluta'],
  ['javascript:alert(1)', 'esquema executável'],
  ['/%2f%2fsite-falso.com', 'as duas barras escapadas'],
  ['site-falso.com', 'sem barra nenhuma: vira caminho relativo à página atual'],
  ['', 'vazio'],
];

/** Renderiza o botão numa rota, e devolve o elemento clicável. */
function montar(url) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/termos" element={<BotaoVoltar />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByText(/voltar/i).closest('a, button');
}

afterEach(cleanup);

describe('o "Voltar" das páginas públicas', () => {
  it('volta para o CADASTRO quando o link veio de lá', () => {
    const alvo = montar('/termos?de=%2Flogin%3Fmodo%3Dcadastro');

    expect(alvo.tagName, 'com a origem conhecida o destino é um link de verdade')
      .toBe('A');
    expect(
      alvo.getAttribute('href'),
      'este e o relato do dono, na letra: ele clicou nos termos DE DENTRO do\n'
      + 'cadastro (aba nova, sem historico) e voltou para a landing.\n'
      + 'Se este teste falhar com href="/", o `?de=` parou de ser lido — e\n'
      + '`navigate(-1)` NAO cobre este caso, porque aba nova nao tem "-1".',
    ).toBe('/login?modo=cadastro');
  });

  it('sem origem e sem histórico, a landing é o destino honesto', () => {
    // Quem colou `/termos` na barra do navegador. Aqui `-1` sairia do site.
    expect(montar('/termos').getAttribute('href')).toBe('/');
  });

  it.each(CASOS_DE_ATAQUE)('recusa `de=%s` (%s)', (payload) => {
    const alvo = montar(`/termos?de=${encodeURIComponent(payload)}`);

    expect(
      alvo.getAttribute('href'),
      `"${payload}" foi aceito como destino do botao Voltar.\n`
      + 'Isso e REDIRECIONAMENTO ABERTO: a vitima confere o dominio (e o\n'
      + 'nosso), clica em Voltar e cai fora do site. Quem barra e\n'
      + '`caminhoInternoSeguro` em lib/url.js — nao afrouxe a checagem.',
    ).toBe('/');
  });
});

describe('quem ESCREVE o `?de=` e quem o LÊ concordam', () => {
  it('o link nunca carrega um valor que o leitor recusaria', () => {
    // Sem esta concordância, o link sairia com um `?de=` que o botão do outro
    // lado descarta em silêncio — e o "Voltar" erraria sem nada acusar (§1.5).
    for (const [payload] of CASOS_DE_ATAQUE) {
      expect(
        comVoltaPara('/termos', payload),
        `comVoltaPara escreveu um "de" com "${payload}", que BotaoVoltar recusa.`,
      ).toBe('/termos');
    }
  });

  it('a origem válida sobrevive à ida e à volta', () => {
    const url = comVoltaPara('/termos', '/login?modo=cadastro');
    expect(url).toBe('/termos?de=%2Flogin%3Fmodo%3Dcadastro');
    expect(montar(url).getAttribute('href')).toBe('/login?modo=cadastro');
  });
});
