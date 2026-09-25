/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { analisarFormatacao } from '../analisar';
import { varrerFontes } from '../../__tests__/varrerFontes';
import TextoFormatado from '../../../components/ui/TextoFormatado';

/**
 * `[25/09]` A formatação de post NÃO pode virar HTML — nunca.
 *
 * ── O que está em jogo ────────────────────────────────────────────────────
 *
 * Antes desta fase, o conteúdo de um post era um nó de texto do React:
 * `{post.content}`. Era **seguro por construção**, e o projeto tinha **zero**
 * `dangerouslySetInnerHTML`. Dar formatação ao usuário é exatamente a mudança
 * que costuma acabar com isso.
 *
 * O desenho escolhido mantém o zero: o analisador devolve uma ÁRVORE e o
 * componente vira cada nó num elemento React. Não existe string de HTML em
 * ponto nenhum, então não há o que passar para `dangerouslySetInnerHTML`.
 *
 * ── 1. O `href` — o único ponto por onde script ainda entraria ────────────
 *
 * Marcação não injeta script; `href` injeta. `[clique](javascript:alert(1))`
 * é o ataque, e ele já aconteceu neste projeto: em agosto, `getEmbedInfo`
 * devolvia link para qualquer string e `javascript:` virava href de verdade.
 *
 * ── 2. HTML digitado tem de aparecer como TEXTO ───────────────────────────
 *
 * ── 3. O projeto inteiro continua sem `dangerouslySetInnerHTML` ───────────
 *
 * A varredura olha o `src/` todo, não só este componente: a tentação aparece
 * em qualquer lugar que renderize texto de usuário.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `safeExternalUrl` removido do link -> falhou no `javascript:`
 *   . `dangerouslySetInnerHTML` num componente -> falhou nomeando o arquivo
 */

afterEach(cleanup);

const desenhar = (texto) => render(<TextoFormatado texto={texto} />).container;

describe('link perigoso nunca vira href', () => {
  it.each([
    ['javascript:alert(1)'],
    ['JaVaScRiPt:alert(1)'],
    ['data:text/html,x'],
    ['vbscript:msgbox(1)'],
    ['file:///etc/passwd'],
  ])('%s não vira link', (url) => {
    const container = desenhar(`olha [clique aqui](${url}) aí`);

    expect([...container.querySelectorAll('a')], [
      `A URL perigosa "${url}" virou um <a href>.`,
      '',
      'Marcação não injeta script, mas `href` injeta — e este projeto já teve',
      'um XSS armazenado exatamente assim, em agosto: `javascript:` chegando a',
      'virar href de post. Quem clicava executava script na origem do site,',
      'com o token de sessão do Supabase acessível no localStorage.',
      '',
      'Todo link tem de passar por `safeExternalUrl` (lib/url.js).',
    ].join('\n')).toEqual([]);

    expect(container.textContent, 'a URL recusada tem de virar TEXTO, não sumir')
      .toContain(url);
  });

  it('link http e https continuam funcionando', () => {
    const container = desenhar('veja [o site](https://exemplo.com/x) aqui');
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://exemplo.com/x');
    expect(a?.getAttribute('rel'), 'link externo precisa de rel seguro')
      .toContain('noopener');
  });
});

describe('HTML digitado aparece como texto, não como elemento', () => {
  it.each([
    ['<script>alert(1)</script>'],
    ['<img src=x onerror=alert(1)>'],
    ['<iframe src="https://evil.com"></iframe>'],
    ['<a href="javascript:alert(1)">x</a>'],
    ['<svg onload=alert(1)>'],
  ])('%s não vira elemento', (payload) => {
    const container = desenhar(`antes ${payload} depois`);

    for (const tag of ['script', 'img', 'iframe', 'svg']) {
      expect(container.querySelector(tag), [
        `O payload "${payload}" produziu um <${tag}> de verdade.`,
        '',
        'O conteúdo de post é TEXTO. Se ele virou elemento, alguém trocou a',
        'árvore por string de HTML em algum ponto — e a classe inteira de XSS',
        'por marcação voltou.',
      ].join('\n')).toBeNull();
    }
    expect(container.querySelectorAll('a').length).toBe(0);
    expect(container.textContent).toContain(payload);
  });
});

describe('a marcação faz o que promete', () => {
  it('negrito, itálico e tachado viram os elementos certos', () => {
    const c = desenhar('um **forte**, um *leve* e um ~~riscado~~');
    expect(c.querySelector('strong')?.textContent).toBe('forte');
    expect(c.querySelector('em')?.textContent).toBe('leve');
    expect(c.querySelector('s')?.textContent).toBe('riscado');
  });

  it('lista e citação viram lista e citação', () => {
    const c = desenhar('- um\n- dois\n\n> citado');
    expect(c.querySelectorAll('li').length).toBe(2);
    expect(c.querySelector('blockquote')?.textContent).toContain('citado');
  });

  it('texto sem marcação atravessa igual — é o caso de TODO post antigo', () => {
    // Nada mudou no banco: os posts que já existiam têm de aparecer
    // exatamente como apareciam antes desta fase.
    const texto = 'Post antigo, sem asterisco nenhum. 2 * 3 = 6 e 5*4 também.';
    const c = desenhar(texto);
    expect(c.textContent).toBe(texto);
    expect(c.querySelector('strong')).toBeNull();
    expect(c.querySelector('em')).toBeNull();
  });

  it('o analisador devolve árvore, e nunca string de HTML', () => {
    const json = JSON.stringify(analisarFormatacao('**a** <b>não</b>'));
    expect(json, [
      'O analisador devolveu algo com aparência de HTML.',
      '',
      'Ele produz NÓS (`{tipo, filhos}`). Se passar a produzir marcação, o',
      'próximo passo natural de quem for desenhar é `dangerouslySetInnerHTML`.',
    ].join('\n')).not.toMatch(/<(strong|em|s|a|p|ul|li|blockquote)\b/);
  });
});

describe('o projeto inteiro continua sem dangerouslySetInnerHTML', () => {
  const fontes = varrerFontes('src');

  it('há fontes para varrer', () => {
    expect(fontes.length).toBeGreaterThan(100);
  });

  it('nenhum arquivo usa dangerouslySetInnerHTML', () => {
    const culpados = fontes.filter((f) =>
      readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .includes('dangerouslySetInnerHTML'));

    expect(culpados, [
      'Estes arquivos passaram a usar `dangerouslySetInnerHTML`:',
      ...culpados.map((c) => `    ${c}`),
      '',
      'O projeto tinha ZERO — e a formatação de post foi desenhada em ÁRVORE',
      'justamente para manter esse zero. Com HTML na jogada, a segurança passa',
      'a depender de um sanitizador conhecer todos os truques, em vez de o',
      'perigo simplesmente não existir.',
      '',
      'Se houver caso legítimo (conteúdo NOSSO, nunca de usuário), ele entra',
      'com a justificativa escrita ao lado e uma exceção nomeada aqui.',
    ].join('\n')).toEqual([]);
  });
});
